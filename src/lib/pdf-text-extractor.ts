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
 * Robustly extracts structured book text (chapters, headings, paragraphs)
 * from a loaded PDFDocumentProxy or raw PDF Uint8Array using PDF.js.
 */
export async function extractBookContentFromPdf(
  source: import('pdfjs-dist').PDFDocumentProxy | Uint8Array,
  fallbackTitle: string = 'Książka Dokumentowa'
): Promise<ExtractedBookModel> {
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
  let detectedTitle = fallbackTitle.replace(/\.pdf$/i, '').replace(/[_-]/g, ' ');

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

    for (const item of rawItems) {
      if (currentLineY === null) {
        currentLineY = item.y;
        currentLineItems = [item];
      } else if (Math.abs(item.y - currentLineY) <= 3.5) {
        currentLineItems.push(item);
      } else {
        // flush line
        const lineText = currentLineItems
          .map((i) => i.str.trim())
          .filter(Boolean)
          .join(' ')
          .replace(/\s+/g, ' ');
        const maxFont = Math.max(...currentLineItems.map((i) => i.fontSize));
        if (lineText.length > 0) {
          lines.push({
            y: currentLineY,
            fontSize: maxFont,
            text: lineText,
            isUpper: lineText === lineText.toUpperCase() && lineText.length > 3,
          });
        }
        currentLineY = item.y;
        currentLineItems = [item];
      }
    }

    if (currentLineItems.length > 0 && currentLineY !== null) {
      const lineText = currentLineItems
        .map((i) => i.str.trim())
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ');
      const maxFont = Math.max(...currentLineItems.map((i) => i.fontSize));
      if (lineText.length > 0) {
        lines.push({
          y: currentLineY,
          fontSize: maxFont,
          text: lineText,
          isUpper: lineText === lineText.toUpperCase() && lineText.length > 3,
        });
      }
    }

    // Process lines into paragraphs and chapters
    let paragraphBuffer: string[] = [];
    let lastLineY: number | null = null;
    let lastFontSize: number = 10;

    const flushParagraph = (isHeading: boolean = false, headingLvl: number = 1, fSize: number = 12) => {
      if (paragraphBuffer.length === 0) return;
      const fullText = paragraphBuffer.join(' ').replace(/\s+/g, ' ').trim();
      paragraphBuffer = [];
      if (!fullText) return;

      const words = fullText.split(/\s+/).length;
      totalWordsCount += words;

      currentChapter.paragraphs.push({
        text: fullText,
        isHeading,
        headingLevel: headingLvl,
        fontSize: fSize,
        isBold: isHeading,
      });
    };

    for (let l = 0; l < lines.length; l++) {
      const line = lines[l];
      const isChapterHeadingCandidate =
        line.fontSize >= 13 ||
        /^(rozdzia[łl]|chapter|część|akt|wstęp|prolog|epilog)\b/i.test(line.text) ||
        (line.isUpper && line.text.length < 50 && line.fontSize >= 11);

      // Check if this indicates a new chapter
      if (isChapterHeadingCandidate && currentChapter.paragraphs.length > 0) {
        flushParagraph();
        if (currentChapter.paragraphs.length > 0) {
          if (currentChapter.pageRange) {
            currentChapter.pageRange.end = pageNum;
          }
          chapters.push(currentChapter);
        }

        currentChapter = {
          id: `ch-${chapters.length + 1}`,
          title: line.text,
          paragraphs: [],
          pageRange: { start: pageNum, end: pageNum },
        };
        // Add heading as first element of new chapter
        currentChapter.paragraphs.push({
          text: line.text,
          isHeading: true,
          headingLevel: 1,
          fontSize: Math.max(14, line.fontSize),
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
        flushParagraph(false, 0, lastFontSize);
      }

      paragraphBuffer.push(line.text);
      lastLineY = line.y;
      lastFontSize = line.fontSize;
    }

    flushParagraph(false, 0, lastFontSize);

    if (currentChapter.pageRange) {
      currentChapter.pageRange.end = pageNum;
    }

    page.cleanup();
  }

  if (currentChapter.paragraphs.length > 0) {
    chapters.push(currentChapter);
  }

  // If no chapters detected (single block), create at least one structured chapter
  if (chapters.length === 0) {
    chapters.push({
      id: 'ch-1',
      title: 'Treść Główna',
      paragraphs: [
        {
          text: 'Brak odczytanego tekstu z dokumentu źródłowego lub dokument zawiera wyłącznie grafiki rastrowe.',
          isHeading: false,
        },
      ],
      pageRange: { start: 1, end: numPages || 1 },
    });
  } else {
    // If the first chapter has title "Wprowadzenie" and its first paragraph is a heading, update title
    if (chapters[0].title === 'Wprowadzenie' && chapters[0].paragraphs[0]?.isHeading) {
      chapters[0].title = chapters[0].paragraphs[0].text;
    }
  }

  return {
    title: detectedTitle || 'Dokument A5 Amazon KDP',
    author: 'Autor Publikacji',
    chapters,
    totalWords: totalWordsCount,
    sourcePageCount: numPages,
  };
}
