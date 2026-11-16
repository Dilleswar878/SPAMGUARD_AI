export type PredictionLabel = 'spam' | 'genuine';

export type ModelName =
  | 'Multinomial Naive Bayes'
  | 'Logistic Regression'
  | 'Linear Support Vector Machine'
  | 'Random Forest Classifier';

export type PageId =
  | 'dashboard'
  | 'analyze'
  | 'models'
  | 'history'
  | 'analytics'
  | 'settings';

export interface DatasetInfo {
  dataset_name: string;
  dataset_type: 'demonstration' | 'uploaded';
  uploaded_at: string | null;
  notice: string;
  total_rows: number;
  spam_rows: number;
  genuine_rows: number;
}

export interface HealthResponse {
  status: 'ok' | 'degraded';
  service: string;
  database: {
    connected: boolean;
    reviews_count?: number;
    models_count?: number;
    database_path?: string;
    error?: string;
  };
  models_ready: boolean;
  active_model: ModelName | string | null;
  model_version: string | null;
  dataset: DatasetInfo;
}

export interface TextSignals {
  char_count: number;
  word_count: number;
  uppercase_ratio: number;
  url_count: number;
  email_count: number;
  phone_count: number;
  exclamation_count: number;
  currency_mentions: number;
  percent_mentions: number;
  negations_preserved: string[];
}

export interface PredictionResult {
  id: number | null;
  review_text: string;
  preprocessed_text: string;
  predicted_label: PredictionLabel;
  model_name: string;
  model_score: number | null;
  score_type: 'probability_estimate' | 'decision_margin' | 'unavailable';
  score_label: string;
  needs_manual_review: boolean;
  uncertainty_reason: string | null;
  processing_time_ms: number;
  created_at: string | null;
  top_contributing_terms: string[];
  signals: TextSignals;
  explanation: string;
}

export interface ReviewRecord {
  id: number;
  review_text: string;
  predicted_label: PredictionLabel;
  model_name: string;
  model_score: number | null;
  created_at: string;
  prediction_time: number;
}

export interface ModelInfo {
  id: number;
  model_name: string;
  model_version: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1_score: number;
  training_date: string;
  active_status: boolean;
}

export interface ConfusionMatrixData {
  matrix: [[number, number], [number, number]];
  tn: number;
  fp: number;
  fn: number;
  tp: number;
  labels: [string, string];
}

export interface DetailedModelMetric extends ModelInfo {
  cv_f1_mean?: number;
  cv_f1_std?: number;
  cv_folds?: number;
  vocab_size?: number;
  training_samples?: number;
  test_samples?: number;
  confusion_matrix?: ConfusionMatrixData;
  error_analysis?: string;
}

export interface DashboardResponse {
  summary: {
    total_reviews: number;
    spam_reviews: number;
    genuine_reviews: number;
    spam_rate: number;
  };
  distribution: Array<{ name: string; value: number }>;
  daily_trends: Array<{
    date: string;
    total: number;
    spam: number;
    genuine: number;
  }>;
  model_performance: ModelInfo[];
  recent_predictions: ReviewRecord[];
}

export interface HistoryResponse {
  records: ReviewRecord[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

export interface MetricsResponse {
  trained: boolean;
  model_version: string | null;
  trained_at: string | null;
  active_model: string | null;
  dataset: DatasetInfo;
  models: DetailedModelMetric[];
}

export interface AnalyticsResponse {
  granularity: 'daily' | 'weekly' | 'monthly';
  summary: {
    total_reviews: number;
    spam_reviews: number;
    genuine_reviews: number;
    spam_rate: number;
  };
  distribution: Array<{ name: string; value: number }>;
  trends: Array<{
    period: string;
    total: number;
    spam: number;
    genuine: number;
  }>;
  detection_by_model: Array<{
    model_name: string;
    total: number;
    spam: number;
    genuine: number;
  }>;
  algorithm_comparison: ModelInfo[];
}
