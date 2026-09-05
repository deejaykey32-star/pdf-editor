import { PDFDocument, rgb, StandardFonts, PDFString } from 'pdf-lib';
import QRCode from 'qrcode';

async function generateQRPngBytes(text) {
  const dataUrl = await QRCode.toDataURL(text, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 256,
  });
  const base64 = dataUrl.split(',')[1];
  return Buffer.from(base64, 'base64');
}

async function runTest() {
  console.log('🧪 TEST: Weryfikacja per-strona i integralności PDF');

  // 1. Create a 3-page A5 PDF
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const A5_W = 419.53;
  const A5_H = 595.28;

  for (let i = 1; i <= 3; i++) {
    const page = pdfDoc.addPage([A5_W, A5_H]);
    page.drawText(`STRONA TESTOWA ${i}`, { x: 50, y: 500, font, size: 14 });
  }

  const originalBytes = await pdfDoc.save();
  console.log(`✓ Wygenerowano oryginalny PDF o długości: ${originalBytes.byteLength} bajtów`);

  // 2. Simulate safe buffer clone
  const safeCopy = new Uint8Array(originalBytes.slice(0));

  // 3. Define 2 items: Item 1 strictly on Page 1, Item 2 strictly on Page 2
  const qrItems = [
    {
      id: 'qr-p1',
      label: 'Kod Strona 1',
      content: 'https://firma.pl/oferta-1',
      scope: { mode: 'page', specificPage: 1 },
      sizeMm: 25,
      xMm: 118,
      yMm: 180,
      enableLink: true,
      showLabel: true,
    },
    {
      id: 'qr-p2',
      label: 'Kod Strona 2',
      content: 'https://firma.pl/oferta-2',
      scope: { mode: 'page', specificPage: 2 },
      sizeMm: 25,
      xMm: 118,
      yMm: 180,
      enableLink: true,
      showLabel: true,
    },
  ];

  // 4. Test loading and modifying
  const loadedDoc = await PDFDocument.load(safeCopy);
  const totalPages = loadedDoc.getPageCount();
  console.log(`✓ PDFDocument.load pomyślnie sparsował dokument (${totalPages} stron) bez błędów!`);

  for (let i = 0; i < totalPages; i++) {
    const pageNum = i + 1;
    const page = loadedDoc.getPage(i);
    const assignedItems = qrItems.filter((q) => q.scope.specificPage === pageNum);

    console.log(`   Strona ${pageNum}: znaleziono ${assignedItems.length} przypisanych kodów QR`);

    for (const item of assignedItems) {
      const pngBytes = await generateQRPngBytes(item.content);
      const embedded = await loadedDoc.embedPng(pngBytes);
      page.drawImage(embedded, { x: 100, y: 100, width: 50, height: 50 });

      const linkAnnot = loadedDoc.context.obj({
        Type: 'Annot',
        Subtype: 'Link',
        Rect: [100, 100, 150, 150],
        Border: [0, 0, 0],
        A: {
          Type: 'Action',
          S: 'URI',
          URI: PDFString.of(item.content),
        },
      });
      const linkRef = loadedDoc.context.register(linkAnnot);
      page.node.addAnnot(linkRef);
    }
  }

  const finalPdf = await loadedDoc.save();
  console.log(`✓ Pomyślnie zapisano wyjściowy PDF (${finalPdf.byteLength} bajtów)!`);

  // 5. Verify final output
  const verifiedDoc = await PDFDocument.load(finalPdf);
  const p1Annots = verifiedDoc.getPage(0).node.Annots();
  const p2Annots = verifiedDoc.getPage(1).node.Annots();
  const p3Annots = verifiedDoc.getPage(2).node.Annots();

  if (p1Annots?.size() === 1 && p2Annots?.size() === 1 && (!p3Annots || p3Annots?.size() === 0)) {
    console.log('✅ SUKCES: Strona 1 ma Kod 1, Strona 2 ma Kod 2, Strona 3 jest czysta!');
  } else {
    throw new Error('Niepoprawne przypisanie adnotacji!');
  }
}

runTest().catch((err) => {
  console.error('BŁĄD TESTU:', err);
  process.exit(1);
});
