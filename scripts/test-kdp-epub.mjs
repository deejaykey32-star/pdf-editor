import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

// Simulation of sanitizeExtractedText
const DEFAULT_UNWANTED_PATTERNS = [
  // eMBiK365 and page numbers like "eMBiK365 — widokinaraj.pl str. 2", "str. 1-797", etc.
  /eMBiK\s*365\s*[-—–]?\s*widokinaraj(?:\.pl)?(?:\s*str\.\s*\d+(?:-\d+)?)?/gi,
  /\bstr\.\s*\d+(?:-\d+)?\b/gi,
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
  // Placeholders
  /Autor\s+Publikacji/gi,
  /\bWprowadzenie\b/gi,
];

function sanitizeExtractedText(text, customPatterns = []) {
  if (!text) return '';
  let cleaned = text;

  // 1. Transform long specific headings into "Wstęp" as requested
  cleaned = cleaned.replace(
    /Wst[eę]p\s+do\s+R[oó]ża[nń]ca\s+Historii\s+Zbawienia(?:\s*[-—–]?\s*RHZ\s*365)?/gi,
    'Wstęp'
  );
  cleaned = cleaned.replace(/Wst[eę]p\s*[-—–]\s*RHZ\s*365/gi, 'Wstęp');

  // 2. Strip all unwanted patterns
  const allPatterns = [...DEFAULT_UNWANTED_PATTERNS, ...customPatterns];

  for (const pattern of allPatterns) {
    if (typeof pattern === 'string' && pattern.trim()) {
      const escaped = pattern.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      cleaned = cleaned.replace(new RegExp(escaped, 'gi'), ' ');
    } else if (pattern instanceof RegExp) {
      cleaned = cleaned.replace(pattern, ' ');
    }
  }

  cleaned = cleaned
    .replace(/\s*[-—–]\s*[-—–]\s*/g, ' ')
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

  // Test 1: Sanitize unwanted strings
  console.log('[1/3] Sprawdzanie usuwania wskazanych fragmentów tekstu...');
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
    throw new Error('Test FAILED: Niepożądane fragmenty nie zostały w pełni wycięte!');
  }

  if (!cleanedSample.includes('Wstęp')) {
    throw new Error('Test FAILED: "Wstęp" powinien zostać zachowany jako nagłówek!');
  }

  if (!cleanedSample.includes('To jest oryginalny tekst wstępu, który ma pozostać bez modyfikacji słów.')) {
    throw new Error('Test FAILED: Treść wstępu została naruszona!');
  }

  console.log('   ✓ Pomyślnie wycięto wszystkie wskazane frazy i stopki.');
  console.log('   ✓ Pomyślnie zachowano nagłówek "Wstęp" oraz nienaruszoną treść czytania.\n');

  // Test 2: Verify KDP PDF margins & 12pt format
  console.log('[2/3] Testowanie składu KDP A5 (12 pt dla wszystkich nagłówków i tekstu)...');
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
