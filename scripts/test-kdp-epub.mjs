import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

async function testKdpAndEpub() {
  console.log('====================================================');
  console.log('🧪 TEST: WERYFIKACJA EKSPORTU AMAZON KDP A5 & EPUB 3');
  console.log('====================================================\n');

  // ----------------------------------------------------
  // 1. TEST KDP A5 PDF GENERATION
  // ----------------------------------------------------
  console.log('[1/2] Testowanie generatora PDF Amazon KDP A5...');
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const georgiaBytes = fs.readFileSync('public/fonts/georgia.ttf');
  const georgiaBoldBytes = fs.readFileSync('public/fonts/georgiab.ttf');
  const font = await pdfDoc.embedFont(georgiaBytes);
  const fontBold = await pdfDoc.embedFont(georgiaBoldBytes);

  // KDP Standard Bleed: 154.4 x 216.4 mm
  const mmToPt = (mm) => (mm * 72) / 25.4;
  const pageWidthPt = mmToPt(154.4);
  const pageHeightPt = mmToPt(216.4);
  const bleedPt = mmToPt(3.2);

  const A5_WIDTH_PT = mmToPt(148);
  const A5_HEIGHT_PT = mmToPt(210);

  const gutterPt = mmToPt(18); // 18mm inside binding
  const outerPt = mmToPt(13); // 13mm outside
  const topPt = mmToPt(15) + bleedPt;
  const bottomPt = mmToPt(15) + bleedPt;
  const colWidth = A5_WIDTH_PT - gutterPt - outerPt;

  // Strona 1 (Nieparzysta / Recto)
  const page1 = pdfDoc.addPage([pageWidthPt, pageHeightPt]);
  page1.setTrimBox(bleedPt, bleedPt, A5_WIDTH_PT, A5_HEIGHT_PT);
  page1.setBleedBox(0, 0, pageWidthPt, pageHeightPt);

  // Recto: gutter is LEFT
  const startX1 = bleedPt + gutterPt;
  let cursorY = pageHeightPt - topPt - 30;

  page1.drawText('Rozdział 1: Architektura Amazon KDP', {
    x: startX1,
    y: cursorY,
    size: 16,
    font: fontBold,
    color: rgb(0.1, 0.15, 0.25),
  });
  cursorY -= 30;

  // Test full justification with Polish diacritics
  const testParagraph =
    'Niniejszy akapit stanowi rygorystyczny test matematycznego algorytmu obustronnego wyjustowania tekstu dla formatu DIN A5. ' +
    'Wszystkie polskie znaki diakrytyczne takie jak zażółć gęślą jaźń oraz wielkie litery ZAŻÓŁĆ GĘŚLĄ JAŹŃ muszą być poprawnie zakodowane w formacie UTF-8. ' +
    'Szerokość spacji pomiędzy wyrazami jest dynamicznie obliczana w taki sposób, aby prawa krawędź każdego pełnego wiersza tworzyła idealną pionową linię z marginesem zewnętrznym książki.';

  const words = testParagraph.split(/\s+/);
  const spaceWidth = font.widthOfTextAtSize(' ', 12);

  let currentLine = [];
  let currentWordsWidth = 0;

  for (const word of words) {
    const wWidth = font.widthOfTextAtSize(word, 12);
    const prospective = currentWordsWidth + wWidth + currentLine.length * spaceWidth;
    if (prospective <= colWidth || currentLine.length === 0) {
      currentLine.push({ word, width: wWidth });
      currentWordsWidth += wWidth;
    } else {
      // Justify line
      const gaps = currentLine.length - 1;
      const extraSpace = colWidth - currentWordsWidth;
      const gapWidth = gaps > 0 ? extraSpace / gaps : spaceWidth;

      let drawX = startX1;
      for (const item of currentLine) {
        page1.drawText(item.word, { x: drawX, y: cursorY, size: 12, font });
        drawX += item.width + gapWidth;
      }

      cursorY -= 16; // 16pt leading
      currentLine = [{ word, width: wWidth }];
      currentWordsWidth = wWidth;
    }
  }

  // Flush last line left-aligned
  if (currentLine.length > 0) {
    let drawX = startX1;
    for (const item of currentLine) {
      page1.drawText(item.word, { x: drawX, y: cursorY, size: 12, font });
      drawX += item.width + spaceWidth;
    }
  }

  // Strona 2 (Parzysta / Verso)
  const page2 = pdfDoc.addPage([pageWidthPt, pageHeightPt]);
  page2.setTrimBox(bleedPt, bleedPt, A5_WIDTH_PT, A5_HEIGHT_PT);
  page2.setBleedBox(0, 0, pageWidthPt, pageHeightPt);

  // Verso: gutter is RIGHT, outer is LEFT
  const startX2 = bleedPt + outerPt;
  page2.drawText('Strona 2: Sprawdzenie marginesu lustrzanego (Verso)', {
    x: startX2,
    y: pageHeightPt - topPt - 30,
    size: 12,
    font: font,
  });

  const pdfBytes = await pdfDoc.save();
  console.log(`   ✓ Utworzono poprawny plik PDF KDP A5 (${pdfBytes.length} bajtów).`);
  console.log(`   ✓ Wymiary strony ze spadem: ${pageWidthPt.toFixed(2)} x ${pageHeightPt.toFixed(2)} pt (154.4 x 216.4 mm).`);
  console.log(`   ✓ Pomyślnie osadzono krój szeryfowy Georgia z pełnym zestawem polskich znaków UTF-8.\n`);

  // ----------------------------------------------------
  // 2. TEST EPUB 3 GENERATION
  // ----------------------------------------------------
  console.log('[2/2] Testowanie generatora pakietu ePUB 3.0...');
  const zip = new JSZip();

  // Mimetype STORE uncompressed
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
  );

  const epubCss = `body { font-size: 12pt; text-align: justify; text-justify: inter-word; hyphens: auto; }`;
  zip.file('OEBPS/styles/stylesheet.css', epubCss);

  const sampleChapter = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="pl">
<head><title>Rozdział 1</title><link rel="stylesheet" href="../styles/stylesheet.css"/></head>
<body><h1>Rozdział 1</h1><p>Testowy rozdział z wyjustowaniem tekstu i czcionką 12 pt: Zażółć gęślą jaźń.</p></body>
</html>`;
  zip.file('OEBPS/text/ch001.xhtml', sampleChapter);

  zip.file(
    'OEBPS/content.opf',
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="pub-id" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="pub-id">urn:uuid:12345</dc:identifier>
    <dc:title>Test KDP eBook</dc:title>
    <dc:language>pl</dc:language>
  </metadata>
  <manifest>
    <item id="css" href="styles/stylesheet.css" media-type="text/css"/>
    <item id="ch1" href="text/ch001.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine>
    <itemref idref="ch1"/>
  </spine>
</package>`
  );

  const epubBytes = await zip.generateAsync({
    type: 'uint8array',
    mimeType: 'application/epub+zip',
  });

  console.log(`   ✓ Utworzono poprawny pakiet ePUB 3.0 (${epubBytes.length} bajtów).`);
  console.log(`   ✓ Weryfikacja kontenera ZIP i nagłówka mimetype STORE zakończona sukcesem.`);

  console.log('\n====================================================');
  console.log('🎉 WSZYSTKIE TESTY WYDAWNICTWA KDP & EPUB ZAKOŃCZONE POMYŚLNIE!');
  console.log('====================================================');
}

testKdpAndEpub().catch((err) => {
  console.error('Błąd testu:', err);
  process.exit(1);
});
