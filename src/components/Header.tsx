'use client';

import React, { useRef } from 'react';
import {
  FileUp,
  Download,
  FileText,
  Sparkles,
  Layers,
  CheckCircle2,
} from 'lucide-react';
import { PdfDocumentInfo } from '@/types/pdf';

interface HeaderProps {
  documentInfo: PdfDocumentInfo | null;
  onFileUpload: (file: File) => void;
  onGenerateSample: (count: number) => void;
  onExportClick: () => void;
  isProcessing: boolean;
  targetPagesCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  documentInfo,
  onFileUpload,
  onGenerateSample,
  onExportClick,
  isProcessing,
  targetPagesCount,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      onFileUpload(file);
    }
  };

  return (
    <header className="h-14 border-b border-border bg-sidebar px-4 flex items-center justify-between select-none z-30 shrink-0">
      {/* Brand & Project Info */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold shadow-md shadow-blue-600/20">
          <Layers className="w-4 h-4" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm tracking-tight text-white">
              PDF QR Studio
            </span>
            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded">
              A5 Lossless
            </span>
            <span className="px-1.5 py-0.5 text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded hidden sm:inline-flex items-center gap-1">
              <CheckCircle2 className="w-2.5 h-2.5" /> 100% Client-Side
            </span>
          </div>
          {documentInfo && (
            <p className="text-[11px] text-zinc-400 truncate max-w-[280px]">
              {documentInfo.name} ({documentInfo.pageCount} stron)
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Upload Button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-3 py-1.5 text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-md border border-zinc-700 transition flex items-center gap-1.5 cursor-pointer"
          title="Wczytaj plik PDF z dysku"
        >
          <FileUp className="w-3.5 h-3.5 text-zinc-400" />
          <span>Wczytaj PDF</span>
        </button>

        {/* Sample Generator Dropdown */}
        <div className="relative group">
          <button
            className="px-2.5 py-1.5 text-xs font-medium bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-md border border-zinc-700 transition flex items-center gap-1.5 cursor-pointer"
            title="Wygeneruj dokument A5 do testów"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden md:inline">Testowy A5</span>
          </button>
          <div className="absolute right-0 top-full mt-1 w-44 bg-zinc-900 border border-zinc-700 rounded-md shadow-xl py-1 hidden group-hover:block z-50">
            <div className="px-3 py-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
              Generuj dokument A5:
            </div>
            <button
              onClick={() => onGenerateSample(20)}
              className="w-full text-left px-3 py-1.5 text-xs text-zinc-200 hover:bg-blue-600 hover:text-white transition flex items-center justify-between"
            >
              <span>20 stron (Szybki)</span>
              <span className="text-[10px] opacity-60">~0.2 s</span>
            </button>
            <button
              onClick={() => onGenerateSample(100)}
              className="w-full text-left px-3 py-1.5 text-xs text-zinc-200 hover:bg-blue-600 hover:text-white transition flex items-center justify-between"
            >
              <span>100 stron</span>
              <span className="text-[10px] opacity-60">~0.8 s</span>
            </button>
            <button
              onClick={() => onGenerateSample(500)}
              className="w-full text-left px-3 py-1.5 text-xs text-zinc-200 hover:bg-blue-600 hover:text-white transition flex items-center justify-between"
            >
              <span>500 stron</span>
              <span className="text-[10px] opacity-60">~3 s</span>
            </button>
            <button
              onClick={() => onGenerateSample(1500)}
              className="w-full text-left px-3 py-1.5 text-xs text-amber-300 hover:bg-blue-600 hover:text-white transition flex items-center justify-between font-medium"
            >
              <span>1500 stron (Pełny)</span>
              <span className="text-[10px] opacity-60">~8 s</span>
            </button>
          </div>
        </div>

        {/* Export / Download Button */}
        <button
          onClick={onExportClick}
          disabled={!documentInfo || isProcessing || targetPagesCount === 0}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-md shadow-sm transition flex items-center gap-1.5 ${
            !documentInfo || isProcessing || targetPagesCount === 0
              ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700/50'
              : 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer shadow-blue-600/20 hover:shadow-blue-600/40'
          }`}
        >
          <Download className="w-3.5 h-3.5" />
          <span>Eksportuj PDF ({targetPagesCount})</span>
        </button>
      </div>
    </header>
  );
};
