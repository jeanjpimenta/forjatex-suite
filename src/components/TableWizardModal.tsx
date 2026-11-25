import React, { useEffect, useMemo, useState } from 'react';
import {
  Bold,
  Check,
  ClipboardPaste,
  Combine,
  Copy,
  FolderOpen,
  Italic,
  Minus,
  Plus,
  Save,
  Split,
  Table,
  Trash2,
  X,
} from 'lucide-react';
import {
  type BorderStyle,
  type CellBgColor,
  type ColumnAlign,
  type TableCellData,
  type TableConfig,
  type TableEngine,
  type TableNote,
  generateTableOutput,
} from '../utils/tableGenerator';

const SAVED_TABLES_KEY = 'forjatex_saved_tables_v1';

interface SavedTableRecord {
  id: string;
  name: string;
  savedAt: number;
  config: TableConfig;
}

interface TableWizardModalProps {
  open: boolean;
  onClose: () => void;
  onInsert: (latexCode: string) => void;
}

function makeCell(text = ''): TableCellData {
  return { text, rowSpan: 1, colSpan: 1 };
}

export const TableWizardModal: React.FC<TableWizardModalProps> = ({
  open,
  onClose,
  onInsert,
}) => {
  const [engine, setEngine] = useState<TableEngine>('tabularray');
  const [columns, setColumns] = useState<ColumnAlign[]>(['l', 'c', 'c', 'S']);
  const [cells, setCells] = useState<TableCellData[][]>([
    [
      { ...makeCell('Modelo'), bold: true },
      { ...makeCell('Dataset'), bold: true },
      { ...makeCell('Métricas'), bold: true },
      { ...makeCell('Tempo (s)'), bold: true },
    ],
    [makeCell('AlphaNet'), makeCell('Base A'), makeCell('95.5\\%'), makeCell('0.12')],
    [makeCell('BetaModel'), makeCell('Base B'), makeCell('88.2\\%'), makeCell('0.45')],
  ]);

  const [borderStyle, setBorderStyle] = useState<BorderStyle>('booktabs');
  const [zebra, setZebra] = useState(false);
  const [multipage, setMultipage] = useState(false);
  const [wrapInTableEnv, setWrapInTableEnv] = useState(true);
  const [caption, setCaption] = useState('Resultados comparativos');
  const [label, setLabel] = useState('tab:resultados');
  const [notes, setNotes] = useState<TableNote[]>([]);
  const [pasteText, setPasteText] = useState('');
  const [showPaste, setShowPaste] = useState(false);
  const [copiedPkg, setCopiedPkg] = useState(false);

  const [savedTables, setSavedTables] = useState<SavedTableRecord[]>(() => {
    try {
      const raw = localStorage.getItem(SAVED_TABLES_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [showSavedPanel, setShowSavedPanel] = useState(false);
  const [saveName, setSaveName] = useState('');

  useEffect(() => {
    localStorage.setItem(SAVED_TABLES_KEY, JSON.stringify(savedTables));
  }, [savedTables]);

  const handleSaveCurrentTable = () => {
    const name = saveName.trim() || caption.trim() || `Tabela ${savedTables.length + 1}`;
    const record: SavedTableRecord = {
      id: `tbl-${Date.now()}`,
      name,
      savedAt: Date.now(),
      config: {
        engine,
        columns,
        cells,
        borderStyle,
        zebra,
        multipage,
        wrapInTableEnv,
        caption,
        label,
        notes,
      },
    };
    setSavedTables((prev) => [record, ...prev]);
    setSaveName('');
  };

  const handleLoadTable = (rec: SavedTableRecord) => {
    const c = rec.config;
    setEngine(c.engine);
    setColumns(c.columns);
    setCells(c.cells);
    setBorderStyle(c.borderStyle);
    setZebra(c.zebra);
    setMultipage(c.multipage);
    setWrapInTableEnv(c.wrapInTableEnv);
    setCaption(c.caption);
    setLabel(c.label);
    setNotes(c.notes);
    setShowSavedPanel(false);
  };

  // Selection range (start & end cell coords)
  const [selStart, setSelStart] = useState<{ r: number; c: number }>({ r: 0, c: 0 });
  const [selEnd, setSelEnd] = useState<{ r: number; c: number }>({ r: 0, c: 0 });
  const [activeColIdx, setActiveColIdx] = useState<number | null>(null);

  const output = useMemo(
    () =>
      generateTableOutput({
        engine,
        columns,
        cells,
        borderStyle,
        zebra,
        multipage,
        wrapInTableEnv,
        caption,
        label,
        notes,
      }),
    [engine, columns, cells, borderStyle, zebra, multipage, wrapInTableEnv, caption, label, notes]
  );

  if (!open) return null;

  const minR = Math.min(selStart.r, selEnd.r);
  const maxR = Math.max(selStart.r, selEnd.r);
  const minC = Math.min(selStart.c, selEnd.c);
  const maxC = Math.max(selStart.c, selEnd.c);
  const isMultiSelected = maxR > minR || maxC > minC;

  const activeCell = cells[selStart.r]?.[selStart.c];

  const handleCellClick = (r: number, c: number, e: React.MouseEvent) => {
    setActiveColIdx(null);
    if (e.shiftKey) {
      setSelEnd({ r, c });
    } else {
      setSelStart({ r, c });
      setSelEnd({ r, c });
    }
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
          return { ...cell, text: '', rowSpan: 1, colSpan: 1, hiddenBy: { r: minR, c: minC } };
        })
      )
    );
    setSelStart({ r: minR, c: minC });
    setSelEnd({ r: minR, c: minC });
  };

  const handleUnmerge = () => {
    const target = cells[selStart.r]?.[selStart.c];
    if (!target || (target.rowSpan === 1 && target.colSpan === 1)) return;
    const r0 = selStart.r;
    const c0 = selStart.c;
    const r1 = r0 + target.rowSpan - 1;
    const c1 = c0 + target.colSpan - 1;
    setCells((prev) =>
      prev.map((row, ri) =>
        row.map((cell, ci) => {
          if (ri >= r0 && ri <= r1 && ci >= c0 && ci <= c1) {
            return { ...cell, rowSpan: 1, colSpan: 1, hiddenBy: undefined };
          }
          return cell;
        })
      )
    );
  };

  const updateSelectedCells = (patch: Partial<TableCellData>) => {
    setCells((prev) =>
      prev.map((row, ri) =>
        row.map((cell, ci) => {
          if (ri >= minR && ri <= maxR && ci >= minC && ci <= maxC && !cell.hiddenBy) {
            return { ...cell, ...patch };
          }
          return cell;
        })
      )
    );
  };

  const addRow = () => {
    setCells((prev) => [...prev, Array.from({ length: columns.length }, () => makeCell(''))]);
  };

  const removeRow = () => {
    if (cells.length <= 1) return;
    setCells((prev) => prev.slice(0, -1));
  };

  const addCol = () => {
    if (columns.length >= 12) return;
    setColumns((prev) => [...prev, 'c']);
    setCells((prev) => prev.map((row) => [...row, makeCell('')]));
  };

  const removeCol = () => {
    if (columns.length <= 1) return;
    setColumns((prev) => prev.slice(0, -1));
    setCells((prev) => prev.map((row) => row.slice(0, -1)));
  };

  const handleParsePaste = () => {
    const lines = pasteText
      .trim()
      .split(/\r?\n/)
      .filter((l) => l.trim().length > 0);
    if (lines.length === 0) return;

    const sep = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
    const parsed = lines.map((l) => l.split(sep).map((cell) => cell.trim()));
    const maxCols = Math.min(12, Math.max(...parsed.map((r) => r.length)));
    setColumns(Array.from({ length: maxCols }, (_, i) => columns[i] ?? 'c'));
    setCells(
      parsed.slice(0, 25).map((r, ri) =>
        Array.from({ length: maxCols }, (_, ci) => ({
          ...makeCell(r[ci] ?? ''),
          bold: ri === 0,
        }))
      )
    );
    setShowPaste(false);
    setPasteText('');
  };

  const copyPackages = async () => {
    await navigator.clipboard.writeText(output.packages.join('\n')).catch(() => {});
    setCopiedPkg(true);
    setTimeout(() => setCopiedPkg(false), 2000);
  };

  return (
    <div className="tf-modal-backdrop" onClick={onClose}>
      <div className="tf-modal tf-modal-xl" onClick={(e) => e.stopPropagation()}>
        <div className="tf-modal-header">
          <div className="flex items-center gap-3">
            <h2 className="flex items-center gap-2">
              <Table size={16} className="text-sky-400" /> Estúdio Avançado de Tabelas
            </h2>
            <div className="tf-engine-pill-group">
              <button
                type="button"
                className={engine === 'tabularray' ? 'active' : ''}
                onClick={() => setEngine('tabularray')}
                title="Pacote moderno LaTeX3 (melhor para mesclagem, X e multipágina)"
              >
                tabularray (Moderno)
              </button>
              <button
                type="button"
                className={engine === 'classic' ? 'active' : ''}
                onClick={() => setEngine('classic')}
                title="Compatibilidade clássica (booktabs + multirow + threeparttable)"
              >
                Clássico (booktabs)
              </button>
            </div>
          </div>
          <button type="button" className="tf-icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="tf-modal-body tf-table-studio-body">
          {/* Toolbar */}
          <div className="tf-studio-toolbar">
            <button
              type="button"
              className="tf-fmt-btn"
              disabled={!isMultiSelected}
              onClick={handleMerge}
              title="Mesclar células selecionadas (use Shift+Clique para selecionar intervalo)"
            >
              <Combine size={13} /> Mesclar
            </button>
            <button
              type="button"
              className="tf-fmt-btn"
              disabled={!activeCell || (activeCell.rowSpan === 1 && activeCell.colSpan === 1)}
              onClick={handleUnmerge}
              title="Desfazer mesclagem"
            >
              <Split size={13} /> Separar
            </button>
            <span className="tf-fmt-sep" />
            <button
              type="button"
              className={`tf-fmt-btn ${activeCell?.bold ? 'active-fmt' : ''}`}
              onClick={() => updateSelectedCells({ bold: !activeCell?.bold })}
              title="Negrito na célula selecionada"
            >
              <Bold size={13} />
            </button>
            <button
              type="button"
              className={`tf-fmt-btn ${activeCell?.italic ? 'active-fmt' : ''}`}
              onClick={() => updateSelectedCells({ italic: !activeCell?.italic })}
              title="Itálico na célula selecionada"
            >
              <Italic size={13} />
            </button>
            <select
              className="tf-select-compact"
              value={activeCell?.bg ?? 'none'}
              onChange={(e) => updateSelectedCells({ bg: e.target.value as CellBgColor })}
              title="Cor de fundo da célula"
            >
              <option value="none">Sem cor</option>
              <option value="gray">Cinza suave</option>
              <option value="blue">Azul suave</option>
              <option value="amber">Âmbar suave</option>
              <option value="green">Verde suave</option>
              <option value="rose">Rosa suave</option>
            </select>
            <span className="tf-fmt-sep" />
            <button type="button" className="tf-fmt-btn" onClick={addRow} title="Adicionar linha">
              <Plus size={12} /> Linha
            </button>
            <button type="button" className="tf-fmt-btn" onClick={removeRow} title="Remover última linha">
              <Minus size={12} /> Linha
            </button>
            <button type="button" className="tf-fmt-btn" onClick={addCol} title="Adicionar coluna">
              <Plus size={12} /> Col
            </button>
            <button type="button" className="tf-fmt-btn" onClick={removeCol} title="Remover última coluna">
              <Minus size={12} /> Col
            </button>
            <span className="tf-fmt-sep" />
            <button
              type="button"
              className="tf-fmt-btn"
              onClick={() => setShowPaste((v) => !v)}
              title="Colar dados do Excel, Google Sheets ou CSV"
            >
              <ClipboardPaste size={13} /> Importar Excel/CSV
            </button>
            <button
              type="button"
              className={`tf-fmt-btn ${showSavedPanel ? 'active-fmt' : ''}`}
              onClick={() => setShowSavedPanel((v) => !v)}
              title="Salvar ou reabrir tabelas gravadas para futuras edições"
            >
              <FolderOpen size={13} /> Salvas ({savedTables.length})
            </button>
          </div>

          {showSavedPanel && (
            <div className="tf-saved-tables-box">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Nome para salvar esta tabela (opcional)..."
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  className="flex-1"
                />
                <button
                  type="button"
                  className="tf-btn-primary"
                  onClick={handleSaveCurrentTable}
                >
                  <Save size={13} /> Gravar Tabela Atual
                </button>
              </div>
              {savedTables.length > 0 && (
                <div className="tf-saved-tables-list">
                  {savedTables.map((rec) => (
                    <div key={rec.id} className="tf-saved-table-item">
                      <button
                        type="button"
                        className="tf-saved-table-load"
                        onClick={() => handleLoadTable(rec)}
                      >
                        <strong>{rec.name}</strong>
                        <span>
                          {rec.config.cells.length}×{rec.config.columns.length} · {rec.config.engine}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="tf-icon-btn"
                        title="Excluir tabela salva"
                        onClick={() =>
                          setSavedTables((prev) => prev.filter((item) => item.id !== rec.id))
                        }
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {showPaste && (
            <div className="tf-paste-box">
              <textarea
                rows={3}
                placeholder="Cole aqui células copiadas do Excel, Google Sheets ou CSV..."
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
              />
              <button type="button" className="tf-btn-secondary" onClick={handleParsePaste}>
                Aplicar na Grade
              </button>
            </div>
          )}

          {/* Grid + Column Settings */}
          <div className="tf-table-grid-scroll">
            <table className="tf-wizard-grid">
              <thead>
                <tr>
                  {columns.map((col, ci) => (
                    <th key={ci} className="tf-col-header">
                      <button
                        type="button"
                        className={`tf-col-btn ${activeColIdx === ci ? 'active' : ''}`}
                        onClick={() => setActiveColIdx(activeColIdx === ci ? null : ci)}
                        title="Clique para configurar tipo e alinhamento desta coluna"
                      >
                        Col {ci + 1} (<code>{col === 'p3' ? 'p{3cm}' : col}</code>)
                      </button>
                      {activeColIdx === ci && (
                        <select
                          className="tf-col-select"
                          value={col}
                          onChange={(e) => {
                            const next = [...columns];
                            next[ci] = e.target.value as ColumnAlign;
                            setColumns(next);
                          }}
                        >
                          <option value="l">Esquerda (l)</option>
                          <option value="c">Centro (c)</option>
                          <option value="r">Direita (r)</option>
                          <option value="X">Auto-quebra (X)</option>
                          <option value="p3">Largura 3cm (p)</option>
                          <option value="S">Numérico decimal (S)</option>
                        </select>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cells.map((row, ri) => (
                  <tr key={ri}>
                    {row.map((cell, ci) => {
                      if (cell.hiddenBy) return null;
                      const isSel = ri >= minR && ri <= maxR && ci >= minC && ci <= maxC;
                      return (
                        <td
                          key={ci}
                          rowSpan={cell.rowSpan}
                          colSpan={cell.colSpan}
                          className={`${isSel ? 'tf-cell-selected' : ''} ${
                            cell.bg && cell.bg !== 'none' ? `tf-cell-bg-${cell.bg}` : ''
                          }`}
                          onClick={(e) => handleCellClick(ri, ci, e)}
                        >
                          <input
                            type="text"
                            value={cell.text}
                            className={`${ri === 0 ? 'header-cell' : ''} ${
                              cell.bold ? 'font-bold' : ''
                            } ${cell.italic ? 'italic' : ''}`}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCells((prev) =>
                                prev.map((r, rIdx) =>
                                  r.map((c, cIdx) =>
                                    rIdx === ri && cIdx === ci ? { ...c, text: val } : c
                                  )
                                )
                              );
                            }}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="tf-grid-hint">
            Dica: Use <strong>Shift + Clique</strong> para selecionar um bloco de células e clicar em{' '}
            <strong>Mesclar</strong>. Clique no cabeçalho <strong>Col 1, Col 2...</strong> para definir
            alinhamento, largura ou coluna numérica <code>S</code> (<code>siunitx</code>).
          </div>

          {/* Options Row */}
          <div className="tf-studio-options">
            <label>
              <span>Bordas</span>
              <select
                value={borderStyle}
                onChange={(e) => setBorderStyle(e.target.value as BorderStyle)}
              >
                <option value="booktabs">Acadêmico (booktabs)</option>
                <option value="grid">Grade completa</option>
                <option value="minimal">Minimalista</option>
              </select>
            </label>

            <label>
              <span>Legenda (\caption)</span>
              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                disabled={!wrapInTableEnv && !multipage}
              />
            </label>

            <label>
              <span>Label (\label)</span>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                disabled={!wrapInTableEnv && !multipage}
              />
            </label>

            <label className="tf-checkbox-inline">
              <input type="checkbox" checked={zebra} onChange={(e) => setZebra(e.target.checked)} />
              <span>Zebra</span>
            </label>

            <label className="tf-checkbox-inline">
              <input
                type="checkbox"
                checked={multipage}
                onChange={(e) => setMultipage(e.target.checked)}
              />
              <span>Multipágina</span>
            </label>

            <label className="tf-checkbox-inline">
              <input
                type="checkbox"
                checked={wrapInTableEnv}
                onChange={(e) => setWrapInTableEnv(e.target.checked)}
              />
              <span>Ambiente table</span>
            </label>
          </div>

          {/* Table Notes */}
          <div className="tf-notes-box">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">
                Notas de Rodapé da Tabela ({notes.length})
              </span>
              <button
                type="button"
                className="tf-link-btn"
                onClick={() =>
                  setNotes((prev) => [
                    ...prev,
                    { id: prev.length + 1, text: 'Nota explicativa.' },
                  ])
                }
              >
                + Adicionar Nota (\tnote)
              </button>
            </div>
            {notes.map((n, idx) => (
              <div key={n.id} className="tf-note-row">
                <span className="text-xs text-amber-400">[{n.id}]</span>
                <input
                  type="text"
                  value={n.text}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNotes((prev) =>
                      prev.map((item, i) => (i === idx ? { ...item, text: val } : item))
                    );
                  }}
                />
                <button
                  type="button"
                  className="tf-icon-btn"
                  onClick={() => setNotes((prev) => prev.filter((_, i) => i !== idx))}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>

          {/* Live Code + Required Packages */}
          <div className="tf-live-preview-box">
            <div className="tf-live-preview-header">
              <span>
                Pacotes necessários: <code>{output.packages.join(' · ')}</code>
              </span>
              <button type="button" className="tf-link-btn" onClick={copyPackages}>
                {copiedPkg ? <Check size={12} /> : <Copy size={12} />}
                <span>{copiedPkg ? 'Pacotes copiados!' : 'Copiar \\usepackage'}</span>
              </button>
            </div>
            <pre className="tf-live-code">{output.code}</pre>
          </div>
        </div>

        <div className="tf-modal-footer">
          <button
            type="button"
            className="tf-btn-primary"
            onClick={() => {
              onInsert(output.code);
              onClose();
            }}
          >
            <Check size={14} /> Inserir Tabela no Editor
          </button>
        </div>
      </div>
    </div>
  );
};
