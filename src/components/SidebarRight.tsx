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
  ArrowDownUp,
  FilePlus,
  Plus,
  Trash2,
  Copy,
  Tag,
  ExternalLink,
} from 'lucide-react';
import {
  QRCodeItem,
  BatchMode,
  ErrorCorrectionLevel,
  AlignmentPreset,
  BatchScopeConfig,
  PageShiftConfig,
  ContentShiftZone,
} from '@/types/pdf';
import { getPresetPosition } from '@/lib/coordinates';

interface SidebarRightProps {
  qrItems: QRCodeItem[];
  activeQRId: string;
  onSelectQRId: (id: string) => void;
  onAddQR: () => void;
  onRemoveQR: (id: string) => void;
  onDuplicateQR: (id: string) => void;
  onChangeActiveQRConfig: (updated: Partial<QRCodeItem>) => void;
  pageShift: PageShiftConfig;
  onChangePageShift: (updated: Partial<PageShiftConfig>) => void;
  onInsertDedicatedPage?: () => void;
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
  qrItems,
  activeQRId,
  onSelectQRId,
  onAddQR,
  onRemoveQR,
  onDuplicateQR,
  onChangeActiveQRConfig,
  pageShift,
  onChangePageShift,
  onInsertDedicatedPage,
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
  const activeQR = qrItems.find((q) => q.id === activeQRId) || qrItems[0];

  if (!activeQR) return null;

  const insertPlaceholder = (tag: string) => {
    onChangeActiveQRConfig({ content: activeQR.content + tag });
  };

  return (
    <aside className="w-80 border-l border-border bg-sidebar flex flex-col h-full shrink-0 select-none overflow-y-auto">
      {/* Panel Title */}
      <div className="p-3.5 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-semibold text-zinc-100">
            Menedżer Kodów QR
          </span>
        </div>
        <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded border border-zinc-700 font-mono">
          {qrItems.length} {qrItems.length === 1 ? 'kod' : 'kody'}
        </span>
      </div>

      {/* Multi-QR Tabs Selector */}
      <div className="p-3 bg-zinc-950/60 border-b border-border space-y-2">
        <div className="flex items-center justify-between text-[11px] font-medium text-zinc-400">
          <span>Wybierz lub dodaj kod QR:</span>
          <button
            type="button"
            onClick={onAddQR}
            className="px-2 py-0.5 text-[10px] font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded flex items-center gap-1 transition shadow-sm cursor-pointer"
            title="Dodaj kolejny niezależny kod QR"
          >
            <Plus className="w-3 h-3" /> Dodaj kod
          </button>
        </div>

        {/* QR Chips List */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {qrItems.map((item, idx) => {
            const isSelected = item.id === activeQR.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectQRId(item.id)}
                className={`px-2.5 py-1 text-xs rounded-md border font-medium transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                    : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-800 hover:text-zinc-200'
                }`}
              >
                <QrCode className="w-3 h-3" />
                <span>{item.label || `Kod ${idx + 1}`}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-4 space-y-5 text-xs text-zinc-300 flex-1">
        {/* Active QR Label & Actions */}
        <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
          <div className="flex items-center gap-1.5 flex-1 mr-2">
            <Tag className="w-3.5 h-3.5 text-blue-400" />
            <input
              type="text"
              value={activeQR.label}
              onChange={(e) => onChangeActiveQRConfig({ label: e.target.value })}
              className="bg-zinc-900 border border-zinc-700/80 rounded px-1.5 py-0.5 text-xs text-zinc-100 font-semibold focus:outline-none focus:border-blue-500 w-full"
              placeholder="Nazwa kodu QR"
            />
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onDuplicateQR(activeQR.id)}
              className="p-1.5 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded transition"
              title="Duplikuj ten kod QR"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
            {qrItems.length > 1 && (
              <button
                type="button"
                onClick={() => onRemoveQR(activeQR.id)}
                className="p-1.5 hover:bg-red-950/60 text-zinc-400 hover:text-red-400 rounded transition"
                title="Usuń ten kod QR"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

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
            value={activeQR.content}
            onChange={(e) => onChangeActiveQRConfig({ content: e.target.value })}
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
                <p className="text-zinc-200 font-medium">Podgląd: {activeQR.label}</p>
                <p className="text-[9px] text-zinc-500 truncate mt-0.5">
                  {activeQR.content}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Section 1b: Active Link & Visual Label Settings */}
        <div className="space-y-2.5 pt-2 border-t border-zinc-800">
          <div className="flex items-center justify-between text-[11px] font-medium text-zinc-300">
            <span className="flex items-center gap-1.5 text-blue-400 font-semibold">
              <ExternalLink className="w-3.5 h-3.5 text-blue-400" /> Aktywne pole z linkiem w PDF
            </span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={activeQR.enableLink !== false}
                onChange={(e) => onChangeActiveQRConfig({ enableLink: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-8 h-4 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
          <p className="text-[10px] text-zinc-400 leading-tight">
            Kliknięcie w obszar kodu QR w wygenerowanym pliku PDF otworzy przypisany adres URL.
          </p>

          {/* Identification Label Toggle & Options */}
          <div className="p-2.5 bg-zinc-900/80 border border-zinc-800 rounded-lg space-y-2">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-[10px] text-zinc-200 font-medium flex items-center gap-1">
                <Tag className="w-3 h-3 text-blue-400" /> Etykieta z nazwą w PDF
              </span>
              <input
                type="checkbox"
                checked={activeQR.showLabel !== false}
                onChange={(e) => onChangeActiveQRConfig({ showLabel: e.target.checked })}
                className="accent-blue-500"
              />
            </label>

            {activeQR.showLabel !== false && (
              <div className="flex items-center justify-between pt-1 border-t border-zinc-800/80 text-[10px] text-zinc-400">
                <span>Pozycja etykiety:</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onChangeActiveQRConfig({ labelPosition: 'bottom' })}
                    className={`px-2 py-0.5 rounded border transition ${
                      (activeQR.labelPosition || 'bottom') === 'bottom'
                        ? 'bg-blue-600 text-white border-blue-500 font-semibold'
                        : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700'
                    }`}
                  >
                    Dół
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeActiveQRConfig({ labelPosition: 'top' })}
                    className={`px-2 py-0.5 rounded border transition ${
                      activeQR.labelPosition === 'top'
                        ? 'bg-blue-600 text-white border-blue-500 font-semibold'
                        : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700'
                    }`}
                  >
                    Góra
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Section 2: Dimensions & Position */}
        <div className="space-y-3 pt-2 border-t border-zinc-800">
          <div className="flex items-center justify-between text-[11px] font-medium text-zinc-400">
            <span className="flex items-center gap-1.5">
              <Maximize2 className="w-3.5 h-3.5 text-blue-400" /> Rozmiar kodu (mm / pt)
            </span>
            <span className="font-mono text-zinc-200 font-semibold">
              {activeQR.sizeMm} mm ({(activeQR.sizeMm * 2.8346).toFixed(1)} pt)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="range"
              min={12}
              max={60}
              step={1}
              value={activeQR.sizeMm}
              onChange={(e) => onChangeActiveQRConfig({ sizeMm: parseInt(e.target.value, 10) })}
              className="flex-1 accent-blue-500 h-1.5 bg-zinc-800 rounded cursor-pointer"
            />
            <input
              type="number"
              min={12}
              max={80}
              value={activeQR.sizeMm}
              onChange={(e) => onChangeActiveQRConfig({ sizeMm: parseInt(e.target.value, 10) || 12 })}
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
                min={activeQR.safetyMarginMm}
                max={pageWidthMm - activeQR.sizeMm - activeQR.safetyMarginMm}
                value={activeQR.xMm}
                onChange={(e) => onChangeActiveQRConfig({ xMm: parseFloat(e.target.value) || 0 })}
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs font-mono text-zinc-100"
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-400 block mb-1">Pozycja Y (od góry mm):</label>
              <input
                type="number"
                step={0.5}
                min={activeQR.safetyMarginMm}
                max={pageHeightMm - activeQR.sizeMm - activeQR.safetyMarginMm}
                value={activeQR.yMm}
                onChange={(e) => onChangeActiveQRConfig({ yMm: parseFloat(e.target.value) || 0 })}
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs font-mono text-zinc-100"
              />
            </div>
          </div>

          {/* Quick Presets Grid (3x2) */}
          <div className="space-y-1.5 pt-1">
            <label className="text-[10px] text-zinc-400 flex items-center gap-1">
              <Grid className="w-3 h-3 text-zinc-500" /> Wyrównanie tego kodu:
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

        {/* Section 3: Scope for this specific QR code */}
        <div className="space-y-2.5 pt-2 border-t border-zinc-800">
          <div className="flex items-center justify-between text-[11px] font-medium text-zinc-400">
            <span className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-400" /> Zakres stron dla: {activeQR.label}
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
                  name={`batchMode_${activeQR.id}`}
                  checked={activeQR.scope.mode === option.id}
                  onChange={() =>
                    onChangeActiveQRConfig({
                      scope: { ...activeQR.scope, mode: option.id as BatchMode },
                    })
                  }
                  className="accent-blue-500"
                />
                <span className="text-xs text-zinc-200">{option.label}</span>
              </label>
            ))}
          </div>

          {activeQR.scope.mode === 'range' && (
            <div className="pt-1">
              <input
                type="text"
                value={activeQR.scope.rangeString}
                onChange={(e) =>
                  onChangeActiveQRConfig({
                    scope: { ...activeQR.scope, rangeString: e.target.value },
                  })
                }
                placeholder="np. 1-10, 15, 20-30"
                className="w-full bg-zinc-900 border border-blue-500/60 rounded px-2 py-1 text-xs font-mono text-zinc-100 placeholder-zinc-500 focus:outline-none"
              />
              <span className="text-[10px] text-zinc-500 mt-1 block">
                Liczby lub przedziały oddzielone przecinkiem
              </span>
            </div>
          )}
        </div>

        {/* Section 4: Content Shifting & Margin Room */}
        <div className="space-y-3 pt-2 border-t border-zinc-800">
          <div className="flex items-center justify-between text-[11px] font-medium text-zinc-300">
            <span className="flex items-center gap-1.5 text-amber-400 font-semibold">
              <ArrowDownUp className="w-3.5 h-3.5 text-amber-400" /> Zrób miejsce na kod QR
            </span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={pageShift.enabled}
                onChange={(e) => onChangePageShift({ enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-8 h-4 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-amber-500"></div>
            </label>
          </div>

          {pageShift.enabled && (
            <div className="space-y-3 p-2.5 bg-zinc-900/90 border border-amber-500/30 rounded-lg">
              <div>
                <label className="text-[10px] text-zinc-400 block mb-1">
                  Strefa wolnego miejsca:
                </label>
                <div className="grid grid-cols-2 gap-1">
                  {[
                    { id: 'bottom', label: 'Dół (Stopka)' },
                    { id: 'top', label: 'Góra (Nagłówek)' },
                    { id: 'left', label: 'Lewy bok' },
                    { id: 'right', label: 'Prawy bok' },
                  ].map((z) => (
                    <button
                      key={z.id}
                      type="button"
                      onClick={() => onChangePageShift({ zone: z.id as ContentShiftZone })}
                      className={`py-1 px-2 text-[10px] font-medium rounded border transition ${
                        pageShift.zone === z.id
                          ? 'bg-amber-500 text-black border-amber-400 font-bold shadow-sm'
                          : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
                      }`}
                    >
                      {z.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-1">
                  <span>Wysokość strefy QR:</span>
                  <span className="font-mono text-amber-300 font-semibold">
                    {pageShift.offsetMm} mm ({(pageShift.offsetMm * 2.8346).toFixed(0)} pt)
                  </span>
                </div>
                <input
                  type="range"
                  min={15}
                  max={55}
                  step={1}
                  value={pageShift.offsetMm}
                  onChange={(e) =>
                    onChangePageShift({ offsetMm: parseInt(e.target.value, 10) || 30 })
                  }
                  className="w-full accent-amber-500 h-1.5 bg-zinc-800 rounded cursor-pointer"
                />
              </div>

              <div>
                <div className="flex items-center justify-between text-[10px] text-zinc-400 mb-1">
                  <span>Skala treści dokumentu:</span>
                  <span className="font-mono text-zinc-200 font-semibold">
                    {Math.round(pageShift.scaleContent * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={75}
                  max={100}
                  step={1}
                  value={Math.round(pageShift.scaleContent * 100)}
                  onChange={(e) =>
                    onChangePageShift({
                      scaleContent: (parseInt(e.target.value, 10) || 90) / 100,
                    })
                  }
                  className="w-full accent-amber-500 h-1.5 bg-zinc-800 rounded cursor-pointer"
                />
              </div>
            </div>
          )}

          {onInsertDedicatedPage && (
            <button
              type="button"
              onClick={onInsertDedicatedPage}
              disabled={totalPages === 0}
              className="w-full py-1.5 px-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-[10px] font-medium rounded border border-zinc-700 flex items-center justify-center gap-1.5 transition cursor-pointer"
              title="Wstawia nową stronę A5 dedykowaną na kod QR i przesuwa dotychczasową treść o +1"
            >
              <FilePlus className="w-3.5 h-3.5 text-blue-400" />
              <span>Wstaw dedykowaną stronę QR (przesuń o +1)</span>
            </button>
          )}
        </div>

        {/* Section 5: QR Parameters (ECC, Quiet Zone) */}
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
              const isSelected = activeQR.errorCorrection === level;
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => onChangeActiveQRConfig({ errorCorrection: level })}
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
                value={activeQR.marginModules}
                onChange={(e) => onChangeActiveQRConfig({ marginModules: parseInt(e.target.value, 10) })}
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
                value={activeQR.safetyMarginMm}
                onChange={(e) => onChangeActiveQRConfig({ safetyMarginMm: parseFloat(e.target.value) || 5 })}
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs font-mono text-zinc-100"
              />
            </div>
          </div>
        </div>

        {/* Section 6: Big Action Button */}
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
            <span>Generuj i pobierz PDF ({targetPagesCount} stron z QR)</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
