import { useCallback, useEffect, useState } from 'react';
import {
  ArrowDownUp,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Search,
  Trash2,
} from 'lucide-react';
import { ClassificationTag } from '../components/ClassificationTag';
import { ApiError, spamGuardApi } from '../services/api';
import type { HistoryResponse, PageId, ReviewRecord } from '../types/api';

interface ReviewHistoryPageProps {
  onNavigate: (page: PageId) => void;
  onNotify: (type: 'success' | 'error', message: string) => void;
}

const MODELS = [
  'all',
  'Multinomial Naive Bayes',
  'Logistic Regression',
  'Linear Support Vector Machine',
  'Random Forest Classifier',
];

export function ReviewHistoryPage({ onNavigate, onNotify }: ReviewHistoryPageProps) {
  const [historyData, setHistoryData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [labelFilter, setLabelFilter] = useState<'all' | 'spam' | 'genuine'>('all');
  const [modelFilter, setModelFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const perPage = 10;

  const [inspecting, setInspecting] = useState<ReviewRecord | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ReviewRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await spamGuardApi.getHistory({
        search: search.trim() || undefined,
        label: labelFilter,
        model: modelFilter,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
        page,
        per_page: perPage,
      });
      setHistoryData(res);
    } catch (err) {
      onNotify(
        'error',
        err instanceof ApiError ? err.message : 'Failed to load review history.',
      );
    } finally {
      setLoading(false);
    }
  }, [
    search,
    labelFilter,
    modelFilter,
    startDate,
    endDate,
    sortBy,
    sortOrder,
    page,
    onNotify,
  ]);

  useEffect(() => {
    const t = setTimeout(() => {
      loadHistory();
    }, 180);
    return () => clearTimeout(t);
  }, [loadHistory]);

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
    setPage(1);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await spamGuardApi.deleteHistoryItem(confirmDelete.id);
      onNotify('success', `Review record #${confirmDelete.id} deleted from SQLite.`);
      setConfirmDelete(null);
      if (inspecting?.id === confirmDelete.id) {
        setInspecting(null);
      }
      await loadHistory();
    } catch (err) {
      onNotify(
        'error',
        err instanceof ApiError ? err.message : 'Failed to delete review record.',
      );
    } finally {
      setDeleting(false);
    }
  };

  const handleExportCsv = async () => {
    try {
      const exportRes = await spamGuardApi.getHistory({
        search: search.trim() || undefined,
        label: labelFilter,
        model: modelFilter,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        sort_by: sortBy,
        sort_order: sortOrder,
        page: 1,
        per_page: 100,
      });

      if (exportRes.records.length === 0) {
        onNotify('error', 'No matching records to export.');
        return;
      }

      const headers = [
        'id',
        'review_text',
        'predicted_label',
        'model_name',
        'model_score',
        'prediction_time_ms',
        'created_at',
      ];
      const escapeCsv = (val: string | number | null) => {
        const s = val === null || val === undefined ? '' : String(val);
        return `"${s.replace(/"/g, '""')}"`;
      };

      const rows = exportRes.records.map((r) =>
        [
          r.id,
          r.review_text,
          r.predicted_label,
          r.model_name,
          r.model_score,
          r.prediction_time,
          r.created_at,
        ]
          .map(escapeCsv)
          .join(','),
      );
      const csvContent = [headers.join(','), ...rows].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `spamguard_history_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      onNotify('success', `Exported ${exportRes.records.length} record(s) to CSV.`);
    } catch (err) {
      onNotify(
        'error',
        err instanceof ApiError ? err.message : 'Failed to export CSV.',
      );
    }
  };

  const records = historyData?.records || [];
  const pagination = historyData?.pagination;

  return (
    <div className="space-y-5">
      {/* Filter Toolbar */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800/90 dark:bg-[#0B1120]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="sm:col-span-2 lg:col-span-2">
              <label
                htmlFor="history-search"
                className="mb-1 block text-[11px] font-medium text-slate-500 dark:text-slate-400"
              >
                Search Review Text
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  id="history-search"
                  type="search"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Filter by keyword..."
                  className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="history-label"
                className="mb-1 block text-[11px] font-medium text-slate-500 dark:text-slate-400"
              >
                Label
              </label>
              <select
                id="history-label"
                value={labelFilter}
                onChange={(e) => {
                  setLabelFilter(e.target.value as 'all' | 'spam' | 'genuine');
                  setPage(1);
                }}
                className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="all">All Labels</option>
                <option value="spam">Spam Only</option>
                <option value="genuine">Genuine Only</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="history-model"
                className="mb-1 block text-[11px] font-medium text-slate-500 dark:text-slate-400"
              >
                Model
              </label>
              <select
                id="history-model"
                value={modelFilter}
                onChange={(e) => {
                  setModelFilter(e.target.value);
                  setPage(1);
                }}
                className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                {MODELS.map((m) => (
                  <option key={m} value={m}>
                    {m === 'all' ? 'All Models' : m}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label
                  htmlFor="history-start"
                  className="mb-1 block text-[11px] font-medium text-slate-500 dark:text-slate-400"
                >
                  From Date
                </label>
                <input
                  id="history-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setPage(1);
                  }}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label
                  htmlFor="history-end"
                  className="mb-1 block text-[11px] font-medium text-slate-500 dark:text-slate-400"
                >
                  To Date
                </label>
                <input
                  id="history-end"
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setPage(1);
                  }}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {(search || labelFilter !== 'all' || modelFilter !== 'all' || startDate || endDate) && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setLabelFilter('all');
                  setModelFilter('all');
                  setStartDate('');
                  setEndDate('');
                  setPage(1);
                }}
                className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Reset
              </button>
            )}
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400 whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </button>
          </div>
        </div>
      </section>

      {/* History Table */}
      <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800/90 dark:bg-[#0B1120]">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <th className="px-4 py-3 font-medium">
                  <button
                    type="button"
                    onClick={() => handleSort('id')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white"
                  >
                    ID
                    <ArrowDownUp className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-4 py-3 font-medium">Review Text</th>
                <th className="px-4 py-3 font-medium">
                  <button
                    type="button"
                    onClick={() => handleSort('predicted_label')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white"
                  >
                    Predicted Label
                    <ArrowDownUp className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-4 py-3 font-medium">Model</th>
                <th className="px-4 py-3 text-right font-medium">
                  <button
                    type="button"
                    onClick={() => handleSort('model_score')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white"
                  >
                    Score
                    <ArrowDownUp className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-4 py-3 font-medium">
                  <button
                    type="button"
                    onClick={() => handleSort('created_at')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white"
                  >
                    Date
                    <ArrowDownUp className="h-3 w-3" />
                  </button>
                </th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {loading && !historyData ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="h-11">
                    <td colSpan={7} className="px-4 py-2">
                      <div className="h-4 w-full rounded bg-slate-100 dark:bg-slate-800" />
                    </td>
                  </tr>
                ))
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      No prediction records found
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {search || labelFilter !== 'all' || modelFilter !== 'all' || startDate || endDate
                        ? 'Try clearing active search or date filters.'
                        : 'Analyse a review to create your first stored SQLite prediction.'}
                    </p>
                    {!search && labelFilter === 'all' && (
                      <button
                        type="button"
                        onClick={() => onNavigate('analyze')}
                        className="mt-4 rounded-lg bg-cyan-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-cyan-700 dark:bg-cyan-500 dark:text-slate-950"
                      >
                        Go to Review Analysis
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                records.map((rec) => (
                  <tr
                    key={rec.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-4 py-3 font-mono text-slate-500 tabular-nums dark:text-slate-400">
                      #{rec.id}
                    </td>
                    <td className="max-w-sm px-4 py-3 text-slate-800 dark:text-slate-200">
                      <p className="truncate">{rec.review_text}</p>
                    </td>
                    <td className="px-4 py-3">
                      <ClassificationTag label={rec.predicted_label} />
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {rec.model_name}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-700 tabular-nums dark:text-slate-200">
                      {rec.model_score !== null ? rec.model_score.toFixed(4) : '—'}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-500 tabular-nums dark:text-slate-400 whitespace-nowrap">
                      {new Date(rec.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setInspecting(rec)}
                          className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                          title="View full review"
                          aria-label={`View full review #${rec.id}`}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(rec)}
                          className="rounded p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-700 dark:text-slate-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                          title="Delete review"
                          aria-label={`Delete review #${rec.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {pagination && pagination.total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <span className="font-mono tabular-nums">
              Showing page {pagination.page} of {pagination.total_pages} ({pagination.total} total records)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={pagination.page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Previous
              </button>
              <button
                type="button"
                disabled={pagination.page >= pagination.total_pages}
                onClick={() => setPage((p) => p + 1)}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Full Review Inspection Modal */}
      {inspecting && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="inspect-modal-title"
        >
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-[#0B1120]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 id="inspect-modal-title" className="text-base font-bold text-slate-900 dark:text-white">
                  Review Record #{inspecting.id}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {inspecting.model_name} · {new Date(inspecting.created_at).toLocaleString()}
                </p>
              </div>
              <ClassificationTag label={inspecting.predicted_label} />
            </div>

            <div className="mt-4 max-h-60 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-sm leading-relaxed text-slate-800 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-200">
              {inspecting.review_text}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-mono tabular-nums">
                Model Score:{' '}
                {inspecting.model_score !== null
                  ? inspecting.model_score.toFixed(4)
                  : 'N/A'}
              </span>
              <span className="font-mono tabular-nums">
                Processing Time: {inspecting.prediction_time.toFixed(2)} ms
              </span>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setInspecting(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-modal-title"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-[#0B1120]">
            <h3 id="delete-modal-title" className="text-base font-bold text-slate-900 dark:text-white">
              Delete Record #{confirmDelete.id}?
            </h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              This will permanently remove the review and its linked prediction history entry from
              the SQLite database.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setConfirmDelete(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete Record'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
