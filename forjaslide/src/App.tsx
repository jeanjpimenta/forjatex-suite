import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/plugin-dialog';
import { open as openExternal } from '@tauri-apps/plugin-shell';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  BarChart3,
  Bookmark,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  Edit3,
  Eraser,
  FileText,
  FolderOpen,
  Heart,
  HelpCircle,
  Highlighter,
  Maximize2,
  Minimize2,
  Monitor,
  Moon,
  Pause,
  PenTool,
  Play,
  Presentation,
  Radio,
  RotateCcw,
  ScrollText,
  Search,
  Snowflake,
  Square,
  Sun,
  Trash2,
  X,
  ZoomOut,
} from 'lucide-react';
import {
  generatePixQrDataUrl,
  getPayPalDonateUrl,
  PAYPAL_EMAIL,
  PIX_KEY,
} from './pixDonate';
import {
  DeckTab,
  DualMode,
  FitMode,
  MonitorInfo,
  OutlineSection,
  SearchMatch,
  SessionData,
  Stroke,
  SyncPayload,
  ToolMode,
  ZoomRect,
} from './types';
import {
  parseNoteMd,
  parsePdfpcNotes,
  serializeNoteMd,
  splitNoteLines,
} from './notesUtils';
import {
  computePace,
  createEmptySession,
  formatClock,
} from './analyticsUtils';
import { MarkdownNotes } from './components/MarkdownNotes';
import { TeleprompterModal } from './components/TeleprompterModal';
import { AnalyticsModal } from './components/AnalyticsModal';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const NOTES_PREFIX = 'forjaslide_notes_v1_';
const SECTION_COLORS = ['#38bdf8', '#22c55e', '#f59e0b', '#a855f7', '#f43f5e', '#14b8a6'];
const INK_COLORS = [
  { id: '#f43f5e', label: 'Vermelho' },
  { id: '#38bdf8', label: 'Azul' },
  { id: '#22c55e', label: 'Verde' },
  { id: '#facc15', label: 'Amarelo' },
];

function distToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function toSlideCoords(
  nx: number,
  ny: number,
  zoomRect: ZoomRect | null
): { x: number; y: number } {
  if (!zoomRect) return { x: nx, y: ny };
  const [x0, y0, x1, y1] = zoomRect;
  return {
    x: x0 + nx * (x1 - x0),
    y: y0 + ny * (y1 - y0),
  };
}

function toViewCoords(
  sx: number,
  sy: number,
  zoomRect: ZoomRect | null
): { x: number; y: number } {
  if (!zoomRect) return { x: sx, y: sy };
  const [x0, y0, x1, y1] = zoomRect;
  return {
    x: (sx - x0) / Math.max(0.001, x1 - x0),
    y: (sy - y0) / Math.max(0.001, y1 - y0),
  };
}

function computeZoomRect(
  current: ZoomRect | null,
  factor: number,
  anchorX: number,
  anchorY: number
): ZoomRect | null {
  const [x0, y0, x1, y1] = current ?? [0, 0, 1, 1];
  const curSize = x1 - x0;
  const nextSize = Math.max(0.18, Math.min(1, curSize / factor));
  if (nextSize >= 0.995) return null;

  const slideAx = x0 + anchorX * curSize;
  const slideAy = y0 + anchorY * (y1 - y0);

  let nx0 = slideAx - anchorX * nextSize;
  let ny0 = slideAy - anchorY * nextSize;
  nx0 = Math.max(0, Math.min(1 - nextSize, nx0));
  ny0 = Math.max(0, Math.min(1 - nextSize, ny0));
  return [nx0, ny0, nx0 + nextSize, ny0 + nextSize];
}

async function extractPdfOutline(doc: pdfjsLib.PDFDocumentProxy): Promise<OutlineSection[]> {
  try {
    const raw = await doc.getOutline();
    if (!raw || raw.length === 0) return [];
    const sections: OutlineSection[] = [];
    for (let i = 0; i < raw.length; i++) {
      const item = raw[i];
      let page = 1;
      try {
        let dest = item.dest;
        if (typeof dest === 'string') {
          dest = await doc.getDestination(dest);
        }
        if (Array.isArray(dest) && dest[0]) {
          const idx = await doc.getPageIndex(dest[0] as Parameters<typeof doc.getPageIndex>[0]);
          page = idx + 1;
        }
      } catch {
        // fallback to page 1
      }
      sections.push({
        title: item.title || `Seção ${i + 1}`,
        page,
        color: SECTION_COLORS[i % SECTION_COLORS.length],
      });
    }
    return sections.sort((a, b) => a.page - b.page);
  } catch {
    return [];
  }
}

async function renderPdfSlice(
  doc: pdfjsLib.PDFDocumentProxy,
  pageNum: number,
  canvas: HTMLCanvasElement,
  baseScale: number,
  slice: 'full' | 'left' | 'right',
  zoomRect: ZoomRect | null = null
): Promise<{ isWideBeamer: boolean }> {
  const page = await doc.getPage(pageNum);
  const zoomBoost = zoomRect ? Math.min(2.8, 1 / Math.max(0.18, zoomRect[2] - zoomRect[0])) : 1;
  const vp = page.getViewport({ scale: baseScale * zoomBoost });
  const isWideBeamer = vp.width / vp.height > 2.2;

  const off = document.createElement('canvas');
  off.width = Math.max(1, Math.floor(vp.width));
  off.height = Math.max(1, Math.floor(vp.height));
  const offCtx = off.getContext('2d');
  if (!offCtx) return { isWideBeamer };

  await page.render({ canvasContext: offCtx, viewport: vp, canvas: off }).promise;

  const ctx = canvas.getContext('2d');
  if (!ctx) return { isWideBeamer };

  const sliceW = slice === 'full' ? off.width : Math.floor(off.width / 2);
  const sliceX = slice === 'right' ? sliceW : 0;
  const sliceH = off.height;

  if (!zoomRect) {
    canvas.width = sliceW;
    canvas.height = sliceH;
    ctx.drawImage(off, sliceX, 0, sliceW, sliceH, 0, 0, sliceW, sliceH);
  } else {
    const [x0, y0, x1, y1] = zoomRect;
    const sx = sliceX + x0 * sliceW;
    const sy = y0 * sliceH;
    const sw = Math.max(1, (x1 - x0) * sliceW);
    const sh = Math.max(1, (y1 - y0) * sliceH);
    canvas.width = Math.max(1, Math.floor(sw));
    canvas.height = Math.max(1, Math.floor(sh));
    ctx.drawImage(off, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  }

  return { isWideBeamer };
}

export default function App() {
  const isAudience = useMemo(
    () => new URLSearchParams(window.location.search).get('view') === 'audience',
    []
  );

  const [themeMode, setThemeMode] = useState<'dark' | 'light'>('dark');

  // Audience-only state
  const [audPdfDoc, setAudPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [audPdfPath, setAudPdfPath] = useState<string | null>(null);
  const [audPage, setAudPage] = useState(1);
  const [audDualMode, setAudDualMode] = useState<DualMode>('auto');
  const [audFitMode, setAudFitMode] = useState<FitMode>('fit');
  const [audZoomRect, setAudZoomRect] = useState<ZoomRect | null>(null);
  const [audBlack, setAudBlack] = useState(false);
  const [audWhite, setAudWhite] = useState(false);
  const [audLaser, setAudLaser] = useState<{ x: number; y: number } | null>(null);
  const [audStrokes, setAudStrokes] = useState<Stroke[]>([]);

  // Presenter multi-tab state
  const [tabs, setTabs] = useState<DeckTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const pdfDocsRef = useRef<Record<string, pdfjsLib.PDFDocumentProxy>>({});
  const textCacheRef = useRef<Record<string, Record<number, string>>>({});

  // Presenter shared controls
  const [monitors, setMonitors] = useState<MonitorInfo[]>([]);
  const [selectedMonitor, setSelectedMonitor] = useState<number>(0);
  const [audienceActive, setAudienceActive] = useState(false);
  const [fitMode, setFitMode] = useState<FitMode>('fit');
  const [isFrozen, setIsFrozen] = useState(false);
  const [frozenPage, setFrozenPage] = useState<number | null>(null);
  const [zoomRect, setZoomRect] = useState<ZoomRect | null>(null);

  const [blackScreen, setBlackScreen] = useState(false);
  const [whiteScreen, setWhiteScreen] = useState(false);
  const [tool, setTool] = useState<ToolMode>('laser');
  const [inkColor, setInkColor] = useState<string>(INK_COLORS[0].id);
  const [laserPos, setLaserPos] = useState<{ x: number; y: number } | null>(null);
  const drawingRef = useRef(false);
  const panningRef = useRef<{ lastX: number; lastY: number } | null>(null);

  const [timerRunning, setTimerRunning] = useState(false);
  const [showThumbs, setShowThumbs] = useState(true);
  const [largeSlide, setLargeSlide] = useState(false);

  // Notes & Reading Guide & Teleprompter
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesFontSize, setNotesFontSize] = useState(14);
  const [guideLine, setGuideLine] = useState<number | null>(0);
  const [notesSavedTag, setNotesSavedTag] = useState<string | null>(null);
  const [teleprompterOpen, setTeleprompterOpen] = useState(false);

  // Search & Analytics & Donate
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);

  const [donateOpen, setDonateOpen] = useState(false);
  const [pixQrUrl, setPixQrUrl] = useState('');
  const [pixBrCode, setPixBrCode] = useState('');
  const [copyTag, setCopyTag] = useState<string | null>(null);

  const currentCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const nextCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const notesCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const audienceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId) ?? null,
    [tabs, activeTabId]
  );

  const activeDoc = activeTab ? pdfDocsRef.current[activeTab.id] ?? null : null;
  const isDualActive =
    activeTab !== null &&
    (activeTab.dualMode === 'right' || (activeTab.dualMode === 'auto' && activeTab.detectedWide));

  const updateActiveTab = useCallback(
    (updater: (tab: DeckTab) => DeckTab) => {
      if (!activeTabId) return;
      setTabs((prev) => prev.map((t) => (t.id === activeTabId ? updater(t) : t)));
    },
    [activeTabId]
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeMode);
  }, [themeMode]);

  const loadPdfIntoTab = useCallback(
    async (path: string) => {
      const existing = tabs.find((t) => t.pdfPath === path);
      if (existing) {
        setActiveTabId(existing.id);
        setZoomRect(null);
        return;
      }

      const bytes = await invoke<number[]>('read_pdf_bytes', { path });
      const data = new Uint8Array(bytes);
      const doc = await pdfjsLib.getDocument({ data }).promise;
      const name = path.split(/[\\/]/).pop() || path;
      const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      pdfDocsRef.current[id] = doc;

      // Load sidecar .note.md -> fallback .pdfpc -> fallback localStorage
      let customNotes: Record<number, string> = {};
      try {
        const md = await invoke<string | null>('load_sidecar_notes', { pdfPath: path });
        if (md) {
          customNotes = parseNoteMd(md);
        } else {
          const pdfpc = await invoke<string | null>('load_pdfpc_notes', { pdfPath: path });
          if (pdfpc) {
            customNotes = parsePdfpcNotes(pdfpc);
          } else {
            const saved = localStorage.getItem(`${NOTES_PREFIX}${name}`);
            if (saved) customNotes = JSON.parse(saved);
          }
        }
      } catch {
        customNotes = {};
      }

      // Load previous rehearsal session if present
      let prevSession: SessionData | null = null;
      try {
        const rawSess = await invoke<string | null>('load_session_analytics', { pdfPath: path });
        if (rawSess) prevSession = JSON.parse(rawSess) as SessionData;
      } catch {
        prevSession = null;
      }

      const outline = await extractPdfOutline(doc);
      const session = createEmptySession();
      session.visits[1] = 1;

      const newTab: DeckTab = {
        id,
        pdfPath: path,
        pdfName: name,
        numPages: doc.numPages,
        currentPage: 1,
        dualMode: 'auto',
        detectedWide: false,
        strokesByPage: {},
        bookmarks: [],
        customNotes,
        elapsedSec: 0,
        targetMinutes: 20,
        session,
        prevSession,
        outline,
      };

      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(id);
      setZoomRect(null);
      setIsFrozen(false);
      setFrozenPage(null);
      setGuideLine(0);
    },
    [tabs]
  );

  // Audience PDF loader
  const loadAudiencePdf = useCallback(async (path: string) => {
    const bytes = await invoke<number[]>('read_pdf_bytes', { path });
    const data = new Uint8Array(bytes);
    const doc = await pdfjsLib.getDocument({ data }).promise;
    setAudPdfDoc((prev) => {
      void prev?.destroy();
      return doc;
    });
    setAudPdfPath(path);
  }, []);

  // Presenter startup: monitors + hot-plug polling + CLI arg + Pix QR
  useEffect(() => {
    if (isAudience) return;

    const refreshMonitors = (isInitial: boolean) => {
      invoke<MonitorInfo[]>('list_monitors')
        .then((list) => {
          setMonitors((prev) => {
            if (!isInitial && list.length > prev.length && list.length > 1) {
              setSelectedMonitor(list.length - 1);
            } else if (isInitial && list.length > 1) {
              setSelectedMonitor(1);
            }
            return list;
          });
        })
        .catch(() => {});
    };

    refreshMonitors(true);
    const pollId = window.setInterval(() => refreshMonitors(false), 4000);

    invoke<string | null>('get_initial_pdf_arg')
      .then((arg) => {
        if (arg) void loadPdfIntoTab(arg);
      })
      .catch(() => {});

    generatePixQrDataUrl('DoacaoForjaSlide')
      .then(({ brCode, qrUrl }) => {
        setPixBrCode(brCode);
        setPixQrUrl(qrUrl);
      })
      .catch(() => {});

    return () => window.clearInterval(pollId);
  }, [isAudience]);

  // Timer & rehearsal session tick (1s)
  useEffect(() => {
    if (isAudience || !timerRunning || !activeTabId) return;
    const id = window.setInterval(() => {
      setTabs((prev) =>
        prev.map((t) => {
          if (t.id !== activeTabId) return t;
          const p = t.currentPage;
          return {
            ...t,
            elapsedSec: t.elapsedSec + 1,
            session: {
              ...t.session,
              totalSecs: t.session.totalSecs + 1,
              perFrame: {
                ...t.session.perFrame,
                [p]: (t.session.perFrame[p] || 0) + 1,
              },
            },
          };
        })
      );
    }, 1000);
    return () => window.clearInterval(id);
  }, [isAudience, timerRunning, activeTabId]);

  // Auto-save rehearsal session every 12s while running
  useEffect(() => {
    if (isAudience || !timerRunning || !activeTab) return;
    const id = window.setInterval(() => {
      invoke('save_session_analytics', {
        pdfPath: activeTab.pdfPath,
        json: JSON.stringify(activeTab.session),
      }).catch(() => {});
    }, 12000);
    return () => window.clearInterval(id);
  }, [isAudience, timerRunning, activeTab]);

  // Debounced auto-save .note.md when notes change
  useEffect(() => {
    if (isAudience || !activeTab) return;
    const timer = window.setTimeout(() => {
      const md = serializeNoteMd(activeTab.customNotes);
      invoke('save_sidecar_notes', { pdfPath: activeTab.pdfPath, content: md })
        .then(() => {
          setNotesSavedTag('Salvo em .note.md');
          window.setTimeout(() => setNotesSavedTag(null), 1800);
        })
        .catch(() => {});
      localStorage.setItem(
        `${NOTES_PREFIX}${activeTab.pdfName}`,
        JSON.stringify(activeTab.customNotes)
      );
    }, 700);
    return () => window.clearTimeout(timer);
  }, [isAudience, activeTab?.id, activeTab?.customNotes]);

  // Audience listener
  useEffect(() => {
    if (!isAudience) return;
    const unlistenPromise = listen<string>('slide-sync', async (ev) => {
      try {
        const payload = JSON.parse(ev.payload) as SyncPayload;
        setAudBlack(payload.blackScreen);
        setAudWhite(payload.whiteScreen);
        setAudFitMode(payload.fitMode);
        setAudDualMode(payload.dualMode);
        if (!payload.frozen) {
          setAudLaser(payload.laserPos);
          setAudStrokes(payload.strokes);
          setAudZoomRect(payload.zoomRect);
          setAudPage(payload.currentPage);
        }
        if (payload.pdfPath && payload.pdfPath !== audPdfPath) {
          await loadAudiencePdf(payload.pdfPath);
          setAudPage(payload.currentPage);
        }
      } catch {
        // ignore
      }
    });
    return () => {
      void unlistenPromise.then((fn) => fn());
    };
  }, [isAudience, audPdfPath, loadAudiencePdf]);

  // Sync Presenter -> Audience
  useEffect(() => {
    if (isAudience) return;
    const audTargetPage = isFrozen && frozenPage ? frozenPage : activeTab?.currentPage ?? 1;
    const currentStrokes = activeTab ? activeTab.strokesByPage[audTargetPage] ?? [] : [];
    const payload: SyncPayload = {
      pdfPath: activeTab?.pdfPath ?? null,
      currentPage: audTargetPage,
      dualMode: activeTab?.dualMode ?? 'auto',
      fitMode,
      frozen: isFrozen,
      zoomRect: isFrozen ? null : zoomRect,
      blackScreen,
      whiteScreen,
      laserPos: isFrozen ? null : laserPos,
      strokes: currentStrokes,
    };
    invoke('sync_slide_state', { stateJson: JSON.stringify(payload) }).catch(() => {});
  }, [
    isAudience,
    activeTab,
    fitMode,
    isFrozen,
    frozenPage,
    zoomRect,
    blackScreen,
    whiteScreen,
    laserPos,
    audienceActive,
  ]);

  // Render Presenter canvases
  useEffect(() => {
    if (
      isAudience ||
      !activeDoc ||
      !activeTab ||
      activeTab.currentPage < 1 ||
      activeTab.currentPage > activeDoc.numPages
    )
      return;

    let cancelled = false;
    (async () => {
      if (currentCanvasRef.current) {
        const page = await activeDoc.getPage(activeTab.currentPage);
        const vp = page.getViewport({ scale: 1 });
        const wide = vp.width / vp.height > 2.2;
        if (cancelled) return;
        if (wide !== activeTab.detectedWide) {
          updateActiveTab((t) => ({ ...t, detectedWide: wide }));
        }
        const useDual =
          activeTab.dualMode === 'right' || (activeTab.dualMode === 'auto' && wide);
        await renderPdfSlice(
          activeDoc,
          activeTab.currentPage,
          currentCanvasRef.current,
          1.7,
          useDual ? 'left' : 'full',
          zoomRect
        );
        if (useDual && notesCanvasRef.current) {
          await renderPdfSlice(
            activeDoc,
            activeTab.currentPage,
            notesCanvasRef.current,
            1.3,
            'right'
          );
        }
        if (nextCanvasRef.current) {
          if (activeTab.currentPage < activeDoc.numPages) {
            await renderPdfSlice(
              activeDoc,
              activeTab.currentPage + 1,
              nextCanvasRef.current,
              0.9,
              useDual ? 'left' : 'full'
            );
          } else {
            const ctx = nextCanvasRef.current.getContext('2d');
            if (ctx) {
              ctx.clearRect(0, 0, nextCanvasRef.current.width, nextCanvasRef.current.height);
            }
          }
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    isAudience,
    activeDoc,
    activeTab?.id,
    activeTab?.currentPage,
    activeTab?.dualMode,
    zoomRect,
  ]);

  // Render Audience canvas
  useEffect(() => {
    if (!isAudience || !audPdfDoc || audPage < 1 || audPage > audPdfDoc.numPages) return;
    let cancelled = false;
    (async () => {
      if (audienceCanvasRef.current) {
        const page = await audPdfDoc.getPage(audPage);
        const vp = page.getViewport({ scale: 1 });
        const wide = vp.width / vp.height > 2.2;
        if (cancelled) return;
        const useDual = audDualMode === 'right' || (audDualMode === 'auto' && wide);
        await renderPdfSlice(
          audPdfDoc,
          audPage,
          audienceCanvasRef.current,
          2.2,
          useDual ? 'left' : 'full',
          audZoomRect
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAudience, audPdfDoc, audPage, audDualMode, audZoomRect]);

  const goPage = useCallback(
    (next: number) => {
      if (!activeTab) return;
      const clamped = Math.max(1, Math.min(activeTab.numPages, next));
      if (clamped !== activeTab.currentPage) {
        setZoomRect(null);
        setGuideLine(0);
        updateActiveTab((t) => ({
          ...t,
          currentPage: clamped,
          session: {
            ...t.session,
            visits: {
              ...t.session.visits,
              [clamped]: (t.session.visits[clamped] || 0) + 1,
            },
          },
        }));
      }
    },
    [activeTab, updateActiveTab]
  );

  const toggleFreeze = useCallback(() => {
    setIsFrozen((prev) => {
      if (!prev) {
        setFrozenPage(activeTab?.currentPage ?? 1);
        return true;
      }
      setFrozenPage(null);
      return false;
    });
  }, [activeTab?.currentPage]);

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

  const toggleBookmark = useCallback(() => {
    if (!activeTab) return;
    const p = activeTab.currentPage;
    updateActiveTab((t) => {
      const exists = t.bookmarks.includes(p);
      return {
        ...t,
        bookmarks: exists ? t.bookmarks.filter((b) => b !== p) : [...t.bookmarks, p],
      };
    });
  }, [activeTab, updateActiveTab]);

  const toggleQuestionFlag = useCallback(() => {
    if (!activeTab) return;
    const p = activeTab.currentPage;
    updateActiveTab((t) => {
      const exists = t.session.questions.includes(p);
      return {
        ...t,
        session: {
          ...t.session,
          questions: exists
            ? t.session.questions.filter((q) => q !== p)
            : [...t.session.questions, p],
        },
      };
    });
  }, [activeTab, updateActiveTab]);

  const runSearch = useCallback(
    async (query: string) => {
      setSearchQuery(query);
      const q = query.trim().toLowerCase();
      if (!q || !activeDoc || !activeTab) {
        setSearchResults([]);
        return;
      }
      setSearching(true);
      try {
        let cache = textCacheRef.current[activeTab.id];
        if (!cache) {
          cache = {};
          for (let p = 1; p <= activeDoc.numPages; p++) {
            const page = await activeDoc.getPage(p);
            const tc = await page.getTextContent();
            cache[p] = tc.items
              .map((it) => ('str' in it ? it.str : ''))
              .join(' ')
              .replace(/\s+/g, ' ');
          }
          textCacheRef.current[activeTab.id] = cache;
        }
        const matches: SearchMatch[] = [];
        for (let p = 1; p <= activeDoc.numPages; p++) {
          const txt = cache[p] || '';
          const idx = txt.toLowerCase().indexOf(q);
          if (idx !== -1) {
            const start = Math.max(0, idx - 28);
            const end = Math.min(txt.length, idx + q.length + 45);
            matches.push({ page: p, snippet: txt.slice(start, end) });
          }
        }
        setSearchResults(matches);
      } finally {
        setSearching(false);
      }
    },
    [activeDoc, activeTab]
  );

  // Keyboard shortcuts
  useEffect(() => {
    if (isAudience) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setSearchOpen((v) => !v);
        setTimeout(() => searchInputRef.current?.focus(), 40);
        return;
      }
      if (teleprompterOpen) return;

      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT') {
        if (e.key === 'Escape') {
          (e.target as HTMLElement).blur();
          setEditingNotes(false);
          setSearchOpen(false);
        }
        return;
      }

      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown' || e.key === 'Enter') {
        e.preventDefault();
        if (activeTab) goPage(activeTab.currentPage + 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp' || e.key === 'Backspace') {
        e.preventDefault();
        if (activeTab) goPage(activeTab.currentPage - 1);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const lines = splitNoteLines(activeTab?.customNotes[activeTab.currentPage] || '');
        if (lines.length > 0) {
          setGuideLine((g) => Math.min(lines.length - 1, (g ?? -1) + 1));
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setGuideLine((g) => Math.max(0, (g ?? 1) - 1));
      } else if (e.key === 'Home') {
        e.preventDefault();
        goPage(1);
      } else if (e.key === 'End') {
        e.preventDefault();
        if (activeTab) goPage(activeTab.numPages);
      } else if (e.key === 'F5') {
        e.preventDefault();
        void toggleAudience();
      } else if (e.key === 'Escape') {
        if (searchOpen) {
          setSearchOpen(false);
        } else if (blackScreen || whiteScreen) {
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
      } else if (e.key.toLowerCase() === 'f') {
        toggleFreeze();
      } else if (e.key.toLowerCase() === 'l') {
        setTool((t) => (t === 'laser' ? 'none' : 'laser'));
      } else if (e.key.toLowerCase() === 'p') {
        setTool((t) => (t === 'pen' ? 'none' : 'pen'));
      } else if (e.key.toLowerCase() === 'h') {
        setTool((t) => (t === 'highlighter' ? 'none' : 'highlighter'));
      } else if (e.key.toLowerCase() === 'e') {
        setTool((t) => (t === 'eraser' ? 'none' : 'eraser'));
      } else if (e.key.toLowerCase() === 'c') {
        if (activeTab) {
          updateActiveTab((t) => ({
            ...t,
            strokesByPage: { ...t.strokesByPage, [t.currentPage]: [] },
          }));
        }
      } else if (e.key.toLowerCase() === 'k') {
        if (activeTab) setTeleprompterOpen((v) => !v);
      } else if (e.key.toLowerCase() === 'n') {
        setLargeSlide((v) => !v);
      } else if (e.key.toLowerCase() === 'm') {
        toggleBookmark();
      } else if (e.key.toLowerCase() === 'q') {
        toggleQuestionFlag();
      } else if (e.key.toLowerCase() === 'r') {
        updateActiveTab((t) => ({ ...t, elapsedSec: 0 }));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    isAudience,
    teleprompterOpen,
    activeTab,
    goPage,
    toggleAudience,
    toggleFreeze,
    toggleBookmark,
    toggleQuestionFlag,
    updateActiveTab,
    searchOpen,
    blackScreen,
    whiteScreen,
    audienceActive,
  ]);

  const handleOpenPdf = async () => {
    const selected = await open({
      filters: [{ name: 'Apresentação PDF', extensions: ['pdf'] }],
      multiple: false,
    });
    if (!selected || Array.isArray(selected)) return;
    await loadPdfIntoTab(selected);
  };

  const handleImportPdfpc = async () => {
    if (!activeTab) return;
    const selected = await open({
      filters: [{ name: 'Notas pdfpc / Markdown', extensions: ['pdfpc', 'md'] }],
      multiple: false,
    });
    if (!selected || Array.isArray(selected)) return;
    const content = await invoke<string>('read_text_file', { path: selected });
    const parsed = selected.toLowerCase().endsWith('.pdfpc')
      ? parsePdfpcNotes(content)
      : parseNoteMd(content);
    updateActiveTab((t) => ({ ...t, customNotes: { ...t.customNotes, ...parsed } }));
  };

  const eraseNear = useCallback(
    (sx: number, sy: number) => {
      if (!activeTab) return;
      const page = activeTab.currentPage;
      const list = activeTab.strokesByPage[page] || [];
      if (list.length === 0) return;
      const thresh = 0.025;
      const filtered = list.filter((st) => {
        for (let i = 0; i < st.points.length; i++) {
          const p = st.points[i];
          if (i === 0 && st.points.length === 1) {
            if (Math.hypot(sx - p.x, sy - p.y) < thresh) return false;
          } else if (i > 0) {
            const prev = st.points[i - 1];
            if (distToSegment(sx, sy, prev.x, prev.y, p.x, p.y) < thresh) return false;
          }
        }
        return true;
      });
      if (filtered.length !== list.length) {
        updateActiveTab((t) => ({
          ...t,
          strokesByPage: { ...t.strokesByPage, [page]: filtered },
        }));
      }
    },
    [activeTab, updateActiveTab]
  );

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!activeTab) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const ny = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    const { x, y } = toSlideCoords(nx, ny, zoomRect);

    if (tool === 'none' && zoomRect) {
      panningRef.current = { lastX: e.clientX, lastY: e.clientY };
      return;
    }

    if (tool === 'pen' || tool === 'highlighter') {
      drawingRef.current = true;
      const kind = tool;
      const newStroke: Stroke = {
        kind,
        color: inkColor,
        width: kind === 'highlighter' ? 18 : 4,
        points: [{ x, y }],
      };
      const page = activeTab.currentPage;
      updateActiveTab((t) => ({
        ...t,
        strokesByPage: {
          ...t.strokesByPage,
          [page]: [...(t.strokesByPage[page] || []), newStroke],
        },
        session: {
          ...t.session,
          inkStrokes: t.session.inkStrokes + 1,
        },
      }));
    } else if (tool === 'eraser') {
      drawingRef.current = true;
      eraseNear(x, y);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!activeTab) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const ny = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    const { x, y } = toSlideCoords(nx, ny, zoomRect);

    if (panningRef.current && zoomRect) {
      const dx = (e.clientX - panningRef.current.lastX) / rect.width;
      const dy = (e.clientY - panningRef.current.lastY) / rect.height;
      panningRef.current = { lastX: e.clientX, lastY: e.clientY };
      const size = zoomRect[2] - zoomRect[0];
      const nx0 = Math.max(0, Math.min(1 - size, zoomRect[0] - dx * size));
      const ny0 = Math.max(0, Math.min(1 - size, zoomRect[1] - dy * size));
      setZoomRect([nx0, ny0, nx0 + size, ny0 + size]);
      return;
    }

    if (tool === 'laser') {
      setLaserPos({ x, y });
    } else if ((tool === 'pen' || tool === 'highlighter') && drawingRef.current) {
      const page = activeTab.currentPage;
      updateActiveTab((t) => {
        const curList = t.strokesByPage[page] || [];
        if (curList.length === 0) return t;
        const copy = [...curList];
        const last = copy[copy.length - 1];
        copy[copy.length - 1] = { ...last, points: [...last.points, { x, y }] };
        return {
          ...t,
          strokesByPage: { ...t.strokesByPage, [page]: copy },
        };
      });
    } else if (tool === 'eraser' && drawingRef.current) {
      eraseNear(x, y);
    }
  };

  const handleCanvasWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!activeTab) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const ny = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    const factor = Math.exp(-e.deltaY * 0.0018);
    setZoomRect((prev) => computeZoomRect(prev, factor, nx, ny));
  };

  const closeTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const doc = pdfDocsRef.current[tabId];
    if (doc) {
      void doc.destroy();
      delete pdfDocsRef.current[tabId];
    }
    delete textCacheRef.current[tabId];
    setTabs((prev) => {
      const remaining = prev.filter((t) => t.id !== tabId);
      if (activeTabId === tabId) {
        setActiveTabId(remaining[0]?.id ?? null);
      }
      return remaining;
    });
  };

  // ==================== AUDIENCE WINDOW RENDER ====================
  if (isAudience) {
    const stackClass = `fs-canvas-stack aud-${audFitMode}`;
    return (
      <div className="fs-audience-root">
        {(audBlack || audWhite) && (
          <div
            className="fs-screen-curtain"
            style={{ background: audWhite ? '#ffffff' : '#000000' }}
          />
        )}
        <div className={stackClass}>
          <canvas ref={audienceCanvasRef} className="fs-slide-canvas" />
          <svg className="fs-overlay-svg" viewBox="0 0 1000 1000" preserveAspectRatio="none">
            {audStrokes.map((st, idx) => (
              <polyline
                key={idx}
                fill="none"
                stroke={st.color}
                strokeOpacity={st.kind === 'highlighter' ? 0.38 : 1}
                strokeWidth={st.width}
                strokeLinecap="round"
                strokeLinejoin="round"
                points={st.points
                  .map((p) => {
                    const v = toViewCoords(p.x, p.y, audZoomRect);
                    return `${v.x * 1000},${v.y * 1000}`;
                  })
                  .join(' ')}
              />
            ))}
            {audLaser &&
              (() => {
                const v = toViewCoords(audLaser.x, audLaser.y, audZoomRect);
                return (
                  <circle
                    cx={v.x * 1000}
                    cy={v.y * 1000}
                    r="10"
                    fill="#ef4444"
                    stroke="#ffffff"
                    strokeWidth="3"
                  />
                );
              })()}
          </svg>
        </div>
      </div>
    );
  }

  // ==================== PRESENTER WINDOW RENDER ====================
  const currentPage = activeTab?.currentPage ?? 0;
  const numPages = activeTab?.numPages ?? 0;
  const elapsedSec = activeTab?.elapsedSec ?? 0;
  const targetMinutes = activeTab?.targetMinutes ?? 20;
  const currentStrokes = activeTab ? activeTab.strokesByPage[currentPage] ?? [] : [];
  const targetSec = targetMinutes * 60;
  const timerClass =
    elapsedSec >= targetSec
      ? 'fs-timer-val over'
      : elapsedSec >= targetSec * 0.85
      ? 'fs-timer-val warn'
      : 'fs-timer-val';

  const pace = activeTab
    ? computePace(elapsedSec, targetMinutes, currentPage, numPages)
    : null;

  const isBookmarked = activeTab ? activeTab.bookmarks.includes(currentPage) : false;
  const isQuestion = activeTab ? activeTab.session.questions.includes(currentPage) : false;

  return (
    <div className="fs-shell">
      <header className="fs-header">
        <div className="fs-brand">
          <img src="/logo.png" alt="ForjaSlide" className="fs-logo" />
          <div>
            <h1>ForjaSlide</h1>
            <span>
              {activeTab ? activeTab.pdfName : 'Nenhum PDF aberto'}{' '}
              {isDualActive ? '· Beamer 2ª Tela' : ''}
            </span>
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
            value={activeTab?.dualMode ?? 'auto'}
            onChange={(e) =>
              updateActiveTab((t) => ({ ...t, dualMode: e.target.value as DualMode }))
            }
            title="Modo de Notas Beamer (pgfpages)"
          >
            <option value="auto">Beamer: Auto</option>
            <option value="right">Beamer 2ª Tela</option>
            <option value="off">PDF Normal</option>
          </select>

          <select
            className="fs-select"
            value={fitMode}
            onChange={(e) => setFitMode(e.target.value as FitMode)}
            title="Escala na Tela do Público"
          >
            <option value="fit">Escala: Fit</option>
            <option value="fill">Escala: Fill</option>
            <option value="stretch">Escala: Stretch</option>
          </select>

          <button
            type="button"
            className={`fs-btn ${audienceActive ? 'danger' : 'primary'}`}
            onClick={toggleAudience}
            title="Abrir/Fechar Janela do Público (F5 / Esc)"
          >
            <Presentation size={14} /> {audienceActive ? 'Encerrar' : 'Apresentar (F5)'}
          </button>

          <button
            type="button"
            className={`fs-btn ${isFrozen ? 'active' : ''}`}
            onClick={toggleFreeze}
            title="Congelar Tela do Público (F)"
          >
            <Snowflake size={13} /> F
          </button>

          <button
            type="button"
            className={`fs-btn ${blackScreen ? 'active' : ''}`}
            onClick={() => {
              setWhiteScreen(false);
              setBlackScreen((v) => !v);
            }}
            title="Tela Preta (B)"
          >
            <Square size={12} fill="#000" /> B
          </button>
          <button
            type="button"
            className={`fs-btn ${whiteScreen ? 'active' : ''}`}
            onClick={() => {
              setBlackScreen(false);
              setWhiteScreen((v) => !v);
            }}
            title="Tela Branca (W)"
          >
            <Square size={12} fill="#fff" /> W
          </button>

          <button
            type="button"
            className={`fs-btn ${tool === 'laser' ? 'active' : ''}`}
            onClick={() => setTool((t) => (t === 'laser' ? 'none' : 'laser'))}
            title="Ponteiro Laser (L)"
          >
            <Radio size={14} />
          </button>
          <button
            type="button"
            className={`fs-btn ${tool === 'pen' ? 'active' : ''}`}
            onClick={() => setTool((t) => (t === 'pen' ? 'none' : 'pen'))}
            title="Caneta (P)"
          >
            <PenTool size={14} />
          </button>
          <button
            type="button"
            className={`fs-btn ${tool === 'highlighter' ? 'active' : ''}`}
            onClick={() => setTool((t) => (t === 'highlighter' ? 'none' : 'highlighter'))}
            title="Marca-texto (H)"
          >
            <Highlighter size={14} />
          </button>
          <button
            type="button"
            className={`fs-btn ${tool === 'eraser' ? 'active' : ''}`}
            onClick={() => setTool((t) => (t === 'eraser' ? 'none' : 'eraser'))}
            title="Borracha (E)"
          >
            <Eraser size={14} />
          </button>

          <div className="fs-color-dots" title="Cor da tinta">
            {INK_COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`fs-color-dot ${inkColor === c.id ? 'active' : ''}`}
                style={{ background: c.id }}
                onClick={() => setInkColor(c.id)}
                title={c.label}
              />
            ))}
          </div>

          <button
            type="button"
            className="fs-btn"
            onClick={() =>
              activeTab &&
              updateActiveTab((t) => ({
                ...t,
                strokesByPage: { ...t.strokesByPage, [t.currentPage]: [] },
              }))
            }
            title="Limpar tinta deste slide (C)"
          >
            <Trash2 size={14} />
          </button>

          <button
            type="button"
            className={`fs-btn ${teleprompterOpen ? 'active' : ''}`}
            disabled={!activeTab}
            onClick={() => setTeleprompterOpen(true)}
            title="Teleprompter (K)"
          >
            <ScrollText size={14} />
          </button>
          <button
            type="button"
            className={`fs-btn ${searchOpen ? 'active' : ''}`}
            disabled={!activeTab}
            onClick={() => {
              setSearchOpen((v) => !v);
              setTimeout(() => searchInputRef.current?.focus(), 40);
            }}
            title="Buscar no PDF (Ctrl+F)"
          >
            <Search size={14} />
          </button>
          <button
            type="button"
            className="fs-btn"
            disabled={!activeTab}
            onClick={() => setAnalyticsOpen(true)}
            title="Analytics do Ensaio"
          >
            <BarChart3 size={14} />
          </button>
          <button
            type="button"
            className={`fs-btn ${largeSlide ? 'active' : ''}`}
            onClick={() => setLargeSlide((v) => !v)}
            title="Expandir Slide Atual (N)"
          >
            {largeSlide ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>

          <button
            type="button"
            className="fs-btn"
            onClick={async () => {
              const isPt = (navigator.language || '').toLowerCase().startsWith('pt');
              const url = isPt ? '/manuals/manual-pt-BR.pdf' : '/manuals/manual-en-US.pdf';
              const fileName = isPt ? 'manual-forjaslide-pt-BR.pdf' : 'manual-forjaslide-en-US.pdf';
              try {
                const resp = await fetch(url);
                const buf = await resp.arrayBuffer();
                await invoke('open_manual_pdf', {
                  fileName,
                  bytes: Array.from(new Uint8Array(buf)),
                });
              } catch {
                window.open(url, '_blank');
              }
            }}
            title="Abrir Manual (PDF)"
          >
            Manual
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

      {/* Multi-presentation Tabs */}
      {tabs.length > 0 && (
        <div className="fs-tabs-bar">
          {tabs.map((t) => (
            <div
              key={t.id}
              className={`fs-tab ${t.id === activeTabId ? 'active' : ''}`}
              onClick={() => {
                setActiveTabId(t.id);
                setZoomRect(null);
              }}
            >
              <span className="fs-tab-name" title={t.pdfPath}>
                {t.pdfName} ({t.currentPage}/{t.numPages})
              </span>
              <button
                type="button"
                className="fs-tab-close"
                onClick={(e) => closeTab(t.id, e)}
                title="Fechar aba"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      <main className={`fs-main ${largeSlide ? 'large-slide' : ''}`}>
        {/* Left/Center: Current Slide */}
        <section className="fs-current-pane">
          <div className="fs-pane-head">
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              Slide Atual {numPages > 0 ? `(${currentPage} / ${numPages})` : ''}
              {isFrozen && (
                <span className="fs-badge-frozen">
                  <Snowflake size={10} /> CONGELADO (Slide {frozenPage})
                </span>
              )}
              {blackScreen && ' · [TELA PRETA]'}
              {whiteScreen && ' · [TELA BRANCA]'}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {zoomRect && (
                <button
                  type="button"
                  className="fs-btn"
                  style={{ padding: '2px 7px', fontSize: 10 }}
                  onClick={() => setZoomRect(null)}
                >
                  <ZoomOut size={12} /> Resetar Zoom
                </button>
              )}
              {activeTab && (
                <>
                  <button
                    type="button"
                    className={`fs-btn ${isBookmarked ? 'active' : ''}`}
                    style={{ padding: '2px 7px', fontSize: 10 }}
                    onClick={toggleBookmark}
                    title="Marcar Favorito (M)"
                  >
                    <Bookmark size={12} />
                  </button>
                  <button
                    type="button"
                    className={`fs-btn ${isQuestion ? 'active' : ''}`}
                    style={{ padding: '2px 7px', fontSize: 10 }}
                    onClick={toggleQuestionFlag}
                    title="Marcar Dúvida no Slide (Q)"
                  >
                    <HelpCircle size={12} />
                  </button>
                </>
              )}
            </span>
          </div>

          {searchOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div className="fs-search-bar">
                <Search size={14} color="var(--muted)" />
                <input
                  ref={searchInputRef}
                  className="fs-search-input"
                  placeholder="Buscar texto no PDF..."
                  value={searchQuery}
                  onChange={(e) => void runSearch(e.target.value)}
                />
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                  {searching ? 'Buscando...' : `${searchResults.length} resultado(s)`}
                </span>
                <button type="button" className="fs-btn" onClick={() => setSearchOpen(false)}>
                  <X size={12} />
                </button>
              </div>
              {searchResults.length > 0 && (
                <div className="fs-search-results">
                  {searchResults.map((m, idx) => (
                    <button
                      key={`${m.page}_${idx}`}
                      type="button"
                      className="fs-search-item"
                      onClick={() => goPage(m.page)}
                    >
                      <strong style={{ color: 'var(--accent)' }}>Slide {m.page}</strong>
                      <span style={{ color: 'var(--muted)' }}>...{m.snippet}...</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="fs-canvas-box">
            {!activeTab ? (
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
                style={{
                  cursor:
                    tool === 'laser'
                      ? 'crosshair'
                      : tool === 'pen' || tool === 'highlighter'
                      ? 'cell'
                      : tool === 'eraser'
                      ? 'not-allowed'
                      : zoomRect
                      ? 'grab'
                      : 'default',
                }}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={() => {
                  drawingRef.current = false;
                  panningRef.current = null;
                }}
                onMouseLeave={() => {
                  drawingRef.current = false;
                  panningRef.current = null;
                  setLaserPos(null);
                }}
                onWheel={handleCanvasWheel}
                onDoubleClick={() => setZoomRect(null)}
              >
                <canvas ref={currentCanvasRef} className="fs-slide-canvas" />
                <svg className="fs-overlay-svg" viewBox="0 0 1000 1000" preserveAspectRatio="none">
                  {currentStrokes.map((st, idx) => (
                    <polyline
                      key={idx}
                      fill="none"
                      stroke={st.color}
                      strokeOpacity={st.kind === 'highlighter' ? 0.38 : 1}
                      strokeWidth={st.width}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      points={st.points
                        .map((p) => {
                          const v = toViewCoords(p.x, p.y, zoomRect);
                          return `${v.x * 1000},${v.y * 1000}`;
                        })
                        .join(' ')}
                    />
                  ))}
                  {laserPos &&
                    (() => {
                      const v = toViewCoords(laserPos.x, laserPos.y, zoomRect);
                      return (
                        <circle
                          cx={v.x * 1000}
                          cy={v.y * 1000}
                          r="10"
                          fill="#ef4444"
                          stroke="#ffffff"
                          strokeWidth="3"
                        />
                      );
                    })()}
                </svg>
              </div>
            )}
          </div>

          <div className="fs-nav-row">
            <button
              type="button"
              className="fs-btn"
              disabled={!activeTab || currentPage <= 1}
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
              disabled={!activeTab || currentPage >= numPages}
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
              {pace && (
                <div className={`fs-pace-badge ${pace.status}`}>
                  {pace.label}
                  {pace.suggestedSkipSlides > 0
                    ? ` · pular ${pace.suggestedSkipSlides}`
                    : ''}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input
                type="number"
                min={1}
                max={180}
                value={targetMinutes}
                disabled={!activeTab}
                onChange={(e) =>
                  updateActiveTab((t) => ({
                    ...t,
                    targetMinutes: Math.max(1, Number(e.target.value)),
                  }))
                }
                style={{
                  width: 46,
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
                onClick={() => updateActiveTab((t) => ({ ...t, elapsedSec: 0 }))}
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
                {isDualActive ? 'Notas do Beamer' : 'Notas (.note.md)'}
                {notesSavedTag && (
                  <small style={{ color: '#22c55e', marginLeft: 6, textTransform: 'none' }}>
                    {notesSavedTag}
                  </small>
                )}
              </span>
              {!isDualActive && activeTab && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button
                    type="button"
                    className="fs-btn"
                    style={{ padding: '2px 5px', fontSize: 10 }}
                    onClick={() => setNotesFontSize((s) => Math.max(11, s - 1))}
                    title="Diminuir fonte"
                  >
                    A-
                  </button>
                  <button
                    type="button"
                    className="fs-btn"
                    style={{ padding: '2px 5px', fontSize: 10 }}
                    onClick={() => setNotesFontSize((s) => Math.min(26, s + 1))}
                    title="Aumentar fonte"
                  >
                    A+
                  </button>
                  {!editingNotes && (
                    <>
                      <button
                        type="button"
                        className="fs-btn"
                        style={{ padding: '2px 5px' }}
                        onClick={() => setGuideLine((g) => Math.max(0, (g ?? 1) - 1))}
                        title="Guia de Leitura: Linha Anterior (↑)"
                      >
                        <ChevronUp size={11} />
                      </button>
                      <button
                        type="button"
                        className="fs-btn"
                        style={{ padding: '2px 5px' }}
                        onClick={() => {
                          const lines = splitNoteLines(
                            activeTab.customNotes[currentPage] || ''
                          );
                          if (lines.length > 0) {
                            setGuideLine((g) => Math.min(lines.length - 1, (g ?? -1) + 1));
                          }
                        }}
                        title="Guia de Leitura: Próxima Linha (↓)"
                      >
                        <ChevronDown size={11} />
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    className="fs-btn"
                    style={{ padding: '2px 6px', fontSize: 10 }}
                    onClick={handleImportPdfpc}
                    title="Importar .pdfpc ou .note.md"
                  >
                    <FileText size={11} />
                  </button>
                  <button
                    type="button"
                    className={`fs-btn ${editingNotes ? 'active' : ''}`}
                    style={{ padding: '2px 6px', fontSize: 10 }}
                    onClick={() => setEditingNotes((v) => !v)}
                    title="Alternar Edição / Visualização Markdown"
                  >
                    <Edit3 size={11} />
                  </button>
                </span>
              )}
            </div>

            {isDualActive ? (
              <div className="fs-canvas-box" style={{ background: '#fff' }}>
                <canvas ref={notesCanvasRef} className="fs-slide-canvas" />
              </div>
            ) : (
              <div className="fs-notes-box">
                {editingNotes ? (
                  <textarea
                    className="fs-notes-textarea"
                    style={{ fontSize: notesFontSize }}
                    placeholder="Escreva notas em Markdown (# Título, **negrito**, - lista)..."
                    value={activeTab?.customNotes[currentPage] || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      updateActiveTab((t) => ({
                        ...t,
                        customNotes: { ...t.customNotes, [currentPage]: val },
                      }));
                    }}
                  />
                ) : (
                  <MarkdownNotes
                    text={activeTab?.customNotes[currentPage] || ''}
                    activeLine={guideLine}
                    fontSize={notesFontSize}
                    onSelectLine={(idx) => setGuideLine(idx)}
                  />
                )}
              </div>
            )}
          </div>
        </aside>
      </main>

      {/* Sections Bar from PDF Outline */}
      {activeTab && activeTab.outline.length > 0 && (
        <div className="fs-sections-bar">
          {activeTab.outline.map((sec, idx) => {
            const nextPage = activeTab.outline[idx + 1]?.page ?? numPages + 1;
            const span = Math.max(1, nextPage - sec.page);
            const isActive = currentPage >= sec.page && currentPage < nextPage;
            return (
              <button
                key={`${sec.title}_${idx}`}
                type="button"
                className={`fs-section-seg ${isActive ? 'active' : ''}`}
                style={{ flex: span, borderTopColor: sec.color }}
                onClick={() => goPage(sec.page)}
                title={`${sec.title} (Slide ${sec.page})`}
              >
                {sec.title}
              </button>
            );
          })}
        </div>
      )}

      {/* Bottom Slides Strip */}
      {showThumbs && numPages > 0 && activeTab && (
        <div className="fs-thumbs-bar">
          {Array.from({ length: numPages }, (_, i) => i + 1).map((p) => {
            const bm = activeTab.bookmarks.includes(p);
            const qm = activeTab.session.questions.includes(p);
            const hasInk = (activeTab.strokesByPage[p]?.length ?? 0) > 0;
            return (
              <button
                key={p}
                type="button"
                className={`fs-thumb-item ${p === currentPage ? 'active' : ''}`}
                onClick={() => goPage(p)}
              >
                <span>
                  Slide {p}
                  {bm ? ' ★' : ''}
                  {qm ? ' ❓' : ''}
                  {hasInk ? ' ✎' : ''}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {activeTab && (
        <>
          <TeleprompterModal
            open={teleprompterOpen}
            numPages={numPages}
            currentPage={currentPage}
            notes={activeTab.customNotes}
            onGoPage={goPage}
            onClose={() => setTeleprompterOpen(false)}
          />
          <AnalyticsModal
            open={analyticsOpen}
            numPages={numPages}
            targetMinutes={targetMinutes}
            session={activeTab.session}
            prevSession={activeTab.prevSession}
            onGoPage={goPage}
            onClose={() => setAnalyticsOpen(false)}
          />
        </>
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
