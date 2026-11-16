import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
INSTANCE_DIR = BASE_DIR / "instance"
DATA_DIR = BASE_DIR / "data"
MODELS_DIR = BASE_DIR / "models"

INSTANCE_DIR.mkdir(parents=True, exist_ok=True)
DATA_DIR.mkdir(parents=True, exist_ok=True)
MODELS_DIR.mkdir(parents=True, exist_ok=True)


class Config:
    FLASK_HOST = os.environ.get("FLASK_HOST", "0.0.0.0")
    FLASK_PORT = int(os.environ.get("FLASK_PORT", os.environ.get("PORT", "5001")))
    FLASK_DEBUG = os.environ.get("FLASK_DEBUG", "false").lower() == "true"

    DATABASE_PATH = os.environ.get(
        "DATABASE_PATH", str(INSTANCE_DIR / "spamguard.db")
    )
    DEMO_DATASET_PATH = str(DATA_DIR / "demo_reviews.csv")
    ACTIVE_DATASET_PATH = str(INSTANCE_DIR / "active_dataset.csv")
    DATASET_META_PATH = str(INSTANCE_DIR / "dataset_meta.json")
    MODELS_META_PATH = str(MODELS_DIR / "models_metadata.json")

    MAX_REVIEW_LENGTH = int(os.environ.get("MAX_REVIEW_LENGTH", "5000"))
    MIN_REVIEW_LENGTH = 3
    MAX_CONTENT_LENGTH = 5 * 1024 * 1024  # 5 MB CSV upload limit

    DEFAULT_MAX_FEATURES = int(os.environ.get("TFIDF_MAX_FEATURES", "3000"))
    DEFAULT_TEST_SIZE = float(os.environ.get("TRAIN_TEST_SIZE", "0.25"))

    # Restricted CORS origins (comma-separated in production)
    CORS_ORIGINS = [
        origin.strip()
        for origin in os.environ.get(
            "CORS_ORIGINS",
            "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173",
        ).split(",")
        if origin.strip()
    ]

    SUPPORTED_MODELS = [
        "Multinomial Naive Bayes",
        "Logistic Regression",
        "Linear Support Vector Machine",
        "Random Forest Classifier",
    ]
