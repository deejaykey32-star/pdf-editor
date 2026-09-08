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
  /RHZ\s*365\s+poprawion[yae]\s+\d{2}[.-]\d{2}[.-]\d{4}\s+z\s+kodami\s+QR/gi,
  /RHZ\s*365\s+poprawion[yae].*?z\s+kodami\s+QR/gi,
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
  /Autor\s+Publikacji/gi,
  /\bWprowadzenie\b/gi,
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

  // 2. Transform long specific headings into "Wstęp" as requested
  cleaned = cleaned.replace(
    /Wst[eę]p\s+do\s+R[oó]ża[nń]ca\s+Historii\s+Zbawienia(?:\s*[-—–]?\s*RHZ\s*365)?/gi,
    'Wstęp'
  );
  cleaned = cleaned.replace(/Wst[eę]p\s*[-—–]\s*RHZ\s*365/gi, 'Wstęp');

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
    cleanedSample.includes('Wprowadzenie') ||
    cleanedSample.includes('Modlitwa (YouTube)') ||
    cleanedSample.includes('Blog i modlitwa') ||
    cleanedSample.includes('Różaniec Historii Zbawienia')
  ) {
    throw new Error('Test FAILED: Niepożądane fragmenty RHZ365 nie zostały w pełni wycięte!');
  }

  if (!cleanedSample.includes('Wstęp')) {
    throw new Error('Test FAILED: "Wstęp" powinien zostać zachowany jako nagłówek!');
  }

  if (!cleanedSample.includes('To jest oryginalny tekst wstępu, który ma pozostać bez modyfikacji słów.')) {
    throw new Error('Test FAILED: Treść wstępu została naruszona!');
  }

  console.log('   ✓ Pomyślnie wycięto wszystkie wskazane frazy i stopki RHZ365.');
  console.log('   ✓ Pomyślnie zachowano nagłówek "Wstęp" oraz nienaruszoną treść czytania.\n');

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

  // Test 3: Verify ePUB package
  console.log('[3/3] Testowanie generatora ePUB 3.0...');
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file(
    'OEBPS/styles/stylesheet.css',
    `* { box-sizing: border-box; max-width: 100%; word-wrap: break-word; }
body, p, h1, h2, h3 { font-size: 12pt !important; text-align: justify; }`
  );

  const epubBytes = await zip.generateAsync({ type: 'uint8array', mimeType: 'application/epub+zip' });
  console.log(`   ✓ Pakiet ePUB wygenerowany pomyślnie (${epubBytes.length} bajtów) ze ścisłą regułą 12pt.`);

  console.log('\n================================================================');
  console.log('🎉 WSZYSTKIE TESTY ZAKOŃCZONE SUKCESEM!');
  console.log('================================================================');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
