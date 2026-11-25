import type * as Monaco from 'monaco-editor';
import katex from 'katex';
import type { ProjectIndex, UserTag } from '../types/ide';

let latexRegistered = false;
let completionDisposable: Monaco.IDisposable | null = null;
let hoverDisposable: Monaco.IDisposable | null = null;

export function registerLatexHoverProvider(monaco: typeof Monaco) {
  if (hoverDisposable) {
    hoverDisposable.dispose();
  }
  hoverDisposable = monaco.languages.registerHoverProvider('latex', {
    provideHover: (model, position) => {
      const lineText = model.getLineContent(position.lineNumber);
      const col = position.column - 1;

      // Match $...$ or $$...$$ around cursor on the same line
      const regex = /\$\$([^$]+)\$\$|\$([^$]+)\$/g;
      let m: RegExpExecArray | null;
      while ((m = regex.exec(lineText)) !== null) {
        const start = m.index;
        const end = m.index + m[0].length;
        if (col >= start && col <= end) {
          const math = (m[1] || m[2] || '').trim();
          if (!math) return null;
          try {
            const html = katex.renderToString(math, {
              displayMode: Boolean(m[1]),
              throwOnError: false,
            });
            return {
              range: new monaco.Range(
                position.lineNumber,
                start + 1,
                position.lineNumber,
                end + 1
              ),
              contents: [
                { value: '**Preview Matemático (KaTeX)**' },
                { value: html, supportHtml: true, isTrusted: true },
              ],
            };
          } catch {
            return null;
          }
        }
      }
      return null;
    },
  });
}

export function registerLatexCompletionProvider(
  monaco: typeof Monaco,
  getIndex: () => ProjectIndex,
  getUserTags?: () => UserTag[]
) {
  if (completionDisposable) {
    completionDisposable.dispose();
  }
  completionDisposable = monaco.languages.registerCompletionItemProvider('latex', {
    triggerCharacters: ['\\', '{', ':'],
    provideCompletionItems: (model, position) => {
      const linePrefix = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      });

      const index = getIndex();

      // User Tags triggered with :name
      const tagMatch = linePrefix.match(/(^|\s)(:[a-zA-Z0-9_-]*)$/);
      if (tagMatch && getUserTags) {
        const typed = tagMatch[2];
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: position.column - typed.length,
          endColumn: position.column,
        };
        return {
          suggestions: getUserTags().map((t) => ({
            label: t.trigger,
            kind: monaco.languages.CompletionItemKind.Snippet,
            detail: t.label,
            insertText: t.snippet,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            range,
          })),
        };
      }

      // \cite{...}
      if (/\\(?:cite|citep|citet|autocite|textcite)\{[^}]*$/.test(linePrefix)) {
        const match = linePrefix.match(/\{([^}]*)$/);
        const typedLen = match ? match[1].length : 0;
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: position.column - typedLen,
          endColumn: position.column,
        };
        return {
          suggestions: index.bib_keys.map((b) => ({
            label: b.key,
            kind: monaco.languages.CompletionItemKind.Reference,
            detail: `${b.entry_type} · ${b.author || b.file}`,
            documentation: b.title || undefined,
            insertText: b.key,
            range,
          })),
        };
      }

      // \ref{...} / \eqref{...} / \pageref{...}
      if (/\\(?:ref|eqref|pageref|autoref|cref)\{[^}]*$/.test(linePrefix)) {
        const match = linePrefix.match(/\{([^}]*)$/);
        const typedLen = match ? match[1].length : 0;
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: position.column - typedLen,
          endColumn: position.column,
        };
        return {
          suggestions: index.labels.map((l) => ({
            label: l.name,
            kind: monaco.languages.CompletionItemKind.Reference,
            detail: `${l.file}:${l.line}`,
            insertText: l.name,
            range,
          })),
        };
      }

      // General LaTeX commands & snippets after '\'
      const word = model.getWordUntilPosition(position);
      const startCol =
        linePrefix.endsWith('\\') ? position.column - 1 : Math.max(1, word.startColumn - 1);
      const hasSlash = linePrefix.slice(startCol - 1, startCol) === '\\';
      if (!hasSlash && !linePrefix.endsWith('\\')) {
        return { suggestions: [] };
      }

      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: startCol,
        endColumn: position.column,
      };

      const snippets: Array<[string, string, string]> = [
        ['\\section', '\\section{${1:Título}}', 'Seção numerada'],
        ['\\subsection', '\\subsection{${1:Subtítulo}}', 'Subseção numerada'],
        ['\\chapter', '\\chapter{${1:Capítulo}}', 'Capítulo'],
        ['\\textbf', '\\textbf{${1:texto}}', 'Texto em negrito'],
        ['\\textit', '\\textit{${1:texto}}', 'Texto em itálico'],
        ['\\emph', '\\emph{${1:texto}}', 'Ênfase'],
        ['\\cite', '\\cite{${1:chave}}', 'Citação bibliográfica'],
        ['\\ref', '\\ref{${1:label}}', 'Referência cruzada'],
        ['\\label', '\\label{${1:tipo:nome}}', 'Marcador de referência'],
        ['\\frac', '\\frac{${1:num}}{${2:den}}', 'Fração matemática'],
        ['\\sqrt', '\\sqrt{${1:x}}', 'Raiz quadrada'],
        ['\\sum', '\\sum_{${1:i=1}}^{${2:n}} ${3:x_i}', 'Somatório'],
        ['\\int', '\\int_{${1:a}}^{${2:b}} ${3:f(x)}\\,dx', 'Integral definida'],
        [
          '\\begin{equation}',
          '\\begin{equation}\n  ${1:E = mc^2}\n  \\label{eq:${2:nome}}\n\\end{equation}',
          'Equação numerada',
        ],
        [
          '\\begin{itemize}',
          '\\begin{itemize}\n  \\item ${1:Item 1}\n  \\item ${2:Item 2}\n\\end{itemize}',
          'Lista com marcadores',
        ],
        [
          '\\begin{enumerate}',
          '\\begin{enumerate}\n  \\item ${1:Item 1}\n  \\item ${2:Item 2}\n\\end{enumerate}',
          'Lista numerada',
        ],
        [
          '\\begin{figure}',
          '\\begin{figure}[htbp]\n  \\centering\n  \\includegraphics[width=0.8\\textwidth]{${1:imagem.png}}\n  \\caption{${2:Legenda}}\n  \\label{fig:${3:nome}}\n\\end{figure}',
          'Ambiente de figura',
        ],
        [
          '\\begin{table}',
          '\\begin{table}[htbp]\n  \\centering\n  \\caption{${1:Legenda}}\n  \\label{tab:${2:nome}}\n  \\begin{tabular}{${3:lcc}}\n    \\toprule\n    ${4:Coluna 1} & ${5:Coluna 2} \\\\\\\\\n    \\midrule\n    A & B \\\\\\\\\n    \\bottomrule\n  \\end{tabular}\n\\end{table}',
          'Tabela profissional (booktabs)',
        ],
        [
          '\\begin{frame}',
          '\\begin{frame}{${1:Título do Slide}}\n  ${2:Conteúdo}\n\\end{frame}',
          'Slide Beamer',
        ],
      ];

      return {
        suggestions: snippets.map(([label, insertText, detail]) => ({
          label,
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          detail,
          range,
        })),
      };
    },
  });
}

export function registerLatexLanguage(monaco: typeof Monaco) {
  if (latexRegistered) return;
  latexRegistered = true;

  monaco.languages.register({
    id: 'latex',
    extensions: ['.tex', '.sty', '.cls', '.ltx', '.bib'],
    aliases: ['LaTeX', 'latex', 'TeX'],
  });

  monaco.languages.setLanguageConfiguration('latex', {
    comments: {
      lineComment: '%',
    },
    brackets: [
      ['{', '}'],
      ['[', ']'],
      ['(', ')'],
    ],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '$', close: '$' },
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '$', close: '$' },
    ],
  });

  monaco.languages.setMonarchTokensProvider('latex', {
    tokenizer: {
      root: [
        [/%.*$/, 'comment'],
        [/\\begin\{[^}]+\}|\\end\{[^}]+\}/, 'keyword'],
        [/\\[a-zA-Z@]+\*?/, 'tag'],
        [/\\[^a-zA-Z\s]/, 'tag'],
        [/\$\$[\s\S]*?\$\$/, 'string'],
        [/\$[^$]*\$/, 'string'],
        [/[{}]/, 'delimiter.curly'],
        [/\[|\]/, 'delimiter.square'],
        [/&/, 'operator'],
      ],
    },
  });

  monaco.editor.defineTheme('texforge-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '64748B', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'F59E0B', fontStyle: 'bold' },
      { token: 'tag', foreground: '38BDF8' },
      { token: 'string', foreground: '34D399' },
      { token: 'delimiter.curly', foreground: 'CBD5E1' },
      { token: 'delimiter.square', foreground: '94A3B8' },
      { token: 'operator', foreground: 'F472B6' },
    ],
    colors: {
      'editor.background': '#0B111E',
      'editor.foreground': '#E2E8F0',
      'editor.lineHighlightBackground': '#131D31',
      'editorLineNumber.foreground': '#475569',
      'editorLineNumber.activeForeground': '#38BDF8',
      'editor.selectionBackground': '#0284C744',
      'editorCursor.foreground': '#F59E0B',
    },
  });

  monaco.editor.defineTheme('forjatex-light', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '64748B', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'B45309', fontStyle: 'bold' },
      { token: 'tag', foreground: '0369A1' },
      { token: 'string', foreground: '047857' },
      { token: 'delimiter.curly', foreground: '334155' },
      { token: 'delimiter.square', foreground: '475569' },
      { token: 'operator', foreground: 'BE185D' },
    ],
    colors: {
      'editor.background': '#F2F5F9',
      'editor.foreground': '#0F172A',
      'editor.lineHighlightBackground': '#E6ECF4',
      'editorLineNumber.foreground': '#94A3B8',
      'editorLineNumber.activeForeground': '#0284C7',
      'editor.selectionBackground': '#38BDF844',
      'editorCursor.foreground': '#D97706',
    },
  });
}

export function getMonacoLanguage(ext: string): string {
  switch (ext.toLowerCase()) {
    case 'tex':
    case 'cls':
    case 'sty':
    case 'bib':
    case 'ltx':
      return 'latex';
    case 'html':
    case 'htm':
      return 'html';
    case 'xml':
    case 'svg':
      return 'xml';
    case 'json':
      return 'json';
    case 'css':
      return 'css';
    case 'js':
      return 'javascript';
    case 'ts':
      return 'typescript';
    case 'md':
      return 'markdown';
    case 'yaml':
    case 'yml':
      return 'yaml';
    default:
      return 'plaintext';
  }
}

