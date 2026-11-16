import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from config import Config


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


@contextmanager
def get_db_connection():
    conn = sqlite3.connect(Config.DATABASE_PATH, timeout=15.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db() -> None:
    with get_db_connection() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS reviews (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                review_text TEXT NOT NULL,
                predicted_label TEXT NOT NULL CHECK(predicted_label IN ('spam', 'genuine')),
                model_name TEXT NOT NULL,
                model_score REAL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS model_information (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                model_name TEXT NOT NULL UNIQUE,
                model_version TEXT NOT NULL,
                accuracy REAL NOT NULL,
                precision REAL NOT NULL,
                recall REAL NOT NULL,
                f1_score REAL NOT NULL,
                training_date TEXT NOT NULL,
                active_status INTEGER NOT NULL DEFAULT 0 CHECK(active_status IN (0, 1))
            );

            CREATE TABLE IF NOT EXISTS prediction_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                review_id INTEGER NOT NULL,
                model_name TEXT NOT NULL,
                predicted_result TEXT NOT NULL CHECK(predicted_result IN ('spam', 'genuine')),
                prediction_time REAL NOT NULL,
                FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_reviews_label ON reviews(predicted_label);
            CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at);
            CREATE INDEX IF NOT EXISTS idx_reviews_model_name ON reviews(model_name);
            CREATE INDEX IF NOT EXISTS idx_prediction_history_review_id ON prediction_history(review_id);
            """
        )


def check_db_health() -> Dict[str, Any]:
    try:
        with get_db_connection() as conn:
            row = conn.execute("SELECT COUNT(*) AS cnt FROM reviews").fetchone()
            model_row = conn.execute(
                "SELECT COUNT(*) AS cnt FROM model_information"
            ).fetchone()
            return {
                "connected": True,
                "reviews_count": int(row["cnt"]),
                "models_count": int(model_row["cnt"]),
                "database_path": Config.DATABASE_PATH,
            }
    except Exception as exc:
        return {"connected": False, "error": str(exc)}


def insert_prediction_record(
    review_text: str,
    predicted_label: str,
    model_name: str,
    model_score: Optional[float],
    prediction_time_ms: float,
    created_at: Optional[str] = None,
) -> Dict[str, Any]:
    timestamp = created_at or utc_now_iso()
    with get_db_connection() as conn:
        cursor = conn.execute(
            """
            INSERT INTO reviews (review_text, predicted_label, model_name, model_score, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (review_text, predicted_label, model_name, model_score, timestamp),
        )
        review_id = cursor.lastrowid
        conn.execute(
            """
            INSERT INTO prediction_history (review_id, model_name, predicted_result, prediction_time)
            VALUES (?, ?, ?, ?)
            """,
            (review_id, model_name, predicted_label, round(prediction_time_ms, 3)),
        )
        return {
            "id": review_id,
            "review_text": review_text,
            "predicted_label": predicted_label,
            "model_name": model_name,
            "model_score": model_score,
            "created_at": timestamp,
            "prediction_time": round(prediction_time_ms, 3),
        }


def upsert_model_information(
    model_name: str,
    model_version: str,
    accuracy: float,
    precision: float,
    recall: float,
    f1_score: float,
    training_date: str,
    active_status: bool,
) -> None:
    with get_db_connection() as conn:
        existing = conn.execute(
            "SELECT id, active_status FROM model_information WHERE model_name = ?",
            (model_name,),
        ).fetchone()
        if existing:
            conn.execute(
                """
                UPDATE model_information
                SET model_version = ?, accuracy = ?, precision = ?, recall = ?, f1_score = ?,
                    training_date = ?, active_status = ?
                WHERE model_name = ?
                """,
                (
                    model_version,
                    round(accuracy, 6),
                    round(precision, 6),
                    round(recall, 6),
                    round(f1_score, 6),
                    training_date,
                    1 if active_status else 0,
                    model_name,
                ),
            )
        else:
            conn.execute(
                """
                INSERT INTO model_information
                (model_name, model_version, accuracy, precision, recall, f1_score, training_date, active_status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    model_name,
                    model_version,
                    round(accuracy, 6),
                    round(precision, 6),
                    round(recall, 6),
                    round(f1_score, 6),
                    training_date,
                    1 if active_status else 0,
                ),
            )


def get_all_models_from_db() -> List[Dict[str, Any]]:
    with get_db_connection() as conn:
        rows = conn.execute(
            """
            SELECT id, model_name, model_version, accuracy, precision, recall, f1_score,
                   training_date, active_status
            FROM model_information
            ORDER BY id ASC
            """
        ).fetchall()
        return [
            {
                "id": int(r["id"]),
                "model_name": r["model_name"],
                "model_version": r["model_version"],
                "accuracy": float(r["accuracy"]),
                "precision": float(r["precision"]),
                "recall": float(r["recall"]),
                "f1_score": float(r["f1_score"]),
                "training_date": r["training_date"],
                "active_status": bool(r["active_status"]),
            }
            for r in rows
        ]


def get_active_model_name() -> Optional[str]:
    with get_db_connection() as conn:
        row = conn.execute(
            "SELECT model_name FROM model_information WHERE active_status = 1 LIMIT 1"
        ).fetchone()
        if row:
            return str(row["model_name"])
        fallback = conn.execute(
            "SELECT model_name FROM model_information ORDER BY f1_score DESC LIMIT 1"
        ).fetchone()
        return str(fallback["model_name"]) if fallback else None


def set_active_model_in_db(model_name: str) -> bool:
    with get_db_connection() as conn:
        exists = conn.execute(
            "SELECT id FROM model_information WHERE model_name = ?", (model_name,)
        ).fetchone()
        if not exists:
            return False
        conn.execute("UPDATE model_information SET active_status = 0")
        conn.execute(
            "UPDATE model_information SET active_status = 1 WHERE model_name = ?",
            (model_name,),
        )
        return True
