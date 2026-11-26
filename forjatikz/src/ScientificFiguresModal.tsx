import React, { useMemo, useState } from 'react';
import { Search, Sparkles, X } from 'lucide-react';

interface ScientificFiguresModalProps {
  open: boolean;
  onClose: () => void;
  onApplyLatex: (tikzCode: string) => void;
}

type FigureId = 'inclined' | 'pendulum' | 'lens' | 'rlc' | 'mlp' | 'vectors';

interface FigureDef {
  id: FigureId;
  name: string;
  category: string;
  desc: string;
}

const FIGURES: FigureDef[] = [
  { id: 'inclined', name: 'Plano Inclinado', category: 'Física', desc: 'Bloco com ângulo θ e vetores Peso, Normal e Atrito.' },
  { id: 'pendulum', name: 'Pêndulo Simples', category: 'Física', desc: 'Haste, ângulo θ, massa e decomposição da gravidade.' },
  { id: 'lens', name: 'Lente Convergente', category: 'Óptica', desc: 'Eixo óptico, focos F/F′ e raios principais.' },
  { id: 'rlc', name: 'Circuito RLC Série', category: 'Elétrica', desc: 'Fonte, Resistor, Indutor e Capacitor em malha.' },
  { id: 'mlp', name: 'Rede Neural (MLP)', category: 'IA & Computação', desc: 'Camadas totalmente conectadas com número configurável.' },
  { id: 'vectors', name: 'Soma Vetorial (F₁ + F₂)', category: 'Matemática', desc: 'Regra do paralelogramo com ângulo α ajustável.' },
];

export const ScientificFiguresModal: React.FC<ScientificFiguresModalProps> = ({
  open,
  onClose,
  onApplyLatex,
}) => {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<FigureId>('inclined');
  const [paramA, setParamA] = useState(30); // angle / layers / freq
  const [paramB, setParamB] = useState(4);  // length / hidden / mass
  const [showLabels, setShowLabels] = useState(true);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FIGURES.filter(
      (f) =>
        !q ||
        f.name.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q) ||
        f.desc.toLowerCase().includes(q)
    );
  }, [query]);

  const generatedTikz = useMemo(() => {
    const th = Math.max(10, Math.min(60, paramA));
    if (selectedId === 'inclined') {
      const lbls = showLabels
        ? `\n  \\draw[->, >=Stealth, red, thick] (2.8, 2.2) -- (2.8, 0.9) node[right] {$\\vec{P}$};\n  \\draw[->, >=Stealth, blue, thick] (2.8, 2.2) -- ({2.8-1.1*sin(${th})}, {2.2+1.1*cos(${th})}) node[above left] {$\\vec{N}$};`
        : '';
      return `\\begin{tikzpicture}[>=Stealth]
  \\draw[thick] (0,0) -- (5,0) -- (5,{5*tan(${th})}) -- cycle;
  \\draw (0.9,0) arc (0:${th}:0.9) node[midway, right] {$${th}^\\circ$};
  \\begin{scope}[shift={(2.8,{2.8*tan(${th})})}, rotate=${th}]
    \\draw[fill=blue!15, draw=blue!80!black, thick] (-0.5,0) rectangle (0.5,0.7) node[midway] {$m=${paramB}\\,\\text{kg}$};
  \\end{scope}${lbls}
\\end{tikzpicture}`;
    }

    if (selectedId === 'pendulum') {
      const L = Math.max(2, Math.min(5, paramB));
      return `\\begin{tikzpicture}[>=Stealth]
  \\draw[thick] (-1.5,0) -- (1.5,0);
  \\draw[dashed, gray] (0,0) -- (0,-${L});
  \\draw[thick] (0,0) -- ({${L}*sin(${th})},{-${L}*cos(${th})}) coordinate (bob);
  \\draw (0,-1.1) arc (-90:${-90 + th}:1.1) node[midway, below] {$${th}^\\circ$};
  \\filldraw[fill=blue!25, draw=blue!80!black, thick] (bob) circle (0.28) node {$m$};
  ${showLabels ? `\\draw[->, red, thick] (bob) -- +(0,-1.0) node[right] {$m\\vec{g}$};` : ''}
\\end{tikzpicture}`;
    }

    if (selectedId === 'lens') {
      const f = Math.max(1.2, Math.min(3.0, paramA / 15));
      const h = Math.max(0.6, Math.min(1.8, paramB / 3));
      return `\\begin{tikzpicture}[>=Stealth]
  \\draw[->, gray] (-4.5,0) -- (4.5,0) node[right] {Eixo};
  \\draw[thick, <->, blue!80!black] (0,-2.0) -- (0,2.0);
  \\fill (-${f.toFixed(1)},0) circle (2pt) node[below] {$F$};
  \\fill (${f.toFixed(1)},0) circle (2pt) node[below] {$F'$};
  \\draw[->, very thick, teal] (-3.2,0) -- (-3.2,${h.toFixed(1)}) node[above] {Obj};
  \\draw[red, thick] (-3.2,${h.toFixed(1)}) -- (0,${h.toFixed(1)}) -- (3.2,-${h.toFixed(1)});
  \\draw[orange, thick] (-3.2,${h.toFixed(1)}) -- (3.2,-${h.toFixed(1)});
  \\draw[->, very thick, purple] (3.2,0) -- (3.2,-${h.toFixed(1)}) node[below] {Img};
\\end{tikzpicture}`;
    }

    if (selectedId === 'rlc') {
      return `\\begin{circuitikz}
  \\draw (0,0) to[V, l=$V_0$] (0,3)
        to[R, l=$R=${paramA}\\,\\Omega$] (3,3)
        to[L, l=$L=${paramB}\\,\\text{mH}$] (5,3)
        to[C, l=$C$] (5,0) -- (0,0);
\\end{circuitikz}`;
    }

    if (selectedId === 'mlp') {
      const nIn = Math.max(2, Math.min(5, Math.round(paramA / 12)));
      const nHid = Math.max(2, Math.min(6, paramB));
      const lines: string[] = [];
      for (let i = 1; i <= nIn; i++) {
        lines.push(`  \\node[circle, draw=teal!80!black, fill=teal!15] (I${i}) at (0, ${-((i - (nIn + 1) / 2) * 1.1).toFixed(1)}) {$x_${i}$};`);
      }
      for (let h = 1; h <= nHid; h++) {
        lines.push(`  \\node[circle, draw=blue!80!black, fill=blue!15] (H${h}) at (2.8, ${-((h - (nHid + 1) / 2) * 1.0).toFixed(1)}) {$h_${h}$};`);
      }
      lines.push(`  \\node[circle, draw=orange!80!black, fill=orange!15] (O1) at (5.6, 0) {$\\hat{y}$};`);
      for (let i = 1; i <= nIn; i++) {
        for (let h = 1; h <= nHid; h++) {
          lines.push(`  \\draw[->, gray!70] (I${i}) -- (H${h});`);
        }
      }
      for (let h = 1; h <= nHid; h++) {
        lines.push(`  \\draw[->, gray!70] (H${h}) -- (O1);`);
      }
      return `\\begin{tikzpicture}[>=Stealth]\n${lines.join('\n')}\n\\end{tikzpicture}`;
    }

    // vectors
    return `\\begin{tikzpicture}[>=Stealth]
  \\draw[->, very thick, blue] (0,0) -- (3.5,0) node[below] {$\\vec{F}_1$};
  \\draw[->, very thick, teal] (0,0) -- ({${paramB}*0.7*cos(${th})},{${paramB}*0.7*sin(${th})}) node[above left] {$\\vec{F}_2$};
  \\draw[->, very thick, red] (0,0) -- ({3.5+${paramB}*0.7*cos(${th})},{${paramB}*0.7*sin(${th})}) node[above right] {$\\vec{R}$};
  \\draw[dashed, gray] (3.5,0) -- ({3.5+${paramB}*0.7*cos(${th})},{${paramB}*0.7*sin(${th})});
  \\draw[dashed, gray] ({${paramB}*0.7*cos(${th})},{${paramB}*0.7*sin(${th})}) -- ({3.5+${paramB}*0.7*cos(${th})},{${paramB}*0.7*sin(${th})});
\\end{tikzpicture}`;
  }, [selectedId, paramA, paramB, showLabels]);

  if (!open) return null;

  return (
    <div className="ft-modal-backdrop" onClick={onClose}>
      <div
        className="ft-modal"
        style={{ width: 'min(820px, 94vw)', maxWidth: 820 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ft-modal-head">
          <strong style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Sparkles size={15} /> Biblioteca Paramétrica de Figuras Científicas (Offline)
          </strong>
          <button type="button" className="ft-icon-del" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: 14, display: 'grid', gridTemplateColumns: '240px 1fr', gap: 14 }}>
          {/* Left: Searchable Figure List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', background: 'var(--bg)' }}>
              <Search size={13} />
              <input
                style={{ border: 'none', background: 'transparent', color: 'var(--text)', fontSize: 12, width: '100%', outline: 'none' }}
                placeholder="Buscar figura..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 310, overflowY: 'auto' }}>
              {filtered.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`ft-btn ${selectedId === f.id ? 'primary' : ''}`}
                  style={{ flexDirection: 'column', alignItems: 'flex-start', padding: '7px 9px', gap: 2, textAlign: 'left' }}
                  onClick={() => setSelectedId(f.id)}
                >
                  <span style={{ fontWeight: 700, fontSize: 12 }}>{f.name}</span>
                  <span style={{ fontSize: 10, opacity: 0.8 }}>{f.category}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Right: Parametric Sliders + Code Preview */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
            <div className="ft-help-box">
              {FIGURES.find((f) => f.id === selectedId)?.desc}
            </div>

            <div className="ft-grid2">
              <label style={{ fontSize: 11, color: 'var(--muted)' }}>
                <span>
                  {selectedId === 'mlp'
                    ? `Neurônios Entrada (${Math.max(2, Math.min(5, Math.round(paramA / 12)))})`
                    : selectedId === 'rlc'
                    ? `Resistência R (${paramA} Ω)`
                    : `Parâmetro A / Ângulo (${paramA})`}
                </span>
                <input
                  type="range"
                  min={10}
                  max={60}
                  value={paramA}
                  onChange={(e) => setParamA(Number(e.target.value))}
                />
              </label>

              <label style={{ fontSize: 11, color: 'var(--muted)' }}>
                <span>
                  {selectedId === 'mlp'
                    ? `Camada Oculta (${paramB})`
                    : selectedId === 'rlc'
                    ? `Indutância L (${paramB} mH)`
                    : `Parâmetro B / Escala (${paramB})`}
                </span>
                <input
                  type="range"
                  min={2}
                  max={6}
                  value={paramB}
                  onChange={(e) => setParamB(Number(e.target.value))}
                />
              </label>
            </div>

            <label className="ft-check">
              <input
                type="checkbox"
                checked={showLabels}
                onChange={(e) => setShowLabels(e.target.checked)}
              />
              <span>Incluir vetores e rótulos matemáticos</span>
            </label>

            <pre className="ft-code" style={{ maxHeight: 190, overflow: 'auto', margin: 0 }}>
              {generatedTikz}
            </pre>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                className="ft-btn primary"
                onClick={() => {
                  onApplyLatex(generatedTikz);
                  onClose();
                }}
              >
                Usar no Código TikZ
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
