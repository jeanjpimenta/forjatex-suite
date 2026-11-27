export type BeamerTheme = 'Madrid' | 'Boadilla' | 'Berlin' | 'Warsaw' | 'Singapore' | 'metropolis';
export type BeamerColorTheme = 'default' | 'beaver' | 'dolphin' | 'seahorse' | 'crane';
export type BeamerAspect = '169' | '43';
export type SlideLayout = 'title' | 'toc' | 'single' | 'two-col' | 'blocks' | 'code';

export interface BeamerSlide {
  id: string;
  layout: SlideLayout;
  title: string;
  subtitle: string;
  body: string;
  rightBody: string;
  leftRatio: number; // 30..70
  incremental: boolean;
  blockType: 'block' | 'alertblock' | 'exampleblock' | 'theorem' | 'proof';
  blockTitle: string;
  codeLang: string;
  notes: string;
}

export interface BeamerProjectSnapshot {
  theme: BeamerTheme;
  colorTheme: BeamerColorTheme;
  aspect: BeamerAspect;
  docTitle: string;
  docSubtitle: string;
  author: string;
  institute: string;
  dateText: string;
  includeTitleSlide: boolean;
  includeToc: boolean;
  notesSecondScreen: boolean;
  langPortuguese: boolean;
  slides: BeamerSlide[];
  selectedSlideId: string;
  zoom: number;
}

export const THEME_COLORS: Record<BeamerColorTheme, { primary: string; secondary: string; alert: string; example: string }> = {
  default: { primary: '#1e3a8a', secondary: '#2563eb', alert: '#b91c1c', example: '#0f766e' },
  beaver: { primary: '#991b1b', secondary: '#dc2626', alert: '#b91c1c', example: '#15803d' },
  dolphin: { primary: '#0f172a', secondary: '#0284c7', alert: '#be123c', example: '#0d9488' },
  seahorse: { primary: '#312e81', secondary: '#6366f1', alert: '#be123c', example: '#0f766e' },
  crane: { primary: '#b45309', secondary: '#f59e0b', alert: '#b91c1c', example: '#047857' },
};

export function createDefaultBeamerSnapshot(): BeamerProjectSnapshot {
  const slides: BeamerSlide[] = [
    {
      id: 's1',
      layout: 'title',
      title: 'Capa da Apresentação',
      subtitle: 'Gerada automaticamente com \\titlepage',
      body: '',
      rightBody: '',
      leftRatio: 50,
      incremental: false,
      blockType: 'block',
      blockTitle: '',
      codeLang: 'python',
      notes: 'Dar boas-vindas ao público e apresentar o tema central em 30 segundos.',
    },
    {
      id: 's2',
      layout: 'toc',
      title: 'Roteiro',
      subtitle: '',
      body: '',
      rightBody: '',
      leftRatio: 50,
      incremental: false,
      blockType: 'block',
      blockTitle: '',
      codeLang: 'python',
      notes: 'Explicar brevemente as etapas da apresentação.',
    },
    {
      id: 's3',
      layout: 'two-col',
      title: 'Metodologia & Modelo',
      subtitle: 'Visão geral em duas colunas',
      body: '- Formulação matemática: $f(x) = \\sin(x) + 0.2x^2$\n- \\pause Validação numérica em tempo real\n- Comparação com dados experimentais',
      rightBody: '% Exemplo TikZ integrado\n\\begin{tikzpicture}[scale=0.7]\n  \\draw[->,thick] (-0.2,0) -- (3.2,0) node[right] {$x$};\n  \\draw[->,thick] (0,-0.2) -- (0,2.2) node[above] {$y$};\n  \\draw[blue,thick,domain=0:2.8] plot (\\x,{0.25*\\x*\\x});\n\\end{tikzpicture}',
      leftRatio: 52,
      incremental: true,
      blockType: 'block',
      blockTitle: '',
      codeLang: 'python',
      notes: 'Apontar para a curva quadrática na coluna da direita ao explicar o crescimento.',
    },
    {
      id: 's4',
      layout: 'blocks',
      title: 'Resultados Principais',
      subtitle: '',
      body: 'O modelo proposto reduziu o erro médio quadrático em **18,4%** mantendo estabilidade numérica.',
      rightBody: 'Atenção: exige passo de integração $\\Delta t < 0.01$ para convergência garantida.',
      leftRatio: 50,
      incremental: false,
      blockType: 'exampleblock',
      blockTitle: 'Ganho de Precisão',
      codeLang: 'python',
      notes: 'Reforçar o alerta sobre o passo de integração antes de abrir para perguntas.',
    },
  ];
  return {
    theme: 'Madrid',
    colorTheme: 'dolphin',
    aspect: '169',
    docTitle: 'Introdução à Modelagem Matemática',
    docSubtitle: 'Seminário de Pesquisa',
    author: 'Dr. Richard Feynman',
    institute: 'ForjaTeX / Instituto de Ciências',
    dateText: '\\today',
    includeTitleSlide: true,
    includeToc: true,
    notesSecondScreen: true,
    langPortuguese: true,
    slides,
    selectedSlideId: 's3',
    zoom: 1,
  };
}

function formatBullets(raw: string, incremental: boolean): string {
  const lines = raw.split('\n');
  const bulletLines = lines.filter((l) => l.trim().startsWith('- '));
  if (bulletLines.length === 0) return raw;

  const opt = incremental ? '[<+->]' : '';
  const out: string[] = [];
  let inList = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ')) {
      if (!inList) {
        out.push(`\\begin{itemize}${opt}`);
        inList = true;
      }
      let content = trimmed.slice(2).trim();
      content = content.replace(/\*\*(.+?)\*\*/g, '\\textbf{$1}');
      out.push(`  \\item ${content}`);
    } else {
      if (inList) {
        out.push('\\end{itemize}');
        inList = false;
      }
      if (trimmed) out.push(trimmed.replace(/\*\*(.+?)\*\*/g, '\\textbf{$1}'));
    }
  }
  if (inList) out.push('\\end{itemize}');
  return out.join('\n');
}

export function generateBeamerLatex(snap: BeamerProjectSnapshot): string {
  const usesCode = snap.slides.some((s) => s.layout === 'code');
  const usesTikz = snap.slides.some(
    (s) => s.body.includes('\\begin{tikzpicture}') || s.rightBody.includes('\\begin{tikzpicture}')
  );
  const usesTheorem = snap.slides.some(
    (s) => s.layout === 'blocks' && (s.blockType === 'theorem' || s.blockType === 'proof')
  );

  const lines: string[] = [
    `\\documentclass[aspectratio=${snap.aspect}]{beamer}`,
    '\\usepackage[utf8]{inputenc}',
    '\\usepackage[T1]{fontenc}',
  ];
  if (snap.langPortuguese) {
    lines.push('\\usepackage[brazil]{babel}');
  }
  lines.push('\\usepackage{amsmath,amssymb}');
  if (usesTikz) {
    lines.push('\\usepackage{tikz}');
  }
  if (usesCode) {
    lines.push('\\usepackage{listings}');
    lines.push('\\lstset{basicstyle=\\ttfamily\\small,breaklines=true,frame=single}');
  }
  if (usesTheorem) {
    lines.push('\\usepackage{amsthm}');
  }
  if (snap.notesSecondScreen) {
    lines.push('\\usepackage{pgfpages}');
    lines.push('\\setbeameroption{show notes on second screen=right}');
  }

  lines.push('');
  lines.push(`\\usetheme{${snap.theme}}`);
  if (snap.colorTheme !== 'default') {
    lines.push(`\\usecolortheme{${snap.colorTheme}}`);
  }
  lines.push('');
  lines.push(`\\title{${snap.docTitle}}`);
  if (snap.docSubtitle.trim()) lines.push(`\\subtitle{${snap.docSubtitle}}`);
  lines.push(`\\author{${snap.author}}`);
  if (snap.institute.trim()) lines.push(`\\institute{${snap.institute}}`);
  lines.push(`\\date{${snap.dateText || '\\today'}}`);
  lines.push('');
  lines.push('\\begin{document}');
  lines.push('');

  for (const s of snap.slides) {
    if (s.layout === 'title') {
      lines.push('\\begin{frame}');
      lines.push('  \\titlepage');
      if (s.notes.trim()) lines.push(`  \\note{${s.notes.trim()}}`);
      lines.push('\\end{frame}');
      lines.push('');
      continue;
    }

    if (s.layout === 'toc') {
      lines.push(`\\begin{frame}{${s.title || 'Roteiro'}}`);
      lines.push('  \\tableofcontents');
      if (s.notes.trim()) lines.push(`  \\note{${s.notes.trim()}}`);
      lines.push('\\end{frame}');
      lines.push('');
      continue;
    }

    if (s.layout === 'code') {
      lines.push(`\\begin{frame}[fragile]{${s.title}}`);
      if (s.subtitle.trim()) lines.push(`  \\framesubtitle{${s.subtitle}}`);
      lines.push(`\\begin{lstlisting}[language=${s.codeLang || 'python'}]`);
      lines.push(s.body || '# código');
      lines.push('\\end{lstlisting}');
      if (s.notes.trim()) lines.push(`  \\note{${s.notes.trim()}}`);
      lines.push('\\end{frame}');
      lines.push('');
      continue;
    }

    lines.push(`\\begin{frame}{${s.title}}`);
    if (s.subtitle.trim()) lines.push(`  \\framesubtitle{${s.subtitle}}`);

    if (s.layout === 'two-col') {
      const lw = (s.leftRatio / 100).toFixed(2);
      const rw = ((100 - s.leftRatio) / 100).toFixed(2);
      lines.push('  \\begin{columns}[T,onlytextwidth]');
      lines.push(`    \\begin{column}{${lw}\\textwidth}`);
      lines.push(formatBullets(s.body, s.incremental));
      lines.push('    \\end{column}');
      lines.push(`    \\begin{column}{${rw}\\textwidth}`);
      lines.push(formatBullets(s.rightBody, false));
      lines.push('    \\end{column}');
      lines.push('  \\end{columns}');
    } else if (s.layout === 'blocks') {
      const env = s.blockType || 'block';
      const titlePart = env === 'proof' ? '' : `{${s.blockTitle || 'Destaque'}}`;
      lines.push(`  \\begin{${env}}${titlePart}`);
      lines.push(`    ${formatBullets(s.body, s.incremental)}`);
      lines.push(`  \\end{${env}}`);
      if (s.rightBody.trim()) {
        lines.push('');
        lines.push('  \\begin{alertblock}{Observação}');
        lines.push(`    ${formatBullets(s.rightBody, false)}`);
        lines.push('  \\end{alertblock}');
      }
    } else {
      lines.push(formatBullets(s.body, s.incremental));
    }

    if (s.notes.trim()) {
      lines.push(`  \\note{${s.notes.trim()}}`);
    }
    lines.push('\\end{frame}');
    lines.push('');
  }

  lines.push('\\end{document}');
  return lines.join('\n');
}

function extractBalancedBrace(src: string, openBraceIdx: number): { value: string; endIdx: number } | null {
  if (src[openBraceIdx] !== '{') return null;
  let depth = 0;
  for (let i = openBraceIdx; i < src.length; i++) {
    const ch = src[i];
    if (ch === '\\') {
      i++;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        return { value: src.slice(openBraceIdx + 1, i), endIdx: i };
      }
    }
  }
  return null;
}

function extractCmdArg(src: string, cmd: string): string | null {
  const re = new RegExp(`\\\\${cmd}\\s*\\{`);
  const m = re.exec(src);
  if (!m) return null;
  const braceIdx = src.indexOf('{', m.index);
  if (braceIdx === -1) return null;
  return extractBalancedBrace(src, braceIdx)?.value ?? null;
}

function unformatBullets(raw: string): { text: string; incremental: boolean } {
  const incremental = /\\begin\{itemize\}\s*\[<\+->\]/.test(raw);
  let cleaned = raw
    .replace(/\\begin\{itemize\}(?:\s*\[<\+->\])?/g, '')
    .replace(/\\end\{itemize\}/g, '')
    .replace(/^\s*\\item\s+/gm, '- ')
    .replace(/\\textbf\{([^}]*)\}/g, '**$1**');
  cleaned = cleaned
    .split('\n')
    .map((l) => l.replace(/^\s{2,4}(?=- )/, ''))
    .join('\n')
    .trim();
  return { text: cleaned, incremental };
}

const VALID_THEMES: BeamerTheme[] = ['Madrid', 'Boadilla', 'Berlin', 'Warsaw', 'Singapore', 'metropolis'];
const VALID_COLORS: BeamerColorTheme[] = ['default', 'beaver', 'dolphin', 'seahorse', 'crane'];

export function parseBeamerLatexToSnapshot(
  tex: string,
  prev: BeamerProjectSnapshot
): BeamerProjectSnapshot {
  const next: BeamerProjectSnapshot = { ...prev };

  const aspectMatch = /\\documentclass\[[^\]]*aspectratio=(169|43)[^\]]*\]\{beamer\}/.exec(tex);
  if (aspectMatch) next.aspect = aspectMatch[1] as BeamerAspect;

  const themeArg = extractCmdArg(tex, 'usetheme');
  if (themeArg && VALID_THEMES.includes(themeArg.trim() as BeamerTheme)) {
    next.theme = themeArg.trim() as BeamerTheme;
  }

  const colorArg = extractCmdArg(tex, 'usecolortheme');
  if (colorArg && VALID_COLORS.includes(colorArg.trim() as BeamerColorTheme)) {
    next.colorTheme = colorArg.trim() as BeamerColorTheme;
  } else if (!/\\usecolortheme\{/.test(tex)) {
    next.colorTheme = 'default';
  }

  next.notesSecondScreen = /show notes on second screen\s*=\s*right/.test(tex);

  const docTitle = extractCmdArg(tex, 'title');
  if (docTitle !== null) next.docTitle = docTitle;
  const docSub = extractCmdArg(tex, 'subtitle');
  if (docSub !== null) next.docSubtitle = docSub;
  const author = extractCmdArg(tex, 'author');
  if (author !== null) next.author = author;
  const inst = extractCmdArg(tex, 'institute');
  if (inst !== null) next.institute = inst;
  const dateVal = extractCmdArg(tex, 'date');
  if (dateVal !== null) next.dateText = dateVal;

  const frameMatches = [...tex.matchAll(/\\begin\{frame\}([\s\S]*?)\\end\{frame\}/g)];
  if (frameMatches.length > 0) {
    const parsedSlides: BeamerSlide[] = frameMatches.map((m, idx) => {
      const existing = prev.slides[idx];
      let inner = m[1];
      let isFragile = false;
      if (/^\s*\[fragile\]/.test(inner)) {
        isFragile = true;
        inner = inner.replace(/^\s*\[fragile\]/, '');
      }

      let frameTitle = existing?.title ?? `Slide ${idx + 1}`;
      const trimmedStart = inner.trimStart();
      if (trimmedStart.startsWith('{')) {
        const bracePos = inner.indexOf('{');
        const extracted = extractBalancedBrace(inner, bracePos);
        if (extracted) {
          frameTitle = extracted.value;
          inner = inner.slice(extracted.endIdx + 1);
        }
      }

      let subtitle = '';
      const subMatch = /\\framesubtitle\s*\{/.exec(inner);
      if (subMatch) {
        const bPos = inner.indexOf('{', subMatch.index);
        const extracted = extractBalancedBrace(inner, bPos);
        if (extracted) {
          subtitle = extracted.value;
          inner = inner.slice(0, subMatch.index) + inner.slice(extracted.endIdx + 1);
        }
      }

      let notes = '';
      const noteMatch = /\\note\s*\{/.exec(inner);
      if (noteMatch) {
        const bPos = inner.indexOf('{', noteMatch.index);
        const extracted = extractBalancedBrace(inner, bPos);
        if (extracted) {
          notes = extracted.value.trim();
          inner = inner.slice(0, noteMatch.index) + inner.slice(extracted.endIdx + 1);
        }
      }

      const base: BeamerSlide = {
        id: existing?.id ?? `s-parsed-${idx + 1}`,
        layout: existing?.layout ?? 'single',
        title: frameTitle,
        subtitle,
        body: '',
        rightBody: '',
        leftRatio: existing?.leftRatio ?? 50,
        incremental: false,
        blockType: existing?.blockType ?? 'block',
        blockTitle: existing?.blockTitle ?? '',
        codeLang: existing?.codeLang ?? 'python',
        notes,
      };

      if (/\\titlepage\b/.test(inner)) {
        return { ...base, layout: 'title', title: frameTitle || 'Capa da Apresentação' };
      }
      if (/\\tableofcontents\b/.test(inner)) {
        return { ...base, layout: 'toc', title: frameTitle || 'Roteiro' };
      }

      const lstMatch = /\\begin\{lstlisting\}(?:\[language=([^\]]+)\])?([\s\S]*?)\\end\{lstlisting\}/.exec(inner);
      if (isFragile || lstMatch) {
        return {
          ...base,
          layout: 'code',
          codeLang: lstMatch?.[1]?.trim() || base.codeLang,
          body: (lstMatch?.[2] ?? inner).trim(),
        };
      }

      const colsMatch = /\\begin\{columns\}(?:\[[^\]]*\])?([\s\S]*?)\\end\{columns\}/.exec(inner);
      if (colsMatch) {
        const colMatches = [...colsMatch[1].matchAll(/\\begin\{column\}\{([0-9.]+)\\textwidth\}([\s\S]*?)\\end\{column\}/g)];
        const leftRaw = colMatches[0]?.[2] ?? '';
        const rightRaw = colMatches[1]?.[2] ?? '';
        const ratio = colMatches[0] ? Math.round(Number(colMatches[0][1]) * 100) : 50;
        const leftParsed = unformatBullets(leftRaw);
        const rightParsed = unformatBullets(rightRaw);
        return {
          ...base,
          layout: 'two-col',
          leftRatio: Math.min(70, Math.max(30, Number.isFinite(ratio) ? ratio : 50)),
          body: leftParsed.text,
          rightBody: rightParsed.text,
          incremental: leftParsed.incremental,
        };
      }

      const blkMatch = /\\begin\{(block|alertblock|exampleblock|theorem|proof)\}(?:\{([^}]*)\})?([\s\S]*?)\\end\{\1\}/.exec(inner);
      if (blkMatch) {
        const blkParsed = unformatBullets(blkMatch[3]);
        const afterBlk = inner.slice(blkMatch.index + blkMatch[0].length);
        const alertExtra = /\\begin\{alertblock\}\{[^}]*\}([\s\S]*?)\\end\{alertblock\}/.exec(afterBlk);
        return {
          ...base,
          layout: 'blocks',
          blockType: blkMatch[1] as BeamerSlide['blockType'],
          blockTitle: blkMatch[2] ?? '',
          body: blkParsed.text,
          rightBody: alertExtra ? unformatBullets(alertExtra[1]).text : '',
          incremental: blkParsed.incremental,
        };
      }

      const singleParsed = unformatBullets(inner);
      return {
        ...base,
        layout: 'single',
        body: singleParsed.text,
        incremental: singleParsed.incremental,
      };
    });

    next.slides = parsedSlides;
    if (!parsedSlides.some((s) => s.id === next.selectedSlideId)) {
      next.selectedSlideId = parsedSlides[0]?.id ?? '';
    }
  }

  return next;
}

