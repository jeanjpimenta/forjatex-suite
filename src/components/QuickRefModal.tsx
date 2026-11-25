import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Copy, Hash, Plus, Search, Trash2, X } from 'lucide-react';

interface QuickRefItem {
  id: string;
  category: string;
  tags: string[];
  title: string;
  code: string;
  note: string;
  custom?: boolean;
}

const BUILTIN_REFS: QuickRefItem[] = [
  {
    id: 'sec',
    category: 'Estrutura',
    tags: ['seção', 'capítulo', 'sumário'],
    title: 'Seções, Capítulos e Numeração',
    code: '\\chapter{Título}\n\\section{Seção}\n\\subsection{Subseção}\n\\section*{Seção Sem Número}',
    note: 'Use * para omitir numeração. \\chapter existe em report/book.',
  },
  {
    id: 'toc-abstract',
    category: 'Estrutura',
    tags: ['resumo', 'sumário', 'preâmbulo'],
    title: 'Resumo e Sumário Automático',
    code: '\\begin{abstract}\nTexto do resumo aqui.\n\\end{abstract}\n\\tableofcontents\n\\newpage',
    note: 'Compile 2x para atualizar o sumário corretamente.',
  },
  {
    id: 'margins-geometry',
    category: 'Estrutura',
    tags: ['margem', 'abnt', 'página', 'geometry'],
    title: 'Margens ABNT / Página (geometry)',
    code: '\\usepackage[a4paper, top=3cm, left=3cm, bottom=2cm, right=2cm]{geometry}',
    note: 'Padrão ABNT: 3 cm superior/esquerda e 2 cm inferior/direita.',
  },
  {
    id: 'eq',
    category: 'Matemática',
    tags: ['equação', 'amsmath', 'eqref'],
    title: 'Equação Numerada + Referência',
    code: '\\begin{equation}\n  E = mc^2\n  \\label{eq:einstein}\n\\end{equation}\nVeja Equação~\\eqref{eq:einstein}.',
    note: 'Requer \\usepackage{amsmath}.',
  },
  {
    id: 'align',
    category: 'Matemática',
    tags: ['equação', 'align', 'amsmath'],
    title: 'Múltiplas Equações Alinhadas',
    code: '\\begin{align}\n  f(x) &= x^2 + 2x + 1 \\\\\n       &= (x + 1)^2\n\\end{align}',
    note: 'Use & no símbolo de igualdade para alinhar. Use align* para sem número.',
  },
  {
    id: 'frac-int-sum',
    category: 'Matemática',
    tags: ['fração', 'integral', 'somatório', 'limite'],
    title: 'Frações, Somatórios, Integrais e Limites',
    code: '\\frac{a}{b}, \\quad \\sum_{i=1}^{n} x_i, \\quad \\int_{a}^{b} f(x)\\,dx, \\quad \\lim_{x \\to \\infty} \\frac{1}{x} = 0',
    note: 'Use \\dfrac{a}{b} para fração em tamanho grande dentro de texto.',
  },
  {
    id: 'cases-piecewise',
    category: 'Matemática',
    tags: ['casos', 'função', 'sistema'],
    title: 'Função Definida por Partes (cases)',
    code: 'f(x) = \\begin{cases}\n  x^2, & \\text{se } x \\ge 0 \\\\\n  -x,  & \\text{se } x < 0\n\\end{cases}',
    note: 'Requer \\usepackage{amsmath}.',
  },
  {
    id: 'theorem-env',
    category: 'Matemática',
    tags: ['teorema', 'prova', 'lema', 'amsthm'],
    title: 'Teorema, Definição e Demonstração',
    code: '\\newtheorem{teorema}{Teorema}[section]\n\\begin{teorema}[Pitágoras]\n  $a^2 + b^2 = c^2$.\n\\end{teorema}\n\\begin{proof}\n  Demonstração aqui.\n\\end{proof}',
    note: 'Requer \\usepackage{amsthm}.',
  },
  {
    id: 'pmatrix-basic',
    category: 'Matrizes & Tabelas',
    tags: ['matriz', 'amsmath', 'álgebra'],
    title: 'Matriz com Parênteses / Colchetes',
    code: 'A = \\begin{bmatrix}\n  a_{11} & a_{12} \\\\\n  a_{21} & a_{22}\n\\end{bmatrix}',
    note: 'Variantes: pmatrix ( ), bmatrix [ ], vmatrix | |, Bmatrix { }.',
  },
  {
    id: 'booktabs-table',
    category: 'Matrizes & Tabelas',
    tags: ['tabela', 'booktabs', 'abnt'],
    title: 'Tabela Profissional (booktabs)',
    code: '\\begin{table}[htbp]\n  \\centering\n  \\caption{Resultados experimentais}\n  \\label{tab:resultados}\n  \\begin{tabular}{lcc}\n    \\toprule\n    Método & Acurácia & Tempo (s) \\\\\n    \\midrule\n    Base & 84.2\\% & 1.4 \\\\\n    Proposto & \\textbf{93.5\\%} & 0.9 \\\\\n    \\bottomrule\n  \\end{tabular}\n\\end{table}',
    note: 'Requer \\usepackage{booktabs}. Evite linhas verticais em tabelas científicas.',
  },
  {
    id: 'figure-basic',
    category: 'Figuras & Mídia',
    tags: ['imagem', 'figura', 'graphicx'],
    title: 'Figura Centralizada com Legenda',
    code: '\\begin{figure}[htbp]\n  \\centering\n  \\includegraphics[width=0.8\\textwidth]{caminho/imagem.png}\n  \\caption{Descrição da figura.}\n  \\label{fig:exemplo}\n\\end{figure}',
    note: 'Requer \\usepackage{graphicx}.',
  },
  {
    id: 'subfigure-side',
    category: 'Figuras & Mídia',
    tags: ['imagem', 'subfigura', 'subcaption'],
    title: 'Duas Figuras Lado a Lado (subcaption)',
    code: '\\begin{figure}[htbp]\n  \\centering\n  \\begin{subfigure}[b]{0.48\\textwidth}\n    \\includegraphics[width=\\linewidth]{fig1.png}\n    \\caption{Cenário A}\n  \\end{subfigure}\n  \\hfill\n  \\begin{subfigure}[b]{0.48\\textwidth}\n    \\includegraphics[width=\\linewidth]{fig2.png}\n    \\caption{Cenário B}\n  \\end{subfigure}\n  \\caption{Comparação geral.}\n\\end{figure}',
    note: 'Requer \\usepackage{graphicx, subcaption}.',
  },
  {
    id: 'abnt-cite',
    category: 'Bibliografia',
    tags: ['abnt', 'citação', 'bibtex'],
    title: 'Citação e Bibliografia BibTeX',
    code: 'Conforme~\\cite{silva2026}, o modelo converge.\n\\bibliographystyle{plain}\n\\bibliography{references}',
    note: 'Use Quick Build sequencial (pdfLaTeX -> BibTeX -> pdfLaTeX 2x).',
  },
  {
    id: 'biblatex-abnt',
    category: 'Bibliografia',
    tags: ['abnt', 'biblatex', 'biber'],
    title: 'Bibliografia ABNT Moderna (biblatex)',
    code: '\\usepackage[style=abnt]{biblatex}\n\\addbibresource{references.bib}\n% No final do documento:\n\\printbibliography',
    note: 'Requer compilar com Biber entre as passagens de LaTeX.',
  },
  {
    id: 'footnote',
    category: 'Texto & Fontes',
    tags: ['nota', 'link', 'hyperref'],
    title: 'Nota de Rodapé e Hiperlink',
    code: 'Texto com nota\\footnote{Explicação aqui.} e \\href{https://exemplo.com}{link clicável}.',
    note: 'Links requerem \\usepackage{hyperref}.',
  },
  {
    id: 'lists-enum',
    category: 'Texto & Fontes',
    tags: ['lista', 'itens', 'enumitem'],
    title: 'Listas com Marcadores e Numeradas',
    code: '\\begin{itemize}\n  \\item Primeiro item\n  \\item Segundo item\n\\end{itemize}\n\\begin{enumerate}\n  \\item Etapa um\n  \\item Etapa dois\n\\end{enumerate}',
    note: 'Use \\usepackage{enumitem} para personalizar marcadores e espaçamento.',
  },
  {
    id: 'fontspec-ttf',
    category: 'Texto & Fontes',
    tags: ['fontes', 'ttf', 'otf', 'xelatex', 'lualatex'],
    title: 'Usar Fontes TTF/OTF do Sistema (fontspec)',
    code: '\\usepackage{fontspec}\n\\setmainfont{Times New Roman}\n\\setsansfont{Arial}\n\\setmonofont{JetBrains Mono}',
    note: 'Compile com XeLaTeX ou LuaLaTeX (não funciona em pdfLaTeX).',
  },
  {
    id: 'babel-ptbr',
    category: 'Texto & Fontes',
    tags: ['português', 'acentuação', 'babel'],
    title: 'Idioma Português Brasil e Acentuação',
    code: '\\usepackage[utf8]{inputenc}\n\\usepackage[T1]{fontenc}\n\\usepackage[brazil]{babel}',
    note: 'Essencial no pdfLaTeX para hifenização e títulos em português ("Figura", "Capítulo").',
  },
  {
    id: 'listings',
    category: 'Código & Pacotes',
    tags: ['código', 'listings', 'programação'],
    title: 'Código Fonte com Destaque (listings)',
    code: '\\usepackage{listings}\n\\begin{lstlisting}[language=Python, caption=Exemplo]\ndef soma(a, b):\n    return a + b\n\\end{lstlisting}',
    note: 'Suporta Python, C, Rust, Java, SQL, etc.',
  },
  {
    id: 'siunitx-units',
    category: 'Código & Pacotes',
    tags: ['unidades', 'física', 'siunitx'],
    title: 'Unidades do SI e Números (siunitx)',
    code: '\\usepackage{siunitx}\nVelocidade: \\qty{9.81}{\\meter\\per\\second\\squared}, ângulo: \\ang{45}.',
    note: 'Formata números e unidades científicas com espaçamento tipográfico correto.',
  },
  {
    id: 'beamer-frame',
    category: 'Beamer',
    tags: ['beamer', 'slide', 'apresentação'],
    title: 'Slide Beamer com Blocos e Colunas',
    code: '\\begin{frame}{Título do Slide}\n  \\begin{block}{Ideia Central}\n    Ponto principal da apresentação.\n  \\end{block}\n  \\begin{itemize}\n    \\item<1-> Primeiro tópico\n    \\item<2-> Segundo tópico\n  \\end{itemize}\n\\end{frame}',
    note: 'Use \\documentclass{beamer} e \\usetheme{Madrid} ou similar.',
  },
];

const CUSTOM_REF_KEY = 'forjatex_custom_quick_refs_v1';

interface QuickRefModalProps {
  open: boolean;
  onClose: () => void;
  onInsert: (code: string) => void;
}

export const QuickRefModal: React.FC<QuickRefModalProps> = ({
  open,
  onClose,
  onInsert,
}) => {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [customRefs, setCustomRefs] = useState<QuickRefItem[]>(() => {
    try {
      const raw = localStorage.getItem(CUSTOM_REF_KEY);
      const parsed: QuickRefItem[] = raw ? JSON.parse(raw) : [];
      return parsed.map((item) => ({
        ...item,
        tags: Array.isArray(item.tags) ? item.tags : [],
      }));
    } catch {
      return [];
    }
  });
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCat, setNewCat] = useState('Minhas Notas');
  const [newTags, setNewTags] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newNote, setNewNote] = useState('');

  useEffect(() => {
    localStorage.setItem(CUSTOM_REF_KEY, JSON.stringify(customRefs));
  }, [customRefs]);

  const all = useMemo(() => [...customRefs, ...BUILTIN_REFS], [customRefs]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    all.forEach((r) => set.add(r.category));
    return ['Todas', ...Array.from(set)];
  }, [all]);

  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    all.forEach((r) => {
      if (selectedCategory !== 'Todas' && r.category !== selectedCategory) return;
      r.tags.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1));
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 16)
      .map(([tag]) => tag);
  }, [all, selectedCategory]);

  if (!open) return null;

  const q = query.trim().toLowerCase();
  const filtered = all.filter((r) => {
    if (selectedCategory !== 'Todas' && r.category !== selectedCategory) return false;
    if (selectedTag && !r.tags.includes(selectedTag)) return false;
    if (!q) return true;
    return (
      r.title.toLowerCase().includes(q) ||
      r.category.toLowerCase().includes(q) ||
      r.code.toLowerCase().includes(q) ||
      r.note.toLowerCase().includes(q) ||
      r.tags.some((t) => t.toLowerCase().includes(q))
    );
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newCode.trim()) return;
    const parsedTags = newTags
      .split(',')
      .map((t) => t.trim().replace(/^#/, '').toLowerCase())
      .filter(Boolean);
    const item: QuickRefItem = {
      id: `ref-${Date.now()}`,
      title: newTitle.trim(),
      category: newCat.trim() || 'Minhas Notas',
      tags: parsedTags,
      code: newCode,
      note: newNote.trim(),
      custom: true,
    };
    setCustomRefs((p) => [item, ...p]);
    setNewTitle('');
    setNewTags('');
    setNewCode('');
    setNewNote('');
    setShowAdd(false);
  };

  return (
    <div className="tf-modal-backdrop" onClick={onClose}>
      <div className="tf-modal tf-modal-xl" onClick={(e) => e.stopPropagation()}>
        <div className="tf-modal-header">
          <h2 className="flex items-center gap-2">
            <BookOpen size={16} className="text-sky-400" /> Referência Rápida LaTeX (Offline)
            <span className="tf-brand-tag">{filtered.length} itens</span>
          </h2>
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
                placeholder="Buscar comando, pacote, #tag ou exemplo..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="tf-btn-primary"
              onClick={() => setShowAdd((v) => !v)}
            >
              <Plus size={13} /> Minha Referência
            </button>
          </div>

          {/* Categories bar */}
          <div className="tf-chip-row">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`tf-filter-chip ${selectedCategory === cat ? 'active' : ''}`}
                onClick={() => {
                  setSelectedCategory(cat);
                  setSelectedTag(null);
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Tags bar */}
          {allTags.length > 0 && (
            <div className="tf-chip-row tf-tag-row">
              <span className="text-[11px] text-slate-400 flex items-center gap-1 mr-1">
                <Hash size={11} /> Tags:
              </span>
              {allTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className={`tf-tag-chip ${selectedTag === tag ? 'active' : ''}`}
                  onClick={() => setSelectedTag((prev) => (prev === tag ? null : tag))}
                >
                  #{tag}
                </button>
              ))}
              {selectedTag && (
                <button
                  type="button"
                  className="tf-btn-small"
                  onClick={() => setSelectedTag(null)}
                >
                  Limpar tag
                </button>
              )}
            </div>
          )}

          {showAdd && (
            <form onSubmit={handleAdd} className="tf-builder-form tf-vars-box">
              <div className="tf-form-grid">
                <label>
                  <span>Título</span>
                  <input
                    required
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Ex: Capa ABNT"
                  />
                </label>
                <label>
                  <span>Categoria</span>
                  <input
                    type="text"
                    value={newCat}
                    onChange={(e) => setNewCat(e.target.value)}
                  />
                </label>
                <label className="tf-full-label">
                  <span>Tags (separadas por vírgula)</span>
                  <input
                    type="text"
                    value={newTags}
                    onChange={(e) => setNewTags(e.target.value)}
                    placeholder="Ex: abnt, capa, tcc"
                  />
                </label>
              </div>
              <label className="tf-full-label">
                <span>Código LaTeX</span>
                <textarea
                  required
                  rows={3}
                  className="tf-mono-textarea"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                />
              </label>
              <label className="tf-full-label">
                <span>Observação (opcional)</span>
                <input type="text" value={newNote} onChange={(e) => setNewNote(e.target.value)} />
              </label>
              <div className="flex justify-end">
                <button type="submit" className="tf-btn-primary">
                  Salvar Referência
                </button>
              </div>
            </form>
          )}

          <div className="tf-ref-list">
            {filtered.length === 0 && (
              <div className="tf-empty-note">
                Nenhuma referência encontrada com os filtros atuais.
              </div>
            )}
            {filtered.map((item) => (
              <div key={item.id} className="tf-ref-card">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="tf-brand-tag">{item.category}</span>
                    <strong>{item.title}</strong>
                    {item.tags.map((t) => (
                      <button
                        key={t}
                        type="button"
                        className={`tf-tag-chip ${selectedTag === t ? 'active' : ''}`}
                        onClick={() => setSelectedTag((prev) => (prev === t ? null : t))}
                      >
                        #{t}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {item.custom && (
                      <button
                        type="button"
                        className="tf-icon-btn"
                        onClick={() => setCustomRefs((p) => p.filter((x) => x.id !== item.id))}
                        title="Excluir referência"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                    <button
                      type="button"
                      className="tf-btn-small"
                      onClick={() => {
                        onInsert(item.code);
                        onClose();
                      }}
                    >
                      <Copy size={11} /> Inserir
                    </button>
                  </div>
                </div>
                <pre className="tf-live-code">{item.code}</pre>
                {item.note && <span className="text-[11px] text-slate-400">{item.note}</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
