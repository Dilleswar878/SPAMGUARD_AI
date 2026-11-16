import { ShieldAlert, ShieldCheck } from 'lucide-react';
import type { PredictionLabel } from '../types/api';

interface ClassificationTagProps {
  label: PredictionLabel;
}

export function ClassificationTag({ label }: ClassificationTagProps) {
  const isSpam = label === 'spam';
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap ${
        isSpam
          ? 'text-fuchsia-700 dark:text-fuchsia-400'
          : 'text-cyan-700 dark:text-cyan-400'
      }`}
    >
      {isSpam ? (
        <ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      ) : (
        <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      )}
      {isSpam ? 'Spam' : 'Genuine'}
    </span>
  );
}
