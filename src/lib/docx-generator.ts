import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  PageOrientation,
  BorderStyle,
  Packer,
  convertMillimetersToTwip,
  Header,
  Footer,
  PageNumber,
  ImageRun,
  PageBreak,
  Bookmark,
  TableOfContents,
} from 'docx';
import { DocxConfig, ExtractedBookModel } from '@/types/kdp-epub';
import { QRCodeItem } from '@/types/pdf';
import { generateQRPngBytes, resolvePageContent } from './qr-generator';
import { sanitizeExtractedText, deduplicateDayHeading, parseDayHeading } from './pdf-text-extractor';

export interface GenerateDocxOptions {
  config: DocxConfig;
  bookModel: ExtractedBookModel;
  qrItems?: QRCodeItem[];
  onProgress?: (current: number, total: number, stage: string) => void;
}

/**
 * Generates an official, standard-compliant Microsoft Word (.docx) document
 * strictly configured for Amazon KDP Paperback A5 book printing.
 *
 * Key KDP Print Setup:
 * - DIN A5 Paper: 148 mm × 210 mm
 * - Mirror Margins (Lustrzane marginesy):
 *   - Inside / Gutter (Grzbiet): 18 mm (default)
 *   - Outside (Zewnętrzny): 13 mm
 *   - Top (Górny): 15 mm
 *   - Bottom (Dolny): 15 mm
 *   - Header / Footer: 10 mm
 * - Typography:
 *   - Strictly 12 pt (or user configured font size)
 *   - Font Family: Georgia or Times New Roman
 *   - Text Alignment: Fully Justified (wyjustowany obustronnie)
 *   - Line Spacing: 1.15 to 1.25
 *   - First-line Indent: 5 mm (0.5 cm) on body paragraphs
 * - Headings:
 *   - Chapter 0: "Wprowadzenie"
 *   - Chapters 1 to 175: "DZIEŃ 1" to "DZIEŃ 175"
 *   - Chapter Title: 12 pt Bold with bottom accent border, pageBreakBefore: true
 *   - Subheadings: 12 pt Bold, keepWithNext: true, continuous flow without empty pages
 *
 * When opened in Microsoft Word, saving or exporting directly to PDF
 * produces a 100% print-ready Amazon KDP A5 PDF.
 */
export async function generateKdpDocxPackage({
  config,
  bookModel,
  qrItems = [],
  onProgress,
}: GenerateDocxOptions): Promise<Uint8Array> {
  const fontSizePt = Math.max(8, Math.min(24, config.fontSizePt || 12));
  const fontHalfPoints = fontSizePt * 2;
  const fontFamily = config.fontFamily === 'times' ? 'Times New Roman' : 'Georgia';

  const a5WidthTwips = convertMillimetersToTwip(148);
  const a5HeightTwips = convertMillimetersToTwip(210);

  const topMarginTwips = convertMillimetersToTwip(config.topMarginMm || 15);
  const bottomMarginTwips = convertMillimetersToTwip(config.bottomMarginMm || 15);
  const insideMarginTwips = convertMillimetersToTwip(config.gutterMarginMm || 18);
  const outsideMarginTwips = convertMillimetersToTwip(config.outerMarginMm || 13);
  const headerMarginTwips = convertMillimetersToTwip(10);
  const footerMarginTwips = convertMillimetersToTwip(10);
  const firstLineIndentTwips = convertMillimetersToTwip(config.firstLineIndentMm || 5);

  const lineSpacingTwips = Math.round((config.lineSpacing || 1.15) * 240);

  const excludedPatterns = config.excludedPatterns || [];

  const children: (Paragraph | any)[] = [];

  // 1. Title Page (Strona Tytułowa)
  const bookTitle = sanitizeExtractedText(config.title || bookModel.title || 'Publikacja Książkowa', excludedPatterns);
  const author = sanitizeExtractedText(config.author || bookModel.author || '', excludedPatterns);

  if (bookTitle) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 2400, after: 300 },
        children: [
          new TextRun({
            text: bookTitle,
            font: fontFamily,
            bold: true,
            size: fontHalfPoints + 12, // slightly larger on title page
            color: '111827',
          }),
        ],
      })
    );

    if (author) {
      children.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 100, after: 600 },
          children: [
            new TextRun({
              text: author,
              font: fontFamily,
              size: fontHalfPoints,
              color: '4B5563',
            }),
          ],
        })
      );
    }

    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 800, after: 400 },
        children: [
          new TextRun({
            text: '— Wydanie Drukarskie Amazon KDP A5 (Format 12 pt) —',
            font: fontFamily,
            size: fontHalfPoints - 4,
            color: '6B7280',
            italics: true,
          }),
        ],
      })
    );

    // Page break after title page
    children.push(
      new Paragraph({
        children: [new PageBreak()],
      })
    );
  }

  // 2. Process Chapters (Chapter 0 = Wprowadzenie, Chapters 1..175 = Dni)
  const totalChapters = bookModel.chapters.length;
  interface TocChapterEntry {
    title: string;
    bookmarkId: string;
  }
  const tocChapters: TocChapterEntry[] = [];

  for (let chIdx = 0; chIdx < totalChapters; chIdx++) {
    const chapter = bookModel.chapters[chIdx];
    let cleanChapterTitle = sanitizeExtractedText(chapter.title, excludedPatterns);

    // Normalize Chapter 0 to "Wprowadzenie"
    if (/^wst[eę]p\b/i.test(cleanChapterTitle) || chapter.id === 'ch-intro') {
      cleanChapterTitle = 'Wprowadzenie';
    }
    if (!cleanChapterTitle && chapter.paragraphs.length > 0) {
      cleanChapterTitle = chIdx === 0 ? 'Wprowadzenie' : `Dzień ${chIdx}`;
    }
    if (!cleanChapterTitle || chapter.paragraphs.length === 0) continue;

    const bookmarkId = `ch_bookmark_${chIdx}`;
    tocChapters.push({
      title: cleanChapterTitle,
      bookmarkId,
    });

    onProgress?.(chIdx + 1, totalChapters, `Formatowanie rozdziału: ${cleanChapterTitle}...`);

    // Chapter Title (Native Word Heading 1 with Bookmark for TOC links)
    // Starts on a new page in Word, has bottom divider line, formatted with native Word Heading 1 style
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: chIdx > 0 || !!bookTitle, // start on a fresh page
        keepNext: true,
        alignment: AlignmentType.LEFT,
        spacing: { before: 360, after: 200 },
        border: {
          bottom: {
            style: BorderStyle.SINGLE,
            size: 12, // 1.5 pt
            color: '2563EB',
            space: 6,
          },
        },
        children: [
          new Bookmark({
            id: bookmarkId,
            children: [
              new TextRun({
                text: cleanChapterTitle,
              }),
            ],
          }),
        ],
      })
    );

    // Paragraphs within chapter
    let renderedParasCount = 0;

    for (let pIdx = 0; pIdx < chapter.paragraphs.length; pIdx++) {
      const p = chapter.paragraphs[pIdx];
      let cleanParaText = sanitizeExtractedText(p.text, excludedPatterns);
      if (p.isHeading && (/^wst[eę]p\b/i.test(cleanParaText) || cleanParaText === 'Wprowadzenie')) {
        cleanParaText = 'Wprowadzenie';
      }
      if (!cleanParaText || cleanParaText.length <= 1) continue;

      // Skip duplicate of chapter title or day header (remove duplicate black bold heading)
      const normPara = deduplicateDayHeading(cleanParaText).replace(/\s+/g, ' ').trim().toLowerCase();
      const normTitle = deduplicateDayHeading(cleanChapterTitle).replace(/\s+/g, ' ').trim().toLowerCase();

      const isTitleOrDayDuplicate =
        (pIdx === 0 && p.isHeading) ||
        (p.isHeading && p.headingLevel === 1) ||
        normPara === normTitle ||
        (cleanChapterTitle === 'Wprowadzenie' && (/^wst[eę]p\b/i.test(cleanParaText) || cleanParaText === 'Wprowadzenie')) ||
        (/^dzień\s+\d+/i.test(cleanParaText) && parseDayHeading(cleanParaText)?.dayNum === chIdx);

      if (isTitleOrDayDuplicate) {
        continue;
      }

      if (p.isHeading) {
        // In-chapter Subheading (Część, Tajemnica, Etap, Modlitwa, Rozważanie)
        children.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            keepNext: true,
            alignment: AlignmentType.LEFT,
            spacing: { before: 240, after: 80 },
            children: [
              new TextRun({
                text: cleanParaText,
                font: fontFamily,
                bold: true,
                size: fontHalfPoints,
                color: '1F2937',
              }),
            ],
          })
        );
      } else {
        // Regular body paragraph
        const applyIndent = renderedParasCount > 0 && !p.isBold;
        children.push(
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            indent: {
              firstLine: applyIndent ? firstLineIndentTwips : 0,
            },
            spacing: {
              line: lineSpacingTwips,
              after: 100, // gentle paragraph bottom spacing (~5 pt)
            },
            children: [
              new TextRun({
                text: cleanParaText,
                font: fontFamily,
                size: fontHalfPoints,
                bold: !!p.isBold,
                color: '1F2937',
              }),
            ],
          })
        );
        renderedParasCount++;
      }
    }

    if (chIdx % 5 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  // 3. QR Code Appendix (if enabled and QR items exist)
  if (config.includeQRCodes && qrItems.length > 0) {
    onProgress?.(totalChapters, totalChapters, 'Dodawanie załącznika z kodami QR...');

    const qrBookmarkId = 'appendix_qr_codes';
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        pageBreakBefore: true,
        keepNext: true,
        alignment: AlignmentType.LEFT,
        spacing: { before: 360, after: 200 },
        border: {
          bottom: {
            style: BorderStyle.SINGLE,
            size: 12,
            color: '2563EB',
            space: 6,
          },
        },
        children: [
          new Bookmark({
            id: qrBookmarkId,
            children: [
              new TextRun({
                text: 'Dodatek: Kody QR do Publikacji',
              }),
            ],
          }),
        ],
      })
    );

    for (let i = 0; i < qrItems.length; i++) {
      const qrItem = qrItems[i];
      try {
        const qrContent = resolvePageContent(qrItem, 1, 1);
        const qrPngBytes = await generateQRPngBytes(qrContent, qrItem, 300);

        children.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 240, after: 100 },
            children: [
              new TextRun({
                text: qrItem.label || `Kod QR #${i + 1}`,
                font: fontFamily,
                bold: true,
                size: fontHalfPoints,
              }),
            ],
          })
        );

        children.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 100, after: 100 },
            children: [
              new ImageRun({
                type: 'png',
                data: qrPngBytes,
                transformation: {
                  width: 140,
                  height: 140,
                },
              }),
            ],
          })
        );

        children.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 60, after: 240 },
            children: [
              new TextRun({
                text: qrContent,
                font: fontFamily,
                size: fontHalfPoints - 4,
                color: '2563EB',
              }),
            ],
          })
        );
      } catch (err) {
        console.warn(`Could not embed QR code #${i + 1} into DOCX:`, err);
      }
    }
  }

  // 4. Automatic Table of Contents at the end of the document (Spis treści na końcu z linkami)
  if (config.includeTableOfContents !== false) {
    onProgress?.(totalChapters, totalChapters, 'Generowanie automatycznego spisu treści...');

    children.push(
      new Paragraph({
        text: 'Spis treści',
        heading: HeadingLevel.TITLE,
        pageBreakBefore: true,
        keepNext: true,
        alignment: AlignmentType.LEFT,
        spacing: { before: 360, after: 240 },
        border: {
          bottom: {
            style: BorderStyle.SINGLE,
            size: 12,
            color: '2563EB',
            space: 6,
          },
        },
      })
    );

    const cachedEntries = tocChapters.map((ch, idx) => ({
      title: ch.title,
      level: 1,
      page: idx + 1,
      href: ch.bookmarkId,
    }));

    children.push(
      new TableOfContents('Spis treści', {
        hyperlink: true,
        headingStyleRange: '1-1',
        cachedEntries,
      })
    );
  }

  // 5. Configure Headers and Footers (Natywne numerowanie stron i żywa pagina)
  const headersConfig: any = {};
  const footersConfig: any = {};

  if (config.runningHeader) {
    // Odd pages (Recto): right-aligned
    headersConfig.default = new Header({
      children: [
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [
            new TextRun({
              text: bookTitle || 'Publikacja Amazon KDP',
              font: fontFamily,
              size: 18, // 9 pt
              color: '6B7280',
              italics: true,
            }),
          ],
        }),
      ],
    });

    // Even pages (Verso): left-aligned
    headersConfig.even = new Header({
      children: [
        new Paragraph({
          alignment: AlignmentType.LEFT,
          children: [
            new TextRun({
              text: bookTitle || 'Publikacja Amazon KDP',
              font: fontFamily,
              size: 18, // 9 pt
              color: '6B7280',
              italics: true,
            }),
          ],
        }),
      ],
    });
  }

  if (config.pageNumbers) {
    // Native Word Page Numbering in Footers for both Odd (default) and Even pages
    const createPageNumberFooter = () =>
      new Footer({
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                children: [PageNumber.CURRENT],
                font: fontFamily,
                size: 20, // 10 pt
                color: '4B5563',
              }),
            ],
          }),
        ],
      });

    footersConfig.default = createPageNumberFooter();
    footersConfig.even = createPageNumberFooter();
  }

  // 6. Build Document with A5 Page Size and Mirror Margins
  const doc = new Document({
    creator: 'PDF Editor & Amazon KDP Studio',
    title: bookTitle,
    description: 'Amazon KDP A5 Print Publication formatted for Microsoft Word and PDF export',
    features: {
      updateFields: true,
    },
    evenAndOddHeaderAndFooters: true,
    styles: {
      default: {
        document: {
          run: {
            font: fontFamily,
            size: fontHalfPoints,
            color: '1F2937',
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: a5WidthTwips,
              height: a5HeightTwips,
              orientation: PageOrientation.PORTRAIT,
            },
            margin: {
              top: topMarginTwips,
              bottom: bottomMarginTwips,
              left: outsideMarginTwips,
              right: outsideMarginTwips,
              gutter: insideMarginTwips,
              header: headerMarginTwips,
              footer: footerMarginTwips,
            },
          },
        },
        headers: headersConfig,
        footers: footersConfig,
        children,
      },
    ],
  });

  // 6. Pack document into binary Uint8Array
  let blob: Blob;
  if (typeof (Packer as any).toBlob === 'function' && typeof window !== 'undefined') {
    blob = await Packer.toBlob(doc);
  } else {
    const buf = await Packer.toBuffer(doc);
    blob = new Blob([buf as any], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
  }

  const arrayBuffer = await blob.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}
