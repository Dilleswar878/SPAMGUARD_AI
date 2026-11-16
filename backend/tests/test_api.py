import io
import os
import sys
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


@pytest.fixture()
def client(tmp_path, monkeypatch):
    from config import Config

    test_db = tmp_path / "test_spamguard.db"
    monkeypatch.setattr(Config, "DATABASE_PATH", str(test_db))
    monkeypatch.setattr(Config, "ACTIVE_DATASET_PATH", str(tmp_path / "active.csv"))
    monkeypatch.setattr(Config, "DATASET_META_PATH", str(tmp_path / "ds_meta.json"))

    from app import create_app

    flask_app = create_app(auto_bootstrap=True)
    flask_app.config["TESTING"] = True
    with flask_app.test_client() as test_client:
        yield test_client


def test_health_endpoint(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.get_json()
    assert data["status"] == "ok"
    assert data["database"]["connected"] is True
    assert data["models_ready"] is True


def test_invalid_predict_inputs(client):
    res_empty = client.post("/api/predict", json={"review_text": "   "})
    assert res_empty.status_code == 400

    res_short = client.post("/api/predict", json={"review_text": "hi"})
    assert res_short.status_code == 400

    res_long = client.post("/api/predict", json={"review_text": "x" * 6000})
    assert res_long.status_code == 400

    res_bad_model = client.post(
        "/api/predict",
        json={"review_text": "Valid product review text here.", "model_name": "FakeNet"},
    )
    assert res_bad_model.status_code == 400


def test_genuine_and_spam_predictions_and_history_crud(client):
    genuine_text = "The product quality is excellent. Delivery was fast and the packaging was good."
    spam_text = "AMAZING OFFER!!! BUY NOW!!! CLICK THIS LINK TO GET FREE PRODUCTS!!!"

    r1 = client.post("/api/predict", json={"review_text": genuine_text})
    assert r1.status_code == 200
    d1 = r1.get_json()
    assert d1["predicted_label"] == "genuine"
    assert d1["id"] is not None

    r2 = client.post("/api/predict", json={"review_text": spam_text})
    assert r2.status_code == 200
    d2 = r2.get_json()
    assert d2["predicted_label"] == "spam"
    assert d2["id"] is not None

    # Verify SVM reports decision margin rather than fake probability
    r_svm = client.post(
        "/api/predict",
        json={
            "review_text": spam_text,
            "model_name": "Linear Support Vector Machine",
        },
    )
    assert r_svm.status_code == 200
    d_svm = r_svm.get_json()
    assert d_svm["score_type"] == "decision_margin"

    # Dashboard reflects exact DB counts
    dash = client.get("/api/dashboard").get_json()
    assert dash["summary"]["total_reviews"] == 3
    assert dash["summary"]["spam_reviews"] == 2
    assert dash["summary"]["genuine_reviews"] == 1

    # History search and delete
    hist = client.get("/api/history?label=spam").get_json()
    assert hist["pagination"]["total"] == 2

    del_res = client.delete(f"/api/history/{d1['id']}")
    assert del_res.status_code == 200

    missing_res = client.get(f"/api/history/{d1['id']}")
    assert missing_res.status_code == 404


def test_metrics_and_active_model_switch(client):
    metrics = client.get("/api/metrics").get_json()
    assert metrics["trained"] is True
    assert len(metrics["models"]) == 4

    res = client.post(
        "/api/active-model",
        json={"model_name": "Multinomial Naive Bayes"},
    )
    assert res.status_code == 200
    assert res.get_json()["active_model"] == "Multinomial Naive Bayes"


def test_csv_validation_rejects_bad_columns(client):
    bad_csv = io.BytesIO(b"text,target\nhello world,spam\n")
    res = client.post(
        "/api/dataset/upload",
        data={"file": (bad_csv, "bad.csv")},
        content_type="multipart/form-data",
    )
    assert res.status_code == 400
