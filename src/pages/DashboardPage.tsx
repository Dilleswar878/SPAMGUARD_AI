import { useCallback, useEffect, useState } from 'react';
import {
  ArrowRight,
  Eye,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ClassificationTag } from '../components/ClassificationTag';
import { ApiError, spamGuardApi } from '../services/api';
import type { DashboardResponse, PageId, ReviewRecord } from '../types/api';

interface DashboardPageProps {
  onNavigate: (page: PageId) => void;
  onNotify: (type: 'success' | 'error', message: string) => void;
}

const PIE_COLORS = ['#D946EF', '#06B6D4'];

export function DashboardPage({ onNavigate, onNotify }: DashboardPageProps) {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [labelFilter, setLabelFilter] = useState<'all' | 'spam' | 'genuine'>('all');
  const [selectedRecord, setSelectedRecord] = useState<ReviewRecord | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await spamGuardApi.getDashboard({
        search: search.trim() || undefined,
        label: labelFilter,
      });
      setData(res);
      setError(null);
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : 'Failed to load dashboard statistics.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [search, labelFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadDashboard();
    }, 180);
    return () => clearTimeout(timer);
  }, [loadDashboard]);

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await spamGuardApi.deleteHistoryItem(id);
      onNotify('success', `Deleted review record #${id}.`);
      setSelectedRecord((prev) => (prev?.id === id ? null : prev));
      await loadDashboard();
    } catch (err) {
      onNotify(
        'error',
        err instanceof ApiError ? err.message : 'Failed to delete record.',
      );
    } finally {
      setDeletingId(null);
    }
  };

  const summary = data?.summary;
  const hasReviews = (summary?.total_reviews ?? 0) > 0;

  return (
    <div className="space-y-6">
      {/* KPI Summary Strip */}
      <section aria-label="Database summary metrics" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800/90 dark:bg-[#0B1120]">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Total Reviews Analysed
          </p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 tabular-nums dark:text-white">
            {loading && !data ? '—' : (summary?.total_reviews ?? 0).toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Stored in SQLite database
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800/90 dark:bg-[#0B1120]">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Spam Reviews Detected
          </p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-fuchsia-700 tabular-nums dark:text-fuchsia-400">
            {loading && !data ? '—' : (summary?.spam_reviews ?? 0).toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Flagged as promotional or deceptive
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800/90 dark:bg-[#0B1120]">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Genuine Reviews Detected
          </p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-cyan-700 tabular-nums dark:text-cyan-400">
            {loading && !data ? '—' : (summary?.genuine_reviews ?? 0).toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Verified natural customer feedback
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800/90 dark:bg-[#0B1120]">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Spam Detection Rate
          </p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900 tabular-nums dark:text-white">
            {loading && !data ? '—' : `${(summary?.spam_rate ?? 0).toFixed(1)}%`}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Share of analysed reviews flagged
          </p>
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/40 dark:bg-rose-950/30 dark:text-rose-200">
          {error}
        </div>
      )}

      {/* Charts Row */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Spam vs Genuine Pie Chart */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800/90 dark:bg-[#0B1120]">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Spam vs Genuine Split
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Actual SQLite classification distribution
              </p>
            </div>
          </div>

          {!hasReviews ? (
            <div className="flex h-60 flex-col items-center justify-center text-center">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                No reviews analysed yet
              </p>
              <p className="mt-1 max-w-xs text-xs text-slate-500 dark:text-slate-400">
                Run your first prediction to populate the spam versus genuine distribution chart.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('analyze')}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-cyan-700 dark:bg-cyan-500 dark:text-slate-950"
              >
                Analyze First Review
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data?.distribution || []}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={82}
                    paddingAngle={3}
                  >
                    {(data?.distribution || []).map((entry, idx) => (
                      <Cell key={entry.name} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0F172A',
                      borderColor: '#1E293B',
                      borderRadius: '8px',
                      color: '#F8FAFC',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Daily Review Analysis Line Chart */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800/90 dark:bg-[#0B1120] lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Daily Review Analysis
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Daily volume grouped by predicted class
              </p>
            </div>
          </div>

          {!data?.daily_trends || data.daily_trends.length === 0 ? (
            <div className="flex h-60 flex-col items-center justify-center text-center">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Daily trend timeline awaits predictions
              </p>
              <p className="mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">
                Daily spam and genuine counts appear automatically as reviews are submitted.
              </p>
            </div>
          ) : (
            <div className="h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.daily_trends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.25} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#64748B" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="#64748B" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0F172A',
                      borderColor: '#1E293B',
                      borderRadius: '8px',
                      color: '#F8FAFC',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Line
                    type="monotone"
                    dataKey="spam"
                    name="Spam"
                    stroke="#D946EF"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="genuine"
                    name="Genuine"
                    stroke="#06B6D4"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </section>

      {/* Model Performance Bar Chart */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800/90 dark:bg-[#0B1120]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Trained Classifier Comparison
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Stratified test set evaluation across all four Scikit-learn algorithms
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('models')}
            className="text-xs font-semibold text-cyan-700 hover:underline dark:text-cyan-400"
          >
            Inspect Confusion Matrices
          </button>
        </div>

        {!data?.model_performance || data.model_performance.length === 0 ? (
          <div className="flex h-56 items-center justify-center text-sm text-slate-500 dark:text-slate-400">
            No trained models found in database. Visit Model Performance to run training.
          </div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.model_performance.map((m) => ({
                  name: m.model_name.replace(' Classifier', '').replace(' Support Vector Machine', ' SVM'),
                  Accuracy: Math.round(m.accuracy * 1000) / 10,
                  Precision: Math.round(m.precision * 1000) / 10,
                  Recall: Math.round(m.recall * 1000) / 10,
                  'F1-Score': Math.round(m.f1_score * 1000) / 10,
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.25} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#64748B" />
                <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} stroke="#64748B" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0F172A',
                    borderColor: '#1E293B',
                    borderRadius: '8px',
                    color: '#F8FAFC',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="Accuracy" fill="#06B6D4" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Precision" fill="#6366F1" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Recall" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="F1-Score" fill="#D946EF" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* Recent Predictions Table */}
      <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800/90 dark:bg-[#0B1120]">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-5 dark:border-slate-800/90 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Recent Predictions
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Latest records persisted in SQLite
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search reviews or models..."
                className="h-9 w-52 rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="flex items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-700 dark:bg-slate-900">
              {(['all', 'spam', 'genuine'] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setLabelFilter(opt)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                    labelFilter === opt
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-cyan-300'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={loadDashboard}
              aria-label="Refresh dashboard"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <th className="px-4 py-3 font-medium">ID</th>
                <th className="px-4 py-3 font-medium">Review Text</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Model</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {loading && !data ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="h-11">
                    <td colSpan={6} className="px-4 py-2">
                      <div className="h-4 w-full rounded bg-slate-100 dark:bg-slate-800" />
                    </td>
                  </tr>
                ))
              ) : !data?.recent_predictions || data.recent_predictions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500 dark:text-slate-400">
                    {search || labelFilter !== 'all'
                      ? 'No predictions match your current search or filter.'
                      : 'No prediction records yet. Analyze a review to store your first entry.'}
                  </td>
                </tr>
              ) : (
                data.recent_predictions.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-4 py-3 font-mono text-slate-500 tabular-nums dark:text-slate-400">
                      #{row.id}
                    </td>
                    <td className="max-w-md px-4 py-3 text-slate-800 dark:text-slate-200">
                      <p className="truncate">{row.review_text}</p>
                    </td>
                    <td className="px-4 py-3">
                      <ClassificationTag label={row.predicted_label} />
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {row.model_name}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-500 tabular-nums dark:text-slate-400 whitespace-nowrap">
                      {new Date(row.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setSelectedRecord(row)}
                          className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                          title="Inspect full review"
                          aria-label={`View review #${row.id}`}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={deletingId === row.id}
                          onClick={() => handleDelete(row.id)}
                          className="rounded p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                          title="Delete record"
                          aria-label={`Delete review #${row.id}`}
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
      </section>

      {/* Record Inspection Modal */}
      {selectedRecord && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dash-modal-title"
        >
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-[#0B1120]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 id="dash-modal-title" className="text-base font-bold text-slate-900 dark:text-white">
                  Prediction Record #{selectedRecord.id}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {selectedRecord.model_name} · {new Date(selectedRecord.created_at).toLocaleString()}
                </p>
              </div>
              <ClassificationTag label={selectedRecord.predicted_label} />
            </div>

            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-sm leading-relaxed text-slate-800 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-200">
              {selectedRecord.review_text}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-mono tabular-nums">
                Score:{' '}
                {selectedRecord.model_score !== null
                  ? selectedRecord.model_score.toFixed(4)
                  : 'N/A'}
              </span>
              <span className="font-mono tabular-nums">
                Latency: {selectedRecord.prediction_time.toFixed(2)} ms
              </span>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
