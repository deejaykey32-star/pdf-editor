import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { QRConfig, ProcessingProgress, PageShiftConfig } from '@/types/pdf';
import { mmToPt, canvasTopLeftToPdfBottomLeft } from './coordinates';
import { interpolateQRText, generateQRPngBytes } from './qr-generator';

export interface ModifyPdfOptions {
  originalBytes: Uint8Array;
  targetPages: number[]; // 1-indexed page numbers
  totalPages: number;
  qrConfig: QRConfig;
  pageShift?: PageShiftConfig;
  onProgress?: (progress: ProcessingProgress) => void;
}

/**
 * Losslessly injects QR codes into specified pages of a PDF document
 * with support for Smart Content Shifting (reserving clean banner/margin space)
 * without rasterizing or flattening the original content.
 */
export async function applyQRCodesLossless({
  originalBytes,
  targetPages,
  totalPages,
  qrConfig,
  pageShift,
  onProgress,
}: ModifyPdfOptions): Promise<Uint8Array> {
  const startTime = performance.now();
  const sortedPages = [...new Set(targetPages)].sort((a, b) => a - b);
  const targetPageSet = new Set(sortedPages);
  const totalToProcess = sortedPages.length;

  if (totalToProcess === 0) {
    return originalBytes;
  }

  // Load existing PDF document into AST/object graph
  const pdfDoc = await PDFDocument.load(originalBytes, {
    ignoreEncryption: true,
  });

  const isDynamic = /\{page\}|\{total\}|\{p\}/i.test(qrConfig.content);
  const isShiftEnabled = pageShift && pageShift.enabled && pageShift.zone !== 'none';

  // Optimize: Pre-generate QR code if static
  const staticPngBytes = !isDynamic
    ? await generateQRPngBytes(qrConfig.content, qrConfig, 512)
    : null;

  const qrWidthPt = mmToPt(qrConfig.sizeMm);
  const qrHeightPt = mmToPt(qrConfig.sizeMm);
  const xPt = mmToPt(qrConfig.xMm);
  const yPt = mmToPt(qrConfig.yMm);

  const CHUNK_SIZE = 25;

  // Branch 1: Content Shifting Mode (rebuilding pages with Form XObject transformations)
  if (isShiftEnabled) {
    const newDoc = await PDFDocument.create();
    const origPages = pdfDoc.getPages();
    const embeddedPages = await newDoc.embedPages(origPages);
    const staticEmbedded = staticPngBytes ? await newDoc.embedPng(staticPngBytes) : null;
    const offsetPt = mmToPt(pageShift.offsetMm);
    const scale = Math.max(0.7, Math.min(1.0, pageShift.scaleContent));

    for (let i = 0; i < origPages.length; i++) {
      const pageNum = i + 1;
      const origPage = origPages[i];
      const origW = origPage.getWidth();
      const origH = origPage.getHeight();

      const newPage = newDoc.addPage([origW, origH]);
      const isTargeted = targetPageSet.has(pageNum);

      if (isTargeted) {
        let drawX = (origW * (1 - scale)) / 2;
        let drawY = (origH * (1 - scale)) / 2;
        let qrDrawX = xPt;
        let qrDrawY = origH - yPt - qrHeightPt;

        if (pageShift.zone === 'bottom') {
          // Shift content up by offsetPt, reserve bottom strip for QR
          const availH = origH - offsetPt;
          const drawH = origH * scale;
          const drawW = origW * scale;
          drawX = (origW - drawW) / 2;
          drawY = offsetPt + (availH - drawH) / 2;

          // Position QR in the clean bottom banner
          if (pageShift.autoPositionQR) {
            qrDrawX = (origW - qrWidthPt) / 2;
            qrDrawY = (offsetPt - qrHeightPt) / 2;
          }
        } else if (pageShift.zone === 'top') {
          // Shift content down, reserve top strip for QR
          const availH = origH - offsetPt;
          const drawH = origH * scale;
          const drawW = origW * scale;
          drawX = (origW - drawW) / 2;
          drawY = (availH - drawH) / 2;

          if (pageShift.autoPositionQR) {
            qrDrawX = (origW - qrWidthPt) / 2;
            qrDrawY = origH - offsetPt + (offsetPt - qrHeightPt) / 2;
          }
        } else if (pageShift.zone === 'left') {
          // Shift content right, reserve left margin
          const availW = origW - offsetPt;
          const drawW = origW * scale;
          const drawH = origH * scale;
          drawX = offsetPt + (availW - drawW) / 2;
          drawY = (origH - drawH) / 2;

          if (pageShift.autoPositionQR) {
            qrDrawX = (offsetPt - qrWidthPt) / 2;
            qrDrawY = (origH - qrHeightPt) / 2;
          }
        } else if (pageShift.zone === 'right') {
          // Shift content left, reserve right margin
          const availW = origW - offsetPt;
          const drawW = origW * scale;
          const drawH = origH * scale;
          drawX = (availW - drawW) / 2;
          drawY = (origH - drawH) / 2;

          if (pageShift.autoPositionQR) {
            qrDrawX = origW - offsetPt + (offsetPt - qrWidthPt) / 2;
            qrDrawY = (origH - qrHeightPt) / 2;
          }
        }

        // Draw original content shifted as vector Form XObject
        newPage.drawPage(embeddedPages[i], {
          x: drawX,
          y: drawY,
          xScale: scale,
          yScale: scale,
        });

        // Draw QR code
        let img = staticEmbedded;
        if (isDynamic) {
          const pageText = interpolateQRText(qrConfig.content, pageNum, totalPages);
          const dynBytes = await generateQRPngBytes(pageText, qrConfig, 512);
          img = await newDoc.embedPng(dynBytes);
        }

        if (img) {
          newPage.drawImage(img, {
            x: qrDrawX,
            y: qrDrawY,
            width: qrWidthPt,
            height: qrHeightPt,
          });
        }
      } else {
        // Page untouched
        newPage.drawPage(embeddedPages[i]);
      }

      if (i % CHUNK_SIZE === 0 || i === origPages.length - 1) {
        const elapsedSec = (performance.now() - startTime) / 1000;
        const pagesDone = i + 1;
        const speed = pagesDone / Math.max(elapsedSec, 0.05);
        onProgress?.({
          currentPage: pageNum,
          totalPages: origPages.length,
          percent: Math.round((pagesDone / origPages.length) * 100),
          speedPagesPerSec: Number(speed.toFixed(1)),
          etaSeconds: Math.ceil((origPages.length - pagesDone) / Math.max(speed, 1)),
          status: pagesDone === origPages.length ? 'completed' : 'processing',
        });
        await new Promise((r) => setTimeout(r, 0));
      }
    }

    return await newDoc.save();
  }

  // Branch 2: Standard In-Place Overlay Injection
  let staticEmbeddedImage: import('pdf-lib').PDFImage | null = null;
  if (!isDynamic && staticPngBytes) {
    staticEmbeddedImage = await pdfDoc.embedPng(staticPngBytes);
  }

  for (let i = 0; i < totalToProcess; i++) {
    const pageNum = sortedPages[i];
    const pageIndex = pageNum - 1;

    if (pageIndex >= 0 && pageIndex < pdfDoc.getPageCount()) {
      const page = pdfDoc.getPage(pageIndex);
      const pageHeightPt = page.getHeight();

      const { xPdf, yPdf } = canvasTopLeftToPdfBottomLeft(
        xPt,
        yPt,
        qrHeightPt,
        pageHeightPt
      );

      let imageToDraw = staticEmbeddedImage;
      if (isDynamic) {
        const pageText = interpolateQRText(qrConfig.content, pageNum, totalPages);
        const dynamicBytes = await generateQRPngBytes(pageText, qrConfig, 512);
        imageToDraw = await pdfDoc.embedPng(dynamicBytes);
      }

      if (imageToDraw) {
        page.drawImage(imageToDraw, {
          x: xPdf,
          y: yPdf,
          width: qrWidthPt,
          height: qrHeightPt,
        });
      }
    }

    if (i % CHUNK_SIZE === 0 || i === totalToProcess - 1) {
      const elapsedSec = (performance.now() - startTime) / 1000;
      const pagesDone = i + 1;
      const speed = pagesDone / Math.max(elapsedSec, 0.05);
      const remainingPages = totalToProcess - pagesDone;
      const eta = remainingPages > 0 ? remainingPages / Math.max(speed, 1) : 0;

      onProgress?.({
        currentPage: pageNum,
        totalPages: totalToProcess,
        percent: Math.round((pagesDone / totalToProcess) * 100),
        speedPagesPerSec: Number(speed.toFixed(1)),
        etaSeconds: Math.ceil(eta),
        status: pagesDone === totalToProcess ? 'completed' : 'processing',
      });

      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  return await pdfDoc.save();
}

/**
 * Inserts a dedicated A5 QR index/cover page at a specific index (1-indexed),
 * shifting all subsequent pages forward (+1 page).
 */
export async function insertDedicatedQRPage({
  originalBytes,
  insertAtPage = 1,
  qrConfig,
  title = 'Karta Identyfikacyjna i Kod QR',
  subtitle = 'Dedykowana strona metadanych dokumentu (A5)',
}: {
  originalBytes: Uint8Array;
  insertAtPage?: number;
  qrConfig: QRConfig;
  title?: string;
  subtitle?: string;
}): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(originalBytes, { ignoreEncryption: true });
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const A5_WIDTH = 419.53;
  const A5_HEIGHT = 595.28;

  // Insert blank A5 page at target index (0-indexed)
  const targetIndex = Math.max(0, Math.min(insertAtPage - 1, pdfDoc.getPageCount()));
  const page = pdfDoc.insertPage(targetIndex, [A5_WIDTH, A5_HEIGHT]);

  // Frame border
  page.drawRectangle({
    x: 20,
    y: 20,
    width: A5_WIDTH - 40,
    height: A5_HEIGHT - 40,
    borderColor: rgb(0.85, 0.88, 0.92),
    borderWidth: 1,
  });

  // Title
  page.drawText(title, {
    x: 35,
    y: A5_HEIGHT - 80,
    size: 16,
    font: fontBold,
    color: rgb(0.1, 0.15, 0.25),
  });

  page.drawText(subtitle, {
    x: 35,
    y: A5_HEIGHT - 100,
    size: 10,
    font,
    color: rgb(0.4, 0.45, 0.5),
  });

  page.drawLine({
    start: { x: 35, y: A5_HEIGHT - 115 },
    end: { x: A5_WIDTH - 35, y: A5_HEIGHT - 115 },
    thickness: 1,
    color: rgb(0.85, 0.88, 0.92),
  });

  // Large centered QR code
  const qrPngBytes = await generateQRPngBytes(qrConfig.content, qrConfig, 512);
  const qrImage = await pdfDoc.embedPng(qrPngBytes);
  const qrSizePt = 140; // prominent size
  const qrX = (A5_WIDTH - qrSizePt) / 2;
  const qrY = A5_HEIGHT / 2 - 40;

  page.drawImage(qrImage, {
    x: qrX,
    y: qrY,
    width: qrSizePt,
    height: qrSizePt,
  });

  // QR Label
  page.drawText('Zeskanuj kod, aby przejść do zasobu cyfrowego', {
    x: 35,
    y: qrY - 30,
    size: 9,
    font,
    color: rgb(0.3, 0.35, 0.4),
  });

  page.drawText(`Link docelowy: ${qrConfig.content}`, {
    x: 35,
    y: qrY - 45,
    size: 8,
    font,
    color: rgb(0.5, 0.55, 0.6),
  });

  // Footer
  page.drawText('Wszystkie kolejne strony zostały bezstratnie przesunięte o +1', {
    x: 35,
    y: 35,
    size: 8,
    font,
    color: rgb(0.6, 0.65, 0.7),
  });

  return await pdfDoc.save();
}
