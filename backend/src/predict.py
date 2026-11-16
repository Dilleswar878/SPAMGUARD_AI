import json
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

import joblib
import numpy as np

from config import Config, MODELS_DIR
from database import get_active_model_name, insert_prediction_record
from src.preprocessing import inspect_text_signals, preprocess_text
from src.train import MODEL_SLUGS


class ModelNotReadyError(RuntimeError):
    pass


def get_models_metadata() -> Optional[Dict[str, Any]]:
    meta_path = Path(Config.MODELS_META_PATH)
    if not meta_path.exists():
        return None
    try:
        return json.loads(meta_path.read_text(encoding="utf-8"))
    except Exception:
        return None


def _load_pipeline(model_name: str):
    if model_name not in MODEL_SLUGS:
        raise ValueError(f"Unsupported model: {model_name}")
    slug = MODEL_SLUGS[model_name]
    model_path = MODELS_DIR / f"{slug}_latest.joblib"
    if not model_path.exists():
        raise ModelNotReadyError(
            f"Trained model artifact for '{model_name}' not found. Run model training first."
        )
    return joblib.load(model_path)


def _extract_top_terms(pipeline: Any, cleaned_text: str, predicted_int: int) -> List[str]:
    try:
        tfidf = pipeline.named_steps["tfidf"]
        clf = pipeline.named_steps["classifier"]
        vec = tfidf.transform([cleaned_text])
        feature_names = np.array(tfidf.get_feature_names_out())
        nonzero_idx = vec.nonzero()[1]
        if len(nonzero_idx) == 0:
            return []

        weights = vec.toarray()[0][nonzero_idx]
        if hasattr(clf, "coef_"):
            coefs = clf.coef_[0][nonzero_idx]
            contributions = weights * coefs
            order = np.argsort(contributions)[::-1] if predicted_int == 1 else np.argsort(contributions)
            selected = [str(feature_names[nonzero_idx[i]]) for i in order[:5]]
            return [t for t in selected if not t.startswith("tok_")] or selected[:3]

        if hasattr(clf, "feature_log_prob_"):
            log_diff = (clf.feature_log_prob_[1][nonzero_idx] - clf.feature_log_prob_[0][nonzero_idx]) * weights
            order = np.argsort(log_diff)[::-1] if predicted_int == 1 else np.argsort(log_diff)
            selected = [str(feature_names[nonzero_idx[i]]) for i in order[:5]]
            return [t for t in selected if not t.startswith("tok_")] or selected[:3]

        if hasattr(clf, "feature_importances_"):
            imps = clf.feature_importances_[nonzero_idx] * weights
            order = np.argsort(imps)[::-1]
            selected = [str(feature_names[nonzero_idx[i]]) for i in order[:5]]
            return [t for t in selected if not t.startswith("tok_")] or selected[:3]
    except Exception:
        return []
    return []


def predict_review(
    review_text: str,
    requested_model: Optional[str] = None,
    save_to_db: bool = True,
) -> Dict[str, Any]:
    start_time = time.perf_counter()

    model_name = requested_model or get_active_model_name() or "Logistic Regression"
    if model_name not in Config.SUPPORTED_MODELS:
        raise ValueError(
            f"Unknown model '{model_name}'. Supported models: {', '.join(Config.SUPPORTED_MODELS)}"
        )

    pipeline = _load_pipeline(model_name)
    cleaned_text = preprocess_text(review_text)
    signals = inspect_text_signals(review_text)

    pred_int = int(pipeline.predict([cleaned_text])[0])
    predicted_label = "spam" if pred_int == 1 else "genuine"

    clf = pipeline.named_steps["classifier"]
    score_value: Optional[float] = None
    score_type = "unavailable"
    score_label = "Score unavailable"
    needs_manual_review = False
    uncertainty_reason: Optional[str] = None

    if hasattr(clf, "predict_proba"):
        probs = pipeline.predict_proba([cleaned_text])[0]
        spam_prob = float(probs[1])
        genuine_prob = float(probs[0])
        predicted_prob = spam_prob if pred_int == 1 else genuine_prob
        score_value = round(predicted_prob, 4)
        score_type = "probability_estimate"
        score_label = f"Estimated class probability ({round(predicted_prob * 100, 1)}%)"
        if 0.38 <= spam_prob <= 0.65:
            needs_manual_review = True
            uncertainty_reason = (
                "Estimated class probability falls in an uncertain borderline band (38%–65% spam). "
                "Human moderation review is recommended."
            )
    elif hasattr(clf, "decision_function"):
        # Uncalibrated LinearSVC margin — explicitly NOT a probability
        margin = float(pipeline.decision_function([cleaned_text])[0])
        score_value = round(margin, 4)
        score_type = "decision_margin"
        score_label = f"Uncalibrated SVM decision margin ({margin:+.3f})"
        if abs(margin) < 0.35:
            needs_manual_review = True
            uncertainty_reason = (
                "Linear SVM decision margin is close to the separating hyperplane (|margin| < 0.35). "
                "Uncalibrated margin is not a probability; manual verification recommended."
            )

    if signals["word_count"] < 4 and not needs_manual_review:
        needs_manual_review = True
        uncertainty_reason = (
            "Very short review (< 4 words) provides limited lexical context for automated classification."
        )

    top_terms = _extract_top_terms(pipeline, cleaned_text, pred_int)
    explanation = _build_explanation(
        predicted_label=predicted_label,
        model_name=model_name,
        signals=signals,
        top_terms=top_terms,
        score_type=score_type,
    )

    elapsed_ms = (time.perf_counter() - start_time) * 1000.0

    record_id = None
    created_at = None
    if save_to_db:
        saved = insert_prediction_record(
            review_text=review_text,
            predicted_label=predicted_label,
            model_name=model_name,
            model_score=score_value,
            prediction_time_ms=elapsed_ms,
        )
        record_id = saved["id"]
        created_at = saved["created_at"]

    return {
        "id": record_id,
        "review_text": review_text,
        "preprocessed_text": cleaned_text,
        "predicted_label": predicted_label,
        "model_name": model_name,
        "model_score": score_value,
        "score_type": score_type,
        "score_label": score_label,
        "needs_manual_review": needs_manual_review,
        "uncertainty_reason": uncertainty_reason,
        "processing_time_ms": round(elapsed_ms, 2),
        "created_at": created_at,
        "top_contributing_terms": top_terms,
        "signals": signals,
        "explanation": explanation,
    }


def _build_explanation(
    predicted_label: str,
    model_name: str,
    signals: Dict[str, Any],
    top_terms: List[str],
    score_type: str,
) -> str:
    cues: List[str] = []
    if signals["url_count"] > 0:
        cues.append(f"{signals['url_count']} external URL/domain pattern(s)")
    if signals["exclamation_count"] >= 3:
        cues.append(f"excessive exclamation marks ({signals['exclamation_count']})")
    if signals["uppercase_ratio"] >= 0.45 and signals["char_count"] >= 10:
        cues.append(f"high uppercase character ratio ({int(signals['uppercase_ratio'] * 100)}%)")
    if signals["phone_count"] > 0 or signals["email_count"] > 0:
        cues.append("direct external contact information")
    if signals["currency_mentions"] > 0 or signals["percent_mentions"] > 0:
        cues.append("promotional pricing/percentage tokens")
    if signals["negations_preserved"]:
        cues.append(
            f"preserved negation cue(s): {', '.join(signals['negations_preserved'][:3])}"
        )

    terms_clause = (
        f" Influential TF-IDF n-grams: {', '.join(top_terms)}."
        if top_terms
        else ""
    )

    if predicted_label == "spam":
        cue_text = (
            f"Detected {', '.join(cues)}."
            if cues
            else "Lexical n-gram distribution matches promotional or deceptive spam patterns."
        )
        margin_note = (
            " Score reflects uncalibrated SVM hyperplane distance rather than a calibrated probability."
            if score_type == "decision_margin"
            else " Probability score is a statistical estimate based on training vocabulary."
        )
        return f"{model_name} classified this text as spam. {cue_text}{terms_clause}{margin_note}"
    else:
        cue_text = (
            f"Balanced natural phrasing ({', '.join(cues)})."
            if cues
            else "Balanced descriptive language consistent with authentic product feedback."
        )
        margin_note = (
            " Score reflects uncalibrated SVM hyperplane distance rather than a calibrated probability."
            if score_type == "decision_margin"
            else " Probability score is a statistical estimate, not absolute certainty."
        )
        return f"{model_name} classified this text as genuine. {cue_text}{terms_clause}{margin_note}"
