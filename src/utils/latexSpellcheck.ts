import type * as Monaco from 'monaco-editor';

export type SpellLang = 'pt-BR' | 'en' | 'off';

const CUSTOM_DICT_KEY = 'forjatex_custom_dict_v1';

export function loadCustomDictionary(): Set<string> {
  try {
    const raw = localStorage.getItem(CUSTOM_DICT_KEY);
    const arr: string[] = raw ? JSON.parse(raw) : [];
    return new Set(arr.map((w) => w.toLowerCase()));
  } catch {
    return new Set();
  }
}

export function addWordToCustomDictionary(word: string): Set<string> {
  const dict = loadCustomDictionary();
  dict.add(word.toLowerCase());
  localStorage.setItem(CUSTOM_DICT_KEY, JSON.stringify(Array.from(dict)));
  return dict;
}

// Compact core vocabulary (PT-BR + EN academic/LaTeX prose) + common stopwords
const PT_CORE = new Set(
  (
    'a o e é de da do das dos em no na nos nas um uma uns umas para por com sem sob sobre entre ' +
    'que quem qual quais quando onde como porque pois mas porém contudo todavia entretanto logo ' +
    'se não sim também já ainda só apenas muito mais menos bem mal melhor pior grande pequeno ' +
    'novo nova novos novas bom boa bons boas primeiro primeira segundo segunda terceiro terceira ' +
    'este esta estes estas esse essa esses essas aquele aquela aquilo isto isso ' +
    'ser estar ter haver fazer poder dever ir vir ver dar saber querer dizer falar ' +
    'é são foi foram era eram será serão seja sejam sido estado ' +
    'tem têm tinha tinham teve tiveram terá terão tenha tenham tido ' +
    'há havia houve haverá pode podem podia podiam pôde puderam poderá ' +
    'deve devem devia deviam deverá faz fazem fazia faziam fez fizeram ' +
    'artigo trabalho projeto pesquisa estudo análise método metodologia resultado resultados ' +
    'introdução desenvolvimento conclusão resumo referências bibliografia capítulo seção subseção ' +
    'tabela figura quadro gráfico equação equações fórmula fórmulas teorema lema prova demonstração ' +
    'exemplo exemplos caso casos problema problemas solução soluções modelo modelos sistema sistemas ' +
    'dados valor valores número números função funções conjunto conjuntos matriz matrizes vetor vetores ' +
    'código texto documento arquivo arquivos pasta usuário usuários plataforma ferramenta ferramentas ' +
    'aplicação aplicações processo processos etapa etapas fase fases objetivo objetivos hipótese hipóteses ' +
    'forma formas maneira modo tipo tipos parte partes ponto pontos nível níveis grau graus ' +
    'tempo espaço área áreas campo campos base bases fonte fontes meio meios fim fins ' +
    'apresenta apresentam apresentado apresentada mostra mostram mostrado mostrar ' +
    'descreve descrevem descrito descrever define definem definido definir ' +
    'considera consideram considerado considerar utiliza utilizam utilizado utilizar usar uso ' +
    'permite permitem permitido permitir obtém obtêm obtido obter observa observam observado observar ' +
    'verifica verificam verificado verificar indica indicam indicado indicar ' +
    'conclui concluem concluído concluir nota notas observação observações ' +
    'além disso portanto assim sendo dessa desse desta deste neste nesta nesse nessa ' +
    'através mediante conforme segundo durante após antes depois enquanto até desde ' +
    'cada todo toda todos todas outro outra outros outras mesmo mesma mesmos mesmas ' +
    'próprio própria próprios próprias tal tais tanto tanta tantos tantas ' +
    'aqui ali lá cá hoje agora sempre nunca jamais talvez quase ' +
    'brasil português inglês ciência tecnologia matemática física química biologia computação engenharia ' +
    'universidade faculdade instituto curso disciplina professor aluna aluno estudantes ' +
    'forjatex latex tex overleaf miktex texlive pdf abnt'
  ).split(/\s+/)
);

const EN_CORE = new Set(
  (
    'the a an and or but if then else when while where which who whom whose what why how ' +
    'in on at to for of with by from as into like through after over between out against during ' +
    'without before under around among is are was were be been being have has had having ' +
    'do does did doing will would shall should can could may might must ' +
    'this that these those it its they them their theirs we us our ours you your yours i me my mine ' +
    'not no yes also very more most less least much many some any each every all both few several ' +
    'other another such same own new old good great high low first second third last next ' +
    'paper article work study research analysis method methodology result results ' +
    'introduction background related conclusion abstract references bibliography chapter section subsection ' +
    'table figure chart graph equation equations formula formulas theorem lemma proof ' +
    'example examples case cases problem problems solution solutions model models system systems ' +
    'data value values number numbers function functions set sets matrix matrices vector vectors ' +
    'code text document file files folder user users platform tool tools ' +
    'application applications process processes step steps phase phases goal goals hypothesis ' +
    'show shows shown define defines defined consider considers considered use uses used using ' +
    'allow allows allowed obtain obtains obtained observe observes observed note notes ' +
    'therefore however moreover furthermore thus hence since because although though ' +
    'forjatex latex tex overleaf miktex texlive pdf'
  ).split(/\s+/)
);

function looksValidMorphology(word: string, lang: SpellLang): boolean {
  const w = word.toLowerCase();
  if (w.length <= 2) return true;
  if (/^\d+$/.test(w)) return true;

  if (lang === 'pt-BR') {
    if (PT_CORE.has(w)) return true;
    // Common Portuguese suffixes
    if (
      w.endsWith('mente') ||
      w.endsWith('ção') ||
      w.endsWith('ções') ||
      w.endsWith('são') ||
      w.endsWith('sões') ||
      w.endsWith('dade') ||
      w.endsWith('dades') ||
      w.endsWith('ismo') ||
      w.endsWith('ista') ||
      w.endsWith('ável') ||
      w.endsWith('ível') ||
      w.endsWith('ando') ||
      w.endsWith('endo') ||
      w.endsWith('indo') ||
      w.endsWith('ado') ||
      w.endsWith('ada') ||
      w.endsWith('idos') ||
      w.endsWith('idas')
    ) {
      return true;
    }
    if (w.endsWith('s') && PT_CORE.has(w.slice(0, -1))) return true;
    if (w.endsWith('es') && PT_CORE.has(w.slice(0, -2))) return true;
  }

  if (lang === 'en') {
    if (EN_CORE.has(w)) return true;
    if (
      w.endsWith('tion') ||
      w.endsWith('tions') ||
      w.endsWith('ment') ||
      w.endsWith('ments') ||
      w.endsWith('ness') ||
      w.endsWith('able') ||
      w.endsWith('ible') ||
      w.endsWith('ing') ||
      w.endsWith('ed') ||
      w.endsWith('ly')
    ) {
      return true;
    }
    if (w.endsWith('s') && EN_CORE.has(w.slice(0, -1))) return true;
    if (w.endsWith('es') && EN_CORE.has(w.slice(0, -2))) return true;
  }

  return false;
}

const SKIP_ARG_COMMANDS = new Set([
  'begin',
  'end',
  'usepackage',
  'documentclass',
  'cite',
  'citep',
  'citet',
  'autocite',
  'textcite',
  'ref',
  'eqref',
  'pageref',
  'autoref',
  'cref',
  'label',
  'includegraphics',
  'input',
  'include',
  'bibliography',
  'bibliographystyle',
  'url',
  'href',
  'color',
  'definecolor',
  'setmainfont',
  'setsansfont',
  'setmonofont',
  'newfontfamily',
  'graphicspath',
]);

const SKIP_ENVS = new Set([
  'equation',
  'equation*',
  'align',
  'align*',
  'gather',
  'gather*',
  'multline',
  'multline*',
  'verbatim',
  'lstlisting',
  'minted',
  'tikzpicture',
  'pmatrix',
  'bmatrix',
  'vmatrix',
]);

/**
 * Masks LaTeX syntax (comments, math, commands, non-prose args) with spaces
 * while preserving exact line/column offsets for Monaco markers.
 */
export function maskLatexForProse(source: string): string {
  const chars = source.split('');
  const len = chars.length;
  let i = 0;

  const maskRange = (start: number, end: number) => {
    for (let k = start; k < end && k < len; k++) {
      if (chars[k] !== '\n') chars[k] = ' ';
    }
  };

  while (i < len) {
    // Escaped char \% \$ \& etc.
    if (chars[i] === '\\' && i + 1 < len && !/[a-zA-Z@]/.test(chars[i + 1])) {
      maskRange(i, i + 2);
      i += 2;
      continue;
    }

    // Comment % ...
    if (chars[i] === '%') {
      const start = i;
      while (i < len && chars[i] !== '\n') i++;
      maskRange(start, i);
      continue;
    }

    // Display math $$ ... $$
    if (chars[i] === '$' && chars[i + 1] === '$') {
      const start = i;
      i += 2;
      while (i < len - 1 && !(chars[i] === '$' && chars[i + 1] === '$')) i++;
      i = Math.min(len, i + 2);
      maskRange(start, i);
      continue;
    }

    // Inline math $ ... $
    if (chars[i] === '$') {
      const start = i;
      i++;
      while (i < len && chars[i] !== '$' && chars[i] !== '\n') {
        if (chars[i] === '\\') i++;
        i++;
      }
      if (i < len && chars[i] === '$') i++;
      maskRange(start, i);
      continue;
    }

    // LaTeX command \cmd
    if (chars[i] === '\\' && i + 1 < len && /[a-zA-Z@]/.test(chars[i + 1])) {
      const start = i;
      i++;
      while (i < len && /[a-zA-Z@*]/.test(chars[i])) i++;
      const cmd = source.slice(start + 1, i);
      maskRange(start, i);

      // Optional [...] after skipped commands
      if (SKIP_ARG_COMMANDS.has(cmd)) {
        while (i < len && (chars[i] === ' ' || chars[i] === '\t')) i++;
        if (chars[i] === '[') {
          const optStart = i;
          while (i < len && chars[i] !== ']' && chars[i] !== '\n') i++;
          if (chars[i] === ']') i++;
          maskRange(optStart, i);
        }
        while (i < len && (chars[i] === ' ' || chars[i] === '\t')) i++;
        if (chars[i] === '{') {
          const argStart = i;
          let depth = 0;
          while (i < len) {
            if (chars[i] === '{') depth++;
            else if (chars[i] === '}') {
              depth--;
              if (depth === 0) {
                i++;
                break;
              }
            }
            i++;
          }
          const argVal = source.slice(argStart + 1, i - 1).trim();
          maskRange(argStart, i);

          // Skip entire math/code environment body
          if (cmd === 'begin' && SKIP_ENVS.has(argVal)) {
            const endTag = `\\end{${argVal}}`;
            const endIdx = source.indexOf(endTag, i);
            if (endIdx !== -1) {
              maskRange(i, endIdx + endTag.length);
              i = endIdx + endTag.length;
            }
          }
        }
      }
      continue;
    }

    i++;
  }

  return chars.join('');
}

export function runLatexSpellAndGrammarCheck(
  monaco: typeof Monaco,
  model: Monaco.editor.ITextModel,
  lang: SpellLang
) {
  if (lang === 'off') {
    monaco.editor.setModelMarkers(model, 'forjatex-ltex', []);
    return;
  }

  const raw = model.getValue();
  const masked = maskLatexForProse(raw);
  const lines = masked.split('\n');
  const rawLines = raw.split('\n');
  const customDict = loadCustomDictionary();
  const markers: Monaco.editor.IMarkerData[] = [];

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    const rawLine = rawLines[lineIdx];
    const lineNumber = lineIdx + 1;

    // 1. Grammar: repeated words
    const repRegex = /\b([a-zA-ZÀ-ÿ]{2,})\s+\1\b/gi;
    let m: RegExpExecArray | null;
    while ((m = repRegex.exec(line)) !== null) {
      markers.push({
        severity: monaco.MarkerSeverity.Warning,
        message: `Palavra repetida: "${m[1]}"`,
        code: `ltex-repeat:${m[1]}`,
        startLineNumber: lineNumber,
        startColumn: m.index + 1,
        endLineNumber: lineNumber,
        endColumn: m.index + m[0].length + 1,
      });
    }

    // 2. Grammar: space before punctuation
    const spacePunctRegex = /\s+([,.;:!?])/g;
    while ((m = spacePunctRegex.exec(line)) !== null) {
      // Avoid flagging spaces introduced by masked commands right before punctuation
      const rawSlice = rawLine.slice(m.index, m.index + m[0].length);
      if (/^\s+[,.;:!?]$/.test(rawSlice)) {
        markers.push({
          severity: monaco.MarkerSeverity.Info,
          message: `Espaço extra antes da pontuação "${m[1]}"`,
          code: `ltex-space-punct:${m[1]}`,
          startLineNumber: lineNumber,
          startColumn: m.index + 1,
          endLineNumber: lineNumber,
          endColumn: m.index + m[0].length + 1,
        });
      }
    }

    // 3. LaTeX Style: straight quotes "..." in prose
    const quoteRegex = /"([^"\n]{1,60})"/g;
    while ((m = quoteRegex.exec(line)) !== null) {
      markers.push({
        severity: monaco.MarkerSeverity.Info,
        message: `Prefira aspas tipográficas LaTeX (\`\`...'' ) em vez de aspas retas`,
        code: `ltex-quotes:${m[1]}`,
        startLineNumber: lineNumber,
        startColumn: m.index + 1,
        endLineNumber: lineNumber,
        endColumn: m.index + m[0].length + 1,
      });
    }

    // 4. LaTeX Style: space instead of ~ before \cite / \ref / \eqref
    const tildeRegex = /([a-zA-ZÀ-ÿ0-9]) (\\(?:cite|ref|eqref)\{)/g;
    while ((m = tildeRegex.exec(rawLine)) !== null) {
      markers.push({
        severity: monaco.MarkerSeverity.Info,
        message: `Use espaço inquebrável (~) antes de \\cite ou \\ref`,
        code: `ltex-tilde`,
        startLineNumber: lineNumber,
        startColumn: m.index + 2,
        endLineNumber: lineNumber,
        endColumn: m.index + 3,
      });
    }

    // 5. Spellcheck unknown words (capped to keep editor snappy)
    if (markers.length < 120) {
      const wordRegex = /\b([a-zA-ZÀ-ÿ]{3,})\b/g;
      while ((m = wordRegex.exec(line)) !== null) {
        const word = m[1];
        // Skip ALL_CAPS acronyms
        if (word === word.toUpperCase()) continue;
        if (customDict.has(word.toLowerCase())) continue;
        if (looksValidMorphology(word, lang)) continue;

        markers.push({
          severity: monaco.MarkerSeverity.Hint,
          message: `Ortografia (${lang}): "${word}" não consta no dicionário local`,
          code: `ltex-spell:${word}`,
          startLineNumber: lineNumber,
          startColumn: m.index + 1,
          endLineNumber: lineNumber,
          endColumn: m.index + word.length + 1,
        });
      }
    }
  }

  monaco.editor.setModelMarkers(model, 'forjatex-ltex', markers);
}

let codeActionDisposable: Monaco.IDisposable | null = null;

export function registerLatexSpellCodeActions(
  monaco: typeof Monaco,
  onDictionaryUpdated: () => void
) {
  if (codeActionDisposable) {
    codeActionDisposable.dispose();
  }
  codeActionDisposable = monaco.languages.registerCodeActionProvider('latex', {
    provideCodeActions: (model, _range, context) => {
      const actions: Monaco.languages.CodeAction[] = [];

      for (const marker of context.markers) {
        const codeStr = typeof marker.code === 'string' ? marker.code : '';
        if (codeStr.startsWith('ltex-spell:')) {
          const word = codeStr.slice('ltex-spell:'.length);
          actions.push({
            title: `Adicionar "${word}" ao dicionário pessoal`,
            kind: 'quickfix',
            diagnostics: [marker],
            isPreferred: true,
            command: {
              id: 'forjatex.addSpellWord',
              title: 'Adicionar ao dicionário',
              arguments: [word],
            },
          });
        } else if (codeStr.startsWith('ltex-repeat:')) {
          const word = codeStr.slice('ltex-repeat:'.length);
          actions.push({
            title: `Remover palavra repetida ("${word}")`,
            kind: 'quickfix',
            diagnostics: [marker],
            isPreferred: true,
            edit: {
              edits: [
                {
                  resource: model.uri,
                  versionId: model.getVersionId(),
                  textEdit: { range: marker, text: word },
                },
              ],
            },
          });
        } else if (codeStr.startsWith('ltex-space-punct:')) {
          const punct = codeStr.slice('ltex-space-punct:'.length);
          actions.push({
            title: `Remover espaço antes de "${punct}"`,
            kind: 'quickfix',
            diagnostics: [marker],
            isPreferred: true,
            edit: {
              edits: [
                {
                  resource: model.uri,
                  versionId: model.getVersionId(),
                  textEdit: { range: marker, text: punct },
                },
              ],
            },
          });
        } else if (codeStr.startsWith('ltex-quotes:')) {
          const inner = codeStr.slice('ltex-quotes:'.length);
          actions.push({
            title: `Converter para aspas LaTeX (\`\`${inner}'')`,
            kind: 'quickfix',
            diagnostics: [marker],
            isPreferred: true,
            edit: {
              edits: [
                {
                  resource: model.uri,
                  versionId: model.getVersionId(),
                  textEdit: { range: marker, text: `\`\`${inner}''` },
                },
              ],
            },
          });
        } else if (codeStr === 'ltex-tilde') {
          actions.push({
            title: 'Substituir espaço por ~ (inquebrável)',
            kind: 'quickfix',
            diagnostics: [marker],
            isPreferred: true,
            edit: {
              edits: [
                {
                  resource: model.uri,
                  versionId: model.getVersionId(),
                  textEdit: { range: marker, text: '~' },
                },
              ],
            },
          });
        }
      }

      void onDictionaryUpdated;
      return { actions, dispose: () => {} };
    },
  });
}

