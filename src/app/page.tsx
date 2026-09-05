'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  PdfDocumentInfo,
  QRCodeItem,
  ProcessingProgress,
  AlignmentPreset,
  PageShiftConfig,
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
} from '@/lib/coordinates';
import { applyQRCodesLossless, insertDedicatedQRPage } from '@/lib/pdf-manipulator';

const INITIAL_QR_ITEMS: QRCodeItem[] = [
  {
    id: 'qr-1',
    label: 'Główny Kod QR',
    content: 'https://example.com/verify?doc=A5&page={page}&total={total}',
    sizeMm: 25,
    xMm: 118, // bottom-right for A5 (148 - 25 - 5)
    yMm: 180, // bottom-right for A5 (210 - 25 - 5)
    errorCorrection: 'M',
    marginModules: 1,
    colorDark: '#000000',
    colorLight: '#ffffff',
    safetyMarginMm: 5,
    scope: {
      mode: 'all',
      rangeString: '1-100',
    },
    enableLink: true,
    showLabel: true,
    labelPosition: 'bottom',
  },
];

const DEFAULT_PAGE_SHIFT: PageShiftConfig = {
  enabled: false,
  zone: 'bottom',
  offsetMm: 32,
  scaleContent: 0.90,
  autoPositionQR: true,
};

export default function Home() {
  const [documentInfo, setDocumentInfo] = useState<PdfDocumentInfo | null>(null);
  const [pdfDocProxy, setPdfDocProxy] = useState<any | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [zoomScale, setZoomScale] = useState<number>(1.15);
  const [qrItems, setQrItems] = useState<QRCodeItem[]>(INITIAL_QR_ITEMS);
  const [activeQRId, setActiveQRId] = useState<string>('qr-1');
  const [pageShift, setPageShift] = useState<PageShiftConfig>(DEFAULT_PAGE_SHIFT);
  const [qrPreviews, setQrPreviews] = useState<Record<string, string>>({});
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

  const currentPageDim = documentInfo?.pages[currentPage - 1] || {
    widthMm: 148,
    heightMm: 210,
    widthPt: 419.53,
    heightPt: 595.28,
    rotation: 0,
  };

  const activeQR = qrItems.find((q) => q.id === activeQRId) || qrItems[0];

  // Generate previews for each QR code
  useEffect(() => {
    let isCurrent = true;

    qrItems.forEach((item) => {
      generateQRDataUrl(item.content || 'https://example.com', item, 256)
        .then((url) => {
          if (isCurrent) {
            setQrPreviews((prev) => ({ ...prev, [item.id]: url }));
          }
        })
        .catch((err) => console.error(`Error generating QR preview for ${item.id}:`, err));
    });

    return () => {
      isCurrent = false;
    };
  }, [qrItems]);

  // Compute map of target pages for each QR item
  const targetPagesPerQR = useMemo(() => {
    const map = new Map<string, Set<number>>();
    const totalPages = documentInfo?.pageCount || 0;

    qrItems.forEach((item) => {
      const pages = parsePageRange(
        item.scope.mode,
        item.scope.rangeString,
        currentPage,
        totalPages
      );
      map.set(item.id, new Set(pages));
    });

    return map;
  }, [qrItems, currentPage, documentInfo]);

  // Compute map of page -> count of QR codes
  const pageQRCountMap = useMemo(() => {
    const countMap = new Map<number, number>();
    const totalPages = documentInfo?.pageCount || 0;

    for (let p = 1; p <= totalPages; p++) {
      let count = 0;
      targetPagesPerQR.forEach((pageSet) => {
        if (pageSet.has(p)) count++;
      });
      if (count > 0) {
        countMap.set(p, count);
      }
    }

    return countMap;
  }, [targetPagesPerQR, documentInfo]);

  // Total distinct pages with at least one QR code
  const totalTargetedPages = pageQRCountMap.size;

  // Add a new QR item
  const handleAddQR = () => {
    const newIdx = qrItems.length + 1;
    const newId = `qr-${Date.now()}`;
    const newQR: QRCodeItem = {
      id: newId,
      label: `Kod ${newIdx}`,
      content: `https://example.com/item-${newIdx}?page={page}`,
      sizeMm: 22,
      xMm: 15,
      yMm: 180,
      errorCorrection: 'M',
      marginModules: 1,
      colorDark: '#000000',
      colorLight: '#ffffff',
      safetyMarginMm: 5,
      scope: {
        mode: 'current',
        rangeString: '',
      },
      enableLink: true,
      showLabel: true,
      labelPosition: 'bottom',
    };

    setQrItems((prev) => [...prev, newQR]);
    setActiveQRId(newId);
  };

  // Duplicate an existing QR item
  const handleDuplicateQR = (id: string) => {
    const source = qrItems.find((q) => q.id === id);
    if (!source) return;

    const newId = `qr-${Date.now()}`;
    const duplicated: QRCodeItem = {
      ...source,
      id: newId,
      label: `${source.label} (Kopia)`,
      xMm: Math.max(5, source.xMm - 10),
      yMm: Math.max(5, source.yMm - 10),
    };

    setQrItems((prev) => [...prev, duplicated]);
    setActiveQRId(newId);
  };

  // Remove a QR item
  const handleRemoveQR = (id: string) => {
    if (qrItems.length <= 1) return;
    const nextList = qrItems.filter((q) => q.id !== id);
    setQrItems(nextList);
    if (activeQRId === id) {
      setActiveQRId(nextList[0].id);
    }
  };

  // Update active QR item
  const handleChangeActiveQRConfig = (updated: Partial<QRCodeItem>) => {
    setQrItems((prev) =>
      prev.map((item) => (item.id === activeQRId ? { ...item, ...updated } : item))
    );
  };

  // Quick Preset Alignment for active QR
  const handleApplyPreset = (preset: AlignmentPreset) => {
    const pageDim = currentPageDim;
    const newPos = getPresetPosition(
      preset,
      pageDim.widthMm,
      pageDim.heightMm,
      activeQR.sizeMm,
      activeQR.safetyMarginMm
    );
    handleChangeActiveQRConfig(newPos);
  };

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

  // Insert Dedicated QR Cover Page (+1 page shift)
  const handleInsertDedicatedPage = async () => {
    if (!documentInfo) return;
    try {
      const modifiedBytes = await insertDedicatedQRPage({
        originalBytes: documentInfo.data,
        insertAtPage: currentPage,
        qrConfig: activeQR,
        title: 'Karta Identyfikacyjna i Kody QR',
        subtitle: `Dokument A5: ${documentInfo.name}`,
      });

      const file = new File([modifiedBytes.buffer as ArrayBuffer], documentInfo.name, {
        type: 'application/pdf',
      });
      await handleFileUpload(file);
    } catch (err) {
      console.error('Błąd wstawiania strony dedykowanej:', err);
      alert('Nie udało się wstawić nowej strony.');
    }
  };

  // Start Batch Lossless Export with ALL defined QR codes
  const handleExportClick = async () => {
    if (!documentInfo || totalTargetedPages === 0) return;

    setIsModalOpen(true);
    setProgress({
      currentPage: 0,
      totalPages: documentInfo.pageCount,
      percent: 0,
      speedPagesPerSec: 0,
      etaSeconds: 0,
      status: 'processing',
    });

    try {
      const modifiedBytes = await applyQRCodesLossless({
        originalBytes: documentInfo.data,
        qrItems,
        totalPages: documentInfo.pageCount,
        pageShift,
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

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-background">
      {/* 1. Top Navigation Bar */}
      <Header
        documentInfo={documentInfo}
        onFileUpload={handleFileUpload}
        onGenerateSample={handleGenerateSample}
        onExportClick={handleExportClick}
        isProcessing={progress.status === 'processing'}
        targetPagesCount={totalTargetedPages}
      />

      {/* 2. Main 3-Panel Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Virtualized Page Thumbnails */}
        <SidebarLeft
          documentInfo={documentInfo}
          pdfDocProxy={pdfDocProxy}
          currentPage={currentPage}
          onSelectPage={(page) => setCurrentPage(page)}
          pageQRCountMap={pageQRCountMap}
        />

        {/* Center: Canvas Workspace & Multi-QR Overlay */}
        <WorkspaceCenter
          documentInfo={documentInfo}
          pdfDocProxy={pdfDocProxy}
          currentPage={currentPage}
          onPageChange={(page) => setCurrentPage(page)}
          qrItems={qrItems}
          activeQRId={activeQRId}
          onSelectQRId={(id) => setActiveQRId(id)}
          onChangeActiveQRConfig={handleChangeActiveQRConfig}
          targetPagesPerQR={targetPagesPerQR}
          pageShift={pageShift}
          qrPreviews={qrPreviews}
          zoomScale={zoomScale}
          onZoomChange={setZoomScale}
        />

        {/* Right: Multi-QR Code Configurator & Presets */}
        <SidebarRight
          qrItems={qrItems}
          activeQRId={activeQRId}
          onSelectQRId={(id) => setActiveQRId(id)}
          onAddQR={handleAddQR}
          onRemoveQR={handleRemoveQR}
          onDuplicateQR={handleDuplicateQR}
          onChangeActiveQRConfig={handleChangeActiveQRConfig}
          pageShift={pageShift}
          onChangePageShift={(upd) => setPageShift((prev) => ({ ...prev, ...upd }))}
          onInsertDedicatedPage={handleInsertDedicatedPage}
          pageWidthMm={currentPageDim.widthMm}
          pageHeightMm={currentPageDim.heightMm}
          currentPage={currentPage}
          totalPages={documentInfo?.pageCount || 0}
          targetPagesCount={totalTargetedPages}
          onApplyPreset={handleApplyPreset}
          onExportClick={handleExportClick}
          isProcessing={progress.status === 'processing'}
          qrPreviewUrl={qrPreviews[activeQRId]}
        />
      </div>

      {/* 3. Bottom Status Bar */}
      <StatusBar
        documentInfo={documentInfo}
        currentPage={currentPage}
        zoomScale={zoomScale}
        qrConfig={activeQR}
        targetPagesCount={totalTargetedPages}
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
