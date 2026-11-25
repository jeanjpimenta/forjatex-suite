import React, { useEffect, useMemo, useState } from 'react';
import katex from 'katex';
import { ImagePlus, Plus, Search, Sparkles, Star, Trash2, X } from 'lucide-react';

interface MathSymbol {
  glyph: string;
  imageDataUrl?: string;
  cmd: string;
  label: string;
  category: string;
  custom?: boolean;
}

const SYMBOLS: MathSymbol[] = [
  { glyph: 'α', cmd: '\\alpha', label: 'alpha alfa', category: 'Gregas' },
  { glyph: 'β', cmd: '\\beta', label: 'beta', category: 'Gregas' },
  { glyph: 'γ', cmd: '\\gamma', label: 'gamma gama', category: 'Gregas' },
  { glyph: 'δ', cmd: '\\delta', label: 'delta', category: 'Gregas' },
  { glyph: 'ε', cmd: '\\varepsilon', label: 'epsilon', category: 'Gregas' },
  { glyph: 'θ', cmd: '\\theta', label: 'theta teta', category: 'Gregas' },
  { glyph: 'λ', cmd: '\\lambda', label: 'lambda', category: 'Gregas' },
  { glyph: 'μ', cmd: '\\mu', label: 'mu mi', category: 'Gregas' },
  { glyph: 'π', cmd: '\\pi', label: 'pi', category: 'Gregas' },
  { glyph: 'σ', cmd: '\\sigma', label: 'sigma', category: 'Gregas' },
  { glyph: 'φ', cmd: '\\varphi', label: 'phi fi', category: 'Gregas' },
  { glyph: 'ω', cmd: '\\omega', label: 'omega', category: 'Gregas' },
  { glyph: 'Δ', cmd: '\\Delta', label: 'Delta maiusculo', category: 'Gregas' },
  { glyph: 'Σ', cmd: '\\Sigma', label: 'Sigma maiusculo', category: 'Gregas' },
  { glyph: 'Ω', cmd: '\\Omega', label: 'Omega maiusculo', category: 'Gregas' },
  { glyph: '∑', cmd: '\\sum_{i=1}^{n}', label: 'somatorio soma sum', category: 'Cálculo' },
  { glyph: '∏', cmd: '\\prod_{i=1}^{n}', label: 'produtorio produto', category: 'Cálculo' },
  { glyph: '∫', cmd: '\\int_{a}^{b}', label: 'integral', category: 'Cálculo' },
  { glyph: '∬', cmd: '\\iint', label: 'integral dupla', category: 'Cálculo' },
  { glyph: '∮', cmd: '\\oint', label: 'integral linha contorno', category: 'Cálculo' },
  { glyph: '∂', cmd: '\\partial', label: 'derivada parcial partial', category: 'Cálculo' },
  { glyph: '∇', cmd: '\\nabla', label: 'nabla gradiente', category: 'Cálculo' },
  { glyph: '∞', cmd: '\\infty', label: 'infinito infinity', category: 'Cálculo' },
  { glyph: 'lim', cmd: '\\lim_{x \\to \\infty}', label: 'limite limit', category: 'Cálculo' },
  { glyph: 'a/b', cmd: '\\frac{a}{b}', label: 'fracao frac', category: 'Operadores' },
  { glyph: '√', cmd: '\\sqrt{x}', label: 'raiz quadrada sqrt', category: 'Operadores' },
  { glyph: '±', cmd: '\\pm', label: 'mais ou menos', category: 'Operadores' },
  { glyph: '×', cmd: '\\times', label: 'multiplicacao vezes', category: 'Operadores' },
  { glyph: '·', cmd: '\\cdot', label: 'ponto produto escalar', category: 'Operadores' },
  { glyph: '≤', cmd: '\\leq', label: 'menor ou igual', category: 'Relações' },
  { glyph: '≥', cmd: '\\geq', label: 'maior ou igual', category: 'Relações' },
  { glyph: '≠', cmd: '\\neq', label: 'diferente nao igual', category: 'Relações' },
  { glyph: '≈', cmd: '\\approx', label: 'aproximado', category: 'Relações' },
  { glyph: '≡', cmd: '\\equiv', label: 'equivalente congruente', category: 'Relações' },
  { glyph: '∈', cmd: '\\in', label: 'pertence conjunto', category: 'Conjuntos' },
  { glyph: '∉', cmd: '\\notin', label: 'nao pertence', category: 'Conjuntos' },
  { glyph: '⊂', cmd: '\\subset', label: 'subconjunto contido', category: 'Conjuntos' },
  { glyph: '∪', cmd: '\\cup', label: 'uniao', category: 'Conjuntos' },
  { glyph: '∩', cmd: '\\cap', label: 'intersecao', category: 'Conjuntos' },
  { glyph: '∅', cmd: '\\emptyset', label: 'vazio', category: 'Conjuntos' },
  { glyph: '∀', cmd: '\\forall', label: 'para todo quantificador', category: 'Lógica' },
  { glyph: '∃', cmd: '\\exists', label: 'existe quantificador', category: 'Lógica' },
  { glyph: '⇒', cmd: '\\Rightarrow', label: 'implica entao seta', category: 'Setas' },
  { glyph: '⇔', cmd: '\\Leftrightarrow', label: 'se e somente se equivalencia', category: 'Setas' },
  { glyph: '→', cmd: '\\to', label: 'tende a seta direita', category: 'Setas' },
  { glyph: 'ℝ', cmd: '\\mathbb{R}', label: 'reais real', category: 'Conjuntos' },
  { glyph: 'ℕ', cmd: '\\mathbb{N}', label: 'naturais', category: 'Conjuntos' },
  { glyph: 'ℤ', cmd: '\\mathbb{Z}', label: 'inteiros', category: 'Conjuntos' },
];

const PRESET_ICONS = ['ℒ', 'ℱ', 'ℋ', '℘', 'ℏ', '∮', '⊗', '⊕', '∇', '∂', 'ℝ', 'ℂ', '≈', '≡', '⇒', '∑', '∏', '√'];

const FAV_KEY = 'forjatex_math_favs_v1';
const CUSTOM_SYM_KEY = 'forjatex_custom_symbols_v1';

interface MathSymbolsModalProps {
  open: boolean;
  onClose: () => void;
  onInsert: (cmd: string) => void;
}

export const MathSymbolsModal: React.FC<MathSymbolsModalProps> = ({
  open,
  onClose,
  onInsert,
}) => {
  const [query, setQuery] = useState('');
  const [favs, setFavs] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(FAV_KEY);
      return raw ? JSON.parse(raw) : ['\\frac{a}{b}', '\\sum_{i=1}^{n}', '\\int_{a}^{b}'];
    } catch {
      return [];
    }
  });
  const [customSymbols, setCustomSymbols] = useState<MathSymbol[]>(() => {
    try {
      const raw = localStorage.getItem(CUSTOM_SYM_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // Dedicated rich "+ Meu Comando" window state
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [newCmd, setNewCmd] = useState('\\mathcal{L}\\{f(t)\\} = \\int_0^\\infty f(t)e^{-st}\\,dt');
  const [newLabel, setNewLabel] = useState('Transformada de Laplace');
  const [newCategory, setNewCategory] = useState('Cálculo');
  const [iconMode, setIconMode] = useState<'glyph' | 'gallery' | 'image'>('gallery');
  const [newGlyph, setNewGlyph] = useState('ℒ');
  const [newImageDataUrl, setNewImageDataUrl] = useState<string>('');

  useEffect(() => {
    localStorage.setItem(FAV_KEY, JSON.stringify(favs));
  }, [favs]);

  useEffect(() => {
    localStorage.setItem(CUSTOM_SYM_KEY, JSON.stringify(customSymbols));
  }, [customSymbols]);

  const katexPreviewHtml = useMemo(() => {
    if (!newCmd.trim()) return '';
    try {
      return katex.renderToString(newCmd, {
        displayMode: true,
        throwOnError: false,
      });
    } catch {
      return '';
    }
  }, [newCmd]);

  if (!open) return null;

  const allSymbols = [...customSymbols, ...SYMBOLS];
  const q = query.trim().toLowerCase();
  const filtered = allSymbols.filter(
    (s) =>
      !q ||
      s.cmd.toLowerCase().includes(q) ||
      s.label.toLowerCase().includes(q) ||
      s.category.toLowerCase().includes(q)
  );

  const toggleFav = (cmd: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavs((prev) => (prev.includes(cmd) ? prev.filter((c) => c !== cmd) : [...prev, cmd]));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setNewImageDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCmd.trim()) return;
    const item: MathSymbol = {
      glyph: newGlyph.trim() || 'fx',
      imageDataUrl: iconMode === 'image' && newImageDataUrl ? newImageDataUrl : undefined,
      cmd: newCmd.trim(),
      label: newLabel.trim() || newCmd.trim(),
      category: newCategory.trim() || 'Meus Comandos',
      custom: true,
    };
    setCustomSymbols((prev) => [item, ...prev.filter((c) => c.cmd !== item.cmd)]);
    setCreatorOpen(false);
  };

  return (
    <>
      <div className="tf-modal-backdrop" onClick={onClose}>
        <div className="tf-modal tf-modal-wide" onClick={(e) => e.stopPropagation()}>
          <div className="tf-modal-header">
            <h2>Símbolos Matemáticos LaTeX</h2>
            <button type="button" className="tf-icon-btn" onClick={onClose}>
              <X size={16} />
            </button>
          </div>

          <div className="tf-modal-body">
            <div className="flex items-center gap-2">
              <div className="tf-symbol-search flex-1">
                <Search size={14} className="text-slate-400" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Buscar símbolo (ex: integral, alpha, soma, frac, conjunto)..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <button
                type="button"
                className="tf-btn-primary"
                onClick={() => setCreatorOpen(true)}
              >
                <Plus size={14} /> Meu Comando
              </button>
            </div>

            {customSymbols.length > 0 && !q && (
              <div>
                <div className="tf-symbol-cat text-amber-400">
                  Meus Comandos Personalizados ({customSymbols.length})
                </div>
                <div className="tf-symbol-grid">
                  {customSymbols.map((s) => (
                    <div
                      key={`custom-${s.cmd}`}
                      className="tf-symbol-card"
                      onClick={() => {
                        onInsert(s.cmd);
                        onClose();
                      }}
                      title={`${s.label} — ${s.cmd}`}
                    >
                      <button
                        type="button"
                        className="tf-symbol-fav"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCustomSymbols((prev) => prev.filter((c) => c.cmd !== s.cmd));
                        }}
                        title="Remover comando"
                      >
                        <Trash2 size={11} />
                      </button>
                      {s.imageDataUrl ? (
                        <img src={s.imageDataUrl} alt={s.label} className="tf-symbol-img-icon" />
                      ) : (
                        <span className="tf-symbol-glyph">{s.glyph}</span>
                      )}
                      <code>{s.label}</code>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {favs.length > 0 && !q && (
              <div>
                <div className="tf-symbol-cat">Favoritos</div>
                <div className="tf-symbol-grid">
                  {allSymbols
                    .filter((s) => favs.includes(s.cmd))
                    .map((s) => (
                      <div
                        key={`fav-${s.cmd}`}
                        className="tf-symbol-card"
                        onClick={() => {
                          onInsert(s.cmd);
                          onClose();
                        }}
                        title={s.cmd}
                      >
                        {s.imageDataUrl ? (
                          <img src={s.imageDataUrl} alt={s.label} className="tf-symbol-img-icon" />
                        ) : (
                          <span className="tf-symbol-glyph">{s.glyph}</span>
                        )}
                        <code>{s.cmd}</code>
                      </div>
                    ))}
                </div>
              </div>
            )}

            <div>
              <div className="tf-symbol-cat">Todos os Símbolos ({filtered.length})</div>
              <div className="tf-symbol-grid">
                {filtered.map((s) => {
                  const isFav = favs.includes(s.cmd);
                  return (
                    <div
                      key={s.cmd}
                      className="tf-symbol-card"
                      onClick={() => {
                        onInsert(s.cmd);
                        onClose();
                      }}
                      title={s.cmd}
                    >
                      <button
                        type="button"
                        className={`tf-symbol-fav ${isFav ? 'active' : ''}`}
                        onClick={(e) => toggleFav(s.cmd, e)}
                        title="Favoritar"
                      >
                        <Star size={11} fill={isFav ? 'currentColor' : 'none'} />
                      </button>
                      {s.imageDataUrl ? (
                        <img src={s.imageDataUrl} alt={s.label} className="tf-symbol-img-icon" />
                      ) : (
                        <span className="tf-symbol-glyph">{s.glyph}</span>
                      )}
                      <code>{s.cmd}</code>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Dedicated spacious "+ Meu Comando" Window */}
      {creatorOpen && (
        <div className="tf-modal-backdrop" style={{ zIndex: 70 }} onClick={() => setCreatorOpen(false)}>
          <div className="tf-modal tf-modal-wide" onClick={(e) => e.stopPropagation()}>
            <div className="tf-modal-header">
              <h2 className="flex items-center gap-2">
                <Sparkles size={16} className="text-amber-400" /> Criar Comando LaTeX Personalizado
              </h2>
              <button type="button" className="tf-icon-btn" onClick={() => setCreatorOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveCustom} className="tf-modal-body">
              <div className="tf-form-grid">
                <label>
                  <span>Nome / Palavras-chave (para busca)</span>
                  <input
                    required
                    type="text"
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    placeholder="Ex: Transformada de Laplace"
                  />
                </label>
                <label>
                  <span>Categoria</span>
                  <input
                    type="text"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="Ex: Cálculo, Física, Provas..."
                  />
                </label>
              </div>

              <label className="tf-full-label">
                <span>Código LaTeX do Comando</span>
                <textarea
                  rows={4}
                  required
                  value={newCmd}
                  onChange={(e) => setNewCmd(e.target.value)}
                  className="tf-mono-textarea"
                  placeholder="Digite o código LaTeX completo aqui..."
                />
              </label>

              <div className="tf-katex-preview-box">
                <span className="text-[11px] font-semibold text-sky-400">
                  Visualização em Tempo Real (KaTeX):
                </span>
                <div
                  className="tf-katex-render"
                  dangerouslySetInnerHTML={{ __html: katexPreviewHtml }}
                />
              </div>

              <div className="tf-icon-picker-box">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300">Ícone do Comando</span>
                  <div className="tf-engine-pill-group">
                    <button
                      type="button"
                      className={iconMode === 'gallery' ? 'active' : ''}
                      onClick={() => setIconMode('gallery')}
                    >
                      Galeria
                    </button>
                    <button
                      type="button"
                      className={iconMode === 'glyph' ? 'active' : ''}
                      onClick={() => setIconMode('glyph')}
                    >
                      Texto / Símbolo
                    </button>
                    <button
                      type="button"
                      className={iconMode === 'image' ? 'active' : ''}
                      onClick={() => setIconMode('image')}
                    >
                      Imagem do PC
                    </button>
                  </div>
                </div>

                {iconMode === 'gallery' && (
                  <div className="tf-preset-icon-grid">
                    {PRESET_ICONS.map((ic) => (
                      <button
                        key={ic}
                        type="button"
                        className={`tf-preset-icon-btn ${newGlyph === ic ? 'active' : ''}`}
                        onClick={() => setNewGlyph(ic)}
                      >
                        {ic}
                      </button>
                    ))}
                  </div>
                )}

                {iconMode === 'glyph' && (
                  <input
                    type="text"
                    value={newGlyph}
                    onChange={(e) => setNewGlyph(e.target.value)}
                    placeholder="Digite um símbolo ou sigla (ex: fx, ℒ, Δx)..."
                    className="tf-glyph-input"
                  />
                )}

                {iconMode === 'image' && (
                  <div className="flex items-center gap-3">
                    <label className="tf-btn-secondary flex items-center gap-2 cursor-pointer">
                      <ImagePlus size={14} /> Escolher Imagem (.png, .svg, .jpg)
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={handleImageUpload}
                      />
                    </label>
                    {newImageDataUrl && (
                      <img src={newImageDataUrl} alt="Preview" className="tf-symbol-img-icon" />
                    )}
                  </div>
                )}
              </div>

              <div className="tf-modal-footer">
                <button type="button" className="tf-btn-secondary" onClick={() => setCreatorOpen(false)}>
                  Cancelar
                </button>
                <button type="submit" className="tf-btn-primary">
                  Salvar Comando
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
