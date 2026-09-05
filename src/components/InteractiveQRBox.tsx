'use client';

import React, { useState, useRef, useEffect } from 'react';
import { QRConfig } from '@/types/pdf';
import { mmToPt, ptToMm, clampQRPosition, clamp } from '@/lib/coordinates';

interface InteractiveQRBoxProps {
  qrConfig: QRConfig;
  onChange: (updated: Partial<QRConfig>) => void;
  pageWidthMm: number;
  pageHeightMm: number;
  displayScale: number; // current zoom scale
  qrPreviewUrl?: string;
  showSafetyMargin?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
  label?: string;
}

export const InteractiveQRBox: React.FC<InteractiveQRBoxProps> = ({
  qrConfig,
  onChange,
  pageWidthMm,
  pageHeightMm,
  displayScale,
  qrPreviewUrl,
  showSafetyMargin = true,
  isSelected = true,
  onSelect,
  label,
}) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; startXMm: number; startYMm: number }>({
    mouseX: 0,
    mouseY: 0,
    startXMm: 0,
    startYMm: 0,
  });
  const resizeStartRef = useRef<{ mouseX: number; mouseY: number; startSizeMm: number }>({
    mouseX: 0,
    mouseY: 0,
    startSizeMm: 0,
  });

  // Convert mm to screen pixels at current zoom
  const leftPx = mmToPt(qrConfig.xMm) * displayScale;
  const topPx = mmToPt(qrConfig.yMm) * displayScale;
  const sizePx = mmToPt(qrConfig.sizeMm) * displayScale;

  // Margin safety boundary
  const marginPx = mmToPt(qrConfig.safetyMarginMm) * displayScale;
  const pageWidthPx = mmToPt(pageWidthMm) * displayScale;
  const pageHeightPx = mmToPt(pageHeightMm) * displayScale;

  // Mouse Drag Handler
  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect?.();

    if (!isSelected) return;

    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startXMm: qrConfig.xMm,
      startYMm: qrConfig.yMm,
    };
  };

  // Mouse Resize Handler
  const handleResizeDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    resizeStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startSizeMm: qrConfig.sizeMm,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const deltaXPx = e.clientX - dragStartRef.current.mouseX;
        const deltaYPx = e.clientY - dragStartRef.current.mouseY;

        const deltaXMm = ptToMm(deltaXPx / displayScale);
        const deltaYMm = ptToMm(deltaYPx / displayScale);

        const newXMm = dragStartRef.current.startXMm + deltaXMm;
        const newYMm = dragStartRef.current.startYMm + deltaYMm;

        const clamped = clampQRPosition(
          newXMm,
          newYMm,
          qrConfig.sizeMm,
          pageWidthMm,
          pageHeightMm,
          qrConfig.safetyMarginMm
        );

        onChange(clamped);
      } else if (isResizing) {
        const deltaXPx = e.clientX - resizeStartRef.current.mouseX;
        const deltaYPx = e.clientY - resizeStartRef.current.mouseY;
        const deltaPx = Math.max(deltaXPx, deltaYPx);
        const deltaMm = ptToMm(deltaPx / displayScale);

        const newSizeMm = Math.round(
          clamp(
            resizeStartRef.current.startSizeMm + deltaMm,
            12,
            Math.min(pageWidthMm - qrConfig.xMm - qrConfig.safetyMarginMm, 80)
          )
        );

        const clampedPos = clampQRPosition(
          qrConfig.xMm,
          qrConfig.yMm,
          newSizeMm,
          pageWidthMm,
          pageHeightMm,
          qrConfig.safetyMarginMm
        );

        onChange({
          sizeMm: newSizeMm,
          ...clampedPos,
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, qrConfig, pageWidthMm, pageHeightMm, displayScale, onChange]);

  return (
    <>
      {/* Visual Safety Margin Outline */}
      {showSafetyMargin && isSelected && (
        <div
          className="absolute pointer-events-none border border-dashed border-red-500/30 z-10"
          style={{
            left: `${marginPx}px`,
            top: `${marginPx}px`,
            width: `${pageWidthPx - marginPx * 2}px`,
            height: `${pageHeightPx - marginPx * 2}px`,
          }}
          title={`Bezpieczny margines introligatorski (${qrConfig.safetyMarginMm} mm)`}
        >
          <span className="absolute top-1 left-1 text-[9px] font-mono text-red-400/40">
            Margines {qrConfig.safetyMarginMm} mm
          </span>
        </div>
      )}

      {/* Interactive QR Box */}
      <div
        ref={boxRef}
        onMouseDown={handleMouseDown}
        style={{
          left: `${leftPx}px`,
          top: `${topPx}px`,
          width: `${sizePx}px`,
          height: `${sizePx}px`,
        }}
        className={`absolute z-20 group cursor-move select-none rounded transition-all ${
          isSelected
            ? isDragging || isResizing
              ? 'border-2 border-blue-400 shadow-xl shadow-blue-500/40 ring-2 ring-blue-500/30'
              : 'border-2 border-blue-500 shadow-md ring-1 ring-blue-400/40'
            : 'border-2 border-dashed border-zinc-400/70 hover:border-blue-400/80 opacity-85 hover:opacity-100'
        } bg-white/95 p-1 flex items-center justify-center`}
      >
        {/* QR Code Image Preview */}
        {qrPreviewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qrPreviewUrl}
            alt="Podgląd kodu QR"
            className="w-full h-full object-contain pointer-events-none"
            draggable={false}
          />
        ) : (
          <div className="w-full h-full bg-zinc-100 flex items-center justify-center text-zinc-400 text-[10px]">
            QR
          </div>
        )}

        {/* Live Coordinate & Label Tooltip */}
        <div
          className={`absolute -top-7 left-0 px-2 py-0.5 rounded text-[10px] font-mono font-medium tracking-tight whitespace-nowrap bg-zinc-900 text-zinc-200 border border-zinc-700 shadow-md transition-opacity pointer-events-none flex items-center gap-1.5 ${
            isSelected || isDragging || isResizing ? 'opacity-100 z-30' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          {label && <strong className="text-blue-400 font-sans">{label}:</strong>}
          <span>X: {qrConfig.xMm}mm</span>
          <span className="text-zinc-500">|</span>
          <span>Y: {qrConfig.yMm}mm</span>
          <span className="text-zinc-500">|</span>
          <span>{qrConfig.sizeMm}mm</span>
        </div>

        {/* Bottom-Right Resize Handle (Only when selected) */}
        {isSelected && (
          <div
            onMouseDown={handleResizeDown}
            className="absolute -bottom-1.5 -right-1.5 w-3.5 h-3.5 bg-blue-500 border-2 border-white rounded-sm cursor-nwse-resize shadow-md hover:scale-125 transition-transform"
            title="Zmień rozmiar (proporcja 1:1)"
          />
        )}

        {/* Label Badge on box */}
        {label && (
          <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 px-1.5 py-0.2 rounded bg-zinc-900/90 text-[9px] text-zinc-300 border border-zinc-700 pointer-events-none whitespace-nowrap">
            {label}
          </div>
        )}

        {/* Center crosshair */}
        <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-20 flex items-center justify-center">
          <div className="w-2 h-0.5 bg-blue-600" />
          <div className="h-2 w-0.5 bg-blue-600 absolute" />
        </div>
      </div>
    </>
  );
};
