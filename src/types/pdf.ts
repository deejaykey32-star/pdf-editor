export type ErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H';

export type AlignmentPreset =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'bottom-center'
  | 'center';

export type BatchMode = 'page' | 'all' | 'range' | 'odd' | 'even';

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
  specificPage?: number; // specific 1-indexed page number when mode === 'page'
  rangeString: string; // e.g. "1-50, 100-200"
}

export type UniquePageMode = 'single' | 'template' | 'list';

export interface QRCodeItem {
  id: string;
  label: string;
  content: string;
  sizeMm: number;
  xMm: number;
  yMm: number;
  errorCorrection: ErrorCorrectionLevel;
  marginModules: number;
  colorDark: string;
  colorLight: string;
  safetyMarginMm: number;
  scope: BatchScopeConfig;
  enableLink: boolean; // active clickable hyperlink in the exported PDF
  showLabel: boolean; // visual identification label rendered on the page
  labelPosition: 'top' | 'bottom'; // position of the label relative to QR
  uniqueMode?: UniquePageMode; // 'single' | 'template' | 'list'
  customUrlList?: string[]; // array of distinct URLs (line 1 = page 1, etc.)
  customLabelList?: string[]; // optional array of distinct labels
  pageUrlOverrides?: Record<number, string>; // manual override for specific page number
  pageLabelOverrides?: Record<number, string>; // manual override for specific page label
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

export type ContentShiftZone = 'none' | 'bottom' | 'top' | 'left' | 'right';

export interface PageShiftConfig {
  enabled: boolean;
  zone: ContentShiftZone;
  offsetMm: number; // e.g. 30mm reserved for QR
  scaleContent: number; // e.g. 0.90
  autoPositionQR: boolean; // automatically places QR in the center of the reserved zone
}

