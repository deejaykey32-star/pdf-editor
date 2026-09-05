'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, QrCode, ArrowRight, ArrowLeft, Layers } from 'lucide-react';
import { PdfDocumentInfo } from '@/types/pdf';
import { renderPageThumbnail } from '@/lib/pdf-service';

interface SidebarLeftProps {
  documentInfo: PdfDocumentInfo | null;
  pdfDocProxy: import('pdfjs-dist').PDFDocumentProxy | null;
  currentPage: number;
  onSelectPage: (page: number) => void;
  targetPages: Set<number>;
}

const ITEM_HEIGHT = 175; // height of each thumbnail card in pixels

export const SidebarLeft: React.FC<SidebarLeftProps> = ({
  documentInfo,
  pdfDocProxy,
  currentPage,
  onSelectPage,
  targetPages,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(600);
  const [jumpPageInput, setJumpPageInput] = useState('');
  const [renderedThumbnails, setRenderedThumbnails] = useState<Record<number, string>>({});

  const totalPages = documentInfo?.pageCount || 0;

  // Track container height
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        setContainerHeight(containerRef.current.clientHeight);
      }
    };
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // Calculate virtual window slice
  const visibleCount = Math.ceil(containerHeight / ITEM_HEIGHT) + 4;
  const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - 2);
  const endIndex = Math.min(totalPages - 1, startIndex + visibleCount);

  const topPadding = startIndex * ITEM_HEIGHT;
  const bottomPadding = Math.max(0, (totalPages - 1 - endIndex) * ITEM_HEIGHT);

  // Lazy render thumbnails for visible items
  useEffect(() => {
    if (!pdfDocProxy || !documentInfo || totalPages === 0) return;

    let isMounted = true;

    for (let p = startIndex + 1; p <= endIndex + 1; p++) {
      if (!renderedThumbnails[p]) {
        renderPageThumbnail(pdfDocProxy, documentInfo.name, p, 0.22).then((thumbUrl) => {
          if (isMounted && thumbUrl) {
            setRenderedThumbnails((prev) => ({ ...prev, [p]: thumbUrl }));
          }
        });
      }
    }

    return () => {
      isMounted = false;
    };
  }, [pdfDocProxy, documentInfo, startIndex, endIndex, totalPages, renderedThumbnails]);

  // Jump to specific page
  const handleJump = (e?: React.FormEvent) => {
    e?.preventDefault();
    const page = parseInt(jumpPageInput, 10);
    if (!isNaN(page) && page >= 1 && page <= totalPages) {
      onSelectPage(page);
      if (containerRef.current) {
        containerRef.current.scrollTop = (page - 1) * ITEM_HEIGHT;
      }
    }
  };

  // Jump to next/prev page with QR
  const jumpToQR = (direction: 'next' | 'prev') => {
    const sorted = Array.from(targetPages).sort((a, b) => a - b);
    if (sorted.length === 0) return;

    let target: number | undefined;
    if (direction === 'next') {
      target = sorted.find((p) => p > currentPage) || sorted[0];
    } else {
      target = [...sorted].reverse().find((p) => p < currentPage) || sorted[sorted.length - 1];
    }

    if (target) {
      onSelectPage(target);
      if (containerRef.current) {
        containerRef.current.scrollTop = (target - 1) * ITEM_HEIGHT;
      }
    }
  };

  // Scroll active page into view when selected externally
  useEffect(() => {
    if (containerRef.current && currentPage > 0) {
      const targetTop = (currentPage - 1) * ITEM_HEIGHT;
      const currentScroll = containerRef.current.scrollTop;
      if (targetTop < currentScroll || targetTop > currentScroll + containerHeight - ITEM_HEIGHT) {
        containerRef.current.scrollTop = targetTop - containerHeight / 2 + ITEM_HEIGHT / 2;
      }
    }
  }, [currentPage, containerHeight]);

  return (
    <aside className="w-64 border-r border-border bg-sidebar flex flex-col h-full shrink-0 select-none">
      {/* Header & Quick Jump Bar */}
      <div className="p-3 border-b border-border space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
            <Layers className="w-3.5 h-3.5 text-blue-400" />
            <span>Miniatury stron</span>
          </div>
          <span className="text-[11px] font-mono text-zinc-400 bg-zinc-800 px-1.5 py-0.5 rounded">
            {totalPages} stron
          </span>
        </div>

        {/* Quick Page Jump Input */}
        <form onSubmit={handleJump} className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <input
              type="number"
              min={1}
              max={totalPages || 1}
              value={jumpPageInput}
              onChange={(e) => setJumpPageInput(e.target.value)}
              placeholder={`Strona (1-${totalPages || 1})`}
              className="w-full bg-zinc-900 border border-zinc-700/80 rounded px-2 py-1 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>
          <button
            type="submit"
            disabled={!totalPages}
            className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-200 text-xs rounded border border-zinc-700 font-medium transition cursor-pointer"
          >
            Skocz
          </button>
        </form>

        {/* QR Navigation Shortcuts */}
        {targetPages.size > 0 && (
          <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-1 border-t border-zinc-800/60">
            <span className="flex items-center gap-1 text-emerald-400 font-medium">
              <QrCode className="w-3 h-3" /> {targetPages.size} z kodem QR
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => jumpToQR('prev')}
                className="p-1 hover:bg-zinc-800 rounded text-zinc-300 transition"
                title="Poprzednia strona z QR"
              >
                <ArrowLeft className="w-3 h-3" />
              </button>
              <button
                onClick={() => jumpToQR('next')}
                className="p-1 hover:bg-zinc-800 rounded text-zinc-300 transition"
                title="Następna strona z QR"
              >
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Virtualized Scrollable Thumbnails List */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 py-2 space-y-2 relative"
      >
        {totalPages === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-4 text-zinc-500 text-xs">
            <Layers className="w-8 h-8 mb-2 opacity-20" />
            <p>Brak wczytanego dokumentu.</p>
            <p className="text-[10px] mt-1 text-zinc-600">Wgraj PDF lub wygeneruj testowy A5.</p>
          </div>
        ) : (
          <div style={{ paddingTop: `${topPadding}px`, paddingBottom: `${bottomPadding}px` }}>
            {Array.from({ length: Math.max(0, endIndex - startIndex + 1) }, (_, i) => {
              const pageNum = startIndex + i + 1;
              const isActive = pageNum === currentPage;
              const hasQR = targetPages.has(pageNum);
              const thumbUrl = renderedThumbnails[pageNum];

              return (
                <div
                  key={pageNum}
                  style={{ height: `${ITEM_HEIGHT - 8}px` }}
                  onClick={() => onSelectPage(pageNum)}
                  className={`relative mb-2 rounded-lg border cursor-pointer transition-all flex flex-col p-2 select-none group ${
                    isActive
                      ? 'bg-blue-950/30 border-blue-500 shadow-md shadow-blue-500/10 ring-1 ring-blue-500/30'
                      : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900'
                  }`}
                >
                  {/* Card Header: Page Number & QR Badge */}
                  <div className="flex items-center justify-between mb-1.5">
                    <span
                      className={`text-[11px] font-mono font-medium ${
                        isActive ? 'text-blue-400 font-bold' : 'text-zinc-400'
                      }`}
                    >
                      Strona {pageNum}
                    </span>
                    {hasQR && (
                      <span className="px-1.5 py-0.2 text-[9px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded flex items-center gap-0.5">
                        <QrCode className="w-2.5 h-2.5" /> QR
                      </span>
                    )}
                  </div>

                  {/* Thumbnail Preview Box */}
                  <div className="flex-1 bg-zinc-950 rounded border border-zinc-800/80 overflow-hidden flex items-center justify-center relative">
                    {thumbUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={thumbUrl}
                        alt={`Miniatura strony ${pageNum}`}
                        className="max-h-full max-w-full object-contain pointer-events-none shadow-sm"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-zinc-600 text-[10px]">
                        <span className="animate-pulse">Ładowanie...</span>
                      </div>
                    )}

                    {/* QR indicator on preview */}
                    {hasQR && (
                      <div className="absolute bottom-1 right-1 w-3.5 h-3.5 rounded-sm bg-emerald-500/80 flex items-center justify-center text-[7px] text-black font-bold shadow">
                        QR
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
};
