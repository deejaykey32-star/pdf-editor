import QRCode from 'qrcode';
import { QRCodeItem, QRConfig } from '@/types/pdf';

/**
 * Replaces placeholders {page}, {total}, {p} as well as zero-padded formats like {page:03d} in text
 */
export function interpolateQRText(
  template: string,
  currentPage: number,
  totalPages: number
): string {
  if (!template) return '';
  return template
    .replace(/\{page:0(\d+)d\}/gi, (_, width) => String(currentPage).padStart(parseInt(width, 10), '0'))
    .replace(/\{p:0(\d+)d\}/gi, (_, width) => String(currentPage).padStart(parseInt(width, 10), '0'))
    .replace(/\{total:0(\d+)d\}/gi, (_, width) => String(totalPages).padStart(parseInt(width, 10), '0'))
    .replace(/\{page\}/gi, String(currentPage))
    .replace(/\{total\}/gi, String(totalPages))
    .replace(/\{p\}/gi, String(currentPage));
}

/**
 * Resolves the precise QR code URL/content for a specific page.
 */
export function resolvePageContent(
  item: QRCodeItem,
  currentPage: number,
  totalPages: number
): string {
  // 1. Manual page override takes precedence
  if (item.pageUrlOverrides && item.pageUrlOverrides[currentPage] !== undefined) {
    const override = item.pageUrlOverrides[currentPage].trim();
    if (override) return override;
  }

  // 2. Custom URL list (Line 1 = Page 1, Line 2 = Page 2, etc.)
  if (item.uniqueMode === 'list' && item.customUrlList && item.customUrlList.length > 0) {
    const listIndex = currentPage - 1;
    if (listIndex >= 0 && listIndex < item.customUrlList.length) {
      const line = item.customUrlList[listIndex].trim();
      if (line) return line;
    }
  }

  // 3. Template mode or fallback
  return interpolateQRText(item.content || '', currentPage, totalPages);
}

/**
 * Resolves the identification label for a specific page.
 */
export function resolvePageLabel(
  item: QRCodeItem,
  currentPage: number,
  totalPages: number
): string {
  // 1. Manual page override takes precedence
  if (item.pageLabelOverrides && item.pageLabelOverrides[currentPage] !== undefined) {
    const override = item.pageLabelOverrides[currentPage].trim();
    if (override) return override;
  }

  // 2. Custom label list
  if (item.uniqueMode === 'list' && item.customLabelList && item.customLabelList.length > 0) {
    const listIndex = currentPage - 1;
    if (listIndex >= 0 && listIndex < item.customLabelList.length) {
      const line = item.customLabelList[listIndex].trim();
      if (line) return line;
    }
  }

  // 3. Interpolated label
  return interpolateQRText(item.label || '', currentPage, totalPages);
}

/**
 * Returns true if an item produces different content or labels across pages.
 */
export function isItemDynamicPerPage(item: QRCodeItem): boolean {
  if (item.uniqueMode === 'list' && item.customUrlList && item.customUrlList.length > 0) {
    return true;
  }
  if (item.pageUrlOverrides && Object.keys(item.pageUrlOverrides).length > 0) {
    return true;
  }
  if (item.pageLabelOverrides && Object.keys(item.pageLabelOverrides).length > 0) {
    return true;
  }
  return /\{page|\{total|\{p/i.test(item.content) || /\{page|\{total|\{p/i.test(item.label);
}

/**
 * Converts Base64 Data URL to Uint8Array for binary processing
 */
export function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
  if (typeof window !== 'undefined' && typeof window.atob === 'function') {
    const binary = window.atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } else if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
  throw new Error('No Base64 decoder available in current environment');
}

/**
 * Generates high-resolution PNG data URL for preview and embedding
 */
export async function generateQRDataUrl(
  text: string,
  config: Pick<QRConfig, 'errorCorrection' | 'marginModules' | 'colorDark' | 'colorLight'>,
  width: number = 512
): Promise<string> {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: config.errorCorrection,
    margin: config.marginModules,
    width,
    color: {
      dark: config.colorDark || '#000000',
      light: config.colorLight || '#ffffff',
    },
  });
}

/**
 * Generates PNG bytes (Uint8Array) directly for embedding into pdf-lib
 */
export async function generateQRPngBytes(
  text: string,
  config: Pick<QRConfig, 'errorCorrection' | 'marginModules' | 'colorDark' | 'colorLight'>,
  width: number = 512
): Promise<Uint8Array> {
  const dataUrl = await generateQRDataUrl(text, config, width);
  return dataUrlToUint8Array(dataUrl);
}
