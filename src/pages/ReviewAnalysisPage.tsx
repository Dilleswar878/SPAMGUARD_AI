import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Copy,
  Eraser,
  History,
  Loader2,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { ApiError, spamGuardApi } from '../services/api';
import type { ModelInfo, PageId, PredictionResult } from '../types/api';

interface ReviewAnalysisPageProps {
  activeModel: string | null;
  onNavigate: (page: PageId) => void;
  onNotify: (type: 'success' | 'error', message: string) => void;
}

const EXAMPLE_GENUINE =
  'The product quality is excellent. Delivery was fast and the packaging was good.';
const EXAMPLE_SPAM =
  'AMAZING OFFER!!! BUY NOW!!! CLICK THIS LINK TO GET FREE PRODUCTS!!!';
const MAX_CHARS = 5000;

export function ReviewAnalysisPage({
  activeModel,
  onNavigate,
  onNotify,
}: ReviewAnalysisPageProps) {
  const [reviewText, setReviewText] = useState('');
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>(activeModel || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    spamGuardApi
      .getMetrics()
      .then((res) => {
        setModels(res.models);
        if (!selectedModel && res.active_model) {
          setSelectedModel(res.active_model);
        }
      })
      .catch(() => {
        // Handled cleanly by parent banner / submit error
      });
  }, [selectedModel]);

  const handleAnalyze = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = reviewText.trim();
    if (trimmed.length < 3) {
      setError('Please enter at least 3 characters of review text before analysing.');
      return;
    }
    if (trimmed.length > MAX_CHARS) {
      setError(`Review text cannot exceed ${MAX_CHARS} characters.`);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const prediction = await spamGuardApi.predictReview(
        trimmed,
        selectedModel || undefined,
      );
      setResult(prediction);
      onNotify(
        'success',
        `Classified as ${prediction.predicted_label.toUpperCase()} and saved as record #${prediction.id}.`,
      );
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : 'Prediction request failed. Check backend connectivity.';
      setError(msg);
      onNotify('error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClear = () => {
    setReviewText('');
    setError(null);
    setResult(null);
  };

  const handleCopyResult = async () => {
    if (!result) return;
    const summary = [
      `SpamGuard AI Classification Report (Record #${result.id ?? 'N/A'})`,
      `Prediction: ${result.predicted_label.toUpperCase()}`,
      `Model: ${result.model_name}`,
      `Score: ${result.score_label}`,
      `Processing Time: ${result.processing_time_ms} ms`,
      `Timestamp: ${result.created_at}`,
      `Review: ${result.review_text}`,
      `Explanation: ${result.explanation}`,
    ].join('\n');

    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      onNotify('success', 'Classification report copied to clipboard.');
    } catch {
      onNotify('error', 'Clipboard permission denied in this browser context.');
    }
  };

  const formatScoreDisplay = (res: PredictionResult) => {
    if (res.model_score === null) return 'Unavailable';
    if (res.score_type === 'probability_estimate') {
      return `${(res.model_score * 100).toFixed(1)}% (Estimated Probability)`;
    }
    if (res.score_type === 'decision_margin') {
      return `${res.model_score >= 0 ? '+' : ''}${res.model_score.toFixed(4)} (Uncalibrated Margin)`;
    }
    return String(res.model_score);
  };

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      {/* Left Column: Input Form */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800/90 dark:bg-[#0B1120] xl:col-span-6">
        <form onSubmit={handleAnalyze} className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Submit Review for NLP Inspection
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Text is normalized, converted to TF-IDF unigrams/bigrams, and evaluated by Flask
              </p>
            </div>
          </div>

          {/* Example Quick-Fill Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Load Example:
            </span>
            <button
              type="button"
              onClick={() => {
                setReviewText(EXAMPLE_GENUINE);
                setError(null);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-medium text-cyan-800 hover:bg-cyan-100 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-300 dark:hover:bg-cyan-500/20"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Genuine Example
            </button>
            <button
              type="button"
              onClick={() => {
                setReviewText(EXAMPLE_SPAM);
                setError(null);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-fuchsia-200 bg-fuchsia-50 px-3 py-1.5 text-xs font-medium text-fuchsia-800 hover:bg-fuchsia-100 dark:border-fuchsia-500/30 dark:bg-fuchsia-500/10 dark:text-fuchsia-300 dark:hover:bg-fuchsia-500/20"
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              Spam Example
            </button>
          </div>

          {/* Review Textarea */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label
                htmlFor="review-input"
                className="text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Review Text
              </label>
              <span
                className={`font-mono text-xs tabular-nums ${
                  reviewText.length > MAX_CHARS
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {reviewText.length} / {MAX_CHARS}
              </span>
            </div>
            <textarea
              id="review-input"
              rows={7}
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="Paste or type a product review to classify as Spam or Genuine..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-[#070B14] dark:text-slate-100"
            />
          </div>

          {/* Model Selection */}
          <div>
            <label
              htmlFor="classifier-select"
              className="mb-1.5 block text-xs font-semibold text-slate-700 dark:text-slate-300"
            >
              Classifier Pipeline
            </label>
            <select
              id="classifier-select"
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 focus:border-cyan-500 focus:outline-none dark:border-slate-700 dark:bg-[#070B14] dark:text-slate-100"
            >
              {models.length === 0 ? (
                <option value={activeModel || 'Logistic Regression'}>
                  {activeModel || 'Active Trained Model'}
                </option>
              ) : (
                models.map((m) => (
                  <option key={m.model_name} value={m.model_name}>
                    {m.model_name}
                    {m.active_status ? ' (Active Default)' : ''}
                  </option>
                ))
              )}
            </select>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-rose-300 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800 dark:border-rose-500/40 dark:bg-rose-950/30 dark:text-rose-200"
            >
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={handleClear}
              disabled={submitting || (!reviewText && !result)}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Eraser className="h-4 w-4" />
              Clear
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-cyan-600 px-5 text-xs font-semibold text-white hover:bg-cyan-700 disabled:opacity-60 dark:bg-cyan-500 dark:text-slate-950 dark:hover:bg-cyan-400"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analysing Review...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Analyse Review
                </>
              )}
            </button>
          </div>
        </form>
      </section>

      {/* Right Column: Classification Result */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800/90 dark:bg-[#0B1120] xl:col-span-6">
        {!result ? (
          <div className="flex h-full min-h-[360px] flex-col items-center justify-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-cyan-400">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-sm font-semibold text-slate-900 dark:text-white">
              Ready for Classification
            </h3>
            <p className="mt-1 max-w-sm text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Submit a review on the left or load one of the demonstration examples to view
              the real-time TF-IDF prediction, score estimate, and NLP feature breakdown.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Result Verdict Header */}
            <div
              className={`sg-scanline-surface rounded-xl border p-4 ${
                result.predicted_label === 'spam'
                  ? 'border-fuchsia-300 bg-fuchsia-50/70 dark:border-fuchsia-500/40 dark:bg-fuchsia-950/20'
                  : 'border-cyan-300 bg-cyan-50/70 dark:border-cyan-500/40 dark:bg-cyan-950/20'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {result.predicted_label === 'spam' ? (
                    <ShieldAlert className="h-7 w-7 text-fuchsia-600 dark:text-fuchsia-400" />
                  ) : (
                    <ShieldCheck className="h-7 w-7 text-cyan-600 dark:text-cyan-400" />
                  )}
                  <div>
                    <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      Predicted Category
                    </p>
                    <p
                      className={`text-xl font-bold tracking-tight ${
                        result.predicted_label === 'spam'
                          ? 'text-fuchsia-800 dark:text-fuchsia-300'
                          : 'text-cyan-800 dark:text-cyan-300'
                      }`}
                    >
                      {result.predicted_label === 'spam'
                        ? 'Spam Warning Detected'
                        : 'Verified Genuine Review'}
                    </p>
                  </div>
                </div>
                <span className="font-mono text-xs text-slate-500 tabular-nums dark:text-slate-400">
                  Record #{result.id}
                </span>
              </div>
            </div>

            {/* Uncertainty / Manual Review Warning */}
            {result.needs_manual_review && result.uncertainty_reason && (
              <div
                role="status"
                className="flex items-start gap-2.5 rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-200"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <div>
                  <p className="font-semibold">Manual Review Recommended</p>
                  <p className="mt-0.5 leading-relaxed">{result.uncertainty_reason}</p>
                </div>
              </div>
            )}

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Selected Classifier
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                  {result.model_name}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Model Score (Estimate)
                </p>
                <p className="mt-1 font-mono text-xs font-semibold text-slate-900 tabular-nums dark:text-white">
                  {formatScoreDisplay(result)}
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Processing Time
                </p>
                <p className="mt-1 font-mono text-sm font-semibold text-slate-900 tabular-nums dark:text-white">
                  {result.processing_time_ms.toFixed(2)} ms
                </p>
              </div>
              <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Timestamp
                </p>
                <p className="mt-1 font-mono text-xs font-medium text-slate-900 tabular-nums dark:text-white">
                  {result.created_at
                    ? new Date(result.created_at).toLocaleString()
                    : 'Not persisted'}
                </p>
              </div>
            </div>

            {/* Explanation & Signals */}
            <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
              <div>
                <h3 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Model Explanation
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                  {result.explanation}
                </p>
              </div>

              {result.top_contributing_terms.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Top TF-IDF Terms
                  </h4>
                  <p className="mt-1 font-mono text-xs text-cyan-700 dark:text-cyan-300">
                    {result.top_contributing_terms.join(' · ')}
                  </p>
                </div>
              )}

              <div>
                <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Submitted Review & Structural Cues
                </h4>
                <p className="mt-1 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
                  {result.review_text}
                </p>
                <p className="mt-2 font-mono text-[11px] text-slate-500 tabular-nums dark:text-slate-400">
                  Words: {result.signals.word_count} · Uppercase:{' '}
                  {Math.round(result.signals.uppercase_ratio * 100)}% · URLs:{' '}
                  {result.signals.url_count} · Exclamations:{' '}
                  {result.signals.exclamation_count}
                  {result.signals.negations_preserved.length > 0
                    ? ` · Preserved negations: ${result.signals.negations_preserved.join(', ')}`
                    : ''}
                </p>
              </div>
            </div>

            {/* Post-Prediction Actions */}
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
              <button
                type="button"
                onClick={handleCopyResult}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy Result'}
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Analyse Another Review
              </button>
              <button
                type="button"
                onClick={() => onNavigate('history')}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-xs font-medium text-white hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700"
              >
                <History className="h-3.5 w-3.5" />
                View History
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
