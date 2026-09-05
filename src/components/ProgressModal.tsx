'use client';

import React from 'react';
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Download,
  X,
  Clock,
  Zap,
} from 'lucide-react';
import { ProcessingProgress } from '@/types/pdf';

interface ProgressModalProps {
  isOpen: boolean;
  progress: ProcessingProgress;
  onClose: () => void;
  onDownload: () => void;
  fileName: string;
}

export const ProgressModal: React.FC<ProgressModalProps> = ({
  isOpen,
  progress,
  onClose,
  onDownload,
  fileName,
}) => {
  if (!isOpen) return null;

  const isCompleted = progress.status === 'completed';
  const isError = progress.status === 'error';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 select-none animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl p-5 text-zinc-200 relative">
        {/* Close button (only when completed or error) */}
        {(isCompleted || isError) && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-zinc-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-4">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              isCompleted
                ? 'bg-emerald-500/20 text-emerald-400'
                : isError
                ? 'bg-red-500/20 text-red-400'
                : 'bg-blue-500/20 text-blue-400'
            }`}
          >
            {isCompleted ? (
              <CheckCircle2 className="w-6 h-6" />
            ) : isError ? (
              <AlertCircle className="w-6 h-6" />
            ) : (
              <Loader2 className="w-6 h-6 animate-spin" />
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">
              {isCompleted
                ? 'Generowanie zakończone sukcesem!'
                : isError
                ? 'Błąd generowania dokumentu'
                : 'Bezstratne wstrzykiwanie kodów QR'}
            </h3>
            <p className="text-xs text-zinc-400 truncate max-w-[280px]">
              {fileName}
            </p>
          </div>
        </div>

        {/* Progress Bar & Details */}
        {!isError && (
          <div className="space-y-3 mb-5">
            {/* Percentage Bar */}
            <div className="w-full h-2.5 bg-zinc-800 rounded-full overflow-hidden border border-zinc-700">
              <div
                className={`h-full transition-all duration-150 ${
                  isCompleted ? 'bg-emerald-500' : 'bg-blue-600'
                }`}
                style={{ width: `${progress.percent}%` }}
              />
            </div>

            {/* Metrics */}
            <div className="flex items-center justify-between text-xs text-zinc-400 font-mono">
              <span>
                Strona{' '}
                <strong className="text-zinc-200">
                  {progress.currentPage}
                </strong>{' '}
                z {progress.totalPages} ({progress.percent}%)
              </span>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-zinc-300">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  {progress.speedPagesPerSec} str/s
                </span>
                {!isCompleted && (
                  <span className="flex items-center gap-1 text-zinc-400">
                    <Clock className="w-3.5 h-3.5" />
                    ETA: {progress.etaSeconds}s
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Error Info */}
        {isError && (
          <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-lg text-xs text-red-300 mb-5">
            {progress.errorMessage || 'Wystąpił nieoczekiwany błąd.'}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2">
          {isCompleted ? (
            <>
              <button
                onClick={onClose}
                className="px-3.5 py-2 text-xs font-medium text-zinc-400 hover:text-white transition"
              >
                Zamknij
              </button>
              <button
                onClick={onDownload}
                className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-md shadow-emerald-600/30 flex items-center gap-1.5 transition cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Pobierz gotowy PDF</span>
              </button>
            </>
          ) : isError ? (
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition"
            >
              Zamknij
            </button>
          ) : (
            <div className="text-[11px] text-zinc-500 italic">
              Przetwarzanie w tle w przeglądarce bez utraty jakości...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
