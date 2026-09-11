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
  LayoutGrid,
  ListOrdered,
  Sparkle,
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

export const WIDOKI_NA_RAJ_DEFAULT_LAYERS: CoverTextLayer[] = [
  {
    id: 'title',
    label: 'Tytuł Główny',
    originalText: 'Widoki na Raj',
    translatedText: '',
    fontFamily: 'playfair',
    fontSizePt: 48,
    colorHex: '#18181b',
    isUppercase: false,
    isBold: true,
    isItalic: false,
    letterSpacingEm: 0.02,
    lineHeight: 1.15,
    yPercent: 9.5,
    xPercent: 50,
    hasShadow: true,
    shadowBlur: 10,
    shadowColor: 'rgba(255, 255, 255, 0.85)',
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
    yPercent: 16.5,
    xPercent: 50,
    hasShadow: true,
    shadowBlur: 8,
    shadowColor: 'rgba(255, 255, 255, 0.8)',
    visible: true,
  },
  {
    id: 'subtitle2',
    label: 'Podtytuł (linia 2)',
    originalText: 'czyli duchowa pielgrzymka przez 365 dni w roku',
    translatedText: '',
    fontFamily: 'playfair',
    fontSizePt: 17,
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
    shadowColor: 'rgba(255, 255, 255, 0.8)',
    visible: true,
  },
  {
    id: 'author',
    label: 'Autor',
    originalText: 'Dominik Jan Kuta',
    translatedText: '',
    fontFamily: 'playfair',
    fontSizePt: 25,
    colorHex: '#111827',
    isUppercase: false,
    isBold: true,
    isItalic: false,
    letterSpacingEm: 0.02,
    lineHeight: 1.2,
    yPercent: 27.6,
    xPercent: 50,
    hasShadow: true,
    shadowBlur: 8,
    shadowColor: 'rgba(255, 255, 255, 0.85)',
    visible: true,
  },
  {
    id: 'editor',
    label: 'Redakcja',
    originalText: 'pod redakcją dr Aleksandry Sabasz-Kuta',
    translatedText: '',
    fontFamily: 'playfair',
    fontSizePt: 14,
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
    shadowColor: 'rgba(255, 255, 255, 0.8)',
    visible: true,
  },
  {
    id: 'volume',
    label: 'Numer Tomu',
    originalText: 'Tom 5',
    translatedText: '',
    fontFamily: 'playfair',
    fontSizePt: 27,
    colorHex: '#111827',
    isUppercase: false,
    isBold: true,
    isItalic: false,
    letterSpacingEm: 0.02,
    lineHeight: 1.2,
    yPercent: 38.0,
    xPercent: 50,
    hasShadow: true,
    shadowBlur: 10,
    shadowColor: 'rgba(255, 255, 255, 0.9)',
    visible: true,
  },
  {
    id: 'series',
    label: 'Dolny Tytuł (linia 1)',
    originalText: 'Różaniec Historii Zbawienia',
    translatedText: '',
    fontFamily: 'playfair',
    fontSizePt: 20,
    colorHex: '#18181b',
    isUppercase: false,
    isBold: false,
    isItalic: false,
    letterSpacingEm: 0.01,
    lineHeight: 1.2,
    yPercent: 68.2,
    xPercent: 50,
    hasShadow: true,
    shadowBlur: 10,
    shadowColor: 'rgba(255, 255, 255, 0.95)',
    visible: true,
  },
  {
    id: 'series2',
    label: 'Dolny Tytuł (linia 2)',
    originalText: 'na cały rok',
    translatedText: '',
    fontFamily: 'playfair',
    fontSizePt: 18,
    colorHex: '#18181b',
    isUppercase: false,
    isBold: false,
    isItalic: false,
    letterSpacingEm: 0.01,
    lineHeight: 1.2,
    yPercent: 71.8,
    xPercent: 50,
    hasShadow: true,
    shadowBlur: 10,
    shadowColor: 'rgba(255, 255, 255, 0.95)',
    visible: true,
  },
  {
    id: 'publisher',
    label: 'Wydawca / Logo (tekst)',
    originalText: 'eMBiK',
    translatedText: '',
    fontFamily: 'montserrat',
    fontSizePt: 19,
    colorHex: '#0f172a',
    isUppercase: false,
    isBold: true,
    isItalic: false,
    letterSpacingEm: 0.04,
    lineHeight: 1.2,
    yPercent: 94.6,
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
  // Format mode: eBook Front, A5 Front, or Full Spread
  const [formatMode, setFormatMode] = useState<CoverFormatMode>('ebook-front');

  // Active theme preset
  const [selectedThemeId, setSelectedThemeId] = useState<string>('royal-gold');

  // Background graphic (defaults to Widoki na Raj sample)
  const [bgImageDataUrl, setBgImageDataUrl] = useState<string | null>(WIDOKI_NA_RAJ_IMAGE_URL);
  const [bgImageSource, setBgImageSource] = useState<'sample' | 'upload' | 'pdf' | 'preset'>('sample');
  const [isExtractingPdfPage, setIsExtractingPdfPage] = useState<boolean>(false);

  // Translation target language
  const [targetLang, setTargetLang] = useState<string>('en');
  const [isTranslating, setIsTranslating] = useState<boolean>(false);

  // Contrast & Vignette
  const [hasVignette, setHasVignette] = useState<boolean>(false);
  const [vignetteStrength, setVignetteStrength] = useState<number>(0.5);
  const [hasContrastBand, setHasContrastBand] = useState<boolean>(false);
  const [contrastBandOpacity, setContrastBandOpacity] = useState<number>(0.5);

  // Edit view mode: single active layer vs all layers list
  const [editViewMode, setEditViewMode] = useState<'active' | 'all'>('active');

  // Text Layers initialized with exact layout from "Widoki na Raj"
  const [layers, setLayers] = useState<CoverTextLayer[]>(() => {
    return WIDOKI_NA_RAJ_DEFAULT_LAYERS.map((l) => ({ ...l }));
  });

  const [activeLayerId, setActiveLayerId] = useState<string>('title');
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

  const currentActiveLayer = layers.find((l) => l.id === activeLayerId) || layers[0];

  const LAYER_ICONS: Record<string, string> = {
    title: '👑',
    subtitle: '💬',
    subtitle2: '📖',
    author: '✍️',
    editor: '🎓',
    volume: '📚',
    series: '📿',
    series2: '📅',
    publisher: '🏷️',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-4 overflow-y-auto">
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-7xl overflow-hidden flex flex-col max-h-[95vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 py-3 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/90">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 via-rose-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-rose-500/20">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-white">
                  Studio Okładki Książki: Pola Edycji & Tłumaczenie
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full">
                  Układ Wzorcowy: »Widoki na Raj« • 300 DPI
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Edytuj poszczególne napisy z okładki, dostosuj układ, wielkości i przetłumacz na 36 języków świata.
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

        {/* Top Control Bar: Format & Quick Reset */}
        <div className="px-5 py-2 bg-zinc-900/50 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-zinc-400 font-medium flex items-center gap-1">
              <Maximize2 className="w-3.5 h-3.5 text-blue-400" />
              Format:
            </span>
            <div className="flex items-center gap-1 bg-zinc-900 p-0.5 rounded-lg border border-zinc-800">
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
                onClick={() => setFormatMode('a5-spread')}
                className={`px-3 py-1 rounded text-xs font-semibold transition cursor-pointer ${
                  formatMode === 'a5-spread'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                Pełna Obwoluta POD (Rozkładówka)
              </button>
            </div>

            {/* Quick Reset to Widoki na Raj */}
            <button
              onClick={handleResetToWidokiNaRaj}
              className="px-2.5 py-1 rounded text-xs font-semibold text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition cursor-pointer flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Przywróć układ wzorcowy »Widoki na Raj«</span>
            </button>
          </div>

          <div className="text-[11px] text-zinc-400 font-mono hidden sm:inline-block">
            {dimensions.widthPx} × {dimensions.heightPx} px • 300 DPI
          </div>
        </div>

        {/* Main Workspace */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* LEFT: Controls & Translation (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* 1. Graphic Source & Theme Box */}
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                  Grafika Tła Okładki:
                </label>
                <span className="text-[10px] text-zinc-400 font-mono">
                  {bgImageSource === 'sample'
                    ? 'Wzorzec: Widoki na Raj'
                    : bgImageSource === 'upload'
                    ? 'Własny plik'
                    : bgImageSource === 'pdf'
                    ? 'Strona 1 z PDF'
                    : 'Szablon gradientowy'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {/* 1. Sample graphic: Widoki na Raj */}
                <button
                  type="button"
                  onClick={() => {
                    setBgImageDataUrl(WIDOKI_NA_RAJ_IMAGE_URL);
                    setBgImageSource('sample');
                    setHasVignette(false);
                    setHasContrastBand(false);
                  }}
                  className={`p-2 rounded-lg border text-left transition text-xs flex flex-col justify-between cursor-pointer ${
                    bgImageSource === 'sample'
                      ? 'border-amber-500 bg-amber-500/15 text-white ring-1 ring-amber-500'
                      : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span className="text-[9px] px-1 py-0.2 bg-amber-500/20 text-amber-300 rounded">Wzorzec</span>
                  </div>
                  <span className="font-semibold text-[11px] truncate">Widoki na Raj</span>
                  <span className="text-[9.5px] text-zinc-400">Ilustracja wzorcowa</span>
                </button>

                {/* 2. Upload Custom Image */}
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
                  <Upload className="w-4 h-4 text-blue-400 mb-1" />
                  <span className="font-semibold text-[11px] truncate">Wgraj plik graficzny</span>
                  <span className="text-[9.5px] text-zinc-400">PNG, JPG, WebP</span>
                </button>

                {/* 3. Extract PDF Page 1 */}
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
                  <div className="flex items-center justify-between mb-1">
                    <FileImage className="w-4 h-4 text-emerald-400" />
                    {isExtractingPdfPage && <RefreshCw className="w-3 h-3 animate-spin text-emerald-400" />}
                  </div>
                  <span className="font-semibold text-[11px] truncate">1. strona z PDF</span>
                  <span className="text-[9.5px] text-zinc-400">Z pliku PDF</span>
                </button>

                {/* 4. Gradient Themes */}
                <button
                  type="button"
                  onClick={() => {
                    setBgImageDataUrl(null);
                    setBgImageSource('preset');
                  }}
                  className={`p-2 rounded-lg border text-left transition text-xs flex flex-col justify-between cursor-pointer ${
                    bgImageSource === 'preset'
                      ? 'border-indigo-500 bg-indigo-500/15 text-white ring-1 ring-indigo-500'
                      : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700'
                  }`}
                >
                  <Palette className="w-4 h-4 text-indigo-400 mb-1" />
                  <span className="font-semibold text-[11px] truncate">Szablony Kolorów</span>
                  <span className="text-[9.5px] text-zinc-400">Tła gradientowe</span>
                </button>
              </div>

              {/* Theme presets picker if preset mode */}
              {bgImageSource === 'preset' && (
                <div className="pt-2 border-t border-zinc-800/80">
                  <span className="text-[11px] text-zinc-400 block mb-1.5">Wybierz styl gradientowy:</span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {COVER_THEME_PRESETS.map((theme) => (
                      <button
                        key={theme.id}
                        onClick={() => {
                          setSelectedThemeId(theme.id);
                        }}
                        className={`p-2 rounded-lg border text-left transition flex items-center gap-2 cursor-pointer ${
                          selectedThemeId === theme.id
                            ? 'border-amber-500 bg-amber-500/10'
                            : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'
                        }`}
                      >
                        <div
                          className="w-5 h-5 rounded-full border border-zinc-700 shrink-0"
                          style={{ background: theme.bgGradient }}
                        />
                        <div className="truncate">
                          <span className="text-[11px] font-semibold text-zinc-200 block truncate">
                            {theme.name}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 2. Translation Bar (36 languages) */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="text-xs font-semibold text-blue-300 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-blue-400" />
                  Tłumaczenie Napisów Okładki na Inny Język:
                </label>
                <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded font-mono">
                  36 języków świata
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
                  <span>Przetłumacz wszystkie napisy</span>
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

            {/* 3. Text Fields Editor */}
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-emerald-400" />
                  Pola do Edycji Napisów na Okładce:
                </label>

                {/* Switch between Single Active Layer and All Layers List */}
                <div className="flex items-center bg-zinc-950 p-0.5 rounded-lg border border-zinc-800 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setEditViewMode('active')}
                    className={`px-2.5 py-1 rounded transition cursor-pointer flex items-center gap-1 ${
                      editViewMode === 'active'
                        ? 'bg-emerald-600 text-white font-semibold'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <Sliders className="w-3 h-3" />
                    <span>Szczegóły warstwy</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditViewMode('all')}
                    className={`px-2.5 py-1 rounded transition cursor-pointer flex items-center gap-1 ${
                      editViewMode === 'all'
                        ? 'bg-emerald-600 text-white font-semibold'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    <ListOrdered className="w-3 h-3" />
                    <span>Wszystkie 9 pól</span>
                  </button>
                </div>
              </div>

              {/* Layer Selection Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-thin">
                {layers.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => {
                      setActiveLayerId(l.id);
                      setEditViewMode('active');
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                      activeLayerId === l.id && editViewMode === 'active'
                        ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-400'
                        : 'bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700 hover:text-white border border-zinc-700/60'
                    }`}
                  >
                    <span>{LAYER_ICONS[l.id] || '📝'}</span>
                    <span>{l.label}</span>
                    {!l.visible && <span className="text-[9px] text-zinc-500 line-through">ukryta</span>}
                  </button>
                ))}
              </div>

              {/* MODE A: Active Layer Detailed Editor */}
              {editViewMode === 'active' && (
                <div className="bg-zinc-950 p-3.5 rounded-lg border border-zinc-800 space-y-3 animate-in fade-in-50 duration-150">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                    <span className="text-xs font-bold text-white flex items-center gap-2">
                      <span className="text-base">{LAYER_ICONS[currentActiveLayer.id] || '📝'}</span>
                      <span>{currentActiveLayer.label}</span>
                    </span>

                    <label className="flex items-center gap-1.5 text-xs text-zinc-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={currentActiveLayer.visible}
                        onChange={(e) => handleUpdateLayer(currentActiveLayer.id, { visible: e.target.checked })}
                        className="rounded bg-zinc-800 border-zinc-700 text-emerald-500"
                      />
                      <span>Widoczny na okładce</span>
                    </label>
                  </div>

                  {/* Text inputs: PL vs Translated */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10.5px] font-medium text-zinc-300 block mb-1">
                        Oryginalny napis (PL):
                      </label>
                      <input
                        type="text"
                        value={currentActiveLayer.originalText}
                        onChange={(e) => handleUpdateLayer(currentActiveLayer.id, { originalText: e.target.value })}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                        placeholder="Wpisz tekst..."
                      />
                    </div>
                    <div>
                      <label className="text-[10.5px] font-medium text-blue-400 block mb-1">
                        Przetłumaczony napis ({targetLang.toUpperCase()}):
                      </label>
                      <input
                        type="text"
                        value={currentActiveLayer.translatedText}
                        onChange={(e) => handleUpdateLayer(currentActiveLayer.id, { translatedText: e.target.value })}
                        className="w-full bg-zinc-900 border border-blue-500/50 rounded-lg px-3 py-2 text-xs text-blue-100 font-medium focus:outline-none focus:border-blue-400"
                        placeholder="Napis w obcym języku..."
                      />
                    </div>
                  </div>

                  {/* Typography & Position Controls */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-zinc-800 text-xs">
                    {/* Font Family */}
                    <div>
                      <label className="text-[10px] text-zinc-400 block mb-1">Krój Czcionki</label>
                      <select
                        value={currentActiveLayer.fontFamily}
                        onChange={(e) => handleUpdateLayer(currentActiveLayer.id, { fontFamily: e.target.value as CoverFontFamily })}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1.5 text-xs text-white"
                      >
                        <option value="playfair">Playfair Display (Szeryf wzorcowy)</option>
                        <option value="georgia">Georgia (Klasyczna)</option>
                        <option value="cinzel">Cinzel (Rzymska Majuskuła)</option>
                        <option value="montserrat">Montserrat (Nowoczesna)</option>
                        <option value="inter">Inter (Minimalistyczna)</option>
                      </select>
                    </div>

                    {/* Font Size */}
                    <div>
                      <div className="flex justify-between text-[10px] text-zinc-400 mb-1">
                        <span>Rozmiar</span>
                        <span className="font-mono text-emerald-400 font-bold">{currentActiveLayer.fontSizePt} pt</span>
                      </div>
                      <input
                        type="range"
                        min="8"
                        max="72"
                        value={currentActiveLayer.fontSizePt}
                        onChange={(e) => handleUpdateLayer(currentActiveLayer.id, { fontSizePt: Number(e.target.value) })}
                        className="w-full accent-emerald-500 h-1.5 bg-zinc-800 rounded cursor-pointer mt-1"
                      />
                    </div>

                    {/* Y Position */}
                    <div>
                      <div className="flex justify-between text-[10px] text-zinc-400 mb-1">
                        <span>Pozycja Pionowa (Y)</span>
                        <span className="font-mono text-blue-400 font-bold">{currentActiveLayer.yPercent}%</span>
                      </div>
                      <input
                        type="range"
                        min="3"
                        max="97"
                        step="0.5"
                        value={currentActiveLayer.yPercent}
                        onChange={(e) => handleUpdateLayer(currentActiveLayer.id, { yPercent: Number(e.target.value) })}
                        className="w-full accent-blue-500 h-1.5 bg-zinc-800 rounded cursor-pointer mt-1"
                      />
                    </div>

                    {/* Color Picker */}
                    <div>
                      <label className="text-[10px] text-zinc-400 block mb-1">Kolor Napisu</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={currentActiveLayer.colorHex}
                          onChange={(e) => handleUpdateLayer(currentActiveLayer.id, { colorHex: e.target.value })}
                          className="w-7 h-7 rounded cursor-pointer bg-transparent border-0 p-0"
                        />
                        <span className="text-[11px] font-mono text-zinc-300 uppercase">{currentActiveLayer.colorHex}</span>
                      </div>
                    </div>
                  </div>

                  {/* Formatting Toggles: Bold, Italic, Uppercase, Shadow */}
                  <div className="flex items-center gap-3 pt-2 border-t border-zinc-800/80 flex-wrap text-xs">
                    <button
                      type="button"
                      onClick={() => handleUpdateLayer(currentActiveLayer.id, { isBold: !currentActiveLayer.isBold })}
                      className={`px-2.5 py-1 rounded font-bold border transition cursor-pointer ${
                        currentActiveLayer.isBold
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                          : 'bg-zinc-900 border-zinc-700 text-zinc-400'
                      }`}
                    >
                      B (Pogrubienie)
                    </button>

                    <button
                      type="button"
                      onClick={() => handleUpdateLayer(currentActiveLayer.id, { isItalic: !currentActiveLayer.isItalic })}
                      className={`px-2.5 py-1 rounded italic border transition cursor-pointer ${
                        currentActiveLayer.isItalic
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                          : 'bg-zinc-900 border-zinc-700 text-zinc-400'
                      }`}
                    >
                      I (Kursywa)
                    </button>

                    <button
                      type="button"
                      onClick={() => handleUpdateLayer(currentActiveLayer.id, { isUppercase: !currentActiveLayer.isUppercase })}
                      className={`px-2.5 py-1 rounded uppercase border transition cursor-pointer ${
                        currentActiveLayer.isUppercase
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                          : 'bg-zinc-900 border-zinc-700 text-zinc-400'
                      }`}
                    >
                      TT (Wielkie Litery)
                    </button>

                    <label className="flex items-center gap-1.5 text-zinc-300 cursor-pointer ml-auto">
                      <input
                        type="checkbox"
                        checked={currentActiveLayer.hasShadow}
                        onChange={(e) => handleUpdateLayer(currentActiveLayer.id, { hasShadow: e.target.checked })}
                        className="rounded bg-zinc-800 border-zinc-700 text-emerald-500"
                      />
                      <span>Poświata / Cień czytelności</span>
                    </label>
                  </div>
                </div>
              )}

              {/* MODE B: All 9 Fields List Table (Rapid Bulk Editing) */}
              {editViewMode === 'all' && (
                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                  {layers.map((l) => (
                    <div
                      key={l.id}
                      className="bg-zinc-950 p-2.5 rounded-lg border border-zinc-800 hover:border-zinc-700 transition space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{LAYER_ICONS[l.id] || '📝'}</span>
                          <span className="text-xs font-bold text-zinc-200">{l.label}</span>
                          <span className="text-[10px] text-zinc-400 font-mono">
                            Y: {l.yPercent}% • {l.fontSizePt}pt
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveLayerId(l.id);
                              setEditViewMode('active');
                            }}
                            className="text-[10px] text-emerald-400 hover:underline cursor-pointer"
                          >
                            Dostosuj styl & pozycję
                          </button>
                          <label className="flex items-center gap-1 text-[11px] text-zinc-400 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={l.visible}
                              onChange={(e) => handleUpdateLayer(l.id, { visible: e.target.checked })}
                              className="rounded bg-zinc-800 border-zinc-700 text-emerald-500"
                            />
                            <span>Pokaż</span>
                          </label>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <input
                          type="text"
                          value={l.originalText}
                          onChange={(e) => handleUpdateLayer(l.id, { originalText: e.target.value })}
                          className="bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1 text-xs text-white placeholder-zinc-500"
                          placeholder="Tekst oryginalny PL..."
                        />
                        <input
                          type="text"
                          value={l.translatedText}
                          onChange={(e) => handleUpdateLayer(l.id, { translatedText: e.target.value })}
                          className="bg-zinc-900 border border-blue-600/40 rounded px-2.5 py-1 text-xs text-blue-100 placeholder-blue-300/40"
                          placeholder={`Przetłumaczony (${targetLang.toUpperCase()})...`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 4. Contrast & Vignette Controls */}
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                  Opcjonalne Efekty Kontrastu Tła:
                </span>
                <span className="text-[10px] text-zinc-400">
                  (Dla grafiki »Widoki na Raj« zalecane wyłączone)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <label className="flex items-center justify-between gap-2 text-[11px] text-zinc-300 cursor-pointer bg-zinc-950 p-2 rounded border border-zinc-800">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={hasContrastBand}
                      onChange={(e) => setHasContrastBand(e.target.checked)}
                      className="rounded bg-zinc-800 border-zinc-700 text-blue-500"
                    />
                    <span>Pas przyciemniający pod tytułem</span>
                  </div>
                </label>

                <label className="flex items-center justify-between gap-2 text-[11px] text-zinc-300 cursor-pointer bg-zinc-950 p-2 rounded border border-zinc-800">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={hasVignette}
                      onChange={(e) => setHasVignette(e.target.checked)}
                      className="rounded bg-zinc-800 border-zinc-700 text-blue-500"
                    />
                    <span>Winieta przy krawędziach okładki</span>
                  </div>
                </label>
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
            <div className="relative w-full max-w-[340px] aspect-[1600/2560] bg-black rounded-lg shadow-2xl overflow-hidden border border-zinc-700 flex items-center justify-center">
              <canvas
                ref={canvasRef}
                className="w-full h-full object-contain"
              />
            </div>

            <p className="text-[10.5px] text-zinc-400 mt-2.5 text-center">
              Podgląd skalowany proporcjonalnie do ekranu. Generowany plik zachowuje pełną rozdzielczość 300 DPI dla druku i czytników.
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
            <span>Format zgodny z wytycznymi Empik Selfpublishing, Legimi, KDP i Ridero</span>
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
