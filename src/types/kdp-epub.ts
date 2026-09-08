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
}
