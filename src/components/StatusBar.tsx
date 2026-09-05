'use client';

import React, { useState, useEffect } from 'react';
import { Cpu, HardDrive, FileText, QrCode, Globe } from 'lucide-react';
import { PdfDocumentInfo, QRConfig } from '@/types/pdf';

interface StatusBarProps {
  documentInfo: PdfDocumentInfo | null;
  currentPage: number;
  zoomScale: number;
  qrConfig: QRConfig;
  targetPagesCount: number;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  documentInfo,
  currentPage,
  zoomScale,
  qrConfig,
  targetPagesCount,
}) => {
  const [memoryInfo, setMemoryInfo] = useState<string>('Pamięć: OK');

  useEffect(() => {
    const updateMemory = () => {
      const perf = window.performance as any;
      if (perf && perf.memory) {
        const usedMB = Math.round(perf.memory.usedJSHeapSize / (1024 * 1024));
        const totalMB = Math.round(perf.memory.totalJSHeapSize / (1024 * 1024));
        setMemoryInfo(`Pamięć sterty JS: ${usedMB} MB / ${totalMB} MB`);
      } else {
        setMemoryInfo('Pamięć: Stabilna (LRU Cache)');
      }
    };

    updateMemory();
    const interval = setInterval(updateMemory, 3000);
    return () => clearInterval(interval);
  }, []);

  const pageDim = documentInfo?.pages[currentPage - 1];

  return (
    <footer className="h-7 border-t border-border bg-sidebar px-4 flex items-center justify-between text-[11px] text-zinc-400 select-none shrink-0 z-20">
      {/* Left: Document details & page format */}
      <div className="flex items-center gap-4">
        {documentInfo ? (
          <div className="flex items-center gap-1.5 text-zinc-300">
            <FileText className="w-3.5 h-3.5 text-blue-400" />
            <span>
              Strona <strong className="text-white font-mono">{currentPage}</strong> z{' '}
              <strong className="text-white font-mono">{documentInfo.pageCount}</strong>
            </span>
            {pageDim && (
              <span className="text-zinc-500 font-mono text-[10px]">
                ({pageDim.widthMm} x {pageDim.heightMm} mm | {pageDim.widthPt} x {pageDim.heightPt} pt)
              </span>
            )}
          </div>
        ) : (
          <span className="text-zinc-500">Oczekiwanie na dokument PDF...</span>
        )}

        {targetPagesCount > 0 && (
          <div className="hidden md:flex items-center gap-1 text-emerald-400">
            <QrCode className="w-3 h-3" />
            <span>
              Zaplanowano QR:{' '}
              <strong className="font-mono text-emerald-300">{targetPagesCount}</strong> stron
            </span>
          </div>
        )}
      </div>

      {/* Right: Zoom scale, memory, deployment status */}
      <div className="flex items-center gap-4">
        <div className="text-zinc-400 font-mono">
          Zoom: <span className="text-zinc-200">{Math.round(zoomScale * 100)}%</span>
        </div>

        <div className="hidden sm:flex items-center gap-1 text-zinc-500 font-mono text-[10px]">
          <Cpu className="w-3 h-3 text-blue-400/80" />
          <span>{memoryInfo}</span>
        </div>

        <div className="flex items-center gap-1 text-zinc-400 text-[10px] bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800">
          <Globe className="w-2.5 h-2.5 text-emerald-400" />
          <span>Cloudflare Pages</span>
        </div>
      </div>
    </footer>
  );
};
