'use client';

import React, { useRef, useEffect, useState } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize,
  ChevronLeft,
  ChevronRight,
  Eye,
  Move,
  ArrowDownUp,
  QrCode,
} from 'lucide-react';
import { PdfDocumentInfo, QRCodeItem, PageShiftConfig } from '@/types/pdf';
import { renderActivePage, RenderTaskHandle } from '@/lib/pdf-service';
import { InteractiveQRBox } from './InteractiveQRBox';
import { mmToPt, isPageShiftActive } from '@/lib/coordinates';
import { resolvePageContent, resolvePageLabel } from '@/lib/qr-generator';

interface WorkspaceCenterProps {
  documentInfo: PdfDocumentInfo | null;
  pdfDocProxy: import('pdfjs-dist').PDFDocumentProxy | null;
  currentPage: number;
  onPageChange: (page: number) => void;
  qrItems: QRCodeItem[];
  activeQRId: string;
  onSelectQRId: (id: string) => void;
  onChangeActiveQRConfig: (updated: Partial<QRCodeItem>) => void;
  targetPagesPerQR: Map<string, Set<number>>;
  pageShift: PageShiftConfig;
  qrPreviews: Record<string, string>;
  zoomScale: number;
  onZoomChange: (scale: number) => void;
}

export const WorkspaceCenter: React.FC<WorkspaceCenterProps> = ({
  documentInfo,
  pdfDocProxy,
  currentPage,
  onPageChange,
  qrItems,
  activeQRId,
  onSelectQRId,
  onChangeActiveQRConfig,
  targetPagesPerQR,
  pageShift,
  qrPreviews,
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

  const handleResetZoom = () => {
    onZoomChange(1.0);
    setPanOffset({ x: 0, y: 0 });
  };

  // Mouse wheel zoom
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

  // Find all QR items active on the current page
  const activePageQRs = qrItems.filter((item) => {
    const pages = targetPagesPerQR.get(item.id);
    return pages?.has(currentPage);
  });

  const hasAnyQR = activePageQRs.length > 0;
  const isShiftActive = isPageShiftActive(
    pageShift,
    currentPage,
    hasAnyQR,
    documentInfo?.pageCount || 1,
    currentPage
  );

  // Calculate visual shift offsets
  const reservedZonePx = mmToPt(pageShift.offsetMm) * zoomScale;
  const pageWidthPx = mmToPt(currentPageDim.widthMm) * zoomScale;
  const pageHeightPx = mmToPt(currentPageDim.heightMm) * zoomScale;

  let canvasTransform = '';
  if (isShiftActive) {
    const scale = pageShift.scaleContent;
    if (pageShift.zone === 'bottom') {
      const shiftYPx = -reservedZonePx * 0.45;
      canvasTransform = `translateY(${shiftYPx}px) scale(${scale})`;
    } else if (pageShift.zone === 'top') {
      const shiftYPx = reservedZonePx * 0.45;
      canvasTransform = `translateY(${shiftYPx}px) scale(${scale})`;
    } else if (pageShift.zone === 'left') {
      const shiftXPx = reservedZonePx * 0.45;
      canvasTransform = `translateX(${shiftXPx}px) scale(${scale})`;
    } else if (pageShift.zone === 'right') {
      const shiftXPx = -reservedZonePx * 0.45;
      canvasTransform = `translateX(${shiftXPx}px) scale(${scale})`;
    }
  }

  return (
    <main
      ref={containerRef}
      onWheel={handleWheel}
      onMouseDown={handleContainerMouseDown}
      onMouseMove={handleContainerMouseMove}
      onMouseUp={handleContainerMouseUp}
      className="flex-1 h-full workspace-grid relative overflow-hidden flex flex-col items-center justify-center select-none"
    >
      {/* Floating Toolbar */}
      <div className="absolute top-4 z-20 glass-panel rounded-lg shadow-xl px-2 py-1.5 flex items-center gap-1.5 text-zinc-300">
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

        {activePageQRs.length > 0 && (
          <span className="ml-1 px-2 py-0.5 text-[10px] font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded flex items-center gap-1">
            <QrCode className="w-3 h-3" /> {activePageQRs.length} {activePageQRs.length === 1 ? 'kod' : 'kody'} QR na tej stronie
          </span>
        )}

        {isShiftActive && (
          <span className="ml-1 px-2 py-0.5 text-[10px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded flex items-center gap-1">
            <ArrowDownUp className="w-3 h-3" /> Zrobiono miejsce ({pageShift.offsetMm}mm)
          </span>
        )}
      </div>

      {/* Main Canvas & Page Viewport */}
      {documentInfo ? (
        <div
          className="relative transition-transform duration-75 flex items-center justify-center shadow-canvas rounded bg-white overflow-hidden"
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
            width: `${pageWidthPx}px`,
            height: `${pageHeightPx}px`,
          }}
        >
          {/* Active Canvas Layer with optional content shift transform */}
          <canvas
            ref={canvasRef}
            style={{
              transform: canvasTransform,
              transition: 'transform 0.2s ease',
            }}
            className="block"
          />

          {/* Reserved Zone Visual Indicator */}
          {isShiftActive && (
            <div
              className="absolute z-10 pointer-events-none bg-amber-500/10 border border-dashed border-amber-500/60 flex items-center justify-center"
              style={
                pageShift.zone === 'bottom'
                  ? {
                      bottom: 0,
                      left: 0,
                      width: `${pageWidthPx}px`,
                      height: `${reservedZonePx}px`,
                    }
                  : pageShift.zone === 'top'
                  ? {
                      top: 0,
                      left: 0,
                      width: `${pageWidthPx}px`,
                      height: `${reservedZonePx}px`,
                    }
                  : pageShift.zone === 'left'
                  ? {
                      top: 0,
                      left: 0,
                      width: `${reservedZonePx}px`,
                      height: `${pageHeightPx}px`,
                    }
                  : {
                      top: 0,
                      right: 0,
                      width: `${reservedZonePx}px`,
                      height: `${pageHeightPx}px`,
                    }
              }
            >
              <span className="text-[10px] font-medium text-amber-300/80 bg-zinc-900/80 px-2 py-0.5 rounded border border-amber-500/40 font-mono shadow-sm">
                Czysta strefa na kod QR ({pageShift.offsetMm} mm)
              </span>
            </div>
          )}

          {/* Interactive QR Overlay Layer for ALL QRs on this page */}
          {activePageQRs.map((item) => {
            const pageText = resolvePageContent(item, currentPage, documentInfo?.pageCount || 1);
            const pageLabel = resolvePageLabel(item, currentPage, documentInfo?.pageCount || 1);
            return (
              <InteractiveQRBox
                key={item.id}
                qrConfig={{ ...item, content: pageText }}
                isSelected={item.id === activeQRId}
                onSelect={() => onSelectQRId(item.id)}
                onChange={(updated) => {
                  if (item.id === activeQRId) {
                    onChangeActiveQRConfig(updated);
                  } else {
                    onSelectQRId(item.id);
                    onChangeActiveQRConfig(updated);
                  }
                }}
                pageWidthMm={currentPageDim.widthMm}
                pageHeightMm={currentPageDim.heightMm}
                displayScale={zoomScale}
                qrPreviewUrl={qrPreviews[item.id]}
                showSafetyMargin={showSafetyGuide && !isShiftActive}
                label={pageLabel}
              />
            );
          })}

          {/* Banner if page has NO QR assigned */}
          {activePageQRs.length === 0 && (
            <div className="absolute top-2 left-2 px-2.5 py-1 bg-zinc-900/90 border border-zinc-700 rounded text-[10px] text-zinc-400 backdrop-blur pointer-events-none z-30">
              Brak kodu QR na tej stronie
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
