'use client';

import React, { useState, useRef } from 'react';
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
  Upload,
  Sparkles,
  FileText,
  RotateCcw,
  ListOrdered,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  QRCodeItem,
  BatchMode,
  ErrorCorrectionLevel,
  AlignmentPreset,
  BatchScopeConfig,
  PageShiftConfig,
  ContentShiftZone,
  UniquePageMode,
} from '@/types/pdf';
import { getPresetPosition } from '@/lib/coordinates';
import { interpolateQRText } from '@/lib/qr-generator';

interface SidebarRightProps {
  qrItems: QRCodeItem[];
  activeQRId: string;
  onSelectQRId: (id: string) => void;
  onAddQRForPage: (pageNumber: number) => void;
  onRemoveQR: (id: string) => void;
  onDuplicateQR: (id: string) => void;
  onChangeActiveQRConfig: (updated: Partial<QRCodeItem>) => void;
  onApplyPositionToAll: (sourceId: string) => void;
  onGenerateSeriesForAllPages: (templateUrl: string) => void;
  onApplyUrlListToPages: (urls: string[]) => void;
  pageShift: PageShiftConfig;
  onChangePageShift: (updated: Partial<PageShiftConfig>) => void;
  onInsertDedicatedPage?: () => void;
  pageWidthMm: number;
  pageHeightMm: number;
  currentPage: number;
  totalPages: number;
  targetPagesPerQR: Map<string, Set<number>>;
  targetPagesCount: number;
  onApplyPreset: (preset: AlignmentPreset) => void;
  onExportClick: () => void;
  onPageChange: (page: number) => void;
  isProcessing: boolean;
  qrPreviewUrl?: string;
}

export const SidebarRight: React.FC<SidebarRightProps> = ({
  qrItems,
  activeQRId,
  onSelectQRId,
  onAddQRForPage,
  onRemoveQR,
  onDuplicateQR,
  onChangeActiveQRConfig,
  onApplyPositionToAll,
  onGenerateSeriesForAllPages,
  onApplyUrlListToPages,
  pageShift,
  onChangePageShift,
  onInsertDedicatedPage,
  pageWidthMm,
  pageHeightMm,
  currentPage,
  totalPages,
  targetPagesPerQR,
  targetPagesCount,
  onApplyPreset,
  onExportClick,
  onPageChange,
  isProcessing,
  qrPreviewUrl,
}) => {
  const [sidebarTab, setSidebarTab] = useState<'page' | 'series' | 'all'>('page');
  const [seriesTemplate, setSeriesTemplate] = useState('https://example.com/katalog?page={page}');
  const [customListText, setCustomListText] = useState('');
  const [copiedNotification, setCopiedNotification] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter QR items strictly assigned to or present on CURRENT page
  const pageQRs = qrItems.filter((item) => targetPagesPerQR.get(item.id)?.has(currentPage));

  // Determine the active item for this page or fallback
  const activeQR = pageQRs.find((q) => q.id === activeQRId) || pageQRs[0] || qrItems[0];

  const handleCopyPosition = () => {
    if (!activeQR) return;
    onApplyPositionToAll(activeQR.id);
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 2500);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setCustomListText(text);
        const lines = text
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean);
        if (lines.length > 0) {
          onApplyUrlListToPages(lines);
          setSidebarTab('page');
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleApplyCustomList = () => {
    const lines = customListText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) {
      alert('Wklej co najmniej jeden adres URL.');
      return;
    }
    onApplyUrlListToPages(lines);
    setSidebarTab('page');
  };

  const handleApplySeriesTemplate = () => {
    if (!seriesTemplate.trim()) {
      alert('Podaj szablon adresu URL ze zmienną {page}');
      return;
    }
    onGenerateSeriesForAllPages(seriesTemplate);
    setSidebarTab('page');
  };

  const handleSampleSeries = () => {
    const count = Math.max(totalPages, 1);
    const sampleUrls: string[] = [];
    for (let i = 1; i <= count; i++) {
      const padded = String(i).padStart(3, '0');
      sampleUrls.push(`https://sklep.pl/produkt?id=PROD-${padded}&strona=${i}`);
    }
    setCustomListText(sampleUrls.join('\n'));
  };

  const insertPlaceholderInTemplate = (tag: string) => {
    setSeriesTemplate((prev) => prev + tag);
  };

  return (
    <aside className="w-84 border-l border-border bg-sidebar flex flex-col h-full shrink-0 select-none overflow-y-auto">
      {/* Hidden file input for TXT/CSV upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".txt,.csv"
        className="hidden"
      />

      {/* Top Header with Page Navigation */}
      <div className="p-3 border-b border-border bg-zinc-950/80 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <FileText className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-bold text-zinc-100">
            Strona {currentPage} <span className="text-zinc-500 font-normal">/ {totalPages || 1}</span>
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
            className="p-1 hover:bg-zinc-800 disabled:opacity-30 rounded text-zinc-300 transition cursor-pointer"
            title="Poprzednia strona"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onPageChange(Math.min(totalPages || 1, currentPage + 1))}
            disabled={currentPage >= (totalPages || 1)}
            className="p-1 hover:bg-zinc-800 disabled:opacity-30 rounded text-zinc-300 transition cursor-pointer"
            title="Następna strona"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 3 Main Navigation Tabs */}
      <div className="grid grid-cols-3 border-b border-border bg-zinc-950 text-[11px] font-medium text-zinc-400">
        <button
          type="button"
          onClick={() => setSidebarTab('page')}
          className={`py-2 px-1 text-center transition flex items-center justify-center gap-1 border-b-2 cursor-pointer ${
            sidebarTab === 'page'
              ? 'border-blue-500 text-blue-400 font-semibold bg-zinc-900/50'
              : 'border-transparent hover:text-zinc-200 hover:bg-zinc-900/30'
          }`}
        >
          <QrCode className="w-3 h-3" /> Ta strona
          {pageQRs.length > 0 && (
            <span className="w-4 h-4 text-[9px] rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">
              {pageQRs.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setSidebarTab('series')}
          className={`py-2 px-1 text-center transition flex items-center justify-center gap-1 border-b-2 cursor-pointer ${
            sidebarTab === 'series'
              ? 'border-amber-500 text-amber-400 font-semibold bg-zinc-900/50'
              : 'border-transparent hover:text-zinc-200 hover:bg-zinc-900/30'
          }`}
        >
          <Sparkles className="w-3 h-3 text-amber-400" /> Seria (Różne)
        </button>

        <button
          type="button"
          onClick={() => setSidebarTab('all')}
          className={`py-2 px-1 text-center transition flex items-center justify-center gap-1 border-b-2 cursor-pointer ${
            sidebarTab === 'all'
              ? 'border-blue-500 text-zinc-200 font-semibold bg-zinc-900/50'
              : 'border-transparent hover:text-zinc-200 hover:bg-zinc-900/30'
          }`}
        >
          <Layers className="w-3 h-3" /> Wszystkie ({qrItems.length})
        </button>
      </div>

      {/* Main Content Area */}
      <div className="p-3.5 space-y-4 text-xs text-zinc-300 flex-1">
        {/* ============================================================== */}
        {/* TAB 1: TA STRONA (Current Page Specific QR Editor)             */}
        {/* ============================================================== */}
        {sidebarTab === 'page' && (
          <>
            {pageQRs.length === 0 ? (
              /* Empty state for this page */
              <div className="py-6 px-4 text-center border border-dashed border-zinc-800 rounded-xl bg-zinc-900/40 space-y-3">
                <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center mx-auto text-zinc-400">
                  <QrCode className="w-5 h-5 opacity-60" />
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-zinc-200">
                    Brak kodu QR na Stronie {currentPage}
                  </h3>
                  <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed">
                    Ta strona nie zawiera żadnego kodu QR. Możesz przypisać kod wyłącznie do tej strony.
                  </p>
                </div>

                <div className="pt-2 space-y-2">
                  <button
                    type="button"
                    onClick={() => onAddQRForPage(currentPage)}
                    className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg flex items-center justify-center gap-1.5 transition shadow-sm cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Dodaj kod QR do Strony {currentPage}
                  </button>

                  <button
                    type="button"
                    onClick={() => setSidebarTab('series')}
                    className="w-full py-1.5 px-2 bg-zinc-900 hover:bg-zinc-800 text-amber-400 font-medium rounded border border-zinc-800 text-[10px] flex items-center justify-center gap-1 transition cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" /> Zastosuj serię dla wszystkich stron
                  </button>
                </div>
              </div>
            ) : (
              /* Active QR editor for this page */
              <div className="space-y-4">
                {/* Multi-QR selector if this page has > 1 QR code */}
                {pageQRs.length > 1 && (
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-zinc-400 font-medium block">
                      Kody QR na Stronie {currentPage}:
                    </span>
                    <div className="flex items-center gap-1 overflow-x-auto pb-1">
                      {pageQRs.map((item, idx) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => onSelectQRId(item.id)}
                          className={`px-2 py-1 text-xs rounded border transition flex items-center gap-1 shrink-0 ${
                            item.id === activeQR.id
                              ? 'bg-blue-600 text-white border-blue-500 font-semibold shadow-xs'
                              : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-800 hover:text-zinc-200'
                          }`}
                        >
                          <QrCode className="w-3 h-3" />
                          <span>{item.label || `Kod ${idx + 1}`}</span>
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => onAddQRForPage(currentPage)}
                        className="px-2 py-1 text-xs rounded border border-dashed border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 flex items-center gap-0.5 shrink-0"
                        title="Dodaj jeszcze jeden kod do tej strony"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}

                {/* QR Label Input & Duplicate/Delete */}
                <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                  <div className="flex items-center gap-1.5 flex-1 mr-2">
                    <Tag className="w-3.5 h-3.5 text-blue-400" />
                    <input
                      type="text"
                      value={activeQR.label}
                      onChange={(e) => onChangeActiveQRConfig({ label: e.target.value })}
                      className="bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-100 font-semibold focus:outline-none focus:border-blue-500 w-full"
                      placeholder={`Kod Strona ${currentPage}`}
                    />
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onDuplicateQR(activeQR.id)}
                      className="p-1 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 rounded transition cursor-pointer"
                      title="Duplikuj ten kod"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveQR(activeQR.id)}
                      className="p-1 hover:bg-red-950/60 text-zinc-400 hover:text-red-400 rounded transition cursor-pointer"
                      title="Usuń kod z tej strony"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* QR Content / URL */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-medium text-zinc-400">
                    <span className="flex items-center gap-1.5 text-zinc-200 font-semibold">
                      <Link className="w-3.5 h-3.5 text-blue-400" /> Link / Adres URL:
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">Dla Strony {currentPage}</span>
                  </div>
                  <textarea
                    value={activeQR.content}
                    onChange={(e) => onChangeActiveQRConfig({ content: e.target.value })}
                    rows={2}
                    placeholder={`https://example.com/strona-${currentPage}`}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-xs text-zinc-100 font-mono focus:outline-none focus:border-blue-500 resize-none"
                  />
                </div>

                {/* Scope Assignment: Where should this code appear? */}
                <div className="p-2.5 bg-zinc-950/70 border border-zinc-800 rounded-lg space-y-2">
                  <span className="text-[10px] text-zinc-300 font-semibold flex items-center gap-1">
                    <Layers className="w-3 h-3 text-blue-400" /> Gdzie umieścić ten kod:
                  </span>

                  <div className="space-y-1">
                    {[
                      {
                        id: 'page',
                        label: `Tylko ta strona (Strona ${currentPage})`,
                        badge: 'Zalecane',
                      },
                      {
                        id: 'all',
                        label: `Wszystkie strony w dokumencie (1–${totalPages})`,
                        badge: '',
                      },
                      {
                        id: 'range',
                        label: `Wybrane strony...`,
                        badge: '',
                      },
                    ].map((opt) => (
                      <label
                        key={opt.id}
                        className={`flex items-center justify-between p-1.5 rounded border cursor-pointer transition ${
                          activeQR.scope.mode === opt.id
                            ? 'bg-blue-950/30 border-blue-500/60 text-blue-300'
                            : 'bg-zinc-900/60 border-zinc-800/80 text-zinc-300 hover:bg-zinc-900'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name={`scopeMode_${activeQR.id}`}
                            checked={activeQR.scope.mode === opt.id}
                            onChange={() =>
                              onChangeActiveQRConfig({
                                scope: {
                                  ...activeQR.scope,
                                  mode: opt.id as BatchMode,
                                  specificPage: opt.id === 'page' ? currentPage : undefined,
                                },
                              })
                            }
                            className="accent-blue-500"
                          />
                          <span className="text-xs">{opt.label}</span>
                        </div>
                        {opt.badge && (
                          <span className="text-[8px] bg-blue-600/30 text-blue-400 px-1 py-0.2 rounded font-mono">
                            {opt.badge}
                          </span>
                        )}
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
                        placeholder="np. 1-5, 10, 15-20"
                        className="w-full bg-zinc-900 border border-blue-500/60 rounded px-2 py-1 text-xs font-mono text-zinc-100 placeholder-zinc-500 focus:outline-none"
                      />
                    </div>
                  )}
                </div>

                {/* Clickable Link Toggle & Identification Label */}
                <div className="space-y-2 pt-1 border-t border-zinc-800">
                  <div className="flex items-center justify-between text-[11px] font-medium text-zinc-300">
                    <span className="flex items-center gap-1.5 text-blue-400 font-semibold">
                      <ExternalLink className="w-3.5 h-3.5 text-blue-400" /> Aktywny link w pliku PDF
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

                  {/* Identification Label Toggle & Options */}
                  <div className="p-2 bg-zinc-900/80 border border-zinc-800 rounded space-y-1.5">
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-[10px] text-zinc-200 font-medium flex items-center gap-1">
                        <Tag className="w-3 h-3 text-blue-400" /> Etykieta pod kodem QR
                      </span>
                      <input
                        type="checkbox"
                        checked={activeQR.showLabel !== false}
                        onChange={(e) => onChangeActiveQRConfig({ showLabel: e.target.checked })}
                        className="accent-blue-500"
                      />
                    </label>

                    {activeQR.showLabel !== false && (
                      <div className="flex items-center justify-between pt-1 border-t border-zinc-800 text-[10px] text-zinc-400">
                        <span>Pozycja etykiety:</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onChangeActiveQRConfig({ labelPosition: 'bottom' })}
                            className={`px-2 py-0.5 rounded border transition ${
                              (activeQR.labelPosition || 'bottom') === 'bottom'
                                ? 'bg-blue-600 text-white border-blue-500 font-semibold'
                                : 'bg-zinc-800 text-zinc-400 border-zinc-700'
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
                                : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                            }`}
                          >
                            Góra
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Dimensions & Position */}
                <div className="space-y-2.5 pt-2 border-t border-zinc-800">
                  <div className="flex items-center justify-between text-[11px] font-medium text-zinc-400">
                    <span className="flex items-center gap-1.5">
                      <Maximize2 className="w-3.5 h-3.5 text-blue-400" /> Rozmiar kodu (mm)
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
                      onChange={(e) =>
                        onChangeActiveQRConfig({ sizeMm: parseInt(e.target.value, 10) || 12 })
                      }
                      className="w-14 bg-zinc-900 border border-zinc-700 rounded px-1.5 py-0.5 text-xs text-center font-mono text-zinc-100"
                    />
                  </div>

                  {/* Coordinates X, Y */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <label className="text-[10px] text-zinc-400 block mb-1">Pozycja X (mm):</label>
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
                      <label className="text-[10px] text-zinc-400 block mb-1">Pozycja Y (mm):</label>
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
                      <Grid className="w-3 h-3 text-zinc-500" /> Szybkie wyrównanie:
                    </label>
                    <div className="grid grid-cols-3 gap-1">
                      {[
                        { id: 'top-left', label: 'Góra-Lewo' },
                        { id: 'center', label: 'Środek' },
                        { id: 'top-right', label: 'Góra-Prawo' },
                        { id: 'bottom-left', label: 'Dół-Lewo' },
                        { id: 'bottom-center', label: 'Dół-Środek' },
                        { id: 'bottom-right', label: 'Dół-Prawo' },
                      ].map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => onApplyPreset(preset.id as AlignmentPreset)}
                          className="py-1 px-1.5 bg-zinc-900 hover:bg-zinc-800 text-[10px] font-medium text-zinc-300 rounded border border-zinc-800 transition text-center"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Copy Position to All Pages Button */}
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleCopyPosition}
                      className="w-full py-1.5 px-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-[10px] font-medium rounded border border-zinc-700 flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Copy className="w-3 h-3 text-blue-400" /> Zastosuj tę pozycję i rozmiar do wszystkich kodów
                    </button>
                    {copiedNotification && (
                      <p className="text-[9px] text-emerald-400 text-center mt-1 flex items-center justify-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Zastosowano geometrię do wszystkich kodów!
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ============================================================== */}
        {/* TAB 2: KREATOR SERII (Batch Unique Generator for All Pages)    */}
        {/* ============================================================== */}
        {sidebarTab === 'series' && (
          <div className="space-y-4">
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-1">
              <div className="flex items-center gap-1.5 text-amber-400 font-semibold text-xs">
                <Sparkles className="w-3.5 h-3.5" /> Generator unikalnych kodów
              </div>
              <p className="text-[10px] text-zinc-300 leading-relaxed">
                Automatycznie wygeneruj osobny, unikalny kod QR dla każdej strony w dokumencie (od Strony 1 do {totalPages || 1}).
              </p>
            </div>

            {/* Sub-option 1: Dynamic Template */}
            <div className="p-3 bg-zinc-950/70 border border-zinc-800 rounded-lg space-y-2.5">
              <span className="text-[11px] font-semibold text-zinc-200 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-blue-400" /> Opcja 1: Wzorzec z numeracją stron
              </span>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] text-zinc-400">
                  <span>Wzór adresu URL:</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => insertPlaceholderInTemplate('{page}')}
                      className="px-1 py-0.5 text-[9px] bg-zinc-800 hover:bg-zinc-700 text-blue-400 rounded border border-zinc-700 font-mono"
                    >
                      +&#123;page&#125;
                    </button>
                    <button
                      type="button"
                      onClick={() => insertPlaceholderInTemplate('{page:03d}')}
                      className="px-1 py-0.5 text-[9px] bg-zinc-800 hover:bg-zinc-700 text-blue-400 rounded border border-zinc-700 font-mono"
                    >
                      +&#123;001&#125;
                    </button>
                    <button
                      type="button"
                      onClick={() => insertPlaceholderInTemplate('{total}')}
                      className="px-1 py-0.5 text-[9px] bg-zinc-800 hover:bg-zinc-700 text-blue-400 rounded border border-zinc-700 font-mono"
                    >
                      +&#123;total&#125;
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  value={seriesTemplate}
                  onChange={(e) => setSeriesTemplate(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-100 font-mono focus:outline-none focus:border-blue-500"
                  placeholder="https://example.com/p?id={page:03d}"
                />
              </div>

              <button
                type="button"
                onClick={handleApplySeriesTemplate}
                className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 transition shadow-sm cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" /> Wygeneruj różne kody dla wszystkich {totalPages || 1} stron
              </button>
            </div>

            {/* Sub-option 2: Paste List / Import CSV */}
            <div className="p-3 bg-zinc-950/70 border border-zinc-800 rounded-lg space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-zinc-200 flex items-center gap-1.5">
                  <ListOrdered className="w-3.5 h-3.5 text-emerald-400" /> Opcja 2: Lista linków (1 linia = 1 strona)
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-1.5 py-0.5 text-[9px] bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded border border-zinc-700 flex items-center gap-1"
                  >
                    <Upload className="w-2.5 h-2.5 text-blue-400" /> Plik TXT/CSV
                  </button>
                  <button
                    type="button"
                    onClick={handleSampleSeries}
                    className="px-1.5 py-0.5 text-[9px] bg-zinc-800 hover:bg-zinc-700 text-amber-400 rounded border border-zinc-700"
                  >
                    Wstaw przykłady
                  </button>
                </div>
              </div>

              <textarea
                value={customListText}
                onChange={(e) => setCustomListText(e.target.value)}
                rows={5}
                placeholder={`https://example.com/produkt-1\nhttps://example.com/produkt-2\nhttps://example.com/produkt-3`}
                className="w-full bg-zinc-900 border border-zinc-700 rounded p-2 text-[11px] text-zinc-100 font-mono focus:outline-none focus:border-blue-500 resize-y"
              />

              <div className="flex items-center justify-between text-[10px] text-zinc-400">
                <span>
                  Wpisano linii:{' '}
                  <strong className="text-zinc-200 font-mono">
                    {customListText.split(/\r?\n/).filter((l) => l.trim().length > 0).length}
                  </strong>
                </span>
                <span>Dokument: {totalPages || 1} stron</span>
              </div>

              <button
                type="button"
                onClick={handleApplyCustomList}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-xs flex items-center justify-center gap-1.5 transition shadow-sm cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Przypisz listę linków do kolejnych stron
              </button>
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: WSZYSTKIE KODY (Summary List of All Document Codes)     */}
        {/* ============================================================== */}
        {sidebarTab === 'all' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[11px] text-zinc-400 pb-1 border-b border-zinc-800">
              <span>Zestawienie kodów w pliku:</span>
              <span className="font-mono text-zinc-200 font-semibold">{qrItems.length} kodów</span>
            </div>

            <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-0.5">
              {qrItems.map((item, idx) => {
                const isCurrent = item.id === activeQR.id;
                const isPageMode = item.scope.mode === 'page';
                const pageTarget = item.scope.specificPage || 1;

                return (
                  <div
                    key={item.id}
                    className={`p-2 rounded-lg border transition space-y-1 ${
                      isCurrent
                        ? 'bg-blue-950/30 border-blue-500/70'
                        : 'bg-zinc-900/60 border-zinc-800/80 hover:bg-zinc-900 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-zinc-200 flex items-center gap-1 truncate max-w-[150px]">
                        <QrCode className="w-3 h-3 text-blue-400 shrink-0" />
                        {item.label || `Kod ${idx + 1}`}
                      </span>

                      {/* Scope Badge */}
                      <span className="text-[9px] px-1.5 py-0.2 rounded font-mono font-medium bg-zinc-800 border border-zinc-700 text-zinc-300">
                        {isPageMode
                          ? `Strona ${pageTarget}`
                          : item.scope.mode === 'all'
                          ? 'Wszystkie strony'
                          : `Zakres: ${item.scope.rangeString}`}
                      </span>
                    </div>

                    <p className="text-[10px] text-zinc-500 font-mono truncate">{item.content}</p>

                    <div className="flex items-center justify-between pt-1 border-t border-zinc-800/60 text-[10px]">
                      {isPageMode ? (
                        <button
                          type="button"
                          onClick={() => {
                            onPageChange(pageTarget);
                            onSelectQRId(item.id);
                            setSidebarTab('page');
                          }}
                          className="text-blue-400 hover:text-blue-300 flex items-center gap-1 transition"
                        >
                          <ArrowRight className="w-2.5 h-2.5" /> Przejdź do Strony {pageTarget}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            onSelectQRId(item.id);
                            setSidebarTab('page');
                          }}
                          className="text-blue-400 hover:text-blue-300 flex items-center gap-1 transition"
                        >
                          <Sliders className="w-2.5 h-2.5" /> Edytuj ten kod
                        </button>
                      )}

                      {qrItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => onRemoveQR(item.id)}
                          className="text-zinc-500 hover:text-red-400 p-0.5 transition"
                          title="Usuń ten kod"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => onAddQRForPage(currentPage)}
              className="w-full py-1.5 px-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-medium rounded border border-zinc-700 flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-blue-400" /> Dodaj kolejny kod na Stronie {currentPage}
            </button>
          </div>
        )}

        {/* Section 4: Content Shifting & Margin Room (Always available at bottom) */}
        <div className="space-y-3 pt-3 border-t border-zinc-800">
          <div className="flex items-center justify-between text-[11px] font-medium text-zinc-300">
            <span className="flex items-center gap-1.5 text-amber-400 font-semibold">
              <ArrowDownUp className="w-3.5 h-3.5 text-amber-400" /> Zrób miejsce na kod QR (Shift)
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
                          ? 'bg-amber-500 text-zinc-950 font-bold border-amber-400 shadow-sm'
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
                  <span>Szerokość strefy (mm):</span>
                  <span className="font-mono text-zinc-200 font-semibold">{pageShift.offsetMm} mm</span>
                </div>
                <input
                  type="range"
                  min={15}
                  max={60}
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
                  <span>Skalowanie treści:</span>
                  <span className="font-mono text-zinc-200 font-semibold">
                    {Math.round(pageShift.scaleContent * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={70}
                  max={98}
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

              <label className="flex items-center gap-2 cursor-pointer pt-1 border-t border-zinc-800 text-[10px] text-zinc-300">
                <input
                  type="checkbox"
                  checked={pageShift.autoPositionQR}
                  onChange={(e) => onChangePageShift({ autoPositionQR: e.target.checked })}
                  className="accent-amber-500"
                />
                <span>Automatycznie centruj kod w strefie</span>
              </label>
            </div>
          )}

          {/* Dedicated Page Button */}
          {onInsertDedicatedPage && (
            <button
              type="button"
              onClick={onInsertDedicatedPage}
              className="w-full py-1.5 px-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-[10px] font-medium rounded border border-zinc-700 flex items-center justify-center gap-1.5 transition cursor-pointer"
            >
              <FilePlus className="w-3 h-3 text-blue-400" /> Wstaw nową stronę tytułową z QR (+1 str.)
            </button>
          )}

          {/* Export CTA Button */}
          <button
            type="button"
            onClick={onExportClick}
            disabled={isProcessing || targetPagesCount === 0}
            className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>
              {isProcessing
                ? 'Przetwarzanie dokumentu...'
                : `Zapisz i pobierz PDF (${targetPagesCount} stron)`}
            </span>
          </button>
        </div>
      </div>
    </aside>
  );
};
