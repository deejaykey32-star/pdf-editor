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
import { parsePdfDocument } from '@/lib/pdf-service';
import { generateSyntheticA5Pdf } from '@/lib/sample-pdf';
import { generateQRDataUrl, resolvePageContent, interpolateQRText } from '@/lib/qr-generator';
import { parsePageRange, getPresetPosition } from '@/lib/coordinates';
import { applyQRCodesLossless, insertDedicatedQRPage } from '@/lib/pdf-manipulator';

const INITIAL_QR_ITEMS: QRCodeItem[] = [
  {
    id: 'qr-1',
    label: 'Kod Strona 1',
    content: 'https://example.com/strona-1',
    sizeMm: 25,
    xMm: 118, // bottom-right for A5 (148 - 25 - 5)
    yMm: 180, // bottom-right for A5 (210 - 25 - 5)
    errorCorrection: 'M',
    marginModules: 1,
    colorDark: '#000000',
    colorLight: '#ffffff',
    safetyMarginMm: 5,
    scope: {
      mode: 'page',
      specificPage: 1,
      rangeString: '',
    },
    enableLink: true,
    showLabel: true,
    labelPosition: 'bottom',
    uniqueMode: 'single',
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

  // Compute map of target pages for each QR item
  const targetPagesPerQR = useMemo(() => {
    const map = new Map<string, Set<number>>();
    const totalPages = documentInfo?.pageCount || 100;

    qrItems.forEach((item) => {
      const pages = parsePageRange(item.scope, totalPages, currentPage);
      map.set(item.id, new Set(pages));
    });

    return map;
  }, [qrItems, currentPage, documentInfo?.pageCount]);

  // When changing pages, automatically select the QR code that is on this page (if any)
  useEffect(() => {
    const pageQRs = qrItems.filter((item) => {
      const pSet = targetPagesPerQR.get(item.id);
      return pSet?.has(currentPage);
    });

    if (pageQRs.length > 0) {
      const isAlreadyOnThisPage = pageQRs.some((q) => q.id === activeQRId);
      if (!isAlreadyOnThisPage) {
        setActiveQRId(pageQRs[0].id);
      }
    }
  }, [currentPage, qrItems, targetPagesPerQR, activeQRId]);

  // Generate previews for each QR code matching active page
  useEffect(() => {
    let isCurrent = true;
    const totalPages = documentInfo?.pageCount || 1;

    qrItems.forEach((item) => {
      const pageContent = resolvePageContent(item, currentPage, totalPages) || 'https://example.com';
      generateQRDataUrl(pageContent, item, 256)
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
  }, [qrItems, currentPage, documentInfo?.pageCount]);

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

  // Add a new QR item strictly for a specific page (defaults to current page)
  const handleAddQRForPage = (targetPage: number = currentPage) => {
    const newId = `qr-${Date.now()}`;
    const base = qrItems.find((q) => q.id === activeQRId) || qrItems[0];
    const newQR: QRCodeItem = {
      id: newId,
      label: `Kod Strona ${targetPage}`,
      content: `https://example.com/strona-${targetPage}`,
      sizeMm: base ? base.sizeMm : 25,
      xMm: base ? base.xMm : 118,
      yMm: base ? base.yMm : 180,
      errorCorrection: base ? base.errorCorrection : 'M',
      marginModules: base ? base.marginModules : 1,
      colorDark: base ? base.colorDark : '#000000',
      colorLight: base ? base.colorLight : '#ffffff',
      safetyMarginMm: base ? base.safetyMarginMm : 5,
      scope: {
        mode: 'page',
        specificPage: targetPage,
        rangeString: '',
      },
      enableLink: true,
      showLabel: true,
      labelPosition: 'bottom',
      uniqueMode: 'single',
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

  // Copy geometry (size, position) from source QR code to all other QR codes in document
  const handleApplyPositionToAll = (sourceId: string) => {
    const source = qrItems.find((q) => q.id === sourceId);
    if (!source) return;

    setQrItems((prev) =>
      prev.map((item) =>
        item.id === sourceId
          ? item
          : {
              ...item,
              xMm: source.xMm,
              yMm: source.yMm,
              sizeMm: source.sizeMm,
              safetyMarginMm: source.safetyMarginMm,
            }
      )
    );
  };

  // Generate series of unique QR codes for ALL document pages based on template
  const handleGenerateSeriesForAllPages = (templateUrl: string = 'https://example.com/produkt?page={page}') => {
    const totalPages = documentInfo?.pageCount || 20;
    const base = qrItems.find((q) => q.id === activeQRId) || qrItems[0];
    const newItems: QRCodeItem[] = [];

    for (let p = 1; p <= totalPages; p++) {
      const pageUrl = interpolateQRText(templateUrl, p, totalPages);
      newItems.push({
        id: `qr-p${p}-${Date.now()}`,
        label: `Strona ${p}`,
        content: pageUrl,
        sizeMm: base ? base.sizeMm : 25,
        xMm: base ? base.xMm : 118,
        yMm: base ? base.yMm : 180,
        errorCorrection: base ? base.errorCorrection : 'M',
        marginModules: base ? base.marginModules : 1,
        colorDark: base ? base.colorDark : '#000000',
        colorLight: base ? base.colorLight : '#ffffff',
        safetyMarginMm: base ? base.safetyMarginMm : 5,
        scope: {
          mode: 'page',
          specificPage: p,
          rangeString: '',
        },
        enableLink: true,
        showLabel: true,
        labelPosition: base ? base.labelPosition : 'bottom',
        uniqueMode: 'single',
      });
    }

    setQrItems(newItems);
    const currItem = newItems.find((q) => q.scope.specificPage === currentPage) || newItems[0];
    if (currItem) {
      setActiveQRId(currItem.id);
    }
  };

  // Assign list of URLs (one per page) to all pages in document
  const handleApplyUrlListToPages = (urls: string[]) => {
    const totalPages = documentInfo?.pageCount || urls.length;
    const base = qrItems.find((q) => q.id === activeQRId) || qrItems[0];
    const newItems: QRCodeItem[] = [];

    for (let p = 1; p <= totalPages; p++) {
      const url = urls[p - 1]?.trim() || `https://example.com/strona-${p}`;
      newItems.push({
        id: `qr-p${p}-${Date.now()}`,
        label: `Strona ${p}`,
        content: url,
        sizeMm: base ? base.sizeMm : 25,
        xMm: base ? base.xMm : 118,
        yMm: base ? base.yMm : 180,
        errorCorrection: base ? base.errorCorrection : 'M',
        marginModules: base ? base.marginModules : 1,
        colorDark: base ? base.colorDark : '#000000',
        colorLight: base ? base.colorLight : '#ffffff',
        safetyMarginMm: base ? base.safetyMarginMm : 5,
        scope: {
          mode: 'page',
          specificPage: p,
          rangeString: '',
        },
        enableLink: true,
        showLabel: true,
        labelPosition: base ? base.labelPosition : 'bottom',
        uniqueMode: 'single',
      });
    }

    setQrItems(newItems);
    const currItem = newItems.find((q) => q.scope.specificPage === currentPage) || newItems[0];
    if (currItem) {
      setActiveQRId(currItem.id);
    }
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

  // Safe PDF File Upload handler: extracts dimensions & proxy in 1 pass, keeping data intact
  const handleFileUpload = useCallback(async (file: File) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const { info, proxy } = await parsePdfDocument(file, arrayBuffer);

      setDocumentInfo(info);
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
      const copy = new Uint8Array(pdfBytes);
      const file = new File([copy], `Syntetyczny_Katalog_A5_${count}stron.pdf`, {
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
    if (!documentInfo || !documentInfo.data || documentInfo.data.byteLength === 0) return;
    try {
      const safeBytes = new Uint8Array(documentInfo.data.slice(0));
      const modifiedBytes = await insertDedicatedQRPage({
        originalBytes: safeBytes,
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

  // Start Batch Lossless Export with safe non-detached byte copy
  const handleExportClick = async () => {
    if (!documentInfo || totalTargetedPages === 0) return;

    if (!documentInfo.data || documentInfo.data.byteLength === 0) {
      alert('Błąd odczytu danych pliku PDF. Spróbuj wgrać plik ponownie.');
      return;
    }

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
      // Create guaranteed intact copy of original bytes
      const safeOriginalBytes = new Uint8Array(documentInfo.data.slice(0));

      const modifiedBytes = await applyQRCodesLossless({
        originalBytes: safeOriginalBytes,
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

        {/* Right: Intuitive QR Code Configurator & Series Generator */}
        <SidebarRight
          qrItems={qrItems}
          activeQRId={activeQRId}
          onSelectQRId={(id) => setActiveQRId(id)}
          onAddQRForPage={handleAddQRForPage}
          onRemoveQR={handleRemoveQR}
          onDuplicateQR={handleDuplicateQR}
          onChangeActiveQRConfig={handleChangeActiveQRConfig}
          onApplyPositionToAll={handleApplyPositionToAll}
          onGenerateSeriesForAllPages={handleGenerateSeriesForAllPages}
          onApplyUrlListToPages={handleApplyUrlListToPages}
          pageShift={pageShift}
          onChangePageShift={(upd) => setPageShift((prev) => ({ ...prev, ...upd }))}
          onInsertDedicatedPage={handleInsertDedicatedPage}
          pageWidthMm={currentPageDim.widthMm}
          pageHeightMm={currentPageDim.heightMm}
          currentPage={currentPage}
          totalPages={documentInfo?.pageCount || 0}
          targetPagesPerQR={targetPagesPerQR}
          targetPagesCount={totalTargetedPages}
          onApplyPreset={handleApplyPreset}
          onExportClick={handleExportClick}
          onPageChange={(p) => setCurrentPage(p)}
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
