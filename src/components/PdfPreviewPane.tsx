import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { ZoomIn, ZoomOut, FileText, Crosshair, Maximize2, ChevronLeft, ChevronRight, X } from 'lucide-react';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

interface PdfPreviewPaneProps {
  pdfBase64: string | null;
  synctexAvailable: boolean;
  isCompiling: boolean;
  scrollToPage?: { page: number; nonce: number } | null;
  onSyncTexSingleClick: (page: number, xPt: number, yPt: number) => void;
  onSyncTexDoubleClick: (page: number, xPt: number, yPt: number) => void;
}

interface PageRenderProps {
  pdfDoc: pdfjsLib.PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  onSingleClick: (page: number, xPt: number, yPt: number) => void;
  onDoubleClick: (page: number, xPt: number, yPt: number) => void;
}

const PdfPageCanvas: React.FC<PageRenderProps> = ({
  pdfDoc,
  pageNumber,
  scale,
  onSingleClick,
  onDoubleClick,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const clickTimerRef = useRef<number | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    let cancelled = false;
    let renderTask: pdfjsLib.RenderTask | null = null;
    (async () => {
      const page = await pdfDoc.getPage(pageNumber);
      if (cancelled) return;
      const viewport = page.getViewport({ scale });
      setSize({ width: viewport.width, height: viewport.height });
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      renderTask = page.render({ canvasContext: ctx, viewport, canvas });
      await renderTask.promise.catch(() => {});
    })();
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [pdfDoc, pageNumber, scale]);

  const computePdfCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const xPt = (e.clientX - rect.left) / scale;
    const yPt = (e.clientY - rect.top) / scale;
    return { xPt, yPt };
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { xPt, yPt } = computePdfCoords(e);
    if (clickTimerRef.current) {
      window.clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      return;
    }
    clickTimerRef.current = window.setTimeout(() => {
      clickTimerRef.current = null;
      onSingleClick(pageNumber, xPt, yPt);
    }, 220);
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (clickTimerRef.current) {
      window.clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    const { xPt, yPt } = computePdfCoords(e);
    onDoubleClick(pageNumber, xPt, yPt);
  };

  return (
    <div
      className="tf-pdf-page-wrapper"
      style={{
        width: size.width || 'auto',
        height: size.height || 'auto',
      }}
    >
      <canvas
        ref={canvasRef}
        className="tf-pdf-canvas"
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        title="1 clique: destacar arquivo no Explorer | 2 cliques: abrir arquivo na linha"
      />
      <div className="tf-pdf-page-badge">Página {pageNumber}</div>
    </div>
  );
};

export const PdfPreviewPane: React.FC<PdfPreviewPaneProps> = ({
  pdfBase64,
  synctexAvailable,
  isCompiling,
  scrollToPage,
  onSyncTexSingleClick,
  onSyncTexDoubleClick,
}) => {
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.15);
  const [presentationPage, setPresentationPage] = useState<number | null>(null);
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const leftCtrlDownRef = useRef(false);
  const leftAltDownRef = useRef(false);
  const [panMode, setPanMode] = useState<'none' | 'ready' | 'dragging'>('none');
  const panStateRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
    moved: boolean;
  }>({ active: false, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0, moved: false });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'ControlLeft') leftCtrlDownRef.current = true;
      if (e.code === 'AltLeft') {
        leftAltDownRef.current = true;
        setPanMode((m) => (m === 'dragging' ? 'dragging' : 'ready'));
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'ControlLeft') leftCtrlDownRef.current = false;
      if (e.code === 'AltLeft') {
        leftAltDownRef.current = false;
        panStateRef.current.active = false;
        setPanMode('none');
      }
    };
    const onBlur = () => {
      leftCtrlDownRef.current = false;
      leftAltDownRef.current = false;
      panStateRef.current.active = false;
      setPanMode('none');
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  const handlePanMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!leftAltDownRef.current || e.button !== 0) return;
    const el = scrollContainerRef.current;
    if (!el) return;
    e.preventDefault();
    panStateRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      scrollLeft: el.scrollLeft,
      scrollTop: el.scrollTop,
      moved: false,
    };
    setPanMode('dragging');
  };

  const handlePanMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const st = panStateRef.current;
    const el = scrollContainerRef.current;
    if (!st.active || !el) return;
    const dx = e.clientX - st.startX;
    const dy = e.clientY - st.startY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      st.moved = true;
    }
    el.scrollLeft = st.scrollLeft - dx;
    el.scrollTop = st.scrollTop - dy;
  };

  const handlePanMouseUp = () => {
    if (!panStateRef.current.active) return;
    panStateRef.current.active = false;
    setPanMode(leftAltDownRef.current ? 'ready' : 'none');
    if (panStateRef.current.moved) {
      setTimeout(() => {
        panStateRef.current.moved = false;
      }, 60);
    }
  };

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (leftCtrlDownRef.current && e.ctrlKey) {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.1 : -0.1;
        setScale((s) => Math.min(4.0, Math.max(0.5, +(s + delta).toFixed(2))));
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => {
    if (!scrollToPage) return;
    const el = pageRefs.current[scrollToPage.page];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [scrollToPage]);

  useEffect(() => {
    if (!pdfBase64) {
      setPdfDoc(null);
      setNumPages(0);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const binary = atob(pdfBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const loadingTask = pdfjsLib.getDocument({ data: bytes });
        const doc = await loadingTask.promise;
        if (!cancelled) {
          setPdfDoc(doc);
          setNumPages(doc.numPages);
        }
      } catch (err) {
        console.error('Erro ao carregar PDF:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pdfBase64]);

  return (
    <aside className="tf-pdf-pane">
      <div className="tf-panel-header">
        <div className="tf-pdf-header-left">
          <span className="tf-panel-title">PDF PREVIEW</span>
          {synctexAvailable && (
            <span className="tf-synctex-ready" title="SyncTeX ativo: 1 clique destaca, 2 cliques abre">
              <Crosshair size={11} /> SyncTeX
            </span>
          )}
        </div>
        <div className="tf-panel-actions">
          <button
            type="button"
            className="tf-icon-btn"
            onClick={() => setScale((s) => Math.max(0.5, +(s - 0.15).toFixed(2)))}
            title="Diminuir zoom"
          >
            <ZoomOut size={14} />
          </button>
          <span className="tf-zoom-label">{Math.round(scale * 100)}%</span>
          <button
            type="button"
            className="tf-icon-btn"
            onClick={() => setScale((s) => Math.min(4.0, +(s + 0.15).toFixed(2)))}
            title="Aumentar zoom (ou Ctrl esquerdo + scroll)"
          >
            <ZoomIn size={14} />
          </button>
          {pdfDoc && (
            <button
              type="button"
              className="tf-icon-btn"
              onClick={() => setPresentationPage(1)}
              title="Modo Apresentação (Beamer / Tela Cheia)"
            >
              <Maximize2 size={14} />
            </button>
          )}
        </div>
      </div>

      <div
        className={`tf-pdf-scroll ${
          panMode === 'dragging' ? 'pan-dragging' : panMode === 'ready' ? 'pan-ready' : ''
        }`}
        ref={scrollContainerRef}
        onMouseDown={handlePanMouseDown}
        onMouseMove={handlePanMouseMove}
        onMouseUp={handlePanMouseUp}
        onMouseLeave={handlePanMouseUp}
      >
        {isCompiling && <div className="tf-pdf-compiling-bar">Compilando PDF...</div>}

        {!pdfDoc ? (
          <div className="tf-pdf-empty">
            <FileText size={32} className="text-slate-600" />
            <p>Clique em <strong>Compilar</strong> para gerar e visualizar o PDF em tempo real.</p>
            <span className="tf-pdf-hint">
              1 clique no PDF destaca o arquivo no Explorer · 2 cliques abre o arquivo na linha exata · Alt esquerdo + arrastar move o PDF.
            </span>
          </div>
        ) : (
          Array.from({ length: numPages }, (_, idx) => idx + 1).map((pageNum) => (
            <div
              key={`${pageNum}-${scale}`}
              ref={(el) => {
                pageRefs.current[pageNum] = el;
              }}
            >
              <PdfPageCanvas
                pdfDoc={pdfDoc}
                pageNumber={pageNum}
                scale={scale}
                onSingleClick={(p, x, y) => {
                  if (panStateRef.current.moved || leftAltDownRef.current) return;
                  onSyncTexSingleClick(p, x, y);
                }}
                onDoubleClick={(p, x, y) => {
                  if (panStateRef.current.moved || leftAltDownRef.current) return;
                  onSyncTexDoubleClick(p, x, y);
                }}
              />
            </div>
          ))
        )}
      </div>

      {presentationPage !== null && pdfDoc && (
        <div
          className="tf-presentation-overlay"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setPresentationPage(null);
            else if (e.key === 'ArrowRight' || e.key === ' ') {
              setPresentationPage((p) => (p ? Math.min(numPages, p + 1) : 1));
            } else if (e.key === 'ArrowLeft') {
              setPresentationPage((p) => (p ? Math.max(1, p - 1) : 1));
            }
          }}
        >
          <div className="tf-presentation-controls">
            <button
              type="button"
              className="tf-btn-secondary"
              disabled={presentationPage <= 1}
              onClick={() => setPresentationPage((p) => (p ? Math.max(1, p - 1) : 1))}
            >
              <ChevronLeft size={16} />
            </button>
            <span>
              Slide {presentationPage} / {numPages}
            </span>
            <button
              type="button"
              className="tf-btn-secondary"
              disabled={presentationPage >= numPages}
              onClick={() => setPresentationPage((p) => (p ? Math.min(numPages, p + 1) : 1))}
            >
              <ChevronRight size={16} />
            </button>
            <button
              type="button"
              className="tf-btn-secondary"
              onClick={() => setPresentationPage(null)}
            >
              <X size={16} /> Sair (Esc)
            </button>
          </div>
          <PdfPageCanvas
            pdfDoc={pdfDoc}
            pageNumber={presentationPage}
            scale={1.55}
            onSingleClick={() => {}}
            onDoubleClick={() => {}}
          />
        </div>
      )}
    </aside>
  );
};

