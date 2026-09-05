import { PDFDocument, rgb, StandardFonts, PDFString } from 'pdf-lib';
import { QRConfig, QRCodeItem, ProcessingProgress, PageShiftConfig } from '@/types/pdf';
import { mmToPt, canvasTopLeftToPdfBottomLeft, parsePageRange } from './coordinates';
import { interpolateQRText, generateQRPngBytes } from './qr-generator';

export interface ModifyPdfOptions {
  originalBytes: Uint8Array;
  qrItems: QRCodeItem[];
  totalPages: number;
  pageShift?: PageShiftConfig;
  onProgress?: (progress: ProcessingProgress) => void;
}

/**
 * Draws a QR code with an optional identification label and an active clickable PDF Link Annotation.
 */
function drawQRWithLinkAndLabel({
  doc,
  page,
  item,
  qrDrawX,
  qrDrawY,
  qrWidthPt,
  qrHeightPt,
  image,
  pageNum,
  totalPages,
  font,
  fontBold,
}: {
  doc: PDFDocument;
  page: import('pdf-lib').PDFPage;
  item: QRCodeItem;
  qrDrawX: number;
  qrDrawY: number;
  qrWidthPt: number;
  qrHeightPt: number;
  image: import('pdf-lib').PDFImage;
  pageNum: number;
  totalPages: number;
  font: import('pdf-lib').PDFFont;
  fontBold: import('pdf-lib').PDFFont;
}) {
  // 1. Draw QR Image
  page.drawImage(image, {
    x: qrDrawX,
    y: qrDrawY,
    width: qrWidthPt,
    height: qrHeightPt,
  });

  const labelHeight = 12;
  const isLabelVisible = item.showLabel !== false && Boolean(item.label?.trim());
  const labelPos = item.labelPosition || 'bottom';
  let labelY = qrDrawY - labelHeight - 2;

  if (labelPos === 'top') {
    labelY = qrDrawY + qrHeightPt + 2;
  }

  // 2. Draw Identification Label
  if (isLabelVisible) {
    // Subtle background card
    page.drawRectangle({
      x: qrDrawX,
      y: labelY,
      width: qrWidthPt,
      height: labelHeight,
      color: rgb(0.96, 0.97, 0.98),
      borderColor: rgb(0.8, 0.84, 0.9),
      borderWidth: 0.5,
    });

    // Fit text inside label
    const fontSize = 7;
    let labelText = item.label.trim();
    while (fontBold.widthOfTextAtSize(labelText, fontSize) > qrWidthPt - 6 && labelText.length > 3) {
      labelText = labelText.slice(0, -1);
    }
    if (labelText !== item.label.trim()) {
      labelText += '..';
    }

    const textWidth = fontBold.widthOfTextAtSize(labelText, fontSize);
    const textX = qrDrawX + (qrWidthPt - textWidth) / 2;

    page.drawText(labelText, {
      x: textX,
      y: labelY + 3,
      size: fontSize,
      font: fontBold,
      color: rgb(0.12, 0.18, 0.28),
    });
  }

  // 3. Add Active Clickable Link Annotation
  if (item.enableLink !== false && item.content?.trim()) {
    let targetUrl = interpolateQRText(item.content, pageNum, totalPages).trim();

    // Ensure valid web URL scheme
    if (
      !/^[a-zA-Z0-9+-.]+:\/\//.test(targetUrl) &&
      !targetUrl.startsWith('mailto:') &&
      !targetUrl.startsWith('tel:')
    ) {
      targetUrl = 'https://' + targetUrl;
    }

    // Annotation rect encompasses QR + Label
    let rectY0 = qrDrawY;
    let rectY1 = qrDrawY + qrHeightPt;

    if (isLabelVisible) {
      if (labelPos === 'bottom') {
        rectY0 = labelY;
      } else {
        rectY1 = labelY + labelHeight;
      }
    }

    const linkAnnot = doc.context.obj({
      Type: 'Annot',
      Subtype: 'Link',
      Rect: [qrDrawX, rectY0, qrDrawX + qrWidthPt, rectY1],
      Border: [0, 0, 0],
      A: {
        Type: 'Action',
        S: 'URI',
        URI: PDFString.of(targetUrl),
      },
    });

    const linkRef = doc.context.register(linkAnnot);
    page.node.addAnnot(linkRef);
  }
}

/**
 * Losslessly injects multiple distinct QR codes across pages of a PDF document
 * with active clickable links, identification labels, and optional content shifting.
 */
export async function applyQRCodesLossless({
  originalBytes,
  qrItems,
  totalPages,
  pageShift,
  onProgress,
}: ModifyPdfOptions): Promise<Uint8Array> {
  const startTime = performance.now();

  if (qrItems.length === 0 || totalPages <= 0) {
    return originalBytes;
  }

  const pdfDoc = await PDFDocument.load(originalBytes, {
    ignoreEncryption: true,
  });

  const isShiftEnabled = pageShift && pageShift.enabled && pageShift.zone !== 'none';

  // Pre-calculate target pages for each QR item
  const itemTargets = qrItems.map((item) => {
    const pageSet = new Set(
      parsePageRange(item.scope.mode, item.scope.rangeString, 1, totalPages)
    );
    const isDynamic = /\{page\}|\{total\}|\{p\}/i.test(item.content);
    return {
      item,
      pageSet,
      isDynamic,
    };
  });

  // Pre-generate static PNG bytes cache for each static QR item
  const staticPngCache = new Map<string, Uint8Array>();
  for (const { item, isDynamic } of itemTargets) {
    if (!isDynamic) {
      const pngBytes = await generateQRPngBytes(item.content, item, 512);
      staticPngCache.set(item.id, pngBytes);
    }
  }

  const CHUNK_SIZE = 20;

  // Branch 1: Content Shifting Mode (rebuilding pages with Form XObject transformations)
  if (isShiftEnabled) {
    const newDoc = await PDFDocument.create();
    const origPages = pdfDoc.getPages();
    const embeddedPages = await newDoc.embedPages(origPages);
    const font = await newDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await newDoc.embedFont(StandardFonts.HelveticaBold);

    const embeddedImageMap = new Map<string, import('pdf-lib').PDFImage>();
    for (const [id, bytes] of staticPngCache.entries()) {
      const img = await newDoc.embedPng(bytes);
      embeddedImageMap.set(id, img);
    }

    const offsetPt = mmToPt(pageShift.offsetMm);
    const scale = Math.max(0.7, Math.min(1.0, pageShift.scaleContent));

    for (let i = 0; i < origPages.length; i++) {
      const pageNum = i + 1;
      const origPage = origPages[i];
      const origW = origPage.getWidth();
      const origH = origPage.getHeight();

      const newPage = newDoc.addPage([origW, origH]);
      const pageQRs = itemTargets.filter(({ pageSet }) => pageSet.has(pageNum));

      if (pageQRs.length > 0) {
        let drawX = (origW * (1 - scale)) / 2;
        let drawY = (origH * (1 - scale)) / 2;

        if (pageShift.zone === 'bottom') {
          const availH = origH - offsetPt;
          const drawH = origH * scale;
          const drawW = origW * scale;
          drawX = (origW - drawW) / 2;
          drawY = offsetPt + (availH - drawH) / 2;
        } else if (pageShift.zone === 'top') {
          const availH = origH - offsetPt;
          const drawH = origH * scale;
          const drawW = origW * scale;
          drawX = (origW - drawW) / 2;
          drawY = (availH - drawH) / 2;
        } else if (pageShift.zone === 'left') {
          const availW = origW - offsetPt;
          const drawW = origW * scale;
          const drawH = origH * scale;
          drawX = offsetPt + (availW - drawW) / 2;
          drawY = (origH - drawH) / 2;
        } else if (pageShift.zone === 'right') {
          const availW = origW - offsetPt;
          const drawW = origW * scale;
          const drawH = origH * scale;
          drawX = (availW - drawW) / 2;
          drawY = (origH - drawH) / 2;
        }

        newPage.drawPage(embeddedPages[i], {
          x: drawX,
          y: drawY,
          xScale: scale,
          yScale: scale,
        });

        // Draw all assigned QR codes with clickable links and labels
        for (const { item, isDynamic } of pageQRs) {
          const qrWidthPt = mmToPt(item.sizeMm);
          const qrHeightPt = mmToPt(item.sizeMm);
          let qrDrawX = mmToPt(item.xMm);
          let qrDrawY = origH - mmToPt(item.yMm) - qrHeightPt;

          if (pageShift.autoPositionQR && pageQRs.length === 1) {
            if (pageShift.zone === 'bottom') {
              qrDrawX = (origW - qrWidthPt) / 2;
              qrDrawY = (offsetPt - qrHeightPt) / 2;
            } else if (pageShift.zone === 'top') {
              qrDrawX = (origW - qrWidthPt) / 2;
              qrDrawY = origH - offsetPt + (offsetPt - qrHeightPt) / 2;
            }
          }

          let img = embeddedImageMap.get(item.id);
          if (isDynamic) {
            const pageText = interpolateQRText(item.content, pageNum, totalPages);
            const dynBytes = await generateQRPngBytes(pageText, item, 512);
            img = await newDoc.embedPng(dynBytes);
          }

          if (img) {
            drawQRWithLinkAndLabel({
              doc: newDoc,
              page: newPage,
              item,
              qrDrawX,
              qrDrawY,
              qrWidthPt,
              qrHeightPt,
              image: img,
              pageNum,
              totalPages,
              font,
              fontBold,
            });
          }
        }
      } else {
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

  // Branch 2: Standard In-Place Multi-QR Overlay Injection
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const embeddedImageMap = new Map<string, import('pdf-lib').PDFImage>();
  for (const [id, bytes] of staticPngCache.entries()) {
    const img = await pdfDoc.embedPng(bytes);
    embeddedImageMap.set(id, img);
  }

  const pageCount = pdfDoc.getPageCount();

  for (let i = 0; i < pageCount; i++) {
    const pageNum = i + 1;
    const page = pdfDoc.getPage(i);
    const pageHeightPt = page.getHeight();

    const pageQRs = itemTargets.filter(({ pageSet }) => pageSet.has(pageNum));

    for (const { item, isDynamic } of pageQRs) {
      const qrWidthPt = mmToPt(item.sizeMm);
      const qrHeightPt = mmToPt(item.sizeMm);
      const xPt = mmToPt(item.xMm);
      const yPt = mmToPt(item.yMm);

      const { xPdf, yPdf } = canvasTopLeftToPdfBottomLeft(
        xPt,
        yPt,
        qrHeightPt,
        pageHeightPt
      );

      let imageToDraw = embeddedImageMap.get(item.id);
      if (isDynamic) {
        const pageText = interpolateQRText(item.content, pageNum, totalPages);
        const dynamicBytes = await generateQRPngBytes(pageText, item, 512);
        imageToDraw = await pdfDoc.embedPng(dynamicBytes);
      }

      if (imageToDraw) {
        drawQRWithLinkAndLabel({
          doc: pdfDoc,
          page,
          item,
          qrDrawX: xPdf,
          qrDrawY: yPdf,
          qrWidthPt,
          qrHeightPt,
          image: imageToDraw,
          pageNum,
          totalPages,
          font,
          fontBold,
        });
      }
    }

    if (i % CHUNK_SIZE === 0 || i === pageCount - 1) {
      const elapsedSec = (performance.now() - startTime) / 1000;
      const pagesDone = i + 1;
      const speed = pagesDone / Math.max(elapsedSec, 0.05);
      const remainingPages = pageCount - pagesDone;
      const eta = remainingPages > 0 ? remainingPages / Math.max(speed, 1) : 0;

      onProgress?.({
        currentPage: pageNum,
        totalPages: pageCount,
        percent: Math.round((pagesDone / pageCount) * 100),
        speedPagesPerSec: Number(speed.toFixed(1)),
        etaSeconds: Math.ceil(eta),
        status: pagesDone === pageCount ? 'completed' : 'processing',
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

  const targetIndex = Math.max(0, Math.min(insertAtPage - 1, pdfDoc.getPageCount()));
  const page = pdfDoc.insertPage(targetIndex, [A5_WIDTH, A5_HEIGHT]);

  page.drawRectangle({
    x: 20,
    y: 20,
    width: A5_WIDTH - 40,
    height: A5_HEIGHT - 40,
    borderColor: rgb(0.85, 0.88, 0.92),
    borderWidth: 1,
  });

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

  const qrPngBytes = await generateQRPngBytes(qrConfig.content, qrConfig, 512);
  const qrImage = await pdfDoc.embedPng(qrPngBytes);
  const qrSizePt = 140;
  const qrX = (A5_WIDTH - qrSizePt) / 2;
  const qrY = A5_HEIGHT / 2 - 40;

  page.drawImage(qrImage, {
    x: qrX,
    y: qrY,
    width: qrSizePt,
    height: qrSizePt,
  });

  page.drawText('Zeskanuj kod lub kliknij pole, aby przejść do zasobu', {
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

  // Active clickable Link Annotation for Cover Page QR
  let targetUrl = qrConfig.content.trim();
  if (
    !/^[a-zA-Z0-9+-.]+:\/\//.test(targetUrl) &&
    !targetUrl.startsWith('mailto:') &&
    !targetUrl.startsWith('tel:')
  ) {
    targetUrl = 'https://' + targetUrl;
  }

  const linkAnnot = pdfDoc.context.obj({
    Type: 'Annot',
    Subtype: 'Link',
    Rect: [qrX, qrY, qrX + qrSizePt, qrY + qrSizePt],
    Border: [0, 0, 0],
    A: {
      Type: 'Action',
      S: 'URI',
      URI: PDFString.of(targetUrl),
    },
  });
  const linkRef = pdfDoc.context.register(linkAnnot);
  page.node.addAnnot(linkRef);

  page.drawText('Wszystkie kolejne strony zostały bezstratnie przesunięte o +1', {
    x: 35,
    y: 35,
    size: 8,
    font,
    color: rgb(0.6, 0.65, 0.7),
  });

  return await pdfDoc.save();
}
