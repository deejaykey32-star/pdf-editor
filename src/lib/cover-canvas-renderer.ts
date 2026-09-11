import {
  CoverDimensions,
  CoverFontFamily,
  CoverFormatMode,
  CoverTextLayer,
  CoverThemePreset,
} from '@/types/cover-translator';
import { getPdfjs } from './pdf-service';

export const COVER_THEME_PRESETS: CoverThemePreset[] = [
  {
    id: 'deep-navy',
    name: 'Królewski Granat & Złoto',
    bgGradient: 'linear-gradient(135deg, #091224 0%, #0d1e3d 50%, #040813 100%)',
    canvasColors: ['#091224', '#0d1e3d', '#040813'],
    accentColor: '#f59e0b',
    recommendedFont: 'cinzel',
    recommendedColor: '#f59e0b',
    description: 'Dostojny, głęboki granat idealny do literatury pięknej, historii i poradników biznesowych.',
  },
  {
    id: 'emerald',
    name: 'Szmaragdowa Tajemnica',
    bgGradient: 'linear-gradient(135deg, #042017 0%, #083c2c 50%, #02120d 100%)',
    canvasColors: ['#042017', '#083c2c', '#02120d'],
    accentColor: '#10b981',
    recommendedFont: 'playfair',
    recommendedColor: '#fef3c7',
    description: 'Głęboka leśna zieleń połączona ze złotymi akcentami i szeryfową typografią.',
  },
  {
    id: 'burgundy',
    name: 'Klasyczny Burgund & Rubin',
    bgGradient: 'linear-gradient(135deg, #2b070f 0%, #4a0d1b 50%, #170408 100%)',
    canvasColors: ['#2b070f', '#4a0d1b', '#170408'],
    accentColor: '#f43f5e',
    recommendedFont: 'playfair',
    recommendedColor: '#fde047',
    description: 'Prestiżowy rubinowy odcień winiarskich i historycznych tomów w twardej oprawie.',
  },
  {
    id: 'obsidian',
    name: 'Ciemny Obsydian & Marmur',
    bgGradient: 'linear-gradient(135deg, #111317 0%, #1e2229 50%, #0a0b0d 100%)',
    canvasColors: ['#111317', '#1e2229', '#0a0b0d'],
    accentColor: '#e2e8f0',
    recommendedFont: 'montserrat',
    recommendedColor: '#ffffff',
    description: 'Nowoczesny, surowy i minimalistyczny styl dla thrillerów, reportaży i literatury faktu.',
  },
  {
    id: 'sunset',
    name: 'Mistyczny Zmierzch',
    bgGradient: 'linear-gradient(135deg, #1a0826 0%, #36124d 40%, #701a4f 80%, #9a3412 100%)',
    canvasColors: ['#1a0826', '#36124d', '#701a4f'],
    accentColor: '#fbbf24',
    recommendedFont: 'cinzel',
    recommendedColor: '#ffffff',
    description: 'Ekspresyjny gradient wieczornego nieba nadający książce poetycki lub fantastyczny ton.',
  },
  {
    id: 'parchment',
    name: 'Zabytkowy Pergamin & Skóra',
    bgGradient: 'linear-gradient(135deg, #291d14 0%, #423023 50%, #1a120b 100%)',
    canvasColors: ['#291d14', '#423023', '#1a120b'],
    accentColor: '#d97706',
    recommendedFont: 'georgia',
    recommendedColor: '#fef3c7',
    description: 'Ciepła stylistyka starych rękopisów, kronik i publikacji religijno-historycznych.',
  },
];

/**
 * Calculates high-resolution dimensions for cover formats
 */
export function getCoverDimensions(
  mode: CoverFormatMode,
  spineWidthMm: number = 12,
  bleedMm: number = 3.0
): CoverDimensions {
  if (mode === 'ebook-front') {
    return {
      widthPx: 1600,
      heightPx: 2560,
      widthMm: 160,
      heightMm: 256,
      dpi: 300,
      label: 'eBook Front (1600 × 2560 px — Legimi / Empik Go / Kindle)',
    };
  }

  if (mode === 'a5-front') {
    // DIN A5 (148 x 210 mm) with bleed (154 x 216 mm) at 300 DPI
    // 1 mm = ~11.811 pixels at 300 DPI
    const totalWMm = 148 + bleedMm * 2;
    const totalHMm = 210 + bleedMm * 2;
    const widthPx = Math.round(totalWMm * 11.811);
    const heightPx = Math.round(totalHMm * 11.811);
    return {
      widthPx,
      heightPx,
      widthMm: totalWMm,
      heightMm: totalHMm,
      dpi: 300,
      label: `Druk A5 Przód (${Math.round(totalWMm)} × ${Math.round(totalHMm)} mm @ 300 DPI)`,
    };
  }

  // A5 Full Spread: Back Cover (148) + Spine (spineWidthMm) + Front Cover (148) + 2*bleedMm
  const totalSpreadWMm = 148 * 2 + spineWidthMm + bleedMm * 2;
  const totalSpreadHMm = 210 + bleedMm * 2;
  const widthPx = Math.round(totalSpreadWMm * 11.811);
  const heightPx = Math.round(totalSpreadHMm * 11.811);
  return {
    widthPx,
    heightPx,
    widthMm: totalSpreadWMm,
    heightMm: totalSpreadHMm,
    dpi: 300,
    label: `Pełna Owijka POD (Tył + Grzbiet ${spineWidthMm}mm + Przód: ${Math.round(totalSpreadWMm)} × ${Math.round(totalSpreadHMm)} mm)`,
  };
}

/**
 * Extracts first page from a PDF document proxy as high-res PNG image data URL
 */
export async function extractPdfFirstPageAsImage(
  pdfSource: any
): Promise<string | null> {
  try {
    const pdfjs = await getPdfjs();
    let pdfDoc = pdfSource;
    if (pdfSource instanceof Uint8Array || pdfSource instanceof ArrayBuffer) {
      pdfDoc = await pdfjs.getDocument({ data: pdfSource }).promise;
    }
    if (!pdfDoc || typeof pdfDoc.getPage !== 'function') return null;

    const page = await pdfDoc.getPage(1);
    const unscaledViewport = page.getViewport({ scale: 1.0 });
    // Scale up to ~2000px height for crisp rendering
    const scale = Math.max(2.0, Math.min(4.0, 2400 / unscaledViewport.height));
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    await page.render({
      canvasContext: ctx,
      viewport,
    }).promise;

    return canvas.toDataURL('image/png', 0.95);
  } catch (err) {
    console.warn('Could not extract first page as cover:', err);
    return null;
  }
}

/**
 * Resolves CSS font-family string from CoverFontFamily enum
 */
export function getFontFamilyCss(font: CoverFontFamily): string {
  switch (font) {
    case 'cinzel':
      return '"Cinzel", "Times New Roman", Georgia, serif';
    case 'playfair':
      return '"Playfair Display", Georgia, "Times New Roman", serif';
    case 'montserrat':
      return '"Montserrat", "Helvetica Neue", Arial, sans-serif';
    case 'inter':
      return '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    case 'georgia':
    default:
      return 'Georgia, "Times New Roman", serif';
  }
}

/**
 * Wraps text into lines based on canvas width
 */
function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const lines: string[] = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    const candidate = currentLine + ' ' + words[i];
    const width = ctx.measureText(candidate).width;
    if (width <= maxWidth) {
      currentLine = candidate;
    } else {
      lines.push(currentLine);
      currentLine = words[i];
    }
  }
  lines.push(currentLine);
  return lines;
}

/**
 * Renders the complete book cover to a Canvas element at specified dimensions
 */
export async function renderCoverToCanvas(
  canvas: HTMLCanvasElement,
  options: {
    dimensions: CoverDimensions;
    formatMode: CoverFormatMode;
    bgImage: HTMLImageElement | null;
    themePreset: CoverThemePreset;
    layers: CoverTextLayer[];
    hasVignette: boolean;
    vignetteStrength: number;
    hasContrastBand: boolean;
    contrastBandOpacity: number;
    spineWidthMm?: number;
    bleedMm?: number;
  }
): Promise<void> {
  const {
    dimensions,
    formatMode,
    bgImage,
    themePreset,
    layers,
    hasVignette,
    vignetteStrength,
    hasContrastBand,
    contrastBandOpacity,
    spineWidthMm = 12,
    bleedMm = 3.0,
  } = options;

  canvas.width = dimensions.widthPx;
  canvas.height = dimensions.heightPx;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;

  // 1. Draw Background
  if (bgImage && bgImage.complete && bgImage.naturalWidth > 0) {
    // Draw background image (Cover fill preserving aspect ratio)
    const imgAspect = bgImage.naturalWidth / bgImage.naturalHeight;
    const canvasAspect = w / h;
    let renderW = w;
    let renderH = h;
    let renderX = 0;
    let renderY = 0;

    if (imgAspect > canvasAspect) {
      renderW = h * imgAspect;
      renderX = (w - renderW) / 2;
    } else {
      renderH = w / imgAspect;
      renderY = (h - renderH) / 2;
    }

    ctx.drawImage(bgImage, renderX, renderY, renderW, renderH);
  } else {
    // Draw theme gradient
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, themePreset.canvasColors[0]);
    grad.addColorStop(0.5, themePreset.canvasColors[1]);
    grad.addColorStop(1, themePreset.canvasColors[2] || themePreset.canvasColors[0]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Subtle decorative geometric accents
    ctx.strokeStyle = `${themePreset.accentColor}20`;
    ctx.lineWidth = Math.max(2, Math.round(w / 400));
    const borderInset = Math.round(w * 0.05);
    ctx.strokeRect(borderInset, borderInset, w - borderInset * 2, h - borderInset * 2);
  }

  // 2. Full spread divider guides (if in spread mode)
  let frontStartX = 0;
  let frontWidth = w;

  if (formatMode === 'a5-spread') {
    const pxPerMm = w / dimensions.widthMm;
    const bleedPx = bleedMm * pxPerMm;
    const frontStartXRaw = (148 + spineWidthMm) * pxPerMm + bleedPx;
    frontStartX = frontStartXRaw;
    frontWidth = 148 * pxPerMm;

    // Draw faint spine guides
    const spineStartX = 148 * pxPerMm + bleedPx;
    const spineWidthPx = spineWidthMm * pxPerMm;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.fillRect(spineStartX, 0, spineWidthPx, h);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.setLineDash([8, 8]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(spineStartX, 0);
    ctx.lineTo(spineStartX, h);
    ctx.moveTo(spineStartX + spineWidthPx, 0);
    ctx.lineTo(spineStartX + spineWidthPx, h);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // 3. Contrast Overlays
  // A) Vignette (Dark edges to focus typography)
  if (hasVignette) {
    const centerX = frontStartX + frontWidth / 2;
    const centerY = h / 2;
    const radius = Math.max(frontWidth, h) * 0.75;
    const vigGrad = ctx.createRadialGradient(centerX, centerY, radius * 0.2, centerX, centerY, radius);
    vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
    vigGrad.addColorStop(0.7, `rgba(0,0,0,${0.35 * vignetteStrength})`);
    vigGrad.addColorStop(1, `rgba(0,0,0,${0.75 * vignetteStrength})`);
    ctx.fillStyle = vigGrad;
    ctx.fillRect(0, 0, w, h);
  }

  // B) Horizontal Contrast Band (Behind Title and Subtitle)
  if (hasContrastBand) {
    const bandCenterY = h * 0.40;
    const bandHeight = h * 0.35;
    const bandGrad = ctx.createLinearGradient(0, bandCenterY - bandHeight / 2, 0, bandCenterY + bandHeight / 2);
    const alpha = Math.min(1.0, Math.max(0.1, contrastBandOpacity));
    bandGrad.addColorStop(0, 'rgba(0,0,0,0)');
    bandGrad.addColorStop(0.2, `rgba(10, 15, 25, ${alpha * 0.7})`);
    bandGrad.addColorStop(0.5, `rgba(5, 10, 20, ${alpha * 0.88})`);
    bandGrad.addColorStop(0.8, `rgba(10, 15, 25, ${alpha * 0.7})`);
    bandGrad.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.fillStyle = bandGrad;
    ctx.fillRect(0, bandCenterY - bandHeight / 2, w, bandHeight);
  }

  // 4. Render Text Layers
  // Scale factor: baseline 1600px width
  const scale = w / 1600;

  for (const layer of layers) {
    if (!layer.visible) continue;
    const textToRender = layer.translatedText || layer.originalText;
    if (!textToRender.trim()) continue;

    const baseFontSizePx = Math.round(layer.fontSizePt * 2.8 * scale);
    const fontCss = getFontFamilyCss(layer.fontFamily);
    const isBold = layer.id === 'title' || layer.id === 'badge';

    ctx.save();

    // Text Shadow
    if (layer.hasShadow) {
      ctx.shadowColor = layer.shadowColor || 'rgba(0, 0, 0, 0.85)';
      ctx.shadowBlur = Math.round(layer.shadowBlur * scale);
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = Math.round(3 * scale);
    }

    ctx.fillStyle = layer.colorHex;
    ctx.font = `${isBold ? 'bold ' : ''}${baseFontSizePx}px ${fontCss}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const targetX = frontStartX + (frontWidth * layer.xPercent) / 100;
    const targetY = (h * layer.yPercent) / 100;

    const maxTextWidth = frontWidth * 0.84;
    const displayText = layer.isUppercase ? textToRender.toUpperCase() : textToRender;

    // Special badge pill rendering
    if (layer.id === 'badge') {
      const badgeText = displayText;
      const textMetrics = ctx.measureText(badgeText);
      const pillPadX = Math.round(24 * scale);
      const pillPadY = Math.round(10 * scale);
      const pillW = textMetrics.width + pillPadX * 2;
      const pillH = baseFontSizePx + pillPadY * 2;

      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.strokeStyle = layer.colorHex;
      ctx.lineWidth = Math.max(1.5, Math.round(2 * scale));

      // Rounded pill rect
      const rx = targetX - pillW / 2;
      const ry = targetY - pillH / 2;
      const radius = pillH / 2;

      ctx.beginPath();
      ctx.moveTo(rx + radius, ry);
      ctx.lineTo(rx + pillW - radius, ry);
      ctx.quadraticCurveTo(rx + pillW, ry, rx + pillW, ry + radius);
      ctx.lineTo(rx + pillW, ry + pillH - radius);
      ctx.quadraticCurveTo(rx + pillW, ry + pillH, rx + pillW - radius, ry + pillH);
      ctx.lineTo(rx + radius, ry + pillH);
      ctx.quadraticCurveTo(rx, ry + pillH, rx, ry + pillH - radius);
      ctx.lineTo(rx, ry + radius);
      ctx.quadraticCurveTo(rx, ry, rx + radius, ry);
      ctx.closePath();

      ctx.fill();
      ctx.stroke();
      ctx.restore();

      ctx.fillText(badgeText, targetX, targetY);
      ctx.restore();
      continue;
    }

    // Normal multi-line text wrapping
    const lines = wrapCanvasText(ctx, displayText, maxTextWidth);
    const lineSpacingPx = baseFontSizePx * (layer.lineHeight || 1.25);
    const totalBlockHeight = lines.length * lineSpacingPx;
    const startY = targetY - (totalBlockHeight / 2) + (lineSpacingPx / 2);

    for (let i = 0; i < lines.length; i++) {
      const lineY = startY + i * lineSpacingPx;
      ctx.fillText(lines[i], targetX, lineY);
    }

    ctx.restore();
  }

  // 5. Decorative Title Accents (Thin gold hairline divider below title)
  const titleLayer = layers.find((l) => l.id === 'title' && l.visible);
  if (titleLayer) {
    const dividerY = (h * (titleLayer.yPercent + 10)) / 100;
    const dividerW = Math.round(frontWidth * 0.35);
    const dividerX = frontStartX + (frontWidth - dividerW) / 2;

    ctx.save();
    ctx.strokeStyle = `${titleLayer.colorHex}60`;
    ctx.lineWidth = Math.max(1, Math.round(2 * scale));
    ctx.beginPath();
    ctx.moveTo(dividerX, dividerY);
    ctx.lineTo(dividerX + dividerW, dividerY);
    ctx.stroke();

    // Center diamond symbol
    ctx.fillStyle = titleLayer.colorHex;
    ctx.beginPath();
    const dSize = Math.round(6 * scale);
    const dCenter = frontStartX + frontWidth / 2;
    ctx.moveTo(dCenter, dividerY - dSize);
    ctx.lineTo(dCenter + dSize, dividerY);
    ctx.lineTo(dCenter, dividerY + dSize);
    ctx.lineTo(dCenter - dSize, dividerY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

/**
 * Converts a canvas to high-quality Blob
 */
export function canvasToBlob(
  canvas: HTMLCanvasElement,
  format: 'image/png' | 'image/jpeg' = 'image/png',
  quality: number = 0.95
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Canvas to Blob conversion failed'));
      },
      format,
      quality
    );
  });
}

/**
 * Converts a Blob to Uint8Array
 */
export async function blobToUint8Array(blob: Blob): Promise<Uint8Array> {
  const ab = await blob.arrayBuffer();
  return new Uint8Array(ab);
}
