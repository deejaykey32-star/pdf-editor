import { AlignmentPreset, BatchMode } from '@/types/pdf';

export const MM_TO_PT_RATIO = 72 / 25.4;
export const PT_TO_MM_RATIO = 25.4 / 72;

export function mmToPt(mm: number): number {
  return mm * MM_TO_PT_RATIO;
}

export function ptToMm(pt: number): number {
  return pt * PT_TO_MM_RATIO;
}

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

/**
 * Constrains QR code inside the printable area of a page respecting safety margins.
 */
export function clampQRPosition(
  xMm: number,
  yMm: number,
  sizeMm: number,
  pageWidthMm: number,
  pageHeightMm: number,
  safetyMarginMm: number = 5
): { xMm: number; yMm: number } {
  const minX = safetyMarginMm;
  const minY = safetyMarginMm;
  const maxX = Math.max(minX, pageWidthMm - sizeMm - safetyMarginMm);
  const maxY = Math.max(minY, pageHeightMm - sizeMm - safetyMarginMm);

  return {
    xMm: Number(clamp(xMm, minX, maxX).toFixed(2)),
    yMm: Number(clamp(yMm, minY, maxY).toFixed(2)),
  };
}

/**
 * Converts top-left screen/canvas coordinates in points to PDF bottom-left coordinates in points.
 * PDF origin (0, 0) is at bottom-left corner!
 */
export function canvasTopLeftToPdfBottomLeft(
  xPt: number,
  yPt: number,
  qrHeightPt: number,
  pageHeightPt: number
): { xPdf: number; yPdf: number } {
  return {
    xPdf: xPt,
    yPdf: pageHeightPt - yPt - qrHeightPt,
  };
}

/**
 * Calculates preset positions for quick alignment buttons.
 */
export function getPresetPosition(
  preset: AlignmentPreset,
  pageWidthMm: number,
  pageHeightMm: number,
  sizeMm: number,
  safetyMarginMm: number = 5
): { xMm: number; yMm: number } {
  const minX = safetyMarginMm;
  const minY = safetyMarginMm;
  const maxX = pageWidthMm - sizeMm - safetyMarginMm;
  const maxY = pageHeightMm - sizeMm - safetyMarginMm;
  const centerX = (pageWidthMm - sizeMm) / 2;
  const centerY = (pageHeightMm - sizeMm) / 2;

  switch (preset) {
    case 'top-left':
      return { xMm: minX, yMm: minY };
    case 'top-right':
      return { xMm: maxX, yMm: minY };
    case 'bottom-left':
      return { xMm: minX, yMm: maxY };
    case 'bottom-right':
      return { xMm: maxX, yMm: maxY };
    case 'bottom-center':
      return { xMm: centerX, yMm: maxY };
    case 'center':
      return { xMm: centerX, yMm: centerY };
  }
}

/**
 * Parses user page range input (e.g. "1-10, 15, 20-25") into an array of 1-indexed page numbers.
 */
export function parsePageRange(
  mode: BatchMode,
  rangeString: string,
  currentPage: number,
  totalPages: number
): number[] {
  if (totalPages <= 0) return [];

  switch (mode) {
    case 'current':
      return [currentPage];
    case 'all':
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    case 'odd':
      return Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => p % 2 !== 0);
    case 'even':
      return Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => p % 2 === 0);
    case 'range': {
      if (!rangeString.trim()) return [currentPage];
      const pages = new Set<number>();
      const segments = rangeString.split(',').map((s) => s.trim()).filter(Boolean);

      for (const seg of segments) {
        if (seg.includes('-')) {
          const parts = seg.split('-').map((p) => parseInt(p.trim(), 10));
          const start = Math.max(1, Math.min(parts[0] || 1, totalPages));
          const end = Math.max(1, Math.min(parts[1] || totalPages, totalPages));
          const [low, high] = start <= end ? [start, end] : [end, start];
          for (let p = low; p <= high; p++) {
            pages.add(p);
          }
        } else {
          const p = parseInt(seg, 10);
          if (!isNaN(p) && p >= 1 && p <= totalPages) {
            pages.add(p);
          }
        }
      }
      return Array.from(pages).sort((a, b) => a - b);
    }
  }
}
