# SpamGuard AI — AI-Based Spam Review Detection System

**Tagline:** *Detect Fake Reviews. Build Digital Trust.*

SpamGuard AI is a full-stack academic and enterprise-ready NLP web application built with **React, TypeScript, Tailwind CSS, Recharts, Python Flask, Scikit-learn, Pandas, NumPy, and SQLite**.

---

## Architecture Overview

- **Frontend (`src/`):** React + TypeScript + Tailwind CSS + Lucide Icons + Recharts
- **Backend (`backend/`):** Independent Python 3 + Flask + Flask-CORS REST API
- **ML Pipeline (`backend/src/`):** Consistent NLP preprocessing (`preprocessing.py`), TF-IDF feature extraction (unigrams & bigrams fitted strictly on training data), stratified splitting, 5-fold cross-validation (`evaluate.py`), and four Scikit-learn classifiers:
  1. Multinomial Naive Bayes
  2. Logistic Regression
  3. Linear Support Vector Machine (`LinearSVC`, reporting uncalibrated decision margin honestly)
  4. Random Forest Classifier
- **Database (`backend/database.py`):** SQLite with foreign keys and indexes (`reviews`, `model_information`, `prediction_history`)

---

## Local Development Setup

### 1. Python Flask Backend Setup

```bash
cd backend
python3 -m venv .venv

# Linux / macOS
source .venv/bin/activate
# Windows PowerShell
# .venv\Scripts\Activate.ps1

pip install -r requirements.txt
python app.py
```

The Flask server runs on `http://127.0.0.1:5001` by default (configurable via `FLASK_PORT` or `PORT`).

Run backend unit and integration tests:
```bash
pytest tests/test_api.py -v
```

### 2. Frontend & Integrated Server Setup

From the project root:

```bash
npm install
npm run dev
```

`server.ts` serves the Vite React frontend on port `3000`, automatically spawns the Python Flask backend if not disabled (`DISABLE_AUTO_FLASK=true`), and proxies `/api/*` requests to Flask.

---

## Production Deployment Guide

### Option A: Single-Container Full-Stack Deployment
1. Install Python dependencies in `backend/.venv` and Node dependencies via `npm install`.
2. Build the frontend bundle:
   ```bash
   npm run build
   ```
3. Mount a persistent volume and set `DATABASE_PATH=/var/data/spamguard.db` so SQLite records survive container restarts (never rely on ephemeral disk in production).
4. Start the production server:
   ```bash
   NODE_ENV=production npm start
   ```

### Option B: Separate Frontend & Flask Backend Deployment
When deploying the React frontend to a static host (e.g., Vercel or Netlify) that does not run Python:
1. Deploy `backend/` to a Python host (e.g., Render, Railway, or an Ubuntu VM with Gunicorn: `gunicorn -w 2 -b 0.0.0.0:5001 app:app`) with a persistent disk mounted for `DATABASE_PATH`.
2. Set `CORS_ORIGINS` on the Flask backend to your frontend origin (e.g., `https://spamguard-ui.vercel.app`).
3. Set `VITE_API_BASE_URL` when building the frontend (or configure the Flask URL directly inside the **Settings** page in the UI).

---

## REST API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Backend, SQLite, and trained model status |
| `POST` | `/api/predict` | Classify review text and persist to SQLite |
| `GET` | `/api/history` | Paginated, searchable, sortable prediction history |
| `GET` | `/api/history/<id>` | Inspect single review and prediction metadata |
| `DELETE` | `/api/history/<id>` | Delete a review record |
| `GET` | `/api/dashboard` | Real database KPIs, charts, and recent predictions |
| `GET` | `/api/models` | Available classifiers and active selection |
| `POST` | `/api/train` | Train & evaluate all 4 classifiers |
| `GET` | `/api/metrics` | Accuracy, precision, recall, F1, CV, confusion matrices |
| `POST` | `/api/active-model` | Switch active classifier |
| `GET` | `/api/analytics` | Daily/weekly/monthly trends and model breakdown |
| `GET` | `/api/dataset` | Active training dataset metadata |
| `POST` | `/api/dataset/upload` | Upload & validate labelled CSV (`review_text,label`) |
| `POST` | `/api/dataset/reset` | Restore demonstration dataset |
