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
import {
  evalExprXY,
  generateSpecialPgfLatex,
  type GroupPlotConfig,
  type SpecialPlotKind,
} from './pgfplotsExtras';

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

type PlotKind = 'function' | 'scatter' | 'bars' | 'histogram' | 'surface3d' | SpecialPlotKind;
type AxisScaleType = 'linear' | 'semilogx' | 'semilogy' | 'loglog';
type AxisLinesMode = 'box' | 'middle' | 'left' | 'none';
type LegendPos =
  | 'north west'
  | 'north'
  | 'north east'
  | 'west'
  | 'center'
  | 'east'
  | 'south west'
  | 'south'
  | 'south east'
  | 'outer north east';
type ColormapName = 'viridis' | 'hot' | 'cool' | 'jet' | 'coolwarm' | 'plasma';

const COLORMAP_GRADIENTS: Record<ColormapName, string> = {
  viridis: 'linear-gradient(90deg, #440154, #3b528b, #21918c, #5ec962, #fde725)',
  hot: 'linear-gradient(90deg, #000000, #e60000, #ffd200, #ffffff)',
  cool: 'linear-gradient(90deg, #00ffff, #ff00ff)',
  jet: 'linear-gradient(90deg, #00008f, #00afff, #7fff7f, #ffaf00, #8f0000)',
  coolwarm: 'linear-gradient(90deg, #3b4cc0, #dddddd, #b40426)',
  plasma: 'linear-gradient(90deg, #0d0887, #7e03a8, #cc4778, #f89540, #f0f921)',
};

function computeLinearRegression(pts: Array<{ x: number; y: number }>) {
  if (pts.length < 2) return null;
  const n = pts.length;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (const p of pts) {
    sx += p.x;
    sy += p.y;
    sxx += p.x * p.x;
    sxy += p.x * p.y;
    syy += p.y * p.y;
  }
  const denom = n * sxx - sx * sx;
  if (Math.abs(denom) < 1e-12) return null;
  const slope = (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;
  const ssTot = syy - (sy * sy) / n;
  const ssRes = pts.reduce((acc, p) => {
    const err = p.y - (slope * p.x + intercept);
    return acc + err * err;
  }, 0);
  const r2 = ssTot > 1e-12 ? Math.max(0, 1 - ssRes / ssTot) : 1;
  return { slope, intercept, r2 };
}

function parseHistValues(raw: string): number[] {
  return raw
    .split(/[\s,;]+/)
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n));
}

function computeHistogramBins(values: number[], numBins: number) {
  if (values.length === 0) return [];
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const span = Math.max(1e-6, maxV - minV);
  const bins = Math.max(2, Math.min(30, numBins));
  const width = span / bins;
  const counts = Array.from({ length: bins }, () => 0);
  for (const v of values) {
    const idx = Math.min(bins - 1, Math.floor((v - minV) / width));
    counts[idx] += 1;
  }
  return counts.map((count, i) => ({
    x0: minV + i * width,
    x1: minV + (i + 1) * width,
    count,
  }));
}

function getPiTicks(xMin: number, xMax: number) {
  const candidates = [
    { val: -2 * Math.PI, tex: '$-2\\pi$', label: '-2π' },
    { val: -Math.PI, tex: '$-\\pi$', label: '-π' },
    { val: -Math.PI / 2, tex: '$-\\frac{\\pi}{2}$', label: '-π/2' },
    { val: 0, tex: '$0$', label: '0' },
    { val: Math.PI / 2, tex: '$\\frac{\\pi}{2}$', label: 'π/2' },
    { val: Math.PI, tex: '$\\pi$', label: 'π' },
    { val: 2 * Math.PI, tex: '$2\\pi$', label: '2π' },
  ];
  return candidates.filter((c) => c.val >= xMin - 0.05 && c.val <= xMax + 0.05);
}

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
  const [axisLines, setAxisLines] = useState<AxisLinesMode>('box');
  const [usePiTicks, setUsePiTicks] = useState(false);
  const [legendPos, setLegendPos] = useState<LegendPos>('north west');
  const [legendColumns, setLegendColumns] = useState<number>(1);
  const [colormapName, setColormapName] = useState<ColormapName>('viridis');
  const [showColorbar, setShowColorbar] = useState(true);
  const [showRegression, setShowRegression] = useState(false);
  const [histRaw, setHistRaw] = useState('1.2, 1.8, 2.1, 2.3, 2.4, 2.9, 3.0, 3.1, 3.5, 3.8, 4.1, 4.5, 2.7, 2.8, 3.2');
  const [histBins, setHistBins] = useState(6);
  const [csvImport, setCsvImport] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [csvColX, setCsvColX] = useState(0);
  const [csvColY, setCsvColY] = useState(1);
  const [csvColErr, setCsvColErr] = useState<number>(-1);
  const [fillBetweenEnabled, setFillBetweenEnabled] = useState(false);
  const [fillBetweenIdxA, setFillBetweenIdxA] = useState(0);
  const [fillBetweenIdxB, setFillBetweenIdxB] = useState(1);
  const [polarExpr, setPolarExpr] = useState('1 + cos(x)');
  const [ternaryCoords, setTernaryCoords] = useState('0.2, 0.3, 0.5\n0.5, 0.2, 0.3\n0.3, 0.5, 0.2');
  const [smithCoords, setSmithCoords] = useState('0.5, 0.2\n1.0, 0.8\n2.0, -0.5');
  const [groupConfig, setGroupConfig] = useState<GroupPlotConfig>({
    rows: 2,
    cols: 2,
    sharedAxes: true,
    exprs: ['sin(x)', 'cos(x)', '0.2*x^2', 'exp(-x^2)'],
  });
  const [contourExpr, setContourExpr] = useState('sin(x)*cos(y)');
  const [contourLevels, setContourLevels] = useState(8);
  const [quiverU, setQuiverU] = useState('-y');
  const [quiverV, setQuiverV] = useState('x');
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const saved = Number(localStorage.getItem('forjatikz_sidebar_w_v1'));
    return Number.isFinite(saved) && saved >= 240 ? Math.min(560, saved) : 320;
  });
  const [codePaneWidth, setCodePaneWidth] = useState<number>(() => {
    const saved = Number(localStorage.getItem('forjatikz_code_w_v1'));
    return Number.isFinite(saved) && saved >= 240 ? Math.min(620, saved) : 340;
  });

  const startResize = (side: 'left' | 'right', e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = side === 'left' ? sidebarWidth : codePaneWidth;
    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      if (side === 'left') {
        const next = Math.max(240, Math.min(560, startW + dx));
        setSidebarWidth(next);
        localStorage.setItem('forjatikz_sidebar_w_v1', String(next));
      } else {
        const next = Math.max(240, Math.min(620, startW - dx));
        setCodePaneWidth(next);
        localStorage.setItem('forjatikz_code_w_v1', String(next));
      }
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

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
  const regression = useMemo(() => computeLinearRegression(parsedScatter), [parsedScatter]);
  const parsedHist = useMemo(() => parseHistValues(histRaw), [histRaw]);
  const histBinsData = useMemo(
    () => computeHistogramBins(parsedHist, histBins),
    [parsedHist, histBins]
  );
  const piTicks = useMemo(() => getPiTicks(xMin, xMax), [xMin, xMax]);

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

    const axisLinesLine = axisLines !== 'box' ? `,\n    axis lines=${axisLines}` : '';
    const legendColsLine = legendColumns > 1 ? `,\n    legend columns=${legendColumns}` : '';
    const piLines =
      usePiTicks && piTicks.length > 0
        ? `,\n    xtick={${piTicks.map((p) => p.val.toFixed(4)).join(', ')}},\n    xticklabels={${piTicks.map((p) => p.tex).join(', ')}}`
        : '';

    if (plotKind === 'bars') {
      const cats = parsedBars.map((b) => b.cat).join(', ');
      const coords = parsedBars.map((b) => `(${b.cat}, ${b.val})`).join(' ');
      return `\\begin{tikzpicture}\n  \\begin{axis}[\n    ybar,\n    title={${plotTitle}},\n    xlabel={${xLabel}},\n    ylabel={${yLabel}},\n    symbolic x coords={${cats}},\n    xtick=data,\n    nodes near coords,\n    ymin=0,\n    grid=${gridMode}${axisLinesLine}\n  ]\n    \\addplot[fill=blue!50, draw=blue!80!black] coordinates { ${coords} };\n  \\end{axis}\n\\end{tikzpicture}`;
    }

    if (plotKind === 'histogram') {
      const rows = parsedHist.join('\n');
      return `\\begin{tikzpicture}\n  \\begin{axis}[\n    title={${plotTitle}},\n    xlabel={${xLabel}},\n    ylabel={Frequência},\n    ymin=0,\n    grid=${gridMode}${axisLinesLine}\n  ]\n    \\addplot[hist={bins=${histBins}}, fill=blue!45, draw=blue!80!black] table[y index=0] {\n${rows}\n    };\n  \\end{axis}\n\\end{tikzpicture}`;
    }

    if (plotKind === 'scatter') {
      if (showRegression) {
        const tableRows = parsedScatter
          .map((p) =>
            useErrorBars && p.err !== undefined
              ? `${p.x} ${p.y} ${p.err}`
              : `${p.x} ${p.y}`
          )
          .join('\n');
        const header = useErrorBars ? 'x y err' : 'x y';
        const errPlotOpt = useErrorBars
          ? ',\n      error bars/.cd, y dir=both, y explicit'
          : '';
        const errColOpt = useErrorBars ? ', y error=err' : '';
        return `\\begin{tikzpicture}\n  \\pgfplotstableread{\n${header}\n${tableRows}\n  }\\scatterdata\n  \\begin{${axisEnv}}[\n    title={${plotTitle}},\n    xlabel={${xLabel}},\n    ylabel={${yLabel}},\n    grid=${gridMode}${axisLinesLine},\n    legend pos=${legendPos}${legendColsLine}\n  ]\n    \\addplot[only marks, mark=*, color=blue${errPlotOpt}] table[x=x, y=y${errColOpt}] {\\scatterdata};\n    \\addlegendentry{Dados}\n    \\addplot[thick, dashed, red] table[x=x, y={create col/linear regression={y=y}}] {\\scatterdata};\n    \\addlegendentry{Ajuste Linear}\n  \\end{${axisEnv}}\n\\end{tikzpicture}`;
      }
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
      return `\\begin{tikzpicture}\n  \\begin{${axisEnv}}[\n    title={${plotTitle}},\n    xlabel={${xLabel}},\n    ylabel={${yLabel}},\n    grid=${gridMode}${axisLinesLine}\n  ]\n    \\addplot[\n      only marks,\n      mark=*,\n      color=blue${errOpt}\n    ] coordinates { ${coords} };\n  \\end{${axisEnv}}\n\\end{tikzpicture}`;
    }

    if (plotKind === 'surface3d') {
      const cbLine = showColorbar ? ',\n    colorbar' : '';
      return `\\begin{tikzpicture}\n  \\begin{axis}[\n    title={${plotTitle}},\n    view={60}{30},\n    colormap name=${colormapName}${cbLine},\n    grid=${gridMode}\n  ]\n    \\addplot3[surf, domain=${xMin}:${xMax}, domain y=${yMin}:${yMax}, samples=24] {${expr3d}};\n  \\end{axis}\n\\end{tikzpicture}`;
    }

    if (
      plotKind === 'polar' ||
      plotKind === 'ternary' ||
      plotKind === 'smith' ||
      plotKind === 'groupplot' ||
      plotKind === 'contour' ||
      plotKind === 'quiver'
    ) {
      return generateSpecialPgfLatex({
        kind: plotKind,
        plotTitle,
        xLabel,
        yLabel,
        xMin,
        xMax,
        yMin,
        yMax,
        gridMode,
        colormapName,
        polarExpr,
        ternaryCoords,
        smithCoords,
        group: groupConfig,
        contourExpr,
        contourLevels,
        quiverU,
        quiverV,
      }).code;
    }

    const trigLine = useRadians ? ',\n    trig format plots=rad' : '';
    const useFillBetween = fillBetweenEnabled && curves.length >= 2;
    const curveLines = curves.map((c, idx) => {
      const opts = [`color=${c.color}`, 'thick', 'samples=100', `domain=${xMin}:${xMax}`];
      if (c.lineStyle !== 'solid') opts.push(c.lineStyle);
      if (useFillBetween && (idx === fillBetweenIdxA || idx === fillBetweenIdxB)) {
        opts.push(`name path=curve${idx}`);
      }
      const areaFill = c.fillArea
        ? `\\closedcycle`
        : '';
      const fillOpt = c.fillArea ? `, fill=${c.color}!20` : '';
      return `    \\addplot[${opts.join(', ')}${fillOpt}] {${c.expr}}${areaFill};\n    \\addlegendentry{$${c.label}$}`;
    });
    if (useFillBetween && fillBetweenIdxA !== fillBetweenIdxB) {
      curveLines.push(
        `    \\addplot[fill=blue!18, fill opacity=0.4] fill between[of=curve${fillBetweenIdxA} and curve${fillBetweenIdxB}];`
      );
    }
    return `\\begin{tikzpicture}\n  \\begin{${axisEnv}}[\n    title={${plotTitle}},\n    xlabel={${xLabel}},\n    ylabel={${yLabel}},\n    xmin=${xMin}, xmax=${xMax},\n    ymin=${yMin}, ymax=${yMax},\n    grid=${gridMode}${axisLinesLine}${piLines}${trigLine},\n    legend pos=${legendPos}${legendColsLine}\n  ]\n${curveLines.join('\n')}\n  \\end{${axisEnv}}\n\\end{tikzpicture}`;
  }, [
    mode,
    customTikzTemplate,
    nodes,
    edges,
    plotKind,
    axisScale,
    plotTitle,
    xLabel,
    yLabel,
    xMin,
    xMax,
    yMin,
    yMax,
    gridMode,
    axisLines,
    usePiTicks,
    piTicks,
    legendPos,
    legendColumns,
    colormapName,
    showColorbar,
    useRadians,
    curves,
    parsedScatter,
    useErrorBars,
    showRegression,
    parsedBars,
    parsedHist,
    histBins,
    expr3d,
    fillBetweenEnabled,
    fillBetweenIdxA,
    fillBetweenIdxB,
    polarExpr,
    ternaryCoords,
    smithCoords,
    groupConfig,
    contourExpr,
    contourLevels,
    quiverU,
    quiverV,
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
          <button
            type="button"
            className="ft-btn"
            onClick={() =>
              window.open(
                locale === 'pt-BR' ? '/manuals/manual-pt-BR.pdf' : '/manuals/manual-en-US.pdf',
                '_blank'
              )
            }
            title="Abrir Manual do Usuário (PDF)"
          >
            Manual (PDF)
          </button>
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

      <main
        className="ft-main"
        style={{ gridTemplateColumns: `${sidebarWidth}px 5px 1fr 5px ${codePaneWidth}px` }}
      >
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
                  className={`ft-btn ${plotKind === 'histogram' ? 'primary' : ''}`}
                  onClick={() => setPlotKind('histogram')}
                >
                  <BarChart3 size={13} /> Histograma
                </button>
                <button
                  type="button"
                  className={`ft-btn ${plotKind === 'surface3d' ? 'primary' : ''}`}
                  onClick={() => setPlotKind('surface3d')}
                >
                  {t('kind3d')}
                </button>
              </div>
              <label className="ft-props" style={{ padding: 8 }}>
                <span>Sistemas Especiais & Avançados (Fase 3 & 4)</span>
                <select
                  value={
                    ['polar', 'ternary', 'smith', 'groupplot', 'contour', 'quiver'].includes(plotKind)
                      ? plotKind
                      : ''
                  }
                  onChange={(e) => {
                    if (e.target.value) setPlotKind(e.target.value as PlotKind);
                  }}
                >
                  <option value="">-- Escolher modo avançado --</option>
                  <option value="groupplot">Subgráficos em Grade (groupplots)</option>
                  <option value="polar">Coordenadas Polares (polaraxis)</option>
                  <option value="ternary">Diagrama Ternário (ternaryaxis)</option>
                  <option value="smith">Carta de Smith (smithchart)</option>
                  <option value="contour">Curvas de Nível 2D (contour)</option>
                  <option value="quiver">Campo Vetorial (quiver)</option>
                </select>
              </label>

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

                <div className="ft-grid2">
                  <label>
                    <span>Eixos (axis lines)</span>
                    <select
                      value={axisLines}
                      onChange={(e) => setAxisLines(e.target.value as AxisLinesMode)}
                    >
                      <option value="box">Caixa (box)</option>
                      <option value="middle">Cruzado (middle)</option>
                      <option value="left">Em L (left)</option>
                      <option value="none">Ocultar (none)</option>
                    </select>
                  </label>

                  {(plotKind === 'function' || plotKind === 'scatter') && (
                    <label>
                      <span>Colunas Legenda</span>
                      <select
                        value={legendColumns}
                        onChange={(e) => setLegendColumns(Number(e.target.value))}
                      >
                        <option value={1}>1 coluna</option>
                        <option value={2}>2 colunas</option>
                        <option value={3}>3 colunas</option>
                      </select>
                    </label>
                  )}
                </div>

                {plotKind === 'function' && (
                  <label className="ft-check">
                    <input
                      type="checkbox"
                      checked={usePiTicks}
                      onChange={(e) => setUsePiTicks(e.target.checked)}
                    />
                    <span>Ticks em múltiplos de π (xtick)</span>
                  </label>
                )}

                {(plotKind === 'function' || plotKind === 'scatter') && (
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>
                      Posição da Legenda ({legendPos})
                    </div>
                    <div className="ft-legend-grid">
                      {(
                        [
                          'north west',
                          'north',
                          'north east',
                          'west',
                          'center',
                          'east',
                          'south west',
                          'south',
                          'south east',
                        ] as LegendPos[]
                      ).map((pos) => (
                        <button
                          key={pos}
                          type="button"
                          className={`ft-legend-cell ${legendPos === pos ? 'active' : ''}`}
                          onClick={() => setLegendPos(pos)}
                          title={pos}
                        >
                          ●
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {plotKind === 'surface3d' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                      Colormap ({colormapName})
                    </div>
                    <div className="ft-colormap-list">
                      {(Object.keys(COLORMAP_GRADIENTS) as ColormapName[]).map((cm) => (
                        <button
                          key={cm}
                          type="button"
                          className={`ft-colormap-btn ${colormapName === cm ? 'active' : ''}`}
                          onClick={() => setColormapName(cm)}
                          title={cm}
                        >
                          <span
                            className="ft-colormap-swatch"
                            style={{ background: COLORMAP_GRADIENTS[cm] }}
                          />
                          <span>{cm}</span>
                        </button>
                      ))}
                    </div>
                    <label className="ft-check">
                      <input
                        type="checkbox"
                        checked={showColorbar}
                        onChange={(e) => setShowColorbar(e.target.checked)}
                      />
                      <span>Exibir barra de cores (colorbar)</span>
                    </label>
                  </div>
                )}
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

                  {curves.length >= 2 && (
                    <div className="ft-props">
                      <label className="ft-check">
                        <input
                          type="checkbox"
                          checked={fillBetweenEnabled}
                          onChange={(e) => setFillBetweenEnabled(e.target.checked)}
                        />
                        <span>Preencher área entre curvas (fillbetween)</span>
                      </label>
                      {fillBetweenEnabled && (
                        <div className="ft-grid2">
                          <label>
                            <span>Curva A</span>
                            <select
                              value={fillBetweenIdxA}
                              onChange={(e) => setFillBetweenIdxA(Number(e.target.value))}
                            >
                              {curves.map((c, idx) => (
                                <option key={c.id} value={idx}>
                                  Curva {idx + 1}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            <span>Curva B</span>
                            <select
                              value={fillBetweenIdxB}
                              onChange={(e) => setFillBetweenIdxB(Number(e.target.value))}
                            >
                              {curves.map((c, idx) => (
                                <option key={c.id} value={idx}>
                                  Curva {idx + 1}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {plotKind === 'scatter' && (
                <div className="ft-props">
                  <div className="ft-sec-title">3. Pontos (x, y) ou (x, y, erro)</div>
                  <div className="ft-help-box">
                    Um ponto por linha separado por vírgula ou espaço. Ex: <code>1, 2.3, 0.3</code>
                  </div>
                  <label className="ft-btn" style={{ justifyContent: 'center', cursor: 'pointer' }}>
                    Importar CSV / TSV
                    <input
                      type="file"
                      accept=".csv,.tsv,.dat,.txt"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = () => {
                          const txt = String(reader.result || '');
                          const lines = txt
                            .split(/\r?\n/)
                            .map((l) => l.trim())
                            .filter(Boolean);
                          if (lines.length < 2) return;
                          const sep = lines[0].includes(';') ? ';' : lines[0].includes('\t') ? '\t' : ',';
                          const rows = lines.map((l) => l.split(sep).map((c) => c.trim()));
                          const firstIsHeader = rows[0].some((c) => Number.isNaN(Number(c)));
                          const headers = firstIsHeader
                            ? rows[0]
                            : rows[0].map((_, i) => `Coluna ${i + 1}`);
                          const dataRows = firstIsHeader ? rows.slice(1) : rows;
                          setCsvImport({ headers, rows: dataRows });
                          setCsvColX(0);
                          setCsvColY(Math.min(1, headers.length - 1));
                          setCsvColErr(headers.length > 2 ? 2 : -1);
                        };
                        reader.readAsText(file);
                        e.target.value = '';
                      }}
                    />
                  </label>

                  {csvImport && (
                    <div className="ft-curve-card">
                      <div className="ft-edge-top">
                        <strong>Mapear Colunas CSV ({csvImport.rows.length} linhas)</strong>
                        <button
                          type="button"
                          className="ft-icon-del"
                          onClick={() => setCsvImport(null)}
                        >
                          ×
                        </button>
                      </div>
                      <div className="ft-grid2">
                        <label>
                          <span>Coluna X</span>
                          <select value={csvColX} onChange={(e) => setCsvColX(Number(e.target.value))}>
                            {csvImport.headers.map((h, i) => (
                              <option key={i} value={i}>
                                {h}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          <span>Coluna Y</span>
                          <select value={csvColY} onChange={(e) => setCsvColY(Number(e.target.value))}>
                            {csvImport.headers.map((h, i) => (
                              <option key={i} value={i}>
                                {h}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <label>
                        <span>Erro Y (opcional)</span>
                        <select value={csvColErr} onChange={(e) => setCsvColErr(Number(e.target.value))}>
                          <option value={-1}>Nenhum</option>
                          {csvImport.headers.map((h, i) => (
                            <option key={i} value={i}>
                              {h}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        className="ft-btn primary"
                        onClick={() => {
                          const mapped = csvImport.rows
                            .map((r) => {
                              const xv = Number(r[csvColX]);
                              const yv = Number(r[csvColY]);
                              if (!Number.isFinite(xv) || !Number.isFinite(yv)) return null;
                              if (csvColErr >= 0) {
                                const ev = Number(r[csvColErr]);
                                if (Number.isFinite(ev)) return `${xv}, ${yv}, ${ev}`;
                              }
                              return `${xv}, ${yv}`;
                            })
                            .filter(Boolean)
                            .join('\n');
                          if (mapped) setScatterRaw(mapped);
                          setCsvImport(null);
                        }}
                      >
                        Aplicar Dados
                      </button>
                    </div>
                  )}

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
                  <label className="ft-check">
                    <input
                      type="checkbox"
                      checked={showRegression}
                      onChange={(e) => setShowRegression(e.target.checked)}
                    />
                    <span>Linha de tendência (Regressão Linear)</span>
                  </label>
                </div>
              )}

              {plotKind === 'histogram' && (
                <div className="ft-props">
                  <div className="ft-sec-title">3. Dados para Histograma (hist)</div>
                  <div className="ft-help-box">
                    Insira valores numéricos separados por vírgula, espaço ou quebra de linha.
                  </div>
                  <label>
                    <span>Quantidade de classes (bins): {histBins}</span>
                    <input
                      type="range"
                      min={3}
                      max={20}
                      value={histBins}
                      onChange={(e) => setHistBins(Number(e.target.value))}
                    />
                  </label>
                  <textarea
                    rows={5}
                    value={histRaw}
                    onChange={(e) => setHistRaw(e.target.value)}
                    className="ft-textarea"
                  />
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

              {plotKind === 'polar' && (
                <div className="ft-props">
                  <div className="ft-sec-title">3. Equação Polar r(θ)</div>
                  <div className="ft-help-box">
                    Use <code>x</code> como ângulo em graus/radianos (ex: <code>1 + cos(x)</code> ou <code>sin(3*x)</code>).
                  </div>
                  <input value={polarExpr} onChange={(e) => setPolarExpr(e.target.value)} />
                </div>
              )}

              {plotKind === 'ternary' && (
                <div className="ft-props">
                  <div className="ft-sec-title">3. Coordenadas Ternárias (A, B, C)</div>
                  <div className="ft-help-box">
                    Um ponto por linha somando 1.0 (ex: <code>0.2, 0.3, 0.5</code>).
                  </div>
                  <textarea
                    rows={5}
                    value={ternaryCoords}
                    onChange={(e) => setTernaryCoords(e.target.value)}
                    className="ft-textarea"
                  />
                </div>
              )}

              {plotKind === 'smith' && (
                <div className="ft-props">
                  <div className="ft-sec-title">3. Impedâncias Normalizadas (R, X)</div>
                  <div className="ft-help-box">
                    Um ponto por linha <code>R, X</code> (ex: <code>0.5, 0.2</code>).
                  </div>
                  <textarea
                    rows={5}
                    value={smithCoords}
                    onChange={(e) => setSmithCoords(e.target.value)}
                    className="ft-textarea"
                  />
                </div>
              )}

              {plotKind === 'groupplot' && (
                <div className="ft-props">
                  <div className="ft-sec-title">3. Grade de Subgráficos (groupplots)</div>
                  <div className="ft-grid2">
                    <label>
                      <span>Linhas</span>
                      <select
                        value={groupConfig.rows}
                        onChange={(e) =>
                          setGroupConfig((g) => ({ ...g, rows: Number(e.target.value) }))
                        }
                      >
                        <option value={1}>1</option>
                        <option value={2}>2</option>
                        <option value={3}>3</option>
                      </select>
                    </label>
                    <label>
                      <span>Colunas</span>
                      <select
                        value={groupConfig.cols}
                        onChange={(e) =>
                          setGroupConfig((g) => ({ ...g, cols: Number(e.target.value) }))
                        }
                      >
                        <option value={1}>1</option>
                        <option value={2}>2</option>
                        <option value={3}>3</option>
                      </select>
                    </label>
                  </div>
                  <label className="ft-check">
                    <input
                      type="checkbox"
                      checked={groupConfig.sharedAxes}
                      onChange={(e) =>
                        setGroupConfig((g) => ({ ...g, sharedAxes: e.target.checked }))
                      }
                    />
                    <span>Compartilhar rótulos nas bordas</span>
                  </label>
                  {Array.from({ length: groupConfig.rows * groupConfig.cols }, (_, idx) => (
                    <label key={idx}>
                      <span>Subgráfico {idx + 1} f(x)</span>
                      <input
                        value={groupConfig.exprs[idx] || 'sin(x)'}
                        onChange={(e) =>
                          setGroupConfig((g) => {
                            const next = [...g.exprs];
                            next[idx] = e.target.value;
                            return { ...g, exprs: next };
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
              )}

              {plotKind === 'contour' && (
                <div className="ft-props">
                  <div className="ft-sec-title">3. Curvas de Nível f(x, y)</div>
                  <label>
                    <span>Função f(x, y)</span>
                    <input value={contourExpr} onChange={(e) => setContourExpr(e.target.value)} />
                  </label>
                  <label>
                    <span>Quantidade de níveis: {contourLevels}</span>
                    <input
                      type="range"
                      min={4}
                      max={16}
                      value={contourLevels}
                      onChange={(e) => setContourLevels(Number(e.target.value))}
                    />
                  </label>
                </div>
              )}

              {plotKind === 'quiver' && (
                <div className="ft-props">
                  <div className="ft-sec-title">3. Campo Vetorial (u, v)</div>
                  <div className="ft-grid2">
                    <label>
                      <span>Componente u(x, y)</span>
                      <input value={quiverU} onChange={(e) => setQuiverU(e.target.value)} />
                    </label>
                    <label>
                      <span>Componente v(x, y)</span>
                      <input value={quiverV} onChange={(e) => setQuiverV(e.target.value)} />
                    </label>
                  </div>
                </div>
              )}
            </>
          )}
        </aside>

        <div
          className="ft-resizer"
          onMouseDown={(e) => startResize('left', e)}
          title="Arraste para redimensionar o painel"
        />

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
              {/* Plot Frame according to axisLines */}
              {axisLines === 'box' && (
                <rect x={68} y={42} width={492} height={312} fill="none" stroke="#475569" strokeWidth={1.2} />
              )}
              {axisLines === 'left' && (
                <polyline points="68,42 68,354 560,354" fill="none" stroke="#64748b" strokeWidth={1.4} />
              )}
              {axisLines === 'middle' && (
                <>
                  <line x1={68} y1={198} x2={560} y2={198} stroke="#64748b" strokeWidth={1.3} />
                  <line x1={314} y1={42} x2={314} y2={354} stroke="#64748b" strokeWidth={1.3} />
                </>
              )}
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
                      {plotKind !== 'bars' && plotKind !== 'histogram' && (
                        <>
                          {!usePiTicks && (
                            <text x={gx} y={372} fill="#94a3b8" fontSize="10" textAnchor="middle">
                              {xv.toFixed(1)}
                            </text>
                          )}
                          <text x={58} y={gy + 3} fill="#94a3b8" fontSize="10" textAnchor="end">
                            {yv.toFixed(1)}
                          </text>
                        </>
                      )}
                    </g>
                  );
                })}

              {usePiTicks &&
                plotKind === 'function' &&
                piTicks.map((pt) => {
                  const px = 68 + ((pt.val - xMin) / Math.max(0.001, xMax - xMin)) * 492;
                  return (
                    <text key={pt.label} x={px} y={372} fill="#38bdf8" fontSize="10" textAnchor="middle">
                      {pt.label}
                    </text>
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

              {plotKind === 'scatter' && (
                <>
                  {parsedScatter.map((p, idx) => {
                    const sx = 68 + ((p.x - xMin) / Math.max(0.001, xMax - xMin)) * 492;
                    const sy = 354 - ((p.y - yMin) / Math.max(0.001, yMax - yMin)) * 312;
                    return <circle key={idx} cx={sx} cy={sy} r={4.5} fill="#38bdf8" />;
                  })}
                  {showRegression && regression && (
                    <>
                      <line
                        x1={68}
                        y1={
                          354 -
                          ((regression.slope * xMin + regression.intercept - yMin) /
                            Math.max(0.001, yMax - yMin)) *
                            312
                        }
                        x2={560}
                        y2={
                          354 -
                          ((regression.slope * xMax + regression.intercept - yMin) /
                            Math.max(0.001, yMax - yMin)) *
                            312
                        }
                        stroke="#f43f5e"
                        strokeWidth={2}
                        strokeDasharray="6 4"
                      />
                      <text x={552} y={58} fill="#f43f5e" fontSize="10.5" textAnchor="end">
                        y = {regression.slope.toFixed(2)}x {regression.intercept >= 0 ? '+' : ''}{' '}
                        {regression.intercept.toFixed(2)} (R² = {regression.r2.toFixed(3)})
                      </text>
                    </>
                  )}
                </>
              )}

              {plotKind === 'histogram' &&
                histBinsData.map((b, idx) => {
                  const maxC = Math.max(1, ...histBinsData.map((x) => x.count));
                  const bw = 492 / Math.max(1, histBinsData.length);
                  const bx = 68 + idx * bw;
                  const bh = (b.count / maxC) * 280;
                  const by = 354 - bh;
                  return (
                    <g key={idx}>
                      <rect
                        x={bx + 1}
                        y={by}
                        width={Math.max(2, bw - 2)}
                        height={bh}
                        fill="#38bdf8"
                        fillOpacity={0.65}
                        stroke="#0284c7"
                      />
                      {b.count > 0 && (
                        <text x={bx + bw / 2} y={by - 4} fill="#e2e8f0" fontSize="9.5" textAnchor="middle">
                          {b.count}
                        </text>
                      )}
                    </g>
                  );
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

              {plotKind === 'polar' && (() => {
                const pts: string[] = [];
                for (let deg = 0; deg <= 360; deg += 4) {
                  const rad = (deg * Math.PI) / 180;
                  const rVal = evalSafeExpr(polarExpr, rad);
                  if (rVal === null) continue;
                  const rr = Math.min(130, Math.abs(rVal) * 55);
                  const px = 314 + rr * Math.cos(rad);
                  const py = 198 - rr * Math.sin(rad);
                  pts.push(`${px.toFixed(1)},${py.toFixed(1)}`);
                }
                return (
                  <g>
                    {[40, 80, 120].map((r) => (
                      <circle key={r} cx={314} cy={198} r={r} fill="none" stroke="#334155" strokeDasharray="3 3" />
                    ))}
                    <polyline fill="none" stroke="#38bdf8" strokeWidth={2.2} points={pts.join(' ')} />
                  </g>
                );
              })()}

              {plotKind === 'ternary' && (
                <g>
                  <polygon points="314,68 184,310 444,310" fill="none" stroke="#64748b" strokeWidth={1.6} />
                  {ternaryCoords
                    .split(/\r?\n/)
                    .map((l, idx) => {
                      const [a, b, c] = l.split(',').map((v) => Number(v.trim()));
                      if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(c)) return null;
                      const sum = Math.max(0.001, a + b + c);
                      const na = a / sum;
                      const nb = b / sum;
                      const nc = c / sum;
                      const px = na * 314 + nb * 184 + nc * 444;
                      const py = na * 68 + nb * 310 + nc * 310;
                      return <circle key={idx} cx={px} cy={py} r={4.5} fill="#38bdf8" />;
                    })}
                </g>
              )}

              {plotKind === 'smith' && (
                <g>
                  <circle cx={314} cy={198} r={128} fill="none" stroke="#64748b" strokeWidth={1.5} />
                  <circle cx={378} cy={198} r={64} fill="none" stroke="#334155" strokeDasharray="3 3" />
                  <line x1={186} y1={198} x2={442} y2={198} stroke="#334155" />
                  {smithCoords.split(/\r?\n/).map((l, idx) => {
                    const [r, x] = l.split(',').map((v) => Number(v.trim()));
                    if (!Number.isFinite(r) || !Number.isFinite(x)) return null;
                    const den = (r + 1) * (r + 1) + x * x;
                    const gx = (r * r - 1 + x * x) / den;
                    const gy = (2 * x) / den;
                    return <circle key={idx} cx={314 + gx * 128} cy={198 - gy * 128} r={4.5} fill="#f59e0b" />;
                  })}
                </g>
              )}

              {plotKind === 'groupplot' && (
                <g>
                  {Array.from({ length: groupConfig.rows * groupConfig.cols }, (_, idx) => {
                    const r = Math.floor(idx / groupConfig.cols);
                    const c = idx % groupConfig.cols;
                    const cw = 480 / groupConfig.cols;
                    const ch = 290 / groupConfig.rows;
                    const ox = 74 + c * cw;
                    const oy = 50 + r * ch;
                    return (
                      <g key={idx}>
                        <rect x={ox} y={oy} width={cw - 12} height={ch - 14} fill="none" stroke="#475569" />
                        <text x={ox + (cw - 12) / 2} y={oy + 14} fill="#94a3b8" fontSize="9.5" textAnchor="middle">
                          {groupConfig.exprs[idx] || 'sin(x)'}
                        </text>
                      </g>
                    );
                  })}
                </g>
              )}

              {plotKind === 'contour' && (
                <g>
                  {Array.from({ length: 12 }, (_, ix) =>
                    Array.from({ length: 10 }, (__, iy) => {
                      const xv = xMin + ((ix + 0.5) / 12) * (xMax - xMin);
                      const yv = yMax - ((iy + 0.5) / 10) * (yMax - yMin);
                      const val = evalExprXY(contourExpr, xv, yv) ?? 0;
                      const norm = Math.max(0, Math.min(1, (val + 1) / 2));
                      const hue = Math.round((1 - norm) * 240);
                      return (
                        <rect
                          key={`${ix}-${iy}`}
                          x={68 + ix * (492 / 12)}
                          y={42 + iy * (312 / 10)}
                          width={492 / 12 + 0.5}
                          height={312 / 10 + 0.5}
                          fill={`hsla(${hue}, 75%, 50%, 0.45)`}
                        />
                      );
                    })
                  )}
                </g>
              )}

              {plotKind === 'quiver' && (
                <g>
                  {Array.from({ length: 7 }, (_, ix) =>
                    Array.from({ length: 5 }, (__, iy) => {
                      const xv = xMin + ((ix + 0.5) / 7) * (xMax - xMin);
                      const yv = yMax - ((iy + 0.5) / 5) * (yMax - yMin);
                      const u = evalExprXY(quiverU, xv, yv) ?? 0;
                      const v = evalExprXY(quiverV, xv, yv) ?? 0;
                      const mag = Math.max(0.001, Math.hypot(u, v));
                      const sx = 68 + ((xv - xMin) / Math.max(0.001, xMax - xMin)) * 492;
                      const sy = 354 - ((yv - yMin) / Math.max(0.001, yMax - yMin)) * 312;
                      const dx = (u / mag) * 18;
                      const dy = -(v / mag) * 18;
                      return (
                        <line
                          key={`${ix}-${iy}`}
                          x1={sx}
                          y1={sy}
                          x2={sx + dx}
                          y2={sy + dy}
                          stroke="#38bdf8"
                          strokeWidth={1.6}
                          markerEnd="url(#arrowHead)"
                        />
                      );
                    })
                  )}
                </g>
              )}

              <text x={314} y={396} fill="#cbd5e1" fontSize="11" textAnchor="middle">
                {xLabel}
              </text>
            </svg>
          )}
        </section>

        <div
          className="ft-resizer"
          onMouseDown={(e) => startResize('right', e)}
          title="Arraste para redimensionar o painel de código"
        />

        {/* Right Live LaTeX Output */}
        <aside className="ft-code-pane">
          <div className="ft-sec-title">{t('generatedCode')}</div>
          <pre className="ft-code">{tikzCode}</pre>
          <div className="ft-hint">
            {t('preamble')}:{' '}
            <code>
              {showRegression && plotKind === 'scatter'
                ? '\\usepackage{tikz, pgfplots, pgfplotstable}'
                : '\\usepackage{tikz, pgfplots}'}
            </code>
            <br />
            <code>\pgfplotsset{'{compat=1.18}'}</code>
            {fillBetweenEnabled && plotKind === 'function' && curves.length >= 2 && (
              <>
                <br />
                <code>\usepgfplotslibrary{'{fillbetween}'}</code>
              </>
            )}
            {(['polar', 'ternary', 'smith', 'groupplot'] as PlotKind[]).includes(plotKind) && (
              <>
                <br />
                <code>
                  \usepgfplotslibrary{'{'}
                  {plotKind === 'groupplot'
                    ? 'groupplots'
                    : plotKind === 'smith'
                    ? 'smithchart'
                    : plotKind}
                  {'}'}
                </code>
              </>
            )}
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
