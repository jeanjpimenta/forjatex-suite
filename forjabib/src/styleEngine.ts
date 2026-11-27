import type { BibEngineMode, BibEntry } from './bibEngine';

export interface CustomBibStyleConfig {
  engine: BibEngineMode;
  baseStyle:
    | 'authoryear'
    | 'numeric'
    | 'alphabetic'
    | 'abnt'
    | 'ieee'
    | 'apa'
    | 'plainnat'
    | 'abbrvnat'
    | 'unsrtnat'
    | 'abntex2-alf';
  givenInits: boolean;
  maxBibNames: number;
  maxCiteNames: number;
  dashed: boolean;
  showDoi: boolean;
  showUrl: boolean;
  showIsbn: boolean;
  nameOrder: 'default' | 'family-given' | 'given-family';
  titleFormat: 'default' | 'quote' | 'italic' | 'bold';
  venueFormat: 'italic' | 'bold' | 'normal';
  volumeFormat: 'normal' | 'bold' | 'parens-bold';
  unitPunct: 'period' | 'comma' | 'semicolon';
  natbibBrackets: 'round' | 'square';
  natbibSep: 'semicolon' | 'comma';
}

export function createDefaultStyleConfig(engine: BibEngineMode = 'biblatex'): CustomBibStyleConfig {
  return {
    engine,
    baseStyle: engine === 'natbib' ? 'plainnat' : 'authoryear',
    givenInits: true,
    maxBibNames: 99,
    maxCiteNames: 2,
    dashed: false,
    showDoi: true,
    showUrl: true,
    showIsbn: false,
    nameOrder: 'family-given',
    titleFormat: 'quote',
    venueFormat: 'italic',
    volumeFormat: 'bold',
    unitPunct: 'period',
    natbibBrackets: 'round',
    natbibSep: 'semicolon',
  };
}

export function generateBiblatexCfg(cfg: CustomBibStyleConfig): string {
  const lines: string[] = [
    '% Arquivo biblatex.cfg gerado pelo ForjaBib',
    '% Coloque na mesma pasta do seu .tex principal',
  ];
  if (cfg.nameOrder !== 'default') {
    lines.push(`\\DeclareNameAlias{sortname}{${cfg.nameOrder}}`);
    lines.push(`\\DeclareNameAlias{author}{${cfg.nameOrder}}`);
    lines.push(`\\DeclareNameAlias{editor}{${cfg.nameOrder}}`);
  }
  if (cfg.titleFormat === 'quote') {
    lines.push('\\DeclareFieldFormat[article,inproceedings,incollection]{title}{\\mkbibquote{#1}}');
  } else if (cfg.titleFormat === 'italic') {
    lines.push('\\DeclareFieldFormat{title}{\\mkbibemph{#1}}');
  } else if (cfg.titleFormat === 'bold') {
    lines.push('\\DeclareFieldFormat{title}{\\mkbibbold{#1}}');
  }

  if (cfg.venueFormat === 'bold') {
    lines.push('\\DeclareFieldFormat{journaltitle}{\\mkbibbold{#1}}');
    lines.push('\\DeclareFieldFormat{booktitle}{\\mkbibbold{#1}}');
  } else if (cfg.venueFormat === 'normal') {
    lines.push('\\DeclareFieldFormat{journaltitle}{#1}');
    lines.push('\\DeclareFieldFormat{booktitle}{#1}');
  }

  if (cfg.volumeFormat === 'bold') {
    lines.push('\\DeclareFieldFormat[article,periodical]{volume}{\\mkbibbold{#1}}');
  } else if (cfg.volumeFormat === 'parens-bold') {
    lines.push('\\DeclareFieldFormat[article,periodical]{volume}{\\mkbibbold{\\mkbibparens{#1}}}');
  }

  if (cfg.unitPunct === 'comma') {
    lines.push('\\renewcommand*{\\newunitpunct}{\\addcomma\\space}');
  } else if (cfg.unitPunct === 'semicolon') {
    lines.push('\\renewcommand*{\\newunitpunct}{\\addsemicolon\\space}');
  }

  return lines.join('\n');
}

export function generateStyleLatex(
  cfg: CustomBibStyleConfig,
  bibFileName: string,
  includeBibResource = true
): string {
  const cleanBib = bibFileName.trim() || 'referencias.bib';
  if (cfg.engine === 'natbib') {
    const base = ['plainnat', 'abbrvnat', 'unsrtnat', 'abntex2-alf'].includes(cfg.baseStyle)
      ? cfg.baseStyle
      : 'plainnat';
    const sep = cfg.natbibSep === 'semicolon' ? ';' : ',';
    const lines = [
      `\\usepackage{natbib}`,
      `\\setcitestyle{${cfg.natbibBrackets},citesep={${sep}}}`,
      `\\bibliographystyle{${base}}`,
    ];
    if (includeBibResource) {
      lines.push(`% No final do documento: \\bibliography{${cleanBib.replace(/\.bib$/i, '')}}`);
    }
    return lines.join('\n');
  }

  const opts: string[] = [
    `style=${cfg.baseStyle}`,
    'backend=biber',
    `giveninits=${cfg.givenInits}`,
    `maxbibnames=${cfg.maxBibNames}`,
    `maxcitenames=${cfg.maxCiteNames}`,
    `doi=${cfg.showDoi}`,
    `url=${cfg.showUrl}`,
    `isbn=${cfg.showIsbn}`,
  ];
  if (!cfg.dashed && (cfg.baseStyle === 'authoryear' || cfg.baseStyle === 'abnt')) {
    opts.push('dashed=false');
  }

  const lines: string[] = [`\\usepackage[${opts.join(', ')}]{biblatex}`];
  const cfgLines = generateBiblatexCfg(cfg)
    .split('\n')
    .filter((l) => !l.startsWith('%'));
  lines.push(...cfgLines);
  if (includeBibResource) {
    lines.push(`\\addbibresource{${cleanBib}}`);
  }
  return lines.join('\n');
}

export interface StyledPreviewData {
  authors: string;
  title: string;
  venue: string;
  volume: string;
  pages: string;
  year: string;
  punct: string;
  extras: string[];
  parencite: string;
  textcite: string;
}

function formatAuthorName(raw: string, cfg: CustomBibStyleConfig): string {
  const clean = raw.replace(/[{}]/g, '').trim();
  const isCorp = raw.trim().startsWith('{{');
  if (isCorp) return clean;

  let family = clean;
  let given = '';
  if (clean.includes(',')) {
    const [f, g] = clean.split(',').map((s) => s.trim());
    family = f;
    given = g || '';
  } else {
    const parts = clean.split(/\s+/);
    family = parts.pop() || clean;
    given = parts.join(' ');
  }

  if (cfg.givenInits && given) {
    given = given
      .split(/\s+/)
      .filter(Boolean)
      .map((p) => `${p[0].toUpperCase()}.`)
      .join(' ');
  }

  if (cfg.nameOrder === 'given-family') {
    return given ? `${given} ${family}` : family;
  }
  return given ? `${family}, ${given}` : family;
}

export function buildStyledPreview(
  e: BibEntry,
  cfg: CustomBibStyleConfig,
  indexNum: number
): StyledPreviewData {
  const rawAuth = e.fields.author || e.fields.editor || 'Autor';
  const authList = rawAuth.split(/\s+and\s+/i).map((a) => a.trim()).filter(Boolean);
  const shown = authList.slice(0, cfg.maxBibNames).map((a) => formatAuthorName(a, cfg));
  const authors =
    authList.length > cfg.maxBibNames
      ? `${shown.join('; ')} et al.`
      : shown.join('; ');

  const firstFamily = (authList[0] || 'Autor')
    .replace(/[{}]/g, '')
    .split(',')[0]
    .trim()
    .split(/\s+/)
    .pop() || 'Autor';
  const year = (e.fields.year || e.fields.date || 's.d.').slice(0, 4);

  const isNumeric =
    cfg.baseStyle === 'numeric' || cfg.baseStyle === 'ieee' || cfg.baseStyle === 'unsrtnat';
  const openD = cfg.engine === 'natbib' && cfg.natbibBrackets === 'square' ? '[' : '(';
  const closeD = cfg.engine === 'natbib' && cfg.natbibBrackets === 'square' ? ']' : ')';

  const citeAuth = authList.length > cfg.maxCiteNames ? `${firstFamily} et al.` : firstFamily;
  const parencite = isNumeric ? `[${indexNum}]` : `${openD}${citeAuth}, ${year}${closeD}`;
  const textcite = isNumeric ? `${citeAuth} [${indexNum}]` : `${citeAuth} ${openD}${year}${closeD}`;

  const rawTitle = (e.fields.title || 'Sem título').replace(/[{}]/g, '');
  const title = cfg.titleFormat === 'quote' ? `“${rawTitle}”` : rawTitle;
  const venue =
    e.fields.journal ||
    e.fields.journaltitle ||
    e.fields.booktitle ||
    e.fields.publisher ||
    e.fields.institution ||
    '';
  const volume = e.fields.volume
    ? cfg.volumeFormat === 'parens-bold'
      ? `(${e.fields.volume})`
      : `v. ${e.fields.volume}`
    : '';
  const pages = e.fields.pages ? `p. ${e.fields.pages.replace('--', '-')}` : '';
  const punct = cfg.unitPunct === 'comma' ? ', ' : cfg.unitPunct === 'semicolon' ? '; ' : '. ';

  const extras: string[] = [];
  if (cfg.showDoi && e.fields.doi) extras.push(`DOI: ${e.fields.doi}`);
  if (cfg.showUrl && e.fields.url) extras.push(`URL: ${e.fields.url}`);
  if (cfg.showIsbn && e.fields.isbn) extras.push(`ISBN: ${e.fields.isbn}`);

  return {
    authors,
    title,
    venue,
    volume,
    pages,
    year,
    punct,
    extras,
    parencite,
    textcite,
  };
}
