import logging
from typing import Any, Dict, List

from flask import Flask, jsonify, request
from flask_cors import CORS

from config import Config
from database import (
    check_db_health,
    get_active_model_name,
    get_all_models_from_db,
    get_db_connection,
    init_db,
    set_active_model_in_db,
)
from src.predict import ModelNotReadyError, get_models_metadata, predict_review
from src.train import (
    get_dataset_info,
    reset_to_demo_dataset,
    train_all_models,
    validate_and_save_uploaded_csv,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("spamguard")


def create_app(auto_bootstrap: bool = True) -> Flask:
    app = Flask(__name__)
    app.config["MAX_CONTENT_LENGTH"] = Config.MAX_CONTENT_LENGTH
    app.config["JSON_SORT_KEYS"] = False

    CORS(
        app,
        resources={r"/api/*": {"origins": Config.CORS_ORIGINS}},
        supports_credentials=False,
    )

    init_db()

    if auto_bootstrap:
        meta = get_models_metadata()
        models_db = get_all_models_from_db()
        if meta is None or len(models_db) == 0:
            try:
                logger.info("Bootstrapping initial ML models on demonstration dataset...")
                train_all_models()
                logger.info("Initial ML models trained and saved successfully.")
            except Exception as exc:
                logger.error("Failed to bootstrap initial models: %s", exc)

    @app.errorhandler(404)
    def handle_not_found(_err):
        return jsonify({"error": "Requested resource was not found."}), 404

    @app.errorhandler(405)
    def handle_method_not_allowed(_err):
        return jsonify({"error": "HTTP method is not allowed for this endpoint."}), 405

    @app.errorhandler(413)
    def handle_payload_too_large(_err):
        return (
            jsonify({"error": "Uploaded file exceeds the 5 MB maximum size limit."}),
            413,
        )

    @app.errorhandler(Exception)
    def handle_unexpected_error(err):
        logger.exception("Unhandled server exception: %s", err)
        return (
            jsonify(
                {
                    "error": "An internal processing error occurred. Please try again."
                }
            ),
            500,
        )

    @app.get("/api/health")
    def health():
        db_status = check_db_health()
        meta = get_models_metadata()
        active_model = get_active_model_name()
        models_ready = meta is not None and bool(active_model)
        status_code = 200 if db_status.get("connected") else 503
        return (
            jsonify(
                {
                    "status": "ok" if db_status.get("connected") else "degraded",
                    "service": "SpamGuard AI Flask Backend",
                    "database": db_status,
                    "models_ready": models_ready,
                    "active_model": active_model,
                    "model_version": meta.get("model_version") if meta else None,
                    "dataset": get_dataset_info(),
                }
            ),
            status_code,
        )

    @app.post("/api/predict")
    def predict():
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            return jsonify({"error": "Request body must be valid JSON."}), 400

        raw_text = payload.get("review_text")
        if not isinstance(raw_text, str):
            return jsonify({"error": "'review_text' must be a text string."}), 400

        cleaned_input = raw_text.strip()
        if len(cleaned_input) < Config.MIN_REVIEW_LENGTH:
            return (
                jsonify(
                    {
                        "error": f"Review text must contain at least {Config.MIN_REVIEW_LENGTH} characters."
                    }
                ),
                400,
            )

        if len(cleaned_input) > Config.MAX_REVIEW_LENGTH:
            return (
                jsonify(
                    {
                        "error": f"Review text exceeds maximum allowed length of {Config.MAX_REVIEW_LENGTH} characters."
                    }
                ),
                400,
            )

        requested_model = payload.get("model_name")
        if requested_model is not None and not isinstance(requested_model, str):
            return jsonify({"error": "'model_name' must be a string."}), 400

        try:
            result = predict_review(
                review_text=cleaned_input,
                requested_model=requested_model,
                save_to_db=True,
            )
            return jsonify(result), 200
        except ModelNotReadyError as exc:
            return jsonify({"error": str(exc), "code": "MODEL_NOT_READY"}), 503
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400

    @app.get("/api/history")
    def get_history():
        search = (request.args.get("search") or "").strip()
        label_filter = (request.args.get("label") or "all").strip().lower()
        model_filter = (request.args.get("model") or "all").strip()
        start_date = (request.args.get("start_date") or "").strip()
        end_date = (request.args.get("end_date") or "").strip()

        sort_by = (request.args.get("sort_by") or "created_at").strip()
        sort_order = (request.args.get("sort_order") or "desc").strip().lower()

        allowed_sorts = {
            "id": "r.id",
            "created_at": "r.created_at",
            "predicted_label": "r.predicted_label",
            "model_name": "r.model_name",
            "model_score": "r.model_score",
        }
        sort_col = allowed_sorts.get(sort_by, "r.created_at")
        direction = "ASC" if sort_order == "asc" else "DESC"

        try:
            page = max(1, int(request.args.get("page", 1)))
        except ValueError:
            page = 1
        try:
            per_page = max(1, min(100, int(request.args.get("per_page", 10))))
        except ValueError:
            per_page = 10

        where_clauses: List[str] = []
        params: List[Any] = []

        if search:
            where_clauses.append("(r.review_text LIKE ? OR r.model_name LIKE ?)")
            like_val = f"%{search}%"
            params.extend([like_val, like_val])

        if label_filter in ("spam", "genuine"):
            where_clauses.append("r.predicted_label = ?")
            params.append(label_filter)

        if model_filter and model_filter.lower() != "all":
            where_clauses.append("r.model_name = ?")
            params.append(model_filter)

        if start_date:
            where_clauses.append("substr(r.created_at, 1, 10) >= ?")
            params.append(start_date[:10])

        if end_date:
            where_clauses.append("substr(r.created_at, 1, 10) <= ?")
            params.append(end_date[:10])

        where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
        offset = (page - 1) * per_page

        with get_db_connection() as conn:
            total_row = conn.execute(
                f"SELECT COUNT(*) AS cnt FROM reviews r {where_sql}", params
            ).fetchone()
            total = int(total_row["cnt"])

            rows = conn.execute(
                f"""
                SELECT r.id, r.review_text, r.predicted_label, r.model_name,
                       r.model_score, r.created_at,
                       COALESCE(ph.prediction_time, 0.0) AS prediction_time
                FROM reviews r
                LEFT JOIN prediction_history ph ON ph.review_id = r.id
                {where_sql}
                ORDER BY {sort_col} {direction}, r.id DESC
                LIMIT ? OFFSET ?
                """,
                [*params, per_page, offset],
            ).fetchall()

        records = [
            {
                "id": int(r["id"]),
                "review_text": r["review_text"],
                "predicted_label": r["predicted_label"],
                "model_name": r["model_name"],
                "model_score": r["model_score"],
                "created_at": r["created_at"],
                "prediction_time": float(r["prediction_time"]),
            }
            for r in rows
        ]
        total_pages = max(1, (total + per_page - 1) // per_page) if total > 0 else 1

        return jsonify(
            {
                "records": records,
                "pagination": {
                    "page": page,
                    "per_page": per_page,
                    "total": total,
                    "total_pages": total_pages,
                },
            }
        )

    @app.get("/api/history/<int:review_id>")
    def get_history_item(review_id: int):
        with get_db_connection() as conn:
            row = conn.execute(
                """
                SELECT r.id, r.review_text, r.predicted_label, r.model_name,
                       r.model_score, r.created_at,
                       COALESCE(ph.prediction_time, 0.0) AS prediction_time
                FROM reviews r
                LEFT JOIN prediction_history ph ON ph.review_id = r.id
                WHERE r.id = ?
                """,
                (review_id,),
            ).fetchone()

        if not row:
            return jsonify({"error": f"Review record #{review_id} was not found."}), 404

        return jsonify(
            {
                "id": int(row["id"]),
                "review_text": row["review_text"],
                "predicted_label": row["predicted_label"],
                "model_name": row["model_name"],
                "model_score": row["model_score"],
                "created_at": row["created_at"],
                "prediction_time": float(row["prediction_time"]),
            }
        )

    @app.delete("/api/history/<int:review_id>")
    def delete_history_item(review_id: int):
        with get_db_connection() as conn:
            existing = conn.execute(
                "SELECT id FROM reviews WHERE id = ?", (review_id,)
            ).fetchone()
            if not existing:
                return (
                    jsonify({"error": f"Review record #{review_id} was not found."}),
                    404,
                )
            conn.execute("DELETE FROM reviews WHERE id = ?", (review_id,))

        return jsonify({"deleted": True, "id": review_id}), 200

    @app.get("/api/dashboard")
    def dashboard():
        search = (request.args.get("search") or "").strip()
        label_filter = (request.args.get("label") or "all").strip().lower()

        with get_db_connection() as conn:
            totals = conn.execute(
                """
                SELECT
                    COUNT(*) AS total_reviews,
                    SUM(CASE WHEN predicted_label = 'spam' THEN 1 ELSE 0 END) AS spam_reviews,
                    SUM(CASE WHEN predicted_label = 'genuine' THEN 1 ELSE 0 END) AS genuine_reviews
                FROM reviews
                """
            ).fetchone()

            total_reviews = int(totals["total_reviews"] or 0)
            spam_reviews = int(totals["spam_reviews"] or 0)
            genuine_reviews = int(totals["genuine_reviews"] or 0)
            spam_rate = (
                round((spam_reviews / total_reviews) * 100.0, 1)
                if total_reviews > 0
                else 0.0
            )

            daily_rows = conn.execute(
                """
                SELECT
                    substr(created_at, 1, 10) AS date,
                    COUNT(*) AS total,
                    SUM(CASE WHEN predicted_label = 'spam' THEN 1 ELSE 0 END) AS spam,
                    SUM(CASE WHEN predicted_label = 'genuine' THEN 1 ELSE 0 END) AS genuine
                FROM reviews
                GROUP BY substr(created_at, 1, 10)
                ORDER BY date ASC
                LIMIT 30
                """
            ).fetchall()

            recent_where = []
            recent_params: List[Any] = []
            if search:
                recent_where.append("(r.review_text LIKE ? OR r.model_name LIKE ?)")
                recent_params.extend([f"%{search}%", f"%{search}%"])
            if label_filter in ("spam", "genuine"):
                recent_where.append("r.predicted_label = ?")
                recent_params.append(label_filter)

            where_sql = f"WHERE {' AND '.join(recent_where)}" if recent_where else ""
            recent_rows = conn.execute(
                f"""
                SELECT r.id, r.review_text, r.predicted_label, r.model_name,
                       r.model_score, r.created_at,
                       COALESCE(ph.prediction_time, 0.0) AS prediction_time
                FROM reviews r
                LEFT JOIN prediction_history ph ON ph.review_id = r.id
                {where_sql}
                ORDER BY r.id DESC
                LIMIT 10
                """,
                recent_params,
            ).fetchall()

        models_db = get_all_models_from_db()

        return jsonify(
            {
                "summary": {
                    "total_reviews": total_reviews,
                    "spam_reviews": spam_reviews,
                    "genuine_reviews": genuine_reviews,
                    "spam_rate": spam_rate,
                },
                "distribution": [
                    {"name": "Spam", "value": spam_reviews},
                    {"name": "Genuine", "value": genuine_reviews},
                ],
                "daily_trends": [
                    {
                        "date": r["date"],
                        "total": int(r["total"]),
                        "spam": int(r["spam"] or 0),
                        "genuine": int(r["genuine"] or 0),
                    }
                    for r in daily_rows
                ],
                "model_performance": models_db,
                "recent_predictions": [
                    {
                        "id": int(r["id"]),
                        "review_text": r["review_text"],
                        "predicted_label": r["predicted_label"],
                        "model_name": r["model_name"],
                        "model_score": r["model_score"],
                        "created_at": r["created_at"],
                        "prediction_time": float(r["prediction_time"]),
                    }
                    for r in recent_rows
                ],
            }
        )

    @app.get("/api/models")
    def list_models():
        models_db = get_all_models_from_db()
        meta = get_models_metadata()
        active_model = get_active_model_name()
        return jsonify(
            {
                "models": models_db,
                "active_model": active_model,
                "model_version": meta.get("model_version") if meta else None,
                "trained_at": meta.get("trained_at") if meta else None,
                "trained": len(models_db) > 0 and meta is not None,
                "dataset": get_dataset_info(),
            }
        )

    @app.post("/api/train")
    def train():
        payload = request.get_json(silent=True) or {}
        if not isinstance(payload, dict):
            return jsonify({"error": "Request body must be JSON."}), 400

        max_features = payload.get("max_features", Config.DEFAULT_MAX_FEATURES)
        test_size = payload.get("test_size", Config.DEFAULT_TEST_SIZE)

        try:
            max_features = int(max_features)
            test_size = float(test_size)
        except (TypeError, ValueError):
            return (
                jsonify(
                    {
                        "error": "'max_features' must be an integer and 'test_size' must be a decimal between 0.15 and 0.40."
                    }
                ),
                400,
            )

        result = train_all_models(max_features=max_features, test_size=test_size)
        return jsonify({"status": "trained", **result}), 200

    @app.get("/api/metrics")
    def metrics():
        models_db = get_all_models_from_db()
        meta = get_models_metadata()
        detailed_models = meta.get("models", {}) if meta else {}

        combined: List[Dict[str, Any]] = []
        for m in models_db:
            name = m["model_name"]
            detail = detailed_models.get(name, {})
            combined.append(
                {
                    **m,
                    "cv_f1_mean": detail.get("cv_f1_mean"),
                    "cv_f1_std": detail.get("cv_f1_std"),
                    "cv_folds": detail.get("cv_folds"),
                    "vocab_size": detail.get("vocab_size"),
                    "training_samples": detail.get("training_samples"),
                    "test_samples": detail.get("test_samples"),
                    "confusion_matrix": detail.get("confusion_matrix"),
                    "error_analysis": detail.get("error_analysis"),
                }
            )

        return jsonify(
            {
                "trained": len(combined) > 0 and meta is not None,
                "model_version": meta.get("model_version") if meta else None,
                "trained_at": meta.get("trained_at") if meta else None,
                "active_model": get_active_model_name(),
                "dataset": meta.get("dataset") if meta else get_dataset_info(),
                "models": combined,
            }
        )

    @app.post("/api/active-model")
    def select_active_model():
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict) or not isinstance(
            payload.get("model_name"), str
        ):
            return jsonify({"error": "'model_name' string is required."}), 400

        model_name = payload["model_name"].strip()
        if model_name not in Config.SUPPORTED_MODELS:
            return (
                jsonify(
                    {
                        "error": f"Unsupported model '{model_name}'. Choose from: {', '.join(Config.SUPPORTED_MODELS)}"
                    }
                ),
                400,
            )

        updated = set_active_model_in_db(model_name)
        if not updated:
            return (
                jsonify(
                    {
                        "error": f"Model '{model_name}' has not been trained yet. Run training first."
                    }
                ),
                404,
            )

        return jsonify({"active_model": model_name, "updated": True}), 200

    @app.get("/api/analytics")
    def analytics():
        granularity = (request.args.get("granularity") or "daily").strip().lower()
        start_date = (request.args.get("start_date") or "").strip()
        end_date = (request.args.get("end_date") or "").strip()

        where_clauses: List[str] = []
        params: List[Any] = []
        if start_date:
            where_clauses.append("substr(created_at, 1, 10) >= ?")
            params.append(start_date[:10])
        if end_date:
            where_clauses.append("substr(created_at, 1, 10) <= ?")
            params.append(end_date[:10])

        where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

        if granularity == "monthly":
            bucket_expr = "substr(created_at, 1, 7)"
        elif granularity == "weekly":
            bucket_expr = "strftime('%Y-W%W', substr(created_at, 1, 10))"
        else:
            granularity = "daily"
            bucket_expr = "substr(created_at, 1, 10)"

        with get_db_connection() as conn:
            totals = conn.execute(
                f"""
                SELECT
                    COUNT(*) AS total,
                    SUM(CASE WHEN predicted_label = 'spam' THEN 1 ELSE 0 END) AS spam,
                    SUM(CASE WHEN predicted_label = 'genuine' THEN 1 ELSE 0 END) AS genuine
                FROM reviews
                {where_sql}
                """,
                params,
            ).fetchone()

            trend_rows = conn.execute(
                f"""
                SELECT
                    {bucket_expr} AS period,
                    COUNT(*) AS total,
                    SUM(CASE WHEN predicted_label = 'spam' THEN 1 ELSE 0 END) AS spam,
                    SUM(CASE WHEN predicted_label = 'genuine' THEN 1 ELSE 0 END) AS genuine
                FROM reviews
                {where_sql}
                GROUP BY period
                ORDER BY period ASC
                """,
                params,
            ).fetchall()

            model_breakdown_rows = conn.execute(
                f"""
                SELECT
                    model_name,
                    COUNT(*) AS total,
                    SUM(CASE WHEN predicted_label = 'spam' THEN 1 ELSE 0 END) AS spam,
                    SUM(CASE WHEN predicted_label = 'genuine' THEN 1 ELSE 0 END) AS genuine
                FROM reviews
                {where_sql}
                GROUP BY model_name
                ORDER BY total DESC
                """,
                params,
            ).fetchall()

        total = int(totals["total"] or 0)
        spam = int(totals["spam"] or 0)
        genuine = int(totals["genuine"] or 0)

        return jsonify(
            {
                "granularity": granularity,
                "summary": {
                    "total_reviews": total,
                    "spam_reviews": spam,
                    "genuine_reviews": genuine,
                    "spam_rate": round((spam / total) * 100.0, 1) if total > 0 else 0.0,
                },
                "distribution": [
                    {"name": "Spam", "value": spam},
                    {"name": "Genuine", "value": genuine},
                ],
                "trends": [
                    {
                        "period": r["period"],
                        "total": int(r["total"]),
                        "spam": int(r["spam"] or 0),
                        "genuine": int(r["genuine"] or 0),
                    }
                    for r in trend_rows
                ],
                "detection_by_model": [
                    {
                        "model_name": r["model_name"],
                        "total": int(r["total"]),
                        "spam": int(r["spam"] or 0),
                        "genuine": int(r["genuine"] or 0),
                    }
                    for r in model_breakdown_rows
                ],
                "algorithm_comparison": get_all_models_from_db(),
            }
        )

    @app.get("/api/dataset")
    def dataset_status():
        return jsonify(get_dataset_info())

    @app.post("/api/dataset/upload")
    def upload_dataset():
        if "file" not in request.files:
            return jsonify({"error": "No CSV file provided under 'file' field."}), 400

        file = request.files["file"]
        if not file or not file.filename:
            return jsonify({"error": "Uploaded file is empty."}), 400

        if not file.filename.lower().endswith(".csv"):
            return jsonify({"error": "Only .csv files are supported."}), 400

        try:
            dataset_summary = validate_and_save_uploaded_csv(file)
            retrain = request.form.get("retrain", "true").lower() == "true"
            training_result = train_all_models() if retrain else None
            return (
                jsonify(
                    {
                        "dataset": dataset_summary,
                        "retrained": retrain,
                        "training": training_result,
                    }
                ),
                200,
            )
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400

    @app.post("/api/dataset/reset")
    def reset_dataset():
        dataset_summary = reset_to_demo_dataset()
        training_result = train_all_models()
        return jsonify({"dataset": dataset_summary, "training": training_result}), 200

    return app


app = create_app(auto_bootstrap=True)

if __name__ == "__main__":
    app.run(
        host=Config.FLASK_HOST,
        port=Config.FLASK_PORT,
        debug=Config.FLASK_DEBUG,
    )
