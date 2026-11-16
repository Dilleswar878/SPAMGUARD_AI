import { useRef, useState } from 'react';
import {
  Database,
  Loader2,
  Moon,
  RefreshCw,
  RotateCcw,
  Server,
  Sun,
  Upload,
} from 'lucide-react';
import type { ThemeMode } from '../hooks/useTheme';
import {
  ApiError,
  getApiBaseUrl,
  setCustomApiBaseUrl,
  spamGuardApi,
} from '../services/api';
import type { HealthResponse } from '../types/api';

interface SettingsPageProps {
  health: HealthResponse | null;
  backendUnreachable: boolean;
  onRefreshHealth: () => Promise<void>;
  theme: ThemeMode;
  onSetTheme: (theme: ThemeMode) => void;
  onNotify: (type: 'success' | 'error', message: string) => void;
}

export function SettingsPage({
  health,
  backendUnreachable,
  onRefreshHealth,
  theme,
  onSetTheme,
  onNotify,
}: SettingsPageProps) {
  const [apiUrlInput, setApiUrlInput] = useState(() => getApiBaseUrl());
  const [testing, setTesting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleTestConnection = async () => {
    setTesting(true);
    setCustomApiBaseUrl(apiUrlInput);
    try {
      const res = await spamGuardApi.getHealth();
      await onRefreshHealth();
      onNotify(
        'success',
        `Connected to ${res.service} (SQLite: ${res.database.reviews_count ?? 0} reviews, Active: ${res.active_model ?? 'None'}).`,
      );
    } catch (err) {
      await onRefreshHealth();
      onNotify(
        'error',
        err instanceof ApiError ? err.message : 'Backend connection test failed.',
      );
    } finally {
      setTesting(false);
    }
  };

  const handleUploadCsv = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const res = await spamGuardApi.uploadDataset(file, true);
      await onRefreshHealth();
      onNotify(
        'success',
        `Uploaded '${res.dataset.dataset_name}' (${res.dataset.total_rows} rows) and retrained all 4 classifiers.`,
      );
    } catch (err) {
      onNotify(
        'error',
        err instanceof ApiError ? err.message : 'Dataset upload failed.',
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleResetDemoDataset = async () => {
    setResetting(true);
    try {
      await spamGuardApi.resetDataset();
      await onRefreshHealth();
      onNotify(
        'success',
        'Restored SpamGuard Demonstration Dataset and retrained all 4 classifiers.',
      );
    } catch (err) {
      onNotify(
        'error',
        err instanceof ApiError ? err.message : 'Failed to reset dataset.',
      );
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Backend & Database Connection */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800/90 dark:bg-[#0B1120]">
        <div className="flex items-center gap-2.5">
          <Server className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Backend & SQLite Status
          </h2>
        </div>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Configure or verify live connectivity to the Python Flask REST API
        </p>

        <dl className="mt-5 space-y-3 border-t border-slate-200 pt-4 text-xs dark:border-slate-800">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-slate-500 dark:text-slate-400">Flask API Status</dt>
            <dd
              className={`font-mono font-semibold ${
                !backendUnreachable && health?.status === 'ok'
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-rose-700 dark:text-rose-400'
              }`}
            >
              {!backendUnreachable && health?.status === 'ok' ? 'Connected' : 'Unavailable'}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-slate-500 dark:text-slate-400">SQLite Database</dt>
            <dd className="font-mono text-slate-900 dark:text-slate-200">
              {health?.database.connected
                ? `Connected (${health.database.reviews_count ?? 0} reviews)`
                : 'Disconnected'}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-slate-500 dark:text-slate-400">Active ML Classifier</dt>
            <dd className="font-mono text-slate-900 dark:text-slate-200">
              {health?.active_model || 'Not trained'}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-slate-500 dark:text-slate-400">Model Pipeline Version</dt>
            <dd className="font-mono text-slate-900 dark:text-slate-200">
              {health?.model_version || '—'}
            </dd>
          </div>
        </dl>

        <div className="mt-5 space-y-2 border-t border-slate-200 pt-4 dark:border-slate-800">
          <label
            htmlFor="api-base-input"
            className="block text-xs font-medium text-slate-700 dark:text-slate-300"
          >
            Flask Backend URL Override (leave blank for built-in /api proxy)
          </label>
          <div className="flex gap-2">
            <input
              id="api-base-input"
              type="url"
              value={apiUrlInput}
              onChange={(e) => setApiUrlInput(e.target.value)}
              placeholder="e.g. https://your-flask-service.onrender.com"
              className="h-9 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 font-mono text-xs text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-cyan-600 px-3.5 text-xs font-semibold text-white hover:bg-cyan-700 disabled:opacity-60 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400 whitespace-nowrap shrink-0"
            >
              {testing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Test Backend Connection
            </button>
          </div>
        </div>
      </section>

      {/* Dataset Management */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800/90 dark:bg-[#0B1120]">
        <div className="flex items-center gap-2.5">
          <Database className="h-4 w-4 text-fuchsia-600 dark:text-fuchsia-400" />
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Training Dataset Configuration
          </h2>
        </div>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Upload a labelled CSV with <code className="font-mono">review_text</code> and{' '}
          <code className="font-mono">label</code> (spam / genuine) columns
        </p>

        {health?.dataset ? (
          <div className="mt-5 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs dark:border-slate-800 dark:bg-slate-900/60">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-slate-900 dark:text-white">
                {health.dataset.dataset_name}
              </span>
              <span className="font-mono text-[11px] uppercase text-cyan-700 dark:text-cyan-400">
                {health.dataset.dataset_type}
              </span>
            </div>
            <p className="font-mono text-slate-600 tabular-nums dark:text-slate-300">
              Total rows: {health.dataset.total_rows} · Spam: {health.dataset.spam_rows} · Genuine:{' '}
              {health.dataset.genuine_rows}
            </p>
            <p className="text-slate-500 dark:text-slate-400">{health.dataset.notice}</p>
          </div>
        ) : (
          <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
            Dataset details unavailable while backend is disconnected.
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => handleUploadCsv(e.target.files?.[0])}
          />
          <button
            type="button"
            disabled={uploading || backendUnreachable}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400"
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            Upload Labelled CSV & Retrain
          </button>

          {health?.dataset?.dataset_type === 'uploaded' && (
            <button
              type="button"
              disabled={resetting}
              onClick={handleResetDemoDataset}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Restore Demo Dataset
            </button>
          )}
        </div>
      </section>

      {/* Appearance & Theme */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800/90 dark:bg-[#0B1120]">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">
          Display Theme
        </h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Switch between dark navy/charcoal mode and high-clarity light mode
        </p>

        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={() => onSetTheme('dark')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-3 text-xs font-semibold transition-colors ${
              theme === 'dark'
                ? 'border-cyan-500 bg-cyan-500/10 text-cyan-300'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'
            }`}
          >
            <Moon className="h-4 w-4" />
            Dark Navy Mode
          </button>
          <button
            type="button"
            onClick={() => onSetTheme('light')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-3 text-xs font-semibold transition-colors ${
              theme === 'light'
                ? 'border-cyan-600 bg-cyan-50 text-cyan-900'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'
            }`}
          >
            <Sun className="h-4 w-4" />
            Light Mode
          </button>
        </div>
      </section>

      {/* Application Information & Data Retention */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800/90 dark:bg-[#0B1120]">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">
          Application & Data Retention
        </h2>
        <dl className="mt-4 space-y-2.5 text-xs">
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500 dark:text-slate-400">Application</dt>
            <dd className="font-semibold text-slate-900 dark:text-white">SpamGuard AI</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500 dark:text-slate-400">System Title</dt>
            <dd className="text-slate-800 dark:text-slate-200">
              AI-Based Spam Review Detection System
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-slate-500 dark:text-slate-400">Tagline</dt>
            <dd className="text-slate-800 dark:text-slate-200">
              Detect Fake Reviews. Build Digital Trust.
            </dd>
          </div>
        </dl>
        <p className="mt-4 border-t border-slate-200 pt-4 text-xs leading-relaxed text-slate-500 dark:border-slate-800 dark:text-slate-400">
          Data Retention: Only submitted review text, predicted classification, model score,
          processing latency, and timestamps are stored in SQLite. No personal user profiles,
          IP addresses, or third-party tracking identifiers are collected. Records can be deleted
          individually at any time from Review History.
        </p>
      </section>
    </div>
  );
}
