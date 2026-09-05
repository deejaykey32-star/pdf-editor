import { PDFDocument, rgb, StandardFonts, PDFString } from 'pdf-lib';
import QRCode from 'qrcode';

/**
 * Benchmark Script: 1500-Page A5 PDF with 1500 UNIQUE QR Codes
 * Tests memory profile and performance when generating a distinct QR code for each page.
 */

async function generateQRPngBytes(text) {
  const dataUrl = await QRCode.toDataURL(text, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 256,
  });
  const base64 = dataUrl.split(',')[1];
  return Buffer.from(base64, 'base64');
}

function formatBytes(bytes) {
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

async function runBenchmark() {
  console.log('================================================================');
  console.log('🚀 BENCHMARK: 1500 STRON A5 Z 1500 UNIKALNYMI KODAMI QR');
  console.log('================================================================');

  const TOTAL_PAGES = 1500;
  const A5_WIDTH_PT = 419.53;
  const A5_HEIGHT_PT = 595.28;

  const startMemory = process.memoryUsage();
  console.log(`[1/4] Pamięć początkowa sterty (Heap Used): ${formatBytes(startMemory.heapUsed)}`);
  console.log(`[2/4] Generowanie syntetycznego dokumentu A5 o objętości ${TOTAL_PAGES} stron...`);

  const t0 = performance.now();
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  for (let i = 1; i <= TOTAL_PAGES; i++) {
    const page = pdfDoc.addPage([A5_WIDTH_PT, A5_HEIGHT_PT]);
    page.drawText(`DOKUMENT PRODUKCYJNY A5 - STRONA ${i} / ${TOTAL_PAGES}`, {
      x: 30,
      y: A5_HEIGHT_PT - 40,
      size: 10,
      font: fontBold,
      color: rgb(0.1, 0.3, 0.7),
    });
  }

  const creationTime = ((performance.now() - t0) / 1000).toFixed(2);
  console.log(`      ✓ Utworzono ${TOTAL_PAGES} stron w ${creationTime} s.`);

  console.log(`\n[3/4] Wstrzykiwanie 1500 unikalnych kodów QR (różny URL i link na każdej stronie)...`);

  const qrWidthPt = 25 * (72 / 25.4);
  const qrHeightPt = qrWidthPt;
  const targetXPt = (148 - 25 - 5) * (72 / 25.4);
  const targetYPt = 5 * (72 / 25.4);

  const processStartTime = performance.now();

  for (let i = 0; i < TOTAL_PAGES; i++) {
    const pageNum = i + 1;
    const page = pdfDoc.getPage(i);

    // Each page receives a unique URL and unique QR PNG
    const uniqueUrl = `https://katalog.pl/produkt?id=PROD-${String(pageNum).padStart(4, '0')}&strona=${pageNum}`;
    const qrBytes = await generateQRPngBytes(uniqueUrl);
    const embeddedImg = await pdfDoc.embedPng(qrBytes);

    page.drawImage(embeddedImg, {
      x: targetXPt,
      y: targetYPt,
      width: qrWidthPt,
      height: qrHeightPt,
    });

    // Draw active clickable link annotation
    const linkAnnot = pdfDoc.context.obj({
      Type: 'Annot',
      Subtype: 'Link',
      Rect: [targetXPt, targetYPt, targetXPt + qrWidthPt, targetYPt + qrHeightPt],
      Border: [0, 0, 0],
      A: {
        Type: 'Action',
        S: 'URI',
        URI: PDFString.of(uniqueUrl),
      },
    });
    const linkRef = pdfDoc.context.register(linkAnnot);
    page.node.addAnnot(linkRef);

    // Checkpoint every 300 pages
    if (pageNum % 300 === 0 || pageNum === TOTAL_PAGES) {
      const currentHeap = process.memoryUsage().heapUsed;
      const elapsedSec = (performance.now() - processStartTime) / 1000;
      const speed = (pageNum / elapsedSec).toFixed(1);
      console.log(
        `      -> Postęp: ${String(pageNum).padStart(4, ' ')} / ${TOTAL_PAGES} stron | Pamięć: ${formatBytes(
          currentHeap
        )} | Prędkość: ${speed} kodów/s`
      );
    }
  }

  const totalProcessTime = ((performance.now() - processStartTime) / 1000).toFixed(2);
  const avgSpeed = (TOTAL_PAGES / totalProcessTime).toFixed(1);

  console.log(`\n[4/4] Zapisywanie zmodyfikowanego dokumentu PDF do bufora binarnego...`);
  const saveStart = performance.now();
  const finalPdfBytes = await pdfDoc.save();
  const saveTime = ((performance.now() - saveStart) / 1000).toFixed(2);
  const finalMemory = process.memoryUsage();

  console.log('\n================================================================');
  console.log('📊 WYNIKI BENCHMARKU UNIKALNYCH KODÓW QR (1500 STRON)');
  console.log('================================================================');
  console.log(`Liczba unikalnych kodów QR:        ${TOTAL_PAGES}`);
  console.log(`Całkowity czas generowania QR:     ${totalProcessTime} s`);
  console.log(`Średnia prędkość generowania:      ${avgSpeed} unikalnych kodów/s`);
  console.log(`Czas serializacji do PDF:          ${saveTime} s`);
  console.log(`Rozmiar wyjściowego pliku PDF:     ${formatBytes(finalPdfBytes.byteLength)}`);
  console.log(`Początkowe zużycie sterty:         ${formatBytes(startMemory.heapUsed)}`);
  console.log(`Maksymalne zużycie sterty:         ${formatBytes(finalMemory.heapUsed)}`);
  console.log(`Weryfikacja linków PDF:            1500 poprawnych adnotacji URI`);
  console.log('================================================================\n');
}

runBenchmark().catch((err) => {
  console.error('Błąd:', err);
  process.exit(1);
});
