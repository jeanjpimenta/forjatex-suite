import React, { useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { open as openExternal } from '@tauri-apps/plugin-shell';
import {
  ArrowDown,
  ArrowUp,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  ExternalLink,
  FolderOpen,
  Heart,
  Layers,
  Moon,
  Plus,
  Presentation,
  Save,
  Sun,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  createDefaultBeamerSnapshot,
  generateBeamerLatex,
  parseBeamerLatexToSnapshot,
  THEME_COLORS,
  type BeamerAspect,
  type BeamerColorTheme,
  type BeamerProjectSnapshot,
  type BeamerSlide,
  type BeamerTheme,
  type SlideLayout,
} from './beamerEngine';
import {
  generatePixQrDataUrl,
  getPayPalDonateUrl,
  PAYPAL_EMAIL,
  PIX_KEY,
} from './pixDonate';

interface ProjectTab {
  id: string;
  title: string;
  filePath: string | null;
  dirty: boolean;
  snapshot: BeamerProjectSnapshot;
}

const WORKSPACE_KEY = 'forjabeam_workspace_v1';
const THEMES: BeamerTheme[] = ['Madrid', 'Boadilla', 'Berlin', 'Warsaw', 'Singapore', 'metropolis'];
const COLOR_THEMES: Array<{ id: BeamerColorTheme; label: string }> = [
  { id: 'dolphin', label: 'Dolphin (Azul)' },
  { id: 'default', label: 'Default (Marinho)' },
  { id: 'beaver', label: 'Beaver (Carmim)' },
  { id: 'seahorse', label: 'Seahorse (Índigo)' },
  { id: 'crane', label: 'Crane (Âmbar)' },
];

const LAYOUT_LABELS: Record<SlideLayout, string> = {
  title: 'Capa',
  toc: 'Sumário',
  single: 'Conteúdo',
  'two-col': '2 Colunas',
  blocks: 'Blocos',
  code: 'Código',
};

function loadInitialWorkspace(): { tabs: ProjectTab[]; activeTabId: string } {
  try {
    const raw = localStorage.getItem(WORKSPACE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { tabs?: ProjectTab[]; activeTabId?: string };
      if (Array.isArray(parsed.tabs) && parsed.tabs.length > 0) {
        const def = createDefaultBeamerSnapshot();
        const normalized = parsed.tabs.map((tb, idx) => ({
          id: tb.id || `beam-${idx + 1}`,
          title: tb.title || `Apresentação ${idx + 1}`,
          filePath: tb.filePath ?? null,
          dirty: Boolean(tb.dirty),
          snapshot: { ...def, ...(tb.snapshot || {}) },
        }));
        const activeId = normalized.find((tb) => tb.id === parsed.activeTabId)?.id || normalized[0].id;
        return { tabs: normalized, activeTabId: activeId };
      }
    }
  } catch {
    // ignore storage errors
  }
  const first: ProjectTab = {
    id: `beam-${Date.now()}`,
    title: 'Apresentação 1',
    filePath: null,
    dirty: false,
    snapshot: createDefaultBeamerSnapshot(),
  };
  return { tabs: [first], activeTabId: first.id };
}

export default function App() {
  const initialWs = useMemo(() => loadInitialWorkspace(), []);
  const [tabs, setTabs] = useState<ProjectTab[]>(initialWs.tabs);
  const [activeTabId, setActiveTabId] = useState<string>(initialWs.activeTabId);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTabTitle, setEditingTabTitle] = useState('');

  const [themeMode, setThemeMode] = useState<'dark' | 'light'>('dark');
  const [statusMsg, setStatusMsg] = useState('');
  const [statusPdfPath, setStatusPdfPath] = useState<string | null>(null);
  const [donateOpen, setDonateOpen] = useState(false);
  const [pixQrUrl, setPixQrUrl] = useState('');
  const [pixBrCode, setPixBrCode] = useState('');
  const [copyTag, setCopyTag] = useState<string | null>(null);

  const [sidebarWidth, setSidebarWidth] = useState<number>(350);
  const [codeWidth, setCodeWidth] = useState<number>(360);
  const [openSec, setOpenSec] = useState<Record<string, boolean>>({
    theme: true,
    meta: false,
    slides: true,
    editor: true,
  });

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
  const snap = activeTab.snapshot;
  const activeSlide = snap.slides.find((s) => s.id === snap.selectedSlideId) || snap.slides[0];
  const activeSlideIdx = snap.slides.findIndex((s) => s.id === activeSlide?.id);

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeMode);
  }, [themeMode]);

  React.useEffect(() => {
    try {
      localStorage.setItem(WORKSPACE_KEY, JSON.stringify({ activeTabId, tabs }));
    } catch {
      // ignore
    }
  }, [activeTabId, tabs]);

  React.useEffect(() => {
    generatePixQrDataUrl('DoacaoForjaBeam')
      .then(({ brCode, qrUrl }) => {
        setPixBrCode(brCode);
        setPixQrUrl(qrUrl);
      })
      .catch(() => {});
  }, []);

  const updateSnap = (updater: (prev: BeamerProjectSnapshot) => BeamerProjectSnapshot) => {
    editSourceRef.current = 'visual';
    setTabs((prev) =>
      prev.map((tb) =>
        tb.id === activeTabId
          ? { ...tb, dirty: true, snapshot: updater(tb.snapshot) }
          : tb
      )
    );
  };

  const updateActiveSlide = (patch: Partial<BeamerSlide>) => {
    if (!activeSlide) return;
    updateSnap((prev) => ({
      ...prev,
      slides: prev.slides.map((s) => (s.id === activeSlide.id ? { ...s, ...patch } : s)),
    }));
  };

  const addSlide = (layout: SlideLayout) => {
    const id = `s-${Date.now().toString().slice(-5)}`;
    const newSlide: BeamerSlide = {
      id,
      layout,
      title:
        layout === 'title'
          ? 'Capa'
          : layout === 'toc'
          ? 'Roteiro'
          : layout === 'code'
          ? 'Exemplo de Código'
          : layout === 'two-col'
          ? 'Comparação em 2 Colunas'
          : layout === 'blocks'
          ? 'Teorema / Destaque'
          : `Slide ${snap.slides.length + 1}`,
      subtitle: '',
      body:
        layout === 'code'
          ? 'def f(x):\n    return x**2 + 1'
          : layout === 'blocks'
          ? 'Enunciado ou conclusão principal do slide.'
          : '- Primeiro ponto chave\n- Segundo ponto chave',
      rightBody:
        layout === 'two-col'
          ? '- Elemento da direita\n- Figura ou equação $E = mc^2$'
          : '',
      leftRatio: 50,
      incremental: false,
      blockType: 'block',
      blockTitle: 'Definição',
      codeLang: 'python',
      notes: '',
    };
    updateSnap((prev) => ({
      ...prev,
      slides: [...prev.slides, newSlide],
      selectedSlideId: id,
    }));
  };

  const duplicateSlide = (slide: BeamerSlide) => {
    const id = `s-${Date.now().toString().slice(-5)}`;
    const copy: BeamerSlide = { ...slide, id, title: `${slide.title} (Cópia)` };
    const idx = snap.slides.findIndex((s) => s.id === slide.id);
    updateSnap((prev) => {
      const next = [...prev.slides];
      next.splice(idx + 1, 0, copy);
      return { ...prev, slides: next, selectedSlideId: id };
    });
  };

  const moveSlide = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= snap.slides.length) return;
    updateSnap((prev) => {
      const next = [...prev.slides];
      const [moved] = next.splice(idx, 1);
      next.splice(target, 0, moved);
      return { ...prev, slides: next };
    });
  };

  const removeSlide = (id: string) => {
    if (snap.slides.length <= 1) return;
    updateSnap((prev) => {
      const remaining = prev.slides.filter((s) => s.id !== id);
      const nextSel =
        prev.selectedSlideId === id ? remaining[0]?.id || '' : prev.selectedSlideId;
      return { ...prev, slides: remaining, selectedSlideId: nextSel };
    });
  };

  const generatedLatex = useMemo(() => generateBeamerLatex(snap), [snap]);
  const [rawTex, setRawTex] = useState<string>(() => generateBeamerLatex(snap));
  const editSourceRef = useRef<'visual' | 'code'>('visual');
  const parseTimerRef = useRef<number | null>(null);

  React.useEffect(() => {
    if (editSourceRef.current === 'visual') {
      setRawTex(generatedLatex);
    }
    editSourceRef.current = 'visual';
  }, [generatedLatex, activeTabId]);

  const handleRawTexChange = (nextTex: string) => {
    editSourceRef.current = 'code';
    setRawTex(nextTex);
    if (parseTimerRef.current) window.clearTimeout(parseTimerRef.current);
    parseTimerRef.current = window.setTimeout(() => {
      editSourceRef.current = 'code';
      setTabs((prev) =>
        prev.map((tb) =>
          tb.id === activeTabId
            ? { ...tb, dirty: true, snapshot: parseBeamerLatexToSnapshot(nextTex, tb.snapshot) }
            : tb
        )
      );
    }, 260);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(rawTex);
    setStatusPdfPath(null);
    setStatusMsg('Código Beamer copiado para a área de transferência!');
  };

  const handleExportTex = async () => {
    const target = await save({
      filters: [{ name: 'LaTeX Beamer', extensions: ['tex'] }],
      defaultPath: 'apresentacao-beamer.tex',
    });
    if (!target) return;
    try {
      await invoke('save_text_file', { path: target, content: rawTex });
      setStatusPdfPath(null);
      setStatusMsg(`Arquivo .tex salvo em: ${target}`);
    } catch (e) {
      setStatusPdfPath(null);
      setStatusMsg(String(e));
    }
  };

  const handleCompilePdf = async () => {
    setStatusPdfPath(null);
    setStatusMsg('Compilando apresentação Beamer com pdflatex...');
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const fileStamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
    try {
      const res = await invoke<{ message: string; pdf_path: string }>('compile_beamer_pdf', {
        texFull: rawTex,
        fileStamp,
      });
      setStatusMsg(res.message);
      setStatusPdfPath(res.pdf_path);
    } catch (e) {
      setStatusPdfPath(null);
      setStatusMsg(String(e));
    }
  };

  const handleSaveProject = async () => {
    let targetPath = activeTab.filePath;
    if (!targetPath) {
      const safeTitle = activeTab.title.replace(/[^\w\-]+/g, '_').toLowerCase() || 'apresentacao';
      const chosen = await save({
        filters: [{ name: 'Projeto ForjaBeam', extensions: ['fbeam', 'json'] }],
        defaultPath: `${safeTitle}.fbeam`,
      });
      if (!chosen) return;
      targetPath = chosen;
    }
    const baseName = targetPath.split(/[\\/]/).pop()?.replace(/\.(fbeam|json)$/i, '') || activeTab.title;
    const payload = JSON.stringify(
      { app: 'ForjaBeam', formatVersion: 1, title: baseName, snapshot: snap },
      null,
      2
    );
    try {
      await invoke('save_text_file', { path: targetPath, content: payload });
      setTabs((prev) =>
        prev.map((tb) =>
          tb.id === activeTabId ? { ...tb, title: baseName, filePath: targetPath, dirty: false } : tb
        )
      );
      setStatusPdfPath(null);
      setStatusMsg(`Projeto salvo em: ${targetPath}`);
    } catch (e) {
      setStatusPdfPath(null);
      setStatusMsg(String(e));
    }
  };

  const handleOpenProject = async () => {
    const selected = await open({
      filters: [{ name: 'Projeto ForjaBeam', extensions: ['fbeam', 'json'] }],
      multiple: false,
    });
    if (!selected || Array.isArray(selected)) return;
    try {
      const raw = await invoke<string>('read_text_file', { path: selected });
      const parsed = JSON.parse(raw) as { title?: string; snapshot?: Partial<BeamerProjectSnapshot> };
      if (!parsed.snapshot) throw new Error('Arquivo .fbeam inválido.');
      const merged = { ...createDefaultBeamerSnapshot(), ...parsed.snapshot };
      const baseName =
        parsed.title || selected.split(/[\\/]/).pop()?.replace(/\.(fbeam|json)$/i, '') || 'Apresentação';
      const newTab: ProjectTab = {
        id: `beam-${Date.now()}`,
        title: baseName,
        filePath: selected,
        dirty: false,
        snapshot: merged,
      };
      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(newTab.id);
      setStatusPdfPath(null);
      setStatusMsg(`Projeto aberto: ${selected}`);
    } catch (e) {
      setStatusPdfPath(null);
      setStatusMsg(String(e));
    }
  };

  const createNewTab = () => {
    const newTab: ProjectTab = {
      id: `beam-${Date.now()}`,
      title: `Apresentação ${tabs.length + 1}`,
      filePath: null,
      dirty: false,
      snapshot: createDefaultBeamerSnapshot(),
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
  };

  const closeTab = (id: string) => {
    if (tabs.length === 1) {
      setTabs([
        {
          id: tabs[0].id,
          title: 'Apresentação 1',
          filePath: null,
          dirty: false,
          snapshot: createDefaultBeamerSnapshot(),
        },
      ]);
      return;
    }
    const idx = tabs.findIndex((tb) => tb.id === id);
    const remaining = tabs.filter((tb) => tb.id !== id);
    setTabs(remaining);
    if (id === activeTabId) {
      setActiveTabId((remaining[Math.max(0, idx - 1)] || remaining[0]).id);
    }
  };

  const startResize = (side: 'left' | 'right', e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = side === 'left' ? sidebarWidth : codeWidth;
    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      if (side === 'left') setSidebarWidth(Math.max(260, Math.min(540, startW + dx)));
      else setCodeWidth(Math.max(260, Math.min(580, startW - dx)));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const palette = THEME_COLORS[snap.colorTheme];
  const slideW = Math.round((snap.aspect === '169' ? 640 : 540) * snap.zoom);
  const slideH = Math.round((snap.aspect === '169' ? 360 : 405) * snap.zoom);

  return (
    <div className="fb-shell">
      <header className="fb-header">
        <div className="fb-brand">
          <img src="/logo.png" alt="ForjaBeam" className="fb-logo" />
          <div>
            <h1>ForjaBeam</h1>
            <span>Construtor Visual de Apresentações Beamer</span>
          </div>
        </div>

        <div className="fb-actions">
          <button
            type="button"
            className="fb-btn"
            onClick={async () => {
              const isPt = (navigator.language || '').toLowerCase().startsWith('pt');
              const url = isPt ? '/manuals/manual-pt-BR.pdf' : '/manuals/manual-en-US.pdf';
              const fileName = isPt ? 'manual-forjabeam-pt-BR.pdf' : 'manual-forjabeam-en-US.pdf';
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
            title="Abrir Manual do Usuário (PDF)"
          >
            Manual (PDF)
          </button>
          <button type="button" className="fb-btn" onClick={handleCompilePdf}>
            <CheckCircle2 size={14} /> Compilar PDF
          </button>
          <button type="button" className="fb-btn" onClick={handleExportTex}>
            <Download size={14} /> Exportar .tex
          </button>
          <button type="button" className="fb-btn primary" onClick={handleCopy}>
            <Copy size={14} /> Copiar Código
          </button>
          <button type="button" className="fb-btn" onClick={() => setDonateOpen(true)}>
            <Heart size={14} color="#f43f5e" /> Apoiar
          </button>
          <button
            type="button"
            className="fb-btn"
            onClick={() => setThemeMode((m) => (m === 'dark' ? 'light' : 'dark'))}
          >
            {themeMode === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>
      </header>

      <div className="fb-tabbar">
        <div className="fb-tabbar-list">
          {tabs.map((tb) => (
            <div
              key={tb.id}
              className={`fb-proj-tab ${tb.id === activeTabId ? 'active' : ''}`}
              onClick={() => setActiveTabId(tb.id)}
              onDoubleClick={() => {
                setEditingTabId(tb.id);
                setEditingTabTitle(tb.title);
              }}
              title="Clique duplo para renomear"
            >
              <span className="fb-proj-badge">{tb.snapshot.theme}</span>
              {editingTabId === tb.id ? (
                <input
                  autoFocus
                  style={{ width: 110, height: 18, fontSize: 11 }}
                  value={editingTabTitle}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setEditingTabTitle(e.target.value)}
                  onBlur={() => {
                    const trimmed = editingTabTitle.trim();
                    if (trimmed) {
                      setTabs((prev) =>
                        prev.map((item) => (item.id === tb.id ? { ...item, title: trimmed } : item))
                      );
                    }
                    setEditingTabId(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    if (e.key === 'Escape') setEditingTabId(null);
                  }}
                />
              ) : (
                <span className="fb-proj-title">
                  {tb.title}
                  {tb.dirty ? ' •' : ''}
                </span>
              )}
              <button
                type="button"
                className="fb-proj-close"
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tb.id);
                }}
              >
                <X size={11} />
              </button>
            </div>
          ))}
          <button type="button" className="fb-mini-btn" onClick={createNewTab} title="Nova Apresentação">
            <Plus size={12} />
          </button>
        </div>

        <div className="fb-actions">
          <button type="button" className="fb-btn" onClick={handleOpenProject}>
            <FolderOpen size={13} /> Abrir Projeto
          </button>
          <button type="button" className="fb-btn" onClick={handleSaveProject}>
            <Save size={13} /> Salvar (.fbeam)
          </button>
        </div>
      </div>

      {statusMsg && (
        <div className="fb-status">
          <span>{statusMsg}</span>
          {statusPdfPath && (
            <div className="fb-status-actions">
              <button
                type="button"
                className="fb-status-link"
                onClick={() => invoke('open_file_path', { path: statusPdfPath })}
              >
                <ExternalLink size={12} /> Abrir PDF gerado
              </button>
              <button
                type="button"
                className="fb-status-link"
                onClick={() =>
                  invoke('launch_forjaslide_with_pdf', { pdfPath: statusPdfPath }).catch((e) =>
                    setStatusMsg(String(e))
                  )
                }
              >
                <Presentation size={12} /> Apresentar no ForjaSlide
              </button>
            </div>
          )}
        </div>
      )}

      <main
        className="fb-main"
        style={{ gridTemplateColumns: `${sidebarWidth}px 5px 1fr 5px ${codeWidth}px` }}
      >
        <aside className="fb-sidebar">
          {/* 1. Theme & Aspect */}
          <div className="fb-accordion">
            <button
              type="button"
              className="fb-acc-head"
              onClick={() => setOpenSec((p) => ({ ...p, theme: !p.theme }))}
            >
              <span>Tema Visual & Proporção</span>
              <span className="fb-acc-chevron">
                {openSec.theme ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </span>
            </button>
            {openSec.theme && (
              <div className="fb-acc-body">
                <div className="fb-theme-grid">
                  {THEMES.map((th) => (
                    <button
                      key={th}
                      type="button"
                      className={`fb-theme-card ${snap.theme === th ? 'active' : ''}`}
                      onClick={() => updateSnap((p) => ({ ...p, theme: th }))}
                    >
                      <div className="fb-theme-mini">
                        {th === 'Berlin' && (
                          <div style={{ height: 5, background: '#0f172a', display: 'flex', gap: 2, alignItems: 'center', padding: '0 3px' }}>
                            <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#38bdf8' }} />
                            <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#94a3b8' }} />
                          </div>
                        )}
                        {th === 'Warsaw' && (
                          <div style={{ height: 6, display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                            <div style={{ background: '#0f172a' }} />
                            <div style={{ background: palette.primary }} />
                          </div>
                        )}
                        <div
                          className="fb-theme-mini-bar"
                          style={{
                            background:
                              th === 'metropolis'
                                ? '#23373b'
                                : th === 'Singapore'
                                ? `linear-gradient(180deg, ${palette.primary}, #f8fafc)`
                                : palette.primary,
                            borderBottom: th === 'metropolis' ? '2px solid #eb811b' : 'none',
                          }}
                        />
                        <div style={{ flex: 1, padding: 3, fontSize: 6, color: '#334155' }}>Aa</div>
                        {(th === 'Madrid' || th === 'Boadilla' || th === 'Warsaw') && (
                          <div style={{ height: 4, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr' }}>
                            <div style={{ background: palette.primary, opacity: th === 'Boadilla' ? 0.35 : 0.9 }} />
                            <div style={{ background: palette.secondary, opacity: th === 'Boadilla' ? 0.2 : 0.7 }} />
                            <div style={{ background: palette.primary, opacity: th === 'Boadilla' ? 0.35 : 0.9 }} />
                          </div>
                        )}
                      </div>
                      <span>{th}</span>
                    </button>
                  ))}
                </div>
                <div className="fb-grid2">
                  <label className="fb-field">
                    Esquema de Cor
                    <select
                      value={snap.colorTheme}
                      onChange={(e) =>
                        updateSnap((p) => ({ ...p, colorTheme: e.target.value as BeamerColorTheme }))
                      }
                    >
                      {COLOR_THEMES.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="fb-field">
                    Proporção
                    <select
                      value={snap.aspect}
                      onChange={(e) =>
                        updateSnap((p) => ({ ...p, aspect: e.target.value as BeamerAspect }))
                      }
                    >
                      <option value="169">16:9 Widescreen</option>
                      <option value="43">4:3 Clássico</option>
                    </select>
                  </label>
                </div>
                <label className="fb-check">
                  <input
                    type="checkbox"
                    checked={snap.notesSecondScreen}
                    onChange={(e) =>
                      updateSnap((p) => ({ ...p, notesSecondScreen: e.target.checked }))
                    }
                  />
                  Notas em 2ª tela (compatível com ForjaSlide / pgfpages)
                </label>
              </div>
            )}
          </div>

          {/* 2. Presentation Metadata */}
          <div className="fb-accordion">
            <button
              type="button"
              className="fb-acc-head"
              onClick={() => setOpenSec((p) => ({ ...p, meta: !p.meta }))}
            >
              <span>Capa & Metadados</span>
              <span className="fb-acc-chevron">
                {openSec.meta ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </span>
            </button>
            {openSec.meta && (
              <div className="fb-acc-body">
                <label className="fb-field">
                  Título da Apresentação
                  <input
                    value={snap.docTitle}
                    onChange={(e) => updateSnap((p) => ({ ...p, docTitle: e.target.value }))}
                  />
                </label>
                <label className="fb-field">
                  Subtítulo
                  <input
                    value={snap.docSubtitle}
                    onChange={(e) => updateSnap((p) => ({ ...p, docSubtitle: e.target.value }))}
                  />
                </label>
                <div className="fb-grid2">
                  <label className="fb-field">
                    Autor
                    <input
                      value={snap.author}
                      onChange={(e) => updateSnap((p) => ({ ...p, author: e.target.value }))}
                    />
                  </label>
                  <label className="fb-field">
                    Instituição
                    <input
                      value={snap.institute}
                      onChange={(e) => updateSnap((p) => ({ ...p, institute: e.target.value }))}
                    />
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* 3. Slide Navigator */}
          <div className="fb-accordion">
            <button
              type="button"
              className="fb-acc-head"
              onClick={() => setOpenSec((p) => ({ ...p, slides: !p.slides }))}
            >
              <span>Slides ({snap.slides.length})</span>
              <span className="fb-acc-chevron">
                {openSec.slides ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </span>
            </button>
            {openSec.slides && (
              <div className="fb-acc-body">
                <div className="fb-chip-row">
                  {(['single', 'two-col', 'blocks', 'code', 'title', 'toc'] as SlideLayout[]).map(
                    (lay) => (
                      <button
                        key={lay}
                        type="button"
                        className="fb-chip"
                        onClick={() => addSlide(lay)}
                      >
                        + {LAYOUT_LABELS[lay]}
                      </button>
                    )
                  )}
                </div>
                <div className="fb-slide-list">
                  {snap.slides.map((s, idx) => (
                    <div
                      key={s.id}
                      className={`fb-slide-item ${s.id === activeSlide?.id ? 'active' : ''}`}
                      onClick={() => updateSnap((p) => ({ ...p, selectedSlideId: s.id }))}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <strong>{idx + 1}.</strong> {s.title || LAYOUT_LABELS[s.layout]}
                      </span>
                      <div className="fb-slide-actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="fb-mini-btn"
                          onClick={() => moveSlide(idx, -1)}
                          title="Subir"
                        >
                          <ArrowUp size={11} />
                        </button>
                        <button
                          type="button"
                          className="fb-mini-btn"
                          onClick={() => moveSlide(idx, 1)}
                          title="Descer"
                        >
                          <ArrowDown size={11} />
                        </button>
                        <button
                          type="button"
                          className="fb-mini-btn"
                          onClick={() => duplicateSlide(s)}
                          title="Duplicar"
                        >
                          <Layers size={11} />
                        </button>
                        <button
                          type="button"
                          className="fb-mini-btn"
                          onClick={() => removeSlide(s.id)}
                          title="Remover"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 4. Active Slide Editor */}
          {activeSlide && (
            <div className="fb-accordion">
              <button
                type="button"
                className="fb-acc-head"
                onClick={() => setOpenSec((p) => ({ ...p, editor: !p.editor }))}
              >
                <span>Editar Slide {activeSlideIdx + 1}</span>
                <span className="fb-acc-chevron">
                  {openSec.editor ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </span>
              </button>
              {openSec.editor && (
                <div className="fb-acc-body">
                  <div className="fb-grid2">
                    <label className="fb-field">
                      Layout
                      <select
                        value={activeSlide.layout}
                        onChange={(e) =>
                          updateActiveSlide({ layout: e.target.value as SlideLayout })
                        }
                      >
                        {(Object.keys(LAYOUT_LABELS) as SlideLayout[]).map((k) => (
                          <option key={k} value={k}>
                            {LAYOUT_LABELS[k]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="fb-field">
                      Título do Slide
                      <input
                        value={activeSlide.title}
                        onChange={(e) => updateActiveSlide({ title: e.target.value })}
                      />
                    </label>
                  </div>

                  {activeSlide.layout !== 'title' && activeSlide.layout !== 'toc' && (
                    <>
                      <label className="fb-check">
                        <input
                          type="checkbox"
                          checked={activeSlide.incremental}
                          onChange={(e) => updateActiveSlide({ incremental: e.target.checked })}
                        />
                        Revelar tópicos passo a passo ([&lt;+-&gt;])
                      </label>

                      <div className="fb-chip-row">
                        <button
                          type="button"
                          className="fb-chip"
                          onClick={() =>
                            updateActiveSlide({
                              body: `${activeSlide.body}\n- \\pause Novo tópico`,
                            })
                          }
                        >
                          + \pause
                        </button>
                        <button
                          type="button"
                          className="fb-chip"
                          onClick={() =>
                            updateActiveSlide({
                              body: `${activeSlide.body}\n\\begin{equation}\n  E = mc^2\n\\end{equation}`,
                            })
                          }
                        >
                          + Equação
                        </button>
                        <button
                          type="button"
                          className="fb-chip"
                          onClick={() =>
                            updateActiveSlide({
                              rightBody:
                                '\\begin{tikzpicture}[scale=0.7]\n  \\draw[->,thick] (0,0) -- (3,0);\n  \\draw[blue,thick] (0,0) -- (2.5,1.5);\n\\end{tikzpicture}',
                            })
                          }
                        >
                          + TikZ
                        </button>
                      </div>

                      {activeSlide.layout === 'blocks' && (
                        <div className="fb-grid2">
                          <label className="fb-field">
                            Tipo de Bloco
                            <select
                              value={activeSlide.blockType}
                              onChange={(e) =>
                                updateActiveSlide({
                                  blockType: e.target.value as BeamerSlide['blockType'],
                                })
                              }
                            >
                              <option value="block">block (Padrão)</option>
                              <option value="exampleblock">exampleblock (Verde)</option>
                              <option value="alertblock">alertblock (Alerta)</option>
                              <option value="theorem">theorem (Teorema)</option>
                              <option value="proof">proof (Demonstração)</option>
                            </select>
                          </label>
                          <label className="fb-field">
                            Título do Bloco
                            <input
                              value={activeSlide.blockTitle}
                              onChange={(e) => updateActiveSlide({ blockTitle: e.target.value })}
                            />
                          </label>
                        </div>
                      )}

                      {activeSlide.layout === 'two-col' && (
                        <label className="fb-field">
                          Proporção Coluna Esquerda ({activeSlide.leftRatio}%)
                          <input
                            type="range"
                            min={30}
                            max={70}
                            value={activeSlide.leftRatio}
                            onChange={(e) =>
                              updateActiveSlide({ leftRatio: Number(e.target.value) })
                            }
                          />
                        </label>
                      )}

                      <label className="fb-field">
                        {activeSlide.layout === 'two-col'
                          ? 'Coluna Esquerda (use "- " para tópicos)'
                          : activeSlide.layout === 'code'
                          ? 'Código-Fonte (frame [fragile] automático)'
                          : 'Conteúdo (use "- " para tópicos)'}
                        <textarea
                          rows={4}
                          value={activeSlide.body}
                          onChange={(e) => updateActiveSlide({ body: e.target.value })}
                        />
                      </label>

                      {(activeSlide.layout === 'two-col' || activeSlide.layout === 'blocks') && (
                        <label className="fb-field">
                          {activeSlide.layout === 'two-col'
                            ? 'Coluna Direita (Texto, Equação ou TikZ)'
                            : 'Bloco de Alerta Opcional'}
                          <textarea
                            rows={3}
                            value={activeSlide.rightBody}
                            onChange={(e) => updateActiveSlide({ rightBody: e.target.value })}
                          />
                        </label>
                      )}
                    </>
                  )}

                  <label className="fb-field">
                    Notas do Apresentador (\note{'{...}'})
                    <textarea
                      rows={2}
                      placeholder="Cola da fala para aparecer no ForjaSlide..."
                      value={activeSlide.notes}
                      onChange={(e) => updateActiveSlide({ notes: e.target.value })}
                    />
                  </label>
                </div>
              )}
            </div>
          )}
        </aside>

        <div className="fb-resizer" onMouseDown={(e) => startResize('left', e)} />

        {/* Center Live Slide Preview */}
        <section className="fb-stage-wrap">
          <div
            className="fb-stage-scroll"
            onWheel={(e) => {
              if (e.ctrlKey) {
                e.preventDefault();
                updateSnap((p) => ({
                  ...p,
                  zoom: Math.min(2, Math.max(0.5, Number((p.zoom + (e.deltaY < 0 ? 0.1 : -0.1)).toFixed(2)))),
                }));
              }
            }}
          >
            {activeSlide && (
              <div
                className="fb-slide-preview-card"
                style={{ width: slideW, minHeight: slideH }}
              >
                {activeSlide.layout === 'title' ? (
                  <div
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 28,
                      textAlign: 'center',
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        background: palette.primary,
                        color: '#fff',
                        padding: '14px 24px',
                        borderRadius: 10,
                        width: '88%',
                      }}
                    >
                      <div style={{ fontSize: 20, fontWeight: 700 }}>{snap.docTitle}</div>
                      {snap.docSubtitle && (
                        <div style={{ fontSize: 13, opacity: 0.9, marginTop: 4 }}>{snap.docSubtitle}</div>
                      )}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, marginTop: 8 }}>{snap.author}</div>
                    <div style={{ fontSize: 11, color: '#475569' }}>{snap.institute}</div>
                  </div>
                ) : (
                  <>
                    {snap.theme === 'Berlin' && (
                      <div
                        style={{
                          background: '#0f172a',
                          color: '#cbd5e1',
                          padding: '4px 16px',
                          fontSize: 10,
                          display: 'flex',
                          gap: 12,
                          alignItems: 'center',
                        }}
                      >
                        <span>○ Introdução</span>
                        <span style={{ color: '#fff', fontWeight: 700 }}>● {activeSlide.title}</span>
                        <span>○ Conclusão</span>
                      </div>
                    )}
                    {snap.theme === 'Warsaw' && (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          fontSize: 10,
                          color: '#fff',
                        }}
                      >
                        <div style={{ background: '#0f172a', padding: '4px 12px' }}>{snap.docTitle}</div>
                        <div style={{ background: palette.primary, padding: '4px 12px', textAlign: 'right' }}>
                          {activeSlide.title}
                        </div>
                      </div>
                    )}
                    <div
                      style={{
                        background:
                          snap.theme === 'metropolis'
                            ? '#23373b'
                            : snap.theme === 'Singapore'
                            ? `linear-gradient(180deg, ${palette.primary}33 0%, #ffffff 100%)`
                            : snap.theme === 'Warsaw'
                            ? `linear-gradient(90deg, ${palette.primary}, ${palette.secondary})`
                            : palette.primary,
                        color: snap.theme === 'Singapore' ? '#0f172a' : '#fff',
                        padding: snap.theme === 'metropolis' ? '12px 20px' : '10px 18px',
                        fontWeight: 700,
                        fontSize: 16,
                        textAlign: snap.theme === 'Singapore' ? 'center' : 'left',
                        borderBottom: snap.theme === 'metropolis' ? '2px solid #eb811b' : 'none',
                        boxShadow: snap.theme === 'Madrid' || snap.theme === 'Warsaw' ? '0 2px 6px rgba(0,0,0,0.18)' : 'none',
                      }}
                    >
                      {activeSlide.title}
                    </div>
                    <div style={{ flex: 1, padding: '16px 20px', fontSize: 13, lineHeight: 1.55 }}>
                      {activeSlide.layout === 'toc' ? (
                        <ol style={{ paddingLeft: 20 }}>
                          {snap.slides
                            .filter((s) => s.layout !== 'title' && s.layout !== 'toc')
                            .map((s) => (
                              <li key={s.id} style={{ marginBottom: 6 }}>
                                {s.title}
                              </li>
                            ))}
                        </ol>
                      ) : activeSlide.layout === 'two-col' ? (
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: `${activeSlide.leftRatio}% ${100 - activeSlide.leftRatio}%`,
                            gap: 14,
                          }}
                        >
                          <div style={{ whiteSpace: 'pre-wrap' }}>{activeSlide.body}</div>
                          <div
                            style={{
                              background: '#f1f5f9',
                              border: '1px dashed #94a3b8',
                              borderRadius: 6,
                              padding: 10,
                              fontFamily: 'monospace',
                              fontSize: 11,
                              whiteSpace: 'pre-wrap',
                            }}
                          >
                            {activeSlide.rightBody}
                          </div>
                        </div>
                      ) : activeSlide.layout === 'blocks' ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          <div style={{ borderRadius: 6, overflow: 'hidden', border: `1px solid ${palette.secondary}` }}>
                            <div
                              style={{
                                background:
                                  activeSlide.blockType === 'alertblock'
                                    ? palette.alert
                                    : activeSlide.blockType === 'exampleblock'
                                    ? palette.example
                                    : palette.secondary,
                                color: '#fff',
                                padding: '5px 10px',
                                fontWeight: 700,
                                fontSize: 12,
                              }}
                            >
                              {activeSlide.blockTitle || activeSlide.blockType}
                            </div>
                            <div style={{ padding: 10, background: '#f8fafc' }}>{activeSlide.body}</div>
                          </div>
                          {activeSlide.rightBody && (
                            <div style={{ borderRadius: 6, overflow: 'hidden', border: `1px solid ${palette.alert}` }}>
                              <div
                                style={{
                                  background: palette.alert,
                                  color: '#fff',
                                  padding: '5px 10px',
                                  fontWeight: 700,
                                  fontSize: 12,
                                }}
                              >
                                Observação
                              </div>
                              <div style={{ padding: 10, background: '#fef2f2' }}>{activeSlide.rightBody}</div>
                            </div>
                          )}
                        </div>
                      ) : activeSlide.layout === 'code' ? (
                        <pre
                          style={{
                            background: '#0f172a',
                            color: '#e2e8f0',
                            padding: 12,
                            borderRadius: 6,
                            fontSize: 12,
                            overflow: 'auto',
                          }}
                        >
                          {activeSlide.body}
                        </pre>
                      ) : (
                        <div style={{ whiteSpace: 'pre-wrap' }}>{activeSlide.body}</div>
                      )}
                    </div>
                    {snap.theme === 'Madrid' || snap.theme === 'Warsaw' ? (
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1.6fr 0.7fr',
                          fontSize: 10,
                          color: '#fff',
                        }}
                      >
                        <div style={{ background: palette.primary, padding: '5px 10px' }}>{snap.author}</div>
                        <div style={{ background: palette.secondary, padding: '5px 10px', textAlign: 'center' }}>
                          {snap.docTitle}
                        </div>
                        <div style={{ background: palette.primary, padding: '5px 10px', textAlign: 'right' }}>
                          {activeSlideIdx + 1} / {snap.slides.length}
                        </div>
                      </div>
                    ) : snap.theme === 'metropolis' ? (
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'flex-end',
                          padding: '5px 14px',
                          fontSize: 10,
                          color: '#64748b',
                        }}
                      >
                        {activeSlideIdx + 1}
                      </div>
                    ) : (
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          padding: '5px 14px',
                          background: snap.theme === 'Singapore' ? 'transparent' : '#e2e8f0',
                          fontSize: 10,
                          color: '#334155',
                        }}
                      >
                        <span>{snap.author}</span>
                        <span>{snap.docTitle}</span>
                        <span>
                          {activeSlideIdx + 1} / {snap.slides.length}
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          <div className="fb-zoom-bar">
            <button
              type="button"
              className="fb-mini-btn"
              onClick={() =>
                updateSnap((p) => ({ ...p, zoom: Math.max(0.5, Number((p.zoom - 0.1).toFixed(2))) }))
              }
            >
              <ZoomOut size={12} />
            </button>
            <button
              type="button"
              className="fb-mini-btn"
              style={{ width: 'auto', padding: '0 6px' }}
              onClick={() => updateSnap((p) => ({ ...p, zoom: 1 }))}
            >
              {Math.round(snap.zoom * 100)}%
            </button>
            <button
              type="button"
              className="fb-mini-btn"
              onClick={() =>
                updateSnap((p) => ({ ...p, zoom: Math.min(2, Number((p.zoom + 0.1).toFixed(2))) }))
              }
            >
              <ZoomIn size={12} />
            </button>
          </div>
        </section>

        <div className="fb-resizer" onMouseDown={(e) => startResize('right', e)} />

        <aside className="fb-code-pane">
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase' }}>
            Código LaTeX Beamer (Editável)
          </div>
          <textarea
            className="fb-code-editor"
            spellCheck={false}
            value={rawTex}
            onChange={(e) => handleRawTexChange(e.target.value)}
            title="Edite o código LaTeX diretamente — alterações compatíveis sincronizam com o painel esquerdo"
          />
          <div className="fb-hint">
            Sincronização bidirecional: edite aqui ou na esquerda. Ative "Notas em 2ª tela" para usar no ForjaSlide.
          </div>
        </aside>
      </main>

      {donateOpen && (
        <div className="fb-modal-backdrop" onClick={() => setDonateOpen(false)}>
          <div className="fb-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>Apoiar o ForjaBeam (Ecossistema ForjaTeX)</strong>
              <button type="button" className="fb-mini-btn" onClick={() => setDonateOpen(false)}>
                <X size={13} />
              </button>
            </div>
            <div className="fb-donate-grid">
              <div className="fb-donate-box">
                <strong>Pix</strong>
                {pixQrUrl && <img src={pixQrUrl} alt="QR Pix" className="fb-qr" />}
                <code style={{ fontSize: 10, wordBreak: 'break-all' }}>{PIX_KEY}</code>
                <button
                  type="button"
                  className="fb-btn primary"
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
              <div className="fb-donate-box">
                <strong>PayPal</strong>
                <code style={{ fontSize: 10 }}>{PAYPAL_EMAIL}</code>
                <button
                  type="button"
                  className="fb-btn primary"
                  onClick={() => openExternal(getPayPalDonateUrl('DoacaoForjaBeam'))}
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

