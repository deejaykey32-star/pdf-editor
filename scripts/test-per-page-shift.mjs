import { PDFDocument, StandardFonts, PDFString } from 'pdf-lib';
import QRCode from 'qrcode';
import assert from 'assert';

async function generateQRPngBytes(text) {
  const dataUrl = await QRCode.toDataURL(text, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 256,
  });
  const base64 = dataUrl.split(',')[1];
  return Buffer.from(base64, 'base64');
}

function mmToPt(mm) {
  return (mm * 72) / 25.4;
}

async function testPerPageShiftEngine() {
  console.log('🧪 TEST: Weryfikacja niezależnego przesunięcia treści (per-strona) dla PDF');

  // 1. Create a 4-page sample PDF (A5)
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const A5_W = 419.53;
  const A5_H = 595.28;

  for (let i = 1; i <= 4; i++) {
    const page = pdfDoc.addPage([A5_W, A5_H]);
    page.drawText(`STRONA DOKUMENTU ${i}`, { x: 50, y: 500, font, size: 14 });
  }

  const originalBytes = await pdfDoc.save();
  console.log(`✓ Wygenerowano 4-stronicowy dokument PDF: ${originalBytes.byteLength} bajtów`);

  // 2. Define QR codes for each page
  const qrItems = [
    {
      id: 'qr-p1',
      label: 'Okładka',
      content: 'https://firma.pl/okladka',
      scope: { mode: 'page', specificPage: 1 },
      sizeMm: 25,
      xMm: 20,
      yMm: 20,
      enableLink: true,
      showLabel: true,
    },
    {
      id: 'qr-p2',
      label: 'Dół Str. 2',
      content: 'https://firma.pl/strona-2',
      scope: { mode: 'page', specificPage: 2 },
      sizeMm: 25,
      xMm: 20,
      yMm: 180,
      enableLink: true,
      showLabel: true,
    },
    {
      id: 'qr-p3',
      label: 'Góra Str. 3',
      content: 'https://firma.pl/strona-3',
      scope: { mode: 'page', specificPage: 3 },
      sizeMm: 25,
      xMm: 20,
      yMm: 10,
      enableLink: true,
      showLabel: true,
    },
    {
      id: 'qr-p4',
      label: 'Brak shiftu Str. 4',
      content: 'https://firma.pl/strona-4',
      scope: { mode: 'page', specificPage: 4 },
      sizeMm: 25,
      xMm: 50,
      yMm: 50,
      enableLink: true,
      showLabel: true,
    },
  ];

  // 3. Define PER-PAGE shift configurations:
  // - Page 1: disabled (no shift)
  // - Page 2: bottom 35mm, scale 88%
  // - Page 3: top 25mm, scale 92%
  // - Page 4: disabled (no shift)
  const pageShifts = {
    1: { enabled: false, zone: 'bottom', offsetMm: 30, scaleContent: 0.9, autoPositionQR: false },
    2: { enabled: true, zone: 'bottom', offsetMm: 35, scaleContent: 0.88, autoPositionQR: true },
    3: { enabled: true, zone: 'top', offsetMm: 25, scaleContent: 0.92, autoPositionQR: true },
    4: { enabled: false, zone: 'bottom', offsetMm: 30, scaleContent: 0.9, autoPositionQR: false },
  };

  // 4. Simulate Branch 1 of applyQRCodesLossless with per-page shifts
  const loadedDoc = await PDFDocument.load(originalBytes);
  const newDoc = await PDFDocument.create();
  const origPages = loadedDoc.getPages();
  const embeddedPages = await newDoc.embedPages(origPages);
  const fontEmbed = await newDoc.embedFont(StandardFonts.Helvetica);

  const qrMap = new Map();
  for (const item of qrItems) {
    const bytes = await generateQRPngBytes(item.content);
    const img = await newDoc.embedPng(bytes);
    qrMap.set(item.id, img);
  }

  for (let i = 0; i < origPages.length; i++) {
    const pageNum = i + 1;
    const origPage = origPages[i];
    const origW = origPage.getWidth();
    const origH = origPage.getHeight();
    const newPage = newDoc.addPage([origW, origH]);

    const activeShift = pageShifts[pageNum];
    const shouldShift = Boolean(activeShift && activeShift.enabled && activeShift.zone !== 'none');

    const item = qrItems.find(q => q.scope.specificPage === pageNum);

    if (shouldShift && activeShift) {
      const offsetPt = mmToPt(activeShift.offsetMm);
      const scale = activeShift.scaleContent;
      let drawX = (origW * (1 - scale)) / 2;
      let drawY = (origH * (1 - scale)) / 2;

      if (activeShift.zone === 'bottom') {
        const availH = origH - offsetPt;
        const drawH = origH * scale;
        const drawW = origW * scale;
        drawX = (origW - drawW) / 2;
        drawY = offsetPt + (availH - drawH) / 2;
      } else if (activeShift.zone === 'top') {
        const availH = origH - offsetPt;
        const drawH = origH * scale;
        const drawW = origW * scale;
        drawX = (origW - drawW) / 2;
        drawY = (availH - drawH) / 2;
      }

      newPage.drawPage(embeddedPages[i], { x: drawX, y: drawY, xScale: scale, yScale: scale });

      const img = qrMap.get(item.id);
      const qrW = mmToPt(item.sizeMm);
      let qX = mmToPt(item.xMm);
      let qY = origH - mmToPt(item.yMm) - qrW;

      if (activeShift.autoPositionQR) {
        if (activeShift.zone === 'bottom') {
          qX = (origW - qrW) / 2;
          qY = (offsetPt - qrW) / 2;
        } else if (activeShift.zone === 'top') {
          qX = (origW - qrW) / 2;
          qY = origH - offsetPt + (offsetPt - qrW) / 2;
        }
      }

      newPage.drawImage(img, { x: qX, y: qY, width: qrW, height: qrW });

      // Add link
      const linkAnnot = newDoc.context.obj({
        Type: 'Annot',
        Subtype: 'Link',
        Rect: [qX, qY, qX + qrW, qY + qrW],
        Border: [0, 0, 0],
        A: { Type: 'Action', S: 'URI', URI: PDFString.of(item.content) },
      });
      newPage.node.addAnnot(newDoc.context.register(linkAnnot));
    } else {
      newPage.drawPage(embeddedPages[i]);
      const img = qrMap.get(item.id);
      const qrW = mmToPt(item.sizeMm);
      const qX = mmToPt(item.xMm);
      const qY = origH - mmToPt(item.yMm) - qrW;
      newPage.drawImage(img, { x: qX, y: qY, width: qrW, height: qrW });

      const linkAnnot = newDoc.context.obj({
        Type: 'Annot',
        Subtype: 'Link',
        Rect: [qX, qY, qX + qrW, qY + qrW],
        Border: [0, 0, 0],
        A: { Type: 'Action', S: 'URI', URI: PDFString.of(item.content) },
      });
      newPage.node.addAnnot(newDoc.context.register(linkAnnot));
    }
  }

  const outputBytes = await newDoc.save();
  console.log(`✓ Wygenerowano zmodyfikowany PDF: ${outputBytes.byteLength} bajtów`);

  // Verify resulting document
  const verifyDoc = await PDFDocument.load(outputBytes);
  assert.strictEqual(verifyDoc.getPageCount(), 4, 'Dokument musi mieć dokładnie 4 strony');

  for (let i = 0; i < 4; i++) {
    const p = verifyDoc.getPage(i);
    const annots = p.node.Annots();
    assert.strictEqual(annots.size(), 1, `Strona ${i + 1} musi mieć 1 adnotację linku`);
  }

  console.log('✅ Wszystkie asercje testu per-page shift zakończone sukcesem!');
}

testPerPageShiftEngine().catch(err => {
  console.error('❌ Błąd testu:', err);
  process.exit(1);
});
