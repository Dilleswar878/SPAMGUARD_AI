import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Cpu, Loader2, Play, RefreshCw } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ApiError, spamGuardApi } from '../services/api';
import type { DetailedModelMetric, MetricsResponse } from '../types/api';

interface ModelPerformancePageProps {
  onModelUpdated: () => void;
  onNotify: (type: 'success' | 'error', message: string) => void;
}

export function ModelPerformancePage({
  onModelUpdated,
  onNotify,
}: ModelPerformancePageProps) {
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [training, setTraining] = useState(false);
  const [switchingModel, setSwitchingModel] = useState<string | null>(null);
  const [selectedMatrixModel, setSelectedMatrixModel] = useState<string>('');
  const [maxFeatures, setMaxFeatures] = useState<number>(3000);
  const [testSize, setTestSize] = useState<number>(0.25);

  const loadMetrics = useCallback(async () => {
    setLoading(true);
    try {
      const res = await spamGuardApi.getMetrics();
      setMetrics(res);
      if (res.models.length > 0) {
        setSelectedMatrixModel((prev) =>
          prev && res.models.some((m) => m.model_name === prev)
            ? prev
            : res.active_model || res.models[0].model_name,
        );
      }
    } catch (err) {
      onNotify(
        'error',
        err instanceof ApiError ? err.message : 'Failed to load model metrics.',
      );
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  const handleTrainModels = async () => {
    setTraining(true);
    try {
      const res = await spamGuardApi.trainModels({
        max_features: maxFeatures,
        test_size: testSize,
      });
      onNotify(
        'success',
        `All 4 classifiers trained successfully (Version ${res.model_version}).`,
      );
      await loadMetrics();
      onModelUpdated();
    } catch (err) {
      onNotify(
        'error',
        err instanceof ApiError ? err.message : 'Training failed.',
      );
    } finally {
      setTraining(false);
    }
  };

  const handleSelectActive = async (modelName: string) => {
    setSwitchingModel(modelName);
    try {
      await spamGuardApi.setActiveModel(modelName);
      onNotify('success', `Active classifier switched to ${modelName}.`);
      await loadMetrics();
      onModelUpdated();
    } catch (err) {
      onNotify(
        'error',
        err instanceof ApiError ? err.message : 'Failed to switch active model.',
      );
    } finally {
      setSwitchingModel(null);
    }
  };

  const activeMatrixItem: DetailedModelMetric | undefined = metrics?.models.find(
    (m) => m.model_name === selectedMatrixModel,
  );

  return (
    <div className="space-y-6">
      {/* Training Controls & Status Header */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800/90 dark:bg-[#0B1120]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              ML Pipeline Training & Evaluation
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Status:{' '}
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {metrics?.trained ? 'Trained & Ready' : 'Not Trained'}
              </span>
              {' · '}
              Version:{' '}
              <span className="font-mono text-slate-800 dark:text-slate-200">
                {metrics?.model_version || '—'}
              </span>
              {' · '}
              Last Trained:{' '}
              <span className="font-mono tabular-nums text-slate-800 dark:text-slate-200">
                {metrics?.trained_at
                  ? new Date(metrics.trained_at).toLocaleString()
                  : 'Never'}
              </span>
            </p>
            {metrics?.dataset && (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Dataset: <span className="font-medium text-slate-700 dark:text-slate-300">{metrics.dataset.dataset_name}</span>{' '}
                ({metrics.dataset.total_rows} rows: {metrics.dataset.spam_rows} spam / {metrics.dataset.genuine_rows} genuine)
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label
                htmlFor="max-features-input"
                className="block text-[11px] font-medium text-slate-500 dark:text-slate-400"
              >
                TF-IDF Max Features
              </label>
              <select
                id="max-features-input"
                value={maxFeatures}
                onChange={(e) => setMaxFeatures(Number(e.target.value))}
                className="mt-1 h-9 rounded-lg border border-slate-200 bg-slate-50 px-2.5 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value={1000}>1,000</option>
                <option value={2000}>2,000</option>
                <option value={3000}>3,000</option>
                <option value={5000}>5,000</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="test-split-input"
                className="block text-[11px] font-medium text-slate-500 dark:text-slate-400"
              >
                Test Split Ratio
              </label>
              <select
                id="test-split-input"
                value={testSize}
                onChange={(e) => setTestSize(Number(e.target.value))}
                className="mt-1 h-9 rounded-lg border border-slate-200 bg-slate-50 px-2.5 font-mono text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value={0.2}>20% Test / 80% Train</option>
                <option value={0.25}>25% Test / 75% Train</option>
                <option value={0.3}>30% Test / 70% Train</option>
              </select>
            </div>

            <button
              type="button"
              onClick={handleTrainModels}
              disabled={training}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-cyan-600 px-4 text-xs font-semibold text-white hover:bg-cyan-700 disabled:opacity-60 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400 whitespace-nowrap"
            >
              {training ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Training All 4 Models...
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5" />
                  Train Models
                </>
              )}
            </button>

            <button
              type="button"
              onClick={loadMetrics}
              aria-label="Refresh metrics"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </section>

      {/* Evaluation Table */}
      <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800/90 dark:bg-[#0B1120]">
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800/90">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Algorithm Evaluation Comparison
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Actual held-out test metrics and 5-fold stratified cross-validation F1 scores
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <th className="px-4 py-3 font-medium">Algorithm</th>
                <th className="px-4 py-3 text-right font-medium">Accuracy</th>
                <th className="px-4 py-3 text-right font-medium">Precision</th>
                <th className="px-4 py-3 text-right font-medium">Recall</th>
                <th className="px-4 py-3 text-right font-medium">F1-Score</th>
                <th className="px-4 py-3 text-right font-medium">CV F1 (Mean)</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {loading && !metrics ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="h-11">
                    <td colSpan={8} className="px-4 py-2">
                      <div className="h-4 w-full rounded bg-slate-100 dark:bg-slate-800" />
                    </td>
                  </tr>
                ))
              ) : !metrics?.models || metrics.models.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-500 dark:text-slate-400">
                    No evaluation metrics available yet. Click Train Models above to evaluate all four algorithms.
                  </td>
                </tr>
              ) : (
                metrics.models.map((m) => (
                  <tr
                    key={m.model_name}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Cpu className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
                        {m.model_name}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      {(m.accuracy * 100).toFixed(2)}%
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      {(m.precision * 100).toFixed(2)}%
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      {(m.recall * 100).toFixed(2)}%
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-cyan-700 tabular-nums dark:text-cyan-300">
                      {(m.f1_score * 100).toFixed(2)}%
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-600 tabular-nums dark:text-slate-300">
                      {m.cv_f1_mean !== undefined
                        ? `${(m.cv_f1_mean * 100).toFixed(2)}%`
                        : '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {m.active_status ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Active
                        </span>
                      ) : (
                        <span className="text-slate-500 dark:text-slate-400">Trained</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedMatrixModel(m.model_name)}
                          className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          Matrix
                        </button>
                        <button
                          type="button"
                          disabled={m.active_status || switchingModel === m.model_name}
                          onClick={() => handleSelectActive(m.model_name)}
                          className="rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-40 dark:bg-cyan-500/20 dark:text-cyan-300 dark:hover:bg-cyan-500/30"
                        >
                          {m.active_status ? 'Selected' : 'Set Active'}
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

      {/* Bar Chart & Confusion Matrix Side-by-Side */}
      {metrics?.models && metrics.models.length > 0 && (
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800/90 dark:bg-[#0B1120] lg:col-span-7">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              Metrics Comparison Chart
            </h3>
            <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
              Precision vs Recall balance across classifiers
            </p>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={metrics.models.map((m) => ({
                    name: m.model_name
                      .replace(' Classifier', '')
                      .replace(' Support Vector Machine', ' SVM'),
                    Accuracy: Number((m.accuracy * 100).toFixed(1)),
                    Precision: Number((m.precision * 100).toFixed(1)),
                    Recall: Number((m.recall * 100).toFixed(1)),
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
                  <Bar dataKey="Accuracy" fill="#06B6D4" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Precision" fill="#6366F1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Recall" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="F1-Score" fill="#D946EF" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800/90 dark:bg-[#0B1120] lg:col-span-5">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Confusion Matrix
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Held-out test split error breakdown
                </p>
              </div>
              <select
                value={selectedMatrixModel}
                onChange={(e) => setSelectedMatrixModel(e.target.value)}
                aria-label="Select model for confusion matrix"
                className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                {metrics.models.map((m) => (
                  <option key={m.model_name} value={m.model_name}>
                    {m.model_name}
                  </option>
                ))}
              </select>
            </div>

            {activeMatrixItem?.confusion_matrix ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-cyan-200 bg-cyan-50/70 p-4 dark:border-cyan-500/30 dark:bg-cyan-950/20">
                    <p className="text-[11px] font-medium text-cyan-800 dark:text-cyan-300">
                      True Negative (Genuine → Genuine)
                    </p>
                    <p className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums dark:text-white">
                      {activeMatrixItem.confusion_matrix.tn}
                    </p>
                  </div>
                  <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-500/30 dark:bg-amber-950/20">
                    <p className="text-[11px] font-medium text-amber-800 dark:text-amber-300">
                      False Positive (Genuine → Spam)
                    </p>
                    <p className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums dark:text-white">
                      {activeMatrixItem.confusion_matrix.fp}
                    </p>
                  </div>
                  <div className="rounded-lg border border-rose-200 bg-rose-50/70 p-4 dark:border-rose-500/30 dark:bg-rose-950/20">
                    <p className="text-[11px] font-medium text-rose-800 dark:text-rose-300">
                      False Negative (Spam → Genuine)
                    </p>
                    <p className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums dark:text-white">
                      {activeMatrixItem.confusion_matrix.fn}
                    </p>
                  </div>
                  <div className="rounded-lg border border-fuchsia-200 bg-fuchsia-50/70 p-4 dark:border-fuchsia-500/30 dark:bg-fuchsia-950/20">
                    <p className="text-[11px] font-medium text-fuchsia-800 dark:text-fuchsia-300">
                      True Positive (Spam → Spam)
                    </p>
                    <p className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums dark:text-white">
                      {activeMatrixItem.confusion_matrix.tp}
                    </p>
                  </div>
                </div>

                <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
                  <p>{activeMatrixItem.error_analysis}</p>
                  <p className="font-mono text-[11px] tabular-nums">
                    Train samples: {activeMatrixItem.training_samples ?? '—'} · Test samples:{' '}
                    {activeMatrixItem.test_samples ?? '—'} · TF-IDF vocab:{' '}
                    {activeMatrixItem.vocab_size ?? '—'}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500">Confusion matrix not available.</p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
