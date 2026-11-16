import type {
  AnalyticsResponse,
  DashboardResponse,
  DatasetInfo,
  HealthResponse,
  HistoryResponse,
  MetricsResponse,
  PredictionResult,
  ReviewRecord,
} from '../types/api';

const STORAGE_API_KEY = 'spamguard_api_base_url';

export function getApiBaseUrl(): string {
  const custom = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_API_KEY) : null;
  if (custom && custom.trim().length > 0) {
    return custom.trim().replace(/\/+$/, '');
  }
  const envBase = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (envBase && envBase.trim().length > 0) {
    return envBase.trim().replace(/\/+$/, '');
  }
  return '';
}

export function setCustomApiBaseUrl(url: string): void {
  const trimmed = url.trim().replace(/\/+$/, '');
  if (!trimmed) {
    window.localStorage.removeItem(STORAGE_API_KEY);
  } else {
    window.localStorage.setItem(STORAGE_API_KEY, trimmed);
  }
}

export class ApiError extends Error {
  status: number;
  backendUnreachable: boolean;

  constructor(message: string, status = 500, backendUnreachable = false) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.backendUnreachable = backendUnreachable;
  }
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const base = getApiBaseUrl();
  const url = `${base}${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: {
        ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...(init?.headers || {}),
      },
    });
  } catch {
    throw new ApiError(
      'Unable to reach the Flask backend. Ensure the Python Flask server is running or check your API URL in Settings.',
      0,
      true,
    );
  }

  let data: unknown = null;
  try {
    data = await response.json();
  } catch {
    if (!response.ok) {
      throw new ApiError(
        `Backend returned HTTP ${response.status}.`,
        response.status,
        response.status === 502 || response.status === 503 || response.status === 504,
      );
    }
  }

  if (!response.ok) {
    const errObj = (data && typeof data === 'object' ? data : {}) as {
      error?: string;
      backend_unreachable?: boolean;
    };
    throw new ApiError(
      errObj.error || `Request failed with status ${response.status}.`,
      response.status,
      Boolean(errObj.backend_unreachable) || response.status === 503,
    );
  }

  return data as T;
}

export const spamGuardApi = {
  getHealth: () => requestJson<HealthResponse>('/api/health'),

  getDashboard: (params?: { search?: string; label?: string }) => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.label && params.label !== 'all') q.set('label', params.label);
    const qs = q.toString();
    return requestJson<DashboardResponse>(`/api/dashboard${qs ? `?${qs}` : ''}`);
  },

  predictReview: (reviewText: string, modelName?: string) =>
    requestJson<PredictionResult>('/api/predict', {
      method: 'POST',
      body: JSON.stringify({
        review_text: reviewText,
        ...(modelName ? { model_name: modelName } : {}),
      }),
    }),

  getHistory: (params: {
    search?: string;
    label?: string;
    model?: string;
    start_date?: string;
    end_date?: string;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
    page?: number;
    per_page?: number;
  }) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && String(v).trim() !== '' && v !== 'all') {
        q.set(k, String(v));
      }
    });
    return requestJson<HistoryResponse>(`/api/history?${q.toString()}`);
  },

  getHistoryItem: (id: number) => requestJson<ReviewRecord>(`/api/history/${id}`),

  deleteHistoryItem: (id: number) =>
    requestJson<{ deleted: boolean; id: number }>(`/api/history/${id}`, {
      method: 'DELETE',
    }),

  getMetrics: () => requestJson<MetricsResponse>('/api/metrics'),

  trainModels: (options?: { max_features?: number; test_size?: number }) =>
    requestJson<{ status: string; model_version: string; trained_at: string }>('/api/train', {
      method: 'POST',
      body: JSON.stringify(options || {}),
    }),

  setActiveModel: (modelName: string) =>
    requestJson<{ active_model: string; updated: boolean }>('/api/active-model', {
      method: 'POST',
      body: JSON.stringify({ model_name: modelName }),
    }),

  getAnalytics: (params: {
    granularity?: 'daily' | 'weekly' | 'monthly';
    start_date?: string;
    end_date?: string;
  }) => {
    const q = new URLSearchParams();
    if (params.granularity) q.set('granularity', params.granularity);
    if (params.start_date) q.set('start_date', params.start_date);
    if (params.end_date) q.set('end_date', params.end_date);
    return requestJson<AnalyticsResponse>(`/api/analytics?${q.toString()}`);
  },

  getDataset: () => requestJson<DatasetInfo>('/api/dataset'),

  uploadDataset: (file: File, retrain = true) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('retrain', retrain ? 'true' : 'false');
    return requestJson<{ dataset: DatasetInfo; retrained: boolean }>('/api/dataset/upload', {
      method: 'POST',
      body: formData,
    });
  },

  resetDataset: () =>
    requestJson<{ dataset: DatasetInfo }>('/api/dataset/reset', {
      method: 'POST',
    }),
};
