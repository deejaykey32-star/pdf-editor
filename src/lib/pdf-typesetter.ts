import { PDFDocument, rgb, StandardFonts, PDFFont } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { KdpPrintConfig, ExtractedBookModel, ExtractedChapter, ExtractedParagraph } from '@/types/kdp-epub';
import { mmToPt } from './coordinates';
import { QRCodeItem } from '@/types/pdf';
import { generateQRPngBytes, resolvePageContent } from './qr-generator';
import { sanitizeExtractedText } from './pdf-text-extractor';

export interface GenerateKdpPdfOptions {
  config: KdpPrintConfig;
  bookModel: ExtractedBookModel;
  originalBytes?: Uint8Array;
  qrItems?: QRCodeItem[];
  onProgress?: (current: number, total: number) => void;
}

// Standard DIN A5 Dimensions in mm and pt
const A5_WIDTH_MM = 148;
const A5_HEIGHT_MM = 210;
const A5_WIDTH_PT = 419.53;
const A5_HEIGHT_PT = 595.28;

/**
 * Loads font bytes safely from public/fonts or fallback
 */
async function loadFontBytes(url: string): Promise<Uint8Array | null> {
  try {
    if (typeof window !== 'undefined') {
      const resp = await fetch(url);
      if (resp.ok) {
        const ab = await resp.arrayBuffer();
        return new Uint8Array(ab);
      }
    }
  } catch (err) {
    console.warn(`Could not load font from ${url}, falling back to standard font:`, err);
  }
  return null;
}

/**
 * Normalizes text for standard fonts if TTF Unicode font is not available
 */
function sanitizeForStandardFont(text: string): string {
  return text
    .replace(/ą/g, 'a')
    .replace(/ć/g, 'c')
    .replace(/ę/g, 'e')
    .replace(/ł/g, 'l')
    .replace(/ń/g, 'n')
    .replace(/ó/g, 'o')
    .replace(/ś/g, 's')
    .replace(/ź/g, 'z')
    .replace(/ż/g, 'z')
    .replace(/Ą/g, 'A')
    .replace(/Ć/g, 'C')
    .replace(/Ę/g, 'E')
    .replace(/Ł/g, 'L')
    .replace(/Ń/g, 'N')
    .replace(/Ó/g, 'O')
    .replace(/Ś/g, 'S')
    .replace(/Ź/g, 'Z')
    .replace(/Ż/g, 'Z')
    .replace(/[„”«»]/g, '"')
    .replace(/[’‘]/g, "'")
    .replace(/[–—]/g, '-');
}

/**
 * Splits extra-long tokens/words (e.g. URLs or long words) with a hyphen
 * so that no single token can ever overflow past the right margin.
 */
function splitLongWord(
  word: string,
  font: PDFFont,
  fontSize: number,
  maxWidth: number
): string[] {
  let wordWidth: number;
  try {
    wordWidth = font.widthOfTextAtSize(word, fontSize);
  } catch {
    wordWidth = font.widthOfTextAtSize(sanitizeForStandardFont(word), fontSize);
  }

  if (wordWidth <= maxWidth || word.length <= 4) {
    return [word];
  }

  const chunks: string[] = [];
  let currentChunk = '';
  const hyphenWidth = font.widthOfTextAtSize('-', fontSize);

  for (let i = 0; i < word.length; i++) {
    const char = word[i];
    const candidate = currentChunk + char;
    let candidateWidth: number;
    try {
      candidateWidth = font.widthOfTextAtSize(candidate, fontSize) + hyphenWidth;
    } catch {
      candidateWidth = font.widthOfTextAtSize(sanitizeForStandardFont(candidate), fontSize) + hyphenWidth;
    }

    if (candidateWidth <= maxWidth || currentChunk.length === 0) {
      currentChunk += char;
    } else {
      chunks.push(currentChunk + '-');
      currentChunk = char;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * Line breaking and high-precision full two-sided justification engine,
 * guaranteed to stay strictly within [0, columnWidth].
 */
interface JustifiedLine {
  words: string[];
  isLastLineOfParagraph: boolean;
  totalWordsWidth: number;
  availableWidth: number;
  firstLineIndent: number;
}

function breakParagraphIntoJustifiedLines(
  text: string,
  font: PDFFont,
  fontSize: number,
  columnWidth: number,
  firstLineIndentPt: number
): JustifiedLine[] {
  const rawWords = text.split(/\s+/).filter(Boolean);
  if (rawWords.length === 0) return [];

  // Break any token that exceeds available width so nothing ever overflows the margin
  const maxTokenWidth = Math.max(30, columnWidth - firstLineIndentPt);
  const words: string[] = [];
  for (const rw of rawWords) {
    const parts = splitLongWord(rw, font, fontSize, maxTokenWidth);
    words.push(...parts);
  }

  const spaceWidth = font.widthOfTextAtSize(' ', fontSize);
  const lines: JustifiedLine[] = [];

  let currentWords: string[] = [];
  let currentWordsWidth = 0;
  let isFirstLine = true;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    let wordWidth: number;
    try {
      wordWidth = font.widthOfTextAtSize(word, fontSize);
    } catch {
      wordWidth = font.widthOfTextAtSize(sanitizeForStandardFont(word), fontSize);
    }

    const currentIndent = isFirstLine ? firstLineIndentPt : 0;
    const availableWidth = columnWidth - currentIndent;
    const prospectiveSpaces = currentWords.length;
    const prospectiveWidth = currentWordsWidth + wordWidth + prospectiveSpaces * spaceWidth;

    if (prospectiveWidth <= availableWidth || currentWords.length === 0) {
      currentWords.push(word);
      currentWordsWidth += wordWidth;
    } else {
      // Line is full -> push as justified line
      lines.push({
        words: currentWords,
        isLastLineOfParagraph: false,
        totalWordsWidth: currentWordsWidth,
        availableWidth,
        firstLineIndent: currentIndent,
      });

      // Start next line
      currentWords = [word];
      currentWordsWidth = wordWidth;
      isFirstLine = false;
    }
  }

  // Push remaining words as the last line of the paragraph
  if (currentWords.length > 0) {
    const currentIndent = isFirstLine ? firstLineIndentPt : 0;
    lines.push({
      words: currentWords,
      isLastLineOfParagraph: true,
      totalWordsWidth: currentWordsWidth,
      availableWidth: columnWidth - currentIndent,
      firstLineIndent: currentIndent,
    });
  }

  return lines;
}

/**
 * Generates an Amazon KDP Print-Ready PDF adhering to A5 specs,
 * bleed, alternating gutter margins, strictly 12pt typography for all text/headings,
 * with zero overflow beyond page boundaries or margins.
 */
export async function generateKdpA5PrintPdf({
  config,
  bookModel,
  originalBytes,
  qrItems = [],
  onProgress,
}: GenerateKdpPdfOptions): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  // Load custom serif font (Georgia) or fallback
  let regularFont: PDFFont;
  let boldFont: PDFFont;

  const georgiaBytes = await loadFontBytes('/fonts/georgia.ttf');
  const georgiaBoldBytes = await loadFontBytes('/fonts/georgiab.ttf');

  if (georgiaBytes && georgiaBoldBytes) {
    try {
      regularFont = await pdfDoc.embedFont(georgiaBytes);
      boldFont = await pdfDoc.embedFont(georgiaBoldBytes);
    } catch (e) {
      console.warn('Failed to embed Georgia font, falling back to Times Roman:', e);
      regularFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
      boldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
    }
  } else {
    regularFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    boldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  }

  const safeDrawText = (page: import('pdf-lib').PDFPage, text: string, options: any) => {
    try {
      page.drawText(text, options);
    } catch {
      page.drawText(sanitizeForStandardFont(text), options);
    }
  };

  // Dimensional calculations
  const hasBleed = config.bleed === 'kdp-standard';
  const bleedPt = hasBleed ? mmToPt(config.bleedMm) : 0;

  // With standard KDP bleed: 154.4 x 216.4 mm
  const pageWidthMm = hasBleed ? A5_WIDTH_MM + 2 * config.bleedMm : A5_WIDTH_MM;
  const pageHeightMm = hasBleed ? A5_HEIGHT_MM + 2 * config.bleedMm : A5_HEIGHT_MM;
  const pageWidthPt = mmToPt(pageWidthMm);
  const pageHeightPt = mmToPt(pageHeightMm);

  const gutterPt = mmToPt(config.gutterMarginMm);
  const outerPt = mmToPt(config.outerMarginMm);
  const topPt = mmToPt(config.topMarginMm) + bleedPt;
  const bottomPt = mmToPt(config.bottomMarginMm) + bleedPt;
  const columnWidthPt = A5_WIDTH_PT - gutterPt - outerPt;
  const columnHeightPt = A5_HEIGHT_PT - topPt - bottomPt;

  // Strict 12pt formatting across all text & headings
  const FONT_SIZE_12PT = 12;
  const LINE_HEIGHT_16PT = 16;
  const firstLineIndentPt = mmToPt(config.firstLineIndentMm || 5);

  // ----------------------------------------------------
  // BRANCH 1: Page Imposition Mode (existing PDF pages)
  // ----------------------------------------------------
  if (config.mode === 'impose-pages' && originalBytes && originalBytes.byteLength > 0) {
    const origDoc = await PDFDocument.load(originalBytes, { ignoreEncryption: true });
    const origPages = origDoc.getPages();
    const embeddedPages = await pdfDoc.embedPages(origPages);

    for (let i = 0; i < origPages.length; i++) {
      const pageNum = i + 1;
      const isOdd = pageNum % 2 !== 0;

      const page = pdfDoc.addPage([pageWidthPt, pageHeightPt]);
      if (hasBleed) {
        page.setTrimBox(bleedPt, bleedPt, A5_WIDTH_PT, A5_HEIGHT_PT);
        page.setBleedBox(0, 0, pageWidthPt, pageHeightPt);
      }

      const origW = origPages[i].getWidth();
      const origH = origPages[i].getHeight();

      // Scale to fit comfortably inside the safe margin box
      const scaleX = columnWidthPt / origW;
      const scaleY = columnHeightPt / origH;
      const fitScale = Math.min(scaleX, scaleY, 1.0);

      const placedW = origW * fitScale;
      const placedH = origH * fitScale;

      const leftMargin = bleedPt + (isOdd ? gutterPt : outerPt);
      const drawX = leftMargin + (columnWidthPt - placedW) / 2;
      const drawY = bottomPt + (columnHeightPt - placedH) / 2;

      page.drawPage(embeddedPages[i], {
        x: drawX,
        y: drawY,
        xScale: fitScale,
        yScale: fitScale,
      });

      // Running Header & Footer
      if (config.pageNumbers) {
        const pageNumText = String(pageNum);
        const numWidth = regularFont.widthOfTextAtSize(pageNumText, 9);
        const numX = isOdd
          ? pageWidthPt - bleedPt - outerPt - numWidth
          : bleedPt + outerPt;
        safeDrawText(page, pageNumText, {
          x: numX,
          y: bottomPt - 18,
          size: 9,
          font: regularFont,
          color: rgb(0.3, 0.3, 0.3),
        });
      }

      onProgress?.(pageNum, origPages.length);
    }

    return await pdfDoc.save();
  }

  // ----------------------------------------------------
  // BRANCH 2: Reflow Book Typesetting Mode (Strict 12pt Justified)
  // ----------------------------------------------------
  let currentPageNumber = 1;
  let currentPage: import('pdf-lib').PDFPage | null = null;
  let cursorY = 0;
  let isChapterStartPage = false;
  let activeChapterTitle = '';

  const startNewPage = () => {
    currentPage = pdfDoc.addPage([pageWidthPt, pageHeightPt]);
    if (hasBleed) {
      currentPage.setTrimBox(bleedPt, bleedPt, A5_WIDTH_PT, A5_HEIGHT_PT);
      currentPage.setBleedBox(0, 0, pageWidthPt, pageHeightPt);
    }

    const isOdd = currentPageNumber % 2 !== 0;
    const contentTopY = pageHeightPt - topPt;
    cursorY = contentTopY;

    // Running Header (omit on chapter start page or title page)
    if (config.runningHeader && !isChapterStartPage && currentPageNumber > 1) {
      const headerY = pageHeightPt - topPt + 14;
      let rawHeaderText = isOdd ? activeChapterTitle : (config.bookTitle || bookModel.title);
      let cleanHeaderText = sanitizeExtractedText(rawHeaderText, config.excludedPatterns);

      const headerSize = 9;
      const maxHeaderW = columnWidthPt * 0.72;
      let textW = regularFont.widthOfTextAtSize(sanitizeForStandardFont(cleanHeaderText), headerSize);

      // Truncate if header would exceed safe area
      if (textW > maxHeaderW) {
        while (cleanHeaderText.length > 3 && textW > maxHeaderW) {
          cleanHeaderText = cleanHeaderText.slice(0, -1);
          textW = regularFont.widthOfTextAtSize(sanitizeForStandardFont(cleanHeaderText + '...'), headerSize);
        }
        cleanHeaderText += '...';
      }

      const headerX = isOdd
        ? pageWidthPt - bleedPt - outerPt - textW
        : bleedPt + outerPt;

      safeDrawText(currentPage, cleanHeaderText, {
        x: headerX,
        y: headerY,
        size: headerSize,
        font: regularFont,
        color: rgb(0.4, 0.4, 0.4),
      });

      // Subtle header divider line
      const lineLeft = bleedPt + (isOdd ? gutterPt : outerPt);
      const lineRight = lineLeft + columnWidthPt;
      currentPage.drawLine({
        start: { x: lineLeft, y: headerY - 5 },
        end: { x: lineRight, y: headerY - 5 },
        thickness: 0.5,
        color: rgb(0.85, 0.85, 0.85),
      });
    }

    // Running Footer (Page Numbers)
    if (config.pageNumbers) {
      const pageNumStr = String(currentPageNumber);
      const numSize = 9;
      const numWidth = regularFont.widthOfTextAtSize(pageNumStr, numSize);
      const footerY = bottomPt - 20;

      const numX = isOdd
        ? pageWidthPt - bleedPt - outerPt - numWidth
        : bleedPt + outerPt;

      safeDrawText(currentPage, pageNumStr, {
        x: numX,
        y: footerY,
        size: numSize,
        font: regularFont,
        color: rgb(0.3, 0.3, 0.3),
      });
    }

    currentPageNumber++;
    isChapterStartPage = false;
  };

  // 1. Optional Half-Title / Title Page (strictly 12pt wrapped)
  const rawBookTitle = config.bookTitle || bookModel.title || '';
  const cleanBookTitle = sanitizeExtractedText(rawBookTitle, config.excludedPatterns);

  const rawAuthor = config.author || bookModel.author || '';
  const cleanAuthor = sanitizeExtractedText(rawAuthor, config.excludedPatterns);
  const isAuthorValid = Boolean(cleanAuthor && !/^(autor|autor publikacji|unknown)$/i.test(cleanAuthor.trim()));

  const hasDistinctTitlePage = Boolean(
    cleanBookTitle &&
    cleanBookTitle.toLowerCase() !== 'wstęp' &&
    cleanBookTitle.length > 2 &&
    cleanBookTitle !== bookModel.chapters[0]?.title
  );

  startNewPage();
  const isOddFirst = (currentPageNumber - 1) % 2 !== 0;
  const leftXFirst = bleedPt + (isOddFirst ? gutterPt : outerPt);

  if (hasDistinctTitlePage) {
    cursorY -= 60;
    const titleLines = breakParagraphIntoJustifiedLines(
      cleanBookTitle,
      boldFont,
      FONT_SIZE_12PT,
      columnWidthPt,
      0
    );

    for (const tl of titleLines) {
      let curX = leftXFirst;
      for (const w of tl.words) {
        safeDrawText(currentPage!, w, {
          x: curX,
          y: cursorY,
          size: FONT_SIZE_12PT,
          font: boldFont,
          color: rgb(0.1, 0.1, 0.15),
        });
        curX += boldFont.widthOfTextAtSize(w, FONT_SIZE_12PT) + boldFont.widthOfTextAtSize(' ', FONT_SIZE_12PT);
      }
      cursorY -= LINE_HEIGHT_16PT;
    }

    if (isAuthorValid) {
      cursorY -= 10;
      safeDrawText(currentPage!, cleanAuthor, {
        x: leftXFirst,
        y: cursorY,
        size: FONT_SIZE_12PT,
        font: regularFont,
        color: rgb(0.35, 0.35, 0.4),
      });
    }

    cursorY -= 15;
    currentPage!.drawLine({
      start: { x: leftXFirst, y: cursorY },
      end: { x: leftXFirst + columnWidthPt, y: cursorY },
      thickness: 1,
      color: rgb(0.8, 0.82, 0.85),
    });
    cursorY -= 35;
  }

  // 2. Typeset all chapters (Strictly 12pt format, no overflow)
  const totalChapters = bookModel.chapters.length;

  for (let chIdx = 0; chIdx < totalChapters; chIdx++) {
    const chapter = bookModel.chapters[chIdx];
    let cleanChapterTitle = sanitizeExtractedText(chapter.title, config.excludedPatterns);

    // Normalize "Wstęp do..." into clean "Wstęp"
    if (/^wst[eę]p\b/i.test(cleanChapterTitle)) {
      cleanChapterTitle = 'Wstęp';
    }

    // Skip empty or noise chapters
    if (!cleanChapterTitle) continue;
    activeChapterTitle = cleanChapterTitle;

    // Start each chapter on a fresh page (or on page 1 if no separate title page)
    if (currentPageNumber > 2 || (hasDistinctTitlePage && currentPageNumber > 1)) {
      isChapterStartPage = true;
      startNewPage();
    }

    const curIsOdd = (currentPageNumber - 1) % 2 !== 0;
    const curLeftX = bleedPt + (curIsOdd ? gutterPt : outerPt);

    // Chapter Header (strictly 12pt bold, wrapped to prevent margin overflow)
    cursorY -= 15;
    const chapterHeadingLines = breakParagraphIntoJustifiedLines(
      cleanChapterTitle,
      boldFont,
      FONT_SIZE_12PT,
      columnWidthPt,
      0
    );

    for (const chLine of chapterHeadingLines) {
      if (cursorY - LINE_HEIGHT_16PT < bottomPt + 5) {
        startNewPage();
      }
      let curX = curLeftX;
      for (const w of chLine.words) {
        safeDrawText(currentPage!, w, {
          x: curX,
          y: cursorY,
          size: FONT_SIZE_12PT,
          font: boldFont,
          color: rgb(0.1, 0.15, 0.25),
        });
        curX += boldFont.widthOfTextAtSize(w, FONT_SIZE_12PT) + boldFont.widthOfTextAtSize(' ', FONT_SIZE_12PT);
      }
      cursorY -= LINE_HEIGHT_16PT;
    }

    // Small divider under chapter heading
    cursorY -= 6;
    currentPage!.drawLine({
      start: { x: curLeftX, y: cursorY },
      end: { x: Math.min(curLeftX + 50, curLeftX + columnWidthPt), y: cursorY },
      thickness: 1.5,
      color: rgb(0.2, 0.4, 0.8),
    });
    cursorY -= 20;

    // Paragraphs in chapter
    for (let pIdx = 0; pIdx < chapter.paragraphs.length; pIdx++) {
      const paragraph = chapter.paragraphs[pIdx];
      const cleanParaText = sanitizeExtractedText(paragraph.text, config.excludedPatterns);
      if (!cleanParaText || cleanParaText.length <= 1) continue;

      // Skip repeating chapter title if it was first paragraph
      if (pIdx === 0 && paragraph.isHeading && cleanParaText === cleanChapterTitle) {
        continue;
      }

      const isFirstParaOfChapter = pIdx === 0 || (pIdx === 1 && chapter.paragraphs[0].isHeading);
      const applyIndent = !isFirstParaOfChapter && !paragraph.isHeading;
      const indentPt = applyIndent ? firstLineIndentPt : 0;

      const pFont = paragraph.isHeading || paragraph.isBold ? boldFont : regularFont;

      if (paragraph.isHeading) {
        cursorY -= 10;
      }

      const justifiedLines = breakParagraphIntoJustifiedLines(
        cleanParaText,
        pFont,
        FONT_SIZE_12PT,
        columnWidthPt,
        indentPt
      );

      for (let lIdx = 0; lIdx < justifiedLines.length; lIdx++) {
        const line = justifiedLines[lIdx];

        // Ensure vertical margin is strictly respected
        if (cursorY - LINE_HEIGHT_16PT < bottomPt + 5) {
          startNewPage();
        }

        const lineIsOdd = (currentPageNumber - 1) % 2 !== 0;
        const lineLeftMargin = bleedPt + (lineIsOdd ? gutterPt : outerPt);
        const startX = lineLeftMargin + line.firstLineIndent;
        const maxLineRightX = lineLeftMargin + line.availableWidth;

        // Render line
        if (line.isLastLineOfParagraph || line.words.length <= 1) {
          // Left-aligned with standard space
          let currentWordX = startX;
          const standardSpace = pFont.widthOfTextAtSize(' ', FONT_SIZE_12PT);

          for (const word of line.words) {
            let wWidth: number;
            try {
              wWidth = pFont.widthOfTextAtSize(word, FONT_SIZE_12PT);
            } catch {
              wWidth = pFont.widthOfTextAtSize(sanitizeForStandardFont(word), FONT_SIZE_12PT);
            }

            // Strictly clamp so nothing overflows
            const clampedX = Math.min(currentWordX, maxLineRightX - wWidth);
            safeDrawText(currentPage!, word, {
              x: Math.max(lineLeftMargin, clampedX),
              y: cursorY,
              size: FONT_SIZE_12PT,
              font: pFont,
              color: rgb(0.12, 0.12, 0.12),
            });
            currentWordX += wWidth + standardSpace;
          }
        } else {
          // Fully justified: distribute remaining space evenly
          const numGaps = line.words.length - 1;
          const totalGapSpace = line.availableWidth - line.totalWordsWidth;
          const standardSpace = pFont.widthOfTextAtSize(' ', FONT_SIZE_12PT);
          let justifiedGapWidth = totalGapSpace / numGaps;

          // Cap gap width if too few words to avoid excessive whitespace
          if (justifiedGapWidth > standardSpace * 2.8) {
            justifiedGapWidth = standardSpace * 1.5;
          }

          let currentWordX = startX;
          for (let w = 0; w < line.words.length; w++) {
            const word = line.words[w];
            let wWidth: number;
            try {
              wWidth = pFont.widthOfTextAtSize(word, FONT_SIZE_12PT);
            } catch {
              wWidth = pFont.widthOfTextAtSize(sanitizeForStandardFont(word), FONT_SIZE_12PT);
            }

            // Strictly clamp to prevent overflowing right margin
            const clampedX = Math.min(currentWordX, maxLineRightX - wWidth);
            safeDrawText(currentPage!, word, {
              x: Math.max(lineLeftMargin, clampedX),
              y: cursorY,
              size: FONT_SIZE_12PT,
              font: pFont,
              color: rgb(0.12, 0.12, 0.12),
            });
            currentWordX += wWidth + justifiedGapWidth;
          }
        }

        cursorY -= LINE_HEIGHT_16PT;
      }

      cursorY -= paragraph.isHeading ? 8 : 4;
    }

    onProgress?.(chIdx + 1, totalChapters);
  }

  // Draw any document QR codes into appendix if requested
  if (config.includeQRCodes && qrItems.length > 0) {
    const totalGeneratedPages = pdfDoc.getPageCount();
    for (const item of qrItems) {
      try {
        const qrContent = resolvePageContent(item, 1, totalGeneratedPages);
        const qrPng = await generateQRPngBytes(qrContent, item, 256);
        const qrImage = await pdfDoc.embedPng(qrPng);

        const targetPage = pdfDoc.getPage(totalGeneratedPages - 1);
        const qrPt = mmToPt(item.sizeMm || 25);
        targetPage.drawImage(qrImage, {
          x: (pageWidthPt - qrPt) / 2,
          y: bottomPt + 20,
          width: qrPt,
          height: qrPt,
        });
      } catch (err) {
        console.warn('Failed to embed QR in KDP PDF:', err);
      }
    }
  }

  return await pdfDoc.save();
}
