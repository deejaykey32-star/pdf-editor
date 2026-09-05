'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  PdfDocumentInfo,
  QRConfig,
  BatchScopeConfig,
  ProcessingProgress,
  AlignmentPreset,
} from '@/types/pdf';
import { Header } from '@/components/Header';
import { SidebarLeft } from '@/components/SidebarLeft';
import { WorkspaceCenter } from '@/components/WorkspaceCenter';
import { SidebarRight } from '@/components/SidebarRight';
import { StatusBar } from '@/components/StatusBar';
import { ProgressModal } from '@/components/ProgressModal';
import { parsePdfDocument, getPdfjs } from '@/lib/pdf-service';
import { generateSyntheticA5Pdf } from '@/lib/sample-pdf';
import { generateQRDataUrl } from '@/lib/qr-generator';
import {
  parsePageRange,
  getPresetPosition,
  clampQRPosition,
} from '@/lib/coordinates';
import { applyQRCodesLossless } from '@/lib/pdf-manipulator';

const DEFAULT_QR_CONFIG: QRConfig = {
  content: 'https://example.com/verify?doc=A5&page={page}&total={total}',
  sizeMm: 25,
  xMm: 118, // bottom-right for A5 (148 - 25 - 5)
  yMm: 180, // bottom-right for A5 (210 - 25 - 5)
  errorCorrection: 'M',
  marginModules: 1,
  colorDark: '#000000',
  colorLight: '#ffffff',
  safetyMarginMm: 5,
};

export default function Home() {
  const [documentInfo, setDocumentInfo] = useState<PdfDocumentInfo | null>(null);
  const [pdfDocProxy, setPdfDocProxy] = useState<any | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [zoomScale, setZoomScale] = useState<number>(1.15);
  const [qrConfig, setQrConfig] = useState<QRConfig>(DEFAULT_QR_CONFIG);
  const [batchScope, setBatchScope] = useState<BatchScopeConfig>({
    mode: 'all',
    rangeString: '1-100',
  });
  const [qrPreviewUrl, setQrPreviewUrl] = useState<string>('');
  const [progress, setProgress] = useState<ProcessingProgress>({
    currentPage: 0,
    totalPages: 0,
    percent: 0,
    speedPagesPerSec: 0,
    etaSeconds: 0,
    status: 'idle',
  });
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modifiedPdfBlobUrl, setModifiedPdfBlobUrl] = useState<string | null>(null);

  // Generate live preview of the QR code
  useEffect(() => {
    let isCurrent = true;
    generateQRDataUrl(qrConfig.content || 'https://example.com', qrConfig, 256)
      .then((url) => {
        if (isCurrent) setQrPreviewUrl(url);
      })
      .catch((err) => console.error('Error generating QR preview:', err));

    return () => {
      isCurrent = false;
    };
  }, [qrConfig.content, qrConfig.errorCorrection, qrConfig.marginModules, qrConfig.colorDark, qrConfig.colorLight]);

  // Compute set of targeted page numbers
  const targetPages = useMemo(() => {
    if (!documentInfo) return new Set<number>();
    const pages = parsePageRange(
      batchScope.mode,
      batchScope.rangeString,
      currentPage,
      documentInfo.pageCount
    );
    return new Set(pages);
  }, [batchScope, currentPage, documentInfo]);

  // Load PDF file handler
  const handleFileUpload = useCallback(async (file: File) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const parsedInfo = await parsePdfDocument(file, arrayBuffer);
      const pdfjs = await getPdfjs();
      const loadingTask = pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) });
      const proxy = await loadingTask.promise;

      setDocumentInfo(parsedInfo);
      setPdfDocProxy(proxy);
      setCurrentPage(1);
    } catch (err) {
      console.error('Błąd podczas wczytywania pliku PDF:', err);
      alert('Nie udało się wczytać pliku PDF. Sprawdź, czy plik nie jest uszkodzony lub zabezpieczony hasłem.');
    }
  }, []);

  // Generate synthetic sample A5 PDF
  const handleGenerateSample = useCallback(async (count: number) => {
    try {
      const pdfBytes = await generateSyntheticA5Pdf(count);
      const file = new File([pdfBytes.buffer as ArrayBuffer], `Syntetyczny_Katalog_A5_${count}stron.pdf`, {
        type: 'application/pdf',
      });
      await handleFileUpload(file);
    } catch (err) {
      console.error('Błąd generowania dokumentu testowego:', err);
    }
  }, [handleFileUpload]);

  // Load a quick default 20-page sample on initial launch if empty
  useEffect(() => {
    handleGenerateSample(20);
  }, [handleGenerateSample]);

  // Update QR Config
  const handleChangeQRConfig = (updated: Partial<QRConfig>) => {
    setQrConfig((prev) => ({ ...prev, ...updated }));
  };

  // Update Batch Scope
  const handleChangeBatchScope = (updated: Partial<BatchScopeConfig>) => {
    setBatchScope((prev) => ({ ...prev, ...updated }));
  };

  // Quick Preset Alignment
  const handleApplyPreset = (preset: AlignmentPreset) => {
    const pageDim = documentInfo?.pages[currentPage - 1] || {
      widthMm: 148,
      heightMm: 210,
    };
    const newPos = getPresetPosition(
      preset,
      pageDim.widthMm,
      pageDim.heightMm,
      qrConfig.sizeMm,
      qrConfig.safetyMarginMm
    );
    handleChangeQRConfig(newPos);
  };

  // Start Batch Lossless Export
  const handleExportClick = async () => {
    if (!documentInfo || targetPages.size === 0) return;

    setIsModalOpen(true);
    setProgress({
      currentPage: 0,
      totalPages: targetPages.size,
      percent: 0,
      speedPagesPerSec: 0,
      etaSeconds: 0,
      status: 'processing',
    });

    try {
      const targetArray = Array.from(targetPages);
      const modifiedBytes = await applyQRCodesLossless({
        originalBytes: documentInfo.data,
        targetPages: targetArray,
        totalPages: documentInfo.pageCount,
        qrConfig,
        onProgress: (p) => setProgress(p),
      });

      const blob = new Blob([modifiedBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const blobUrl = URL.createObjectURL(blob);
      setModifiedPdfBlobUrl(blobUrl);

      setProgress((prev) => ({
        ...prev,
        status: 'completed',
        percent: 100,
      }));
    } catch (err: any) {
      console.error('Export error:', err);
      setProgress((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: err?.message || 'Błąd podczas przetwarzania dokumentu.',
      }));
    }
  };

  // Download Action
  const handleDownload = () => {
    if (!modifiedPdfBlobUrl) return;
    const a = document.createElement('a');
    a.href = modifiedPdfBlobUrl;
    const baseName = documentInfo?.name.replace(/\.pdf$/i, '') || 'dokument';
    a.download = `${baseName}_z_kodami_QR.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const currentPageDim = documentInfo?.pages[currentPage - 1] || {
    widthMm: 148,
    heightMm: 210,
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-background">
      {/* 1. Top Navigation Bar */}
      <Header
        documentInfo={documentInfo}
        onFileUpload={handleFileUpload}
        onGenerateSample={handleGenerateSample}
        onExportClick={handleExportClick}
        isProcessing={progress.status === 'processing'}
        targetPagesCount={targetPages.size}
      />

      {/* 2. Main 3-Panel Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Virtualized Page Thumbnails */}
        <SidebarLeft
          documentInfo={documentInfo}
          pdfDocProxy={pdfDocProxy}
          currentPage={currentPage}
          onSelectPage={(page) => setCurrentPage(page)}
          targetPages={targetPages}
        />

        {/* Center: Canvas Workspace & Interactive QR Placement */}
        <WorkspaceCenter
          documentInfo={documentInfo}
          pdfDocProxy={pdfDocProxy}
          currentPage={currentPage}
          onPageChange={(page) => setCurrentPage(page)}
          qrConfig={qrConfig}
          onChangeQRConfig={handleChangeQRConfig}
          targetPages={targetPages}
          qrPreviewUrl={qrPreviewUrl}
          zoomScale={zoomScale}
          onZoomChange={setZoomScale}
        />

        {/* Right: QR Code Configurator & Presets */}
        <SidebarRight
          qrConfig={qrConfig}
          onChangeQRConfig={handleChangeQRConfig}
          batchScope={batchScope}
          onChangeBatchScope={handleChangeBatchScope}
          pageWidthMm={currentPageDim.widthMm}
          pageHeightMm={currentPageDim.heightMm}
          currentPage={currentPage}
          totalPages={documentInfo?.pageCount || 0}
          targetPagesCount={targetPages.size}
          onApplyPreset={handleApplyPreset}
          onExportClick={handleExportClick}
          isProcessing={progress.status === 'processing'}
          qrPreviewUrl={qrPreviewUrl}
        />
      </div>

      {/* 3. Bottom Status Bar */}
      <StatusBar
        documentInfo={documentInfo}
        currentPage={currentPage}
        zoomScale={zoomScale}
        qrConfig={qrConfig}
        targetPagesCount={targetPages.size}
      />

      {/* 4. Asynchronous Batch Progress Modal */}
      <ProgressModal
        isOpen={isModalOpen}
        progress={progress}
        onClose={() => setIsModalOpen(false)}
        onDownload={handleDownload}
        fileName={documentInfo?.name || 'Dokument A5'}
      />
    </div>
  );
}
