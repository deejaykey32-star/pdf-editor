import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

/**
 * Generates a synthetic multi-page A5 document (148 x 210 mm = 419.53 x 595.28 pt)
 * with vector text, lines and headers for immediate testing.
 */
export async function generateSyntheticA5Pdf(
  pageCount: number = 50,
  onProgress?: (current: number, total: number) => void
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const A5_WIDTH = 419.53;
  const A5_HEIGHT = 595.28;

  for (let i = 1; i <= pageCount; i++) {
    const page = pdfDoc.addPage([A5_WIDTH, A5_HEIGHT]);

    // Border guideline
    page.drawRectangle({
      x: 14.17, // ~5mm margin
      y: 14.17,
      width: A5_WIDTH - 28.34,
      height: A5_HEIGHT - 28.34,
      borderColor: rgb(0.85, 0.88, 0.92),
      borderWidth: 0.5,
    });

    // Header
    page.drawText(`DOKUMENT SPECYFIKACJI TECHNICZNEJ A5`, {
      x: 25,
      y: A5_HEIGHT - 40,
      size: 10,
      font: fontBold,
      color: rgb(0.2, 0.4, 0.8),
    });

    page.drawLine({
      start: { x: 25, y: A5_HEIGHT - 48 },
      end: { x: A5_WIDTH - 25, y: A5_HEIGHT - 48 },
      thickness: 1,
      color: rgb(0.8, 0.85, 0.9),
    });

    // Page Title
    page.drawText(`Rozdział ${i}: Karta Identyfikacyjna Partii`, {
      x: 25,
      y: A5_HEIGHT - 80,
      size: 14,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.15),
    });

    // Simulated vector text content
    const sampleLines = [
      `Numer ewidencyjny: A5-DOC-${String(i).padStart(4, '0')}-PL`,
      `Format nośnika: DIN A5 (148 x 210 mm) pionowo`,
      `Rozdzielczość projektowa: 72 DPI (punkty typograficzne PostScript)`,
      `Status weryfikacji: Gotowy do wstrzyknięcia wektorowego kodu QR`,
      `Data wygenerowania: ${new Date().toLocaleDateString('pl-PL')}`,
      `Bezpieczny margines introligatorski: 5.0 mm (14.17 pt)`,
      `Oryginalne wektory i fonty pozostają w 100% nienaruszone.`,
    ];

    let lineY = A5_HEIGHT - 120;
    for (const line of sampleLines) {
      page.drawText(line, {
        x: 25,
        y: lineY,
        size: 9,
        font: font,
        color: rgb(0.25, 0.28, 0.35),
      });
      lineY -= 18;
    }

    // Footer
    page.drawLine({
      start: { x: 25, y: 40 },
      end: { x: A5_WIDTH - 25, y: 40 },
      thickness: 0.5,
      color: rgb(0.85, 0.88, 0.92),
    });

    page.drawText(`Strona ${i} z ${pageCount} | Przetwarzanie bezstratne PDF-Lib`, {
      x: 25,
      y: 25,
      size: 8,
      font: font,
      color: rgb(0.5, 0.55, 0.6),
    });

    if (i % 25 === 0 || i === pageCount) {
      onProgress?.(i, pageCount);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  return await pdfDoc.save();
}
