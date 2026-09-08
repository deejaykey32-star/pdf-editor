'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
  Filter,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { KdpPrintConfig, EpubConfig, DocxConfig, ExtractedBookModel } from '@/types/kdp-epub';
import { QRCodeItem, PdfDocumentInfo } from '@/types/pdf';
import { extractBookContentFromPdf } from '@/lib/pdf-text-extractor';
import { generateKdpA5PrintPdf } from '@/lib/pdf-typesetter';
import { generateEpubPackage } from '@/lib/epub-generator';
import { generateKdpDocxPackage } from '@/lib/docx-generator';

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
  const [activeTab, setActiveTab] = useState<'kdp-pdf' | 'epub' | 'docx'>('kdp-pdf');

  // Exclusion filter text (lines to strip from extracted text)
  const [excludedPhrasesText, setExcludedPhrasesText] = useState<string>(
    `Dokument A5 Amazon KDP
Dokument A5
WnR365 Calosc Ksiega A5   całość   06.09.2026
Widoki na Raj — WnR365
Wstęp i Misja eMBiK365
eMBiK365 — widokinaraj.pl str. 2
eMBiK365 — widokinaraj.pl str. 1-797
RHZ365 poprawiony 07.09.2026 z kodami QR
Autor Publikacji
Wprowadzenie
Widoki na Raj
WnR365
Modlitwa (YouTube)
Blog i modlitwa
Różaniec Historii Zbawienia — RHZ365
widokinaraj.pl
RHZ365
eMBiK365`
  );

  const excludedPatternsList = useMemo(() => {
    return excludedPhrasesText
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
  }, [excludedPhrasesText]);

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
    bookTitle: documentInfo?.name.replace(/\.pdf$/i, '').replace(/[_-]/g, ' ') || '',
    author: '',
    runningHeader: true,
    pageNumbers: true,
    firstLineIndentMm: 5,
    mode: 'typeset',
    includeQRCodes: true,
  });

  // ePUB Configuration
  const [epubConfig, setEpubConfig] = useState<EpubConfig>({
    title: documentInfo?.name.replace(/\.pdf$/i, '').replace(/[_-]/g, ' ') || '',
    author: '',
    language: 'pl',
    fontSizePt: 12,
    textAlign: 'justify',
    hyphenation: true,
    indentParagraphs: true,
    includeQRCodes: true,
  });

  // Microsoft Word DOCX Configuration (Amazon KDP A5 Print Setup)
  const [docxConfig, setDocxConfig] = useState<DocxConfig>({
    title: documentInfo?.name.replace(/\.pdf$/i, '').replace(/[_-]/g, ' ') || '',
    author: '',
    gutterMarginMm: 18,
    outerMarginMm: 13,
    topMarginMm: 15,
    bottomMarginMm: 15,
    fontSizePt: 12,
    lineSpacing: 1.15,
    fontFamily: 'georgia',
    firstLineIndentMm: 5,
    runningHeader: true,
    pageNumbers: true,
    mirrorMargins: true,
    includeTableOfContents: true,
    includeQRCodes: true,
  });

  // Extracted Book Structure State
  const [bookModel, setBookModel] = useState<ExtractedBookModel | null>(null);
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [extractProgress, setExtractProgress] = useState<{ current: number; total: number }>({
    current: 0,
    total: 0,
  });
  const isExtractingRef = useRef(false);

  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<{ current: number; total: number; stage: string }>({
    current: 0,
    total: 0,
    stage: '',
  });

  // Preview Page Parity (odd / even toggle in preview)
  const [previewParity, setPreviewParity] = useState<'odd' | 'even'>('odd');

  const runExtraction = useCallback(
    async (patternsToExclude: string[]) => {
      if (isExtractingRef.current) return;
      if (!pdfDocProxy && !documentInfo?.data) return;

      isExtractingRef.current = true;
      setIsExtracting(true);
      setExtractProgress({ current: 0, total: documentInfo?.pageCount || 100 });

      try {
        const source = pdfDocProxy || documentInfo?.data;
        const model = await extractBookContentFromPdf(source, {
          fallbackTitle: documentInfo?.name.replace(/\.pdf$/i, '') || '',
          customExcludedPatterns: patternsToExclude,
          onProgress: (current, total) => {
            setExtractProgress({ current, total });
          },
        });

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
        setDocxConfig((prev) => ({
          ...prev,
          title: model.title || prev.title,
          author: model.author || prev.author,
        }));
      } catch (err) {
        console.error('Extraction error:', err);
      } finally {
        isExtractingRef.current = false;
        setIsExtracting(false);
      }
    },
    [pdfDocProxy, documentInfo]
  );

  // Auto-extract content ONCE when modal opens if not already extracted
  useEffect(() => {
    if (isOpen && (pdfDocProxy || documentInfo?.data) && !bookModel && !isExtractingRef.current) {
      runExtraction(excludedPatternsList);
    }
  }, [isOpen, pdfDocProxy, documentInfo, bookModel, runExtraction, excludedPatternsList]);

  if (!isOpen) return null;

  // Handlers for Exports
  const handleExportKdpPdf = async () => {
    if (!bookModel && kdpConfig.mode === 'typeset') return;
    const currentFontSize = kdpConfig.fontSizePt || 12;
    setIsExporting(true);
    setExportProgress({ current: 0, total: 100, stage: `Inicjalizacja składu typograficznego KDP (format ${currentFontSize} pt)...` });

    try {
      const pdfBytes = await generateKdpA5PrintPdf({
        config: {
          ...kdpConfig,
          fontSizePt: currentFontSize,
          lineHeightPt: kdpConfig.lineHeightPt || Math.round(currentFontSize * 1.333 * 10) / 10,
          excludedPatterns: excludedPatternsList,
        },
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
      const suffix = kdpConfig.bleed === 'kdp-standard'
        ? `_KDP_A5_Bleed_${currentFontSize}pt_Print`
        : `_KDP_A5_${currentFontSize}pt_Print`;
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
    const currentFontSize = epubConfig.fontSizePt || 12;
    setIsExporting(true);
    setExportProgress({ current: 0, total: 100, stage: `Generowanie pakietu ePUB 3.0 (format ${currentFontSize} pt)...` });

    try {
      const epubBytes = await generateEpubPackage({
        config: {
          ...epubConfig,
          fontSizePt: currentFontSize,
          excludedPatterns: excludedPatternsList,
        },
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
      a.download = `${cleanName}_KDP_eBook_${currentFontSize}pt.epub`;
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

  const handleExportDocx = async () => {
    if (!bookModel) return;
    const currentFontSize = docxConfig.fontSizePt || 12;
    setIsExporting(true);
    setExportProgress({
      current: 0,
      total: 100,
      stage: `Generowanie pliku Microsoft Word (.docx) KDP A5 (${currentFontSize} pt)...`,
    });

    try {
      const docxBytes = await generateKdpDocxPackage({
        config: {
          ...docxConfig,
          fontSizePt: currentFontSize,
          excludedPatterns: excludedPatternsList,
        },
        bookModel,
        qrItems,
        onProgress: (cur, tot, stage) => {
          setExportProgress({
            current: cur,
            total: tot,
            stage,
          });
        },
      });

      const blob = new Blob([docxBytes.buffer as ArrayBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      const cleanName = (docxConfig.title || 'ksiazka').replace(/[^a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ_-]/g, '_');
      a.download = `${cleanName}_KDP_A5_${currentFontSize}pt_Word.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      console.error('DOCX Export Error:', err);
      alert('Wystąpił błąd podczas generowania pliku Word DOCX: ' + (err?.message || err));
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
                  Studio Publikacji Amazon KDP & eBook & Word
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full">
                  Format A5 & Wszystkie Czcionki 12 pt
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Ścisłe zachowanie marginesów i spadów (brak wychodzenia poza stronę), wycinanie niepożądanych stopek i pełne wyjustowanie.
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
            <button
              onClick={() => setActiveTab('docx')}
              className={`py-3 text-xs font-medium border-b-2 flex items-center gap-2 transition cursor-pointer ${
                activeTab === 'docx'
                  ? 'border-sky-500 text-sky-400 font-semibold'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <FileText className="w-4 h-4 text-sky-400" />
              <span>Dokument Word (DOCX A5 KDP)</span>
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
            {/* Common Filter Box: Wycinanie niepożądanych fragmentów */}
            <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-red-300 flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-red-400" />
                  Usuwane Fragmenty, Nagłówki i Stopki ze Źródła
                </label>
                <button
                  type="button"
                  onClick={() => runExtraction(excludedPatternsList)}
                  disabled={isExtracting}
                  className="text-[10px] text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 px-2 py-0.5 rounded border border-zinc-700 flex items-center gap-1 transition"
                  title="Przelicz i zastosuj filtry do tekstu"
                >
                  <RefreshCw className={`w-3 h-3 ${isExtracting ? 'animate-spin' : ''}`} />
                  <span>Zastosuj filtry</span>
                </button>
              </div>

              <p className="text-[11px] text-zinc-400">
                Poniższe frazy są automatycznie usuwane z tekstu książki (np. stopki eMBiK365, widokinaraj.pl, RHZ365, numery stron):
              </p>

              <textarea
                rows={3}
                value={excludedPhrasesText}
                onChange={(e) => setExcludedPhrasesText(e.target.value)}
                placeholder="Wpisz frazy do usunięcia (każda w nowej linii)..."
                className="w-full bg-zinc-900 border border-zinc-800 rounded p-2 text-xs text-zinc-200 font-mono resize-none focus:outline-none focus:border-red-500/50"
              />

              <div className="flex flex-wrap gap-1.5">
                {excludedPatternsList.map((phrase, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-[10px] text-red-300 font-mono"
                  >
                    {phrase}
                  </span>
                ))}
              </div>
            </div>

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
                        Dla publikacji tekstowych (dokładny format DIN A5 148 × 210 mm).
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

                {/* 3. Typografia & Formatowanie tekstu (Regulacja Wielkości Czcionki, Obustronne Justowanie) */}
                <div className="bg-zinc-900/70 border border-zinc-800 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                      <AlignJustify className="w-3.5 h-3.5 text-emerald-400" />
                      Typografia: Wielkość Czcionki & Ochrona Marginesów
                    </label>
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 font-semibold flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-400" />
                      {kdpConfig.fontSizePt || 12} pt – 100% Ochrona Marginesów
                    </span>
                  </div>

                  {/* Font Size Controller */}
                  <div className="bg-zinc-800/40 p-3 rounded-lg border border-zinc-800 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold text-zinc-200">Wielkość czcionki publikacji:</span>
                        <div className="text-[10px] text-zinc-400">
                          Format tekstu i nagłówków (rekomendowane 10–12 pt dla książek A5)
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min="7"
                          max="24"
                          step="0.5"
                          value={kdpConfig.fontSizePt || 12}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 12;
                            setKdpConfig((prev) => ({
                              ...prev,
                              fontSizePt: val,
                              lineHeightPt: Math.round(val * 1.333 * 10) / 10,
                            }));
                          }}
                          className="w-16 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-center font-bold text-emerald-400 focus:border-emerald-500 focus:outline-none"
                        />
                        <span className="text-xs font-semibold text-zinc-400">pt</span>
                      </div>
                    </div>

                    {/* Quick Preset Buttons */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] text-zinc-500 mr-1">Szybki wybór:</span>
                      {[9, 10, 10.5, 11, 11.5, 12, 13, 14].map((size) => (
                        <button
                          key={size}
                          type="button"
                          onClick={() =>
                            setKdpConfig((prev) => ({
                              ...prev,
                              fontSizePt: size,
                              lineHeightPt: Math.round(size * 1.333 * 10) / 10,
                            }))
                          }
                          className={`px-2 py-1 rounded text-xs transition font-medium ${
                            (kdpConfig.fontSizePt || 12) === size
                              ? 'bg-emerald-600 text-white font-bold shadow'
                              : 'bg-zinc-800 text-zinc-300 border border-zinc-700 hover:border-zinc-600'
                          }`}
                        >
                          {size} pt {size === 12 && '(Domyślna)'}
                        </button>
                      ))}
                    </div>

                    {/* Range Slider */}
                    <div className="pt-1 flex items-center gap-3">
                      <span className="text-[10px] text-zinc-500 w-8">8 pt</span>
                      <input
                        type="range"
                        min="8"
                        max="18"
                        step="0.5"
                        value={kdpConfig.fontSizePt || 12}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 12;
                          setKdpConfig((prev) => ({
                            ...prev,
                            fontSizePt: val,
                            lineHeightPt: Math.round(val * 1.333 * 10) / 10,
                          }));
                        }}
                        className="flex-1 accent-emerald-500 h-1.5 bg-zinc-700 rounded-lg cursor-pointer"
                      />
                      <span className="text-[10px] text-zinc-500 w-8 text-right">18 pt</span>
                    </div>

                    <div className="text-[10px] text-zinc-400 flex items-center justify-between pt-1 border-t border-zinc-800/80">
                      <span>Interlinia (Line Height): <strong className="text-zinc-200">{kdpConfig.lineHeightPt || Math.round((kdpConfig.fontSizePt || 12) * 1.333 * 10) / 10} pt</strong></span>
                      <span>Układ: <strong className="text-zinc-200">Obustronne Justowanie</strong></span>
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
                      <span>Żywa pagina (nagłówek na górze stron, zabezpieczony przed wyjściem za margines)</span>
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
                        Układa tekst źródłowy w nowy szablon A5 ze wszystkimi czcionkami i nagłówkami 12 pt, wyjustowaniem i oczyszczeniem ze stopek.
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
            ) : activeTab === 'epub' ? (
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
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-zinc-200 block">
                      Typografia Czytnika Cyfrowego (ePUB 3.0)
                    </label>
                    <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/20 font-semibold">
                      Rozmiar bazowy: {epubConfig.fontSizePt || 12} pt
                    </span>
                  </div>

                  {/* ePUB Font Size Controller */}
                  <div className="bg-zinc-800/40 p-3 rounded-lg border border-zinc-800 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-semibold text-zinc-200">Bazowa wielkość czcionki w czytniku:</span>
                        <div className="text-[10px] text-zinc-400">
                          Domyślny rozmiar tekstu w stylach CSS dla czytników Kindle i Apple Books
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min="7"
                          max="24"
                          step="0.5"
                          value={epubConfig.fontSizePt || 12}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 12;
                            setEpubConfig((prev) => ({ ...prev, fontSizePt: val }));
                          }}
                          className="w-16 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-center font-bold text-indigo-400 focus:border-indigo-500 focus:outline-none"
                        />
                        <span className="text-xs font-semibold text-zinc-400">pt</span>
                      </div>
                    </div>

                    {/* Quick Preset Buttons for ePUB */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] text-zinc-500 mr-1">Szybki wybór:</span>
                      {[9, 10, 10.5, 11, 11.5, 12, 13, 14, 16].map((size) => (
                        <button
                          key={size}
                          type="button"
                          onClick={() => setEpubConfig((prev) => ({ ...prev, fontSizePt: size }))}
                          className={`px-2 py-1 rounded text-xs transition font-medium ${
                            (epubConfig.fontSizePt || 12) === size
                              ? 'bg-indigo-600 text-white font-bold shadow'
                              : 'bg-zinc-800 text-zinc-300 border border-zinc-700 hover:border-zinc-600'
                          }`}
                        >
                          {size} pt {size === 12 && '(Domyślna)'}
                        </button>
                      ))}
                    </div>

                    {/* Range Slider for ePUB */}
                    <div className="pt-1 flex items-center gap-3">
                      <span className="text-[10px] text-zinc-500 w-8">8 pt</span>
                      <input
                        type="range"
                        min="8"
                        max="18"
                        step="0.5"
                        value={epubConfig.fontSizePt || 12}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setEpubConfig((prev) => ({ ...prev, fontSizePt: val }));
                        }}
                        className="flex-1 accent-indigo-500 h-1.5 bg-zinc-700 rounded-lg cursor-pointer"
                      />
                      <span className="text-[10px] text-zinc-500 w-8 text-right">18 pt</span>
                    </div>

                    <div className="text-[10px] text-zinc-400 flex items-center justify-between pt-1 border-t border-zinc-800/80">
                      <span>Wyrównanie CSS: <strong className="text-zinc-200">text-align: justify</strong></span>
                      <span>Dzielenie słów: <strong className="text-zinc-200">hyphens: auto</strong></span>
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
            ) : (
              /* TAB 3: MICROSOFT WORD DOCX SETTINGS */
              <>
                {/* 1. KDP Word Information Box */}
                <div className="bg-sky-500/10 border border-sky-500/20 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-sky-300">
                    <FileText className="w-4 h-4 text-sky-400" />
                    <span>Zgodność z Amazon KDP w Microsoft Word (.docx)</span>
                  </div>
                  <p className="text-[11px] text-zinc-300 leading-relaxed">
                    Wygenerowany plik <strong className="text-white">.docx</strong> posiada zdefiniowany format <strong>DIN A5 (148 × 210 mm)</strong>, 
                    <strong> lustrzane marginesy introligatorskie KDP</strong> oraz podział strony przed każdym dniem i wprowadzeniem. 
                    Po otwarciu w aplikacji Word wystarczy wybrać <em>„Plik → Zapisz jako PDF”</em> lub <em>„Eksportuj do PDF”</em>, 
                    aby uzyskać w 100% gotowy do druku plik PDF spełniający wszystkie wymagania Amazon KDP.
                  </p>
                </div>

                {/* 2. Marginesy introligatorskie Word */}
                <div className="bg-zinc-900/70 border border-zinc-800 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-amber-400" />
                      Lustrzane Marginesy Introligatorskie Word (Mirror Margins)
                    </label>
                    <span className="text-[10px] text-amber-400 font-mono">
                      A5 (148 × 210 mm)
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="bg-zinc-800/60 p-2 rounded border border-zinc-700/60">
                      <label className="text-[10px] text-zinc-400 block">Wewnętrzny (Grzbiet)</label>
                      <div className="flex items-center gap-1 mt-1">
                        <input
                          type="number"
                          min="10"
                          max="35"
                          value={docxConfig.gutterMarginMm}
                          onChange={(e) => setDocxConfig((prev) => ({ ...prev, gutterMarginMm: parseInt(e.target.value) || 18 }))}
                          className="w-14 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-white"
                        />
                        <span className="text-xs text-zinc-400">mm</span>
                      </div>
                    </div>

                    <div className="bg-zinc-800/60 p-2 rounded border border-zinc-700/60">
                      <label className="text-[10px] text-zinc-400 block">Zewnętrzny</label>
                      <div className="flex items-center gap-1 mt-1">
                        <input
                          type="number"
                          min="8"
                          max="30"
                          value={docxConfig.outerMarginMm}
                          onChange={(e) => setDocxConfig((prev) => ({ ...prev, outerMarginMm: parseInt(e.target.value) || 13 }))}
                          className="w-14 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-white"
                        />
                        <span className="text-xs text-zinc-400">mm</span>
                      </div>
                    </div>

                    <div className="bg-zinc-800/60 p-2 rounded border border-zinc-700/60">
                      <label className="text-[10px] text-zinc-400 block">Górny</label>
                      <div className="flex items-center gap-1 mt-1">
                        <input
                          type="number"
                          min="10"
                          max="30"
                          value={docxConfig.topMarginMm}
                          onChange={(e) => setDocxConfig((prev) => ({ ...prev, topMarginMm: parseInt(e.target.value) || 15 }))}
                          className="w-14 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-white"
                        />
                        <span className="text-xs text-zinc-400">mm</span>
                      </div>
                    </div>

                    <div className="bg-zinc-800/60 p-2 rounded border border-zinc-700/60">
                      <label className="text-[10px] text-zinc-400 block">Dolny</label>
                      <div className="flex items-center gap-1 mt-1">
                        <input
                          type="number"
                          min="10"
                          max="30"
                          value={docxConfig.bottomMarginMm}
                          onChange={(e) => setDocxConfig((prev) => ({ ...prev, bottomMarginMm: parseInt(e.target.value) || 15 }))}
                          className="w-14 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-white"
                        />
                        <span className="text-xs text-zinc-400">mm</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Typografia Word (12 pt, Georgia, Justowanie) */}
                <div className="bg-zinc-900/70 border border-zinc-800 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-sky-400" />
                      Typografia Dokumentu Word (Domyślnie 12 pt)
                    </label>
                    <span className="text-[10px] text-sky-400 font-mono">
                      Rozmiar: {docxConfig.fontSizePt || 12} pt
                    </span>
                  </div>

                  {/* Preset Buttons for DOCX */}
                  <div className="flex gap-2">
                    {[10, 11, 12, 14].map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => setDocxConfig((prev) => ({ ...prev, fontSizePt: size }))}
                        className={`flex-1 py-1.5 rounded text-xs font-medium border transition cursor-pointer ${
                          docxConfig.fontSizePt === size
                            ? 'bg-sky-600 text-white border-sky-500 shadow-sm'
                            : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700'
                        }`}
                      >
                        {size} pt {size === 12 && '(KDP 12pt)'}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="text-[11px] text-zinc-400 block mb-1">Czcionka</label>
                      <select
                        value={docxConfig.fontFamily}
                        onChange={(e) => setDocxConfig((prev) => ({ ...prev, fontFamily: e.target.value as any }))}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-xs text-white"
                      >
                        <option value="georgia">Georgia (Szeryfowa KDP)</option>
                        <option value="times">Times New Roman</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] text-zinc-400 block mb-1">Interlinia (Line Spacing)</label>
                      <select
                        value={docxConfig.lineSpacing}
                        onChange={(e) => setDocxConfig((prev) => ({ ...prev, lineSpacing: parseFloat(e.target.value) }))}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-xs text-white"
                      >
                        <option value={1.15}>1.15 (Zalecana dla A5)</option>
                        <option value={1.25}>1.25 (Luźniejsza)</option>
                        <option value={1.0}>1.0 (Pojedyncza)</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 border-t border-zinc-800">
                    <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={docxConfig.runningHeader}
                        onChange={(e) => setDocxConfig((prev) => ({ ...prev, runningHeader: e.target.checked }))}
                        className="rounded bg-zinc-800 border-zinc-700 text-sky-600 focus:ring-0"
                      />
                      <span>Żywa pagina u góry stron (Running Header z tytułem)</span>
                    </label>

                    <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={docxConfig.pageNumbers}
                        onChange={(e) => setDocxConfig((prev) => ({ ...prev, pageNumbers: e.target.checked }))}
                        className="rounded bg-zinc-800 border-zinc-700 text-sky-600 focus:ring-0"
                      />
                      <span>Natywna numeracja stron Word w stopce (Page Numbering)</span>
                    </label>

                    <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={docxConfig.includeTableOfContents}
                        onChange={(e) => setDocxConfig((prev) => ({ ...prev, includeTableOfContents: e.target.checked }))}
                        className="rounded bg-zinc-800 border-zinc-700 text-sky-600 focus:ring-0"
                      />
                      <span>Automatyczny spis treści na końcu dokumentu (TOC z linkami Word)</span>
                    </label>

                    <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={docxConfig.includeQRCodes}
                        onChange={(e) => setDocxConfig((prev) => ({ ...prev, includeQRCodes: e.target.checked }))}
                        className="rounded bg-zinc-800 border-zinc-700 text-sky-600 focus:ring-0"
                      />
                      <span>Osadź kody QR w dodatku na końcu publikacji ({qrItems.length})</span>
                    </label>
                  </div>
                </div>

                {/* Chapter List Preview */}
                {bookModel && (
                  <div className="bg-zinc-900/70 border border-zinc-800 rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-zinc-200">Struktura Książki Word DOCX:</span>
                      <span className="text-zinc-500">{bookModel.chapters.length} rozdziałów (1 Wprowadzenie + 175 Dni)</span>
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
                {activeTab === 'kdp-pdf'
                  ? 'Podgląd Strony A5 KDP'
                  : activeTab === 'epub'
                  ? 'Podgląd Czytnika ePUB'
                  : 'Podgląd Strony Word A5 (DOCX)'}
              </span>

              {(activeTab === 'kdp-pdf' || activeTab === 'docx') && (
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
                      <span className="truncate max-w-[140px]">
                        {previewParity === 'odd' ? (bookModel?.chapters[0]?.title || '') : (kdpConfig.bookTitle || bookModel?.chapters[0]?.title || '')}
                      </span>
                      <span className="font-mono text-zinc-400">{previewParity === 'odd' ? 'Recto' : 'Verso'}</span>
                    </div>
                  )}

                  {/* Sample Justified Paragraphs */}
                  <div
                    className="space-y-1.5 text-justify"
                    style={{
                      fontSize: `${Math.max(6, Math.min(14, ((kdpConfig.fontSizePt || 12) / 12) * 8))}px`,
                      lineHeight: '1.35',
                    }}
                  >
                    <div className="font-bold text-zinc-900 mb-1 text-left" style={{ fontSize: `${Math.max(6.5, Math.min(15, ((kdpConfig.fontSizePt || 12) / 12) * 8.5))}px` }}>
                      {bookModel?.chapters[0]?.title || 'Wstęp'}
                    </div>
                    {bookModel?.chapters[0]?.paragraphs?.filter((p) => !p.isHeading).length ? (
                      bookModel.chapters[0].paragraphs
                        .filter((p) => !p.isHeading)
                        .slice(0, 2)
                        .map((p, idx) => (
                          <p key={idx} className="text-zinc-800 indent-2 line-clamp-3">
                            {p.text}
                          </p>
                        ))
                    ) : (
                      <>
                        <p className="text-zinc-800 indent-2">
                          Tekst i nagłówki są w formacie <strong>{kdpConfig.fontSizePt || 12} pt</strong>. Układ kolumny tekstu posiada matematyczną ochronę marginesów zapobiegającą jakiemukolwiek wychodzeniu wyrazów poza krawędzie strony.
                        </p>
                        <p className="text-zinc-800 indent-2">
                          Niepożądane fragmenty stopek i nagłówków zostały automatycznie wycięte z dokumentu źródłowego.
                        </p>
                      </>
                    )}
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
            ) : activeTab === 'epub' ? (
              /* ePUB Reader Frame Preview */
              <div className="relative w-full aspect-[148/210] max-w-[280px] bg-amber-50/90 rounded-2xl shadow-2xl p-4 border border-zinc-700 text-zinc-900 flex flex-col justify-between select-none">
                <div className="text-center text-[8px] text-zinc-400 font-medium tracking-wide">
                  {epubConfig.title || 'eBook Reader'}
                </div>

                <div
                  className="my-auto space-y-2 text-justify"
                  style={{
                    fontSize: `${Math.max(6.5, Math.min(14, ((epubConfig.fontSizePt || 12) / 12) * 8.5))}px`,
                    lineHeight: '1.4',
                  }}
                >
                  <h2 className="font-bold text-center text-zinc-900 mb-1.5 pb-1 border-b border-zinc-300" style={{ fontSize: `${Math.max(7, Math.min(15, ((epubConfig.fontSizePt || 12) / 12) * 9))}px` }}>
                    {bookModel?.chapters[0]?.title || 'Wstęp'}
                  </h2>
                  {bookModel?.chapters[0]?.paragraphs?.filter((p) => !p.isHeading).length ? (
                    bookModel.chapters[0].paragraphs
                      .filter((p) => !p.isHeading)
                      .slice(0, 2)
                      .map((p, idx) => (
                        <p key={idx} className="indent-2 text-zinc-800 line-clamp-3">
                          {p.text}
                        </p>
                      ))
                  ) : (
                    <>
                      <p className="indent-2 text-zinc-800">
                        Treść oraz nagłówki zostały sformatowane w wybranym formacie <strong>{epubConfig.fontSizePt || 12} pt</strong> z pełnym wyjustowaniem i wycięciem powtarzających się stopek.
                      </p>
                      <p className="indent-2 text-zinc-800">
                        Tekst dopasowuje się do ekranu bez wychodzenia poza marginesy czytnika Kindle i iPad.
                      </p>
                    </>
                  )}
                </div>

                <div className="flex justify-between items-center text-[7.5px] text-zinc-400 pt-2 border-t border-zinc-200">
                  <span>Rozdział 1 z {bookModel?.chapters.length || 1}</span>
                  <span>{epubConfig.fontSizePt || 12} pt Justify</span>
                </div>
              </div>
            ) : (
              /* Word DOCX Visual Sheet Preview */
              <div className="relative w-full aspect-[148/210] max-w-[280px] bg-white rounded shadow-2xl overflow-hidden border border-sky-600/40 select-none text-zinc-900 flex flex-col justify-between">
                {/* Word Document Brand Top Accent */}
                <div className="h-1.5 bg-gradient-to-r from-sky-600 to-blue-700 w-full" />

                {/* Gutter Guide Overlay for DOCX */}
                <div
                  className={`absolute top-1.5 bottom-0 bg-sky-500/10 border-r border-dashed border-sky-500/40 pointer-events-none z-10 ${
                    previewParity === 'odd' ? 'left-0' : 'right-0 border-l border-r-0'
                  }`}
                  style={{ width: `${(docxConfig.gutterMarginMm / 148) * 100}%` }}
                >
                  <div className="text-[7px] text-sky-700 font-bold transform -rotate-90 origin-top-left absolute top-12 left-1">
                    Grzbiet {docxConfig.gutterMarginMm} mm
                  </div>
                </div>

                {/* Printable Content Block */}
                <div
                  className="flex-1 flex flex-col justify-between"
                  style={{
                    paddingTop: `${(docxConfig.topMarginMm / 210) * 100}%`,
                    paddingBottom: `${(docxConfig.bottomMarginMm / 210) * 100}%`,
                    paddingLeft: previewParity === 'odd'
                      ? `${(docxConfig.gutterMarginMm / 148) * 100}%`
                      : `${(docxConfig.outerMarginMm / 148) * 100}%`,
                    paddingRight: previewParity === 'odd'
                      ? `${(docxConfig.outerMarginMm / 148) * 100}%`
                      : `${(docxConfig.gutterMarginMm / 148) * 100}%`,
                  }}
                >
                  {/* Running Header */}
                  {docxConfig.runningHeader && (
                    <div className="pb-1 mb-2 border-b border-zinc-200 flex items-center justify-between text-[7.5px] text-zinc-500">
                      <span className="truncate max-w-[140px] italic">
                        {previewParity === 'odd' ? (bookModel?.chapters[0]?.title || '') : (docxConfig.title || 'Publikacja Amazon KDP')}
                      </span>
                      <span className="font-mono text-zinc-400">{previewParity === 'odd' ? 'Recto' : 'Verso'}</span>
                    </div>
                  )}

                  {/* Sample Justified Paragraphs in Word */}
                  <div
                    className="space-y-1.5 text-justify"
                    style={{
                      fontSize: `${Math.max(6, Math.min(14, ((docxConfig.fontSizePt || 12) / 12) * 8))}px`,
                      lineHeight: '1.35',
                      fontFamily: docxConfig.fontFamily === 'times' ? 'Times New Roman, serif' : 'Georgia, serif',
                    }}
                  >
                    <div className="font-bold text-zinc-900 mb-1 text-left border-b-2 border-blue-600 pb-0.5" style={{ fontSize: `${Math.max(6.5, Math.min(15, ((docxConfig.fontSizePt || 12) / 12) * 8.5))}px` }}>
                      {bookModel?.chapters[0]?.title || 'Wprowadzenie'}
                    </div>
                    {bookModel?.chapters[0]?.paragraphs?.filter((p) => !p.isHeading).length ? (
                      bookModel.chapters[0].paragraphs
                        .filter((p) => !p.isHeading)
                        .slice(0, 2)
                        .map((p, idx) => (
                          <p key={idx} className="text-zinc-800 indent-2 line-clamp-3">
                            {p.text}
                          </p>
                        ))
                    ) : (
                      <>
                        <p className="text-zinc-800 indent-2">
                          Dokument Word został skonfigurowany w formacie <strong>DIN A5</strong> ze standardową czcionką <strong>{docxConfig.fontSizePt || 12} pt</strong> i pełnym wyjustowaniem.
                        </p>
                        <p className="text-zinc-800 indent-2">
                          Po otwarciu w programie Word zapisanie jako PDF da identyczny, poprawnie sformatowany plik dla Amazon KDP.
                        </p>
                      </>
                    )}
                  </div>

                  {/* Running Footer Page Number */}
                  {docxConfig.pageNumbers && (
                    <div className="pt-2 text-[8px] font-medium text-zinc-600 text-center">
                      {previewParity === 'odd' ? '3' : '2'}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="mt-4 text-center text-[11px] text-zinc-400">
              {activeTab === 'kdp-pdf' ? (
                <span>
                  Amazon KDP Paperback: <strong>DIN A5 (148 × 210 mm)</strong>
                  {kdpConfig.bleed === 'kdp-standard' && ' + Spad 3.2 mm'}
                </span>
              ) : activeTab === 'epub' ? (
                <span>
                  Standard: <strong>IDPF EPUB 3.0</strong> (Kindle KDP / E-readers)
                </span>
              ) : (
                <span>
                  Microsoft Word: <strong>DIN A5 (148 × 210 mm)</strong> | Gotowy do zapisu jako PDF KDP
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Footer with Action Buttons */}
        <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-900/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-zinc-400 flex items-center gap-2">
            {isExtracting ? (
              <div className="flex flex-col gap-1">
                <span className="flex items-center gap-2 text-amber-400 font-medium text-xs">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400 shrink-0" />
                  <span>
                    Analiza i filtrowanie stron: {extractProgress.current} z {extractProgress.total || '?'}
                    {extractProgress.total > 0 ? ` (${Math.round((extractProgress.current / extractProgress.total) * 100)}%)` : ''}
                  </span>
                </span>
                {extractProgress.total > 0 && (
                  <div className="w-48 bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-amber-500 h-full rounded-full transition-all duration-100"
                      style={{ width: `${Math.min(100, Math.round((extractProgress.current / extractProgress.total) * 100))}%` }}
                    />
                  </div>
                )}
              </div>
            ) : isExporting ? (
              <div className="flex flex-col gap-1">
                <span className="flex items-center gap-2 text-blue-400 font-medium text-xs">
                  <div className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />
                  <span>
                    {exportProgress.stage || 'Przetwarzanie dokumentu...'}
                    {exportProgress.total > 0 ? ` (${exportProgress.current} z ${exportProgress.total})` : ''}
                  </span>
                </span>
                {exportProgress.total > 0 && (
                  <div className="w-48 bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-blue-500 h-full rounded-full transition-all duration-100"
                      style={{ width: `${Math.min(100, Math.round((exportProgress.current / exportProgress.total) * 100))}%` }}
                    />
                  </div>
                )}
              </div>
            ) : (
              <span className="text-zinc-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> Wszystkie czcionki: 12 pt | Filtry tekstu aktywne
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
                <span>Generuj i Pobierz KDP PDF (A5 12pt)</span>
              </button>
            ) : activeTab === 'epub' ? (
              <button
                onClick={handleExportEpub}
                disabled={isExporting || isExtracting}
                className="flex-1 sm:flex-none px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-lg shadow-indigo-600/30 transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Generuj i Pobierz eBook (ePUB 12pt)</span>
              </button>
            ) : (
              <button
                onClick={handleExportDocx}
                disabled={isExporting || isExtracting}
                className="flex-1 sm:flex-none px-5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-lg shadow-lg shadow-sky-600/30 transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Generuj i Pobierz KDP Word (DOCX A5 12pt)</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
