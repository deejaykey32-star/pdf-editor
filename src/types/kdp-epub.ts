export type KdpBleedOption = 'none' | 'kdp-standard';

export interface KdpPrintConfig {
  bleed: KdpBleedOption; // 'none' (148x210mm) or 'kdp-standard' (+3.2mm bleed: 154.4x216.4mm)
  bleedMm: number; // 3.2 mm (0.125 in)
  gutterMarginMm: number; // inside binding margin (e.g. 15mm, 18mm, 21mm)
  outerMarginMm: number; // outside edge margin (e.g. 12-15mm)
  topMarginMm: number; // top margin (e.g. 15mm)
  bottomMarginMm: number; // bottom margin (e.g. 15mm)
  fontSizePt: number; // default 12 pt
  lineHeightPt: number; // default 16 pt (~1.33x)
  textAlign: 'justify';
  fontFamily: 'georgia' | 'times' | 'helvetica';
  bookTitle: string;
  author: string;
  runningHeader: boolean;
  pageNumbers: boolean;
  firstLineIndentMm: number; // default 5 mm
  mode: 'typeset' | 'impose-pages'; // reflow extracted text into book vs impose existing PDF pages
  includeQRCodes: boolean;
  excludedPatterns?: string[]; // phrases/headers to strip from output
}

export interface EpubConfig {
  title: string;
  author: string;
  language: string; // 'pl', 'en', etc.
  identifier?: string;
  publisher?: string;
  fontSizePt: number; // 12 pt
  textAlign: 'justify';
  hyphenation: boolean;
  indentParagraphs: boolean;
  includeQRCodes: boolean;
  coverTitle?: string;
  excludedPatterns?: string[]; // phrases/headers to strip from output
}

export interface DocxConfig {
  title: string;
  author: string;
  gutterMarginMm: number; // default 18 mm
  outerMarginMm: number; // default 13 mm
  topMarginMm: number; // default 15 mm
  bottomMarginMm: number; // default 15 mm
  fontSizePt: number; // default 12 pt
  lineSpacing: number; // default 1.15
  fontFamily: 'georgia' | 'times'; // default georgia
  firstLineIndentMm: number; // default 5 mm
  runningHeader: boolean;
  pageNumbers: boolean;
  mirrorMargins: boolean;
  includeTableOfContents: boolean; // automatic TOC with hyperlinks at end of book
  includeQRCodes: boolean;
  excludedPatterns?: string[];
}

export interface ExtractedParagraph {
  text: string;
  isHeading: boolean;
  headingLevel?: number; // 1 for chapter, 2 for section
  fontSize?: number;
  isBold?: boolean;
}

export interface ExtractedChapter {
  id: string;
  title: string;
  paragraphs: ExtractedParagraph[];
  pageRange?: { start: number; end: number };
}

export interface ExtractedBookModel {
  title: string;
  author: string;
  chapters: ExtractedChapter[];
  totalWords: number;
  sourcePageCount: number;
  language?: string;
}

// ----------------------------------------------------
// POD / SELF-PUBLISHING & EBOOK PROVIDERS
// ----------------------------------------------------
export type ProviderId =
  | 'empik'
  | 'legimi'
  | 'amazon-kdp'
  | 'ridero'
  | 'draft2digital'
  | 'lulu'
  | 'rozpisani'
  | 'universal';

export type ProviderCategory = 'pod' | 'ebook' | 'hybrid';

export interface SelfPublishingProvider {
  id: ProviderId;
  name: string;
  shortName: string;
  badge: string;
  category: ProviderCategory;
  zeroCostStart: boolean;
  zeroCostDetails: string;
  isbnPolicy: string;
  distributionChannels: string[];
  royaltiesInfo: string;
  bleedRequirementMm: number;
  hasBleed: boolean;
  recommendedGutterMm: number;
  recommendedOuterMarginMm: number;
  recommendedTopBottomMm: number;
  supportedFormats: ('PDF' | 'ePUB' | 'DOCX')[];
  portalUrl: string;
  description: string;
  guideSteps: string[];
  accentColor: string;
}

// ----------------------------------------------------
// TRANSLATION ENGINE TYPES
// ----------------------------------------------------
export interface TranslationLanguage {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
}

export interface TranslationProgress {
  status: 'idle' | 'translating' | 'completed' | 'error';
  currentChapter: number;
  totalChapters: number;
  currentParagraph: number;
  totalParagraphs: number;
  percent: number;
  currentTextSample?: string;
  targetLang: string;
  error?: string;
}

export interface TranslatedBookRecord {
  languageCode: string;
  languageName: string;
  model: ExtractedBookModel;
  translatedAt: string;
}
