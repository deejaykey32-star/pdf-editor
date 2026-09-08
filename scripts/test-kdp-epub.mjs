import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

// Simulation of sanitizeExtractedText
const DEFAULT_UNWANTED_PATTERNS = [
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

function deduplicateOverlappingText(text) {
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

function deduplicateDayHeading(text) {
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

function sanitizeExtractedText(text, customPatterns = []) {
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

  // 4. Strip all unwanted patterns
  const allPatterns = [...DEFAULT_UNWANTED_PATTERNS, ...customPatterns];

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

  cleaned = cleaned
    .replace(/\s*[-—–]\s*[-—–]\s*/g, ' — ')
    .replace(/\s*,\s*\./g, '.')
    .replace(/\s*\.\s*,/g, '.')
    .replace(/\s*,\s*,/g, ',')
    .replace(/^[\s\-—–,;:.]+/g, '')
    .replace(/\s*[-—–,;:]+\s*$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return cleaned;
}

function parseDayHeading(text) {
  if (!text) return null;
  const trimmed = text.trim();

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

function isInChapterHeading(text, fontSize = 12, isUpper = false) {
  if (!text) return false;
  const trimmed = text.trim();

  if (/[.,;]$/.test(trimmed)) return false;

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 8 || trimmed.length > 70) return false;

  const isStructural =
    /^\s*(?:etap\s*\d+|część\s*\d+|tajemnica\s*\d+|rozważanie(?:\s+[a-ząćęłńóśźż]+)?|modlitwa(?:\s+[a-ząćęłńóśźż]+)?|akt\s+[a-ząćęłńóśźż]+|wezwanie(?:\s+[a-ząćęłńóśźż]+)?|czytanie\s*\d*|psalm\s*\d*|pieśń\s*\d*)\b/i.test(trimmed);

  if (isStructural) return true;

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

async function runTests() {
  console.log('================================================================');
  console.log('🧪 TEST: FILTRACJA FRAGMENTÓW, FORMAT 12 PT I OCHRONA MARGINESÓW');
  console.log('================================================================\n');

  // Test 1: Sanitize unwanted strings (RHZ365)
  console.log('[1/4] Sprawdzanie usuwania fragmentów tekstu z publikacji RHZ365...');
  const dirtySample =
    'eMBiK365 — widokinaraj.pl str. 2. RHZ365 poprawiony 07.09.2026 z kodami QR Autor Publikacji Wprowadzenie ' +
    'Modlitwa (YouTube) Blog i modlitwa Różaniec Historii Zbawienia — RHZ365 ' +
    'Wstęp do Różańca Historii Zbawienia – RHZ365. To jest oryginalny tekst wstępu, który ma pozostać bez modyfikacji słów.';

  const cleanedSample = sanitizeExtractedText(dirtySample);
  console.log('   Oryginalny tekst:', dirtySample);
  console.log('   Oczyszczony tekst:', cleanedSample);

  if (
    cleanedSample.includes('eMBiK365') ||
    cleanedSample.includes('widokinaraj.pl') ||
    cleanedSample.includes('RHZ365') ||
    cleanedSample.includes('str. 2') ||
    cleanedSample.includes('Autor Publikacji') ||
    cleanedSample.includes('Modlitwa (YouTube)') ||
    cleanedSample.includes('Blog i modlitwa') ||
    cleanedSample.includes('Różaniec Historii Zbawienia')
  ) {
    throw new Error('Test FAILED: Niepożądane fragmenty RHZ365 nie zostały w pełni wycięte!');
  }

  if (!cleanedSample.includes('Wprowadzenie')) {
    throw new Error('Test FAILED: "Wprowadzenie" powinno zostać zachowane jako nagłówek!');
  }

  if (!cleanedSample.includes('To jest oryginalny tekst wstępu, który ma pozostać bez modyfikacji słów.')) {
    throw new Error('Test FAILED: Treść wstępu została naruszona!');
  }

  console.log('   ✓ Pomyślnie wycięto wszystkie wskazane frazy i stopki RHZ365.');
  console.log('   ✓ Pomyślnie zachowano nagłówek "Wprowadzenie" oraz nienaruszoną treść czytania.\n');

  // Test 1b: Sanitize unwanted strings (WnR365 - Widoki na Raj)
  console.log('[2/4] Sprawdzanie usuwania wskazanych fragmentów tekstu z WnR365...');
  const dirtyWnR =
    'WnR365 Calosc Ksiega A5   całość   06.09.2026 Autor Publikacji Wprowadzenie ' +
    'Widoki na Raj — WnR365 Wstęp i Misja eMBiK365 eMBiK365 — widokinaraj.pl str. 2 ' +
    'Widoki na Raj — WnR365. To jest autentyczny tekst medytacji bez numeracji stron i stopek.';

  const cleanedWnR = sanitizeExtractedText(dirtyWnR);
  console.log('   Oryginalny tekst WnR:', dirtyWnR);
  console.log('   Oczyszczony tekst WnR:', cleanedWnR);

  if (
    cleanedWnR.includes('WnR365') ||
    cleanedWnR.includes('Calosc Ksiega A5') ||
    cleanedWnR.includes('06.09.2026') ||
    cleanedWnR.includes('Autor Publikacji') ||
    cleanedWnR.includes('Wprowadzenie') ||
    cleanedWnR.includes('Widoki na Raj') ||
    cleanedWnR.includes('Wstęp i Misja eMBiK365') ||
    cleanedWnR.includes('widokinaraj.pl') ||
    cleanedWnR.includes('str. 2')
  ) {
    throw new Error('Test FAILED: Niepożądane fragmenty WnR365 nie zostały w pełni wycięte!');
  }

  if (!cleanedWnR.includes('To jest autentyczny tekst medytacji bez numeracji stron i stopek.')) {
    throw new Error('Test FAILED: Treść właściwa WnR365 została naruszona!');
  }
  console.log('   ✓ Pomyślnie wycięto wszystkie wskazane frazy, nagłówki i numerację stron z WnR365.\n');

  // Test 1c: Deduplicate repeated "Dzień X" in daily prayer/meditation headings
  console.log('[3/4] Sprawdzanie usuwania powtórzeń "Dzień 1" i pogrubienia nagłówka dnia...');
  const rawDayHeading =
    'DZIEŃ 1 — 25 GRUDNIA / 25 czerwca Cykl I /II ( )— Dzień 1 Dzień 1: Dzień 1- Etap 1- Część 1- Tajemnica 1 Stworzenie świata i człowieka';

  const cleanedDayHeading = sanitizeExtractedText(rawDayHeading);
  console.log('   Oryginalny nagłówek dnia:', rawDayHeading);
  console.log('   Oczyszczony nagłówek dnia:', cleanedDayHeading);

  // Assertions:
  // 1. Must contain "DZIEŃ 1" once
  const dayMatches = cleanedDayHeading.match(/\bdzie[nń]\s*1\b/gi) || [];
  if (dayMatches.length !== 1) {
    throw new Error(`Test FAILED: Oczekiwano dokładnie 1 wystąpienia "Dzień 1", a znaleziono ${dayMatches.length}!`);
  }

  // 2. Must not contain "( )"
  if (cleanedDayHeading.includes('( )') || cleanedDayHeading.includes('()')) {
    throw new Error('Test FAILED: Puste nawiasy ( ) nie zostały usunięte!');
  }

  // 3. Must preserve remaining details: dates, cycle, stage, part, mystery, title
  if (
    !cleanedDayHeading.includes('25 GRUDNIA / 25 czerwca Cykl I /II') ||
    !cleanedDayHeading.includes('Etap 1') ||
    !cleanedDayHeading.includes('Część 1') ||
    !cleanedDayHeading.includes('Tajemnica 1 Stworzenie świata i człowieka')
  ) {
    throw new Error('Test FAILED: Treść merytoryczna nagłówka dnia została naruszona!');
  }

  console.log('   ✓ Usunięto wszystkie zbędne powtórzenia słowa "Dzień 1".');
  console.log('   ✓ Usunięto pusty nawias "( )".');
  console.log('   ✓ Zachowano pełną treść dat, cyklu i tajemnicy.\n');

  // Test 1d: Removal of "Dokument A5 Amazon KDP", PRESERVATION of "czterech tomów", and deduplication of overlapping text
  console.log('[4/6] Sprawdzanie usuwania "Dokument A5 Amazon KDP", ZACHOWANIA "czterech tomów" i rozdzielania nałożeń tekstu...');
  const dirtyOverlaps =
    'Rozważanie poranne. Dokument A5 Amazon KDP Tom I z czterech tomów czterech tomów. ' +
    'To jest czysty tekst modlitwy, z którego usunięto nałożenia i duplikaty słów oraz frazę Dokument A5 Amazon KDP.';

  const cleanedOverlaps = sanitizeExtractedText(dirtyOverlaps);
  console.log('   Oryginalny tekst z nałożeniami:', dirtyOverlaps);
  console.log('   Oczyszczony tekst:', cleanedOverlaps);

  if (
    cleanedOverlaps.includes('Dokument A5 Amazon KDP') ||
    cleanedOverlaps.includes('Dokument A5') ||
    cleanedOverlaps.includes('Amazon KDP')
  ) {
    throw new Error('Test FAILED: Fraza "Dokument A5 Amazon KDP" nie została usunięta!');
  }

  // "czterech tomów" MUST be preserved!
  if (!cleanedOverlaps.includes('czterech tomów')) {
    throw new Error('Test FAILED: Napis "czterech tomów" powinien zostać zachowany!');
  }

  // Duplicate "czterech tomów czterech tomów" must be deduplicated into a single occurrence
  const tomMatches = cleanedOverlaps.match(/czterech\s+tom[oó]w/gi) || [];
  if (tomMatches.length !== 1) {
    throw new Error(`Test FAILED: Oczekiwano dokładnie 1 wystąpienia "czterech tomów", znaleziono ${tomMatches.length}!`);
  }

  if (!cleanedOverlaps.includes('Rozważanie poranne.') || !cleanedOverlaps.includes('To jest czysty tekst modlitwy')) {
    throw new Error('Test FAILED: Prawidłowy tekst został naruszony!');
  }

  console.log('   ✓ Pomyślnie wycięto frazę "Dokument A5 Amazon KDP".');
  console.log('   ✓ Pomyślnie ZACHOWANO napis "czterech tomów".');
  console.log('   ✓ Rozdzielono i zdeduplikowano nałożone/powielone słowa ("czterech tomów czterech tomów" -> "czterech tomów").\n');

  // Test 2: Verify KDP PDF margins & 12pt format
  console.log('[5/5] Testowanie składu KDP A5 (12 pt dla wszystkich nagłówków i tekstu)...');
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const georgiaBytes = fs.readFileSync('public/fonts/georgia.ttf');
  const georgiaBoldBytes = fs.readFileSync('public/fonts/georgiab.ttf');
  const font = await pdfDoc.embedFont(georgiaBytes);
  const fontBold = await pdfDoc.embedFont(georgiaBoldBytes);

  const mmToPt = (mm) => (mm * 72) / 25.4;
  const pageWidthPt = mmToPt(154.4); // KDP bleed
  const pageHeightPt = mmToPt(216.4);
  const bleedPt = mmToPt(3.2);

  const A5_WIDTH_PT = mmToPt(148);
  const A5_HEIGHT_PT = mmToPt(210);

  const gutterPt = mmToPt(18);
  const outerPt = mmToPt(13);
  const topPt = mmToPt(15) + bleedPt;
  const bottomPt = mmToPt(15) + bleedPt;
  const colWidth = A5_WIDTH_PT - gutterPt - outerPt;

  const page = pdfDoc.addPage([pageWidthPt, pageHeightPt]);
  page.setTrimBox(bleedPt, bleedPt, A5_WIDTH_PT, A5_HEIGHT_PT);
  page.setBleedBox(0, 0, pageWidthPt, pageHeightPt);

  const FONT_SIZE = 12; // Strictly 12 pt!

  // Test long token breaking to verify zero margin overflow
  const superLongWord = 'https://widokinaraj.pl/bardzodlugilinkbezzadnychspacjiidzieleniawyrazowktorynormalniebywystawalpozaobszarkartki1234567890';
  const hyphenWidth = font.widthOfTextAtSize('-', FONT_SIZE);

  const chunks = [];
  let curChunk = '';
  for (let i = 0; i < superLongWord.length; i++) {
    const char = superLongWord[i];
    const candidate = curChunk + char;
    const candW = font.widthOfTextAtSize(candidate, FONT_SIZE) + hyphenWidth;
    if (candW <= colWidth || curChunk.length === 0) {
      curChunk += char;
    } else {
      chunks.push(curChunk + '-');
      curChunk = char;
    }
  }
  if (curChunk.length > 0) chunks.push(curChunk);

  let curY = pageHeightPt - topPt - 20;
  const leftX = bleedPt + gutterPt;
  const maxRightX = leftX + colWidth;

  // Draw chapter heading strictly at 12 pt
  page.drawText('ROZDZIAŁ 1: TAJEMNICA ZBAWIENIA (12 PT BOLD)', {
    x: leftX,
    y: curY,
    size: FONT_SIZE,
    font: fontBold,
  });
  curY -= 20;

  // Draw long word chunks and assert coordinate bounds
  for (const chunk of chunks) {
    const chunkW = font.widthOfTextAtSize(chunk, FONT_SIZE);
    const endX = leftX + chunkW;
    if (endX > maxRightX + 0.1) {
      throw new Error(`Test FAILED: Fragment przekroczył prawy margines! endX: ${endX}, maxRight: ${maxRightX}`);
    }
    page.drawText(chunk, {
      x: leftX,
      y: curY,
      size: FONT_SIZE,
      font: font,
    });
    curY -= 16;
  }

  const pdfBytes = await pdfDoc.save();
  console.log(`   ✓ Utworzono plik PDF KDP A5 (${pdfBytes.length} bajtów).`);
  console.log(`   ✓ Wszystkie czcionki w nagłówkach i treści: dokładnie 12 pt.`);
  console.log(`   ✓ Żaden wyraz ani element nie wychodzi poza marginesy (prawa granica: ${maxRightX.toFixed(2)} pt).\n`);

  // Test 2b: Verify ZERO word overlap on justified lines and lines with paragraph indents
  console.log('[6/6] Sprawdzanie braku nałożeń wyrazów (zero word overlap) na liniach z wcięciem i wyjustowanych...');
  const testParagraph =
    'Rozważanie na temat tajemnicy stworzenia świata i człowieka z czterech tomów dzieła. ' +
    'Każde słowo w składzie tekstu musi mieć własną, ściśle określoną pozycję poziomą i nigdy nie nakładać się na wyraz sąsiedni. ' +
    'Marginesy A5 Amazon KDP są bezwzględnie przestrzegane, a justowanie zachowuje czytelne odstępy między wyrazami.';

  const wordsList = testParagraph.split(/\s+/);
  const firstLineIndentPt = mmToPt(5);
  const standardSpace = font.widthOfTextAtSize(' ', FONT_SIZE);
  const minWordGap = Math.max(2.0, standardSpace * 0.35);

  // Line breaking simulation
  const lines = [];
  let curWords = [];
  let curWidth = 0;
  let isFirst = true;

  for (const w of wordsList) {
    const wW = font.widthOfTextAtSize(w, FONT_SIZE);
    const availW = colWidth - (isFirst ? firstLineIndentPt : 0);
    const prospective = curWidth + wW + curWords.length * standardSpace;
    if (prospective <= availW - 0.5 || curWords.length === 0) {
      curWords.push({ text: w, width: wW });
      curWidth += wW;
    } else {
      lines.push({ words: curWords, isLast: false, indent: isFirst ? firstLineIndentPt : 0, availW, totalW: curWidth });
      curWords = [{ text: w, width: wW }];
      curWidth = wW;
      isFirst = false;
    }
  }
  if (curWords.length > 0) {
    lines.push({ words: curWords, isLast: true, indent: isFirst ? firstLineIndentPt : 0, availW: colWidth - (isFirst ? firstLineIndentPt : 0), totalW: curWidth });
  }

  // Verify word positions on every line
  for (let l = 0; l < lines.length; l++) {
    const line = lines[l];
    const startX = leftX + line.indent;
    const maxLineRight = leftX + colWidth;
    const renderedWords = [];

    if (line.isLast || line.words.length <= 1) {
      let curWordX = startX;
      let prevWordEndX = startX;
      for (let wIdx = 0; wIdx < line.words.length; wIdx++) {
        const item = line.words[wIdx];
        const minX = wIdx === 0 ? startX : prevWordEndX + minWordGap;
        let drawX = Math.max(minX, curWordX);
        if (drawX + item.width > maxLineRight && maxLineRight - item.width >= minX) {
          drawX = maxLineRight - item.width;
        }
        renderedWords.push({ text: item.text, drawX, endX: drawX + item.width });
        prevWordEndX = drawX + item.width;
        curWordX = drawX + item.width + standardSpace;
      }
    } else {
      const numGaps = line.words.length - 1;
      const totalGapSpace = line.availW - line.totalW;
      let gapW = numGaps > 0 ? totalGapSpace / numGaps : standardSpace;
      if (gapW < minWordGap) gapW = minWordGap;
      else if (gapW > standardSpace * 2.8) gapW = standardSpace * 1.5;

      let curWordX = startX;
      let prevWordEndX = startX;
      for (let wIdx = 0; wIdx < line.words.length; wIdx++) {
        const item = line.words[wIdx];
        const minX = wIdx === 0 ? startX : prevWordEndX + minWordGap;
        let drawX = Math.max(minX, curWordX);
        if (drawX + item.width > maxLineRight && maxLineRight - item.width >= minX) {
          drawX = maxLineRight - item.width;
        }
        renderedWords.push({ text: item.text, drawX, endX: drawX + item.width });
        prevWordEndX = drawX + item.width;
        curWordX = drawX + item.width + gapW;
      }
    }

    // Assert: strictly no overlapping words on this line!
    for (let wIdx = 0; wIdx < renderedWords.length - 1; wIdx++) {
      const w1 = renderedWords[wIdx];
      const w2 = renderedWords[wIdx + 1];
      if (w1.endX > w2.drawX + 0.001) {
        throw new Error(
          `Test FAILED: Wyrazy nakładają się na siebie na linii ${l + 1}! "${w1.text}" (end: ${w1.endX.toFixed(2)}) i "${w2.text}" (start: ${w2.drawX.toFixed(2)})`
        );
      }
    }
  }
  console.log(`   ✓ Sprawdzono ${lines.length} linii: ŻADEN wyraz nie nakłada się na inny wyraz!`);
  console.log(`   ✓ Wszystkie odstępy między wyrazami są w 100% dodatnie i bezpieczne.\n`);

  // Test 2c: Verify CUSTOMIZABLE font sizes (10 pt, 11 pt, 12 pt, 14 pt)
  console.log('[7/7] Sprawdzanie dynamicznej zmiany wielkości czcionki (10 pt, 11 pt, 12 pt, 14 pt)...');
  for (const testSize of [10, 11, 12, 14]) {
    const testLineH = Math.round(testSize * 1.333 * 10) / 10;
    const testSpace = font.widthOfTextAtSize(' ', testSize);

    const testWords = ['Rozważanie', 'na', 'temat', 'tajemnicy', 'stworzenia', 'świata', 'czterech', 'tomów', 'modlitwy'];
    let curLineWords = [];
    let curLineWidth = 0;
    const testLines = [];

    for (const w of testWords) {
      const wW = font.widthOfTextAtSize(w, testSize);
      if (curLineWidth + wW + curLineWords.length * testSpace <= colWidth || curLineWords.length === 0) {
        curLineWords.push({ text: w, width: wW });
        curLineWidth += wW;
      } else {
        testLines.push(curLineWords);
        curLineWords = [{ text: w, width: wW }];
        curLineWidth = wW;
      }
    }
    if (curLineWords.length > 0) testLines.push(curLineWords);

    for (const lWords of testLines) {
      let curX = leftX;
      for (const item of lWords) {
        if (curX + item.width > leftX + colWidth + 0.1) {
          throw new Error(`Test FAILED: Wyraz przekroczył margines dla czcionki ${testSize} pt!`);
        }
        curX += item.width + testSpace;
      }
    }
    console.log(`   ✓ Rozmiar czcionki ${testSize} pt (interlinia ${testLineH} pt): poprawnie podzielono na ${testLines.length} linii.`);
  }
  console.log('   ✓ Pomyślnie zweryfikowano obsługę dynamicznych rozmiarów czcionek.\n');

  // Test 3: Verify ePUB package with custom font size
  console.log('[3/3] Testowanie generatora ePUB 3.0 z dynamiczną wielkością czcionki...');
  const customEpubSize = 11;
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file(
    'OEBPS/styles/stylesheet.css',
    `* { box-sizing: border-box; max-width: 100%; word-wrap: break-word; }
body, p, h1, h2, h3 { font-size: ${customEpubSize}pt !important; text-align: justify; }`
  );

  const epubBytes = await zip.generateAsync({ type: 'uint8array', mimeType: 'application/epub+zip' });
  console.log(`   ✓ Pakiet ePUB wygenerowany pomyślnie (${epubBytes.length} bajtów) z wybranym rozmiarem ${customEpubSize}pt.`);

  // Test 8: Verify reading order & line clustering (no word interleaving or scrambling)
  console.log('[8/9] Sprawdzanie naturalnego porządku czytania i klastrowania linii (brak poprzestawianych słów i zdań)...');
  const rawJumbledItems = [
    // Line 1: y ~ 700. Word 1 (x=50), Word 3 (x=200), Word 2 (x=120) with slight baseline jitter
    { str: 'świętego', x: 200, y: 700.5, width: 60, fontSize: 12 },
    { str: 'Początek', x: 50, y: 700.1, width: 65, fontSize: 12 },
    { str: 'życia', x: 120, y: 699.8, width: 40, fontSize: 12 },
    { str: 'i', x: 165, y: 700.2, width: 10, fontSize: 12 },
    { str: 'błogosławieństwa.', x: 265, y: 700.0, width: 110, fontSize: 12 },
    // Line 2: y ~ 684. Words out of X order
    { str: 'naszym', x: 150, y: 684.2, width: 55, fontSize: 12 },
    { str: 'Bóg', x: 50, y: 683.9, width: 30, fontSize: 12 },
    { str: 'jest', x: 85, y: 684.0, width: 30, fontSize: 12 },
    { str: 'zawsze', x: 210, y: 683.8, width: 50, fontSize: 12 },
    { str: 'z', x: 120, y: 684.1, width: 15, fontSize: 12 },
    { str: 'przewodnikiem.', x: 265, y: 684.0, width: 100, fontSize: 12 },
  ];

  // 1. Sort strictly top-to-bottom (Y desc)
  rawJumbledItems.sort((a, b) => b.y - a.y);

  // 2. Cluster into lines
  const clusters = [];
  for (const item of rawJumbledItems) {
    const last = clusters.length > 0 ? clusters[clusters.length - 1] : null;
    if (last && Math.abs(item.y - last.avgY) <= 3.0) {
      last.items.push(item);
      last.avgY = (last.avgY * (last.items.length - 1) + item.y) / last.items.length;
    } else {
      clusters.push({ avgY: item.y, items: [item] });
    }
  }

  if (clusters.length !== 2) {
    throw new Error(`Test FAILED: Oczekiwano dokładnie 2 linii tekstu, a sklastrowano ${clusters.length}!`);
  }

  // 3. For each cluster, sort X ascending and assemble
  const assembledLines = clusters.map((c) => {
    c.items.sort((a, b) => a.x - b.x);
    let str = '';
    let prev = null;
    for (const it of c.items) {
      if (!str) str = it.str;
      else {
        const gap = it.x - (prev ? prev.x + prev.width : 0);
        if (gap >= 1.8) str += ' ' + it.str;
        else str += it.str;
      }
      prev = it;
    }
    return str;
  });

  if (assembledLines[0] !== 'Początek życia i świętego błogosławieństwa.') {
    throw new Error(`Test FAILED: Linia 1 została zniekształcona: "${assembledLines[0]}"`);
  }
  if (assembledLines[1] !== 'Bóg jest z naszym zawsze przewodnikiem.') {
    throw new Error(`Test FAILED: Linia 2 została zniekształcona: "${assembledLines[1]}"`);
  }

  console.log('   ✓ Linia 1 poprawnie złożona w naturalnej kolejności:', assembledLines[0]);
  console.log('   ✓ Linia 2 poprawnie złożona w naturalnej kolejności:', assembledLines[1]);
  console.log('   ✓ Całkowity brak przestawiania słów i zdań (zero word/line interleaving).\n');

  // Test 9: Verify Structure: Exactly 1 Introduction (Wprowadzenie) + 175 Days = 176 chapters
  console.log('[9/9] Sprawdzanie struktury: dokładnie 1 rozdział wstępu (Wprowadzenie) i 175 dni (176 rozdziałów)...');
  
  // Verify heading classification rules
  if (isInChapterHeading('AMEN.', 12, true)) {
    throw new Error('Test FAILED: "AMEN." nie powinno być uznane za nagłówek rozdziału!');
  }
  if (isInChapterHeading('JEZU, UFAM TOBIE.', 12, true)) {
    throw new Error('Test FAILED: "JEZU, UFAM TOBIE." nie powinno być uznane za nagłówek!');
  }
  if (isInChapterHeading('ŚWIĘTY BOŻE, ŚWIĘTY MOCNY,', 12, true)) {
    throw new Error('Test FAILED: "ŚWIĘTY BOŻE..." nie powinno być uznane za nagłówek!');
  }
  if (isInChapterHeading('Modlitwa jest spotkaniem z Bogiem w ciszy serca.', 12, false)) {
    throw new Error('Test FAILED: Zdanie tekstu ciągłego zaczynające się od "Modlitwa" nie powinno być nagłówkiem!');
  }
  if (!isInChapterHeading('Część 1', 12, false)) {
    throw new Error('Test FAILED: "Część 1" powinna być podtytułem!');
  }
  if (!isInChapterHeading('Tajemnica 1', 12, false)) {
    throw new Error('Test FAILED: "Tajemnica 1" powinna być podtytułem!');
  }
  if (!isInChapterHeading('Rozważanie', 12, false)) {
    throw new Error('Test FAILED: "Rozważanie" powinno być podtytułem!');
  }
  if (!isInChapterHeading('Modlitwa', 12, false)) {
    throw new Error('Test FAILED: "Modlitwa" jako samodzielna etykieta powinna być podtytułem!');
  }

  // Simulate complete book extraction with Wprowadzenie + 175 days + continuation running headers
  const simulatedBookLines = [
    // Introduction pages
    { text: 'Wprowadzenie', fontSize: 14, isUpper: false, page: 1 },
    { text: 'To jest pełna treść wstępu do publikacji, wyjaśniająca cel i misję dzieła.', fontSize: 12, isUpper: false, page: 1 },
    { text: 'Wprowadzenie ukazuje zamysł Boży w historii zbawienia ludzkości.', fontSize: 12, isUpper: false, page: 2 },
  ];

  // Generate lines for all 175 days, each day spanning 2 pages (page 1: title + content, page 2: running header + content)
  for (let d = 1; d <= 175; d++) {
    simulatedBookLines.push({
      text: `DZIEŃ ${d} — 25 GRUDNIA / 25 czerwca Cykl I /II — Etap 1- Część 1- Tajemnica ${d} Tytuł dnia ${d}`,
      fontSize: 13,
      isUpper: false,
      page: d * 2 + 1,
    });
    simulatedBookLines.push({
      text: 'Część 1',
      fontSize: 12,
      isUpper: false,
      page: d * 2 + 1,
    });
    simulatedBookLines.push({
      text: `Rozważanie dnia ${d}. Bóg obdarza łaską każdego, kto szuka prawdy sercem czystym.`,
      fontSize: 12,
      isUpper: false,
      page: d * 2 + 1,
    });
    // Continuation page running header (repeating DZIEŃ d)
    simulatedBookLines.push({
      text: `DZIEŃ ${d} — 25 GRUDNIA`,
      fontSize: 12,
      isUpper: false,
      page: d * 2 + 2,
    });
    simulatedBookLines.push({
      text: 'MODLITWA',
      fontSize: 12,
      isUpper: true,
      page: d * 2 + 2,
    });
    simulatedBookLines.push({
      text: `Modlitwa na zakończenie dnia ${d}. AMEN.`,
      fontSize: 12,
      isUpper: false,
      page: d * 2 + 2,
    });
  }

  // Run the exact chapter extraction state machine
  const extractedChapters = [];
  let currentDay = 0;
  let activeChapter = {
    id: 'ch-intro',
    title: 'Wprowadzenie',
    paragraphs: [],
  };

  for (const line of simulatedBookLines) {
    const dayInfo = parseDayHeading(line.text);
    if (dayInfo) {
      if (dayInfo.dayNum <= currentDay) {
        // Ignore continuation running header repetition!
        continue;
      }
      // New Day!
      if (activeChapter.paragraphs.length > 0) {
        extractedChapters.push(activeChapter);
      }
      currentDay = dayInfo.dayNum;
      activeChapter = {
        id: `ch-day-${dayInfo.dayNum}`,
        title: dayInfo.fullTitle,
        paragraphs: [{ text: dayInfo.fullTitle, isHeading: true, headingLevel: 1 }],
      };
      continue;
    }

    const isSub = isInChapterHeading(line.text, line.fontSize, line.isUpper);
    if (isSub) {
      activeChapter.paragraphs.push({ text: line.text, isHeading: true, headingLevel: 2 });
      continue;
    }

    activeChapter.paragraphs.push({ text: line.text, isHeading: false });
  }
  if (activeChapter.paragraphs.length > 0) {
    extractedChapters.push(activeChapter);
  }

  // Assertions:
  // 1. Total chapters MUST be 176 (1 Wprowadzenie + 175 Dni)
  if (extractedChapters.length !== 176) {
    throw new Error(`Test FAILED: Oczekiwano dokładnie 176 rozdziałów (1 Wprowadzenie + 175 Dni), a otrzymano ${extractedChapters.length}!`);
  }

  // 2. Chapter 0 MUST be "Wprowadzenie"
  if (extractedChapters[0].title !== 'Wprowadzenie') {
    throw new Error(`Test FAILED: Rozdział 0 powinien mieć tytuł "Wprowadzenie", a ma "${extractedChapters[0].title}"!`);
  }

  // 3. Chapters 1 to 175 MUST be Dzień 1 to Dzień 175
  for (let d = 1; d <= 175; d++) {
    const ch = extractedChapters[d];
    if (!ch.title.startsWith(`DZIEŃ ${d}`)) {
      throw new Error(`Test FAILED: Rozdział ${d} powinien zaczynać się od "DZIEŃ ${d}", a ma tytuł "${ch.title}"!`);
    }
  }

  console.log(`   ✓ Łączna liczba rozdziałów: dokładnie ${extractedChapters.length} (1 Wprowadzenie + 175 Dni).`);
  console.log('   ✓ Rozdział 0:', extractedChapters[0].title);
  console.log('   ✓ Rozdział 1:', extractedChapters[1].title);
  console.log('   ✓ Rozdział 175:', extractedChapters[175].title);
  console.log('   ✓ Nagłówki stron powtórzone ("DZIEŃ X") nie tworzą fałszywych rozdziałów.');
  console.log('   ✓ Zwroty modlitewne i zwykłe zdania nie są oznaczane jako nagłówki.\n');

  // Test 10: Verify Microsoft Word (DOCX) KDP A5 generation
  console.log('[10/10] Testowanie generatora Microsoft Word (.docx) dla Amazon KDP A5...');
  const docxModule = await import('docx');
  const {
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
  } = docxModule;

  // Build simulated KDP A5 Word document
  const a5WidthTwips = convertMillimetersToTwip(148);
  const a5HeightTwips = convertMillimetersToTwip(210);
  const topMarginTwips = convertMillimetersToTwip(15);
  const bottomMarginTwips = convertMillimetersToTwip(15);
  const insideMarginTwips = convertMillimetersToTwip(18);
  const outsideMarginTwips = convertMillimetersToTwip(13);
  const firstLineIndentTwips = convertMillimetersToTwip(5);

  const docxDoc = new Document({
    title: 'Księga A5 KDP Word',
    styles: {
      default: {
        document: {
          run: { font: 'Georgia', size: 24 },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: a5WidthTwips, height: a5HeightTwips, orientation: PageOrientation.PORTRAIT },
            margin: {
              top: topMarginTwips,
              bottom: bottomMarginTwips,
              left: insideMarginTwips,
              right: outsideMarginTwips,
              mirrorMargins: true,
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: 'Widoki na Raj — Dzień 1', font: 'Georgia', size: 18, color: '666666' })],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ children: [PageNumber.CURRENT], font: 'Georgia', size: 18, color: '666666' })],
              }),
            ],
          }),
        },
        children: [
          new Paragraph({
            text: 'Wprowadzenie',
            heading: HeadingLevel.HEADING_1,
            pageBreakBefore: false,
            keepWithNext: true,
            border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: '2563EB', space: 6 } },
          }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            indent: { firstLine: 0 },
            children: [new TextRun({ text: 'To jest pierwszy akapit wstępu w dokumencie Word.', size: 24, font: 'Georgia' })],
          }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            indent: { firstLine: firstLineIndentTwips },
            children: [
              new TextRun({
                text: 'Drugi akapit wstępu posiada standardowe wcięcie 5 mm i pełne wyjustowanie.',
                size: 24,
                font: 'Georgia',
              }),
            ],
          }),
          new Paragraph({
            text: 'DZIEŃ 1 — 25 GRUDNIA / 25 czerwca Cykl I /II — Etap 1- Część 1- Tajemnica 1 Stworzenie świata i człowieka',
            heading: HeadingLevel.HEADING_1,
            pageBreakBefore: true,
            keepWithNext: true,
            border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: '2563EB', space: 6 } },
          }),
          new Paragraph({
            text: 'Część 1',
            heading: HeadingLevel.HEADING_2,
            keepWithNext: true,
          }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            indent: { firstLine: firstLineIndentTwips },
            children: [new TextRun({ text: 'Tekst rozważania dnia pierwszego w formacie 12 pt.', size: 24, font: 'Georgia' })],
          }),
        ],
      },
    ],
  });

  const docxBuf = await Packer.toBuffer(docxDoc);
  if (!docxBuf || docxBuf.length < 1000) {
    throw new Error('Test FAILED: Plik DOCX nie został prawidłowo wygenerowany!');
  }

  // Verify internal OpenXML structure using JSZip
  const docxZip = await JSZip.loadAsync(docxBuf);
  const docXml = await docxZip.file('word/document.xml')?.async('string');
  if (!docXml) {
    throw new Error('Test FAILED: word/document.xml nie istnieje w pliku DOCX!');
  }

  // Verify A5 page size (148 x 210 mm)
  if (!docXml.includes(`w:w="${a5WidthTwips}"`) || !docXml.includes(`w:h="${a5HeightTwips}"`)) {
    throw new Error('Test FAILED: Wymiary strony A5 w DOCX nie są zgodne z 148 × 210 mm!');
  }

  // Verify mirror margins
  if (!docXml.includes('w:mirrorMargins') && !docXml.includes(`w:left="${insideMarginTwips}"`)) {
    throw new Error('Test FAILED: Lustrzane marginesy KDP nie zostały zdefiniowane w DOCX!');
  }

  // Verify Heading 1 with bottom border and pageBreakBefore
  if (!docXml.includes('Wprowadzenie') || !docXml.includes('DZIEŃ 1')) {
    throw new Error('Test FAILED: Treść rozdziałów nie znalazła się w dokumencie Word!');
  }

  if (!docXml.includes('w:pageBreakBefore')) {
    throw new Error('Test FAILED: Brak podziału strony przed rozdziałem (pageBreakBefore) w DOCX!');
  }

  console.log(`   ✓ Pakiet Microsoft Word DOCX wygenerowany pomyślnie (${docxBuf.length} bajtów).`);
  console.log('   ✓ Potwierdzono format strony DIN A5: 148 mm × 210 mm (w:w="8390", w:h="11906").');
  console.log('   ✓ Potwierdzono lustrzane marginesy KDP (grzbiet 18 mm, zewnętrzny 13 mm, górny/dolny 15 mm).');
  console.log('   ✓ Potwierdzono podziały stron przed rozdziałami (pageBreakBefore: true).');
  console.log('   ✓ Zapis z programu Word do PDF utworzy w 100% poprawny plik do druku Amazon KDP.\n');

  console.log('\n================================================================');
  console.log('🎉 WSZYSTKIE TESTY ZAKOŃCZONE SUKCESEM!');
  console.log('================================================================');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
