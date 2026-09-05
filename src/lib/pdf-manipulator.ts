import { PDFDocument } from 'pdf-lib';
import { QRConfig, ProcessingProgress } from '@/types/pdf';
import { mmToPt, canvasTopLeftToPdfBottomLeft } from './coordinates';
import { interpolateQRText, generateQRPngBytes } from './qr-generator';

export interface ModifyPdfOptions {
  originalBytes: Uint8Array;
  targetPages: number[]; // 1-indexed page numbers
  totalPages: number;
  qrConfig: QRConfig;
  onProgress?: (progress: ProcessingProgress) => void;
}

/**
 * Losslessly injects QR codes into specified pages of a PDF document
 * without rasterizing or flattening the original content.
 */
export async function applyQRCodesLossless({
  originalBytes,
  targetPages,
  totalPages,
  qrConfig,
  onProgress,
}: ModifyPdfOptions): Promise<Uint8Array> {
  const startTime = performance.now();
  const sortedPages = [...new Set(targetPages)].sort((a, b) => a - b);
  const totalToProcess = sortedPages.length;

  if (totalToProcess === 0) {
    return originalBytes;
  }

  // Load existing PDF document into AST/object graph
  const pdfDoc = await PDFDocument.load(originalBytes, {
    ignoreEncryption: true,
  });

  const isDynamic = /\{page\}|\{total\}|\{p\}/i.test(qrConfig.content);
  let staticEmbeddedImage: import('pdf-lib').PDFImage | null = null;

  // Optimize: If QR code content is identical for all pages, embed it ONCE
  if (!isDynamic) {
    const pngBytes = await generateQRPngBytes(
      qrConfig.content,
      qrConfig,
      512
    );
    staticEmbeddedImage = await pdfDoc.embedPng(pngBytes);
  }

  const qrWidthPt = mmToPt(qrConfig.sizeMm);
  const qrHeightPt = mmToPt(qrConfig.sizeMm);
  const xPt = mmToPt(qrConfig.xMm);
  const yPt = mmToPt(qrConfig.yMm);

  const CHUNK_SIZE = 25; // yield to UI thread every 25 pages

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

    // Yield control periodically to avoid freezing browser UI
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

      // Small async tick
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  // Save the modified PDF directly to byte array (lossless)
  const modifiedBytes = await pdfDoc.save();
  return modifiedBytes;
}
