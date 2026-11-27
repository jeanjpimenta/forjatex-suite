import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import { open as openExternal } from '@tauri-apps/plugin-shell';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eraser,
  FolderOpen,
  Heart,
  Monitor,
  Moon,
  Pause,
  PenTool,
  Play,
  Presentation,
  Radio,
  RotateCcw,
  Square,
  Sun,
  X,
} from 'lucide-react';
import {
  generatePixQrDataUrl,
  getPayPalDonateUrl,
  PAYPAL_EMAIL,
  PIX_KEY,
} from './pixDonate';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface MonitorInfo {
  index: number;
  name: string;
  width: number;
  height: number;
  x: number;
  y: number;
}

interface Stroke {
  points: Array<{ x: number; y: number }>;
}

interface SyncPayload {
  pdfPath: string | null;
  currentPage: number;
  dualMode: 'auto' | 'right' | 'off';
  blackScreen: boolean;
  whiteScreen: boolean;
  laserPos: { x: number; y: number } | null;
  strokes: Stroke[];
}

const NOTES_PREFIX = 'forjaslide_notes_v1_';

async function renderPdfSlice(
  doc: pdfjsLib.PDFDocumentProxy,
  pageNum: number,
  canvas: HTMLCanvasElement,
  scale: number,
  slice: 'full' | 'left' | 'right'
): Promise<{ isWideBeamer: boolean }> {
  const page = await doc.getPage(pageNum);
  const vp = page.getViewport({ scale });
  const isWideBeamer = vp.width / vp.height > 2.2;

  const off = document.createElement('canvas');
  off.width = Math.max(1, Math.floor(vp.width));
  off.height = Math.max(1, Math.floor(vp.height));
  const offCtx = off.getContext('2d');
  if (!offCtx) return { isWideBeamer };

  await page.render({ canvasContext: offCtx, viewport: vp, canvas: off }).promise;

  const ctx = canvas.getContext('2d');
  if (!ctx) return { isWideBeamer };

  if (slice === 'full') {
    canvas.width = off.width;
    canvas.height = off.height;
    ctx.drawImage(off, 0, 0);
  } else {
    const halfW = Math.floor(off.width / 2);
    canvas.width = halfW;
    canvas.height = off.height;
    const sx = slice === 'left' ? 0 : halfW;
    ctx.drawImage(off, sx, 0, halfW, off.height, 0, 0, halfW, off.height);
  }
  return { isWideBeamer };
}

export default function App() {
  const isAudience = useMemo(
    () => new URLSearchParams(window.location.search).get('view') === 'audience',
    []
  );

  const [themeMode, setThemeMode] = useState<'dark' | 'light'>('dark');
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [pdfPath, setPdfPath] = useState<string | null>(null);
  const [pdfName, setPdfName] = useState<string>('Nenhum PDF aberto');
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [detectedWide, setDetectedWide] = useState(false);
  const [dualMode, setDualMode] = useState<'auto' | 'right' | 'off'>('auto');

  const [monitors, setMonitors] = useState<MonitorInfo[]>([]);
  const [selectedMonitor, setSelectedMonitor] = useState<number>(0);
  const [audienceActive, setAudienceActive] = useState(false);

  const [blackScreen, setBlackScreen] = useState(false);
  const [whiteScreen, setWhiteScreen] = useState(false);
  const [tool, setTool] = useState<'none' | 'laser' | 'pen'>('laser');
  const [laserPos, setLaserPos] = useState<{ x: number; y: number } | null>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const drawingRef = useRef(false);

  // Timer
  const [elapsedSec, setElapsedSec] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [targetMinutes, setTargetMinutes] = useState(20);

  // Custom notes for standard PDFs
  const [customNotes, setCustomNotes] = useState<Record<number, string>>({});
  const [showThumbs, setShowThumbs] = useState(true);

  const [donateOpen, setDonateOpen] = useState(false);
  const [pixQrUrl, setPixQrUrl] = useState('');
  const [pixBrCode, setPixBrCode] = useState('');
  const [copyTag, setCopyTag] = useState<string | null>(null);

  const currentCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const nextCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const notesCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const audienceCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const isDualActive = dualMode === 'right' || (dualMode === 'auto' && detectedWide);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeMode);
  }, [themeMode]);

  const loadPdfFromPath = useCallback(async (path: string) => {
    const bytes = await invoke<number[]>('read_pdf_bytes', { path });
    const data = new Uint8Array(bytes);
    const doc = await pdfjsLib.getDocument({ data }).promise;
    setPdfDoc(doc);
    setPdfPath(path);
    const name = path.split(/[\\/]/).pop() || path;
    setPdfName(name);
    setNumPages(doc.numPages);
    setCurrentPage(1);
    setStrokes([]);

    try {
      const saved = localStorage.getItem(`${NOTES_PREFIX}${name}`);
      setCustomNotes(saved ? JSON.parse(saved) : {});
    } catch {
      setCustomNotes({});
    }
  }, []);

  // Load monitors & CLI PDF arg on Presenter startup
  useEffect(() => {
    if (isAudience) return;
    invoke<MonitorInfo[]>('list_monitors')
      .then((list) => {
        setMonitors(list);
        if (list.length > 1) setSelectedMonitor(1);
      })
      .catch(() => {});

    invoke<string | null>('get_initial_pdf_arg')
      .then((arg) => {
        if (arg) void loadPdfFromPath(arg);
      })
      .catch(() => {});

    generatePixQrDataUrl('DoacaoForjaSlide')
      .then(({ brCode, qrUrl }) => {
        setPixBrCode(brCode);
        setPixQrUrl(qrUrl);
      })
      .catch(() => {});
  }, [isAudience, loadPdfFromPath]);

  // Timer tick
  useEffect(() => {
    if (isAudience || !timerRunning) return;
    const id = window.setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [isAudience, timerRunning]);

  // Audience listener
  useEffect(() => {
    if (!isAudience) return;
    const unlistenPromise = listen<string>('slide-sync', async (ev) => {
      try {
        const payload = JSON.parse(ev.payload) as SyncPayload;
        setBlackScreen(payload.blackScreen);
        setWhiteScreen(payload.whiteScreen);
        setLaserPos(payload.laserPos);
        setStrokes(payload.strokes);
        setDualMode(payload.dualMode);
        setCurrentPage(payload.currentPage);
        if (payload.pdfPath && payload.pdfPath !== pdfPath) {
          await loadPdfFromPath(payload.pdfPath);
          setCurrentPage(payload.currentPage);
        }
      } catch {
        // ignore
      }
    });
    return () => {
      void unlistenPromise.then((fn) => fn());
    };
  }, [isAudience, pdfPath, loadPdfFromPath]);

  // Sync state from Presenter to Audience
  useEffect(() => {
    if (isAudience) return;
    const payload: SyncPayload = {
      pdfPath,
      currentPage,
      dualMode,
      blackScreen,
      whiteScreen,
      laserPos,
      strokes,
    };
    invoke('sync_slide_state', { stateJson: JSON.stringify(payload) }).catch(() => {});
  }, [
    isAudience,
    pdfPath,
    currentPage,
    dualMode,
    blackScreen,
    whiteScreen,
    laserPos,
    strokes,
    audienceActive,
  ]);

  // Render Presenter canvases
  useEffect(() => {
    if (isAudience || !pdfDoc || currentPage < 1 || currentPage > pdfDoc.numPages) return;
    let cancelled = false;
    (async () => {
      if (currentCanvasRef.current) {
        const page = await pdfDoc.getPage(currentPage);
        const vp = page.getViewport({ scale: 1 });
        const wide = vp.width / vp.height > 2.2;
        if (cancelled) return;
        setDetectedWide(wide);
        const useDual = dualMode === 'right' || (dualMode === 'auto' && wide);
        await renderPdfSlice(
          pdfDoc,
          currentPage,
          currentCanvasRef.current,
          1.7,
          useDual ? 'left' : 'full'
        );
        if (useDual && notesCanvasRef.current) {
          await renderPdfSlice(pdfDoc, currentPage, notesCanvasRef.current, 1.3, 'right');
        }
        if (nextCanvasRef.current) {
          if (currentPage < pdfDoc.numPages) {
            await renderPdfSlice(
              pdfDoc,
              currentPage + 1,
              nextCanvasRef.current,
              0.9,
              useDual ? 'left' : 'full'
            );
          } else {
            const ctx = nextCanvasRef.current.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, nextCanvasRef.current.width, nextCanvasRef.current.height);
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAudience, pdfDoc, currentPage, dualMode]);

  // Render Audience canvas
  useEffect(() => {
    if (!isAudience || !pdfDoc || currentPage < 1 || currentPage > pdfDoc.numPages) return;
    let cancelled = false;
    (async () => {
      if (audienceCanvasRef.current) {
        const page = await pdfDoc.getPage(currentPage);
        const vp = page.getViewport({ scale: 1 });
        const wide = vp.width / vp.height > 2.2;
        if (cancelled) return;
        setDetectedWide(wide);
        const useDual = dualMode === 'right' || (dualMode === 'auto' && wide);
        await renderPdfSlice(
          pdfDoc,
          currentPage,
          audienceCanvasRef.current,
          2.2,
          useDual ? 'left' : 'full'
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAudience, pdfDoc, currentPage, dualMode]);

  const goPage = useCallback(
    (next: number) => {
      if (!numPages) return;
      const clamped = Math.max(1, Math.min(numPages, next));
      if (clamped !== currentPage) {
        setCurrentPage(clamped);
        setStrokes([]);
      }
    },
    [numPages, currentPage]
  );

  const toggleAudience = useCallback(async () => {
    if (audienceActive) {
      await invoke('close_audience_window');
      setAudienceActive(false);
    } else {
      await invoke('open_audience_window', { monitorIndex: selectedMonitor });
      setAudienceActive(true);
      setTimerRunning(true);
    }
  }, [audienceActive, selectedMonitor]);

  // Market-standard presentation shortcuts
  useEffect(() => {
    if (isAudience) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT') return;

      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown' || e.key === 'Enter') {
        e.preventDefault();
        goPage(currentPage + 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp' || e.key === 'Backspace') {
        e.preventDefault();
        goPage(currentPage - 1);
      } else if (e.key === 'Home') {
        e.preventDefault();
        goPage(1);
      } else if (e.key === 'End') {
        e.preventDefault();
        goPage(numPages);
      } else if (e.key === 'F5') {
        e.preventDefault();
        void toggleAudience();
      } else if (e.key === 'Escape') {
        if (blackScreen || whiteScreen) {
          setBlackScreen(false);
          setWhiteScreen(false);
        } else if (audienceActive) {
          void invoke('close_audience_window').then(() => setAudienceActive(false));
        }
      } else if (e.key.toLowerCase() === 'b') {
        setWhiteScreen(false);
        setBlackScreen((v) => !v);
      } else if (e.key.toLowerCase() === 'w') {
        setBlackScreen(false);
        setWhiteScreen((v) => !v);
      } else if (e.key.toLowerCase() === 'l') {
        setTool((t) => (t === 'laser' ? 'none' : 'laser'));
      } else if (e.key.toLowerCase() === 'p') {
        setTool((t) => (t === 'pen' ? 'none' : 'pen'));
      } else if (e.key.toLowerCase() === 'c') {
        setStrokes([]);
      } else if (e.key.toLowerCase() === 'r') {
        setElapsedSec(0);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isAudience, currentPage, numPages, goPage, toggleAudience, blackScreen, whiteScreen, audienceActive]);

  const handleOpenPdf = async () => {
    const selected = await open({
      filters: [{ name: 'Apresentação PDF', extensions: ['pdf'] }],
      multiple: false,
    });
    if (!selected || Array.isArray(selected)) return;
    await loadPdfFromPath(selected);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    if (tool === 'laser') {
      setLaserPos({ x, y });
    } else if (tool === 'pen' && drawingRef.current) {
      setStrokes((prev) => {
        if (prev.length === 0) return [{ points: [{ x, y }] }];
        const copy = [...prev];
        copy[copy.length - 1] = { points: [...copy[copy.length - 1].points, { x, y }] };
        return copy;
      });
    }
  };

  const formatClock = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // AUDIENCE WINDOW RENDER
  if (isAudience) {
    return (
      <div className="fs-audience-root">
        {(blackScreen || whiteScreen) && (
          <div
            className="fs-screen-curtain"
            style={{ background: whiteScreen ? '#ffffff' : '#000000' }}
          />
        )}
        <div className="fs-canvas-stack">
          <canvas ref={audienceCanvasRef} className="fs-slide-canvas" />
          <svg className="fs-overlay-svg" viewBox="0 0 1000 1000" preserveAspectRatio="none">
            {strokes.map((st, idx) => (
              <polyline
                key={idx}
                fill="none"
                stroke="#f43f5e"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={st.points.map((p) => `${p.x * 1000},${p.y * 1000}`).join(' ')}
              />
            ))}
            {laserPos && (
              <circle
                cx={laserPos.x * 1000}
                cy={laserPos.y * 1000}
                r="10"
                fill="#ef4444"
                stroke="#ffffff"
                strokeWidth="3"
              />
            )}
          </svg>
        </div>
      </div>
    );
  }

  // PRESENTER WINDOW RENDER
  const targetSec = targetMinutes * 60;
  const timerClass =
    elapsedSec >= targetSec
      ? 'fs-timer-val over'
      : elapsedSec >= targetSec * 0.85
      ? 'fs-timer-val warn'
      : 'fs-timer-val';

  return (
    <div className="fs-shell">
      <header className="fs-header">
        <div className="fs-brand">
          <img src="/logo.png" alt="ForjaSlide" className="fs-logo" />
          <div>
            <h1>ForjaSlide</h1>
            <span>{pdfName} {isDualActive ? '· Beamer 2ª Tela (pgfpages)' : ''}</span>
          </div>
        </div>

        <div className="fs-toolbar">
          <button type="button" className="fs-btn" onClick={handleOpenPdf}>
            <FolderOpen size={14} /> Abrir PDF
          </button>

          <select
            className="fs-select"
            value={selectedMonitor}
            onChange={(e) => setSelectedMonitor(Number(e.target.value))}
            title="Monitor para a Janela do Público"
          >
            {monitors.length === 0 ? (
              <option value={0}>Monitor Padrão</option>
            ) : (
              monitors.map((m) => (
                <option key={m.index} value={m.index}>
                  Tela {m.index + 1}: {m.width}×{m.height}
                </option>
              ))
            )}
          </select>

          <select
            className="fs-select"
            value={dualMode}
            onChange={(e) => setDualMode(e.target.value as 'auto' | 'right' | 'off')}
            title="Modo de Notas Beamer (pgfpages)"
          >
            <option value="auto">Beamer Notas: Auto</option>
            <option value="right">Beamer 2ª Tela (Direita)</option>
            <option value="off">PDF Normal (Página Inteira)</option>
          </select>

          <button
            type="button"
            className={`fs-btn ${audienceActive ? 'danger' : 'primary'}`}
            onClick={toggleAudience}
            title="Abrir/Fechar Janela do Público (F5 / Esc)"
          >
            <Presentation size={14} /> {audienceActive ? 'Encerrar (Esc)' : 'Apresentar (F5)'}
          </button>

          <button
            type="button"
            className={`fs-btn ${blackScreen ? 'active' : ''}`}
            onClick={() => {
              setWhiteScreen(false);
              setBlackScreen((v) => !v);
            }}
            title="Tela Preta para o Público (B)"
          >
            <Square size={13} fill="#000" /> B
          </button>
          <button
            type="button"
            className={`fs-btn ${whiteScreen ? 'active' : ''}`}
            onClick={() => {
              setBlackScreen(false);
              setWhiteScreen((v) => !v);
            }}
            title="Tela Branca para o Público (W)"
          >
            <Square size={13} fill="#fff" /> W
          </button>
          <button
            type="button"
            className={`fs-btn ${tool === 'laser' ? 'active' : ''}`}
            onClick={() => setTool((t) => (t === 'laser' ? 'none' : 'laser'))}
            title="Ponteiro Laser (L)"
          >
            <Radio size={14} /> Laser
          </button>
          <button
            type="button"
            className={`fs-btn ${tool === 'pen' ? 'active' : ''}`}
            onClick={() => setTool((t) => (t === 'pen' ? 'none' : 'pen'))}
            title="Caneta / Anotar (P)"
          >
            <PenTool size={14} /> Caneta
          </button>
          <button
            type="button"
            className="fs-btn"
            onClick={() => setStrokes([])}
            title="Limpar Anotações (C)"
          >
            <Eraser size={14} />
          </button>
          <button type="button" className="fs-btn" onClick={() => setDonateOpen(true)}>
            <Heart size={14} color="#f43f5e" />
          </button>
          <button
            type="button"
            className="fs-btn"
            onClick={() => setThemeMode((m) => (m === 'dark' ? 'light' : 'dark'))}
          >
            {themeMode === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>
      </header>

      <main className="fs-main">
        {/* Left/Center: Current Slide */}
        <section className="fs-current-pane">
          <div className="fs-pane-head">
            <span>
              Slide Atual {numPages > 0 ? `(${currentPage} / ${numPages})` : ''}
              {blackScreen ? ' · [TELA PRETA ATIVA]' : whiteScreen ? ' · [TELA BRANCA ATIVA]' : ''}
            </span>
            <span>Atalhos: ← → Espaço | B/W | L Laser | P Caneta | F5</span>
          </div>

          <div className="fs-canvas-box">
            {!pdfDoc ? (
              <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>
                <Monitor size={42} style={{ opacity: 0.45, marginBottom: 10 }} />
                <p style={{ marginBottom: 12 }}>
                  Abra um PDF gerado pelo <strong>ForjaBeam</strong> ou <strong>ForjaTeX IDE</strong> para apresentar.
                </p>
                <button type="button" className="fs-btn primary" onClick={handleOpenPdf}>
                  <FolderOpen size={14} /> Selecionar PDF
                </button>
              </div>
            ) : (
              <div
                className="fs-canvas-stack"
                style={{ cursor: tool === 'laser' ? 'crosshair' : tool === 'pen' ? 'cell' : 'default' }}
                onMouseDown={(e) => {
                  if (tool === 'pen') {
                    drawingRef.current = true;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = (e.clientX - rect.left) / rect.width;
                    const y = (e.clientY - rect.top) / rect.height;
                    setStrokes((prev) => [...prev, { points: [{ x, y }] }]);
                  }
                }}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={() => {
                  drawingRef.current = false;
                }}
                onMouseLeave={() => {
                  drawingRef.current = false;
                  setLaserPos(null);
                }}
              >
                <canvas ref={currentCanvasRef} className="fs-slide-canvas" />
                <svg className="fs-overlay-svg" viewBox="0 0 1000 1000" preserveAspectRatio="none">
                  {strokes.map((st, idx) => (
                    <polyline
                      key={idx}
                      fill="none"
                      stroke="#f43f5e"
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={st.points.map((p) => `${p.x * 1000},${p.y * 1000}`).join(' ')}
                    />
                  ))}
                  {laserPos && (
                    <circle
                      cx={laserPos.x * 1000}
                      cy={laserPos.y * 1000}
                      r="10"
                      fill="#ef4444"
                      stroke="#ffffff"
                      strokeWidth="3"
                    />
                  )}
                </svg>
              </div>
            )}
          </div>

          <div className="fs-nav-row">
            <button
              type="button"
              className="fs-btn"
              disabled={currentPage <= 1}
              onClick={() => goPage(currentPage - 1)}
            >
              <ChevronLeft size={15} /> Anterior
            </button>
            <button
              type="button"
              className="fs-btn"
              onClick={() => setShowThumbs((v) => !v)}
            >
              {showThumbs ? 'Ocultar Miniaturas' : 'Mostrar Miniaturas'}
            </button>
            <button
              type="button"
              className="fs-btn primary"
              disabled={!numPages || currentPage >= numPages}
              onClick={() => goPage(currentPage + 1)}
            >
              Próximo <ChevronRight size={15} />
            </button>
          </div>
        </section>

        {/* Right: Next Slide + Notes + Timer */}
        <aside className="fs-side-col">
          <div className="fs-timer-row">
            <div>
              <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase' }}>
                Cronômetro (Meta: {targetMinutes} min)
              </div>
              <div className={timerClass}>{formatClock(elapsedSec)}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input
                type="number"
                min={1}
                max={180}
                value={targetMinutes}
                onChange={(e) => setTargetMinutes(Math.max(1, Number(e.target.value)))}
                style={{
                  width: 48,
                  padding: '4px 6px',
                  borderRadius: 5,
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  fontSize: 12,
                }}
                title="Tempo alvo em minutos"
              />
              <button
                type="button"
                className="fs-btn"
                onClick={() => setTimerRunning((v) => !v)}
              >
                {timerRunning ? <Pause size={13} /> : <Play size={13} />}
              </button>
              <button
                type="button"
                className="fs-btn"
                onClick={() => setElapsedSec(0)}
                title="Reiniciar (R)"
              >
                <RotateCcw size={13} />
              </button>
            </div>
          </div>

          <div className="fs-card">
            <div className="fs-pane-head">
              <span>Próximo Slide</span>
              <span>{currentPage < numPages ? `#${currentPage + 1}` : 'Fim'}</span>
            </div>
            <div className="fs-next-box">
              <canvas ref={nextCanvasRef} className="fs-slide-canvas" />
            </div>
          </div>

          <div className="fs-card" style={{ flex: 1 }}>
            <div className="fs-pane-head">
              <span>
                {isDualActive ? 'Notas do Beamer (2ª Tela)' : 'Notas do Apresentador'}
              </span>
            </div>
            {isDualActive ? (
              <div className="fs-canvas-box" style={{ background: '#fff' }}>
                <canvas ref={notesCanvasRef} className="fs-slide-canvas" />
              </div>
            ) : (
              <div className="fs-notes-box">
                <textarea
                  className="fs-notes-textarea"
                  placeholder="Digite suas anotações para este slide..."
                  value={customNotes[currentPage] || ''}
                  onChange={(e) => {
                    const next = { ...customNotes, [currentPage]: e.target.value };
                    setCustomNotes(next);
                    if (pdfDoc) {
                      localStorage.setItem(`${NOTES_PREFIX}${pdfName}`, JSON.stringify(next));
                    }
                  }}
                />
              </div>
            )}
          </div>
        </aside>
      </main>

      {showThumbs && numPages > 0 && (
        <div className="fs-thumbs-bar">
          {Array.from({ length: numPages }, (_, i) => i + 1).map((p) => (
            <button
              key={p}
              type="button"
              className={`fs-thumb-item ${p === currentPage ? 'active' : ''}`}
              onClick={() => goPage(p)}
            >
              <span>Slide {p}</span>
            </button>
          ))}
        </div>
      )}

      {donateOpen && (
        <div className="fs-modal-backdrop" onClick={() => setDonateOpen(false)}>
          <div className="fs-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>Apoiar o ForjaSlide (Ecossistema ForjaTeX)</strong>
              <button type="button" className="fs-btn" onClick={() => setDonateOpen(false)}>
                <X size={13} />
              </button>
            </div>
            <div className="fs-donate-grid">
              <div className="fs-donate-box">
                <strong>Pix</strong>
                {pixQrUrl && <img src={pixQrUrl} alt="QR Pix" className="fs-qr" />}
                <code style={{ fontSize: 10, wordBreak: 'break-all' }}>{PIX_KEY}</code>
                <button
                  type="button"
                  className="fs-btn primary"
                  onClick={async () => {
                    await navigator.clipboard.writeText(pixBrCode || PIX_KEY);
                    setCopyTag('pix');
                    setTimeout(() => setCopyTag(null), 2000);
                  }}
                >
                  {copyTag === 'pix' ? <Check size={12} /> : <Copy size={12} />}{' '}
                  {copyTag === 'pix' ? 'Copiado!' : 'Copiar Pix'}
                </button>
              </div>
              <div className="fs-donate-box">
                <strong>PayPal</strong>
                <code style={{ fontSize: 10 }}>{PAYPAL_EMAIL}</code>
                <button
                  type="button"
                  className="fs-btn primary"
                  onClick={() => openExternal(getPayPalDonateUrl('DoacaoForjaSlide'))}
                >
                  Abrir PayPal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

