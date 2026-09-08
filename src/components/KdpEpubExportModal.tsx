'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  BookOpen,
  Printer,
  Tablet,
  Download,
  Settings,
  CheckCircle2,
  AlertCircle,
  FileText,
  Layers,
  Sparkles,
  AlignJustify,
  Maximize2,
  Info,
} from 'lucide-react';
import { KdpPrintConfig, EpubConfig, ExtractedBookModel } from '@/types/kdp-epub';
import { QRCodeItem, PdfDocumentInfo } from '@/types/pdf';
import { extractBookContentFromPdf } from '@/lib/pdf-text-extractor';
import { generateKdpA5PrintPdf } from '@/lib/pdf-typesetter';
import { generateEpubPackage } from '@/lib/epub-generator';

interface KdpEpubExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentInfo: PdfDocumentInfo | null;
  pdfDocProxy: any | null;
  qrItems: QRCodeItem[];
}

export const KdpEpubExportModal: React.FC<KdpEpubExportModalProps> = ({
  isOpen,
  onClose,
  documentInfo,
  pdfDocProxy,
  qrItems,
}) => {
  const [activeTab, setActiveTab] = useState<'kdp-pdf' | 'epub'>('kdp-pdf');

  // KDP Print Configuration
  const [kdpConfig, setKdpConfig] = useState<KdpPrintConfig>({
    bleed: 'kdp-standard',
    bleedMm: 3.2,
    gutterMarginMm: 18,
    outerMarginMm: 13,
    topMarginMm: 15,
    bottomMarginMm: 15,
    fontSizePt: 12,
    lineHeightPt: 16,
    textAlign: 'justify',
    fontFamily: 'georgia',
    bookTitle: documentInfo?.name.replace(/\.pdf$/i, '').replace(/[_-]/g, ' ') || 'Dokument A5',
    author: 'Autor Publikacji',
    runningHeader: true,
    pageNumbers: true,
    firstLineIndentMm: 5,
    mode: 'typeset',
    includeQRCodes: true,
  });

  // ePUB Configuration
  const [epubConfig, setEpubConfig] = useState<EpubConfig>({
    title: documentInfo?.name.replace(/\.pdf$/i, '').replace(/[_-]/g, ' ') || 'Dokument A5',
    author: 'Autor Publikacji',
    language: 'pl',
    fontSizePt: 12,
    textAlign: 'justify',
    hyphenation: true,
    indentParagraphs: true,
    includeQRCodes: true,
  });

  // Extracted Book Structure State
  const [bookModel, setBookModel] = useState<ExtractedBookModel | null>(null);
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<{ current: number; total: number; stage: string }>({
    current: 0,
    total: 0,
    stage: '',
  });

  // Preview Page Parity (odd / even toggle in preview)
  const [previewParity, setPreviewParity] = useState<'odd' | 'even'>('odd');

  // Auto-extract content when modal opens
  useEffect(() => {
    if (isOpen && (pdfDocProxy || documentInfo?.data)) {
      setIsExtracting(true);
      const source = pdfDocProxy || documentInfo?.data;
      extractBookContentFromPdf(source, documentInfo?.name || 'Dokument A5')
        .then((model) => {
          setBookModel(model);
          setKdpConfig((prev) => ({
            ...prev,
            bookTitle: model.title || prev.bookTitle,
            author: model.author || prev.author,
          }));
          setEpubConfig((prev) => ({
            ...prev,
            title: model.title || prev.title,
            author: model.author || prev.author,
          }));
        })
        .catch((err) => {
          console.error('Extraction error:', err);
        })
        .finally(() => {
          setIsExtracting(false);
        });
    }
  }, [isOpen, pdfDocProxy, documentInfo]);

  if (!isOpen) return null;

  // Handlers for Exports
  const handleExportKdpPdf = async () => {
    if (!bookModel && kdpConfig.mode === 'typeset') return;
    setIsExporting(true);
    setExportProgress({ current: 0, total: 100, stage: 'Inicjalizacja składu typograficznego KDP...' });

    try {
      const pdfBytes = await generateKdpA5PrintPdf({
        config: kdpConfig,
        bookModel: bookModel || {
          title: kdpConfig.bookTitle,
          author: kdpConfig.author,
          chapters: [],
          totalWords: 0,
          sourcePageCount: documentInfo?.pageCount || 1,
        },
        originalBytes: documentInfo?.data,
        qrItems,
        onProgress: (cur, tot) => {
          setExportProgress({
            current: cur,
            total: tot,
            stage: `Składanie rozdziału ${cur} z ${tot}...`,
          });
        },
      });

      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      const cleanName = (kdpConfig.bookTitle || 'ksiazka').replace(/[^a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ_-]/g, '_');
      const suffix = kdpConfig.bleed === 'kdp-standard' ? '_KDP_A5_Bleed_12pt_Print' : '_KDP_A5_12pt_Print';
      a.download = `${cleanName}${suffix}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      console.error('KDP Export Error:', err);
      alert('Wystąpił błąd podczas eksportu KDP PDF: ' + (err?.message || err));
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportEpub = async () => {
    if (!bookModel) return;
    setIsExporting(true);
    setExportProgress({ current: 0, total: 100, stage: 'Generowanie pakietu ePUB 3.0...' });

    try {
      const epubBytes = await generateEpubPackage({
        config: epubConfig,
        bookModel,
        qrItems,
        onProgress: (cur, tot) => {
          setExportProgress({
            current: cur,
            total: tot,
            stage: `Pakowanie rozdziału ${cur} z ${tot}...`,
          });
        },
      });

      const blob = new Blob([epubBytes.buffer as ArrayBuffer], { type: 'application/epub+zip' });
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      const cleanName = (epubConfig.title || 'ksiazka').replace(/[^a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ_-]/g, '_');
      a.download = `${cleanName}_KDP_eBook_12pt.epub`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      console.error('ePUB Export Error:', err);
      alert('Wystąpił błąd podczas generowania ePUB: ' + (err?.message || err));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white">
                  Studio Publikacji Amazon KDP & eBook
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full">
                  Format A5 & 12 pt
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Eksport z zachowaniem spadów i marginesów introligatorskich, justowaniem 12 pt i architekturą gotową do druku.
              </p>
            </div>
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 border-b border-zinc-800 bg-zinc-900/30 flex items-center justify-between">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('kdp-pdf')}
              className={`py-3 text-xs font-medium border-b-2 flex items-center gap-2 transition cursor-pointer ${
                activeTab === 'kdp-pdf'
                  ? 'border-blue-500 text-blue-400 font-semibold'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Printer className="w-4 h-4" />
              <span>Druk Amazon KDP (PDF A5)</span>
            </button>
            <button
              onClick={() => setActiveTab('epub')}
              className={`py-3 text-xs font-medium border-b-2 flex items-center gap-2 transition cursor-pointer ${
                activeTab === 'epub'
                  ? 'border-indigo-500 text-indigo-400 font-semibold'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Tablet className="w-4 h-4" />
              <span>eBook Amazon KDP (ePUB 3.0)</span>
            </button>
          </div>

          {bookModel && (
            <div className="text-[11px] text-zinc-400 flex items-center gap-3">
              <span>Rozdziały: <strong className="text-zinc-200">{bookModel.chapters.length}</strong></span>
              <span>Słowa: <strong className="text-zinc-200">{bookModel.totalWords.toLocaleString()}</strong></span>
              <span>Strony źródłowe: <strong className="text-zinc-200">{bookModel.sourcePageCount}</strong></span>
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Settings Panel (7 cols) */}
          <div className="lg:col-span-7 space-y-5">
            {activeTab === 'kdp-pdf' ? (
              /* TAB 1: KDP PRINT PDF SETTINGS */
              <>
                {/* 1. Spady (Bleed) Box */}
                <div className="bg-zinc-900/70 border border-zinc-800 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                      <Maximize2 className="w-3.5 h-3.5 text-blue-400" />
                      Ustawienia Spadów Drukarskich (Bleed)
                    </label>
                    <span className="text-[10px] text-blue-400 font-mono">
                      {kdpConfig.bleed === 'kdp-standard' ? '154.4 × 216.4 mm (+3.2 mm)' : '148.0 × 210.0 mm (A5 netto)'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setKdpConfig((prev) => ({ ...prev, bleed: 'kdp-standard' }))}
                      className={`p-2.5 rounded-lg border text-left transition text-xs ${
                        kdpConfig.bleed === 'kdp-standard'
                          ? 'border-blue-500 bg-blue-500/10 text-white'
                          : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      <div className="font-medium flex items-center justify-between">
                        <span>Ze spadami KDP (+3.2 mm)</span>
                        {kdpConfig.bleed === 'kdp-standard' && <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />}
                      </div>
                      <p className="text-[10px] text-zinc-400 mt-1">
                        Zalecane dla Amazon KDP z grafiką do krawędzi (154.4 × 216.4 mm).
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setKdpConfig((prev) => ({ ...prev, bleed: 'none' }))}
                      className={`p-2.5 rounded-lg border text-left transition text-xs ${
                        kdpConfig.bleed === 'none'
                          ? 'border-blue-500 bg-blue-500/10 text-white'
                          : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      <div className="font-medium flex items-center justify-between">
                        <span>Bez spadów (Standard A5)</span>
                        {kdpConfig.bleed === 'none' && <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />}
                      </div>
                      <p className="text-[10px] text-zinc-400 mt-1">
                        Dla publikacji czysto tekstowych (dokładny format DIN A5 148 × 210 mm).
                      </p>
                    </button>
                  </div>
                </div>

                {/* 2. Marginesy introligatorskie KDP (Gutter & Alternating) */}
                <div className="bg-zinc-900/70 border border-zinc-800 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-amber-400" />
                      Marginesy Introligatorskie KDP (Gutter / Grzbiet)
                    </label>
                    <span className="text-[10px] text-amber-400 font-mono">
                      Strony lustrzane (Recto / Verso)
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-zinc-300">
                      <span>Margines grzbietu (Gutter): <strong>{kdpConfig.gutterMarginMm} mm</strong></span>
                      <span className="text-[11px] text-zinc-500">
                        {kdpConfig.gutterMarginMm <= 15 ? 'Objętość < 150 stron' : kdpConfig.gutterMarginMm <= 18 ? 'Objętość 150-300 stron' : 'Objętość > 300 stron'}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="12"
                      max="25"
                      step="1"
                      value={kdpConfig.gutterMarginMm}
                      onChange={(e) => setKdpConfig((prev) => ({ ...prev, gutterMarginMm: Number(e.target.value) }))}
                      className="w-full accent-blue-500 h-1.5 bg-zinc-800 rounded-lg cursor-pointer"
                    />
                    <div className="flex gap-2 pt-1">
                      {[15, 18, 21].map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setKdpConfig((prev) => ({ ...prev, gutterMarginMm: val }))}
                          className={`px-2.5 py-1 text-[10px] rounded border transition ${
                            kdpConfig.gutterMarginMm === val
                              ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 font-medium'
                              : 'bg-zinc-800/60 border-zinc-700/60 text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          Preset: {val} mm
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 pt-2">
                    <div>
                      <label className="text-[11px] text-zinc-400 block mb-1">Zewnętrzny (mm)</label>
                      <input
                        type="number"
                        min="8"
                        max="25"
                        value={kdpConfig.outerMarginMm}
                        onChange={(e) => setKdpConfig((prev) => ({ ...prev, outerMarginMm: Number(e.target.value) }))}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded px-2.5 py-1 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-zinc-400 block mb-1">Górny (mm)</label>
                      <input
                        type="number"
                        min="10"
                        max="30"
                        value={kdpConfig.topMarginMm}
                        onChange={(e) => setKdpConfig((prev) => ({ ...prev, topMarginMm: Number(e.target.value) }))}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded px-2.5 py-1 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-zinc-400 block mb-1">Dolny (mm)</label>
                      <input
                        type="number"
                        min="10"
                        max="30"
                        value={kdpConfig.bottomMarginMm}
                        onChange={(e) => setKdpConfig((prev) => ({ ...prev, bottomMarginMm: Number(e.target.value) }))}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded px-2.5 py-1 text-xs text-white"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. Typografia & Formatowanie tekstu (12 pt, Obustronne Justowanie) */}
                <div className="bg-zinc-900/70 border border-zinc-800 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                      <AlignJustify className="w-3.5 h-3.5 text-emerald-400" />
                      Formatowanie Typograficzne & Justowanie
                    </label>
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 font-semibold">
                      Czcionka 12 pt | Obustronne Justowanie
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-zinc-800/40 p-2.5 rounded border border-zinc-800">
                      <div className="text-zinc-400 text-[11px]">Wielkość czcionki:</div>
                      <div className="font-semibold text-zinc-200 text-sm mt-0.5">12 pt (Wymóg Standardu)</div>
                      <div className="text-[10px] text-zinc-500 mt-0.5">Optymalna czytelność formatu A5</div>
                    </div>

                    <div className="bg-zinc-800/40 p-2.5 rounded border border-zinc-800">
                      <div className="text-zinc-400 text-[11px]">Justowanie:</div>
                      <div className="font-semibold text-emerald-400 text-sm mt-0.5">Lewa i Prawa Krawędź</div>
                      <div className="text-[10px] text-zinc-500 mt-0.5">Równomierne rozłożenie spacji</div>
                    </div>
                  </div>

                  <div className="space-y-2 pt-1">
                    <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={kdpConfig.runningHeader}
                        onChange={(e) => setKdpConfig((prev) => ({ ...prev, runningHeader: e.target.checked }))}
                        className="rounded bg-zinc-800 border-zinc-700 text-blue-600 focus:ring-0"
                      />
                      <span>Żywa pagina (nagłówek tytułu i rozdziału na górze stron)</span>
                    </label>

                    <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={kdpConfig.pageNumbers}
                        onChange={(e) => setKdpConfig((prev) => ({ ...prev, pageNumbers: e.target.checked }))}
                        className="rounded bg-zinc-800 border-zinc-700 text-blue-600 focus:ring-0"
                      />
                      <span>Naprzemienna numeracja stron w stopce (strona lewa/prawa)</span>
                    </label>

                    <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={kdpConfig.includeQRCodes}
                        onChange={(e) => setKdpConfig((prev) => ({ ...prev, includeQRCodes: e.target.checked }))}
                        className="rounded bg-zinc-800 border-zinc-700 text-blue-600 focus:ring-0"
                      />
                      <span>Dołącz kody QR z dokumentu w aneksie publikacji ({qrItems.length})</span>
                    </label>
                  </div>
                </div>

                {/* 4. Tryb Eksportu KDP */}
                <div className="bg-zinc-900/70 border border-zinc-800 rounded-lg p-4 space-y-2">
                  <label className="text-xs font-semibold text-zinc-200 block">
                    Wybierz Tryb Generowania PDF:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setKdpConfig((prev) => ({ ...prev, mode: 'typeset' }))}
                      className={`p-2.5 rounded border text-left transition text-xs ${
                        kdpConfig.mode === 'typeset'
                          ? 'border-blue-500 bg-blue-500/10 text-white'
                          : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      <div className="font-semibold text-zinc-200">1. Skład Typograficzny (Zalecany)</div>
                      <div className="text-[10px] text-zinc-400 mt-1">
                        Układa tekst źródłowy w nowy, książkowy szablon A5 z czcionką 12 pt, nagłówkami i pełnym justowaniem.
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setKdpConfig((prev) => ({ ...prev, mode: 'impose-pages' }))}
                      className={`p-2.5 rounded border text-left transition text-xs ${
                        kdpConfig.mode === 'impose-pages'
                          ? 'border-blue-500 bg-blue-500/10 text-white'
                          : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      <div className="font-semibold text-zinc-200">2. Impozycja Stron Źródłowych</div>
                      <div className="text-[10px] text-zinc-400 mt-1">
                        Zachowuje oryginalny układ stron graficznych, nakładając marginesy grzbietowe KDP i spady.
                      </div>
                    </button>
                  </div>
                </div>
              </>
            ) : (
              /* TAB 2: EPUB SETTINGS */
              <>
                <div className="bg-zinc-900/70 border border-zinc-800 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                      <Tablet className="w-3.5 h-3.5 text-indigo-400" />
                      Metadane Książki Elektronicznej (ePUB 3.0)
                    </label>
                    <span className="text-[10px] text-indigo-400 font-mono">
                      Zgodne z Amazon KDP Kindle & Apple Books
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-[11px] text-zinc-400 block mb-1">Tytuł Publikacji</label>
                      <input
                        type="text"
                        value={epubConfig.title}
                        onChange={(e) => setEpubConfig((prev) => ({ ...prev, title: e.target.value }))}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-xs text-white"
                        placeholder="Wpisz tytuł książki..."
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] text-zinc-400 block mb-1">Autor / Wydawca</label>
                        <input
                          type="text"
                          value={epubConfig.author}
                          onChange={(e) => setEpubConfig((prev) => ({ ...prev, author: e.target.value }))}
                          className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-xs text-white"
                          placeholder="Imię i Nazwisko..."
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-zinc-400 block mb-1">Język Publikacji</label>
                        <select
                          value={epubConfig.language}
                          onChange={(e) => setEpubConfig((prev) => ({ ...prev, language: e.target.value }))}
                          className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-xs text-white"
                        >
                          <option value="pl">Polski (pl)</option>
                          <option value="en">English (en)</option>
                          <option value="de">Deutsch (de)</option>
                          <option value="fr">Français (fr)</option>
                          <option value="es">Español (es)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-900/70 border border-zinc-800 rounded-lg p-4 space-y-3">
                  <label className="text-xs font-semibold text-zinc-200 block">
                    Typografia Czytnika Cyfrowego
                  </label>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-zinc-800/40 p-2.5 rounded border border-zinc-800">
                      <div className="text-zinc-400 text-[11px]">Czcionka bazowa:</div>
                      <div className="font-semibold text-zinc-200 text-sm mt-0.5">12 pt (1em)</div>
                      <div className="text-[10px] text-zinc-500 mt-0.5">Skalowalna czcionka szeryfowa</div>
                    </div>

                    <div className="bg-zinc-800/40 p-2.5 rounded border border-zinc-800">
                      <div className="text-zinc-400 text-[11px]">Wyrównanie CSS:</div>
                      <div className="font-semibold text-indigo-400 text-sm mt-0.5">text-align: justify</div>
                      <div className="text-[10px] text-zinc-500 mt-0.5">Wraz z automatycznym dzieleniem wyrazów</div>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2">
                    <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={epubConfig.indentParagraphs}
                        onChange={(e) => setEpubConfig((prev) => ({ ...prev, indentParagraphs: e.target.checked }))}
                        className="rounded bg-zinc-800 border-zinc-700 text-indigo-600 focus:ring-0"
                      />
                      <span>Wcięcia akapitowe (1.25em z pominięciem pierwszego akapitu)</span>
                    </label>

                    <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={epubConfig.hyphenation}
                        onChange={(e) => setEpubConfig((prev) => ({ ...prev, hyphenation: e.target.checked }))}
                        className="rounded bg-zinc-800 border-zinc-700 text-indigo-600 focus:ring-0"
                      />
                      <span>Włącz reguły automatycznego przenoszenia wyrazów (hyphens: auto)</span>
                    </label>

                    <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={epubConfig.includeQRCodes}
                        onChange={(e) => setEpubConfig((prev) => ({ ...prev, includeQRCodes: e.target.checked }))}
                        className="rounded bg-zinc-800 border-zinc-700 text-indigo-600 focus:ring-0"
                      />
                      <span>Osadź kody QR w treści e-booka jako grafiki z aktywnymi linkami ({qrItems.length})</span>
                    </label>
                  </div>
                </div>

                {/* Chapter List Preview */}
                {bookModel && (
                  <div className="bg-zinc-900/70 border border-zinc-800 rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-zinc-200">Wykryta Struktura Spisu Treści (TOC):</span>
                      <span className="text-zinc-500">{bookModel.chapters.length} rozdziałów</span>
                    </div>
                    <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                      {bookModel.chapters.map((ch, i) => (
                        <div
                          key={ch.id}
                          className="flex items-center justify-between text-xs px-2.5 py-1.5 rounded bg-zinc-800/40 border border-zinc-800/60"
                        >
                          <span className="truncate text-zinc-300 max-w-[340px]">
                            {i + 1}. {ch.title}
                          </span>
                          <span className="text-[10px] text-zinc-500 shrink-0">
                            {ch.paragraphs.length} akap.
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right Column: Live Interactive Visual Preview (5 cols) */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center bg-zinc-900/40 border border-zinc-800 rounded-xl p-5">
            <div className="w-full flex items-center justify-between mb-3 text-xs">
              <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                {activeTab === 'kdp-pdf' ? 'Podgląd Strony A5 KDP' : 'Podgląd Czytnika ePUB'}
              </span>

              {activeTab === 'kdp-pdf' && (
                <div className="flex items-center gap-1 bg-zinc-800 p-0.5 rounded text-[10px]">
                  <button
                    onClick={() => setPreviewParity('odd')}
                    className={`px-2 py-0.5 rounded font-medium transition ${
                      previewParity === 'odd' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Strona Prawa (Recto)
                  </button>
                  <button
                    onClick={() => setPreviewParity('even')}
                    className={`px-2 py-0.5 rounded font-medium transition ${
                      previewParity === 'even' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Strona Lewa (Verso)
                  </button>
                </div>
              )}
            </div>

            {activeTab === 'kdp-pdf' ? (
              /* A5 KDP Visual Sheet Preview */
              <div className="relative w-full aspect-[148/210] max-w-[280px] bg-white rounded shadow-2xl overflow-hidden border border-zinc-700 select-none text-zinc-900 flex flex-col justify-between">
                {/* Bleed Guideline (if enabled) */}
                {kdpConfig.bleed === 'kdp-standard' && (
                  <div className="absolute inset-1.5 border border-dashed border-red-400/50 pointer-events-none z-10">
                    <span className="absolute top-0.5 right-1 text-[7px] text-red-500 font-mono font-semibold">
                      Spad KDP 3.2 mm
                    </span>
                  </div>
                )}

                {/* Gutter Guide Overlay */}
                <div
                  className={`absolute top-0 bottom-0 bg-amber-500/10 border-r border-dashed border-amber-500/40 pointer-events-none z-10 ${
                    previewParity === 'odd' ? 'left-0' : 'right-0 border-l border-r-0'
                  }`}
                  style={{ width: `${(kdpConfig.gutterMarginMm / 148) * 100}%` }}
                >
                  <div className="text-[7px] text-amber-700 font-bold transform -rotate-90 origin-top-left absolute top-12 left-1">
                    Grzbiet {kdpConfig.gutterMarginMm} mm
                  </div>
                </div>

                {/* Printable Content Block */}
                <div
                  className="flex-1 flex flex-col justify-between"
                  style={{
                    paddingTop: `${(kdpConfig.topMarginMm / 210) * 100}%`,
                    paddingBottom: `${(kdpConfig.bottomMarginMm / 210) * 100}%`,
                    paddingLeft: previewParity === 'odd'
                      ? `${(kdpConfig.gutterMarginMm / 148) * 100}%`
                      : `${(kdpConfig.outerMarginMm / 148) * 100}%`,
                    paddingRight: previewParity === 'odd'
                      ? `${(kdpConfig.outerMarginMm / 148) * 100}%`
                      : `${(kdpConfig.gutterMarginMm / 148) * 100}%`,
                  }}
                >
                  {/* Running Header */}
                  {kdpConfig.runningHeader && (
                    <div className="pb-1 mb-2 border-b border-zinc-300 flex items-center justify-between text-[7.5px] text-zinc-500">
                      <span>{previewParity === 'odd' ? 'Rozdział 1: Wprowadzenie' : kdpConfig.bookTitle}</span>
                      <span className="font-mono">A5 Druk KDP</span>
                    </div>
                  )}

                  {/* Sample 12pt Justified Paragraphs */}
                  <div className="space-y-1.5 text-justify" style={{ fontSize: '8px', lineHeight: '1.3' }}>
                    <div className="font-bold text-[9px] text-zinc-900 mb-1 text-left">
                      Rozdział 1. Specyfikacja Drukarska
                    </div>
                    <p className="text-zinc-800 indent-2">
                      Formatowanie zostało przygotowane ściśle według wymogów <strong>Amazon KDP A5</strong>. Czcionka o wielkości <strong>12 pt</strong> wraz z matematycznym wyjustowaniem obu krawędzi tworzy estetyczny i harmonijny układ kolumny tekstu.
                    </p>
                    <p className="text-zinc-800 indent-2">
                      Margines grzbietowy ({kdpConfig.gutterMarginMm} mm) zabezpiecza tekst przed wciągnięciem w oprawę introligatorską, a spady chronią dokument przed powstawaniem białych krawędzi podczas gilotynowania.
                    </p>
                  </div>

                  {/* Running Footer Page Number */}
                  {kdpConfig.pageNumbers && (
                    <div
                      className={`pt-2 text-[8px] font-medium text-zinc-600 ${
                        previewParity === 'odd' ? 'text-right' : 'text-left'
                      }`}
                    >
                      {previewParity === 'odd' ? '3' : '2'}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* ePUB Reader Frame Preview */
              <div className="relative w-full aspect-[148/210] max-w-[280px] bg-amber-50/90 rounded-2xl shadow-2xl p-4 border border-zinc-700 text-zinc-900 flex flex-col justify-between select-none">
                <div className="text-center text-[8px] text-zinc-400 font-medium tracking-wide">
                  {epubConfig.title || 'eBook Reader'}
                </div>

                <div className="my-auto space-y-2 text-justify" style={{ fontSize: '8.5px', lineHeight: '1.4' }}>
                  <h2 className="font-bold text-[11px] text-center text-zinc-900 mb-1.5 pb-1 border-b border-zinc-300">
                    Rozdział I. Wydanie Cyfrowe
                  </h2>
                  <p className="indent-2 text-zinc-800">
                    Treść została sformatowana z zachowaniem pełnego wyjustowania do prawej i lewej strony oraz wielkości bazowej 12 pt.
                  </p>
                  <p className="indent-2 text-zinc-800">
                    Dzięki standardowi ePUB 3.0 tekst płynnie dopasowuje się do ekranów czytników Kindle, tabletów i smartfonów, zachowując spis treści i podział na rozdziały.
                  </p>
                </div>

                <div className="flex justify-between items-center text-[7.5px] text-zinc-400 pt-2 border-t border-zinc-200">
                  <span>Rozdział 1 z {bookModel?.chapters.length || 1}</span>
                  <span>12 pt Justify</span>
                </div>
              </div>
            )}

            <div className="mt-4 text-center text-[11px] text-zinc-400">
              {activeTab === 'kdp-pdf' ? (
                <span>
                  Amazon KDP Paperback: <strong>DIN A5 (148 × 210 mm)</strong>
                  {kdpConfig.bleed === 'kdp-standard' && ' + Spad 3.2 mm'}
                </span>
              ) : (
                <span>
                  Standard: <strong>IDPF EPUB 3.0</strong> (Kindle KDP / E-readers)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Footer with Action Buttons */}
        <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-900/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-zinc-400 flex items-center gap-2">
            {isExtracting ? (
              <span className="flex items-center gap-2 text-amber-400 animate-pulse">
                <Sparkles className="w-4 h-4" /> Ekstrakcja struktury tekstu z PDF...
              </span>
            ) : isExporting ? (
              <span className="flex items-center gap-2 text-blue-400 font-medium">
                <div className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                {exportProgress.stage || 'Przetwarzanie dokumentu...'}
              </span>
            ) : (
              <span className="text-zinc-500 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Gotowy do wygenerowania formatów wydawniczych
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={onClose}
              disabled={isExporting}
              className="flex-1 sm:flex-none px-4 py-2 text-xs font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg transition"
            >
              Zamknij
            </button>

            {activeTab === 'kdp-pdf' ? (
              <button
                onClick={handleExportKdpPdf}
                disabled={isExporting || isExtracting}
                className="flex-1 sm:flex-none px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-lg shadow-blue-600/30 transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Generuj i Pobierz KDP PDF (A5)</span>
              </button>
            ) : (
              <button
                onClick={handleExportEpub}
                disabled={isExporting || isExtracting}
                className="flex-1 sm:flex-none px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-lg shadow-indigo-600/30 transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Generuj i Pobierz eBook (ePUB)</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
