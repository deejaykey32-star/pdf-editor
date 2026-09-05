'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Eye,
  Move,
} from 'lucide-react';
import { PdfDocumentInfo, QRConfig } from '@/types/pdf';
import { renderActivePage, RenderTaskHandle } from '@/lib/pdf-service';
import { InteractiveQRBox } from './InteractiveQRBox';
import { mmToPt } from '@/lib/coordinates';

interface WorkspaceCenterProps {
  documentInfo: PdfDocumentInfo | null;
  pdfDocProxy: import('pdfjs-dist').PDFDocumentProxy | null;
  currentPage: number;
  onPageChange: (page: number) => void;
  qrConfig: QRConfig;
  onChangeQRConfig: (updated: Partial<QRConfig>) => void;
  targetPages: Set<number>;
  qrPreviewUrl?: string;
  zoomScale: number;
  onZoomChange: (scale: number) => void;
}

export const WorkspaceCenter: React.FC<WorkspaceCenterProps> = ({
  documentInfo,
  pdfDocProxy,
  currentPage,
  onPageChange,
  qrConfig,
  onChangeQRConfig,
  targetPages,
  qrPreviewUrl,
  zoomScale,
  onZoomChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<RenderTaskHandle | null>(null);
  const [showSafetyGuide, setShowSafetyGuide] = useState(true);

  // Pan state
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ x: number; y: number; startX: number; startY: number }>({
    x: 0,
    y: 0,
    startX: 0,
    startY: 0,
  });

  const currentPageDim = documentInfo?.pages[currentPage - 1] || {
    widthPt: 419.53,
    heightPt: 595.28,
    widthMm: 148,
    heightMm: 210,
    rotation: 0,
  };

  // Render active page to canvas when page or zoom changes
  useEffect(() => {
    if (!pdfDocProxy || !canvasRef.current) return;

    // Cancel previous render
    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
    }

    const task = renderActivePage(pdfDocProxy, currentPage, canvasRef.current, zoomScale);
    renderTaskRef.current = task;

    return () => {
      task.cancel();
    };
  }, [pdfDocProxy, currentPage, zoomScale]);

  // Zoom helpers
  const handleZoom = (delta: number) => {
    onZoomChange(Math.max(0.25, Math.min(3.0, Number((zoomScale + delta).toFixed(2)))));
  };

  const handleFitPage = () => {
    if (!containerRef.current) return;
    const containerH = containerRef.current.clientHeight - 80;
    const pageH = currentPageDim.heightPt;
    const newScale = Math.min(2.0, Math.max(0.3, Number((containerH / pageH).toFixed(2))));
    onZoomChange(newScale);
    setPanOffset({ x: 0, y: 0 });
  };

  const handleFitWidth = () => {
    if (!containerRef.current) return;
    const containerW = containerRef.current.clientWidth - 120;
    const pageW = currentPageDim.widthPt;
    const newScale = Math.min(2.0, Math.max(0.3, Number((containerW / pageW).toFixed(2))));
    onZoomChange(newScale);
    setPanOffset({ x: 0, y: 0 });
  };

  const handleResetZoom = () => {
    onZoomChange(1.0);
    setPanOffset({ x: 0, y: 0 });
  };

  // Mouse wheel zoom / pan
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.1 : -0.1;
      handleZoom(delta);
    }
  };

  // Panning handlers
  const handleContainerMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || e.altKey || e.target === containerRef.current) {
      setIsPanning(true);
      panStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        startX: panOffset.x,
        startY: panOffset.y,
      };
    }
  };

  const handleContainerMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPanOffset({
        x: panStartRef.current.startX + (e.clientX - panStartRef.current.x),
        y: panStartRef.current.startY + (e.clientY - panStartRef.current.y),
      });
    }
  };

  const handleContainerMouseUp = () => {
    setIsPanning(false);
  };

  const isPageTargeted = targetPages.has(currentPage);

  return (
    <main
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleContainerMouseDown}
      onMouseMove={handleContainerMouseMove}
      onMouseUp={handleContainerMouseUp}
      className="flex-1 h-full workspace-grid relative overflow-hidden flex flex-col items-center justify-center select-none"
    >
      {/* Floating Toolbar: Zoom, Navigation, Guide toggle */}
      <div className="absolute top-4 z-20 glass-panel rounded-lg shadow-xl px-2 py-1.5 flex items-center gap-1.5 text-zinc-300">
        {/* Page Nav */}
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
          className="p-1.5 hover:bg-zinc-800 disabled:opacity-30 rounded transition cursor-pointer"
          title="Poprzednia strona (Strzałka w lewo)"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <span className="text-xs font-mono px-2 py-0.5 bg-zinc-900 rounded border border-zinc-800 text-zinc-100">
          {currentPage} / {documentInfo?.pageCount || 1}
        </span>

        <button
          onClick={() => onPageChange(Math.min(documentInfo?.pageCount || 1, currentPage + 1))}
          disabled={!documentInfo || currentPage >= documentInfo.pageCount}
          className="p-1.5 hover:bg-zinc-800 disabled:opacity-30 rounded transition cursor-pointer"
          title="Następna strona (Strzałka w prawo)"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <div className="w-[1px] h-4 bg-zinc-700 mx-1" />

        {/* Zoom Controls */}
        <button
          onClick={() => handleZoom(-0.15)}
          className="p-1.5 hover:bg-zinc-800 rounded transition cursor-pointer"
          title="Pomniejsz (-)"
        >
          <ZoomOut className="w-4 h-4" />
        </button>

        <button
          onClick={handleResetZoom}
          className="px-2 py-0.5 text-xs font-mono hover:bg-zinc-800 rounded transition text-zinc-200 cursor-pointer"
          title="Resetuj zoom do 100%"
        >
          {Math.round(zoomScale * 100)}%
        </button>

        <button
          onClick={() => handleZoom(0.15)}
          className="p-1.5 hover:bg-zinc-800 rounded transition cursor-pointer"
          title="Powiększ (+)"
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        <div className="w-[1px] h-4 bg-zinc-700 mx-1" />

        <button
          onClick={handleFitPage}
          className="p-1.5 hover:bg-zinc-800 rounded transition cursor-pointer"
          title="Dopasuj do okna"
        >
          <Maximize className="w-4 h-4" />
        </button>

        <button
          onClick={() => setShowSafetyGuide(!showSafetyGuide)}
          className={`p-1.5 rounded transition cursor-pointer ${
            showSafetyGuide ? 'bg-blue-600/30 text-blue-400' : 'hover:bg-zinc-800 text-zinc-400'
          }`}
          title="Pokaż/Ukryj linie marginesu bezpieczeństwa A5"
        >
          <Eye className="w-4 h-4" />
        </button>
      </div>

      {/* Main Canvas & Page Viewport */}
      {documentInfo ? (
        <div
          className="relative transition-transform duration-75 flex items-center justify-center shadow-canvas rounded"
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
          }}
        >
          {/* Active Canvas Layer */}
          <canvas
            ref={canvasRef}
            className="rounded bg-white shadow-2xl block border border-zinc-700/50"
          />

          {/* Interactive QR Overlay Layer */}
          {isPageTargeted && (
            <InteractiveQRBox
              qrConfig={qrConfig}
              onChange={onChangeQRConfig}
              pageWidthMm={currentPageDim.widthMm}
              pageHeightMm={currentPageDim.heightMm}
              displayScale={zoomScale}
              qrPreviewUrl={qrPreviewUrl}
              showSafetyMargin={showSafetyGuide}
            />
          )}

          {/* Banner if page is NOT in target list */}
          {!isPageTargeted && (
            <div className="absolute top-2 left-2 px-2.5 py-1 bg-zinc-900/90 border border-zinc-700 rounded text-[10px] text-zinc-400 backdrop-blur pointer-events-none">
              Brak kodu QR na tej stronie (nieobjęta zakresem)
            </div>
          )}
        </div>
      ) : (
        <div className="text-center p-8 max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto mb-4 text-blue-400 shadow-xl">
            <Move className="w-8 h-8 opacity-60" />
          </div>
          <h2 className="text-base font-semibold text-zinc-200 mb-1">
            Brak otwartego dokumentu PDF
          </h2>
          <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
            Wgraj wielostronicowy dokument A5 z dysku lub kliknij „Testowy A5” w górnym menu, aby
            natychmiast przetestować wydajność i wstrzykiwanie kodów.
          </p>
        </div>
      )}
    </main>
  );
};
