import { AlertTriangle, RefreshCw } from 'lucide-react';

interface BackendStatusBannerProps {
  error: string;
  onRetry: () => void;
  onOpenSettings: () => void;
}

export function BackendStatusBanner({
  error,
  onRetry,
  onOpenSettings,
}: BackendStatusBannerProps) {
  return (
    <div
      role="alert"
      className="mb-6 flex flex-col gap-3 rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-rose-900 dark:border-rose-500/40 dark:bg-rose-950/40 dark:text-rose-200 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
        <div className="text-sm">
          <p className="font-semibold">Flask Backend Connection Pending or Unavailable</p>
          <p className="mt-0.5 text-rose-800 dark:text-rose-300">{error}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-medium text-rose-900 hover:bg-rose-100 focus-visible:outline-2 focus-visible:outline-cyan-500 dark:border-rose-500/40 dark:bg-slate-900 dark:text-rose-100 dark:hover:bg-rose-900/40 whitespace-nowrap shrink-0"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Retry Connection
        </button>
        <button
          type="button"
          onClick={onOpenSettings}
          className="inline-flex items-center rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-700 focus-visible:outline-2 focus-visible:outline-cyan-500 whitespace-nowrap shrink-0"
        >
          Check Settings
        </button>
      </div>
    </div>
  );
}
