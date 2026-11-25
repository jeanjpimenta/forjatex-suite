import React, { useMemo, useState } from 'react';
import katex from 'katex';
import { Check, Combine, FileCode2, Grid3X3, Minus, Plus, Split, X } from 'lucide-react';

interface MatrixPreambleModalProps {
  open: boolean;
  onClose: () => void;
  onInsert: (code: string) => void;
}

interface MatrixCell {
  text: string;
  rowSpan: number;
  colSpan: number;
  hiddenBy?: { r: number; c: number };
}

function makeMatrixCell(text = '0'): MatrixCell {
  return { text, rowSpan: 1, colSpan: 1 };
}

export const MatrixPreambleModal: React.FC<MatrixPreambleModalProps> = ({
  open,
  onClose,
  onInsert,
}) => {
  const [tab, setTab] = useState<'matrix' | 'preamble'>('matrix');

  // Matrix state
  const [matrixMode, setMatrixMode] = useState<'simple' | 'nicematrix'>('simple');
  const [simpleEnv, setSimpleEnv] = useState<'pmatrix' | 'bmatrix' | 'vmatrix' | 'Bmatrix' | 'cases'>('pmatrix');
  const [niceDelim, setNiceDelim] = useState<'p' | 'b' | 'v' | 'B'>('b');
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);
  const [cells, setCells] = useState<MatrixCell[][]>([
    [makeMatrixCell('a_{11}'), makeMatrixCell('a_{12}'), makeMatrixCell('a_{13}')],
    [makeMatrixCell('a_{21}'), makeMatrixCell('a_{22}'), makeMatrixCell('a_{23}')],
    [makeMatrixCell('a_{31}'), makeMatrixCell('a_{32}'), makeMatrixCell('a_{33}')],
  ]);

  // Augmented dividers & external labels (nicematrix)
  const [vDividers, setVDividers] = useState<boolean[]>([false, false]); // between col i and i+1
  const [hDividers, setHDividers] = useState<boolean[]>([false, false]); // after row i
  const [useFirstRow, setUseFirstRow] = useState(false);
  const [firstRowLabels, setFirstRowLabels] = useState<string[]>(['x_1', 'x_2', 'x_3']);
  const [useLastCol, setUseLastCol] = useState(false);
  const [lastColLabels, setLastColLabels] = useState<string[]>(['R_1', 'R_2', 'R_3']);

  const [selStart, setSelStart] = useState<{ r: number; c: number }>({ r: 0, c: 0 });
  const [selEnd, setSelEnd] = useState<{ r: number; c: number }>({ r: 0, c: 0 });

  // Preamble state
  const [docClass, setDocClass] = useState('article');
  const [fontSize, setFontSize] = useState('12pt');
  const [paperSize, setPaperSize] = useState('a4paper');
  const [babelLang, setBabelLang] = useState('brazil');
  const [marginCm, setMarginCm] = useState('2.5cm');
  const [pkgs, setPkgs] = useState<Record<string, boolean>>({
    amsmath: true,
    nicematrix: false,
    booktabs: true,
    tabularray: false,
    siunitx: false,
    graphicx: true,
    hyperref: true,
  });

  const minR = Math.min(selStart.r, selEnd.r);
  const maxR = Math.max(selStart.r, selEnd.r);
  const minC = Math.min(selStart.c, selEnd.c);
  const maxC = Math.max(selStart.c, selEnd.c);
  const isMultiSelected = maxR > minR || maxC > minC;
  const activeCell = cells[selStart.r]?.[selStart.c];

  const matrixCode = useMemo(() => {
    if (matrixMode === 'simple') {
      const body = cells
        .map((row) => `  ${row.map((c) => c.text).join(' & ')}`)
        .join(' \\\\\n');
      return `\\begin{${simpleEnv}}\n${body}\n\\end{${simpleEnv}}`;
    }

    // nicematrix mode
    let colSpec = '';
    for (let c = 0; c < cols; c++) {
      colSpec += 'c';
      if (c < cols - 1 && vDividers[c]) colSpec += '|';
    }
    const opts: string[] = [];
    if (useFirstRow) opts.push('first-row');
    if (useLastCol) opts.push('last-col');
    const optStr = opts.length > 0 ? `[${opts.join(', ')}]` : '';

    const lines: string[] = [];
    if (useFirstRow) {
      const hdr = firstRowLabels.slice(0, cols).join(' & ');
      lines.push(useLastCol ? `  ${hdr} & \\text{Obs.} \\\\` : `  ${hdr} \\\\`);
    }

    cells.forEach((row, ri) => {
      const rowStr = row
        .map((cell) => {
          if (cell.hiddenBy) return '';
          if (cell.rowSpan > 1 || cell.colSpan > 1) {
            return `\\Block{${cell.rowSpan}-${cell.colSpan}}{${cell.text}}`;
          }
          return cell.text;
        })
        .join(' & ');
      const withLast = useLastCol ? `${rowStr} & ${lastColLabels[ri] ?? ''}` : rowStr;
      const hline = ri < rows - 1 && hDividers[ri] ? ' \\hline' : '';
      lines.push(`  ${withLast} \\\\${hline}`);
    });

    const envName = `${niceDelim}NiceArray`;
    return `\\begin{${envName}}{${colSpec}}${optStr}\n${lines.join('\n')}\n\\end{${envName}}`;
  }, [
    matrixMode,
    simpleEnv,
    niceDelim,
    cols,
    rows,
    cells,
    vDividers,
    hDividers,
    useFirstRow,
    firstRowLabels,
    useLastCol,
    lastColLabels,
  ]);

  const katexPreviewHtml = useMemo(() => {
    try {
      if (matrixMode === 'simple') {
        return katex.renderToString(matrixCode, { displayMode: true, throwOnError: false });
      }
      // Build a KaTeX-compatible \begin{array} approximation for nicematrix
      let colSpec = '';
      for (let c = 0; c < cols; c++) {
        colSpec += 'c';
        if (c < cols - 1 && vDividers[c]) colSpec += '|';
      }
      if (useLastCol) colSpec += 'c';

      const arrayLines: string[] = [];
      if (useFirstRow) {
        const hdr = firstRowLabels
          .slice(0, cols)
          .map((lbl) => `\\color{#94a3b8}{${lbl || ' '}}`)
          .join(' & ');
        arrayLines.push(useLastCol ? `${hdr} & \\color{#94a3b8}{\\text{Obs.}} \\\\` : `${hdr} \\\\`);
      }

      cells.forEach((row, ri) => {
        const rowStr = row
          .map((cell) => {
            if (cell.hiddenBy) return '\\cdot';
            if (cell.rowSpan > 1 || cell.colSpan > 1) {
              return `\\boxed{${cell.text || '0'}}`;
            }
            return cell.text || '0';
          })
          .join(' & ');
        const withLast = useLastCol
          ? `${rowStr} & \\color{#94a3b8}{${lastColLabels[ri] ?? ''}}`
          : rowStr;
        const hline = ri < rows - 1 && hDividers[ri] ? ' \\hline' : '';
        arrayLines.push(`${withLast} \\\\${hline}`);
      });

      const delimMap: Record<'p' | 'b' | 'v' | 'B', [string, string]> = {
        p: ['(', ')'],
        b: ['[', ']'],
        v: ['|', '|'],
        B: ['\\{', '\\}'],
      };
      const [ld, rd] = delimMap[niceDelim];
      const previewTex = `\\left${ld} \\begin{array}{${colSpec}}\n${arrayLines.join('\n')}\n\\end{array} \\right${rd}`;
      return katex.renderToString(previewTex, { displayMode: true, throwOnError: false });
    } catch {
      return '';
    }
  }, [
    matrixMode,
    matrixCode,
    cols,
    rows,
    cells,
    vDividers,
    hDividers,
    useFirstRow,
    firstRowLabels,
    useLastCol,
    lastColLabels,
    niceDelim,
  ]);

  if (!open) return null;

  const resize = (nr: number, nc: number) => {
    const r = Math.min(10, Math.max(1, nr));
    const c = Math.min(10, Math.max(1, nc));
    setRows(r);
    setCols(c);
    setCells((prev) =>
      Array.from({ length: r }, (_, ri) =>
        Array.from({ length: c }, (_, ci) => prev[ri]?.[ci] ?? makeMatrixCell('0'))
      )
    );
    setVDividers((prev) => Array.from({ length: Math.max(0, c - 1) }, (_, i) => prev[i] ?? false));
    setHDividers((prev) => Array.from({ length: Math.max(0, r - 1) }, (_, i) => prev[i] ?? false));
    setFirstRowLabels((prev) => Array.from({ length: c }, (_, i) => prev[i] ?? `x_${i + 1}`));
    setLastColLabels((prev) => Array.from({ length: r }, (_, i) => prev[i] ?? `R_${i + 1}`));
  };

  const handleMerge = () => {
    if (!isMultiSelected) return;
    const rSpan = maxR - minR + 1;
    const cSpan = maxC - minC + 1;
    setCells((prev) =>
      prev.map((row, ri) =>
        row.map((cell, ci) => {
          if (ri < minR || ri > maxR || ci < minC || ci > maxC) return cell;
          if (ri === minR && ci === minC) {
            return { ...cell, rowSpan: rSpan, colSpan: cSpan, hiddenBy: undefined };
          }
          return { text: '', rowSpan: 1, colSpan: 1, hiddenBy: { r: minR, c: minC } };
        })
      )
    );
    setSelStart({ r: minR, c: minC });
    setSelEnd({ r: minR, c: minC });
  };

  const handleUnmerge = () => {
    if (!activeCell || (activeCell.rowSpan === 1 && activeCell.colSpan === 1)) return;
    const r0 = selStart.r;
    const c0 = selStart.c;
    const r1 = r0 + activeCell.rowSpan - 1;
    const c1 = c0 + activeCell.colSpan - 1;
    setCells((prev) =>
      prev.map((row, ri) =>
        row.map((cell, ci) =>
          ri >= r0 && ri <= r1 && ci >= c0 && ci <= c1
            ? { ...cell, rowSpan: 1, colSpan: 1, hiddenBy: undefined }
            : cell
        )
      )
    );
  };

  const insertDotIntoSelected = (dotCmd: string) => {
    setCells((prev) =>
      prev.map((row, ri) =>
        row.map((cell, ci) =>
          ri === selStart.r && ci === selStart.c ? { ...cell, text: dotCmd } : cell
        )
      )
    );
  };

  const preambleCode = [
    `\\documentclass[${fontSize},${paperSize}]{${docClass}}`,
    `\\usepackage[utf8]{inputenc}`,
    `\\usepackage[T1]{fontenc}`,
    babelLang !== 'none' ? `\\usepackage[${babelLang}]{babel}` : null,
    marginCm ? `\\usepackage[margin=${marginCm}]{geometry}` : null,
    pkgs.amsmath ? `\\usepackage{amsmath,amssymb}` : null,
    pkgs.nicematrix ? `\\usepackage{nicematrix}` : null,
    pkgs.booktabs ? `\\usepackage{booktabs}` : null,
    pkgs.tabularray ? `\\usepackage{tabularray}\n\\UseTblrLibrary{booktabs,siunitx}` : null,
    pkgs.siunitx && !pkgs.tabularray ? `\\usepackage{siunitx}` : null,
    pkgs.graphicx ? `\\usepackage{graphicx}` : null,
    pkgs.hyperref ? `\\usepackage{hyperref}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <div className="tf-modal-backdrop" onClick={onClose}>
      <div className="tf-modal tf-modal-xl" onClick={(e) => e.stopPropagation()}>
        <div className="tf-modal-header">
          <div className="tf-modal-tabs">
            <button
              type="button"
              className={`tf-modal-tab ${tab === 'matrix' ? 'active' : ''}`}
              onClick={() => setTab('matrix')}
            >
              <Grid3X3 size={14} /> Assistente de Matriz
            </button>
            <button
              type="button"
              className={`tf-modal-tab ${tab === 'preamble' ? 'active' : ''}`}
              onClick={() => setTab('preamble')}
            >
              <FileCode2 size={14} /> Quick Start de Preâmbulo
            </button>
          </div>
          <button type="button" className="tf-icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="tf-modal-body tf-table-studio-body">
          {tab === 'matrix' ? (
            <>
              <div className="tf-studio-toolbar">
                <div className="tf-engine-pill-group">
                  <button
                    type="button"
                    className={matrixMode === 'simple' ? 'active' : ''}
                    onClick={() => setMatrixMode('simple')}
                  >
                    Simples (amsmath)
                  </button>
                  <button
                    type="button"
                    className={matrixMode === 'nicematrix' ? 'active' : ''}
                    onClick={() => setMatrixMode('nicematrix')}
                    title="Suporta matriz aumentada, blocos, rótulos e pontilhados contínuos"
                  >
                    Avançado (nicematrix)
                  </button>
                </div>

                {matrixMode === 'simple' ? (
                  <select
                    className="tf-select-compact"
                    value={simpleEnv}
                    onChange={(e) => setSimpleEnv(e.target.value as typeof simpleEnv)}
                  >
                    <option value="pmatrix">Parênteses (pmatrix)</option>
                    <option value="bmatrix">Colchetes [bmatrix]</option>
                    <option value="vmatrix">Determinante |vmatrix|</option>
                    <option value="Bmatrix">Chaves {'{Bmatrix}'}</option>
                    <option value="cases">Sistema / Casos (cases)</option>
                  </select>
                ) : (
                  <select
                    className="tf-select-compact"
                    value={niceDelim}
                    onChange={(e) => setNiceDelim(e.target.value as typeof niceDelim)}
                  >
                    <option value="b">Colchetes [bNiceArray]</option>
                    <option value="p">Parênteses (pNiceArray)</option>
                    <option value="v">Determinante |vNiceArray|</option>
                    <option value="B">Chaves {'{BNiceArray}'}</option>
                  </select>
                )}

                <span className="tf-fmt-sep" />
                <button type="button" className="tf-fmt-btn" onClick={() => resize(rows + 1, cols)}>
                  <Plus size={12} /> Linha
                </button>
                <button type="button" className="tf-fmt-btn" onClick={() => resize(rows - 1, cols)}>
                  <Minus size={12} /> Linha
                </button>
                <button type="button" className="tf-fmt-btn" onClick={() => resize(rows, cols + 1)}>
                  <Plus size={12} /> Col
                </button>
                <button type="button" className="tf-fmt-btn" onClick={() => resize(rows, cols - 1)}>
                  <Minus size={12} /> Col
                </button>

                {matrixMode === 'nicematrix' && (
                  <>
                    <span className="tf-fmt-sep" />
                    <button
                      type="button"
                      className="tf-fmt-btn"
                      disabled={!isMultiSelected}
                      onClick={handleMerge}
                      title="Mesclar bloco (Shift+Clique para selecionar)"
                    >
                      <Combine size={12} /> \Block
                    </button>
                    <button
                      type="button"
                      className="tf-fmt-btn"
                      disabled={!activeCell || (activeCell.rowSpan === 1 && activeCell.colSpan === 1)}
                      onClick={handleUnmerge}
                    >
                      <Split size={12} /> Separar
                    </button>
                    <span className="tf-fmt-sep" />
                    <button type="button" className="tf-fmt-btn" onClick={() => insertDotIntoSelected('\\Cdots')}>
                      ⋯ \Cdots
                    </button>
                    <button type="button" className="tf-fmt-btn" onClick={() => insertDotIntoSelected('\\Vdots')}>
                      ⋮ \Vdots
                    </button>
                    <button type="button" className="tf-fmt-btn" onClick={() => insertDotIntoSelected('\\Ddots')}>
                      ⋱ \Ddots
                    </button>
                  </>
                )}
              </div>

              {matrixMode === 'nicematrix' && (
                <div className="flex flex-wrap gap-4 text-xs text-slate-300">
                  <label className="tf-checkbox-inline">
                    <input
                      type="checkbox"
                      checked={useFirstRow}
                      onChange={(e) => setUseFirstRow(e.target.checked)}
                    />
                    <span>Rótulos acima (first-row)</span>
                  </label>
                  <label className="tf-checkbox-inline">
                    <input
                      type="checkbox"
                      checked={useLastCol}
                      onChange={(e) => setUseLastCol(e.target.checked)}
                    />
                    <span>Rótulos à direita (last-col)</span>
                  </label>
                </div>
              )}

              <div className="tf-table-grid-scroll">
                <table className="tf-wizard-grid">
                  {matrixMode === 'nicematrix' && (
                    <thead>
                      <tr>
                        {Array.from({ length: cols }, (_, ci) => (
                          <React.Fragment key={ci}>
                            <th className="tf-col-header">
                              {useFirstRow ? (
                                <input
                                  type="text"
                                  value={firstRowLabels[ci] ?? ''}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setFirstRowLabels((p) => p.map((x, i) => (i === ci ? v : x)));
                                  }}
                                  placeholder={`Col ${ci + 1}`}
                                />
                              ) : (
                                <span className="text-[10px] text-slate-500">Col {ci + 1}</span>
                              )}
                            </th>
                            {ci < cols - 1 && (
                              <th className="tf-aug-col-toggle">
                                <button
                                  type="button"
                                  className={vDividers[ci] ? 'active' : ''}
                                  onClick={() =>
                                    setVDividers((p) => p.map((x, i) => (i === ci ? !x : x)))
                                  }
                                  title="Alternar divisor vertical de matriz aumentada (|)"
                                >
                                  |
                                </button>
                              </th>
                            )}
                          </React.Fragment>
                        ))}
                        {useLastCol && <th className="tf-col-header text-[10px]">Rótulo Dir.</th>}
                      </tr>
                    </thead>
                  )}
                  <tbody>
                    {cells.map((row, ri) => (
                      <React.Fragment key={ri}>
                        <tr>
                          {row.map((cell, ci) => {
                            if (cell.hiddenBy) {
                              return ci < cols - 1 && matrixMode === 'nicematrix' ? (
                                <td key={`sp-${ci}`} className="tf-aug-spacer" />
                              ) : null;
                            }
                            const isSel = ri >= minR && ri <= maxR && ci >= minC && ci <= maxC;
                            return (
                              <React.Fragment key={ci}>
                                <td
                                  rowSpan={cell.rowSpan}
                                  colSpan={cell.colSpan}
                                  className={isSel ? 'tf-cell-selected' : ''}
                                  onClick={(e) => {
                                    if (e.shiftKey) setSelEnd({ r: ri, c: ci });
                                    else {
                                      setSelStart({ r: ri, c: ci });
                                      setSelEnd({ r: ri, c: ci });
                                    }
                                  }}
                                >
                                  <input
                                    type="text"
                                    value={cell.text}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      setCells((prev) =>
                                        prev.map((r, rIdx) =>
                                          r.map((c, cIdx) =>
                                            rIdx === ri && cIdx === ci ? { ...c, text: v } : c
                                          )
                                        )
                                      );
                                    }}
                                  />
                                </td>
                                {matrixMode === 'nicematrix' && ci < cols - 1 && (
                                  <td className={vDividers[ci] ? 'tf-aug-vline' : 'tf-aug-spacer'} />
                                )}
                              </React.Fragment>
                            );
                          })}
                          {matrixMode === 'nicematrix' && useLastCol && (
                            <td>
                              <input
                                type="text"
                                value={lastColLabels[ri] ?? ''}
                                className="header-cell"
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setLastColLabels((p) => p.map((x, i) => (i === ri ? v : x)));
                                }}
                              />
                            </td>
                          )}
                        </tr>
                        {matrixMode === 'nicematrix' && ri < rows - 1 && (
                          <tr>
                            <td colSpan={cols * 2} className="p-0">
                              <button
                                type="button"
                                className={`tf-aug-hline-btn ${hDividers[ri] ? 'active' : ''}`}
                                onClick={() =>
                                  setHDividers((p) => p.map((x, i) => (i === ri ? !x : x)))
                                }
                                title="Clique para alternar linha horizontal (\hline)"
                              />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>

              {katexPreviewHtml && (
                <div className="tf-katex-preview-box">
                  <div
                    className="tf-katex-render"
                    dangerouslySetInnerHTML={{ __html: katexPreviewHtml }}
                  />
                </div>
              )}

              <div className="tf-live-preview-box">
                <div className="tf-live-preview-header">
                  <span>
                    Pacotes:{' '}
                    <code>
                      {matrixMode === 'nicematrix'
                        ? '\\usepackage{amsmath, nicematrix} (compile 2x)'
                        : '\\usepackage{amsmath}'}
                    </code>
                  </span>
                </div>
                <pre className="tf-live-code">{matrixCode}</pre>
              </div>
            </>
          ) : (
            <>
              <div className="tf-form-grid">
                <label>
                  <span>Classe do Documento</span>
                  <select value={docClass} onChange={(e) => setDocClass(e.target.value)}>
                    <option value="article">article (Artigo)</option>
                    <option value="report">report (Relatório / TCC)</option>
                    <option value="book">book (Livro)</option>
                    <option value="beamer">beamer (Apresentação)</option>
                  </select>
                </label>
                <label>
                  <span>Tamanho da Fonte</span>
                  <select value={fontSize} onChange={(e) => setFontSize(e.target.value)}>
                    <option value="10pt">10pt</option>
                    <option value="11pt">11pt</option>
                    <option value="12pt">12pt</option>
                  </select>
                </label>
                <label>
                  <span>Papel</span>
                  <select value={paperSize} onChange={(e) => setPaperSize(e.target.value)}>
                    <option value="a4paper">A4</option>
                    <option value="letterpaper">Carta (Letter)</option>
                  </select>
                </label>
                <label>
                  <span>Idioma (babel)</span>
                  <select value={babelLang} onChange={(e) => setBabelLang(e.target.value)}>
                    <option value="brazil">Português (brazil)</option>
                    <option value="english">Inglês (english)</option>
                    <option value="none">Nenhum</option>
                  </select>
                </label>
              </div>

              <label className="tf-full-label">
                <span>Margens (geometry)</span>
                <input
                  type="text"
                  value={marginCm}
                  onChange={(e) => setMarginCm(e.target.value)}
                  placeholder="Ex: 2.5cm (deixe vazio para padrão)"
                />
              </label>

              <div className="flex flex-wrap gap-3">
                {Object.keys(pkgs).map((p) => (
                  <label key={p} className="tf-checkbox-inline">
                    <input
                      type="checkbox"
                      checked={pkgs[p]}
                      onChange={(e) => setPkgs((prev) => ({ ...prev, [p]: e.target.checked }))}
                    />
                    <span>{p}</span>
                  </label>
                ))}
              </div>
              <pre className="tf-live-code">{preambleCode}</pre>
            </>
          )}
        </div>

        <div className="tf-modal-footer">
          <button
            type="button"
            className="tf-btn-primary"
            onClick={() => {
              onInsert(tab === 'matrix' ? matrixCode : preambleCode);
              onClose();
            }}
          >
            <Check size={14} /> Inserir no Editor
          </button>
        </div>
      </div>
    </div>
  );
};
