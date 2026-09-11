export type CoverFormatMode = 'widoki-cover' | 'ebook-front' | 'a5-front' | 'a5-spread';

export type CoverFontFamily = 'playfair' | 'georgia' | 'cinzel' | 'montserrat' | 'inter';

export type CoverTextColorPreset = 'gold' | 'white' | 'cream' | 'silver' | 'black';

export interface CoverTextLayer {
  id: string;
  label: string;
  originalText: string;
  translatedText: string;
  fontFamily: CoverFontFamily;
  fontSizePt: number;
  colorHex: string;
  isUppercase: boolean;
  isBold?: boolean;
  isItalic?: boolean;
  letterSpacingEm: number;
  lineHeight: number;
  yPercent: number; // 0 to 100% of height
  xPercent: number; // 0 to 100% of width (50 = center)
  hasShadow: boolean;
  shadowBlur: number;
  shadowColor: string;
  visible: boolean;
}

export interface CoverThemePreset {
  id: string;
  name: string;
  bgGradient: string; // CSS gradient string
  canvasColors: [string, string, string?];
  accentColor: string;
  recommendedFont: CoverFontFamily;
  recommendedColor: string;
  description: string;
}

export interface CoverDimensions {
  widthPx: number;
  heightPx: number;
  widthMm: number;
  heightMm: number;
  dpi: number;
  label: string;
}

export interface CoverExportPackage {
  dataUrl: string;
  blob: Blob;
  uint8Array: Uint8Array;
  width: number;
  height: number;
  format: 'png' | 'jpeg';
}
