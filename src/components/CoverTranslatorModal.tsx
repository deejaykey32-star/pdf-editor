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

interface CoverTranslatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfDocProxy: any | null;
  documentInfo: PdfDocumentInfo | null;
  initialTitle?: string;
  initialAuthor?: string;
  onApplyCoverToPublishing?: (coverBytes: Uint8Array, coverDataUrl: string) => void;
}

const DEFAULT_LAYERS: CoverTextLayer[] = [
  {
    id: 'badge',
    label: 'Odznaka / Seria',
    originalText: 'Wydanie Specjalne',
    translatedText: '',
    fontFamily: 'montserrat',
    fontSizePt: 13,
    colorHex: '#f59e0b',
    isUppercase: true,
    letterSpacingEm: 0.15,
    lineHeight: 1.2,
    yPercent: 12,
    xPercent: 50,
    hasShadow: true,
    shadowBlur: 8,
    shadowColor: 'rgba(0,0,0,0.85)',
    visible: true,
  },
  {
    id: 'title',
    label: 'Tytuł Książki',
    originalText: '',
    translatedText: '',
    fontFamily: 'cinzel',
    fontSizePt: 46,
    colorHex: '#fef3c7',
    isUppercase: true,
    letterSpacingEm: 0.08,
    lineHeight: 1.15,
    yPercent: 36,
    xPercent: 50,
    hasShadow: true,
    shadowBlur: 16,
    shadowColor: 'rgba(0,0,0,0.95)',
    visible: true,
  },
  {
    id: 'subtitle',
    label: 'Podtytuł / Hasło',
    originalText: 'Kompletny Przewodnik i Zbiór Wiedzy',
    translatedText: '',
    fontFamily: 'playfair',
    fontSizePt: 18,
    colorHex: '#cbd5e1',
    isUppercase: false,
    letterSpacingEm: 0.05,
    lineHeight: 1.3,
    yPercent: 54,
    xPercent: 50,
    hasShadow: true,
    shadowBlur: 8,
    shadowColor: 'rgba(0,0,0,0.85)',
    visible: true,
  },
  {
    id: 'author',
    label: 'Autor / Wydawca',
    originalText: '',
    translatedText: '',
    fontFamily: 'montserrat',
    fontSizePt: 19,
    colorHex: '#ffffff',
    isUppercase: true,
    letterSpacingEm: 0.18,
    lineHeight: 1.2,
    yPercent: 88,
    xPercent: 50,
    hasShadow: true,
    shadowBlur: 10,
    shadowColor: 'rgba(0,0,0,0.9)',
    visible: true,
  },
];

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
  const [selectedThemeId, setSelectedThemeId] = useState<string>('deep-navy');

  // Background graphic
  const [bgImageDataUrl, setBgImageDataUrl] = useState<string | null>(null);
  const [bgImageSource, setBgImageSource] = useState<'upload' | 'pdf' | 'preset'>('preset');
  const [isExtractingPdfPage, setIsExtractingPdfPage] = useState<boolean>(false);

  // Translation target language
  const [targetLang, setTargetLang] = useState<string>('en');
  const [isTranslating, setIsTranslating] = useState<boolean>(false);

  // Contrast & Vignette
  const [hasVignette, setHasVignette] = useState<boolean>(true);
  const [vignetteStrength, setVignetteStrength] = useState<number>(1.0);
  const [hasContrastBand, setHasContrastBand] = useState<boolean>(true);
  const [contrastBandOpacity, setContrastBandOpacity] = useState<number>(0.85);

  // Text Layers
  const [layers, setLayers] = useState<CoverTextLayer[]>(() => {
    return DEFAULT_LAYERS.map((l) => {
      if (l.id === 'title') {
        const t = initialTitle || documentInfo?.name.replace(/\.pdf$/i, '').replace(/[_-]/g, ' ') || 'Tytuł Publikacji';
        return { ...l, originalText: t };
      }
      if (l.id === 'author') {
        return { ...l, originalText: initialAuthor || 'Autor Publikacji' };
      }
      return l;
    });
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

  // Sync initial title / author when modal opens
  useEffect(() => {
    if (initialTitle || documentInfo?.name) {
      const detectedTitle = initialTitle || documentInfo?.name.replace(/\.pdf$/i, '').replace(/[_-]/g, ' ') || '';
      setLayers((prev) =>
        prev.map((l) => {
          if (l.id === 'title' && (!l.originalText || l.originalText === 'Tytuł Publikacji')) {
            return { ...l, originalText: detectedTitle };
          }
          if (l.id === 'author' && initialAuthor && !l.originalText) {
            return { ...l, originalText: initialAuthor };
          }
          return l;
        })
      );
    }
  }, [initialTitle, initialAuthor, documentInfo?.name]);

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

  // Upload graphic file (PNG, JPG)
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

  // Translate all text layers to target language
  const handleTranslateAllLayers = async () => {
    setIsTranslating(true);
    try {
      const updatedLayers = await Promise.all(
        layers.map(async (layer) => {
          const textToTranslate = layer.originalText.trim();
          if (!textToTranslate) return layer;

          // Don't translate names if author
          if (layer.id === 'author' && !textToTranslate.includes('redakcja') && !textToTranslate.includes('praca')) {
            return { ...layer, translatedText: layer.originalText };
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
      const cleanTitle = (layers.find((l) => l.id === 'title')?.translatedText || layers.find((l) => l.id === 'title')?.originalText || 'okladka')
        .replace(/[^a-zA-Z0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ_-]/g, '_');
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto">
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-6xl overflow-hidden flex flex-col max-h-[94vh] animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-3.5 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 via-rose-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-rose-500/20">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white">
                  Studio Tłumaczenia Kolorowej Okładki Książki
                </h2>
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full">
                  Grafika 300 DPI • Legimi • Empik • KDP
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Wczytaj obraz, pobierz stronę z PDF lub wybierz szablon. Przetłumacz tytuł i hasła na dowolny język.
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

        {/* Format Selector Bar */}
        <div className="px-6 py-2 bg-zinc-900/40 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-zinc-400 font-medium flex items-center gap-1">
              <Maximize2 className="w-3.5 h-3.5 text-blue-400" />
              Format Okładki:
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
                Pełna Owijka POD (Przód + Grzbiet + Tył)
              </button>
            </div>
          </div>

          <div className="text-[11px] text-zinc-400 font-mono hidden sm:inline-block">
            Rozdzielczość: {dimensions.widthPx} × {dimensions.heightPx} px @ 300 DPI
          </div>
        </div>

        {/* Modal Main Content */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT: Controls & Translation (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            {/* 1. Graphic Source & Theme Box */}
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                  Źródło Grafiki / Tła Okładki:
                </label>
                <span className="text-[10px] text-zinc-400 font-mono">
                  {bgImageSource === 'upload' ? 'Własny plik' : bgImageSource === 'pdf' ? 'Strona 1 z PDF' : 'Szablon artystyczny'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {/* PDF Page 1 capture */}
                <button
                  type="button"
                  onClick={handleExtractFromPdf}
                  disabled={isExtractingPdfPage || (!pdfDocProxy && !documentInfo?.data)}
                  className={`p-2.5 rounded-lg border text-left transition text-xs flex flex-col justify-between cursor-pointer ${
                    bgImageSource === 'pdf'
                      ? 'border-blue-500 bg-blue-500/10 text-white'
                      : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <FileImage className="w-4 h-4 text-blue-400" />
                    {isExtractingPdfPage && <RefreshCw className="w-3 h-3 animate-spin text-blue-400" />}
                  </div>
                  <span className="font-semibold text-[11px]">Użyj 1. strony z PDF</span>
                  <span className="text-[9.5px] text-zinc-400 mt-0.5">Renderuje okładkę z pliku</span>
                </button>

                {/* Upload Image */}
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
                  className={`p-2.5 rounded-lg border text-left transition text-xs flex flex-col justify-between cursor-pointer ${
                    bgImageSource === 'upload'
                      ? 'border-amber-500 bg-amber-500/10 text-white'
                      : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700'
                  }`}
                >
                  <Upload className="w-4 h-4 text-amber-400 mb-1" />
                  <span className="font-semibold text-[11px]">Wgraj plik graficzny</span>
                  <span className="text-[9.5px] text-zinc-400 mt-0.5">PNG, JPG, WebP</span>
                </button>

                {/* Clear image / Use Preset */}
                <button
                  type="button"
                  onClick={() => {
                    setBgImageDataUrl(null);
                    setBgImageSource('preset');
                  }}
                  className={`p-2.5 rounded-lg border text-left transition text-xs flex flex-col justify-between cursor-pointer ${
                    bgImageSource === 'preset'
                      ? 'border-indigo-500 bg-indigo-500/10 text-white'
                      : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-700'
                  }`}
                >
                  <Sparkles className="w-4 h-4 text-indigo-400 mb-1" />
                  <span className="font-semibold text-[11px]">Szablony Kolorystyczne</span>
                  <span className="text-[9.5px] text-zinc-400 mt-0.5">Artystyczne tła gradientowe</span>
                </button>
              </div>

              {/* Theme presets picker */}
              {bgImageSource === 'preset' && (
                <div className="pt-2 border-t border-zinc-800/80">
                  <span className="text-[11px] text-zinc-400 block mb-1.5">Wybierz styl tła:</span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {COVER_THEME_PRESETS.map((theme) => (
                      <button
                        key={theme.id}
                        onClick={() => {
                          setSelectedThemeId(theme.id);
                          // Auto set layer color matching theme
                          setLayers((prev) =>
                            prev.map((l) => (l.id === 'title' ? { ...l, colorHex: theme.recommendedColor, fontFamily: theme.recommendedFont } : l))
                          );
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

            {/* 2. Translation Bar */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="text-xs font-semibold text-blue-300 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-blue-400" />
                  Tłumaczenie Napisów Okładki na Inny Język:
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
                  <span>Przetłumacz napisy okładki</span>
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

            {/* 3. Layer Text Editor & Typography Controls */}
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-emerald-400" />
                  Edycja Warstw Tekstowych Okładki:
                </label>
                <div className="flex items-center gap-1">
                  {layers.map((l) => (
                    <button
                      key={l.id}
                      onClick={() => setActiveLayerId(l.id)}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold transition cursor-pointer ${
                        activeLayerId === l.id
                          ? 'bg-emerald-600 text-white shadow'
                          : 'bg-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {l.label.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Active Layer Editor Inputs */}
              <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    Warstwa: {currentActiveLayer.label}
                  </span>
                  <label className="flex items-center gap-1.5 text-[11px] text-zinc-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={currentActiveLayer.visible}
                      onChange={(e) => handleUpdateLayer(currentActiveLayer.id, { visible: e.target.checked })}
                      className="rounded bg-zinc-800 border-zinc-700 text-emerald-500"
                    />
                    <span>Widoczna na okładce</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-zinc-400 block mb-1">Oryginalny tekst (PL)</label>
                    <input
                      type="text"
                      value={currentActiveLayer.originalText}
                      onChange={(e) => handleUpdateLayer(currentActiveLayer.id, { originalText: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-white"
                      placeholder="Wpisz tekst..."
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-blue-400 block mb-1">Przetłumaczony tekst ({targetLang.toUpperCase()})</label>
                    <input
                      type="text"
                      value={currentActiveLayer.translatedText}
                      onChange={(e) => handleUpdateLayer(currentActiveLayer.id, { translatedText: e.target.value })}
                      className="w-full bg-zinc-900 border border-blue-600/50 rounded px-2.5 py-1.5 text-xs text-blue-100 font-medium"
                      placeholder="Tekst po przetłumaczeniu..."
                    />
                  </div>
                </div>

                {/* Typography controls */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-zinc-800 text-xs">
                  <div>
                    <label className="text-[10px] text-zinc-400 block mb-1">Czcionka</label>
                    <select
                      value={currentActiveLayer.fontFamily}
                      onChange={(e) => handleUpdateLayer(currentActiveLayer.id, { fontFamily: e.target.value as CoverFontFamily })}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-white"
                    >
                      <option value="cinzel">Cinzel (Klasyczna)</option>
                      <option value="playfair">Playfair (Szeryfowa)</option>
                      <option value="montserrat">Montserrat (Nowoczesna)</option>
                      <option value="inter">Inter (Minimalistyczna)</option>
                      <option value="georgia">Georgia</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] text-zinc-400 block mb-1">Rozmiar ({currentActiveLayer.fontSizePt} pt)</label>
                    <input
                      type="range"
                      min="10"
                      max="72"
                      value={currentActiveLayer.fontSizePt}
                      onChange={(e) => handleUpdateLayer(currentActiveLayer.id, { fontSizePt: Number(e.target.value) })}
                      className="w-full accent-emerald-500 h-1.5 bg-zinc-800 rounded cursor-pointer mt-2"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-zinc-400 block mb-1">Pozycja Y ({currentActiveLayer.yPercent}%)</label>
                    <input
                      type="range"
                      min="5"
                      max="95"
                      value={currentActiveLayer.yPercent}
                      onChange={(e) => handleUpdateLayer(currentActiveLayer.id, { yPercent: Number(e.target.value) })}
                      className="w-full accent-blue-500 h-1.5 bg-zinc-800 rounded cursor-pointer mt-2"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] text-zinc-400 block mb-1">Kolor Napisu</label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="color"
                        value={currentActiveLayer.colorHex}
                        onChange={(e) => handleUpdateLayer(currentActiveLayer.id, { colorHex: e.target.value })}
                        className="w-6 h-6 rounded cursor-pointer bg-transparent border-0 p-0"
                      />
                      <span className="text-[10px] font-mono text-zinc-300">{currentActiveLayer.colorHex}</span>
                    </div>
                  </div>
                </div>

                {/* Quick Style presets */}
                <div className="flex items-center gap-2 pt-1 text-[10px] text-zinc-400">
                  <span>Szybki kolor:</span>
                  {[
                    { label: 'Złoto', color: '#f59e0b' },
                    { label: 'Biel', color: '#ffffff' },
                    { label: 'Krem', color: '#fef3c7' },
                    { label: 'Srebro', color: '#cbd5e1' },
                    { label: 'Czerń', color: '#000000' },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => handleUpdateLayer(currentActiveLayer.id, { colorHex: preset.color })}
                      className="px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}

                  <label className="ml-auto flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={currentActiveLayer.isUppercase}
                      onChange={(e) => handleUpdateLayer(currentActiveLayer.id, { isUppercase: e.target.checked })}
                      className="rounded bg-zinc-800 border-zinc-700 text-emerald-500"
                    />
                    <span>WIELKIE LITERY</span>
                  </label>
                </div>
              </div>

              {/* 4. Contrast & Vignette sliders */}
              <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-800 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-zinc-200 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                    Ochrona Czytelności na Kolorowych Grafikach:
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <label className="flex items-center justify-between gap-2 text-[11px] text-zinc-300 cursor-pointer bg-zinc-900/60 p-2 rounded border border-zinc-800">
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

                  <label className="flex items-center justify-between gap-2 text-[11px] text-zinc-300 cursor-pointer bg-zinc-900/60 p-2 rounded border border-zinc-800">
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
          </div>

          {/* RIGHT: Live Visual Interactive Preview (5 cols) */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center bg-zinc-900/40 border border-zinc-800 rounded-xl p-5">
            <div className="w-full flex items-center justify-between mb-3 text-xs">
              <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-amber-400" />
                Podgląd Okładki na Żywo (300 DPI)
              </span>
              <span className="text-[10px] text-amber-400 font-mono">
                {targetLang.toUpperCase()}
              </span>
            </div>

            {/* Live Canvas Preview Frame */}
            <div className="relative w-full max-w-[320px] aspect-[1600/2560] bg-black rounded-lg shadow-2xl overflow-hidden border border-zinc-700 flex items-center justify-center">
              <canvas
                ref={canvasRef}
                className="w-full h-full object-contain"
              />
            </div>

            <p className="text-[10px] text-zinc-500 mt-2 text-center">
              Podgląd skalowany responsywnie. Eksportowany plik zachowuje pełną rozdzielczość 300 DPI.
            </p>

            {/* Success notification */}
            {isAppliedSuccessfully && (
              <div className="w-full mt-3 p-2.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center justify-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Okładka została pomyślnie przypisana do publikacji ePUB i PDF!</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer with Actions */}
        <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-900/80 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-zinc-400 flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span>Gotowa do publikacji na Empik Go, Legimi, Amazon KDP i Ridero</span>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap w-full sm:w-auto">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg transition cursor-pointer"
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
