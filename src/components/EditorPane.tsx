import React, { useEffect, useRef } from 'react';
import Editor, { type OnMount } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import katex from 'katex';
import {
  Bold,
  Bookmark,
  BookMarked,
  Code,
  Columns2,
  Crosshair,
  FileCode2,
  FileImage,
  FoldVertical,
  Grid3X3,
  ImagePlus,
  Italic,
  List,
  Save,
  Sigma,
  Table,
  Tag,
  Type,
  UnfoldVertical,
  X,
} from 'lucide-react';
import type { OpenTab, ProjectIndex, UserTag } from '../types/ide';
import {
  getMonacoLanguage,
  registerLatexCompletionProvider,
  registerLatexLanguage,
} from '../utils/latexLanguage';
import {
  addWordToCustomDictionary,
  registerLatexSpellCodeActions,
  runLatexSpellAndGrammarCheck,
  type SpellLang,
} from '../utils/latexSpellcheck';
import { useI18n } from '../i18n';

interface EditorPaneProps {
  tabs: OpenTab[];
  activeTabPath: string | null;
  theme: 'dark' | 'light';
  projectIndex: ProjectIndex;
  userTags: UserTag[];
  pendingInsert?: { text: string; nonce: number } | null;
  onSelectTab: (path: string) => void;
  onCloseTab: (path: string) => void;
  onChangeContent: (path: string, content: string) => void;
  onSaveTab: (path: string) => void;
  onOpenTableWizard: () => void;
  onOpenMathSymbols: () => void;
  onOpenBibWizard: () => void;
  onOpenMatrixPreamble: () => void;
  onOpenTagsScripts: () => void;
  onOpenFontWizard: () => void;
  onOpenImageWizard: () => void;
  onForwardSync: (fileRel: string, line: number) => void;
}

function countRealWords(latex: string): number {
  const cleaned = latex
    .replace(/%.*$/gm, ' ')
    .replace(/\\begin\{[^}]*\}|\\end\{[^}]*\}/g, ' ')
    .replace(/\\[a-zA-Z@]+\*?(\[[^\]]*\])?/g, ' ')
    .replace(/\$[^$]*\$/g, ' ')
    .replace(/[{}[\]\\~&]/g, ' ');
  const tokens = cleaned.trim().split(/\s+/).filter(Boolean);
  return tokens.length;
}

export const EditorPane: React.FC<EditorPaneProps> = ({
  tabs,
  activeTabPath,
  theme,
  projectIndex,
  userTags,
  pendingInsert,
  onSelectTab,
  onCloseTab,
  onChangeContent,
  onSaveTab,
  onOpenTableWizard,
  onOpenMathSymbols,
  onOpenBibWizard,
  onOpenMatrixPreamble,
  onOpenTagsScripts,
  onOpenFontWizard,
  onOpenImageWizard,
  onForwardSync,
}) => {
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const indexRef = useRef<ProjectIndex>(projectIndex);
  indexRef.current = projectIndex;
  const tagsRef = useRef<UserTag[]>(userTags);
  tagsRef.current = userTags;
  const [sourceViewerTabPath, setSourceViewerTabPath] = React.useState<string | null>(null);
  const [showDiff, setShowDiff] = React.useState(false);
  const [bookmarksByFile, setBookmarksByFile] = React.useState<Record<string, (number | null)[]>>({});
  const [mathHover, setMathHover] = React.useState<{ html: string; top: number; left: number } | null>(null);
  const [rulerHover, setRulerHover] = React.useState<{
    top: number;
    spell: number;
    style: number;
    errors: number;
  } | null>(null);
  const { t } = useI18n();
  const [spellLang, setSpellLang] = React.useState<SpellLang>(() => {
    const saved = localStorage.getItem('forjatex_spell_lang_v1');
    return saved === 'en' || saved === 'off' ? saved : 'pt-BR';
  });
  const [dictVersion, setDictVersion] = React.useState(0);

  const activeTab = tabs.find((t) => t.path === activeTabPath) || null;
  const wordCount = activeTab && !activeTab.is_binary ? countRealWords(activeTab.content) : 0;
  const fileBookmarks = activeTab ? bookmarksByFile[activeTab.path] ?? [null, null, null] : [null, null, null];

  useEffect(() => {
    localStorage.setItem('forjatex_spell_lang_v1', spellLang);
  }, [spellLang]);

  useEffect(() => {
    if (!monacoRef.current || !editorRef.current || !activeTab || activeTab.is_binary) return;
    if (activeTab.extension !== 'tex' && activeTab.extension !== 'ltx') {
      const m = editorRef.current.getModel();
      if (m) monacoRef.current.editor.setModelMarkers(m, 'forjatex-ltex', []);
      return;
    }
    const timer = window.setTimeout(() => {
      const m = editorRef.current?.getModel();
      if (m && monacoRef.current) {
        runLatexSpellAndGrammarCheck(monacoRef.current, m, spellLang);
      }
    }, 550);
    return () => window.clearTimeout(timer);
  }, [activeTab?.path, activeTab?.content, activeTab?.extension, activeTab?.is_binary, spellLang, dictVersion]);

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    registerLatexLanguage(monaco);
    registerLatexCompletionProvider(
      monaco,
      () => indexRef.current,
      () => tagsRef.current
    );
    registerLatexSpellCodeActions(monaco, () => setDictVersion((v) => v + 1));
    monaco.editor.registerCommand('forjatex.addSpellWord', (_acc: unknown, word: string) => {
      if (word) {
        addWordToCustomDictionary(word);
        setDictVersion((v) => v + 1);
      }
    });
    monaco.editor.setTheme(theme === 'light' ? 'forjatex-light' : 'texforge-dark');

    editor.onMouseMove((e) => {
      const pos = e.target.position;
      const model = editor.getModel();
      if (!pos || !model || model.getLanguageId() !== 'latex') {
        setMathHover(null);
        return;
      }
      const lineText = model.getLineContent(pos.lineNumber);
      const col = pos.column - 1;
      const regex = /\$\$([^$]+)\$\$|\$([^$]+)\$|\\\(([^)]+)\\\)|\\\[([^\]]+)\\\]/g;
      let match: RegExpExecArray | null;
      while ((match = regex.exec(lineText)) !== null) {
        const start = match.index;
        const end = match.index + match[0].length;
        if (col >= start && col <= end) {
          const math = (match[1] || match[2] || match[3] || match[4] || '').trim();
          if (!math) break;
          const coords = editor.getScrolledVisiblePosition(pos);
          if (!coords) break;
          try {
            const html = katex.renderToString(math, {
              displayMode: Boolean(match[1] || match[4]),
              throwOnError: false,
            });
            setMathHover({
              html,
              top: Math.max(8, coords.top + coords.height + 6),
              left: Math.max(12, Math.min(coords.left, 420)),
            });
            return;
          } catch {
            break;
          }
        }
      }
      setMathHover(null);
    });

    editor.onMouseLeave(() => setMathHover(null));

    const attachRulerTooltip = () => {
      const ruler = editor.getDomNode()?.querySelector('.decorationsOverviewRuler') as HTMLElement | null;
      if (ruler) {
        ruler.title =
          'Marcadores de ortografia, estilo LaTeX e diagnósticos (clique para ir à linha)';
      }
    };
    attachRulerTooltip();
    window.setTimeout(attachRulerTooltip, 400);

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      if (activeTabPath) {
        onSaveTab(activeTabPath);
      }
    });
  };

  useEffect(() => {
    if (monacoRef.current) {
      monacoRef.current.editor.setTheme(theme === 'light' ? 'forjatex-light' : 'texforge-dark');
    }
  }, [theme]);

  const insertSnippetAtCursor = (text: string) => {
    const ed = editorRef.current;
    if (!ed) return;
    const sel = ed.getSelection();
    if (!sel) return;
    ed.executeEdits('forjatex-toolbar', [
      { range: sel, text, forceMoveMarkers: true },
    ]);
    ed.focus();
  };

  const wrapSelection = (before: string, after: string, fallback = 'texto') => {
    const ed = editorRef.current;
    if (!ed) return;
    const sel = ed.getSelection();
    const model = ed.getModel();
    if (!sel || !model) return;
    const selectedText = model.getValueInRange(sel) || fallback;
    ed.executeEdits('forjatex-wrap', [
      { range: sel, text: `${before}${selectedText}${after}`, forceMoveMarkers: true },
    ]);
    ed.focus();
  };

  useEffect(() => {
    if (!pendingInsert) return;
    insertSnippetAtCursor(pendingInsert.text);
  }, [pendingInsert]);

  // SyncTeX jump-to-line when double-clicking in PDF
  useEffect(() => {
    if (!activeTab?.jumpToLine || !editorRef.current) return;
    const line = activeTab.jumpToLine;
    editorRef.current.revealLineInCenter(line);
    editorRef.current.setPosition({ lineNumber: line, column: 1 });
    editorRef.current.focus();
  }, [activeTab?.path, activeTab?.jumpToLine]);

  return (
    <div className="tf-editor-pane">
      <div className="tf-panel-header">
        <span className="tf-panel-title">
          EDITOR {activeTab ? `— ${activeTab.relative_path}` : ''}
        </span>
        <div className="flex items-center gap-2">
          {activeTab && !activeTab.is_binary && (
            <>
              <select
                className="tf-select-compact"
                value={spellLang}
                onChange={(e) => setSpellLang(e.target.value as SpellLang)}
                title="Corretor Ortográfico e Gramatical LaTeX-Aware"
              >
                <option value="pt-BR">{t('editor.spellPt')}</option>
                <option value="en">{t('editor.spellEn')}</option>
                <option value="off">{t('editor.spellOff')}</option>
              </select>
              <span className="tf-word-count" title="Contagem de palavras reais (ignorando comandos LaTeX)">
                {wordCount} {t('editor.words')}
              </span>
            </>
          )}
          {tabs.length > 0 && (
            <button
              type="button"
              className={`tf-fmt-btn ${sourceViewerTabPath ? 'active-fmt' : ''}`}
              onClick={() =>
                setSourceViewerTabPath((prev) =>
                  prev ? null : tabs.find((t) => t.path !== activeTabPath)?.path ?? tabs[0]?.path ?? null
                )
              }
              title="Abrir Visualizador de Referência lado a lado (Source Viewer)"
            >
              <Columns2 size={12} /> {t('editor.reference')}
            </button>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="tf-tabs-bar">
        <div className="tf-tabs-list">
          {tabs.map((tab) => {
            const isActive = tab.path === activeTabPath;
            return (
              <div
                key={tab.path}
                className={`tf-tab ${isActive ? 'active' : ''}`}
                onClick={() => onSelectTab(tab.path)}
                title={tab.relative_path}
              >
                {tab.is_binary ? (
                  <FileImage size={13} className="text-emerald-400 shrink-0" />
                ) : (
                  <FileCode2 size={13} className="text-sky-400 shrink-0" />
                )}
                <span className="tf-tab-name">{tab.name}</span>
                {tab.dirty && <span className="tf-dirty-dot" title="Alterações não salvas" />}
                <button
                  type="button"
                  className="tf-tab-close"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.path);
                  }}
                >
                  <X size={12} />
                </button>
              </div>
            );
          })}
        </div>

        {activeTab && !activeTab.is_binary && (
          <button
            type="button"
            className={`tf-save-btn ${activeTab.dirty ? 'dirty' : ''}`}
            onClick={() => onSaveTab(activeTab.path)}
            title="Salvar arquivo (Ctrl+S)"
          >
            <Save size={13} />
            <span>Salvar</span>
          </button>
        )}
      </div>

      {/* LaTeX Quick Formatting Toolbar */}
      {activeTab && !activeTab.is_binary && (activeTab.extension === 'tex' || activeTab.extension === 'bib') && (
        <div className="tf-latex-toolbar">
          {activeTab.extension === 'tex' && (
            <>
              <button
                type="button"
                className="tf-fmt-btn"
                onClick={() => wrapSelection('\\textbf{', '}')}
                title="Negrito (\textbf{})"
              >
                <Bold size={13} />
              </button>
              <button
                type="button"
                className="tf-fmt-btn"
                onClick={() => wrapSelection('\\textit{', '}')}
                title="Itálico (\textit{})"
              >
                <Italic size={13} />
              </button>
              <button
                type="button"
                className="tf-fmt-btn"
                onClick={() => wrapSelection('\\texttt{', '}')}
                title="Monoespaçado (\texttt{})"
              >
                <Code size={13} />
              </button>
              <span className="tf-fmt-sep" />
              <button
                type="button"
                className="tf-fmt-btn"
                onClick={() => wrapSelection('$', '$', 'x')}
                title="Matemática inline ($...$)"
              >
                $x$
              </button>
              <button
                type="button"
                className="tf-fmt-btn"
                onClick={() => wrapSelection('$$\n  ', '\n$$', 'E = mc^2')}
                title="Equação em destaque ($$...$$)"
              >
                $$
              </button>
              <button
                type="button"
                className="tf-fmt-btn"
                onClick={onOpenMathSymbols}
                title="Inserir Símbolos Matemáticos"
              >
                <Sigma size={13} /> Símbolos
              </button>
              <span className="tf-fmt-sep" />
              <button
                type="button"
                className="tf-fmt-btn"
                onClick={() =>
                  insertSnippetAtCursor('\\begin{itemize}\n  \\item \n\\end{itemize}')
                }
                title="Inserir lista (itemize)"
              >
                <List size={13} />
              </button>
              <button
                type="button"
                className="tf-fmt-btn"
                onClick={onOpenImageWizard}
                title="Assistente Visual de Imagem (\includegraphics)"
              >
                <ImagePlus size={13} /> Imagem
              </button>
              <button
                type="button"
                className="tf-fmt-btn"
                onClick={onOpenTableWizard}
                title="Estúdio Avançado de Tabelas"
              >
                <Table size={13} /> Tabela
              </button>
              <button
                type="button"
                className="tf-fmt-btn"
                onClick={onOpenMatrixPreamble}
                title="Assistente de Matrizes & Quick Start de Preâmbulo"
              >
                <Grid3X3 size={13} /> Matriz / Preâmbulo
              </button>
              <button
                type="button"
                className="tf-fmt-btn"
                onClick={onOpenFontWizard}
                title="Assistente de Fontes (.ttf, .otf e clássicas)"
              >
                <Type size={13} /> Fontes
              </button>
              <button
                type="button"
                className="tf-fmt-btn"
                onClick={onOpenTagsScripts}
                title="User Tags (:gatilho) e Scripts de Automação"
              >
                <Tag size={13} /> Tags / Scripts
              </button>
              <span className="tf-fmt-sep" />
              {([0, 1, 2] as const).map((slot) => {
                const ln = fileBookmarks[slot];
                return (
                  <button
                    key={slot}
                    type="button"
                    className={`tf-bookmark-pill ${ln ? 'set' : ''}`}
                    onClick={() => {
                      if (ln && editorRef.current) {
                        editorRef.current.revealLineInCenter(ln);
                        editorRef.current.setPosition({ lineNumber: ln, column: 1 });
                        editorRef.current.focus();
                      } else if (activeTab && editorRef.current) {
                        const cur = editorRef.current.getPosition()?.lineNumber ?? 1;
                        setBookmarksByFile((prev) => {
                          const arr = [...(prev[activeTab.path] ?? [null, null, null])];
                          arr[slot] = cur;
                          return { ...prev, [activeTab.path]: arr };
                        });
                      }
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      if (!activeTab || !editorRef.current) return;
                      const cur = editorRef.current.getPosition()?.lineNumber ?? 1;
                      setBookmarksByFile((prev) => {
                        const arr = [...(prev[activeTab.path] ?? [null, null, null])];
                        arr[slot] = arr[slot] === cur ? null : cur;
                        return { ...prev, [activeTab.path]: arr };
                      });
                    }}
                    title={
                      ln
                        ? `Ir para Bookmark B${slot + 1} (linha ${ln}) — botão direito para atualizar/limpar`
                        : `Marcar Bookmark B${slot + 1} na linha atual`
                    }
                  >
                    <Bookmark size={10} fill={ln ? 'currentColor' : 'none'} />
                    {ln ? `B${slot + 1}:${ln}` : `B${slot + 1}`}
                  </button>
                );
              })}
              <span className="tf-fmt-sep" />
              <button
                type="button"
                className="tf-fmt-btn"
                onClick={() => editorRef.current?.getAction('editor.foldAll')?.run()}
                title="Dobrar tudo"
              >
                <FoldVertical size={13} />
              </button>
              <button
                type="button"
                className="tf-fmt-btn"
                onClick={() => editorRef.current?.getAction('editor.unfoldAll')?.run()}
                title="Desdobrar tudo"
              >
                <UnfoldVertical size={13} />
              </button>
              <span className="tf-fmt-sep" />
              <button
                type="button"
                className="tf-fmt-btn accent"
                onClick={() => {
                  const line = editorRef.current?.getPosition()?.lineNumber ?? 1;
                  onForwardSync(activeTab.relative_path, line);
                }}
                title="SyncTeX Reverso: rolar PDF para a linha atual do cursor"
              >
                <Crosshair size={13} /> Sync → PDF
              </button>
            </>
          )}
          <button
            type="button"
            className="tf-fmt-btn"
            onClick={onOpenBibWizard}
            title="Assistente de Bibliografia (.bib) e busca por DOI"
          >
            <BookMarked size={13} /> BibTeX / DOI
          </button>
        </div>
      )}

      {/* Content area */}
      <div className="tf-editor-body">
        {!activeTab ? (
          <div className="tf-welcome-center">
            <img src="/favicon.png" alt="ForjaTeX" className="w-12 h-12 rounded-xl opacity-80" />
            <h3>ForjaTeX LaTeX IDE</h3>
            <p>
              Selecione um arquivo no Explorer à esquerda para editar <code>.tex</code>, <code>.cls</code>,{' '}
              <code>.bib</code>, <code>.html</code>, <code>.xml</code> ou visualizar imagens.
            </p>
            <div className="tf-shortcuts">
              <span><code>Ctrl+S</code> Salvar</span>
              <span><code>1 clique no PDF</code> Destacar arquivo no Explorer</span>
              <span><code>2 cliques no PDF</code> Abrir/ir para a linha</span>
            </div>
          </div>
        ) : activeTab.is_binary ? (
          <div className="tf-media-viewer">
            {activeTab.mime_type.startsWith('image/') ? (
              <img
                src={`data:${activeTab.mime_type};base64,${activeTab.content}`}
                alt={activeTab.name}
                className="tf-preview-image"
              />
            ) : (
              <div className="tf-binary-notice">
                Arquivo binário ({activeTab.mime_type}) — visualização direta suportada para imagens e PDF na aba direita.
              </div>
            )}
          </div>
        ) : (
          <div className="tf-editor-with-ref">
            <div
              className="tf-editor-main-col"
              style={{ position: 'relative' }}
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                if (e.clientX >= rect.right - 22 && monacoRef.current && editorRef.current) {
                  const model = editorRef.current.getModel();
                  if (!model) return;
                  const markers = monacoRef.current.editor.getModelMarkers({ resource: model.uri });
                  if (markers.length === 0) {
                    setRulerHover(null);
                    return;
                  }
                  let spell = 0;
                  let style = 0;
                  let errors = 0;
                  for (const mk of markers) {
                    const c = typeof mk.code === 'string' ? mk.code : '';
                    if (c.startsWith('ltex-spell:')) spell++;
                    else if (c.startsWith('ltex-')) style++;
                    else errors++;
                  }
                  setRulerHover({
                    top: Math.max(12, Math.min(rect.height - 96, e.clientY - rect.top - 16)),
                    spell,
                    style,
                    errors,
                  });
                } else if (rulerHover) {
                  setRulerHover(null);
                }
              }}
              onMouseLeave={() => setRulerHover(null)}
            >
              {rulerHover && (
                <div className="tf-ruler-hover-popup" style={{ top: rulerHover.top, right: 24 }}>
                  <div className="tf-math-hover-title">{t('editor.rulerTitle')}</div>
                  <div className="text-[11px] flex flex-col gap-0.5">
                    <span>• {t('editor.rulerSpell')}: <strong>{rulerHover.spell}</strong></span>
                    <span>• {t('editor.rulerStyle')}: <strong>{rulerHover.style}</strong></span>
                    {rulerHover.errors > 0 && (
                      <span className="text-rose-400">• {t('editor.rulerErrors')}: <strong>{rulerHover.errors}</strong></span>
                    )}
                    <span className="text-[10px] text-slate-400 mt-1">{t('editor.rulerHint')}</span>
                  </div>
                </div>
              )}
              {mathHover && (
                <div
                  className="tf-math-hover-popup"
                  style={{ top: mathHover.top, left: mathHover.left }}
                >
                  <div className="tf-math-hover-title">Preview Matemático</div>
                  <div dangerouslySetInnerHTML={{ __html: mathHover.html }} />
                </div>
              )}
              <Editor
                height="100%"
                path={activeTab.path}
                language={getMonacoLanguage(activeTab.extension)}
                value={activeTab.content}
                theme={theme === 'light' ? 'forjatex-light' : 'texforge-dark'}
                onMount={handleMount}
                onChange={(val) => onChangeContent(activeTab.path, val ?? '')}
                options={{
                  fontSize: 14,
                  fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
                  minimap: { enabled: false },
                  wordWrap: 'on',
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  tabSize: 2,
                  renderWhitespace: 'selection',
                }}
              />
            </div>

            {sourceViewerTabPath && (
              <div className="tf-source-viewer-col">
                <div className="tf-source-viewer-header">
                  <button
                    type="button"
                    className={`tf-fmt-btn ${showDiff ? 'active-fmt' : ''}`}
                    onClick={() => setShowDiff((v) => !v)}
                    title="Comparar diferenças linha a linha com o arquivo ativo"
                  >
                    {showDiff ? 'Ver Texto' : 'Diff'}
                  </button>
                  <select
                    className="tf-select-compact flex-1"
                    value={sourceViewerTabPath}
                    onChange={(e) => setSourceViewerTabPath(e.target.value)}
                  >
                    {tabs
                      .filter((t) => !t.is_binary)
                      .map((t) => (
                        <option key={t.path} value={t.path}>
                          {t.relative_path}
                        </option>
                      ))}
                  </select>
                </div>
                {showDiff ? (
                  <div className="tf-source-viewer-pre">
                    {(() => {
                      const refLines = (
                        tabs.find((t) => t.path === sourceViewerTabPath)?.content ?? ''
                      ).split('\n');
                      const curLines = activeTab.content.split('\n');
                      const maxLen = Math.max(refLines.length, curLines.length);
                      return Array.from({ length: maxLen }, (_, idx) => {
                        const a = refLines[idx];
                        const b = curLines[idx];
                        if (a === b) {
                          return (
                            <div key={idx} className="tf-diff-same">
                              {b ?? ''}
                            </div>
                          );
                        }
                        return (
                          <React.Fragment key={idx}>
                            {a !== undefined && <div className="tf-diff-del">- {a}</div>}
                            {b !== undefined && <div className="tf-diff-add">+ {b}</div>}
                          </React.Fragment>
                        );
                      });
                    })()}
                  </div>
                ) : (
                  <pre className="tf-source-viewer-pre">
                    {tabs.find((t) => t.path === sourceViewerTabPath)?.content ?? ''}
                  </pre>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
