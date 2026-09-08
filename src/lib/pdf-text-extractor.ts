import { ExtractedBookModel, ExtractedChapter, ExtractedParagraph } from '@/types/kdp-epub';
import { getPdfjs } from './pdf-service';

interface RawTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontName: string;
}

/**
 * Default list of unwanted header/footer/watermark patterns to strip from extracted text
 * (e.g. eMBiK365, widokinaraj.pl, RHZ365, str. 1-797, etc.)
 */
export const DEFAULT_UNWANTED_PATTERNS: (RegExp | string)[] = [
  /eMBiK\s*365\s*[-—–]?\s*widokinaraj(?:\.pl)?(?:\s*str\.\s*\d+(?:-\d+)?)?/gi,
  /R[oó]żaniec\s+Historii\s+Zbawienia\s*[-—–]?\s*RHZ\s*365/gi,
  /R[oó]żaniec\s+Historii\s+Zbawienia/gi,
  /eMBiK\s*365/gi,
  /widokinaraj\.pl/gi,
  /RHZ\s*365/gi,
  /\bstr\.\s*\d+(?:-\d+)?\b/gi,
  /\bstr\.\s*1-797\b/gi,
];

/**
 * Removes unwanted headers, footers, and noise fragments from text,
 * normalizing spaces and dangling punctuation.
 */
export function sanitizeExtractedText(
  text: string,
  customPatterns?: (string | RegExp)[]
): string {
  if (!text) return '';
  let cleaned = text;
  const allPatterns = [...DEFAULT_UNWANTED_PATTERNS, ...(customPatterns || [])];

  for (const pattern of allPatterns) {
    if (typeof pattern === 'string' && pattern.trim()) {
      const escaped = pattern.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      cleaned = cleaned.replace(new RegExp(escaped, 'gi'), ' ');
    } else if (pattern instanceof RegExp) {
      cleaned = cleaned.replace(pattern, ' ');
    }
  }

  // Clean dangling dashes, commas, colons, double punctuation, and repeated spaces
  cleaned = cleaned
    .replace(/\s*[-—–]\s*[-—–]\s*/g, ' ')
    .replace(/\s*,\s*\./g, '.')
    .replace(/\s*\.\s*,/g, '.')
    .replace(/\s*\.\s*\./g, '.')
    .replace(/\s*,\s*,/g, ',')
    .replace(/^\s*[-—–,.:;]+\s*/g, '')
    .replace(/\s*[-—–,.:;]+\s*$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return cleaned;
}

export interface ExtractBookOptions {
  fallbackTitle?: string;
  customExcludedPatterns?: string[];
}

/**
 * Robustly extracts structured book text (chapters, headings, paragraphs)
 * from a loaded PDFDocumentProxy or raw PDF Uint8Array using PDF.js,
 * automatically filtering out unwanted headers, footers, and noise phrases.
 */
export async function extractBookContentFromPdf(
  source: import('pdfjs-dist').PDFDocumentProxy | Uint8Array,
  optionsOrTitle: string | ExtractBookOptions = 'Książka Dokumentowa'
): Promise<ExtractedBookModel> {
  const options: ExtractBookOptions =
    typeof optionsOrTitle === 'string'
      ? { fallbackTitle: optionsOrTitle }
      : optionsOrTitle;

  const fallbackTitle = options.fallbackTitle || 'Książka Dokumentowa';
  const customPatterns = options.customExcludedPatterns || [];

  let proxy: import('pdfjs-dist').PDFDocumentProxy;

  if (source instanceof Uint8Array) {
    const pdfjs = await getPdfjs();
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(source.slice(0)),
      cMapUrl: 'https://unpkg.com/pdfjs-dist@4.10.38/cmaps/',
      cMapPacked: true,
    });
    proxy = await loadingTask.promise;
  } else {
    proxy = source;
  }

  const numPages = proxy.numPages;
  const chapters: ExtractedChapter[] = [];
  let currentChapter: ExtractedChapter = {
    id: 'ch-1',
    title: 'Wprowadzenie',
    paragraphs: [],
    pageRange: { start: 1, end: 1 },
  };

  let totalWordsCount = 0;
  let detectedTitle = sanitizeExtractedText(
    fallbackTitle.replace(/\.pdf$/i, '').replace(/[_-]/g, ' '),
    customPatterns
  );

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await proxy.getPage(pageNum);
    const content = await page.getTextContent();
    const items = content.items as any[];

    if (!items || items.length === 0) {
      page.cleanup();
      continue;
    }

    const rawItems: RawTextItem[] = [];

    for (const it of items) {
      if (!it.str || it.str.trim() === '') continue;
      const tx = it.transform ? it.transform[4] : 0;
      const ty = it.transform ? it.transform[5] : 0;
      const fontSize = it.transform ? Math.abs(it.transform[0] || it.transform[3] || 10) : 10;
      rawItems.push({
        str: it.str,
        x: tx,
        y: ty,
        width: it.width || 0,
        height: it.height || fontSize,
        fontSize,
        fontName: it.fontName || '',
      });
    }

    // Sort items top-to-bottom (Y desc), then left-to-right (X asc)
    rawItems.sort((a, b) => {
      const yDiff = Math.abs(a.y - b.y);
      if (yDiff <= 3) {
        return a.x - b.x;
      }
      return b.y - a.y;
    });

    // Group items into lines
    interface LineGroup {
      y: number;
      fontSize: number;
      text: string;
      isUpper: boolean;
    }

    const lines: LineGroup[] = [];
    let currentLineItems: RawTextItem[] = [];
    let currentLineY: number | null = null;

    const pushCleanedLine = (itemsToFlush: RawTextItem[], yCoord: number) => {
      const rawText = itemsToFlush
        .map((i) => i.str.trim())
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ');

      const cleanedText = sanitizeExtractedText(rawText, customPatterns);
      const maxFont = Math.max(...itemsToFlush.map((i) => i.fontSize));

      // Discard empty lines or lone punctuation
      if (cleanedText.length > 1 && !/^[-—–,.:;]+$/.test(cleanedText)) {
        lines.push({
          y: yCoord,
          fontSize: maxFont,
          text: cleanedText,
          isUpper: cleanedText === cleanedText.toUpperCase() && cleanedText.length > 3,
        });
      }
    };

    for (const item of rawItems) {
      if (currentLineY === null) {
        currentLineY = item.y;
        currentLineItems = [item];
      } else if (Math.abs(item.y - currentLineY) <= 3.5) {
        currentLineItems.push(item);
      } else {
        pushCleanedLine(currentLineItems, currentLineY);
        currentLineY = item.y;
        currentLineItems = [item];
      }
    }

    if (currentLineItems.length > 0 && currentLineY !== null) {
      pushCleanedLine(currentLineItems, currentLineY);
    }

    // Process lines into paragraphs and chapters
    let paragraphBuffer: string[] = [];
    let lastLineY: number | null = null;
    let lastFontSize: number = 10;

    const flushParagraph = (isHeading: boolean = false, headingLvl: number = 1, fSize: number = 12) => {
      if (paragraphBuffer.length === 0) return;
      const fullText = paragraphBuffer.join(' ').replace(/\s+/g, ' ').trim();
      paragraphBuffer = [];
      const cleaned = sanitizeExtractedText(fullText, customPatterns);
      if (!cleaned || cleaned.length <= 1) return;

      const words = cleaned.split(/\s+/).length;
      totalWordsCount += words;

      currentChapter.paragraphs.push({
        text: cleaned,
        isHeading,
        headingLevel: headingLvl,
        fontSize: 12, // Strictly 12pt format
        isBold: isHeading,
      });
    };

    for (let l = 0; l < lines.length; l++) {
      const line = lines[l];
      const isChapterHeadingCandidate =
        line.fontSize >= 13 ||
        /^(rozdzia[łl]|chapter|część|akt|wstęp|prolog|epilog)\b/i.test(line.text) ||
        (line.isUpper && line.text.length < 60 && line.fontSize >= 11);

      // Check if this indicates a new chapter
      if (isChapterHeadingCandidate && currentChapter.paragraphs.length > 0) {
        flushParagraph();
        if (currentChapter.paragraphs.length > 0) {
          if (currentChapter.pageRange) {
            currentChapter.pageRange.end = pageNum;
          }
          chapters.push(currentChapter);
        }

        const cleanedTitle = sanitizeExtractedText(line.text, customPatterns);

        currentChapter = {
          id: `ch-${chapters.length + 1}`,
          title: cleanedTitle || `Rozdział ${chapters.length + 1}`,
          paragraphs: [],
          pageRange: { start: pageNum, end: pageNum },
        };

        // Add heading as first element of new chapter (strictly 12pt bold)
        currentChapter.paragraphs.push({
          text: cleanedTitle || `Rozdział ${chapters.length + 1}`,
          isHeading: true,
          headingLevel: 1,
          fontSize: 12,
          isBold: true,
        });
        lastLineY = line.y;
        lastFontSize = line.fontSize;
        continue;
      }

      // Check paragraph separation: significant vertical gap or font size change
      const yDelta = lastLineY !== null ? Math.abs(lastLineY - line.y) : 0;
      const isSignificantGap = yDelta > line.fontSize * 1.8;

      if (isSignificantGap && paragraphBuffer.length > 0) {
        flushParagraph(false, 0, 12);
      }

      paragraphBuffer.push(line.text);
      lastLineY = line.y;
      lastFontSize = line.fontSize;
    }

    flushParagraph(false, 0, 12);

    if (currentChapter.pageRange) {
      currentChapter.pageRange.end = pageNum;
    }

    page.cleanup();
  }

  if (currentChapter.paragraphs.length > 0) {
    chapters.push(currentChapter);
  }

  // Filter out any chapter that became empty or only contains noise
  const validChapters = chapters.filter(
    (ch) => ch.paragraphs.length > 0 && ch.title && ch.title.length > 1
  );

  // If no chapters detected, create fallback chapter
  if (validChapters.length === 0) {
    validChapters.push({
      id: 'ch-1',
      title: 'Treść Główna',
      paragraphs: [
        {
          text: 'Brak odczytanego tekstu z dokumentu źródłowego lub dokument zawiera wyłącznie grafiki rastrowe.',
          isHeading: false,
          fontSize: 12,
        },
      ],
      pageRange: { start: 1, end: numPages || 1 },
    });
  } else {
    // If first chapter has title "Wprowadzenie" and its first paragraph is a heading, use it
    if (validChapters[0].title === 'Wprowadzenie' && validChapters[0].paragraphs[0]?.isHeading) {
      validChapters[0].title = validChapters[0].paragraphs[0].text;
    }
  }

  return {
    title: detectedTitle || 'Dokument A5 Amazon KDP',
    author: 'Autor Publikacji',
    chapters: validChapters,
    totalWords: totalWordsCount,
    sourcePageCount: numPages,
  };
}
