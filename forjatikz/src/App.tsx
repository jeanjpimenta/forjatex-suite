import React, { useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import { open as openExternal } from '@tauri-apps/plugin-shell';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Circle,
  Copy,
  Download,
  Heart,
  LineChart,
  Moon,
  Plus,
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

type NodeShape = 'circle' | 'rect';

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
}

interface PlotCurve {
  id: string;
  expr: string; // e.g. sin(deg(x)), x^2/4
  color: string;
  label: string;
}

const SCALE = 48; // px per cm
const CX = 310;
const CY = 210;

function evalSafeExpr(expr: string, x: number): number | null {
  try {
    const js = expr
      .replace(/deg\(x\)/g, 'x')
      .replace(/\^/g, '**')
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

export default function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [mode, setMode] = useState<'diagram' | 'pgfplots'>('diagram');
  const [statusMsg, setStatusMsg] = useState('');
  const [donateOpen, setDonateOpen] = useState(false);
  const [pixQrUrl, setPixQrUrl] = useState('');
  const [pixBrCode, setPixBrCode] = useState('');
  const [copyTag, setCopyTag] = useState<string | null>(null);

  // TikZ Diagram State
  const [nodes, setNodes] = useState<TikzNode[]>([
    { id: 'n1', label: 'A', x: -3, y: 1, shape: 'circle', color: 'blue' },
    { id: 'n2', label: 'B', x: 0, y: 1.5, shape: 'rect', color: 'teal' },
    { id: 'n3', label: 'C', x: 3, y: 0, shape: 'circle', color: 'orange' },
  ]);
  const [edges, setEdges] = useState<TikzEdge[]>([
    { id: 'e1', from: 'n1', to: 'n2', label: 'f', arrow: '->' },
    { id: 'e2', from: 'n2', to: 'n3', label: 'g', arrow: '->' },
  ]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>('n1');
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const draggingRef = useRef<string | null>(null);

  // PGFPlots State
  const [plotTitle, setPlotTitle] = useState('Função Senoidal e Parábola');
  const [xLabel, setXLabel] = useState('$x$');
  const [yLabel, setYLabel] = useState('$f(x)$');
  const [xMin, setXMin] = useState(-4);
  const [xMax, setXMax] = useState(4);
  const [yMin, setYMin] = useState(-2);
  const [yMax, setYMax] = useState(3);
  const [gridMode, setGridMode] = useState<'both' | 'major' | 'none'>('both');
  const [curves, setCurves] = useState<PlotCurve[]>([
    { id: 'c1', expr: 'sin(deg(x))', color: 'blue', label: '\\sin(x)' },
    { id: 'c2', expr: '0.2*x^2', color: 'red', label: '0.2x^2' },
  ]);

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

  const tikzCode = useMemo(() => {
    if (mode === 'diagram') {
      const nodeLines = nodes.map((n) => {
        const shapeStyle =
          n.shape === 'circle'
            ? `circle, draw=${n.color}!80!black, fill=${n.color}!12`
            : `rectangle, rounded corners, draw=${n.color}!80!black, fill=${n.color}!12`;
        return `  \\node[${shapeStyle}, minimum size=0.9cm] (${n.id}) at (${n.x.toFixed(1)}, ${n.y.toFixed(1)}) {$${n.label}$};`;
      });
      const edgeLines = edges.map((e) => {
        const lbl = e.label.trim() ? ` node[midway, above] {$${e.label}$}` : '';
        return `  \\draw[${e.arrow}, thick] (${e.from}) -- (${e.to})${lbl};`;
      });
      return `\\begin{tikzpicture}[>=Stealth]\n${nodeLines.join('\n')}\n${edgeLines.join('\n')}\n\\end{tikzpicture}`;
    }

    const curveLines = curves.map(
      (c) =>
        `    \\addplot[color=${c.color}, thick, samples=100, domain=${xMin}:${xMax}] {${c.expr}};\n    \\addlegendentry{$${c.label}$}`
    );
    return `\\begin{tikzpicture}\n  \\begin{axis}[\n    title={${plotTitle}},\n    xlabel={${xLabel}},\n    ylabel={${yLabel}},\n    xmin=${xMin}, xmax=${xMax},\n    ymin=${yMin}, ymax=${yMax},\n    grid=${gridMode},\n    legend pos=north west\n  ]\n${curveLines.join('\n')}\n  \\end{axis}\n\\end{tikzpicture}`;
  }, [mode, nodes, edges, curves, plotTitle, xLabel, yLabel, xMin, xMax, yMin, yMax, gridMode]);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || null;

  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!draggingRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
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
    const id = `n${Date.now().toString().slice(-4)}`;
    const next: TikzNode = {
      id,
      label: `N_${nodes.length + 1}`,
      x: 0,
      y: 0,
      shape,
      color: 'teal',
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

  return (
    <div className="ft-shell">
      <header className="ft-header">
        <div className="ft-brand">
          <img src="/logo.png" alt="ForjaTikZ" className="ft-logo" />
          <div>
            <h1>ForjaTikZ</h1>
            <span>Studio Visual TikZ &amp; PGFPlots</span>
          </div>
        </div>

        <div className="ft-tabs">
          <button
            type="button"
            className={`ft-tab ${mode === 'diagram' ? 'active' : ''}`}
            onClick={() => setMode('diagram')}
          >
            <Workflow size={14} /> Diagramas (TikZ)
          </button>
          <button
            type="button"
            className={`ft-tab ${mode === 'pgfplots' ? 'active' : ''}`}
            onClick={() => setMode('pgfplots')}
          >
            <LineChart size={14} /> Gráficos (PGFPlots)
          </button>
        </div>

        <div className="ft-actions">
          <button type="button" className="ft-btn" onClick={handleCompileCheck}>
            <CheckCircle2 size={14} /> Testar LaTeX
          </button>
          <button type="button" className="ft-btn" onClick={handleExport}>
            <Download size={14} /> Exportar .tex
          </button>
          <button type="button" className="ft-btn primary" onClick={handleCopy}>
            <Copy size={14} /> Copiar Código
          </button>
          <button
            type="button"
            className="ft-btn"
            onClick={() => setDonateOpen(true)}
            title="Apoiar o ForjaTikZ (Pix / PayPal)"
          >
            <Heart size={14} color="#f43f5e" /> Apoiar
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
              <div className="ft-sec-title">Elementos TikZ</div>
              <div className="ft-btn-row">
                <button type="button" className="ft-btn" onClick={() => addNode('circle')}>
                  <Circle size={13} /> + Círculo
                </button>
                <button type="button" className="ft-btn" onClick={() => addNode('rect')}>
                  <Square size={13} /> + Caixa
                </button>
              </div>
              <button
                type="button"
                className={`ft-btn ${connectFrom ? 'primary' : ''}`}
                disabled={!selectedNodeId}
                onClick={() => setConnectFrom((prev) => (prev ? null : selectedNodeId))}
              >
                <ArrowRight size={13} />
                {connectFrom ? 'Clique no nó destino...' : 'Conectar Nó Selecionado'}
              </button>

              {selectedNode && (
                <div className="ft-props">
                  <div className="ft-sec-title">Propriedades ({selectedNode.id})</div>
                  <label>
                    <span>Rótulo (LaTeX)</span>
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

              <div className="ft-sec-title">Setas ({edges.length})</div>
              <div className="ft-edge-list">
                {edges.map((ed) => (
                  <div key={ed.id} className="ft-edge-row">
                    <span>
                      {ed.from} {ed.arrow} {ed.to}
                    </span>
                    <input
                      type="text"
                      value={ed.label}
                      placeholder="rótulo"
                      onChange={(e) =>
                        setEdges((p) =>
                          p.map((x) => (x.id === ed.id ? { ...x, label: e.target.value } : x))
                        )
                      }
                    />
                    <button
                      type="button"
                      className="ft-icon-del"
                      onClick={() => setEdges((p) => p.filter((x) => x.id !== ed.id))}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="ft-sec-title">Eixos PGFPlots</div>
              <div className="ft-props">
                <label>
                  <span>Título</span>
                  <input value={plotTitle} onChange={(e) => setPlotTitle(e.target.value)} />
                </label>
                <div className="ft-grid2">
                  <label>
                    <span>Eixo X</span>
                    <input value={xLabel} onChange={(e) => setXLabel(e.target.value)} />
                  </label>
                  <label>
                    <span>Eixo Y</span>
                    <input value={yLabel} onChange={(e) => setYLabel(e.target.value)} />
                  </label>
                </div>
                <div className="ft-grid2">
                  <label>
                    <span>xmin</span>
                    <input
                      type="number"
                      value={xMin}
                      onChange={(e) => setXMin(Number(e.target.value))}
                    />
                  </label>
                  <label>
                    <span>xmax</span>
                    <input
                      type="number"
                      value={xMax}
                      onChange={(e) => setXMax(Number(e.target.value))}
                    />
                  </label>
                  <label>
                    <span>ymin</span>
                    <input
                      type="number"
                      value={yMin}
                      onChange={(e) => setYMin(Number(e.target.value))}
                    />
                  </label>
                  <label>
                    <span>ymax</span>
                    <input
                      type="number"
                      value={yMax}
                      onChange={(e) => setYMax(Number(e.target.value))}
                    />
                  </label>
                </div>
                <label>
                  <span>Grade</span>
                  <select
                    value={gridMode}
                    onChange={(e) => setGridMode(e.target.value as 'both' | 'major' | 'none')}
                  >
                    <option value="both">Completa (both)</option>
                    <option value="major">Principal (major)</option>
                    <option value="none">Sem grade (none)</option>
                  </select>
                </label>
              </div>

              <div className="ft-sec-title">Curvas</div>
              {curves.map((c) => (
                <div key={c.id} className="ft-curve-card">
                  <input
                    value={c.expr}
                    onChange={(e) =>
                      setCurves((p) =>
                        p.map((x) => (x.id === c.id ? { ...x, expr: e.target.value } : x))
                      )
                    }
                    placeholder="Ex: sin(deg(x))"
                  />
                  <div className="ft-grid2">
                    <input
                      value={c.label}
                      onChange={(e) =>
                        setCurves((p) =>
                          p.map((x) => (x.id === c.id ? { ...x, label: e.target.value } : x))
                        )
                      }
                      placeholder="Legenda"
                    />
                    <select
                      value={c.color}
                      onChange={(e) =>
                        setCurves((p) =>
                          p.map((x) => (x.id === c.id ? { ...x, color: e.target.value } : x))
                        )
                      }
                    >
                      <option value="blue">blue</option>
                      <option value="red">red</option>
                      <option value="teal">teal</option>
                      <option value="orange">orange</option>
                    </select>
                  </div>
                </div>
              ))}
              <button
                type="button"
                className="ft-btn"
                onClick={() =>
                  setCurves((p) => [
                    ...p,
                    { id: `c${Date.now()}`, expr: 'cos(deg(x))', color: 'teal', label: '\\cos(x)' },
                  ])
                }
              >
                <Plus size={13} /> Adicionar Curva
              </button>
            </>
          )}
        </aside>

        {/* Center Canvas */}
        <section className="ft-canvas-wrap">
          {mode === 'diagram' ? (
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
              {/* Grid */}
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

              {/* Edges */}
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

              {/* Nodes */}
              {nodes.map((n) => {
                const px = CX + n.x * SCALE;
                const py = CY - n.y * SCALE;
                const isSel = n.id === selectedNodeId;
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
                      <circle
                        cx={px}
                        cy={py}
                        r={22}
                        fill="#162238"
                        stroke={isSel ? '#f59e0b' : '#38bdf8'}
                        strokeWidth={isSel ? 3 : 2}
                      />
                    ) : (
                      <rect
                        x={px - 26}
                        y={py - 18}
                        width={52}
                        height={36}
                        rx={7}
                        fill="#162238"
                        stroke={isSel ? '#f59e0b' : '#38bdf8'}
                        strokeWidth={isSel ? 3 : 2}
                      />
                    )}
                    <text
                      x={px}
                      y={py + 4}
                      fill="#e2e8f0"
                      fontSize="13"
                      fontWeight="600"
                      textAnchor="middle"
                    >
                      {n.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          ) : (
            <svg className="ft-svg" viewBox="0 0 620 420">
              <rect x={60} y={40} width={500} height={320} fill="none" stroke="#475569" />
              <text x={310} y={24} fill="#e2e8f0" fontSize="14" textAnchor="middle">
                {plotTitle}
              </text>
              {curves.map((c) => {
                const pts: string[] = [];
                const steps = 120;
                for (let i = 0; i <= steps; i++) {
                  const xv = xMin + ((xMax - xMin) * i) / steps;
                  const yv = evalSafeExpr(c.expr, xv);
                  if (yv === null) continue;
                  const sx = 60 + ((xv - xMin) / Math.max(0.001, xMax - xMin)) * 500;
                  const sy = 360 - ((yv - yMin) / Math.max(0.001, yMax - yMin)) * 320;
                  if (sy >= 35 && sy <= 365) {
                    pts.push(`${sx.toFixed(1)},${sy.toFixed(1)}`);
                  }
                }
                const strokeColor =
                  c.color === 'red'
                    ? '#f43f5e'
                    : c.color === 'teal'
                    ? '#14b8a6'
                    : c.color === 'orange'
                    ? '#f59e0b'
                    : '#38bdf8';
                return (
                  <polyline
                    key={c.id}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={2.5}
                    points={pts.join(' ')}
                  />
                );
              })}
            </svg>
          )}
        </section>

        {/* Right Live LaTeX Output */}
        <aside className="ft-code-pane">
          <div className="ft-sec-title">Código LaTeX Gerado</div>
          <pre className="ft-code">{tikzCode}</pre>
          <div className="ft-hint">
            Preâmbulo necessário: <code>\usepackage{'{tikz, pgfplots}'}</code>
          </div>
        </aside>
      </main>

      {donateOpen && (
        <div className="ft-modal-backdrop" onClick={() => setDonateOpen(false)}>
          <div className="ft-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ft-modal-head">
              <strong>Apoiar o ForjaTikZ</strong>
              <button type="button" className="ft-btn" onClick={() => setDonateOpen(false)}>
                <X size={14} />
              </button>
            </div>
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
          </div>
        </div>
      )}
    </div>
  );
}

