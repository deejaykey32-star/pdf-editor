'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  X,
  Globe,
  Languages,
  Download,
  CheckCircle2,
  Sparkles,
  Upload,
  FileImage,
  RefreshCw,
  Eye,
  Sliders,
  Palette,
  Maximize2,
  Layers,
  Check,
  RotateCcw,
  BookOpen,
  FileText,
  Image as ImageIcon,
  Type,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  CoverDimensions,
  CoverFontFamily,
  CoverFormatMode,
  CoverTextLayer,
  CoverThemePreset,
} from '@/types/cover-translator';
import { PdfDocumentInfo } from '@/types/pdf';
import { AVAILABLE_TRANSLATION_LANGUAGES, translateSingleString } from '@/lib/translation-service';
import {
  COVER_THEME_PRESETS,
  getCoverDimensions,
  extractPdfFirstPageAsImage,
  renderCoverToCanvas,
  canvasToBlob,
  blobToUint8Array,
} from '@/lib/cover-canvas-renderer';

export const WIDOKI_NA_RAJ_IMAGE_URL = '/covers/widoki-na-raj.jpg';

/**
 * Exact default text layers matching media_1789119136032.jpg pixel-by-pixel:
 * Dimensions reference: 764 x 1024 px
 */
export const WIDOKI_NA_RAJ_DEFAULT_LAYERS: CoverTextLayer[] = [
  {
    id: 'title',
    label: 'Tytuł Główny',
    originalText: 'Widoki na Raj',
    translatedText: '',
    fontFamily: 'playfair',
    fontSizePt: 55,
    colorHex: '#111827',
    isUppercase: false,
    isBold: true,
    isItalic: false,
    letterSpacingEm: 0.01,
    lineHeight: 1.15,
    yPercent: 8.9,
    xPercent: 50,
    hasShadow: true,
    shadowBlur: 12,
    shadowColor: 'rgba(255, 255, 255, 0.95)',
    visible: true,
  },
  {
    id: 'subtitle',
    label: 'Podtytuł (linia 1)',
    originalText: 'Misja barw i kolorów',
    translatedText: '',
    fontFamily: 'playfair',
    fontSizePt: 22,
    colorHex: '#1f2937',
    isUppercase: false,
    isBold: false,
    isItalic: false,
    letterSpacingEm: 0.01,
    lineHeight: 1.2,
    yPercent: 16.6,
    xPercent: 50,
    hasShadow: true,
    shadowBlur: 8,
    shadowColor: 'rgba(255, 255, 255, 0.9)',
    visible: true,
  },
  {
    id: 'subtitle2',
    label: 'Podtytuł (linia 2)',
    originalText: 'czyli duchowa pielgrzymka przez 365 dni w roku',
    translatedText: '',
    fontFamily: 'playfair',
    fontSizePt: 19,
    colorHex: '#27272a',
    isUppercase: false,
    isBold: false,
    isItalic: false,
    letterSpacingEm: 0.01,
    lineHeight: 1.2,
    yPercent: 20.8,
    xPercent: 50,
    hasShadow: true,
    shadowBlur: 8,
    shadowColor: 'rgba(255, 255, 255, 0.9)',
    visible: true,
  },
  {
    id: 'author',
    label: 'Autor',
    originalText: 'Dominik Jan Kuta',
    translatedText: '',
    fontFamily: 'playfair',
    fontSizePt: 23,
    colorHex: '#111827',
    isUppercase: false,
    isBold: true,
    isItalic: false,
    letterSpacingEm: 0.01,
    lineHeight: 1.2,
    yPercent: 27.7,
    xPercent: 50,
    hasShadow: true,
    shadowBlur: 8,
    shadowColor: 'rgba(255, 255, 255, 0.9)',
    visible: true,
  },
  {
    id: 'editor',
    label: 'Redakcja',
    originalText: 'pod redakcją dr Aleksandry Sabasz-Kuta',
    translatedText: '',
    fontFamily: 'playfair',
    fontSizePt: 15,
    colorHex: '#374151',
    isUppercase: false,
    isBold: false,
    isItalic: false,
    letterSpacingEm: 0.01,
    lineHeight: 1.2,
    yPercent: 31.6,
    xPercent: 50,
    hasShadow: true,
    shadowBlur: 8,
    shadowColor: 'rgba(255, 255, 255, 0.9)',
    visible: true,
  },
  {
    id: 'volume',
    label: 'Numer Tomu',
    originalText: 'Tom 5',
    translatedText: '',
    fontFamily: 'playfair',
    fontSizePt: 27,
    colorHex: '#1b0e05',
    isUppercase: false,
    isBold: true,
    isItalic: false,
    letterSpacingEm: 0.02,
    lineHeight: 1.2,
    yPercent: 38.4,
    xPercent: 50,
    hasShadow: true,
    shadowBlur: 10,
    shadowColor: 'rgba(255, 255, 255, 0.95)',
    visible: true,
  },
  {
    id: 'series',
    label: 'Dolny Tytuł (linia 1)',
    originalText: 'Różaniec Historii Zbawienia',
    translatedText: '',
    fontFamily: 'playfair',
    fontSizePt: 22,
    colorHex: '#18181b',
    isUppercase: false,
    isBold: true,
    isItalic: false,
    letterSpacingEm: 0.01,
    lineHeight: 1.2,
    yPercent: 66.6,
    xPercent: 50,
    hasShadow: true,
    shadowBlur: 12,
    shadowColor: 'rgba(255, 255, 255, 0.98)',
    visible: true,
  },
  {
    id: 'series2',
    label: 'Dolny Tytuł (linia 2)',
    originalText: 'na cały rok',
    translatedText: '',
    fontFamily: 'playfair',
    fontSizePt: 19,
    colorHex: '#18181b',
    isUppercase: false,
    isBold: true,
    isItalic: false,
    letterSpacingEm: 0.01,
    lineHeight: 1.2,
    yPercent: 70.6,
    xPercent: 50,
    hasShadow: true,
    shadowBlur: 12,
    shadowColor: 'rgba(255, 255, 255, 0.98)',
    visible: true,
  },
  {
    id: 'publisher',
    label: 'Wydawca / Logo (tekst)',
    originalText: 'eMBiK',
    translatedText: '',
    fontFamily: 'montserrat',
    fontSizePt: 22,
    colorHex: '#000000',
    isUppercase: false,
    isBold: true,
    isItalic: false,
    letterSpacingEm: 0.03,
    lineHeight: 1.2,
    yPercent: 93.0,
    xPercent: 50,
    hasShadow: false,
    shadowBlur: 0,
    shadowColor: 'transparent',
    visible: true,
  },
];

interface CoverTranslatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfDocProxy: any | null;
  documentInfo: PdfDocumentInfo | null;
  initialTitle?: string;
  initialAuthor?: string;
  onApplyCoverToPublishing?: (coverBytes: Uint8Array, coverDataUrl: string) => void;
}

export const CoverTranslatorModal: React.FC<CoverTranslatorModalProps> = ({
  isOpen,
  onClose,
  pdfDocProxy,
  documentInfo,
  initialTitle,
  initialAuthor,
  onApplyCoverToPublishing,
}) => {
  // Format mode: defaults to 1:1 original proportions (1528 x 2048 px)
  const [formatMode, setFormatMode] = useState<CoverFormatMode>('widoki-cover');

  // Active theme preset
  const [selectedThemeId, setSelectedThemeId] = useState<string>('royal-gold');

  // Background graphic (defaults to Widoki na Raj sample)
  const [bgImageDataUrl, setBgImageDataUrl] = useState<string | null>(WIDOKI_NA_RAJ_IMAGE_URL);
  const [bgImageSource, setBgImageSource] = useState<'sample' | 'upload' | 'pdf' | 'preset'>('sample');
  const [isExtractingPdfPage, setIsExtractingPdfPage] = useState<boolean>(false);

  // Translation target language
  const [targetLang, setTargetLang] = useState<string>('en');
  const [isTranslating, setIsTranslating] = useState<boolean>(false);

  // Contrast & Vignette (clean by default for photo illustration)
  const [hasVignette, setHasVignette] = useState<boolean>(false);
  const [vignetteStrength, setVignetteStrength] = useState<number>(0.5);
  const [hasContrastBand, setHasContrastBand] = useState<boolean>(false);
  const [contrastBandOpacity, setContrastBandOpacity] = useState<number>(0.5);

  // Text Layers initialized with exact layout from "Widoki na Raj"
  const [layers, setLayers] = useState<CoverTextLayer[]>(() => {
    return WIDOKI_NA_RAJ_DEFAULT_LAYERS.map((l) => ({ ...l }));
  });

  // Expanded layer accordion for fine tuning
  const [expandedLayerId, setExpandedLayerId] = useState<string | null>(null);

  const [isAppliedSuccessfully, setIsAppliedSuccessfully] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgImageRef = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeTheme = useMemo(() => {
    return (
      COVER_THEME_PRESETS.find((t) => t.id === selectedThemeId) ||
      COVER_THEME_PRESETS[0]
    );
  }, [selectedThemeId]);

  const dimensions = useMemo(() => {
    return getCoverDimensions(formatMode, 12, 3.0);
  }, [formatMode]);

  // Load Image Object whenever bgImageDataUrl changes
  useEffect(() => {
    if (!bgImageDataUrl) {
      bgImageRef.current = null;
      renderCurrentCover();
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      bgImageRef.current = img;
      renderCurrentCover();
    };
    img.onerror = () => {
      console.warn('Failed to load cover image:', bgImageDataUrl);
      bgImageRef.current = null;
      renderCurrentCover();
    };
    img.src = bgImageDataUrl;
  }, [bgImageDataUrl]);

  // Render cover to canvas whenever any setting changes
  const renderCurrentCover = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    renderCoverToCanvas(canvas, {
      dimensions,
      formatMode,
      bgImage: bgImageRef.current,
      themePreset: activeTheme,
      layers,
      hasVignette,
      vignetteStrength,
      hasContrastBand,
      contrastBandOpacity,
      hasTitleDivider: false,
      spineWidthMm: 12,
      bleedMm: 3.0,
    });
  }, [
    dimensions,
    formatMode,
    activeTheme,
    layers,
    hasVignette,
    vignetteStrength,
    hasContrastBand,
    contrastBandOpacity,
  ]);

  useEffect(() => {
    renderCurrentCover();
  }, [renderCurrentCover]);

  // Extract page 1 from PDF
  const handleExtractFromPdf = async () => {
    if (!pdfDocProxy && !documentInfo?.data) return;
    setIsExtractingPdfPage(true);
    try {
      const source = pdfDocProxy || documentInfo?.data;
      const dataUrl = await extractPdfFirstPageAsImage(source);
      if (dataUrl) {
        setBgImageDataUrl(dataUrl);
        setBgImageSource('pdf');
      }
    } catch (err) {
      console.error('Extraction error:', err);
    } finally {
      setIsExtractingPdfPage(false);
    }
  };

  // Upload custom graphic file (PNG, JPG)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setBgImageDataUrl(reader.result);
        setBgImageSource('upload');
      }
    };
    reader.readAsDataURL(file);
  };

  // Restore Default "Widoki na Raj" Layout & Texts
  const handleResetToWidokiNaRaj = () => {
    setLayers(WIDOKI_NA_RAJ_DEFAULT_LAYERS.map((l) => ({ ...l })));
    setBgImageDataUrl(WIDOKI_NA_RAJ_IMAGE_URL);
    setBgImageSource('sample');
    setFormatMode('widoki-cover');
    setHasVignette(false);
    setHasContrastBand(false);
  };

  // Translate all text layers to target language
  const handleTranslateAllLayers = async () => {
    setIsTranslating(true);
    try {
      const updatedLayers = await Promise.all(
        layers.map(async (layer) => {
          const textToTranslate = layer.originalText.trim();
          if (!textToTranslate) return layer;

          // Don't translate names or brand acronyms like 'eMBiK'
          if (layer.id === 'author') {
            return { ...layer, translatedText: layer.originalText };
          }
          if (layer.id === 'publisher' && textToTranslate.toLowerCase() === 'embik') {
            return { ...layer, translatedText: 'eMBiK' };
          }

          const translated = await translateSingleString(textToTranslate, targetLang, 'auto');
          return {
            ...layer,
            translatedText: translated,
          };
        })
      );

      setLayers(updatedLayers);
    } catch (err) {
      console.error('Cover translation error:', err);
    } finally {
      setIsTranslating(false);
    }
  };

  // Clear translation / restore original
  const handleRestoreOriginalText = () => {
    setLayers((prev) =>
      prev.map((l) => ({
        ...l,
        translatedText: '',
      }))
    );
  };

  // Update specific layer property
  const handleUpdateLayer = (id: string, updates: Partial<CoverTextLayer>) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? { ...l, ...updates } : l))
    );
  };

  // Export Download Handlers
  const handleDownloadImage = async (format: 'image/png' | 'image/jpeg') => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const blob = await canvasToBlob(canvas, format, 0.95);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const cleanTitle = (
        layers.find((l) => l.id === 'title')?.translatedText ||
        layers.find((l) => l.id === 'title')?.originalText ||
        'okladka'
      ).replace(/[^a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ_-]/g, '_');
      const ext = format === 'image/png' ? 'png' : 'jpg';
      a.download = `Okladka_${cleanTitle}_${targetLang.toUpperCase()}_300DPI.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
    }
  };

  // Apply to eBook & PDF publishing
  const handleApplyToBook = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const blob = await canvasToBlob(canvas, 'image/jpeg', 0.92);
      const uint8 = await blobToUint8Array(blob);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

      onApplyCoverToPublishing?.(uint8, dataUrl);
      setIsAppliedSuccessfully(true);
      setTimeout(() => setIsAppliedSuccessfully(false), 3500);
    } catch (err) {
      console.error('Apply cover error:', err);
    }
  };

  if (!isOpen) return null;

  // Group layers into cover visual zones matching the source image layout
  const SECTIONS = [
    {
      title: '☁️ GÓRA OKŁADKI: TYTUŁ I PODTYTUŁY (Niebo)',
      description: 'Główny tytuł i dwuwierszowy podtytuł pielgrzymkowy',
      layerIds: ['title', 'subtitle', 'subtitle2'],
    },
    {
      title: '✍️ NAD TĘCZĄ: AUTOR I REDAKCJA',
      description: 'Autor publikacji oraz informacja o redakcji naukowej',
      layerIds: ['author', 'editor'],
    },
    {
      title: '💎 CENTRUM OKŁADKI: NUMER TOMU',
      description: 'Wyróżniony napis tomu pomiędzy diamentem a postacią Chrystusa',
      layerIds: ['volume'],
    },
    {
      title: '📿 DOLNA CZĘŚĆ OKRĘGU: SERIA MODLITEWNA',
      description: 'Dwuwierszowy napis różańcowy nad fontanną i pasieką',
      layerIds: ['series', 'series2'],
    },
    {
      title: '🏷️ STOPKA OKŁADKI: ZNAK WYDAWNICTWA',
      description: 'Napis w okrągłym emblematcie z pryzmatem tęczowym',
      layerIds: ['publisher'],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4 overflow-y-auto">
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-7xl overflow-hidden flex flex-col max-h-[96vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 py-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 via-rose-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-rose-500/20">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-white">
                  Studio Okładki Książki: Układ Wzorcowy »Widoki na Raj«
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full">
                  Identyczny Styl • Wielkość • Kolor • Układ Pól
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Pola do edycji rozmieszczone w dokładnym układzie wertykalnym z grafiki źródłowej.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top Control Bar: Format Selector & Quick Reset */}
        <div className="px-5 py-2 bg-zinc-900/50 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-zinc-400 font-medium flex items-center gap-1">
              <Maximize2 className="w-3.5 h-3.5 text-blue-400" />
              Format Okładki:
            </span>
            <div className="flex items-center gap-1 bg-zinc-900 p-0.5 rounded-lg border border-zinc-800">
              <button
                onClick={() => setFormatMode('widoki-cover')}
                className={`px-3 py-1 rounded text-xs font-semibold transition cursor-pointer ${
                  formatMode === 'widoki-cover'
                    ? 'bg-amber-600 text-white shadow'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Wzorzec (1:1 Bez Przycinania)
              </button>
              <button
                onClick={() => setFormatMode('a5-front')}
                className={`px-3 py-1 rounded text-xs font-semibold transition cursor-pointer ${
                  formatMode === 'a5-front'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Druk A5 Przód (300 DPI)
              </button>
              <button
                onClick={() => setFormatMode('ebook-front')}
                className={`px-3 py-1 rounded text-xs font-semibold transition cursor-pointer ${
                  formatMode === 'ebook-front'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                eBook (1600 × 2560)
              </button>
              <button
                onClick={() => setFormatMode('a5-spread')}
                className={`px-3 py-1 rounded text-xs font-semibold transition cursor-pointer ${
                  formatMode === 'a5-spread'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Pełna Obwoluta POD
              </button>
            </div>

            {/* Quick Reset to Widoki na Raj */}
            <button
              onClick={handleResetToWidokiNaRaj}
              className="px-2.5 py-1 rounded text-xs font-semibold text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition cursor-pointer flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Przywróć domyślne napisy i układ</span>
            </button>
          </div>

          <div className="text-[11px] text-zinc-400 font-mono hidden sm:inline-block">
            {dimensions.widthPx} × {dimensions.heightPx} px @ 300 DPI
          </div>
        </div>

        {/* Main Workspace */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* LEFT: Exact Cover Fields Form (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* 1. Graphic Source Selector */}
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                  Grafika Tła Okładki:
                </label>
                <span className="text-[10px] text-zinc-400 font-mono">
                  {bgImageSource === 'sample' ? 'Wzorzec: Widoki na Raj' : bgImageSource === 'upload' ? 'Własny plik' : 'Strona PDF'}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setBgImageDataUrl(WIDOKI_NA_RAJ_IMAGE_URL);
                    setBgImageSource('sample');
                    setFormatMode('widoki-cover');
                    setHasVignette(false);
                    setHasContrastBand(false);
                  }}
                  className={`p-2 rounded-lg border text-left transition text-xs flex flex-col justify-between cursor-pointer ${
                    bgImageSource === 'sample'
                      ? 'border-amber-500 bg-amber-500/15 text-white ring-1 ring-amber-500'
                      : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700'
                  }`}
                >
                  <span className="font-bold text-[11px]">🎨 Wzorzec »Widoki na Raj«</span>
                  <span className="text-[9.5px] text-zinc-400">Oryginalna ilustracja</span>
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className={`p-2 rounded-lg border text-left transition text-xs flex flex-col justify-between cursor-pointer ${
                    bgImageSource === 'upload'
                      ? 'border-blue-500 bg-blue-500/15 text-white ring-1 ring-blue-500'
                      : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700'
                  }`}
                >
                  <span className="font-bold text-[11px]">🖼️ Wgraj plik graficzny</span>
                  <span className="text-[9.5px] text-zinc-400">PNG, JPG, WebP</span>
                </button>

                <button
                  type="button"
                  onClick={handleExtractFromPdf}
                  disabled={isExtractingPdfPage || (!pdfDocProxy && !documentInfo?.data)}
                  className={`p-2 rounded-lg border text-left transition text-xs flex flex-col justify-between cursor-pointer disabled:opacity-50 ${
                    bgImageSource === 'pdf'
                      ? 'border-emerald-500 bg-emerald-500/15 text-white ring-1 ring-emerald-500'
                      : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700'
                  }`}
                >
                  <span className="font-bold text-[11px]">📄 1. strona z PDF</span>
                  <span className="text-[9.5px] text-zinc-400">Wyodrębnij z dokumentu</span>
                </button>
              </div>
            </div>

            {/* 2. Translation Bar */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="text-xs font-semibold text-blue-300 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-blue-400" />
                  Przetłumacz Napisy Okładki na Inny Język:
                </label>
                <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded font-mono">
                  36 języków
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={targetLang}
                  onChange={(e) => setTargetLang(e.target.value)}
                  className="bg-zinc-800 border border-zinc-700 text-white font-medium text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  {AVAILABLE_TRANSLATION_LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.flag} {l.name} ({l.code})
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={handleTranslateAllLayers}
                  disabled={isTranslating}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-lg shadow transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTranslating ? 'animate-spin' : ''}`} />
                  <span>Przetłumacz wszystkie pola</span>
                </button>

                {layers.some((l) => l.translatedText) && (
                  <button
                    type="button"
                    onClick={handleRestoreOriginalText}
                    className="px-2.5 py-1.5 text-xs text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg border border-zinc-700 transition cursor-pointer flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Przywróć PL</span>
                  </button>
                )}
              </div>
            </div>

            {/* 3. The Exact Visual Cover Form (Vertical Flow matching the source cover) */}
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <label className="text-xs font-bold text-zinc-100 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-amber-400" />
                  Układ i Pola Edycji Napisów (100% Zgodny ze Wzorcem)
                </label>
                <span className="text-[11px] text-zinc-400">
                  9 pól rozmieszczonych wertykalnie
                </span>
              </div>

              {/* Sections arranged in the exact order of the cover */}
              <div className="space-y-3.5">
                {SECTIONS.map((sec, secIdx) => (
                  <div
                    key={secIdx}
                    className="bg-zinc-950/90 border border-zinc-800/80 rounded-xl p-3 space-y-2.5 shadow-sm"
                  >
                    {/* Section Header */}
                    <div className="flex items-center justify-between border-b border-zinc-900 pb-1.5">
                      <span className="text-[11px] font-bold text-amber-300 tracking-wide uppercase">
                        {sec.title}
                      </span>
                      <span className="text-[9.5px] text-zinc-500">{sec.description}</span>
                    </div>

                    {/* Fields in this section */}
                    <div className="space-y-2.5">
                      {sec.layerIds.map((layerId) => {
                        const layer = layers.find((l) => l.id === layerId);
                        if (!layer) return null;
                        const isExpanded = expandedLayerId === layer.id;

                        return (
                          <div
                            key={layer.id}
                            className={`p-2.5 rounded-lg border transition ${
                              isExpanded
                                ? 'bg-zinc-900/90 border-amber-500/50 shadow-md'
                                : 'bg-zinc-900/40 border-zinc-800/80 hover:border-zinc-700'
                            }`}
                          >
                            {/* Field Header & Quick Info */}
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-white">
                                  {layer.label}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono">
                                  {layer.fontSizePt} pt • Y: {layer.yPercent}%
                                </span>
                                {layer.isBold && (
                                  <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold">
                                    BOLD
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setExpandedLayerId(isExpanded ? null : layer.id)}
                                  className="text-[10.5px] text-zinc-400 hover:text-white flex items-center gap-0.5 cursor-pointer"
                                >
                                  <span>{isExpanded ? 'Zwiń styl' : 'Styl & Pozycja'}</span>
                                  {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                </button>

                                <label className="flex items-center gap-1 text-[11px] text-zinc-400 cursor-pointer ml-1">
                                  <input
                                    type="checkbox"
                                    checked={layer.visible}
                                    onChange={(e) => handleUpdateLayer(layer.id, { visible: e.target.checked })}
                                    className="rounded bg-zinc-800 border-zinc-700 text-emerald-500"
                                  />
                                  <span>Widoczny</span>
                                </label>
                              </div>
                            </div>

                            {/* Main Inputs: PL vs Translated */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div>
                                <input
                                  type="text"
                                  value={layer.originalText}
                                  onChange={(e) => handleUpdateLayer(layer.id, { originalText: e.target.value })}
                                  className="w-full bg-zinc-950 border border-zinc-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                                  placeholder="Tekst oryginalny PL..."
                                />
                              </div>
                              <div>
                                <input
                                  type="text"
                                  value={layer.translatedText}
                                  onChange={(e) => handleUpdateLayer(layer.id, { translatedText: e.target.value })}
                                  className="w-full bg-zinc-950 border border-blue-500/50 rounded-lg px-2.5 py-1.5 text-xs text-blue-100 font-medium placeholder-blue-300/40 focus:outline-none focus:border-blue-400"
                                  placeholder={`Przetłumaczony (${targetLang.toUpperCase()})...`}
                                />
                              </div>
                            </div>

                            {/* Detailed Fine-Tuning Drawer (Font, Size, Y, Color, Shadow) */}
                            {isExpanded && (
                              <div className="mt-3 pt-2.5 border-t border-zinc-800 grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs animate-in fade-in-50 duration-100">
                                {/* Font family */}
                                <div>
                                  <label className="text-[10px] text-zinc-400 block mb-1">Czcionka</label>
                                  <select
                                    value={layer.fontFamily}
                                    onChange={(e) => handleUpdateLayer(layer.id, { fontFamily: e.target.value as CoverFontFamily })}
                                    className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-white"
                                  >
                                    <option value="playfair">Playfair Display (Szeryf wzorcowy)</option>
                                    <option value="georgia">Georgia (Klasyczna)</option>
                                    <option value="cinzel">Cinzel (Rzymska Majuskuła)</option>
                                    <option value="montserrat">Montserrat (Nowoczesna)</option>
                                    <option value="inter">Inter (Minimalistyczna)</option>
                                  </select>
                                </div>

                                {/* Size */}
                                <div>
                                  <div className="flex justify-between text-[10px] text-zinc-400 mb-1">
                                    <span>Rozmiar</span>
                                    <span className="font-mono text-emerald-400 font-bold">{layer.fontSizePt} pt</span>
                                  </div>
                                  <input
                                    type="range"
                                    min="8"
                                    max="72"
                                    value={layer.fontSizePt}
                                    onChange={(e) => handleUpdateLayer(layer.id, { fontSizePt: Number(e.target.value) })}
                                    className="w-full accent-emerald-500 h-1.5 bg-zinc-800 rounded cursor-pointer mt-1"
                                  />
                                </div>

                                {/* Y Position */}
                                <div>
                                  <div className="flex justify-between text-[10px] text-zinc-400 mb-1">
                                    <span>Pozycja Y</span>
                                    <span className="font-mono text-blue-400 font-bold">{layer.yPercent}%</span>
                                  </div>
                                  <input
                                    type="range"
                                    min="3"
                                    max="97"
                                    step="0.1"
                                    value={layer.yPercent}
                                    onChange={(e) => handleUpdateLayer(layer.id, { yPercent: Number(e.target.value) })}
                                    className="w-full accent-blue-500 h-1.5 bg-zinc-800 rounded cursor-pointer mt-1"
                                  />
                                </div>

                                {/* Color & Style */}
                                <div>
                                  <label className="text-[10px] text-zinc-400 block mb-1">Kolor & Styl</label>
                                  <div className="flex items-center gap-1.5">
                                    <input
                                      type="color"
                                      value={layer.colorHex}
                                      onChange={(e) => handleUpdateLayer(layer.id, { colorHex: e.target.value })}
                                      className="w-6 h-6 rounded cursor-pointer bg-transparent border-0 p-0"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateLayer(layer.id, { isBold: !layer.isBold })}
                                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                                        layer.isBold ? 'bg-amber-500/20 border-amber-500 text-amber-300' : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                                      }`}
                                    >
                                      B
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateLayer(layer.id, { isItalic: !layer.isItalic })}
                                      className={`px-1.5 py-0.5 rounded text-[10px] italic border ${
                                        layer.isItalic ? 'bg-amber-500/20 border-amber-500 text-amber-300' : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                                      }`}
                                    >
                                      I
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleUpdateLayer(layer.id, { hasShadow: !layer.hasShadow })}
                                      className={`px-1.5 py-0.5 rounded text-[10px] border ${
                                        layer.hasShadow ? 'bg-blue-500/20 border-blue-500 text-blue-300' : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                                      }`}
                                    >
                                      Poświata
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT: Live Visual Interactive Preview (5 cols) */}
          <div className="lg:col-span-5 flex flex-col items-center justify-start bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 sm:p-5">
            <div className="w-full flex items-center justify-between mb-3 text-xs">
              <span className="font-bold text-zinc-200 flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-amber-400" />
                Podgląd Okładki na Żywo (300 DPI)
              </span>
              <span className="text-[11px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono font-semibold">
                JĘZYK: {targetLang.toUpperCase()}
              </span>
            </div>

            {/* Live Canvas Preview Frame */}
            <div className="relative w-full max-w-[340px] aspect-[764/1024] bg-black rounded-lg shadow-2xl overflow-hidden border border-zinc-700 flex items-center justify-center">
              <canvas
                ref={canvasRef}
                className="w-full h-full object-contain"
              />
            </div>

            <p className="text-[10.5px] text-zinc-400 mt-2.5 text-center">
              Format wzorcowy zachowuje 100% proporcji oryginału (1528 × 2048 px @ 300 DPI). Brak przycinania krawędzi ilustracji.
            </p>

            {/* Success notification */}
            {isAppliedSuccessfully && (
              <div className="w-full mt-3 p-2.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Okładka została pomyślnie przypisana do pakietu publikacji ePUB i PDF!</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer with Actions */}
        <div className="px-5 py-3.5 border-t border-zinc-800 bg-zinc-900/90 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-zinc-400 flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>Format zgodny z wytycznymi Empik Selfpublishing, Legimi, Amazon KDP i Ridero</span>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg transition cursor-pointer"
            >
              Zamknij
            </button>

            {/* Apply to book */}
            {onApplyCoverToPublishing && (
              <button
                onClick={handleApplyToBook}
                className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-lg shadow-md shadow-emerald-600/20 transition cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Użyj jako okładkę w ePUB / PDF</span>
              </button>
            )}

            {/* Download PNG 300 DPI */}
            <button
              onClick={() => handleDownloadImage('image/png')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg shadow-md shadow-blue-600/20 transition cursor-pointer flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Pobierz PNG (300 DPI)</span>
            </button>

            {/* Download JPG */}
            <button
              onClick={() => handleDownloadImage('image/jpeg')}
              className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium rounded-lg border border-zinc-700 transition cursor-pointer flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>JPG</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
