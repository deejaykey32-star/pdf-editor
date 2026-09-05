import QRCode from 'qrcode';
import { QRConfig } from '@/types/pdf';

/**
 * Replaces placeholders {page}, {total}, {p} in text
 */
export function interpolateQRText(
  template: string,
  currentPage: number,
  totalPages: number
): string {
  return template
    .replace(/\{page\}/gi, String(currentPage))
    .replace(/\{total\}/gi, String(totalPages))
    .replace(/\{p\}/gi, String(currentPage));
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
