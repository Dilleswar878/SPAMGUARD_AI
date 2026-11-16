import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ApiError, spamGuardApi } from '../services/api';
import type { AnalyticsResponse } from '../types/api';

interface AnalyticsPageProps {
  onNotify: (type: 'success' | 'error', message: string) => void;
}

const PIE_COLORS = ['#D946EF', '#06B6D4'];

export function AnalyticsPage({ onNotify }: AnalyticsPageProps) {
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [granularity, setGranularity] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await spamGuardApi.getAnalytics({
        granularity,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      });
      setData(res);
    } catch (err) {
      onNotify(
        'error',
        err instanceof ApiError ? err.message : 'Failed to load analytics.',
      );
    } finally {
      setLoading(false);
    }
  }, [granularity, startDate, endDate, onNotify]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const summary = data?.summary;
  const hasRecords = (summary?.total_reviews ?? 0) > 0;

  return (
    <div className="space-y-6">
      {/* Controls Bar */}
      <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800/90 dark:bg-[#0B1120] sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <span className="mb-1 block text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Trend Granularity
            </span>
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-700 dark:bg-slate-900">
              {(['daily', 'weekly', 'monthly'] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGranularity(g)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                    granularity === g
                      ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-800 dark:text-cyan-300'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor="analytics-start"
              className="mb-1 block text-[11px] font-medium text-slate-500 dark:text-slate-400"
            >
              Start Date
            </label>
            <input
              id="analytics-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label
              htmlFor="analytics-end"
              className="mb-1 block text-[11px] font-medium text-slate-500 dark:text-slate-400"
            >
              End Date
            </label>
            <input
              id="analytics-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-9 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {(startDate || endDate) && (
            <button
              type="button"
              onClick={() => {
                setStartDate('');
                setEndDate('');
              }}
              className="h-9 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Clear Dates
            </button>
          )}
          <button
            type="button"
            onClick={loadAnalytics}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </section>

      {/* Summary Row */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800/90 dark:bg-[#0B1120]">
          <p className="text-xs text-slate-500 dark:text-slate-400">Filtered Total</p>
          <p className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums dark:text-white">
            {summary?.total_reviews ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800/90 dark:bg-[#0B1120]">
          <p className="text-xs text-slate-500 dark:text-slate-400">Spam Detected</p>
          <p className="mt-1 font-mono text-2xl font-bold text-fuchsia-700 tabular-nums dark:text-fuchsia-400">
            {summary?.spam_reviews ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800/90 dark:bg-[#0B1120]">
          <p className="text-xs text-slate-500 dark:text-slate-400">Genuine Verified</p>
          <p className="mt-1 font-mono text-2xl font-bold text-cyan-700 tabular-nums dark:text-cyan-400">
            {summary?.genuine_reviews ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800/90 dark:bg-[#0B1120]">
          <p className="text-xs text-slate-500 dark:text-slate-400">Spam Rate</p>
          <p className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums dark:text-white">
            {(summary?.spam_rate ?? 0).toFixed(1)}%
          </p>
        </div>
      </section>

      {/* Trend & Distribution Charts */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800/90 dark:bg-[#0B1120] lg:col-span-8">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            {granularity.charAt(0).toUpperCase() + granularity.slice(1)} Detection Volume
          </h2>
          <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
            Actual predictions grouped by {granularity} period
          </p>

          {!data?.trends || data.trends.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-xs text-slate-500 dark:text-slate-400">
              No prediction timestamps available for the selected date range.
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.trends}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.25} />
                  <XAxis dataKey="period" tick={{ fontSize: 11 }} stroke="#64748B" />
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
                  <Area
                    type="monotone"
                    dataKey="spam"
                    name="Spam"
                    stroke="#D946EF"
                    fill="#D946EF"
                    fillOpacity={0.2}
                  />
                  <Area
                    type="monotone"
                    dataKey="genuine"
                    name="Genuine"
                    stroke="#06B6D4"
                    fill="#06B6D4"
                    fillOpacity={0.2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800/90 dark:bg-[#0B1120] lg:col-span-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Spam / Genuine Distribution
          </h2>
          <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
            Proportion within filtered records
          </p>

          {!hasRecords ? (
            <div className="flex h-64 items-center justify-center text-xs text-slate-500 dark:text-slate-400">
              No records in selected filter.
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data?.distribution || []}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
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
      </section>

      {/* Detection by Model & Algorithm Performance */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800/90 dark:bg-[#0B1120]">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Spam Detection Breakdown by Model
          </h2>
          <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
            Actual inference volume split by classifier used
          </p>

          {!data?.detection_by_model || data.detection_by_model.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-xs text-slate-500 dark:text-slate-400">
              No model prediction counts available yet.
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.detection_by_model.map((item) => ({
                    name: item.model_name
                      .replace(' Classifier', '')
                      .replace(' Support Vector Machine', ' SVM'),
                    Spam: item.spam,
                    Genuine: item.genuine,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.25} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#64748B" />
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
                  <Bar dataKey="Spam" stackId="a" fill="#D946EF" />
                  <Bar dataKey="Genuine" stackId="a" fill="#06B6D4" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800/90 dark:bg-[#0B1120]">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Algorithm Evaluation F1 vs Accuracy
          </h2>
          <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
            Test set benchmark from active trained pipelines
          </p>

          {!data?.algorithm_comparison || data.algorithm_comparison.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-xs text-slate-500 dark:text-slate-400">
              No trained model benchmarks found.
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.algorithm_comparison.map((m) => ({
                    name: m.model_name
                      .replace(' Classifier', '')
                      .replace(' Support Vector Machine', ' SVM'),
                    Accuracy: Number((m.accuracy * 100).toFixed(1)),
                    'F1-Score': Number((m.f1_score * 100).toFixed(1)),
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
                  <Bar dataKey="Accuracy" fill="#6366F1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="F1-Score" fill="#06B6D4" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
