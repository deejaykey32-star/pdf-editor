'use client';

import React from 'react';
import {
  QrCode,
  Sliders,
  Move,
  Layers,
  Download,
  Link,
  ShieldCheck,
  Maximize2,
  Grid,
} from 'lucide-react';
import {
  QRConfig,
  BatchMode,
  ErrorCorrectionLevel,
  AlignmentPreset,
  BatchScopeConfig,
} from '@/types/pdf';
import { getPresetPosition } from '@/lib/coordinates';

interface SidebarRightProps {
  qrConfig: QRConfig;
  onChangeQRConfig: (updated: Partial<QRConfig>) => void;
  batchScope: BatchScopeConfig;
  onChangeBatchScope: (updated: Partial<BatchScopeConfig>) => void;
  pageWidthMm: number;
  pageHeightMm: number;
  currentPage: number;
  totalPages: number;
  targetPagesCount: number;
  onApplyPreset: (preset: AlignmentPreset) => void;
  onExportClick: () => void;
  isProcessing: boolean;
  qrPreviewUrl?: string;
}

export const SidebarRight: React.FC<SidebarRightProps> = ({
  qrConfig,
  onChangeQRConfig,
  batchScope,
  onChangeBatchScope,
  pageWidthMm,
  pageHeightMm,
  currentPage,
  totalPages,
  targetPagesCount,
  onApplyPreset,
  onExportClick,
  isProcessing,
  qrPreviewUrl,
}) => {
  const insertPlaceholder = (tag: string) => {
    onChangeQRConfig({ content: qrConfig.content + tag });
  };

  return (
    <aside className="w-80 border-l border-border bg-sidebar flex flex-col h-full shrink-0 select-none overflow-y-auto">
      {/* Panel Title */}
      <div className="p-3.5 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-semibold text-zinc-100">
            Konfigurator Kodu QR
          </span>
        </div>
        <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded border border-zinc-700">
          A5 (148x210mm)
        </span>
      </div>

      <div className="p-4 space-y-5 text-xs text-zinc-300 flex-1">
        {/* Section 1: Content & Dynamic Template */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] font-medium text-zinc-400">
            <span className="flex items-center gap-1.5">
              <Link className="w-3.5 h-3.5 text-blue-400" /> Treść / Link URL
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => insertPlaceholder('{page}')}
                className="px-1.5 py-0.5 text-[9px] bg-zinc-800 hover:bg-zinc-700 text-blue-400 rounded border border-zinc-700 font-mono transition"
                title="Wstaw zmienną numeru strony"
              >
                +&#123;page&#125;
              </button>
              <button
                type="button"
                onClick={() => insertPlaceholder('{total}')}
                className="px-1.5 py-0.5 text-[9px] bg-zinc-800 hover:bg-zinc-700 text-blue-400 rounded border border-zinc-700 font-mono transition"
                title="Wstaw zmienną łącznej liczby stron"
              >
                +&#123;total&#125;
              </button>
            </div>
          </div>
          <textarea
            value={qrConfig.content}
            onChange={(e) => onChangeQRConfig({ content: e.target.value })}
            rows={2}
            placeholder="https://example.com/verify?p={page}"
            className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-xs text-zinc-100 font-mono focus:outline-none focus:border-blue-500 resize-none"
          />

          {/* Small Preview Box */}
          {qrPreviewUrl && (
            <div className="flex items-center gap-3 p-2 bg-zinc-900/70 border border-zinc-800 rounded">
              <div className="w-12 h-12 bg-white rounded p-0.5 flex items-center justify-center shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrPreviewUrl}
                  alt="Podgląd"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="text-[10px] text-zinc-400 leading-tight truncate">
                <p className="text-zinc-200 font-medium">Podgląd wektorowy</p>
                <p className="text-[9px] text-zinc-500 truncate mt-0.5">
                  {qrConfig.content}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Dimensions & Position */}
        <div className="space-y-3 pt-2 border-t border-zinc-800">
          <div className="flex items-center justify-between text-[11px] font-medium text-zinc-400">
            <span className="flex items-center gap-1.5">
              <Maximize2 className="w-3.5 h-3.5 text-blue-400" /> Rozmiar kodu (mm / pt)
            </span>
            <span className="font-mono text-zinc-200 font-semibold">
              {qrConfig.sizeMm} mm ({(qrConfig.sizeMm * 2.8346).toFixed(1)} pt)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="range"
              min={12}
              max={60}
              step={1}
              value={qrConfig.sizeMm}
              onChange={(e) => onChangeQRConfig({ sizeMm: parseInt(e.target.value, 10) })}
              className="flex-1 accent-blue-500 h-1.5 bg-zinc-800 rounded cursor-pointer"
            />
            <input
              type="number"
              min={12}
              max={80}
              value={qrConfig.sizeMm}
              onChange={(e) => onChangeQRConfig({ sizeMm: parseInt(e.target.value, 10) || 12 })}
              className="w-14 bg-zinc-900 border border-zinc-700 rounded px-1.5 py-0.5 text-xs text-center font-mono text-zinc-100"
            />
          </div>

          {/* Coordinates X, Y */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <label className="text-[10px] text-zinc-400 block mb-1">Pozycja X (od lewej mm):</label>
              <input
                type="number"
                step={0.5}
                min={qrConfig.safetyMarginMm}
                max={pageWidthMm - qrConfig.sizeMm - qrConfig.safetyMarginMm}
                value={qrConfig.xMm}
                onChange={(e) => onChangeQRConfig({ xMm: parseFloat(e.target.value) || 0 })}
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs font-mono text-zinc-100"
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-400 block mb-1">Pozycja Y (od góry mm):</label>
              <input
                type="number"
                step={0.5}
                min={qrConfig.safetyMarginMm}
                max={pageHeightMm - qrConfig.sizeMm - qrConfig.safetyMarginMm}
                value={qrConfig.yMm}
                onChange={(e) => onChangeQRConfig({ yMm: parseFloat(e.target.value) || 0 })}
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs font-mono text-zinc-100"
              />
            </div>
          </div>

          {/* Quick Presets Grid (3x2) */}
          <div className="space-y-1.5 pt-1">
            <label className="text-[10px] text-zinc-400 flex items-center gap-1">
              <Grid className="w-3 h-3 text-zinc-500" /> Szybkie pozycjonowanie:
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => onApplyPreset('top-left')}
                className="py-1 px-2 bg-zinc-900 hover:bg-zinc-800 text-[10px] font-medium text-zinc-300 rounded border border-zinc-800 transition"
              >
                Góra-Lewo
              </button>
              <button
                type="button"
                onClick={() => onApplyPreset('center')}
                className="py-1 px-2 bg-zinc-900 hover:bg-zinc-800 text-[10px] font-medium text-zinc-300 rounded border border-zinc-800 transition"
              >
                Środek
              </button>
              <button
                type="button"
                onClick={() => onApplyPreset('top-right')}
                className="py-1 px-2 bg-zinc-900 hover:bg-zinc-800 text-[10px] font-medium text-zinc-300 rounded border border-zinc-800 transition"
              >
                Góra-Prawo
              </button>
              <button
                type="button"
                onClick={() => onApplyPreset('bottom-left')}
                className="py-1 px-2 bg-zinc-900 hover:bg-zinc-800 text-[10px] font-medium text-zinc-300 rounded border border-zinc-800 transition"
              >
                Dół-Lewo
              </button>
              <button
                type="button"
                onClick={() => onApplyPreset('bottom-center')}
                className="py-1 px-2 bg-zinc-900 hover:bg-zinc-800 text-[10px] font-medium text-zinc-300 rounded border border-zinc-800 transition"
              >
                Dół-Środek
              </button>
              <button
                type="button"
                onClick={() => onApplyPreset('bottom-right')}
                className="py-1 px-2 bg-zinc-900 hover:bg-zinc-800 text-[10px] font-medium text-zinc-300 rounded border border-zinc-800 transition"
              >
                Dół-Prawo
              </button>
            </div>
          </div>
        </div>

        {/* Section 3: QR Parameters (ECC, Quiet Zone) */}
        <div className="space-y-3 pt-2 border-t border-zinc-800">
          <div className="flex items-center justify-between text-[11px] font-medium text-zinc-400">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" /> Korekcja błędów (ECC)
            </span>
          </div>

          <div className="grid grid-cols-4 gap-1">
            {(['L', 'M', 'Q', 'H'] as ErrorCorrectionLevel[]).map((level) => {
              const labels: Record<string, string> = {
                L: 'L (7%)',
                M: 'M (15%)',
                Q: 'Q (25%)',
                H: 'H (30%)',
              };
              const isSelected = qrConfig.errorCorrection === level;
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => onChangeQRConfig({ errorCorrection: level })}
                  className={`py-1 text-[10px] font-medium rounded border transition ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-500 font-semibold'
                      : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-800'
                  }`}
                >
                  {labels[level]}
                </button>
              );
            })}
          </div>

          {/* Quiet Zone & Safety Margin */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <label className="text-[10px] text-zinc-400 block mb-1">Margines QR (moduły):</label>
              <select
                value={qrConfig.marginModules}
                onChange={(e) => onChangeQRConfig({ marginModules: parseInt(e.target.value, 10) })}
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-100"
              >
                <option value={0}>0 (Brak)</option>
                <option value={1}>1 moduł</option>
                <option value={2}>2 moduły</option>
                <option value={4}>4 moduły (Standard)</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-zinc-400 block mb-1">Margines A5 (mm):</label>
              <input
                type="number"
                min={2}
                max={20}
                value={qrConfig.safetyMarginMm}
                onChange={(e) => onChangeQRConfig({ safetyMarginMm: parseFloat(e.target.value) || 5 })}
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs font-mono text-zinc-100"
              />
            </div>
          </div>
        </div>

        {/* Section 4: Batch Scope Selection */}
        <div className="space-y-2.5 pt-2 border-t border-zinc-800">
          <div className="flex items-center justify-between text-[11px] font-medium text-zinc-400">
            <span className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-400" /> Zakres stron
            </span>
          </div>

          <div className="space-y-1.5">
            {[
              { id: 'current', label: `Tylko ta strona (Strona ${currentPage})` },
              { id: 'all', label: `Wszystkie strony (1 – ${totalPages || 1})` },
              { id: 'range', label: 'Własny zakres stron...' },
              { id: 'odd', label: 'Tylko strony nieparzyste (1, 3, 5...)' },
              { id: 'even', label: 'Tylko strony parzyste (2, 4, 6...)' },
            ].map((option) => (
              <label
                key={option.id}
                className="flex items-center gap-2 p-1.5 bg-zinc-900/60 hover:bg-zinc-900 rounded border border-zinc-800/80 cursor-pointer transition"
              >
                <input
                  type="radio"
                  name="batchMode"
                  checked={batchScope.mode === option.id}
                  onChange={() => onChangeBatchScope({ mode: option.id as BatchMode })}
                  className="accent-blue-500"
                />
                <span className="text-xs text-zinc-200">{option.label}</span>
              </label>
            ))}
          </div>

          {batchScope.mode === 'range' && (
            <div className="pt-1">
              <input
                type="text"
                value={batchScope.rangeString}
                onChange={(e) => onChangeBatchScope({ rangeString: e.target.value })}
                placeholder="np. 1-100, 150-200, 500"
                className="w-full bg-zinc-900 border border-blue-500/60 rounded px-2 py-1 text-xs font-mono text-zinc-100 placeholder-zinc-500 focus:outline-none"
              />
              <span className="text-[10px] text-zinc-500 mt-1 block">
                Format: liczby lub przedziały oddzielone przecinkiem
              </span>
            </div>
          )}

          {/* Target Count Indicator */}
          <div className="p-2 bg-blue-950/20 border border-blue-500/20 rounded text-[11px] text-blue-300 flex items-center justify-between">
            <span>Objęte strony:</span>
            <span className="font-semibold font-mono text-white">
              {targetPagesCount} z {totalPages} stron
            </span>
          </div>
        </div>

        {/* Section 5: Big Action Button */}
        <div className="pt-3 border-t border-zinc-800">
          <button
            onClick={onExportClick}
            disabled={totalPages === 0 || isProcessing || targetPagesCount === 0}
            className={`w-full py-2.5 px-4 rounded-lg font-semibold text-xs transition flex items-center justify-center gap-2 shadow-lg ${
              totalPages === 0 || isProcessing || targetPagesCount === 0
                ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700/50'
                : 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer shadow-blue-600/30'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Generuj i pobierz PDF ({targetPagesCount})</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
