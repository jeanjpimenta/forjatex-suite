import React, { useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import { open as openExternal } from '@tauri-apps/plugin-shell';
import {
  ArrowRight,
  BarChart3,
  Check,
  CheckCircle2,
  Circle,
  Copy,
  Diamond,
  Download,
  Heart,
  LineChart,
  Moon,
  Plus,
  ScatterChart,
  Square,
  Sun,
  Trash2,
  Workflow,
  X,
} from 'lucide-react';
import {
  generatePixQrDataUrl,
  getPayPalDonateUrl,
  PAYPAL_EMAIL,
  PIX_KEY,
} from './pixDonate';
import {
  detectTikzLocale,
  saveTikzLocale,
  TIKZ_DICT,
  type TikzLocale,
} from './i18n';

type NodeShape = 'circle' | 'rect' | 'diamond' | 'ellipse' | 'text';
type EdgeLineStyle = 'solid' | 'dashed' | 'dotted';
type EdgeBend = 'straight' | 'bend left=25' | 'bend right=25';

interface TikzNode {
  id: string;
  label: string;
  x: number; // cm (-6..6)
  y: number; // cm (-4..4)
  shape: NodeShape;
  color: string;
}

interface TikzEdge {
  id: string;
  from: string;
  to: string;
  label: string;
  arrow: '->' | '<->' | '--';
  lineStyle: EdgeLineStyle;
  bend: EdgeBend;
}

type PlotKind = 'function' | 'scatter' | 'bars' | 'surface3d';
type AxisScaleType = 'linear' | 'semilogx' | 'semilogy' | 'loglog';

interface PlotCurve {
  id: string;
  expr: string;
  color: string;
  label: string;
  lineStyle: EdgeLineStyle;
  fillArea: boolean;
}

const SCALE = 48; // px per cm
const CX = 310;
const CY = 210;

function evalSafeExpr(expr: string, x: number): number | null {
  try {
    const js = expr
      .replace(/deg\(x\)/g, 'x')
      .replace(/\^/g, '**')
      .replace(/\bpi\b/gi, 'Math.PI')
      .replace(/\bsin\(/g, 'Math.sin(')
      .replace(/\bcos\(/g, 'Math.cos(')
      .replace(/\btan\(/g, 'Math.tan(')
      .replace(/\bexp\(/g, 'Math.exp(')
      .replace(/\bsqrt\(/g, 'Math.sqrt(')
      .replace(/\babs\(/g, 'Math.abs(')
      .replace(/\bln\(/g, 'Math.log(');
    const fn = new Function('x', `return (${js});`);
    const y = fn(x);
    return typeof y === 'number' && Number.isFinite(y) ? y : null;
  } catch {
    return null;
  }
}

function parsePoints(raw: string): Array<{ x: number; y: number; err?: number }> {
  const out: Array<{ x: number; y: number; err?: number }> = [];
  for (const line of raw.split(/[\n;]+/)) {
    const t = line.trim();
    if (!t) continue;
    const parts = t.split(/[\s,]+/).map(Number);
    if (parts.length >= 2 && Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
      const pt: { x: number; y: number; err?: number } = { x: parts[0], y: parts[1] };
      if (parts.length >= 3 && Number.isFinite(parts[2])) pt.err = parts[2];
      out.push(pt);
    }
  }
  return out;
}

function parseBars(raw: string): Array<{ cat: string; val: number }> {
  return raw
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((item) => {
      const [cat, valStr] = item.split('=').map((s) => s.trim());
      const val = Number(valStr);
      if (cat && Number.isFinite(val)) return { cat, val };
      return null;
    })
    .filter((b): b is { cat: string; val: number } => b !== null);
}

const COLOR_HEX: Record<string, string> = {
  blue: '#38bdf8',
  red: '#f43f5e',
  teal: '#14b8a6',
  orange: '#f59e0b',
  purple: '#a855f7',
};

export default function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [locale, setLocale] = useState<TikzLocale>(() => detectTikzLocale());
  const t = (key: string) => TIKZ_DICT[locale][key] ?? TIKZ_DICT['pt-BR'][key] ?? key;
  const [mode, setMode] = useState<'diagram' | 'pgfplots'>('pgfplots');
  const [statusMsg, setStatusMsg] = useState('');
  const [donateOpen, setDonateOpen] = useState(false);
  const [donateTab, setDonateTab] = useState<'donate' | 'feedback'>('donate');
  const [fbKind, setFbKind] = useState<'feature' | 'bug'>('feature');
  const [fbTitle, setFbTitle] = useState('');
  const [fbDetails, setFbDetails] = useState('');
  const [fbContact, setFbContact] = useState('');
  const [fbSending, setFbSending] = useState(false);
  const [fbStatus, setFbStatus] = useState<string | null>(null);
  const [pixQrUrl, setPixQrUrl] = useState('');
  const [pixBrCode, setPixBrCode] = useState('');
  const [copyTag, setCopyTag] = useState<string | null>(null);

  // TikZ Diagram State
  const [nodes, setNodes] = useState<TikzNode[]>([
    { id: 'n1', label: 'Início', x: -3.5, y: 1.5, shape: 'ellipse', color: 'teal' },
    { id: 'n2', label: 'x > 0?', x: 0, y: 1.5, shape: 'diamond', color: 'orange' },
    { id: 'n3', label: 'Executar', x: 3.5, y: 1.5, shape: 'rect', color: 'blue' },
  ]);
  const [edges, setEdges] = useState<TikzEdge[]>([
    { id: 'e1', from: 'n1', to: 'n2', label: '', arrow: '->', lineStyle: 'solid', bend: 'straight' },
    { id: 'e2', from: 'n2', to: 'n3', label: 'Sim', arrow: '->', lineStyle: 'solid', bend: 'straight' },
  ]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>('n1');
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [customTikzTemplate, setCustomTikzTemplate] = useState<string | null>(null);
  const draggingRef = useRef<string | null>(null);

  // PGFPlots State
  const [plotKind, setPlotKind] = useState<PlotKind>('function');
  const [axisScale, setAxisScale] = useState<AxisScaleType>('linear');
  const [useRadians, setUseRadians] = useState(true);
  const [plotTitle, setPlotTitle] = useState('Função Senoidal e Parábola');
  const [xLabel, setXLabel] = useState('$x$');
  const [yLabel, setYLabel] = useState('$f(x)$');
  const [xMin, setXMin] = useState(-4);
  const [xMax, setXMax] = useState(4);
  const [yMin, setYMin] = useState(-1.5);
  const [yMax, setYMax] = useState(3.5);
  const [gridMode, setGridMode] = useState<'both' | 'major' | 'none'>('both');
  const [curves, setCurves] = useState<PlotCurve[]>([
    { id: 'c1', expr: 'sin(x)', color: 'blue', label: '\\sin(x)', lineStyle: 'solid', fillArea: false },
    { id: 'c2', expr: '0.2*x^2', color: 'red', label: '0.2x^2', lineStyle: 'dashed', fillArea: false },
  ]);
  const [scatterRaw, setScatterRaw] = useState('0, 1.1, 0.2\n1, 2.3, 0.3\n2, 2.8, 0.25\n3, 4.1, 0.4');
  const [useErrorBars, setUseErrorBars] = useState(true);
  const [barsRaw, setBarsRaw] = useState('Jan=15\nFev=28\nMar=22\nAbr=35');
  const [expr3d, setExpr3d] = useState('exp(-x^2 - y^2)');

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  React.useEffect(() => {
    generatePixQrDataUrl('DoacaoFjTeXTikZ')
      .then(({ brCode, qrUrl }) => {
        setPixBrCode(brCode);
        setPixQrUrl(qrUrl);
      })
      .catch(() => {});
  }, []);

  const parsedScatter = useMemo(() => parsePoints(scatterRaw), [scatterRaw]);
  const parsedBars = useMemo(() => parseBars(barsRaw), [barsRaw]);

  const tikzCode = useMemo(() => {
    if (mode === 'diagram') {
      if (customTikzTemplate) return customTikzTemplate;

      const nodeLines = nodes.map((n) => {
        if (n.shape === 'text') {
          return `  \\node (${n.id}) at (${n.x.toFixed(1)}, ${n.y.toFixed(1)}) {${n.label}};`;
        }
        const shapeStyle =
          n.shape === 'circle'
            ? `circle, draw=${n.color}!80!black, fill=${n.color}!12`
            : n.shape === 'diamond'
            ? `diamond, aspect=1.6, draw=${n.color}!80!black, fill=${n.color}!12`
            : n.shape === 'ellipse'
            ? `ellipse, draw=${n.color}!80!black, fill=${n.color}!12`
            : `rectangle, rounded corners, draw=${n.color}!80!black, fill=${n.color}!12`;
        return `  \\node[${shapeStyle}, minimum size=0.9cm] (${n.id}) at (${n.x.toFixed(1)}, ${n.y.toFixed(1)}) {${n.label}};`;
      });
      const edgeLines = edges.map((e) => {
        const opts = [e.arrow, 'thick'];
        if (e.lineStyle !== 'solid') opts.push(e.lineStyle);
        if (e.bend !== 'straight') opts.push(e.bend);
        const lbl = e.label.trim() ? ` node[midway, above] {${e.label}}` : '';
        return `  \\draw[${opts.join(', ')}] (${e.from}) to${lbl} (${e.to});`;
      });
      return `\\begin{tikzpicture}[>=Stealth]\n${nodeLines.join('\n')}\n${edgeLines.join('\n')}\n\\end{tikzpicture}`;
    }

    const axisEnv =
      axisScale === 'semilogx'
        ? 'semilogxaxis'
        : axisScale === 'semilogy'
        ? 'semilogyaxis'
        : axisScale === 'loglog'
        ? 'loglogaxis'
        : 'axis';

    if (plotKind === 'bars') {
      const cats = parsedBars.map((b) => b.cat).join(', ');
      const coords = parsedBars.map((b) => `(${b.cat}, ${b.val})`).join(' ');
      return `\\begin{tikzpicture}\n  \\begin{axis}[\n    ybar,\n    title={${plotTitle}},\n    xlabel={${xLabel}},\n    ylabel={${yLabel}},\n    symbolic x coords={${cats}},\n    xtick=data,\n    nodes near coords,\n    ymin=0,\n    grid=${gridMode}\n  ]\n    \\addplot[fill=blue!50, draw=blue!80!black] coordinates { ${coords} };\n  \\end{axis}\n\\end{tikzpicture}`;
    }

    if (plotKind === 'scatter') {
      const coords = parsedScatter
        .map((p) =>
          useErrorBars && p.err !== undefined
            ? `(${p.x}, ${p.y}) +- (0, ${p.err})`
            : `(${p.x}, ${p.y})`
        )
        .join(' ');
      const errOpt = useErrorBars
        ? ',\n      error bars/.cd, y dir=both, y explicit'
        : '';
      return `\\begin{tikzpicture}\n  \\begin{${axisEnv}}[\n    title={${plotTitle}},\n    xlabel={${xLabel}},\n    ylabel={${yLabel}},\n    grid=${gridMode}\n  ]\n    \\addplot[\n      only marks,\n      mark=*,\n      color=blue${errOpt}\n    ] coordinates { ${coords} };\n  \\end{${axisEnv}}\n\\end{tikzpicture}`;
    }

    if (plotKind === 'surface3d') {
      return `\\begin{tikzpicture}\n  \\begin{axis}[\n    title={${plotTitle}},\n    view={60}{30},\n    colormap name=viridis,\n    colorbar,\n    grid=${gridMode}\n  ]\n    \\addplot3[surf, domain=${xMin}:${xMax}, domain y=${yMin}:${yMax}, samples=24] {${expr3d}};\n  \\end{axis}\n\\end{tikzpicture}`;
    }

    const trigLine = useRadians ? ',\n    trig format plots=rad' : '';
    const curveLines = curves.map((c) => {
      const opts = [`color=${c.color}`, 'thick', 'samples=100', `domain=${xMin}:${xMax}`];
      if (c.lineStyle !== 'solid') opts.push(c.lineStyle);
      const areaFill = c.fillArea
        ? `\\closedcycle`
        : '';
      const fillOpt = c.fillArea ? `, fill=${c.color}!20` : '';
      return `    \\addplot[${opts.join(', ')}${fillOpt}] {${c.expr}}${areaFill};\n    \\addlegendentry{$${c.label}$}`;
    });
    return `\\begin{tikzpicture}\n  \\begin{${axisEnv}}[\n    title={${plotTitle}},\n    xlabel={${xLabel}},\n    ylabel={${yLabel}},\n    xmin=${xMin}, xmax=${xMax},\n    ymin=${yMin}, ymax=${yMax},\n    grid=${gridMode}${trigLine},\n    legend pos=north west\n  ]\n${curveLines.join('\n')}\n  \\end{${axisEnv}}\n\\end{tikzpicture}`;
  }, [
    mode,
    customTikzTemplate,
    nodes,
    edges,
    axisScale,
    plotKind,
    plotTitle,
    xLabel,
    yLabel,
    xMin,
    xMax,
    yMin,
    yMax,
    gridMode,
    useRadians,
    curves,
    parsedBars,
    parsedScatter,
    useErrorBars,
    expr3d,
  ]);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || null;

  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!draggingRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * 620;
    const py = ((e.clientY - rect.top) / rect.height) * 420;
    const xCm = Math.round(((px - CX) / SCALE) * 2) / 2;
    const yCm = Math.round(((CY - py) / SCALE) * 2) / 2;
    setNodes((prev) =>
      prev.map((n) =>
        n.id === draggingRef.current
          ? { ...n, x: Math.max(-6, Math.min(6, xCm)), y: Math.max(-4, Math.min(4, yCm)) }
          : n
      )
    );
  };

  const addNode = (shape: NodeShape) => {
    setCustomTikzTemplate(null);
    const id = `n${Date.now().toString().slice(-4)}`;
    const next: TikzNode = {
      id,
      label: `N_${nodes.length + 1}`,
      x: 0,
      y: 0,
      shape,
      color: 'blue',
    };
    setNodes((p) => [...p, next]);
    setSelectedNodeId(id);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(tikzCode);
    setStatusMsg('Código TikZ/PGF copiado para a área de transferência!');
  };

  const handleExport = async () => {
    const target = await save({
      filters: [{ name: 'LaTeX', extensions: ['tex'] }],
      defaultPath: mode === 'diagram' ? 'diagrama-tikz.tex' : 'grafico-pgfplots.tex',
    });
    if (!target) return;
    try {
      await invoke('save_tex_file', { path: target, content: tikzCode });
      setStatusMsg(`Arquivo salvo em: ${target}`);
    } catch (e) {
      setStatusMsg(String(e));
    }
  };

  const handleCompileCheck = async () => {
    setStatusMsg('Validando com pdflatex...');
    try {
      const msg = await invoke<string>('compile_tikz_check', { texSnippet: tikzCode });
      setStatusMsg(msg);
    } catch (e) {
      setStatusMsg(String(e));
    }
  };

  const insertPresetExpr = (curveId: string, expr: string, label: string) => {
    setCurves((p) => p.map((c) => (c.id === curveId ? { ...c, expr, label } : c)));
  };

  return (
    <div className="ft-shell">
      <header className="ft-header">
        <div className="ft-brand">
          <img src="/logo.png" alt="ForjaTikZ" className="ft-logo" />
          <div>
            <h1>ForjaTikZ</h1>
            <span>{t('subtitle')}</span>
          </div>
        </div>

        <div className="ft-tabs">
          <button
            type="button"
            className={`ft-tab ${mode === 'pgfplots' ? 'active' : ''}`}
            onClick={() => setMode('pgfplots')}
          >
            <LineChart size={14} /> {t('tabPlots')}
          </button>
          <button
            type="button"
            className={`ft-tab ${mode === 'diagram' ? 'active' : ''}`}
            onClick={() => setMode('diagram')}
          >
            <Workflow size={14} /> {t('tabDiagrams')}
          </button>
        </div>

        <div className="ft-actions">
          <select
            className="ft-btn"
            value={locale}
            onChange={(e) => {
              const next = e.target.value as TikzLocale;
              setLocale(next);
              saveTikzLocale(next);
            }}
            title="Idioma / Language"
          >
            <option value="pt-BR">PT-BR</option>
            <option value="en">EN</option>
          </select>
          <button type="button" className="ft-btn" onClick={handleCompileCheck}>
            <CheckCircle2 size={14} /> {t('testLatex')}
          </button>
          <button type="button" className="ft-btn" onClick={handleExport}>
            <Download size={14} /> {t('exportTex')}
          </button>
          <button type="button" className="ft-btn primary" onClick={handleCopy}>
            <Copy size={14} /> {t('copyCode')}
          </button>
          <button
            type="button"
            className="ft-btn"
            onClick={() => setDonateOpen(true)}
            title="Suporte & Apoiar o ForjaTikZ"
          >
            <Heart size={14} color="#f43f5e" /> {t('support')}
          </button>
          <button
            type="button"
            className="ft-btn"
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>
      </header>

      {statusMsg && <div className="ft-status">{statusMsg}</div>}

      <main className="ft-main">
        {/* Left Controls */}
        <aside className="ft-sidebar">
          {mode === 'diagram' ? (
            <>
              <div className="ft-sec-title">Adicionar Forma (TikZ)</div>
              <div className="ft-btn-row">
                <button type="button" className="ft-btn" onClick={() => addNode('circle')}>
                  <Circle size={13} /> Círculo
                </button>
                <button type="button" className="ft-btn" onClick={() => addNode('rect')}>
                  <Square size={13} /> Caixa
                </button>
                <button type="button" className="ft-btn" onClick={() => addNode('diamond')}>
                  <Diamond size={13} /> Losango
                </button>
                <button type="button" className="ft-btn" onClick={() => addNode('ellipse')}>
                  Elipse
                </button>
              </div>
              <button
                type="button"
                className={`ft-btn ${connectFrom ? 'primary' : ''}`}
                disabled={!selectedNodeId}
                onClick={() => {
                  setCustomTikzTemplate(null);
                  setConnectFrom((prev) => (prev ? null : selectedNodeId));
                }}
              >
                <ArrowRight size={13} />
                {connectFrom ? 'Clique no nó de destino...' : 'Conectar Nó Selecionado'}
              </button>

              {selectedNode && !customTikzTemplate && (
                <div className="ft-props">
                  <div className="ft-sec-title">Nó Selecionado ({selectedNode.id})</div>
                  <label>
                    <span>Texto dentro do nó</span>
                    <input
                      type="text"
                      value={selectedNode.label}
                      onChange={(e) =>
                        setNodes((p) =>
                          p.map((n) => (n.id === selectedNode.id ? { ...n, label: e.target.value } : n))
                        )
                      }
                    />
                  </label>
                  <label>
                    <span>Cor</span>
                    <select
                      value={selectedNode.color}
                      onChange={(e) =>
                        setNodes((p) =>
                          p.map((n) => (n.id === selectedNode.id ? { ...n, color: e.target.value } : n))
                        )
                      }
                    >
                      <option value="blue">Azul (blue)</option>
                      <option value="teal">Verde-água (teal)</option>
                      <option value="orange">Laranja (orange)</option>
                      <option value="purple">Roxo (purple)</option>
                      <option value="red">Vermelho (red)</option>
                    </select>
                  </label>
                  <button
                    type="button"
                    className="ft-btn danger"
                    onClick={() => {
                      setNodes((p) => p.filter((n) => n.id !== selectedNode.id));
                      setEdges((p) =>
                        p.filter((ed) => ed.from !== selectedNode.id && ed.to !== selectedNode.id)
                      );
                      setSelectedNodeId(null);
                    }}
                  >
                    <Trash2 size={13} /> Excluir Nó
                  </button>
                </div>
              )}

              {!customTikzTemplate && (
                <>
                  <div className="ft-sec-title">Conexões / Setas ({edges.length})</div>
                  <div className="ft-edge-list">
                    {edges.map((ed) => (
                      <div key={ed.id} className="ft-edge-card">
                        <div className="ft-edge-top">
                          <span>
                            {ed.from} → {ed.to}
                          </span>
                          <button
                            type="button"
                            className="ft-icon-del"
                            onClick={() => setEdges((p) => p.filter((x) => x.id !== ed.id))}
                          >
                            ×
                          </button>
                        </div>
                        <div className="ft-grid2">
                          <input
                            type="text"
                            value={ed.label}
                            placeholder="Rótulo (ex: f)"
                            onChange={(e) =>
                              setEdges((p) =>
                                p.map((x) => (x.id === ed.id ? { ...x, label: e.target.value } : x))
                              )
                            }
                          />
                          <select
                            value={ed.bend}
                            onChange={(e) =>
                              setEdges((p) =>
                                p.map((x) =>
                                  x.id === ed.id ? { ...x, bend: e.target.value as EdgeBend } : x
                                )
                              )
                            }
                          >
                            <option value="straight">Reta</option>
                            <option value="bend left=25">Curva Esq.</option>
                            <option value="bend right=25">Curva Dir.</option>
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div className="ft-sec-title">Modelos Prontos (CTAN)</div>
              <div className="ft-btn-row">
                <button
                  type="button"
                  className="ft-btn"
                  onClick={() =>
                    setCustomTikzTemplate(
                      `\\begin{tikzcd}\n  A \\arrow[r, "f"] \\arrow[d, swap, "g"] & B \\arrow[d, "h"] \\\\\n  C \\arrow[r, "j"] & D\n\\end{tikzcd}`
                    )
                  }
                >
                  Comutativo (tikz-cd)
                </button>
                <button
                  type="button"
                  className="ft-btn"
                  onClick={() =>
                    setCustomTikzTemplate(
                      `\\begin{tikzpicture}[->, >=Stealth, node distance=2.5cm, auto]\n  \\node[state, initial] (q0) {$q_0$};\n  \\node[state, accepting, right of=q0] (q1) {$q_1$};\n  \\path (q0) edge[bend left] node {1} (q1)\n        (q1) edge[bend left] node {0} (q0);\n\\end{tikzpicture}`
                    )
                  }
                >
                  Autômato (automata)
                </button>
                <button
                  type="button"
                  className="ft-btn"
                  onClick={() =>
                    setCustomTikzTemplate(
                      `\\begin{circuitikz}\n  \\draw (0,0) to[battery, l=$E$] (0,3)\n        to[resistor, l=$R$] (3,3)\n        to[capacitor, l=$C$] (3,0) -- (0,0);\n\\end{circuitikz}`
                    )
                  }
                >
                  Circuito (circuitikz)
                </button>
                <button
                  type="button"
                  className="ft-btn"
                  onClick={() => setCustomTikzTemplate(null)}
                >
                  Canvas Visual
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="ft-sec-title">{t('plotTypeTitle')}</div>
              <div className="ft-btn-row">
                <button
                  type="button"
                  className={`ft-btn ${plotKind === 'function' ? 'primary' : ''}`}
                  onClick={() => setPlotKind('function')}
                >
                  <LineChart size={13} /> {t('kindFunc')}
                </button>
                <button
                  type="button"
                  className={`ft-btn ${plotKind === 'scatter' ? 'primary' : ''}`}
                  onClick={() => setPlotKind('scatter')}
                >
                  <ScatterChart size={13} /> {t('kindScatter')}
                </button>
                <button
                  type="button"
                  className={`ft-btn ${plotKind === 'bars' ? 'primary' : ''}`}
                  onClick={() => setPlotKind('bars')}
                >
                  <BarChart3 size={13} /> {t('kindBars')}
                </button>
                <button
                  type="button"
                  className={`ft-btn ${plotKind === 'surface3d' ? 'primary' : ''}`}
                  onClick={() => setPlotKind('surface3d')}
                >
                  {t('kind3d')}
                </button>
              </div>

              <div className="ft-sec-title">{t('axisConfigTitle')}</div>
              <div className="ft-props">
                <label>
                  <span>{t('chartTitle')}</span>
                  <input value={plotTitle} onChange={(e) => setPlotTitle(e.target.value)} />
                </label>
                <div className="ft-grid2">
                  <label>
                    <span>{t('xLabel')}</span>
                    <input value={xLabel} onChange={(e) => setXLabel(e.target.value)} />
                  </label>
                  <label>
                    <span>{t('yLabel')}</span>
                    <input value={yLabel} onChange={(e) => setYLabel(e.target.value)} />
                  </label>
                </div>
                {plotKind !== 'bars' && (
                  <div className="ft-grid2">
                    <label>
                      <span>X Mínimo</span>
                      <input
                        type="number"
                        value={xMin}
                        onChange={(e) => setXMin(Number(e.target.value))}
                      />
                    </label>
                    <label>
                      <span>X Máximo</span>
                      <input
                        type="number"
                        value={xMax}
                        onChange={(e) => setXMax(Number(e.target.value))}
                      />
                    </label>
                    <label>
                      <span>Y Mínimo</span>
                      <input
                        type="number"
                        value={yMin}
                        onChange={(e) => setYMin(Number(e.target.value))}
                      />
                    </label>
                    <label>
                      <span>Y Máximo</span>
                      <input
                        type="number"
                        value={yMax}
                        onChange={(e) => setYMax(Number(e.target.value))}
                      />
                    </label>
                  </div>
                )}
                <div className="ft-grid2">
                  <label>
                    <span>Escala</span>
                    <select
                      value={axisScale}
                      onChange={(e) => setAxisScale(e.target.value as AxisScaleType)}
                    >
                      <option value="linear">Linear</option>
                      <option value="semilogx">Semilog X</option>
                      <option value="semilogy">Semilog Y</option>
                      <option value="loglog">Log-Log</option>
                    </select>
                  </label>
                  <label>
                    <span>Grade</span>
                    <select
                      value={gridMode}
                      onChange={(e) => setGridMode(e.target.value as 'both' | 'major' | 'none')}
                    >
                      <option value="both">Completa</option>
                      <option value="major">Principal</option>
                      <option value="none">Sem grade</option>
                    </select>
                  </label>
                </div>
              </div>

              {plotKind === 'function' && (
                <>
                  <div className="ft-sec-title">3. Funções Matemáticas f(x)</div>
                  <div className="ft-help-box">
                    Escreva a fórmula em função de <code>x</code> (use <code>*</code> para multiplicar
                    e <code>^</code> para potência, ex: <code>0.2*x^2</code> ou <code>sin(x)</code>).
                  </div>
                  <label className="ft-check">
                    <input
                      type="checkbox"
                      checked={useRadians}
                      onChange={(e) => setUseRadians(e.target.checked)}
                    />
                    <span>Usar Radianos (trig format plots=rad)</span>
                  </label>
                  {curves.map((c, idx) => (
                    <div key={c.id} className="ft-curve-card">
                      <div className="ft-edge-top">
                        <strong>Curva {idx + 1}</strong>
                        {curves.length > 1 && (
                          <button
                            type="button"
                            className="ft-icon-del"
                            onClick={() => setCurves((p) => p.filter((x) => x.id !== c.id))}
                            title="Remover curva"
                          >
                            ×
                          </button>
                        )}
                      </div>
                      <label>
                        <span>Fórmula f(x)</span>
                        <input
                          value={c.expr}
                          onChange={(e) =>
                            setCurves((p) =>
                              p.map((x) => (x.id === c.id ? { ...x, expr: e.target.value } : x))
                            )
                          }
                          placeholder="Ex: 0.2*x^2 ou sin(x)"
                        />
                      </label>
                      <div className="ft-preset-row">
                        <button type="button" onClick={() => insertPresetExpr(c.id, 'x^2', 'x^2')}>
                          x²
                        </button>
                        <button type="button" onClick={() => insertPresetExpr(c.id, 'sin(x)', '\\sin(x)')}>
                          sin(x)
                        </button>
                        <button type="button" onClick={() => insertPresetExpr(c.id, 'cos(x)', '\\cos(x)')}>
                          cos(x)
                        </button>
                        <button type="button" onClick={() => insertPresetExpr(c.id, 'exp(-x^2)', 'e^{-x^2}')}>
                          e⁻ˣ²
                        </button>
                        <button type="button" onClick={() => insertPresetExpr(c.id, '2*x+1', '2x+1')}>
                          2x+1
                        </button>
                      </div>
                      <div className="ft-grid2">
                        <label>
                          <span>Legenda (LaTeX)</span>
                          <input
                            value={c.label}
                            onChange={(e) =>
                              setCurves((p) =>
                                p.map((x) => (x.id === c.id ? { ...x, label: e.target.value } : x))
                              )
                            }
                          />
                        </label>
                        <label>
                          <span>Cor</span>
                          <select
                            value={c.color}
                            onChange={(e) =>
                              setCurves((p) =>
                                p.map((x) => (x.id === c.id ? { ...x, color: e.target.value } : x))
                              )
                            }
                          >
                            <option value="blue">Azul</option>
                            <option value="red">Vermelho</option>
                            <option value="teal">Verde</option>
                            <option value="orange">Laranja</option>
                            <option value="purple">Roxo</option>
                          </select>
                        </label>
                      </div>
                      <div className="ft-grid2">
                        <label>
                          <span>Estilo da Linha</span>
                          <select
                            value={c.lineStyle}
                            onChange={(e) =>
                              setCurves((p) =>
                                p.map((x) =>
                                  x.id === c.id
                                    ? { ...x, lineStyle: e.target.value as EdgeLineStyle }
                                    : x
                                )
                              )
                            }
                          >
                            <option value="solid">Contínua</option>
                            <option value="dashed">Tracejada</option>
                            <option value="dotted">Pontilhada</option>
                          </select>
                        </label>
                        <label className="ft-check" style={{ marginTop: 14 }}>
                          <input
                            type="checkbox"
                            checked={c.fillArea}
                            onChange={(e) =>
                              setCurves((p) =>
                                p.map((x) =>
                                  x.id === c.id ? { ...x, fillArea: e.target.checked } : x
                                )
                              )
                            }
                          />
                          <span>Preencher área</span>
                        </label>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="ft-btn"
                    onClick={() =>
                      setCurves((p) => [
                        ...p,
                        {
                          id: `c${Date.now()}`,
                          expr: 'cos(x)',
                          color: 'teal',
                          label: '\\cos(x)',
                          lineStyle: 'solid',
                          fillArea: false,
                        },
                      ])
                    }
                  >
                    <Plus size={13} /> Adicionar Curva
                  </button>
                </>
              )}

              {plotKind === 'scatter' && (
                <div className="ft-props">
                  <div className="ft-sec-title">3. Pontos (x, y) ou (x, y, erro)</div>
                  <div className="ft-help-box">
                    Um ponto por linha separado por vírgula ou espaço. Ex: <code>1, 2.3, 0.3</code>
                  </div>
                  <textarea
                    rows={5}
                    value={scatterRaw}
                    onChange={(e) => setScatterRaw(e.target.value)}
                    className="ft-textarea"
                  />
                  <label className="ft-check">
                    <input
                      type="checkbox"
                      checked={useErrorBars}
                      onChange={(e) => setUseErrorBars(e.target.checked)}
                    />
                    <span>Mostrar barras de erro (3ª coluna)</span>
                  </label>
                </div>
              )}

              {plotKind === 'bars' && (
                <div className="ft-props">
                  <div className="ft-sec-title">3. Categorias e Valores</div>
                  <div className="ft-help-box">
                    Um item por linha no formato <code>Categoria=Valor</code> (ex: <code>Jan=15</code>).
                  </div>
                  <textarea
                    rows={5}
                    value={barsRaw}
                    onChange={(e) => setBarsRaw(e.target.value)}
                    className="ft-textarea"
                  />
                </div>
              )}

              {plotKind === 'surface3d' && (
                <div className="ft-props">
                  <div className="ft-sec-title">3. Fórmula 3D f(x, y)</div>
                  <div className="ft-help-box">
                    Digite a função de <code>x</code> e <code>y</code> para gerar o gráfico 3D (`\addplot3 [surf]`).
                  </div>
                  <input value={expr3d} onChange={(e) => setExpr3d(e.target.value)} />
                </div>
              )}
            </>
          )}
        </aside>

        {/* Center Canvas */}
        <section className="ft-canvas-wrap">
          {mode === 'diagram' ? (
            customTikzTemplate ? (
              <div className="ft-template-notice">
                <strong>Modelo CTAN ativo</strong>
                <p>
                  O código gerado ao lado usa bibliotecas avançadas do CTAN (<code>tikz-cd</code>,{' '}
                  <code>automata</code> ou <code>circuitikz</code>). Clique em <strong>Testar LaTeX</strong>{' '}
                  ou <strong>Copiar Código</strong>, ou volte para <strong>Canvas Visual</strong>.
                </p>
                <pre className="ft-code">{customTikzTemplate}</pre>
              </div>
            ) : (
              <svg
                className="ft-svg"
                viewBox="0 0 620 420"
                onMouseMove={handleSvgMouseMove}
                onMouseUp={() => {
                  draggingRef.current = null;
                }}
              >
                <defs>
                  <marker
                    id="arrowHead"
                    markerWidth="10"
                    markerHeight="7"
                    refX="9"
                    refY="3.5"
                    orient="auto"
                  >
                    <polygon points="0 0, 10 3.5, 0 7" fill="#38bdf8" />
                  </marker>
                </defs>
                {Array.from({ length: 13 }, (_, i) => i - 6).map((gx) => (
                  <line
                    key={`vx-${gx}`}
                    x1={CX + gx * SCALE}
                    y1={0}
                    x2={CX + gx * SCALE}
                    y2={420}
                    stroke={gx === 0 ? '#475569' : '#1e293b'}
                    strokeWidth={gx === 0 ? 1.4 : 0.8}
                  />
                ))}
                {Array.from({ length: 9 }, (_, i) => i - 4).map((gy) => (
                  <line
                    key={`hy-${gy}`}
                    x1={0}
                    y1={CY - gy * SCALE}
                    x2={620}
                    y2={CY - gy * SCALE}
                    stroke={gy === 0 ? '#475569' : '#1e293b'}
                    strokeWidth={gy === 0 ? 1.4 : 0.8}
                  />
                ))}

                {edges.map((ed) => {
                  const a = nodes.find((n) => n.id === ed.from);
                  const b = nodes.find((n) => n.id === ed.to);
                  if (!a || !b) return null;
                  const x1 = CX + a.x * SCALE;
                  const y1 = CY - a.y * SCALE;
                  const x2 = CX + b.x * SCALE;
                  const y2 = CY - b.y * SCALE;
                  return (
                    <g key={ed.id}>
                      <line
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke="#38bdf8"
                        strokeWidth={2}
                        strokeDasharray={ed.lineStyle === 'dashed' ? '6 4' : undefined}
                        markerEnd={ed.arrow !== '--' ? 'url(#arrowHead)' : undefined}
                      />
                      {ed.label && (
                        <text
                          x={(x1 + x2) / 2}
                          y={(y1 + y2) / 2 - 8}
                          fill="#f59e0b"
                          fontSize="12"
                          textAnchor="middle"
                        >
                          {ed.label}
                        </text>
                      )}
                    </g>
                  );
                })}

                {nodes.map((n) => {
                  const px = CX + n.x * SCALE;
                  const py = CY - n.y * SCALE;
                  const isSel = n.id === selectedNodeId;
                  const stroke = isSel ? '#f59e0b' : COLOR_HEX[n.color] || '#38bdf8';
                  return (
                    <g
                      key={n.id}
                      style={{ cursor: 'grab' }}
                      onMouseDown={() => {
                        if (connectFrom && connectFrom !== n.id) {
                          setEdges((p) => [
                            ...p,
                            {
                              id: `e${Date.now()}`,
                              from: connectFrom,
                              to: n.id,
                              label: '',
                              arrow: '->',
                              lineStyle: 'solid',
                              bend: 'straight',
                            },
                          ]);
                          setConnectFrom(null);
                        } else {
                          setSelectedNodeId(n.id);
                          draggingRef.current = n.id;
                        }
                      }}
                    >
                      {n.shape === 'circle' ? (
                        <circle cx={px} cy={py} r={24} fill="#162238" stroke={stroke} strokeWidth={isSel ? 3 : 2} />
                      ) : n.shape === 'diamond' ? (
                        <polygon
                          points={`${px},${py - 24} ${px + 34},${py} ${px},${py + 24} ${px - 34},${py}`}
                          fill="#162238"
                          stroke={stroke}
                          strokeWidth={isSel ? 3 : 2}
                        />
                      ) : n.shape === 'ellipse' ? (
                        <ellipse cx={px} cy={py} rx={32} ry={20} fill="#162238" stroke={stroke} strokeWidth={isSel ? 3 : 2} />
                      ) : (
                        <rect
                          x={px - 30}
                          y={py - 18}
                          width={60}
                          height={36}
                          rx={7}
                          fill="#162238"
                          stroke={stroke}
                          strokeWidth={isSel ? 3 : 2}
                        />
                      )}
                      <text x={px} y={py + 4} fill="#e2e8f0" fontSize="12" fontWeight="600" textAnchor="middle">
                        {n.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            )
          ) : (
            <svg className="ft-svg" viewBox="0 0 620 420">
              <text x={310} y={24} fill="#e2e8f0" fontSize="14" fontWeight="600" textAnchor="middle">
                {plotTitle}
              </text>
              {/* Plot Frame */}
              <rect x={68} y={42} width={492} height={312} fill="none" stroke="#475569" strokeWidth={1.2} />
              {/* Grid + Ticks */}
              {gridMode !== 'none' &&
                Array.from({ length: 5 }, (_, i) => i).map((step) => {
                  const gx = 68 + (step * 492) / 4;
                  const gy = 42 + (step * 312) / 4;
                  const xv = xMin + (step * (xMax - xMin)) / 4;
                  const yv = yMax - (step * (yMax - yMin)) / 4;
                  return (
                    <g key={step}>
                      <line x1={gx} y1={42} x2={gx} y2={354} stroke="#1e293b" strokeWidth={0.9} />
                      <line x1={68} y1={gy} x2={560} y2={gy} stroke="#1e293b" strokeWidth={0.9} />
                      {plotKind !== 'bars' && (
                        <>
                          <text x={gx} y={372} fill="#94a3b8" fontSize="10" textAnchor="middle">
                            {xv.toFixed(1)}
                          </text>
                          <text x={58} y={gy + 3} fill="#94a3b8" fontSize="10" textAnchor="end">
                            {yv.toFixed(1)}
                          </text>
                        </>
                      )}
                    </g>
                  );
                })}

              {plotKind === 'function' &&
                curves.map((c) => {
                  const pts: string[] = [];
                  const steps = 140;
                  for (let i = 0; i <= steps; i++) {
                    const xv = xMin + ((xMax - xMin) * i) / steps;
                    const yv = evalSafeExpr(c.expr, xv);
                    if (yv === null) continue;
                    const sx = 68 + ((xv - xMin) / Math.max(0.001, xMax - xMin)) * 492;
                    const sy = 354 - ((yv - yMin) / Math.max(0.001, yMax - yMin)) * 312;
                    if (sy >= 38 && sy <= 358) pts.push(`${sx.toFixed(1)},${sy.toFixed(1)}`);
                  }
                  const strokeColor = COLOR_HEX[c.color] || '#38bdf8';
                  return (
                    <polyline
                      key={c.id}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={2.5}
                      strokeDasharray={
                        c.lineStyle === 'dashed' ? '6 4' : c.lineStyle === 'dotted' ? '2 4' : undefined
                      }
                      points={pts.join(' ')}
                    />
                  );
                })}

              {plotKind === 'scatter' &&
                parsedScatter.map((p, idx) => {
                  const sx = 68 + ((p.x - xMin) / Math.max(0.001, xMax - xMin)) * 492;
                  const sy = 354 - ((p.y - yMin) / Math.max(0.001, yMax - yMin)) * 312;
                  return <circle key={idx} cx={sx} cy={sy} r={4.5} fill="#38bdf8" />;
                })}

              {plotKind === 'bars' &&
                parsedBars.map((b, idx) => {
                  const maxV = Math.max(1, ...parsedBars.map((x) => x.val));
                  const bw = Math.min(54, 420 / Math.max(1, parsedBars.length) - 14);
                  const bx = 95 + idx * (460 / Math.max(1, parsedBars.length));
                  const bh = (b.val / maxV) * 260;
                  const by = 354 - bh;
                  return (
                    <g key={b.cat}>
                      <rect x={bx} y={by} width={bw} height={bh} fill="#38bdf8" fillOpacity={0.75} />
                      <text x={bx + bw / 2} y={by - 6} fill="#e2e8f0" fontSize="11" textAnchor="middle">
                        {b.val}
                      </text>
                      <text x={bx + bw / 2} y={372} fill="#94a3b8" fontSize="11" textAnchor="middle">
                        {b.cat}
                      </text>
                    </g>
                  );
                })}

              {plotKind === 'surface3d' && (
                <text x={310} y={200} fill="#94a3b8" fontSize="12" textAnchor="middle">
                  Preview 3D disponível via botão "Testar LaTeX" (pdflatex)
                </text>
              )}

              <text x={314} y={396} fill="#cbd5e1" fontSize="11" textAnchor="middle">
                {xLabel}
              </text>
            </svg>
          )}
        </section>

        {/* Right Live LaTeX Output */}
        <aside className="ft-code-pane">
          <div className="ft-sec-title">{t('generatedCode')}</div>
          <pre className="ft-code">{tikzCode}</pre>
          <div className="ft-hint">
            {t('preamble')}: <code>\usepackage{'{tikz, pgfplots}'}</code>
            <br />
            <code>\pgfplotsset{'{compat=1.18}'}</code>
          </div>
        </aside>
      </main>

      {donateOpen && (
        <div className="ft-modal-backdrop" onClick={() => setDonateOpen(false)}>
          <div className="ft-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ft-modal-head">
              <div className="ft-tabs">
                <button
                  type="button"
                  className={`ft-tab ${donateTab === 'donate' ? 'active' : ''}`}
                  onClick={() => setDonateTab('donate')}
                >
                  Apoiar (Pix / PayPal)
                </button>
                <button
                  type="button"
                  className={`ft-tab ${donateTab === 'feedback' ? 'active' : ''}`}
                  onClick={() => setDonateTab('feedback')}
                >
                  Pedidos &amp; Bugs
                </button>
              </div>
              <button type="button" className="ft-btn" onClick={() => setDonateOpen(false)}>
                <X size={14} />
              </button>
            </div>
            {donateTab === 'donate' ? (
              <>
              <div className="ft-donate-grid">
                <div className="ft-donate-box">
                  <strong>Pix (Chave Aleatória)</strong>
                  {pixQrUrl && <img src={pixQrUrl} alt="QR Code Pix" className="ft-qr" />}
                  <code>{PIX_KEY}</code>
                  <span>Descrição: DoacaoFjTeXTikZ</span>
                  <div className="ft-btn-row">
                    <button
                      type="button"
                      className="ft-btn"
                      onClick={async () => {
                        await navigator.clipboard.writeText(PIX_KEY);
                        setCopyTag('key');
                        setTimeout(() => setCopyTag(null), 2000);
                      }}
                    >
                      {copyTag === 'key' ? <Check size={12} /> : <Copy size={12} />} Chave
                    </button>
                    {pixBrCode && (
                      <button
                        type="button"
                        className="ft-btn primary"
                        onClick={async () => {
                          await navigator.clipboard.writeText(pixBrCode);
                          setCopyTag('code');
                          setTimeout(() => setCopyTag(null), 2000);
                        }}
                      >
                        {copyTag === 'code' ? 'Copiado!' : 'Copia e Cola'}
                      </button>
                    )}
                  </div>
                </div>
                <div className="ft-donate-box">
                  <strong>PayPal</strong>
                  <code>{PAYPAL_EMAIL}</code>
                  <span>Descrição: DoacaoFjTeXTikZ</span>
                  <div className="ft-btn-row">
                    <button
                      type="button"
                      className="ft-btn"
                      onClick={async () => {
                        await navigator.clipboard.writeText(PAYPAL_EMAIL);
                        setCopyTag('pp');
                        setTimeout(() => setCopyTag(null), 2000);
                      }}
                    >
                      {copyTag === 'pp' ? 'Copiado!' : 'Copiar E-mail'}
                    </button>
                    <button
                      type="button"
                      className="ft-btn primary"
                      onClick={() => openExternal(getPayPalDonateUrl('DoacaoFjTeXTikZ'))}
                    >
                      Abrir PayPal
                    </button>
                  </div>
                </div>
              </div>
              <div className="ft-hint" style={{ textAlign: 'center', marginTop: 8 }}>
                <button
                  type="button"
                  className="ft-btn"
                  style={{ padding: '2px 6px', fontSize: 11 }}
                  onClick={() => openExternal('https://forjatex.com.br')}
                >
                  forjatex.com.br
                </button>{' '}
                · Por{' '}
                <button
                  type="button"
                  className="ft-btn"
                  style={{ padding: '2px 6px', fontSize: 11 }}
                  onClick={() => openExternal('https://jeanpimenta.com.br')}
                >
                  Jean Pimenta
                </button>{' '}
                ·{' '}
                <button
                  type="button"
                  className="ft-btn"
                  style={{ padding: '2px 6px', fontSize: 11 }}
                  onClick={() => openExternal('https://arkhecode.com.br')}
                >
                  Arkhé Code
                </button>
              </div>
              </>
            ) : (
              <div className="ft-props">
                <div className="ft-btn-row">
                  <button
                    type="button"
                    className={`ft-btn ${fbKind === 'feature' ? 'primary' : ''}`}
                    onClick={() => setFbKind('feature')}
                  >
                    Sugerir Recurso
                  </button>
                  <button
                    type="button"
                    className={`ft-btn ${fbKind === 'bug' ? 'primary' : ''}`}
                    onClick={() => setFbKind('bug')}
                  >
                    Reportar Erro
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Resumo do pedido ou erro..."
                  value={fbTitle}
                  onChange={(e) => setFbTitle(e.target.value)}
                />
                <textarea
                  rows={4}
                  placeholder="Descreva os detalhes..."
                  value={fbDetails}
                  onChange={(e) => setFbDetails(e.target.value)}
                  className="ft-textarea"
                />
                <input
                  type="email"
                  placeholder="E-mail opcional (para retorno)..."
                  value={fbContact}
                  onChange={(e) => setFbContact(e.target.value)}
                />
                {fbStatus && <div className="ft-hint">{fbStatus}</div>}
                <div className="ft-btn-row">
                  <button
                    type="button"
                    className="ft-btn primary"
                    disabled={fbSending || !fbTitle.trim() || !fbDetails.trim()}
                    onClick={async () => {
                      setFbSending(true);
                      setFbStatus(null);
                      try {
                        const r = await fetch('https://forjatex.com.br/wp-json/forjatex/v1/feedback', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            app: 'ForjaTikZ',
                            version: '1.1.0',
                            kind: fbKind,
                            title: fbTitle.trim(),
                            details: fbDetails.trim(),
                            contact: fbContact.trim(),
                            locale,
                            client_ts: new Date().toISOString(),
                          }),
                        });
                        if (!r.ok) throw new Error(`HTTP ${r.status}`);
                        setFbStatus('Enviado para forjatex.com.br! Obrigado.');
                        setFbTitle('');
                        setFbDetails('');
                      } catch (e) {
                        setFbStatus(`Erro ao enviar (${String(e)}). Use GitHub ou E-mail.`);
                      } finally {
                        setFbSending(false);
                      }
                    }}
                  >
                    {fbSending ? 'Enviando...' : 'Enviar (Site)'}
                  </button>
                  <button
                    type="button"
                    className="ft-btn"
                    onClick={() => {
                      const body = `[${fbKind === 'bug' ? 'BUG' : 'FEATURE'}] ${fbTitle}\nApp: ForjaTikZ 1.1.0\n---\n${fbDetails}`;
                      const p = new URLSearchParams({
                        title: `[${fbKind === 'bug' ? 'Bug' : 'Feature'}][ForjaTikZ] ${fbTitle || 'Relatório'}`,
                        body,
                        labels: fbKind === 'bug' ? 'bug' : 'enhancement',
                      });
                      openExternal(`https://github.com/jeanjpimenta/forjatex-suite/issues/new?${p.toString()}`);
                    }}
                  >
                    GitHub
                  </button>
                  <button
                    type="button"
                    className="ft-btn"
                    onClick={() => {
                      const body = `[${fbKind === 'bug' ? 'BUG' : 'FEATURE'}] ${fbTitle}\nApp: ForjaTikZ 1.1.0\n---\n${fbDetails}`;
                      const p = new URLSearchParams({
                        subject: `[ForjaTikZ] ${fbTitle || 'Relatório'}`,
                        body,
                      });
                      openExternal(`mailto:${PAYPAL_EMAIL}?${p.toString()}`);
                    }}
                  >
                    E-mail
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
