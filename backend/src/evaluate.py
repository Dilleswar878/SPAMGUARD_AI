from typing import Any, Dict, List

import numpy as np
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import StratifiedKFold, cross_val_score


def evaluate_classifier(
    pipeline: Any,
    X_train: List[str],
    y_train: List[int],
    X_test: List[str],
    y_test: List[int],
) -> Dict[str, Any]:
    """
    Evaluate a fitted sklearn Pipeline on held-out stratified test split
    plus 5-fold stratified cross-validation on the training split.
    Label convention: 1 = spam, 0 = genuine.
    """
    y_pred = pipeline.predict(X_test)

    acc = float(accuracy_score(y_test, y_pred))
    prec = float(precision_score(y_test, y_pred, pos_label=1, zero_division=0))
    rec = float(recall_score(y_test, y_pred, pos_label=1, zero_division=0))
    f1 = float(f1_score(y_test, y_pred, pos_label=1, zero_division=0))

    cm = confusion_matrix(y_test, y_pred, labels=[0, 1])
    tn, fp, fn, tp = int(cm[0, 0]), int(cm[0, 1]), int(cm[1, 0]), int(cm[1, 1])

    # Determine safe fold count given minority class count in training set
    _, class_counts = np.unique(y_train, return_counts=True)
    n_splits = int(min(5, class_counts.min())) if len(class_counts) > 1 else 2
    cv_mean_f1 = f1
    cv_std_f1 = 0.0
    if n_splits >= 2:
        skf = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=42)
        cv_scores = cross_val_score(
            pipeline, X_train, y_train, cv=skf, scoring="f1", n_jobs=1
        )
        cv_mean_f1 = float(np.mean(cv_scores))
        cv_std_f1 = float(np.std(cv_scores))

    return {
        "accuracy": round(acc, 4),
        "precision": round(prec, 4),
        "recall": round(rec, 4),
        "f1_score": round(f1, 4),
        "cv_f1_mean": round(cv_mean_f1, 4),
        "cv_f1_std": round(cv_std_f1, 4),
        "cv_folds": n_splits,
        "test_samples": len(y_test),
        "confusion_matrix": {
            "matrix": [[tn, fp], [fn, tp]],
            "tn": tn,
            "fp": fp,
            "fn": fn,
            "tp": tp,
            "labels": ["genuine", "spam"],
        },
        "error_analysis": (
            f"False positives (genuine flagged as spam): {fp}; "
            f"False negatives (spam missed): {fn}."
        ),
    }
