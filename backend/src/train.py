import json
import os
import re
from pathlib import Path
from typing import Any, Dict, Tuple

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import Pipeline
from sklearn.svm import LinearSVC

from config import Config, MODELS_DIR
from database import get_active_model_name, utc_now_iso, upsert_model_information
from src.evaluate import evaluate_classifier
from src.preprocessing import preprocess_text

MODEL_SLUGS = {
    "Multinomial Naive Bayes": "multinomial_naive_bayes",
    "Logistic Regression": "logistic_regression",
    "Linear Support Vector Machine": "linear_svm",
    "Random Forest Classifier": "random_forest",
}


def get_dataset_info() -> Dict[str, Any]:
    active_path = Path(Config.ACTIVE_DATASET_PATH)
    meta_path = Path(Config.DATASET_META_PATH)
    if active_path.exists() and meta_path.exists():
        try:
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
            df = pd.read_csv(active_path)
            return _summarize_dataset(df, meta)
        except Exception:
            pass

    demo_path = Path(Config.DEMO_DATASET_PATH)
    df = pd.read_csv(demo_path)
    meta = {
        "dataset_name": "SpamGuard Demonstration Dataset (demo_reviews.csv)",
        "dataset_type": "demonstration",
        "uploaded_at": None,
        "notice": (
            "Clearly labelled academic demonstration dataset for pipeline validation. "
            "Upload a labelled CSV (review_text, label) to evaluate on custom domain data."
        ),
    }
    return _summarize_dataset(df, meta)


def _summarize_dataset(df: pd.DataFrame, meta: Dict[str, Any]) -> Dict[str, Any]:
    labels = df["label"].astype(str).str.strip().str.lower()
    spam_count = int((labels == "spam").sum())
    genuine_count = int((labels == "genuine").sum())
    return {
        **meta,
        "total_rows": int(len(df)),
        "spam_rows": spam_count,
        "genuine_rows": genuine_count,
    }


def load_active_dataset() -> Tuple[pd.DataFrame, Dict[str, Any]]:
    active_path = Path(Config.ACTIVE_DATASET_PATH)
    if active_path.exists():
        df = pd.read_csv(active_path)
    else:
        df = pd.read_csv(Config.DEMO_DATASET_PATH)

    df = df[["review_text", "label"]].dropna().copy()
    df["review_text"] = df["review_text"].astype(str).str.strip()
    df["label"] = df["label"].astype(str).str.strip().str.lower()
    df = df[df["review_text"].str.len() > 0]
    df = df[df["label"].isin(["spam", "genuine"])]
    return df, get_dataset_info()


def validate_and_save_uploaded_csv(file_storage) -> Dict[str, Any]:
    try:
        df = pd.read_csv(file_storage)
    except Exception as exc:
        raise ValueError(f"Invalid CSV file format: {exc}") from exc

    normalized_cols = {c.strip().lower(): c for c in df.columns}
    if "review_text" not in normalized_cols or "label" not in normalized_cols:
        raise ValueError(
            "CSV must contain 'review_text' and 'label' columns."
        )

    clean_df = pd.DataFrame(
        {
            "review_text": df[normalized_cols["review_text"]].astype(str).str.strip(),
            "label": df[normalized_cols["label"]].astype(str).str.strip().str.lower(),
        }
    )
    clean_df = clean_df[clean_df["review_text"].str.len() >= 3]
    clean_df = clean_df[clean_df["label"].isin(["spam", "genuine"])]

    if len(clean_df) < 20:
        raise ValueError(
            "Dataset must contain at least 20 valid rows labelled 'spam' or 'genuine'."
        )

    counts = clean_df["label"].value_counts().to_dict()
    if counts.get("spam", 0) < 5 or counts.get("genuine", 0) < 5:
        raise ValueError(
            "Dataset must contain at least 5 'spam' rows and 5 'genuine' rows for stratified splitting."
        )

    clean_df.to_csv(Config.ACTIVE_DATASET_PATH, index=False)
    filename = re.sub(r"[^a-zA-Z0-9._-]", "_", getattr(file_storage, "filename", "uploaded.csv") or "uploaded.csv")
    meta = {
        "dataset_name": filename,
        "dataset_type": "uploaded",
        "uploaded_at": utc_now_iso(),
        "notice": "User-uploaded labelled CSV dataset.",
    }
    Path(Config.DATASET_META_PATH).write_text(json.dumps(meta, indent=2), encoding="utf-8")
    return _summarize_dataset(clean_df, meta)


def reset_to_demo_dataset() -> Dict[str, Any]:
    for path_str in (Config.ACTIVE_DATASET_PATH, Config.DATASET_META_PATH):
        p = Path(path_str)
        if p.exists():
            p.unlink()
    return get_dataset_info()


def _build_classifiers() -> Dict[str, Any]:
    return {
        "Multinomial Naive Bayes": MultinomialNB(alpha=0.5),
        "Logistic Regression": LogisticRegression(
            max_iter=1000, C=1.2, class_weight="balanced", random_state=42
        ),
        "Linear Support Vector Machine": LinearSVC(
            C=1.0, class_weight="balanced", random_state=42
        ),
        "Random Forest Classifier": RandomForestClassifier(
            n_estimators=160, max_depth=24, class_weight="balanced", random_state=42
        ),
    }


def _next_model_version() -> str:
    meta_path = Path(Config.MODELS_META_PATH)
    if meta_path.exists():
        try:
            existing = json.loads(meta_path.read_text(encoding="utf-8"))
            prev_ver = existing.get("model_version", "v1.0")
            major, minor = prev_ver.lstrip("v").split(".")
            return f"v{major}.{int(minor) + 1}"
        except Exception:
            pass
    return "v1.0"


def train_all_models(
    max_features: int = Config.DEFAULT_MAX_FEATURES,
    test_size: float = Config.DEFAULT_TEST_SIZE,
) -> Dict[str, Any]:
    max_features = max(200, min(int(max_features), 20000))
    test_size = max(0.15, min(float(test_size), 0.40))

    df, dataset_info = load_active_dataset()
    X_raw = df["review_text"].tolist()
    y = [1 if lbl == "spam" else 0 for lbl in df["label"].tolist()]

    # Preprocess consistently before splitting (stateless per-document normalization)
    X_clean = [preprocess_text(txt) for txt in X_raw]

    X_train, X_test, y_train, y_test = train_test_split(
        X_clean,
        y,
        test_size=test_size,
        stratify=y,
        random_state=42,
    )

    version = _next_model_version()
    trained_at = utc_now_iso()
    current_active = get_active_model_name()

    classifiers = _build_classifiers()
    results: Dict[str, Any] = {}
    best_model = None
    best_f1 = -1.0

    for model_name, clf in classifiers.items():
        # Fit TfidfVectorizer inside the Pipeline strictly on X_train to prevent leakage
        pipeline = Pipeline(
            [
                (
                    "tfidf",
                    TfidfVectorizer(
                        ngram_range=(1, 2),
                        max_features=max_features,
                        sublinear_tf=True,
                        token_pattern=r"(?u)\b\w+\b",
                    ),
                ),
                ("classifier", clf),
            ]
        )
        pipeline.fit(X_train, y_train)

        eval_metrics = evaluate_classifier(
            pipeline, X_train, y_train, X_test, y_test
        )

        vocab_size = len(pipeline.named_steps["tfidf"].vocabulary_)
        slug = MODEL_SLUGS[model_name]
        model_file = MODELS_DIR / f"{slug}_{version}.joblib"
        latest_link = MODELS_DIR / f"{slug}_latest.joblib"
        joblib.dump(pipeline, model_file)
        joblib.dump(pipeline, latest_link)

        results[model_name] = {
            "model_name": model_name,
            "model_version": version,
            "artifact_file": model_file.name,
            "vocab_size": vocab_size,
            "max_features": max_features,
            "training_samples": len(X_train),
            "test_samples": len(X_test),
            "training_date": trained_at,
            **eval_metrics,
        }

        if eval_metrics["f1_score"] > best_f1:
            best_f1 = eval_metrics["f1_score"]
            best_model = model_name

    active_choice = (
        current_active if current_active in classifiers else (best_model or "Logistic Regression")
    )

    for model_name, m in results.items():
        is_active = model_name == active_choice
        m["active_status"] = is_active
        upsert_model_information(
            model_name=model_name,
            model_version=version,
            accuracy=m["accuracy"],
            precision=m["precision"],
            recall=m["recall"],
            f1_score=m["f1_score"],
            training_date=trained_at,
            active_status=is_active,
        )

    metadata_payload = {
        "model_version": version,
        "trained_at": trained_at,
        "active_model": active_choice,
        "max_features": max_features,
        "test_size": test_size,
        "dataset": dataset_info,
        "models": results,
    }
    Path(Config.MODELS_META_PATH).write_text(
        json.dumps(metadata_payload, indent=2), encoding="utf-8"
    )
    return metadata_payload
