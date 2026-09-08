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
 * (e.g. eMBiK365, widokinaraj.pl, RHZ365, str. 2, str. 1-797, Modlitwa (YouTube), etc.)
 */
export const DEFAULT_UNWANTED_PATTERNS: (RegExp | string)[] = [
  // WnR365 / Widoki na Raj patterns
  /WnR\s*365\s+Ca[łl]o[sś][ćc]\s+Ksi[eę]ga\s+A5(?:\s+ca[łl]o[sś][ćc])?(?:\s+\d{2}[.-]\d{2}[.-]\d{4})?/gi,
  /WnR\s*365\s+Ca[łl]o[sś][ćc]\s+Ksi[eę]ga\s+A5/gi,
  /Ca[łl]o[sś][ćc]\s+Ksi[eę]ga\s+A5/gi,
  /Widoki\s+na\s+Raj\s*[-—–]?\s*WnR\s*365/gi,
  /Widoki\s+na\s+Raj/gi,
  /WnR\s*365/gi,
  /ca[łl]o[sś][ćc]\s+\d{2}[.-]\d{2}[.-]\d{4}/gi,
  /06[.-]09[.-]2026/gi,
  /07[.-]09[.-]2026/gi,

  // Wstęp i Misja eMBiK365
  /Wst[eę]p\s+i\s+Misja(?:\s*[-—–]?\s*eMBiK\s*365)?/gi,
  /Misja\s*[-—–]?\s*eMBiK\s*365/gi,

  // eMBiK365 and page numbers like "eMBiK365 — widokinaraj.pl str. 2", "str. 1-797", etc.
  /eMBiK\s*365\s*[-—–]?\s*widokinaraj(?:\.pl)?(?:\s*str\.?\s*\d+(?:-\d+)?)?/gi,
  /\bstr\.?\s*\d+(?:-\d+)?\b/gi,
  /\bstrona\s*\d+(?:-\d+)?\b/gi,

  // RHZ365 poprawiony 07.09.2026 z kodami QR
  /RHZ\s*365\s+poprawion[yae](?:\s+\d{2}[.-]\d{2}[.-]\d{4})?\s+z\s+kodami\s+QR/gi,
  /RHZ\s*365\s+poprawion[yae](?:\s+\d{2}[.-]\d{2}[.-]\d{4})?/gi,
  /z\s+kodami\s+QR\b/gi,

  // Modlitwa (YouTube) & Blog i modlitwa
  /Modlitwa\s*\(\s*YouTube\s*\)/gi,
  /Modlitwa\s+YouTube/gi,
  /Blog\s+i\s+modlitwa/gi,

  // Różaniec Historii Zbawienia — RHZ365
  /R[oó]żaniec\s+Historii\s+Zbawienia\s*[-—–]?\s*RHZ\s*365/gi,
  /R[oó]żaniec\s+Historii\s+Zbawienia/gi,
  /RHZ\s*365/gi,
  /widokinaraj(?:\.pl)?/gi,
  /eMBiK\s*365/gi,

  // Placeholders & Document fallback strings
  /Dokument\s+A5\s+Amazon\s+KDP/gi,
  /Dokument\s+A5/gi,
  /Amazon\s+KDP/gi,
  /Autor\s+Publikacji(?:\s+Wprowadzenie)?/gi,
];

/**
 * Separates and removes overlapping text artifacts, duplicated words/phrases,
 * and collisions caused by multi-layer or shadow text in the source PDF,
 * while preserving legitimate phrases like "czterech tomów".
 */
export function deduplicateOverlappingText(text: string): string {
  if (!text) return '';
  let cleaned = text;

  // 1. Remove duplicate adjacent single words (e.g. "tomów tomów" -> "tomów", "tomów, tomów" -> "tomów,")
  cleaned = cleaned.replace(/\b([\p{L}\d]+(?:-[\p{L}\d]+)?)[,;]?\s+\1\b/giu, '$1');
  cleaned = cleaned.replace(/\b([\p{L}\d]+(?:-[\p{L}\d]+)?)\s+\1\b/giu, '$1');

  // 2. Remove duplicate adjacent 2-to-6 word phrases (e.g. "czterech tomów czterech tomów" -> "czterech tomów")
  for (let pass = 0; pass < 2; pass++) {
    cleaned = cleaned.replace(
      /\b([\p{L}\d]+(?:\s+[\p{L}\d]+){1,5})\s+\1\b/giu,
      '$1'
    );
  }

  // 3. Remove stuttered characters or collision artifacts
  cleaned = cleaned.replace(/\s*[-—–]\s*[-—–]\s*/g, ' — ');

  return cleaned.replace(/\s{2,}/g, ' ').trim();
}

/**
 * Deduplicates repeated occurrences of "Dzień <number>" in headings and line strings
 * (e.g. "DZIEŃ 1 — ... ( )— Dzień 1 Dzień 1: Dzień 1- Etap 1..." -> "DZIEŃ 1 — ... — Etap 1...")
 * and eliminates empty artifact parentheses like "( )" or "( )—".
 */
export function deduplicateDayHeading(text: string): string {
  if (!text) return '';
  let cleaned = text;

  // Clean empty parentheses like "( )" or "( )—"
  cleaned = cleaned.replace(/\(\s*\)\s*[-—–]?\s*/g, ' — ');

  // Find all day mentions with numbers
  const matches = Array.from(cleaned.matchAll(/\b(?:dzie[nń])\s*(\d+)\b/gi));
  if (matches.length > 1) {
    const dayNumbers = Array.from(new Set(matches.map((m) => m[1])));

    for (const dayNum of dayNumbers) {
      const dayRegex = new RegExp(`\\b(?:dzie[nń])\\s*${dayNum}\\b`, 'i');
      const firstMatch = cleaned.match(dayRegex);
      if (!firstMatch || firstMatch.index === undefined) continue;

      const firstIdx = firstMatch.index;
      const matchLen = firstMatch[0].length;
      const prefix = cleaned.slice(0, firstIdx + matchLen);
      const rest = cleaned.slice(firstIdx + matchLen);

      // In rest, remove all repeated occurrences of "Dzień <dayNum>" and their trailing colons/dashes
      const repeatPattern = new RegExp(`\\b(?:dzie[nń])\\s*${dayNum}\\b(?:\\s*[-—–:])?`, 'gi');
      let cleanedRest = rest.replace(repeatPattern, ' ');

      cleaned = `${prefix} ${cleanedRest}`;
    }
  }

  // Clean double dashes, colons or spaces
  cleaned = cleaned
    .replace(/\s*[-—–]\s*[-—–]\s*/g, ' — ')
    .replace(/\s*,\s*\./g, '.')
    .replace(/\s*\.\s*,/g, '.')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return cleaned;
}

/**
 * Normalizes headings and removes unwanted headers, footers, and noise fragments from text,
 * transforming "Wstęp do Różańca Historii Zbawienia – RHZ365" into "Wstęp",
 * deduplicating repeated day titles, without modifying the actual reading body text under it.
 */
export function sanitizeExtractedText(
  text: string,
  customPatterns?: (string | RegExp)[]
): string {
  if (!text) return '';
  let cleaned = text;

  // 1. Separate and deduplicate overlapping text artifacts and consecutive repeated phrases
  cleaned = deduplicateOverlappingText(cleaned);

  // 2. Transform long specific headings into "Wprowadzenie" as requested
  cleaned = cleaned.replace(
    /Wst[eę]p\s+do\s+R[oó]ża[nń]ca\s+Historii\s+Zbawienia(?:\s*[-—–]?\s*RHZ\s*365)?/gi,
    'Wprowadzenie'
  );
  cleaned = cleaned.replace(/Wst[eę]p\s*[-—–]\s*RHZ\s*365/gi, 'Wprowadzenie');
  cleaned = cleaned.replace(/^Wst[eę]p$/gi, 'Wprowadzenie');

  // 3. Deduplicate repeated day headings (e.g. "DZIEŃ 1 ... Dzień 1 Dzień 1: Dzień 1-")
  cleaned = deduplicateDayHeading(cleaned);

  // 4. Strip all unwanted patterns (including "Dokument A5 Amazon KDP", "czterech tomów", etc.)
  const allPatterns = [...DEFAULT_UNWANTED_PATTERNS, ...(customPatterns || [])];

  for (const pattern of allPatterns) {
    if (typeof pattern === 'string' && pattern.trim()) {
      const escaped = pattern.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      cleaned = cleaned.replace(new RegExp(escaped, 'gi'), ' ');
    } else if (pattern instanceof RegExp) {
      cleaned = cleaned.replace(pattern, ' ');
    }
  }

  // 5. Clean overlapping phrase boundaries exposed after deletions
  cleaned = deduplicateOverlappingText(cleaned);

  // 6. Clean dangling dashes, commas, colons, double punctuation, and repeated spaces
  cleaned = cleaned
    .replace(/\s*[-—–]\s*[-—–]\s*/g, ' — ')
    .replace(/\s*,\s*\./g, '.')
    .replace(/\s*\.\s*,/g, '.')
    .replace(/\s*\.\s*\./g, '.')
    .replace(/\s*,\s*,/g, ',')
    .replace(/^[\s\-—–,;:.]+/g, '')
    .replace(/\s*[-—–,;:]+\s*$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return cleaned;
}

export interface DayHeadingInfo {
  isDay: boolean;
  dayNum: number;
  fullTitle: string;
}

/**
 * Accurately detects and parses a true Day heading (Dzień 1 to Dzień 175),
 * deduplicating internal repeated "Dzień X" phrases.
 */
export function parseDayHeading(text: string): DayHeadingInfo | null {
  if (!text) return null;
  const trimmed = text.trim();

  // Match line starting with:
  // "DZIEŃ 1 — 25 GRUDNIA..."
  // "Dzień 1: Stworzenie..."
  // "— Dzień 1 — ..."
  // "DZIEŃ 175"
  const match = trimmed.match(/^[-—–(]*\s*(?:dzie[nń])\s*(\d{1,3})\b(?:\s*[-—–:]|\s+|$)/i);
  if (!match) return null;

  const num = parseInt(match[1], 10);
  if (isNaN(num) || num < 1 || num > 175) return null;

  return {
    isDay: true,
    dayNum: num,
    fullTitle: deduplicateDayHeading(trimmed),
  };
}

/**
 * Validates whether a line of text is a true in-chapter subheading
 * (e.g. "Część 1", "Tajemnica 1", "Etap 1", "Rozważanie", "Modlitwa", "Akt strzelisty")
 * without misclassifying regular sentences or all-caps prayer responses/refrains.
 */
export function isInChapterHeading(text: string, fontSize: number = 12, isUpper: boolean = false): boolean {
  if (!text) return false;
  const trimmed = text.trim();

  // 1. A heading must NEVER end with sentence punctuation: . , ;
  if (/[.,;]$/.test(trimmed)) {
    return false;
  }

  // 2. Headings are concise titles (<= 8 words and <= 70 chars)
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 8 || trimmed.length > 70) {
    return false;
  }

  // 3. Known structural labels in daily readings
  const isStructural =
    /^\s*(?:etap\s*\d+|część\s*\d+|tajemnica\s*\d+|rozważanie(?:\s+[a-ząćęłńóśźż]+)?|modlitwa(?:\s+[a-ząćęłńóśźż]+)?|akt\s+[a-ząćęłńóśźż]+|wezwanie(?:\s+[a-ząćęłńóśźż]+)?|czytanie\s*\d*|psalm\s*\d*|pieśń\s*\d*)\b/i.test(trimmed);

  if (isStructural) {
    return true;
  }

  // 4. Standalone uppercase title (e.g. "ROZWAŻANIE", "TAJEMNICA 1", "MODLITWA")
  if (isUpper && words.length <= 4 && trimmed.length <= 35) {
    const prayerPhrases = [
      'AMEN',
      'ALLELUJA',
      'BOGU NIECH BĘDĄ DZIĘKI',
      'CHWAŁA OJCU',
      'ŚWIĘTY BOŻE',
      'JEZU UFAM TOBIE',
      'ZMIŁUJ SIĘ NAD NAMI',
      'WYSŁUCHAJ NAS PANIE',
      'MÓDL SIĘ ZA NAMI',
      'POD TWOJĄ OBRONĘ',
      'OJCZE NASZ',
      'ZDROWAŚ MARYJO',
      'WIERZĘ W BOGA',
    ];
    const upperClean = trimmed.replace(/[^A-ZĄĆĘŁŃÓŚŹŻ\s]/g, '').trim();
    if (prayerPhrases.some((p) => upperClean.includes(p) || p.includes(upperClean))) {
      return false;
    }

    if (/^(?:WSTĘP|WPROWADZENIE|ROZWAŻANIE|MODLITWA|TAJEMNICA|ETAP|CZĘŚĆ|ZAKOŃCZENIE|DODATEK)$/i.test(upperClean)) {
      return true;
    }
  }

  return false;
}

export interface ExtractBookOptions {
  fallbackTitle?: string;
  customExcludedPatterns?: string[];
  onProgress?: (current: number, total: number) => void;
}

/**
 * Robustly extracts structured book text (chapters, headings, paragraphs)
 * from a loaded PDFDocumentProxy or raw PDF Uint8Array using PDF.js,
 * automatically filtering out unwanted headers, footers, and noise phrases,
 * leaving "Wstęp" clean and formatting intact.
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
  let currentDayNumber = 0; // 0 = Wprowadzenie, 1..175 = Dzień 1..175
  let currentChapter: ExtractedChapter = {
    id: 'ch-intro',
    title: 'Wprowadzenie',
    paragraphs: [],
    pageRange: { start: 1, end: 1 },
  };

  let totalWordsCount = 0;
  let detectedTitle = sanitizeExtractedText(
    fallbackTitle.replace(/\.pdf$/i, '').replace(/[_-]/g, ' '),
    customPatterns
  );

  // Process lines into paragraphs and chapters
  let paragraphBuffer: string[] = [];
  let lastLineY: number | null = null;
  let lastFontSize: number = 10;

  const flushParagraph = (isHeading: boolean = false, headingLvl: number = 1, fSize: number = 12) => {
    if (paragraphBuffer.length === 0) return;

    // Join buffer lines: handle hyphenated words across line breaks
    let fullText = '';
    for (const lineStr of paragraphBuffer) {
      const trimmed = lineStr.trim();
      if (!trimmed) continue;
      if (fullText.length === 0) {
        fullText = trimmed;
      } else if (fullText.endsWith('-') && !fullText.endsWith(' -')) {
        // Hyphenated word across line break: join without space
        fullText = fullText.slice(0, -1) + trimmed;
      } else {
        fullText += ' ' + trimmed;
      }
    }

    paragraphBuffer = [];
    const cleaned = sanitizeExtractedText(fullText, customPatterns);
    if (!cleaned || cleaned.length <= 1) return;

    const words = cleaned.split(/\s+/).length;
    totalWordsCount += words;

    currentChapter.paragraphs.push({
      text: cleaned,
      isHeading: false,
      headingLevel: 0,
      fontSize: 12, // Strictly 12pt format
      isBold: false,
    });
  };

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    // Yield to the browser event loop every 2 pages to keep UI fluid and responsive
    if (pageNum % 2 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    options.onProgress?.(pageNum, numPages);

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

    // Filter out duplicate overlapping text items (shadows, multi-layer rendering passes)
    // Uses spatial buckets indexed by Y coordinate for ultra-fast O(N) lookup
    const spatialBuckets = new Map<number, RawTextItem[]>();
    const nonOverlappingItems: RawTextItem[] = [];

    for (const item of rawItems) {
      const bucketKey = Math.round(item.y / 3);
      let isDuplicateOverlap = false;

      // Only inspect neighboring Y buckets (-1, 0, 1)
      for (let b = bucketKey - 1; b <= bucketKey + 1; b++) {
        const bucket = spatialBuckets.get(b);
        if (!bucket) continue;
        for (const existing of bucket) {
          // Strictly exact trimmed text match at near-identical coordinates (<= 1.2pt Y, <= 2.0pt X)
          if (
            Math.abs(existing.y - item.y) <= 1.2 &&
            Math.abs(existing.x - item.x) <= 2.0 &&
            existing.str.trim() === item.str.trim()
          ) {
            isDuplicateOverlap = true;
            break;
          }
        }
        if (isDuplicateOverlap) break;
      }

      if (!isDuplicateOverlap) {
        nonOverlappingItems.push(item);
        const existingBucket = spatialBuckets.get(bucketKey);
        if (existingBucket) {
          existingBucket.push(item);
        } else {
          spatialBuckets.set(bucketKey, [item]);
        }
      }
    }

    // 1. Sort items strictly top-to-bottom (Y descending). 100% transitive and stable.
    nonOverlappingItems.sort((a, b) => b.y - a.y);

    // 2. Cluster items into visual lines
    interface LineCluster {
      avgY: number;
      fontSize: number;
      items: RawTextItem[];
    }

    const lineClusters: LineCluster[] = [];

    for (const item of nonOverlappingItems) {
      const lastLine = lineClusters.length > 0 ? lineClusters[lineClusters.length - 1] : null;
      const yTolerance = Math.min(3.2, Math.max(1.8, item.fontSize * 0.28));

      if (lastLine && Math.abs(item.y - lastLine.avgY) <= yTolerance) {
        lastLine.items.push(item);
        lastLine.avgY = (lastLine.avgY * (lastLine.items.length - 1) + item.y) / lastLine.items.length;
        lastLine.fontSize = Math.max(lastLine.fontSize, item.fontSize);
      } else {
        lineClusters.push({
          avgY: item.y,
          fontSize: item.fontSize,
          items: [item],
        });
      }
    }

    // 3. For each visual line cluster, sort items strictly left-to-right (X ascending)
    // and assemble line text preserving word boundaries and kerning
    interface ExtractedLine {
      y: number;
      fontSize: number;
      text: string;
      isUpper: boolean;
    }

    const lines: ExtractedLine[] = [];

    for (const cluster of lineClusters) {
      cluster.items.sort((a, b) => a.x - b.x);

      let lineStr = '';
      let prevItem: RawTextItem | null = null;

      for (const it of cluster.items) {
        const chunk = it.str;
        if (!chunk) continue;

        // Skip exact duplicate text rendered at virtually identical X coordinate
        if (prevItem && prevItem.str.trim() === chunk.trim() && Math.abs(it.x - prevItem.x) <= 2.0) {
          continue;
        }

        if (lineStr.length === 0) {
          lineStr = chunk;
        } else {
          const prevEndX = prevItem ? prevItem.x + prevItem.width : 0;
          const gap = it.x - prevEndX;
          const needsSpace =
            !lineStr.endsWith(' ') &&
            !chunk.startsWith(' ') &&
            gap >= Math.max(1.8, it.fontSize * 0.18);

          if (needsSpace) {
            lineStr += ' ' + chunk;
          } else {
            lineStr += chunk;
          }
        }

        prevItem = it;
      }

      const rawText = lineStr.replace(/\s+/g, ' ').trim();
      const cleanedText = sanitizeExtractedText(rawText, customPatterns);

      // Discard empty lines, standalone numbers or lone punctuation
      if (cleanedText.length > 1 && !/^[-—–,.:;]+$/.test(cleanedText)) {
        lines.push({
          y: cluster.avgY,
          fontSize: cluster.fontSize,
          text: cleanedText,
          isUpper: cleanedText === cleanedText.toUpperCase() && cleanedText.length > 3,
        });
      }
    }

    for (let l = 0; l < lines.length; l++) {
      const line = lines[l];
      const trimmedText = line.text.trim();

      // Check if line represents a Day heading (Dzień 1 to Dzień 175)
      const dayInfo = parseDayHeading(trimmedText);

      if (dayInfo) {
        // If dayNum <= currentDayNumber, it is a running header repetition on page 2+ of the day
        if (dayInfo.dayNum <= currentDayNumber) {
          // Ignore running header repetition!
          continue;
        }

        // New Day detected! dayInfo.dayNum > currentDayNumber
        flushParagraph();

        let dayFullTitle = dayInfo.fullTitle;

        // Check if next line is a continuation of the day heading (e.g. date, subtitle, stage)
        if (l + 1 < lines.length) {
          const nextLine = lines[l + 1];
          const nextTrimmed = nextLine.text.trim();
          const nextIsDay = parseDayHeading(nextTrimmed);
          const nextIsSubheading = isInChapterHeading(nextTrimmed, nextLine.fontSize, nextLine.isUpper);

          const isContinuation =
            !nextIsDay &&
            !nextIsSubheading &&
            (
              /^(?:[-—–]|\d{1,2}\s+[a-ząćęłńóśźż]+|cykl\s+[ivx]+|etap\s*\d+|część\s*\d+|tajemnica\s*\d+)/i.test(nextTrimmed) ||
              (nextLine.isUpper && nextTrimmed.length < 90)
            );

          if (isContinuation) {
            dayFullTitle = deduplicateDayHeading(`${dayFullTitle} — ${nextTrimmed}`);
            l++; // Consume next line into heading
          }
        }

        // Finalize current chapter if it has content
        if (currentChapter.paragraphs.length > 0) {
          if (currentChapter.pageRange) {
            currentChapter.pageRange.end = pageNum;
          }
          chapters.push(currentChapter);
        }

        currentDayNumber = dayInfo.dayNum;
        currentChapter = {
          id: `ch-day-${dayInfo.dayNum}`,
          title: dayFullTitle,
          paragraphs: [],
          pageRange: { start: pageNum, end: pageNum },
        };

        // Add Day heading as first paragraph (strictly 12pt bold)
        currentChapter.paragraphs.push({
          text: dayFullTitle,
          isHeading: true,
          headingLevel: 1,
          fontSize: 12,
          isBold: true,
        });

        const words = dayFullTitle.split(/\s+/).length;
        totalWordsCount += words;
        lastLineY = line.y;
        lastFontSize = line.fontSize;
        continue;
      }

      // Check if line is an in-chapter subheading
      const isSubheading = isInChapterHeading(trimmedText, line.fontSize, line.isUpper);

      if (isSubheading) {
        flushParagraph();

        let cleanSub = sanitizeExtractedText(trimmedText, customPatterns);
        if (cleanSub && cleanSub.length > 1) {
          currentChapter.paragraphs.push({
            text: cleanSub,
            isHeading: true,
            headingLevel: 2,
            fontSize: 12,
            isBold: true,
          });
          totalWordsCount += cleanSub.split(/\s+/).length;
        }

        lastLineY = line.y;
        lastFontSize = line.fontSize;
        continue;
      }

      // Normal body line
      // Check paragraph separation: significant vertical gap
      const yDelta = lastLineY !== null ? Math.abs(lastLineY - line.y) : 0;
      const isSignificantGap = yDelta > line.fontSize * 1.8;

      if (isSignificantGap && paragraphBuffer.length > 0) {
        flushParagraph(false, 0, 12);
      }

      paragraphBuffer.push(line.text);
      lastLineY = line.y;
      lastFontSize = line.fontSize;
    }

    // Between pages: flush if buffer ends with sentence punctuation or empty page transition
    if (paragraphBuffer.length > 0) {
      const bufferText = paragraphBuffer.join(' ').trim();
      if (/[.!?:]|[.!?:][”"]$/.test(bufferText)) {
        flushParagraph(false, 0, 12);
      }
    }

    if (currentChapter.pageRange) {
      currentChapter.pageRange.end = pageNum;
    }

    page.cleanup();
  }

  flushParagraph(false, 0, 12);

  if (currentChapter.paragraphs.length > 0) {
    chapters.push(currentChapter);
  }

  // Filter out any chapter that has no paragraphs
  const validChapters = chapters.filter((ch) => ch.paragraphs.length > 0);

  validChapters.forEach((ch, idx) => {
    let cleanTitle = sanitizeExtractedText(ch.title, customPatterns);
    if (/^wst[eę]p\b/i.test(cleanTitle) || ch.id === 'ch-intro') {
      cleanTitle = 'Wprowadzenie';
    }
    ch.title = cleanTitle || (idx === 0 ? 'Wprowadzenie' : `Dzień ${idx}`);
  });

  // If no chapters detected, create fallback chapter
  if (validChapters.length === 0) {
    validChapters.push({
      id: 'ch-intro',
      title: 'Wprowadzenie',
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
    // If first chapter is Wprowadzenie, ensure its title and first heading are "Wprowadzenie"
    if (validChapters[0].id === 'ch-intro') {
      validChapters[0].title = 'Wprowadzenie';
      if (validChapters[0].paragraphs.length > 0 && validChapters[0].paragraphs[0].isHeading) {
        validChapters[0].paragraphs[0].text = 'Wprowadzenie';
      } else {
        validChapters[0].paragraphs.unshift({
          text: 'Wprowadzenie',
          isHeading: true,
          headingLevel: 1,
          fontSize: 12,
          isBold: true,
        });
      }
    }
  }

  return {
    title: detectedTitle || '',
    author: '',
    chapters: validChapters,
    totalWords: totalWordsCount,
    sourcePageCount: numPages,
  };
}
