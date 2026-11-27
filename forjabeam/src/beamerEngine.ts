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
    author: 'Prof. Jean Pimenta',
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

