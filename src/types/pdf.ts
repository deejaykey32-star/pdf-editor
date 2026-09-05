export type ErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';

export type AlignmentPreset =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'bottom-center'
  | 'center';

export type BatchMode = 'current' | 'all' | 'range' | 'odd' | 'even';

export interface PageDimensions {
  widthPt: number;
  heightPt: number;
  widthMm: number;
  heightMm: number;
  rotation: number;
}

export interface PdfDocumentInfo {
  name: string;
  pageCount: number;
  fileSizeBytes: number;
  pages: PageDimensions[];
  data: Uint8Array;
}

export interface QRConfig {
  content: string; // supports {page}, {total}
  sizeMm: number;
  xMm: number;
  yMm: number;
  errorCorrection: ErrorCorrectionLevel;
  marginModules: number; // quiet zone (0-4)
  colorDark: string;
  colorLight: string;
  safetyMarginMm: number; // safety boundary from edge (default: 5mm for A5)
}

export interface BatchScopeConfig {
  mode: BatchMode;
  rangeString: string; // e.g. "1-50, 100-200"
}

export interface ProcessingProgress {
  currentPage: number;
  totalPages: number;
  percent: number;
  speedPagesPerSec: number;
  etaSeconds: number;
  status: 'idle' | 'processing' | 'completed' | 'error';
  errorMessage?: string;
}
