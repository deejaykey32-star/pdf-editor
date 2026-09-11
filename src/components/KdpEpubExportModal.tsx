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
  Globe,
  Languages,
  Building2,
  ExternalLink,
  Copy,
  Check,
  RotateCcw,
  ArrowRight,
  Search,
  ChevronDown,
  Play,
  Square,
} from 'lucide-react';
import {
  KdpPrintConfig,
  EpubConfig,
  DocxConfig,
  ExtractedBookModel,
  ProviderId,
  SelfPublishingProvider,
  TranslationProgress,
  TranslatedBookRecord,
} from '@/types/kdp-epub';
import { QRCodeItem, PdfDocumentInfo } from '@/types/pdf';
import { extractBookContentFromPdf } from '@/lib/pdf-text-extractor';
import { generateKdpA5PrintPdf } from '@/lib/pdf-typesetter';
import { generateEpubPackage } from '@/lib/epub-generator';
import { generateKdpDocxPackage } from '@/lib/docx-generator';
import {
  SELF_PUBLISHING_PROVIDERS,
  getAllProviders,
  getProviderById,
  applyProviderPreset,
} from '@/lib/self-publishing-providers';
import {
  AVAILABLE_TRANSLATION_LANGUAGES,
  translateBookModel,
} from '@/lib/translation-service';

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
  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<'providers' | 'translation' | 'kdp-pdf' | 'epub' | 'docx'>('providers');

  // Active POD / eBook Provider
  const [selectedProviderId, setSelectedProviderId] = useState<ProviderId>('empik');
  const [providerFilter, setProviderFilter] = useState<'all' | '0-cost' | 'pod' | 'ebook' | 'pl' | 'global'>('all');
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

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

  // KDP / POD Print Configuration
  const [kdpConfig, setKdpConfig] = useState<KdpPrintConfig>({
    bleed: 'kdp-standard',
    bleedMm: 3.0,
    gutterMarginMm: 18,
    outerMarginMm: 14,
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

  // Microsoft Word DOCX Configuration (A5 Print Setup)
  const [docxConfig, setDocxConfig] = useState<DocxConfig>({
    title: documentInfo?.name.replace(/\.pdf$/i, '').replace(/[_-]/g, ' ') || '',
    author: '',
    gutterMarginMm: 18,
    outerMarginMm: 14,
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
  const [rawBookModel, setRawBookModel] = useState<ExtractedBookModel | null>(null);
  const [translatedBookRecord, setTranslatedBookRecord] = useState<TranslatedBookRecord | null>(null);
  const [isTranslatedActive, setIsTranslatedActive] = useState<boolean>(false);
  const [translationHistory, setTranslationHistory] = useState<TranslatedBookRecord[]>([]);

  // Active book model (either original or translated)
  const activeBookModel = useMemo(() => {
    if (isTranslatedActive && translatedBookRecord) {
      return translatedBookRecord.model;
    }
    return rawBookModel;
  }, [isTranslatedActive, translatedBookRecord, rawBookModel]);

  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [extractProgress, setExtractProgress] = useState<{ current: number; total: number }>({
    current: 0,
    total: 0,
  });
  const isExtractingRef = useRef(false);

  // Export State
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<{ current: number; total: number; stage: string }>({
    current: 0,
    total: 0,
    stage: '',
  });

  // Translation State
  const [targetLang, setTargetLang] = useState<string>('en');
  const [langSearch, setLangSearch] = useState<string>('');
  const [translationProgress, setTranslationProgress] = useState<TranslationProgress>({
    status: 'idle',
    currentChapter: 0,
    totalChapters: 0,
    currentParagraph: 0,
    totalParagraphs: 0,
    percent: 0,
    targetLang: 'en',
  });
  const abortControllerRef = useRef<AbortController | null>(null);

  // Preview Page Parity (odd / even toggle in preview)
  const [previewParity, setPreviewParity] = useState<'odd' | 'even'>('odd');

  // Active Provider Object
  const currentProvider = useMemo(() => {
    return getProviderById(selectedProviderId);
  }, [selectedProviderId]);

  // Handler for applying a provider's recommended presets
  const handleSelectProvider = useCallback(
    (provider: SelfPublishingProvider) => {
      setSelectedProviderId(provider.id);
      const { newKdp, newEpub, newDocx } = applyProviderPreset(
        provider,
        kdpConfig,
        epubConfig,
        docxConfig
      );
      setKdpConfig(newKdp);
      setEpubConfig(newEpub);
      setDocxConfig(newDocx);
    },
    [kdpConfig, epubConfig, docxConfig]
  );

  // Filtered Providers List
  const filteredProviders = useMemo(() => {
    return SELF_PUBLISHING_PROVIDERS.filter((p) => {
      if (providerFilter === '0-cost') return p.zeroCostStart;
      if (providerFilter === 'pod') return p.category === 'pod' || p.category === 'hybrid';
      if (providerFilter === 'ebook') return p.category === 'ebook' || p.category === 'hybrid';
      if (providerFilter === 'pl') return ['empik', 'legimi', 'ridero', 'rozpisani', 'universal'].includes(p.id);
      if (providerFilter === 'global') return ['amazon-kdp', 'draft2digital', 'lulu', 'universal'].includes(p.id);
      return true;
    });
  }, [providerFilter]);

  // Filtered Languages
  const filteredLanguages = useMemo(() => {
    if (!langSearch.trim()) return AVAILABLE_TRANSLATION_LANGUAGES;
    const q = langSearch.toLowerCase().trim();
    return AVAILABLE_TRANSLATION_LANGUAGES.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.nativeName.toLowerCase().includes(q) ||
        l.code.toLowerCase().includes(q)
    );
  }, [langSearch]);

  // Text Extraction
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

        setRawBookModel(model);
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

  // Auto-extract on modal open if not yet extracted
  useEffect(() => {
    if (isOpen && (pdfDocProxy || documentInfo?.data) && !rawBookModel && !isExtractingRef.current) {
      runExtraction(excludedPatternsList);
    }
  }, [isOpen, pdfDocProxy, documentInfo, rawBookModel, runExtraction, excludedPatternsList]);

  // Translation Handler
  const handleStartTranslation = async () => {
    if (!rawBookModel) return;

    // Check if we already have this translation in history
    const existing = translationHistory.find((r) => r.languageCode === targetLang);
    if (existing) {
      setTranslatedBookRecord(existing);
      setIsTranslatedActive(true);
      setTranslationProgress({
        status: 'completed',
        currentChapter: existing.model.chapters.length,
        totalChapters: existing.model.chapters.length,
        currentParagraph: existing.model.totalWords,
        totalParagraphs: existing.model.totalWords,
        percent: 100,
        currentTextSample: `Załadowano przetłumaczoną wcześniej wersję (${existing.languageName})`,
        targetLang,
      });
      return;
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const langObj = AVAILABLE_TRANSLATION_LANGUAGES.find((l) => l.code === targetLang);
    const langName = langObj ? `${langObj.flag} ${langObj.name}` : targetLang;

    setTranslationProgress({
      status: 'translating',
      currentChapter: 0,
      totalChapters: rawBookModel.chapters.length,
      currentParagraph: 0,
      totalParagraphs: 100,
      percent: 0,
      currentTextSample: `Rozpoczynam tłumaczenie na język: ${langName}...`,
      targetLang,
    });

    try {
      const translatedModel = await translateBookModel(
        rawBookModel,
        targetLang,
        (progress) => {
          setTranslationProgress(progress);
        },
        abortController.signal
      );

      const newRecord: TranslatedBookRecord = {
        languageCode: targetLang,
        languageName: langName,
        model: translatedModel,
        translatedAt: new Date().toLocaleTimeString(),
      };

      setTranslatedBookRecord(newRecord);
      setTranslationHistory((prev) => [newRecord, ...prev.filter((r) => r.languageCode !== targetLang)]);
      setIsTranslatedActive(true);

      // Auto update configs for new language
      setKdpConfig((prev) => ({
        ...prev,
        bookTitle: translatedModel.title || prev.bookTitle,
        author: translatedModel.author || prev.author,
      }));
      setEpubConfig((prev) => ({
        ...prev,
        title: translatedModel.title || prev.title,
        author: translatedModel.author || prev.author,
        language: targetLang,
      }));
      setDocxConfig((prev) => ({
        ...prev,
        title: translatedModel.title || prev.title,
        author: translatedModel.author || prev.author,
      }));
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        setTranslationProgress((prev) => ({
          ...prev,
          status: 'idle',
          currentTextSample: 'Tłumaczenie zostało zatrzymane przez użytkownika.',
        }));
      } else {
        console.error('Translation error:', err);
        setTranslationProgress((prev) => ({
          ...prev,
          status: 'error',
          error: err?.message || 'Wystąpił błąd podczas tłumaczenia.',
        }));
      }
    } finally {
      abortControllerRef.current = null;
    }
  };

  const handleStopTranslation = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  // Restore original Polish text
  const handleRestoreOriginal = () => {
    setIsTranslatedActive(false);
    if (rawBookModel) {
      setKdpConfig((prev) => ({
        ...prev,
        bookTitle: rawBookModel.title || prev.bookTitle,
        author: rawBookModel.author || prev.author,
      }));
      setEpubConfig((prev) => ({
        ...prev,
        title: rawBookModel.title || prev.title,
        author: rawBookModel.author || prev.author,
        language: 'pl',
      }));
      setDocxConfig((prev) => ({
        ...prev,
        title: rawBookModel.title || prev.title,
        author: rawBookModel.author || prev.author,
      }));
    }
  };

  // Handlers for Exports
  const handleExportKdpPdf = async () => {
    if (!activeBookModel && kdpConfig.mode === 'typeset') return;
    const currentFontSize = kdpConfig.fontSizePt || 12;
    setIsExporting(true);
    setExportProgress({
      current: 0,
      total: 100,
      stage: `Inicjalizacja składu POD dla ${currentProvider.shortName} (format ${currentFontSize} pt)...`,
    });

    try {
      const pdfBytes = await generateKdpA5PrintPdf({
        config: {
          ...kdpConfig,
          fontSizePt: currentFontSize,
          lineHeightPt: kdpConfig.lineHeightPt || Math.round(currentFontSize * 1.333 * 10) / 10,
          excludedPatterns: excludedPatternsList,
        },
        bookModel: activeBookModel || {
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
      const langTag = isTranslatedActive && activeBookModel?.language ? `_${activeBookModel.language.toUpperCase()}` : '';
      const providerTag = `_${currentProvider.shortName.replace(/\s+/g, '_')}`;
      const suffix = kdpConfig.bleed === 'kdp-standard'
        ? `${providerTag}_A5_Bleed_${currentFontSize}pt_Print`
        : `${providerTag}_A5_${currentFontSize}pt_Print`;
      a.download = `${cleanName}${langTag}${suffix}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err: any) {
      console.error('POD Export Error:', err);
      alert('Wystąpił błąd podczas eksportu PDF do druku: ' + (err?.message || err));
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportEpub = async () => {
    if (!activeBookModel) return;
    const currentFontSize = epubConfig.fontSizePt || 12;
    setIsExporting(true);
    setExportProgress({
      current: 0,
      total: 100,
      stage: `Generowanie pakietu ePUB 3.0 dla ${currentProvider.shortName} (format ${currentFontSize} pt)...`,
    });

    try {
      const epubBytes = await generateEpubPackage({
        config: {
          ...epubConfig,
          fontSizePt: currentFontSize,
          language: isTranslatedActive && activeBookModel?.language ? activeBookModel.language : epubConfig.language,
          excludedPatterns: excludedPatternsList,
        },
        bookModel: activeBookModel,
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
      const langTag = isTranslatedActive && activeBookModel?.language ? `_${activeBookModel.language.toUpperCase()}` : '';
      a.download = `${cleanName}${langTag}_${currentProvider.shortName.replace(/\s+/g, '_')}_eBook_${currentFontSize}pt.epub`;
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
    if (!activeBookModel) return;
    const currentFontSize = docxConfig.fontSizePt || 12;
    setIsExporting(true);
    setExportProgress({
      current: 0,
      total: 100,
      stage: `Generowanie pliku Word (.docx) dla ${currentProvider.shortName} (${currentFontSize} pt)...`,
    });

    try {
      const docxBytes = await generateKdpDocxPackage({
        config: {
          ...docxConfig,
          fontSizePt: currentFontSize,
          excludedPatterns: excludedPatternsList,
        },
        bookModel: activeBookModel,
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
      const langTag = isTranslatedActive && activeBookModel?.language ? `_${activeBookModel.language.toUpperCase()}` : '';
      a.download = `${cleanName}${langTag}_${currentProvider.shortName.replace(/\s+/g, '_')}_A5_${currentFontSize}pt.docx`;
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[94vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 via-indigo-600 to-amber-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-semibold text-white">
                  Studio Wydawnicze POD (0 zł na start) & Tłumacz z PDF
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full">
                  0 zł na start • Empik • Legimi • KDP • Ridero
                </span>
                {isTranslatedActive && (
                  <span className="px-2 py-0.5 text-[10px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-full flex items-center gap-1">
                    <Globe className="w-3 h-3 text-blue-400" />
                    Przetłumaczono: {translatedBookRecord?.languageName}
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400">
                Wybierz darmowego usługodawcę druku na żądanie i dystrybucji e-booków lub przetłumacz całą treść z załączonego pliku PDF na dowolny język.
              </p>
            </div>
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Persistent Active Provider & Language Quick-Action Bar */}
        <div className="px-6 py-2.5 bg-zinc-900/90 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-zinc-400 flex items-center gap-1.5 font-medium">
              <Building2 className="w-3.5 h-3.5 text-amber-400" />
              Aktywny Wydawca:
            </span>

            {/* Provider quick switcher */}
            <div className="relative inline-flex items-center">
              <select
                value={selectedProviderId}
                onChange={(e) => {
                  const p = getProviderById(e.target.value as ProviderId);
                  handleSelectProvider(p);
                }}
                className="bg-zinc-800 border border-zinc-700 text-white font-semibold text-xs rounded px-2.5 py-1 focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                {SELF_PUBLISHING_PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.zeroCostStart ? '0 zł na start' : 'POD'})
                  </option>
                ))}
              </select>
            </div>

            <span className="text-[11px] text-zinc-400 hidden sm:inline-block">
              {currentProvider.isbnPolicy.includes('Darmowy') ? '• Darmowy ISBN: TAK' : ''} • Format: DIN A5 / ePUB
            </span>

            <button
              onClick={() => handleSelectProvider(currentProvider)}
              className="text-[10px] bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded transition cursor-pointer flex items-center gap-1"
              title="Zastosuj rekomendowane spady i marginesy tego dostawcy"
            >
              <CheckCircle2 className="w-3 h-3 text-amber-400" />
              <span>Zastosuj preset</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {isTranslatedActive ? (
              <div className="flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded text-blue-300 text-[11px]">
                <span>Język publikacji: <strong>{translatedBookRecord?.languageName}</strong></span>
                <button
                  onClick={handleRestoreOriginal}
                  className="ml-1 text-zinc-400 hover:text-white underline text-[10px] cursor-pointer flex items-center gap-0.5"
                  title="Przywróć tekst w języku polskim z PDF"
                >
                  <RotateCcw className="w-2.5 h-2.5" /> Przywróć oryginał (PL)
                </button>
              </div>
            ) : (
              <button
                onClick={() => setActiveTab('translation')}
                className="text-xs text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 px-2.5 py-1 rounded transition cursor-pointer flex items-center gap-1.5"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Przetłumacz na inny język →</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 border-b border-zinc-800 bg-zinc-900/40 flex items-center justify-between overflow-x-auto">
          <div className="flex gap-1 sm:gap-2">
            <button
              onClick={() => setActiveTab('providers')}
              className={`py-3 px-3 text-xs font-medium border-b-2 flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
                activeTab === 'providers'
                  ? 'border-amber-500 text-amber-400 font-semibold'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Building2 className="w-4 h-4" />
              <span>Dostawcy POD & eBook (0 zł)</span>
            </button>

            <button
              onClick={() => setActiveTab('translation')}
              className={`py-3 px-3 text-xs font-medium border-b-2 flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
                activeTab === 'translation'
                  ? 'border-blue-500 text-blue-400 font-semibold'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Globe className="w-4 h-4" />
              <span>Tłumacz z PDF (Wszystkie Języki)</span>
            </button>

            <button
              onClick={() => setActiveTab('kdp-pdf')}
              className={`py-3 px-3 text-xs font-medium border-b-2 flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
                activeTab === 'kdp-pdf'
                  ? 'border-emerald-500 text-emerald-400 font-semibold'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Printer className="w-4 h-4" />
              <span>Druk POD (PDF A5)</span>
            </button>

            <button
              onClick={() => setActiveTab('epub')}
              className={`py-3 px-3 text-xs font-medium border-b-2 flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
                activeTab === 'epub'
                  ? 'border-indigo-500 text-indigo-400 font-semibold'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Tablet className="w-4 h-4" />
              <span>eBook (ePUB 3.0 Legimi/Empik)</span>
            </button>

            <button
              onClick={() => setActiveTab('docx')}
              className={`py-3 px-3 text-xs font-medium border-b-2 flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
                activeTab === 'docx'
                  ? 'border-sky-500 text-sky-400 font-semibold'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Dokument Word (DOCX A5)</span>
            </button>
          </div>

          {activeBookModel && (
            <div className="text-[11px] text-zinc-400 hidden xl:flex items-center gap-3 shrink-0">
              <span>Rozdziały: <strong className="text-zinc-200">{activeBookModel.chapters.length}</strong></span>
              <span>Słowa: <strong className="text-zinc-200">{activeBookModel.totalWords.toLocaleString()}</strong></span>
              <span>Strony PDF: <strong className="text-zinc-200">{activeBookModel.sourcePageCount}</strong></span>
            </div>
          )}
        </div>

        {/* Main Body */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT COLUMN: Main Config Panel (7 cols) */}
          <div className="lg:col-span-7 space-y-5">
            {/* TAB 1: PROVIDERS SELECTION & COMPARISON */}
            {activeTab === 'providers' && (
              <div className="space-y-4">
                {/* Intro Card */}
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                    <h3 className="text-sm font-semibold text-amber-300 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      Wybór Usługodawcy POD & eBook (0 zł na start)
                    </h3>
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 font-mono px-2 py-0.5 rounded border border-amber-500/30">
                      Zero opłat wstępnych • Prowizja od sprzedaży
                    </span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    Wybierz preferowanego dostawcę druku na żądanie (POD) lub dystrybutora e-booków. Wszystkie poniższe platformy umożliwiają rozpoczęcie publikacji <strong>w 100% za darmo</strong> (0 zł). Kliknij <em>„Wybierz i zastosuj parametry”</em>, aby automatycznie dostosować formaty PDF i ePUB do wymagań danego wydawcy.
                  </p>

                  {/* Filter chips */}
                  <div className="flex items-center gap-1.5 flex-wrap mt-3 pt-3 border-t border-amber-500/20 text-xs">
                    <span className="text-[11px] text-zinc-400 mr-1">Filtruj:</span>
                    {[
                      { id: 'all', label: 'Wszyscy dostawcy' },
                      { id: '0-cost', label: '100% Darmowy start (0 zł)' },
                      { id: 'pod', label: 'Druk na żądanie (POD)' },
                      { id: 'ebook', label: 'Tylko eBooki (Legimi itp.)' },
                      { id: 'pl', label: 'Rynek Polski' },
                      { id: 'global', label: 'Globalny (Amazon, Apple)' },
                    ].map((btn) => (
                      <button
                        key={btn.id}
                        onClick={() => setProviderFilter(btn.id as any)}
                        className={`px-2.5 py-1 rounded text-[11px] font-medium transition cursor-pointer ${
                          providerFilter === btn.id
                            ? 'bg-amber-500 text-zinc-950 font-bold'
                            : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                        }`}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Provider Cards Grid */}
                <div className="space-y-3">
                  {filteredProviders.map((provider) => {
                    const isSelected = selectedProviderId === provider.id;
                    return (
                      <div
                        key={provider.id}
                        className={`border rounded-xl p-4 transition-all duration-200 ${
                          isSelected
                            ? 'bg-zinc-900 border-amber-500/60 shadow-lg shadow-amber-500/5 ring-1 ring-amber-500/30'
                            : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                                {provider.name}
                              </h4>
                              <span
                                className="px-2 py-0.5 text-[10px] font-semibold rounded-full border"
                                style={{
                                  backgroundColor: `${provider.accentColor}15`,
                                  borderColor: `${provider.accentColor}40`,
                                  color: provider.accentColor,
                                }}
                              >
                                {provider.badge}
                              </span>
                            </div>
                            <p className="text-xs text-zinc-300 mt-1">{provider.description}</p>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleSelectProvider(provider)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                                isSelected
                                  ? 'bg-amber-500 text-zinc-950 font-bold shadow'
                                  : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700 border border-zinc-700'
                              }`}
                            >
                              {isSelected ? (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Wybrany</span>
                                </>
                              ) : (
                                <span>Wybierz dostawcę</span>
                              )}
                            </button>

                            {provider.portalUrl !== '#' && (
                              <a
                                href={provider.portalUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg border border-zinc-700 transition"
                                title={`Otwórz stronę ${provider.name}`}
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            )}
                          </div>
                        </div>

                        {/* Details grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3 pt-3 border-t border-zinc-800/80 text-[11px]">
                          <div className="space-y-1">
                            <div className="text-zinc-400">
                              <strong className="text-zinc-200">Koszt na start:</strong> {provider.zeroCostDetails}
                            </div>
                            <div className="text-zinc-400">
                              <strong className="text-zinc-200">Numer ISBN:</strong> {provider.isbnPolicy}
                            </div>
                          </div>
                          <div className="space-y-1">
                            <div className="text-zinc-400">
                              <strong className="text-zinc-200">Zarobki / Tantiemy:</strong> {provider.royaltiesInfo}
                            </div>
                            <div className="flex items-center gap-1.5 pt-1">
                              <strong className="text-zinc-200">Formaty:</strong>
                              {provider.supportedFormats.map((f) => (
                                <span
                                  key={f}
                                  className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-[10px] text-zinc-300 font-mono"
                                >
                                  {f}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Guide steps dropdown preview */}
                        <div className="mt-2.5 pt-2 border-t border-zinc-800/50">
                          <details className="text-[11px] text-zinc-400 cursor-pointer">
                            <summary className="hover:text-zinc-200 font-medium text-amber-400/90 flex items-center gap-1">
                              <span>Instrukcja krok po kroku: Jak wydać za 0 zł w {provider.shortName}</span>
                            </summary>
                            <ol className="list-decimal list-inside space-y-1 pl-2 pt-2 text-zinc-300">
                              {provider.guideSteps.map((step, idx) => (
                                <li key={idx}>{step}</li>
                              ))}
                            </ol>
                          </details>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 2: MULTI-LANGUAGE TRANSLATION FROM PDF */}
            {activeTab === 'translation' && (
              <div className="space-y-4">
                {/* Translation Info Banner */}
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h3 className="text-sm font-semibold text-blue-300 flex items-center gap-2">
                      <Globe className="w-4 h-4 text-blue-400" />
                      Wielojęzyczne Tłumaczenie Publikacji z Załączonego PDF
                    </h3>
                    <span className="text-[10px] bg-blue-500/20 text-blue-300 font-mono px-2 py-0.5 rounded border border-blue-500/30">
                      36 języków świata • Batching akapitów
                    </span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    Aplikacja automatycznie wyodrębnia strukturę tytułów, rozdziałów i akapitów z załączonego pliku PDF, a następnie tłumaczy ją na wybrany język bez utraty formatowania, nagłówków i podziału na strony.
                  </p>

                  {/* Document stats */}
                  {rawBookModel && (
                    <div className="bg-zinc-900/80 p-2.5 rounded-lg border border-zinc-800 flex items-center justify-between text-xs flex-wrap gap-2">
                      <div className="text-zinc-300">
                        Źródło: <strong className="text-white">{rawBookModel.title || 'Załączony PDF'}</strong>
                      </div>
                      <div className="flex items-center gap-3 text-zinc-400 text-[11px]">
                        <span>Rozdziały: <strong className="text-zinc-200">{rawBookModel.chapters.length}</strong></span>
                        <span>Słowa: <strong className="text-zinc-200">{rawBookModel.totalWords.toLocaleString()}</strong></span>
                        <span>Strony: <strong className="text-zinc-200">{rawBookModel.sourcePageCount}</strong></span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Target Language Selection Box */}
                <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 space-y-3">
                  <label className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                    <Languages className="w-3.5 h-3.5 text-blue-400" />
                    Wybierz Język Docelowy Tłumaczenia:
                  </label>

                  {/* Quick language chips */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[
                      { code: 'en', label: '🇬🇧 Angielski (EN)' },
                      { code: 'de', label: '🇩🇪 Niemiecki (DE)' },
                      { code: 'es', label: '🇪🇸 Hiszpański (ES)' },
                      { code: 'fr', label: '🇫🇷 Francuski (FR)' },
                      { code: 'it', label: '🇮🇹 Włoski (IT)' },
                      { code: 'uk', label: '🇺🇦 Ukraiński (UK)' },
                      { code: 'cs', label: '🇨🇿 Czeski (CS)' },
                      { code: 'pt', label: '🇵🇹 Portugalski (PT)' },
                      { code: 'zh-CN', label: '🇨🇳 Chiński (ZH)' },
                      { code: 'ja', label: '🇯🇵 Japoński (JA)' },
                    ].map((quick) => (
                      <button
                        key={quick.code}
                        type="button"
                        onClick={() => setTargetLang(quick.code)}
                        className={`px-2.5 py-1 rounded text-xs transition cursor-pointer font-medium ${
                          targetLang === quick.code
                            ? 'bg-blue-600 text-white font-bold shadow'
                            : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700'
                        }`}
                      >
                        {quick.label}
                      </button>
                    ))}
                  </div>

                  {/* Search and full dropdown */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        placeholder="Szukaj spośród 36 języków..."
                        value={langSearch}
                        onChange={(e) => setLangSearch(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <select
                      value={targetLang}
                      onChange={(e) => setTargetLang(e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white font-medium focus:outline-none focus:border-blue-500 cursor-pointer"
                    >
                      {filteredLanguages.map((lang) => (
                        <option key={lang.code} value={lang.code}>
                          {lang.flag} {lang.name} ({lang.nativeName}) — [{lang.code}]
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Primary Translate Trigger Button */}
                  <div className="pt-2 flex items-center gap-3">
                    {translationProgress.status === 'translating' ? (
                      <button
                        type="button"
                        onClick={handleStopTranslation}
                        className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-lg shadow transition cursor-pointer flex items-center gap-1.5"
                      >
                        <Square className="w-3.5 h-3.5" />
                        <span>Zatrzymaj tłumaczenie</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={handleStartTranslation}
                        disabled={!rawBookModel}
                        className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-semibold rounded-lg shadow-lg shadow-blue-500/20 transition cursor-pointer flex items-center gap-2 disabled:opacity-50"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Rozpocznij tłumaczenie na {AVAILABLE_TRANSLATION_LANGUAGES.find((l) => l.code === targetLang)?.name}</span>
                      </button>
                    )}

                    {isTranslatedActive && (
                      <button
                        type="button"
                        onClick={handleRestoreOriginal}
                        className="px-3 py-2 text-xs text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg border border-zinc-700 transition cursor-pointer flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Przywróć polski oryginał</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Live Translation Progress Card */}
                {translationProgress.status === 'translating' && (
                  <div className="bg-blue-500/5 border border-blue-500/30 rounded-xl p-4 space-y-3 animate-in fade-in">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-blue-300 flex items-center gap-2">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-400" />
                        Trwa tłumaczenie treści książki...
                      </span>
                      <span className="font-mono text-blue-400 font-bold">{translationProgress.percent}%</span>
                    </div>

                    <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full transition-all duration-150"
                        style={{ width: `${translationProgress.percent}%` }}
                      />
                    </div>

                    {translationProgress.currentTextSample && (
                      <p className="text-[11px] text-zinc-400 font-mono truncate bg-zinc-900/80 p-2 rounded border border-zinc-800">
                        {translationProgress.currentTextSample}
                      </p>
                    )}
                  </div>
                )}

                {/* Translation Success Card & Applied Status */}
                {translatedBookRecord && (
                  <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <h4 className="text-xs font-bold text-emerald-300">
                          Przetłumaczona wersja: {translatedBookRecord.languageName}
                        </h4>
                      </div>
                      <span className="text-[10px] text-zinc-400 font-mono">
                        Gotowa o {translatedBookRecord.translatedAt}
                      </span>
                    </div>

                    <div className="bg-zinc-900/80 rounded-lg p-3 border border-zinc-800 text-xs space-y-2">
                      <div>
                        <span className="text-zinc-400">Przetłumaczony tytuł: </span>
                        <strong className="text-white">{translatedBookRecord.model.title}</strong>
                      </div>
                      <div className="text-zinc-400">
                        Rozdziały: <strong className="text-zinc-200">{translatedBookRecord.model.chapters.length}</strong> | 
                        Słowa: <strong className="text-zinc-200">{translatedBookRecord.model.totalWords.toLocaleString()}</strong>
                      </div>
                    </div>

                    {/* Quick export translated buttons */}
                    <div className="flex items-center gap-2 flex-wrap pt-1">
                      <button
                        onClick={handleExportKdpPdf}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium flex items-center gap-1.5 shadow cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Pobierz przetłumaczony PDF (A5)</span>
                      </button>
                      <button
                        onClick={handleExportEpub}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-medium flex items-center gap-1.5 shadow cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Pobierz przetłumaczony ePUB</span>
                      </button>
                      <button
                        onClick={handleExportDocx}
                        className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded text-xs font-medium flex items-center gap-1.5 shadow cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Pobierz przetłumaczony Word</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: KDP / POD PRINT PDF SETTINGS */}
            {activeTab === 'kdp-pdf' && (
              <>
                {/* Exclusion Filter Box */}
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
                      className="text-[10px] text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 px-2 py-0.5 rounded border border-zinc-700 flex items-center gap-1 transition cursor-pointer"
                      title="Przelicz i zastosuj filtry do tekstu"
                    >
                      <RefreshCw className={`w-3 h-3 ${isExtracting ? 'animate-spin' : ''}`} />
                      <span>Zastosuj filtry</span>
                    </button>
                  </div>

                  <textarea
                    rows={2}
                    value={excludedPhrasesText}
                    onChange={(e) => setExcludedPhrasesText(e.target.value)}
                    placeholder="Wpisz frazy do usunięcia (każda w nowej linii)..."
                    className="w-full bg-zinc-900 border border-zinc-800 rounded p-2 text-xs text-zinc-200 font-mono resize-none focus:outline-none focus:border-red-500/50"
                  />
                </div>

                {/* 1. Spady (Bleed) Box */}
                <div className="bg-zinc-900/70 border border-zinc-800 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                      <Maximize2 className="w-3.5 h-3.5 text-blue-400" />
                      Ustawienia Spadów Drukarskich ({currentProvider.shortName})
                    </label>
                    <span className="text-[10px] text-blue-400 font-mono">
                      {kdpConfig.bleed === 'kdp-standard' ? `+${kdpConfig.bleedMm || 3.0} mm spadów` : '148.0 × 210.0 mm (A5 netto)'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setKdpConfig((prev) => ({ ...prev, bleed: 'kdp-standard' }))}
                      className={`p-2.5 rounded-lg border text-left transition text-xs cursor-pointer ${
                        kdpConfig.bleed === 'kdp-standard'
                          ? 'border-blue-500 bg-blue-500/10 text-white'
                          : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      <div className="font-medium flex items-center justify-between">
                        <span>Ze spadami (+{kdpConfig.bleedMm || 3.0} mm)</span>
                        {kdpConfig.bleed === 'kdp-standard' && <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />}
                      </div>
                      <p className="text-[10px] text-zinc-400 mt-1">
                        Zalecane dla {currentProvider.shortName} z tłami do krawędzi.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setKdpConfig((prev) => ({ ...prev, bleed: 'none' }))}
                      className={`p-2.5 rounded-lg border text-left transition text-xs cursor-pointer ${
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
                      Marginesy Introligatorskie (Gutter / Grzbiet)
                    </label>
                    <span className="text-[10px] text-amber-400 font-mono">
                      Strony lustrzane (Recto / Verso)
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-zinc-300">
                      <span>Margines grzbietu (Gutter): <strong>{kdpConfig.gutterMarginMm} mm</strong></span>
                      <span className="text-[11px] text-zinc-500">
                        Preset dostawcy: {currentProvider.recommendedGutterMm} mm
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

                {/* 3. Typografia & Formatowanie tekstu */}
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
                  </div>
                </div>
              </>
            )}

            {/* TAB 4: ePUB 3.0 SETTINGS */}
            {activeTab === 'epub' && (
              <>
                <div className="bg-zinc-900/70 border border-zinc-800 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-zinc-200 block">
                      Metadane i Format Cyfrowy ({currentProvider.shortName})
                    </label>
                    <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded border border-indigo-500/20 font-semibold">
                      IDPF EPUB 3.0 Reflowable
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="text-[11px] text-zinc-400 block mb-1">Tytuł e-booka</label>
                      <input
                        type="text"
                        value={epubConfig.title}
                        onChange={(e) => setEpubConfig((prev) => ({ ...prev, title: e.target.value }))}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-xs text-white font-medium"
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
                        <label className="text-[11px] text-zinc-400 block mb-1">Język ePUB</label>
                        <select
                          value={epubConfig.language}
                          onChange={(e) => setEpubConfig((prev) => ({ ...prev, language: e.target.value }))}
                          className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-xs text-white font-medium cursor-pointer"
                        >
                          {AVAILABLE_TRANSLATION_LANGUAGES.map((l) => (
                            <option key={l.code} value={l.code}>
                              {l.flag} {l.name} ({l.code})
                            </option>
                          ))}
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

                  <div className="space-y-2 pt-1">
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
              </>
            )}

            {/* TAB 5: MICROSOFT WORD DOCX SETTINGS */}
            {activeTab === 'docx' && (
              <>
                <div className="bg-sky-500/10 border border-sky-500/20 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-sky-300">
                    <FileText className="w-4 h-4 text-sky-400" />
                    <span>Format Microsoft Word (.docx) dla {currentProvider.shortName}</span>
                  </div>
                  <p className="text-[11px] text-zinc-300 leading-relaxed">
                    Wygenerowany plik <strong className="text-white">.docx</strong> posiada zdefiniowany format <strong>DIN A5 (148 × 210 mm)</strong>, 
                    <strong> lustrzane marginesy introligatorskie</strong> oraz podział stron przed rozdziałami. 
                    Po otwarciu w aplikacji Word wystarczy wybrać <em>„Plik → Zapisz jako PDF”</em>, aby uzyskać w 100% gotowy do druku plik PDF.
                  </p>
                </div>

                <div className="bg-zinc-900/70 border border-zinc-800 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-amber-400" />
                      Lustrzane Marginesy Introligatorskie Word
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
                          onChange={(e) => setDocxConfig((prev) => ({ ...prev, outerMarginMm: parseInt(e.target.value) || 14 }))}
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
              </>
            )}
          </div>

          {/* RIGHT COLUMN: Live Interactive Visual Preview (5 cols) */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center bg-zinc-900/40 border border-zinc-800 rounded-xl p-5">
            <div className="w-full flex items-center justify-between mb-3 text-xs">
              <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                {activeTab === 'providers'
                  ? `Profil: ${currentProvider.shortName}`
                  : activeTab === 'translation'
                  ? 'Podgląd Tłumaczenia Tekstu'
                  : activeTab === 'kdp-pdf'
                  ? 'Podgląd Strony A5 POD'
                  : activeTab === 'epub'
                  ? 'Podgląd Czytnika ePUB'
                  : 'Podgląd Strony Word A5'}
              </span>

              {(activeTab === 'kdp-pdf' || activeTab === 'docx' || activeTab === 'providers') && (
                <div className="flex items-center gap-1 bg-zinc-800 p-0.5 rounded text-[10px]">
                  <button
                    onClick={() => setPreviewParity('odd')}
                    className={`px-2 py-0.5 rounded font-medium transition cursor-pointer ${
                      previewParity === 'odd' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Recto (Prawa)
                  </button>
                  <button
                    onClick={() => setPreviewParity('even')}
                    className={`px-2 py-0.5 rounded font-medium transition cursor-pointer ${
                      previewParity === 'even' ? 'bg-blue-600 text-white' : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Verso (Lewa)
                  </button>
                </div>
              )}
            </div>

            {/* In Providers Tab: Show Provider Profile Snapshot */}
            {activeTab === 'providers' ? (
              <div className="w-full bg-zinc-900/90 rounded-xl p-5 border border-amber-500/30 text-xs space-y-4 shadow-xl">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                  <div>
                    <h3 className="font-bold text-base text-white">{currentProvider.name}</h3>
                    <p className="text-[11px] text-amber-400">{currentProvider.badge}</p>
                  </div>
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm text-white"
                    style={{ backgroundColor: currentProvider.accentColor }}
                  >
                    {currentProvider.shortName.slice(0, 2).toUpperCase()}
                  </div>
                </div>

                <div className="space-y-2 text-[11px]">
                  <div>
                    <span className="text-zinc-400">Koszt rejestracji i publikacji:</span>
                    <div className="font-semibold text-emerald-400">0 zł (brak opłat wstępnych)</div>
                  </div>
                  <div>
                    <span className="text-zinc-400">Darmowy numer ISBN:</span>
                    <div className="font-semibold text-white">{currentProvider.isbnPolicy}</div>
                  </div>
                  <div>
                    <span className="text-zinc-400">Główne kanały sprzedaży:</span>
                    <ul className="list-disc list-inside text-zinc-300 pt-1 space-y-0.5">
                      {currentProvider.distributionChannels.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <span className="text-zinc-400">Wymagania techniczne formatu:</span>
                    <div className="text-zinc-300">
                      DIN A5 (148 × 210 mm) {currentProvider.hasBleed ? `+ spad ${currentProvider.bleedRequirementMm} mm` : ''} • Grzbiet {currentProvider.recommendedGutterMm} mm
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-zinc-800 flex items-center gap-2">
                  <button
                    onClick={() => handleSelectProvider(currentProvider)}
                    className="flex-1 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Zastosuj preset dla {currentProvider.shortName}</span>
                  </button>
                </div>
              </div>
            ) : activeTab === 'translation' ? (
              /* Translation Preview */
              <div className="w-full bg-zinc-900/90 rounded-xl p-4 border border-blue-500/30 text-xs space-y-3 shadow-xl max-h-[460px] overflow-y-auto">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                  <span className="font-bold text-blue-300">Porównanie Tekstu (Oryginał ⟷ Tłumaczenie)</span>
                  <span className="text-[10px] text-zinc-400 font-mono">
                    {activeBookModel?.chapters[0]?.paragraphs?.length || 0} akap.
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="bg-zinc-950 p-2.5 rounded border border-zinc-800">
                    <span className="text-[10px] text-zinc-500 uppercase font-bold block mb-1">
                      Oryginał z PDF (Polski)
                    </span>
                    <p className="text-zinc-300 text-[11px] leading-relaxed line-clamp-4">
                      {rawBookModel?.chapters[0]?.paragraphs[0]?.text || 'Brak wyekstrahowanego tekstu.'}
                    </p>
                  </div>

                  <div className="bg-blue-950/40 p-2.5 rounded border border-blue-800/40">
                    <span className="text-[10px] text-blue-400 uppercase font-bold block mb-1">
                      Przetłumaczony Tekst ({translatedBookRecord ? translatedBookRecord.languageName : targetLang})
                    </span>
                    <p className="text-blue-200 text-[11px] leading-relaxed line-clamp-4">
                      {translatedBookRecord?.model?.chapters[0]?.paragraphs[0]?.text ||
                        'Kliknij „Rozpocznij tłumaczenie”, aby przetłumaczyć całą książkę.'}
                    </p>
                  </div>
                </div>

                {translatedBookRecord && (
                  <div className="pt-2 border-t border-zinc-800 flex items-center justify-between text-[11px] text-emerald-400 font-medium">
                    <span className="flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      Tłumaczenie aktywne w podglądzie
                    </span>
                    <button
                      onClick={handleRestoreOriginal}
                      className="text-zinc-400 hover:text-white underline text-[10px] cursor-pointer"
                    >
                      Cofnij
                    </button>
                  </div>
                )}
              </div>
            ) : activeTab === 'kdp-pdf' ? (
              /* A5 KDP Visual Sheet Preview */
              <div className="relative w-full aspect-[148/210] max-w-[280px] bg-white rounded shadow-2xl overflow-hidden border border-zinc-700 select-none text-zinc-900 flex flex-col justify-between">
                {/* Bleed Guideline */}
                {kdpConfig.bleed === 'kdp-standard' && (
                  <div className="absolute inset-1.5 border border-dashed border-red-400/50 pointer-events-none z-10">
                    <span className="absolute top-0.5 right-1 text-[7px] text-red-500 font-mono font-semibold">
                      Spad {kdpConfig.bleedMm || 3.0} mm
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
                        {previewParity === 'odd' ? (activeBookModel?.chapters[0]?.title || '') : (kdpConfig.bookTitle || activeBookModel?.chapters[0]?.title || '')}
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
                      {activeBookModel?.chapters[0]?.title || 'Wstęp'}
                    </div>
                    {activeBookModel?.chapters[0]?.paragraphs?.filter((p) => !p.isHeading).length ? (
                      activeBookModel.chapters[0].paragraphs
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
                          Tekst i nagłówki są w formacie <strong>{kdpConfig.fontSizePt || 12} pt</strong>. Układ kolumny tekstu posiada matematyczną ochronę marginesów.
                        </p>
                        <p className="text-zinc-800 indent-2">
                          Niepożądane fragmenty stopek i nagłówków zostały automatycznie wycięte ze źródła.
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
                    {activeBookModel?.chapters[0]?.title || 'Wstęp'}
                  </h2>
                  {activeBookModel?.chapters[0]?.paragraphs?.filter((p) => !p.isHeading).length ? (
                    activeBookModel.chapters[0].paragraphs
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
                        Treść oraz nagłówki zostały sformatowane w wybranym formacie <strong>{epubConfig.fontSizePt || 12} pt</strong> z pełnym wyjustowaniem.
                      </p>
                      <p className="indent-2 text-zinc-800">
                        Tekst dopasowuje się do ekranu bez wychodzenia poza marginesy czytnika Legimi i Kindle.
                      </p>
                    </>
                  )}
                </div>

                <div className="flex justify-between items-center text-[7.5px] text-zinc-400 pt-2 border-t border-zinc-200">
                  <span>Rozdział 1 z {activeBookModel?.chapters.length || 1}</span>
                  <span>{epubConfig.fontSizePt || 12} pt Justify</span>
                </div>
              </div>
            ) : (
              /* Word DOCX Visual Sheet Preview */
              <div className="relative w-full aspect-[148/210] max-w-[280px] bg-white rounded shadow-2xl overflow-hidden border border-sky-600/40 select-none text-zinc-900 flex flex-col justify-between">
                <div className="h-1.5 bg-gradient-to-r from-sky-600 to-blue-700 w-full" />

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
                  {docxConfig.runningHeader && (
                    <div className="pb-1 mb-2 border-b border-zinc-200 flex items-center justify-between text-[7.5px] text-zinc-500">
                      <span className="truncate max-w-[140px] italic">
                        {previewParity === 'odd' ? (activeBookModel?.chapters[0]?.title || '') : (docxConfig.title || 'Publikacja A5')}
                      </span>
                      <span className="font-mono text-zinc-400">{previewParity === 'odd' ? 'Recto' : 'Verso'}</span>
                    </div>
                  )}

                  <div
                    className="space-y-1.5 text-justify"
                    style={{
                      fontSize: `${Math.max(6, Math.min(14, ((docxConfig.fontSizePt || 12) / 12) * 8))}px`,
                      lineHeight: '1.35',
                      fontFamily: docxConfig.fontFamily === 'times' ? 'Times New Roman, serif' : 'Georgia, serif',
                    }}
                  >
                    <div className="font-bold text-zinc-900 mb-1 text-left border-b-2 border-blue-600 pb-0.5" style={{ fontSize: `${Math.max(6.5, Math.min(15, ((docxConfig.fontSizePt || 12) / 12) * 8.5))}px` }}>
                      {activeBookModel?.chapters[0]?.title || 'Wprowadzenie'}
                    </div>
                    {activeBookModel?.chapters[0]?.paragraphs?.filter((p) => !p.isHeading).length ? (
                      activeBookModel.chapters[0].paragraphs
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
                          Dokument Word został skonfigurowany w formacie <strong>DIN A5</strong> ze standardową czcionką <strong>{docxConfig.fontSizePt || 12} pt</strong>.
                        </p>
                      </>
                    )}
                  </div>

                  {docxConfig.pageNumbers && (
                    <div className="pt-2 text-[8px] font-medium text-zinc-600 text-center">
                      {previewParity === 'odd' ? '3' : '2'}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="mt-4 text-center text-[11px] text-zinc-400">
              <span>
                Aktywny dostawca: <strong>{currentProvider.name}</strong> • 
                Język: <strong>{isTranslatedActive ? translatedBookRecord?.languageName : 'Polski (Oryginał)'}</strong>
              </span>
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
                    Analiza stron PDF: {extractProgress.current} z {extractProgress.total || '?'}
                  </span>
                </span>
              </div>
            ) : isExporting ? (
              <div className="flex flex-col gap-1">
                <span className="flex items-center gap-2 text-blue-400 font-medium text-xs">
                  <div className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin shrink-0" />
                  <span>{exportProgress.stage || 'Przetwarzanie dokumentu...'}</span>
                </span>
              </div>
            ) : (
              <span className="text-zinc-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                {currentProvider.shortName} (0 zł na start) • {isTranslatedActive ? `Wersja przetłumaczona (${translatedBookRecord?.languageName})` : 'Wersja źródłowa (PL)'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap">
            <button
              onClick={onClose}
              disabled={isExporting}
              className="px-4 py-2 text-xs font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg transition cursor-pointer"
            >
              Zamknij
            </button>

            {/* Universal quick exports */}
            <button
              onClick={handleExportKdpPdf}
              disabled={isExporting || isExtracting}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-md shadow-blue-600/20 transition flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
              title="Generuj i pobierz PDF A5 gotowy do druku"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Pobierz Druk A5 (PDF)</span>
            </button>

            <button
              onClick={handleExportEpub}
              disabled={isExporting || isExtracting}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-md shadow-indigo-600/20 transition flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
              title="Generuj i pobierz eBook ePUB 3.0 dla Legimi, Empik Go i Kindle"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Pobierz eBook (ePUB 3.0)</span>
            </button>

            <button
              onClick={handleExportDocx}
              disabled={isExporting || isExtracting}
              className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-lg shadow-md shadow-sky-600/20 transition flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer hidden md:inline-flex"
              title="Generuj i pobierz plik Microsoft Word DOCX"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Word (.docx)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
