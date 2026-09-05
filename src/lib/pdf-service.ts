'use client';

import { PageDimensions, PdfDocumentInfo } from '@/types/pdf';
import { ptToMm } from './coordinates';

// Cached PDF.js instance
let pdfjsLibInstance: typeof import('pdfjs-dist') | null = null;

export async function getPdfjs() {
  if (pdfjsLibInstance) return pdfjsLibInstance;
  if (typeof window === 'undefined') {
    throw new Error('PDF.js can only be loaded in the browser');
  }

  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  pdfjsLibInstance = pdfjs;
  return pdfjs;
}

export interface RenderTaskHandle {
  promise: Promise<void>;
  cancel: () => void;
}

// In-memory LRU cache for thumbnail data URLs
const THUMBNAIL_CACHE_MAX_SIZE = 50;
const thumbnailCache = new Map<string, string>();

function getThumbnailCacheKey(fileName: string, pageNum: number): string {
  return `${fileName}_p${pageNum}`;
}

/**
 * Loads a PDF document and extracts page dimensions
 */
export async function parsePdfDocument(
  file: File,
  arrayBuffer: ArrayBuffer
): Promise<PdfDocumentInfo> {
  const pdfjs = await getPdfjs();
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(arrayBuffer.slice(0)),
    cMapUrl: 'https://unpkg.com/pdfjs-dist@4.10.38/cmaps/',
    cMapPacked: true,
  });

  const pdfDoc = await loadingTask.promise;
  const pageCount = pdfDoc.numPages;
  const pages: PageDimensions[] = [];

  // Inspect first page and typical pages quickly
  for (let i = 1; i <= pageCount; i++) {
    const page = await pdfDoc.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    pages.push({
      widthPt: Number(viewport.width.toFixed(2)),
      heightPt: Number(viewport.height.toFixed(2)),
      widthMm: Number(ptToMm(viewport.width).toFixed(2)),
      heightMm: Number(ptToMm(viewport.height).toFixed(2)),
      rotation: viewport.rotation,
    });
    // Release page resources
    page.cleanup();
  }

  return {
    name: file.name,
    pageCount,
    fileSizeBytes: file.size,
    pages,
    data: new Uint8Array(arrayBuffer),
  };
}

/**
 * High-performance canvas renderer for active page
 */
export function renderActivePage(
  pdfDoc: import('pdfjs-dist').PDFDocumentProxy,
  pageNum: number,
  canvas: HTMLCanvasElement,
  scale: number = 1.0
): RenderTaskHandle {
  let isCancelled = false;
  let activeRenderTask: import('pdfjs-dist').RenderTask | null = null;

  const promise = (async () => {
    try {
      const page = await pdfDoc.getPage(pageNum);
      if (isCancelled) {
        page.cleanup();
        return;
      }

      const dpr = window.devicePixelRatio || 1;
      const viewport = page.getViewport({ scale });

      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) return;

      const renderContext = {
        canvasContext: ctx,
        viewport,
        transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
      };

      activeRenderTask = page.render(renderContext);
      await activeRenderTask.promise;
      page.cleanup();
    } catch (err: any) {
      if (err?.name !== 'RenderingCancelledException') {
        console.error(`Error rendering page ${pageNum}:`, err);
      }
    }
  })();

  return {
    promise,
    cancel: () => {
      isCancelled = true;
      if (activeRenderTask) {
        activeRenderTask.cancel();
      }
    },
  };
}

/**
 * Fast thumbnail generator with LRU cache
 */
export async function renderPageThumbnail(
  pdfDoc: import('pdfjs-dist').PDFDocumentProxy,
  docName: string,
  pageNum: number,
  scale: number = 0.25
): Promise<string> {
  const cacheKey = getThumbnailCacheKey(docName, pageNum);
  if (thumbnailCache.has(cacheKey)) {
    return thumbnailCache.get(cacheKey)!;
  }

  const page = await pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) {
    page.cleanup();
    return '';
  }

  const renderTask = page.render({
    canvasContext: ctx,
    viewport,
  });

  await renderTask.promise;
  const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
  page.cleanup();

  // Clear offscreen canvas immediately
  canvas.width = 0;
  canvas.height = 0;

  // Manage LRU cache size
  if (thumbnailCache.size >= THUMBNAIL_CACHE_MAX_SIZE) {
    const oldestKey = thumbnailCache.keys().next().value;
    if (oldestKey) thumbnailCache.delete(oldestKey);
  }
  thumbnailCache.set(cacheKey, dataUrl);

  return dataUrl;
}
