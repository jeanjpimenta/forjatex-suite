export type BibEntryType =
  | 'article'
  | 'periodical'
  | 'suppperiodical'
  | 'book'
  | 'mvbook'
  | 'inbook'
  | 'bookinbook'
  | 'suppbook'
  | 'booklet'
  | 'collection'
  | 'mvcollection'
  | 'incollection'
  | 'suppcollection'
  | 'inproceedings'
  | 'proceedings'
  | 'mvproceedings'
  | 'conference'
  | 'thesis'
  | 'phdthesis'
  | 'mastersthesis'
  | 'report'
  | 'techreport'
  | 'manual'
  | 'reference'
  | 'mvreference'
  | 'inreference'
  | 'online'
  | 'electronic'
  | 'www'
  | 'dataset'
  | 'software'
  | 'patent'
  | 'unpublished'
  | 'misc'
  | 'set';

export const BIB_TYPE_GROUPS: Array<{ label: string; types: Array<{ id: BibEntryType; desc: string }> }> = [
  {
    label: 'Artigos e Periódicos',
    types: [
      { id: 'article', desc: 'Artigo em periódico/revista' },
      { id: 'periodical', desc: 'Edição completa de periódico' },
      { id: 'suppperiodical', desc: 'Suplemento de periódico' },
    ],
  },
  {
    label: 'Livros e Coletâneas',
    types: [
      { id: 'book', desc: 'Livro completo' },
      { id: 'mvbook', desc: 'Obra em múltiplos volumes' },
      { id: 'inbook', desc: 'Capítulo de livro (mesmo autor)' },
      { id: 'bookinbook', desc: 'Livro publicado dentro de outro' },
      { id: 'suppbook', desc: 'Material suplementar de livro' },
      { id: 'booklet', desc: 'Livreto / folheto sem editora' },
      { id: 'collection', desc: 'Coletânea organizada por editor' },
      { id: 'mvcollection', desc: 'Coletânea em múltiplos volumes' },
      { id: 'incollection', desc: 'Capítulo com autor próprio em coletânea' },
      { id: 'suppcollection', desc: 'Suplemento de coletânea' },
    ],
  },
  {
    label: 'Eventos e Anais',
    types: [
      { id: 'inproceedings', desc: 'Artigo em anais de congresso' },
      { id: 'proceedings', desc: 'Anais completos de evento' },
      { id: 'mvproceedings', desc: 'Anais em múltiplos volumes' },
      { id: 'conference', desc: 'Alias legado de inproceedings' },
    ],
  },
  {
    label: 'Teses, Relatórios e Manuais',
    types: [
      { id: 'thesis', desc: 'Tese/Dissertação (BibLaTeX)' },
      { id: 'phdthesis', desc: 'Tese de Doutorado (BibTeX)' },
      { id: 'mastersthesis', desc: 'Dissertação de Mestrado (BibTeX)' },
      { id: 'report', desc: 'Relatório técnico/pesquisa (BibLaTeX)' },
      { id: 'techreport', desc: 'Relatório técnico (BibTeX)' },
      { id: 'manual', desc: 'Manual técnico / documentação' },
    ],
  },
  {
    label: 'Obras de Referência',
    types: [
      { id: 'reference', desc: 'Enciclopédia / dicionário' },
      { id: 'mvreference', desc: 'Referência em múltiplos volumes' },
      { id: 'inreference', desc: 'Verbete de enciclopédia/dicionário' },
    ],
  },
  {
    label: 'Digitais, Dados e Outros',
    types: [
      { id: 'online', desc: 'Página web / recurso online' },
      { id: 'electronic', desc: 'Alias de online' },
      { id: 'www', desc: 'Alias de online' },
      { id: 'dataset', desc: 'Conjunto de dados (Dataset)' },
      { id: 'software', desc: 'Software / pacote / repositório' },
      { id: 'patent', desc: 'Patente / pedido de patente' },
      { id: 'unpublished', desc: 'Manuscrito não publicado' },
      { id: 'misc', desc: 'Diversos / arXiv preprint' },
      { id: 'set', desc: 'Conjunto agrupado (entryset)' },
    ],
  },
];

export type BibEngineMode = 'biblatex' | 'natbib';

export type CitationStyle =
  | 'abnt'
  | 'abnt-num'
  | 'ieee'
  | 'apa'
  | 'authoryear'
  | 'numeric'
  | 'alphabetic'
  | 'chicago-authordate'
  | 'chicago-notes'
  | 'mla'
  | 'vancouver'
  | 'harvard'
  | 'nature'
  | 'science'
  | 'acm'
  | 'springer-lncs'
  | 'aps'
  | 'iso690';

export const CITATION_STYLES: Array<{ id: CitationStyle; label: string; group: string }> = [
  { id: 'abnt', label: 'ABNT (NBR 6023 — Autor-Data)', group: 'Brasil' },
  { id: 'abnt-num', label: 'ABNT Numérico (NBR 6023)', group: 'Brasil' },
  { id: 'ieee', label: 'IEEE Transactions', group: 'Engenharia' },
  { id: 'apa', label: 'APA 7ª Edição', group: 'Psicologia / Gerais' },
  { id: 'authoryear', label: 'BibLaTeX Author-Year', group: 'BibLaTeX' },
  { id: 'numeric', label: 'BibLaTeX Numeric [1]', group: 'BibLaTeX' },
  { id: 'alphabetic', label: 'BibLaTeX Alphabetic [Fey49]', group: 'BibLaTeX' },
  { id: 'chicago-authordate', label: 'Chicago (Author-Date)', group: 'Humanidades' },
  { id: 'chicago-notes', label: 'Chicago (Notes & Bibliography)', group: 'Humanidades' },
  { id: 'mla', label: 'MLA 9ª Edição', group: 'Letras / Artes' },
  { id: 'vancouver', label: 'Vancouver (Saúde / Medicina)', group: 'Biomédicas' },
  { id: 'harvard', label: 'Harvard Referencing', group: 'Acadêmico' },
  { id: 'nature', label: 'Nature', group: 'Ciências' },
  { id: 'science', label: 'Science', group: 'Ciências' },
  { id: 'acm', label: 'ACM Reference Format', group: 'Computação' },
  { id: 'springer-lncs', label: 'Springer LNCS', group: 'Computação' },
  { id: 'aps', label: 'APS / Physical Review', group: 'Física' },
  { id: 'iso690', label: 'ISO 690', group: 'Internacional' },
];

export interface BibEntry {
  id: string;
  type: BibEntryType;
  key: string;
  fields: Record<string, string>;
}

export interface LintIssue {
  entryId: string;
  entryKey: string;
  severity: 'error' | 'warn';
  code:
    | 'dup-key'
    | 'unescaped'
    | 'unbalanced'
    | 'missing-field'
    | 'doi-url-clash'
    | 'abnt-urldate'
    | 'double-braced-title';
  message: string;
}

export interface DuplicateGroup {
  reason: string;
  entries: BibEntry[];
}

export function createDefaultBibEntries(): BibEntry[] {
  return [
    {
      id: 'b1',
      type: 'article',
      key: 'feynman1949space',
      fields: {
        author: 'Feynman, Richard P.',
        title: 'Space-Time Approach to Quantum Electrodynamics',
        journal: 'Physical Review',
        year: '1949',
        volume: '76',
        number: '6',
        pages: '769--789',
        doi: '10.1103/PhysRev.76.769',
      },
    },
    {
      id: 'b2',
      type: 'misc',
      key: 'kingma2014adam',
      fields: {
        author: 'Kingma, Diederik P. and Ba, Jimmy',
        title: 'Adam: A Method for Stochastic Optimization',
        year: '2014',
        eprint: '1412.6980',
        archivePrefix: 'arXiv',
        primaryClass: 'cs.LG',
      },
    },
    {
      id: 'b3',
      type: 'book',
      key: 'ibge2023censo',
      fields: {
        author: '{{Instituto Brasileiro de Geografia e Estatística}}',
        title: 'Censo Demográfico 2022: População e Domicílios',
        publisher: 'IBGE',
        address: 'Rio de Janeiro',
        year: '2023',
        url: 'https://www.ibge.gov.br',
        urldate: '2026-11-27',
      },
    },
  ];
}

export function serializeBibEntries(
  entries: BibEntry[],
  engine: BibEngineMode = 'biblatex'
): string {
  const natbibTypeMap: Partial<Record<BibEntryType, BibEntryType>> = {
    online: 'misc',
    electronic: 'misc',
    www: 'misc',
    software: 'misc',
    dataset: 'misc',
    periodical: 'misc',
    suppperiodical: 'article',
    mvbook: 'book',
    bookinbook: 'inbook',
    suppbook: 'inbook',
    mvcollection: 'collection',
    suppcollection: 'incollection',
    mvproceedings: 'proceedings',
    reference: 'book',
    mvreference: 'book',
    inreference: 'incollection',
    thesis: 'phdthesis',
    report: 'techreport',
  };

  return entries
    .map((e) => {
      if (engine === 'biblatex') {
        const orderedKeys = Object.keys(e.fields).filter((k) => e.fields[k]?.trim() !== '');
        const lines = orderedKeys.map((k) => `  ${k.padEnd(13, ' ')} = {${e.fields[k]}}`);
        return `@${e.type}{${e.key},\n${lines.join(',\n')}\n}`;
      }

      const outType = natbibTypeMap[e.type] ?? e.type;
      const outFields: Record<string, string> = { ...e.fields };
      if (!outFields.journal && outFields.journaltitle) {
        outFields.journal = outFields.journaltitle;
        delete outFields.journaltitle;
      }
      if (!outFields.address && outFields.location) {
        outFields.address = outFields.location;
        delete outFields.location;
      }
      if (!outFields.year && outFields.date) {
        const ym = /\d{4}/.exec(outFields.date);
        if (ym) outFields.year = ym[0];
      }
      if (outFields.url && !outFields.howpublished && outType === 'misc') {
        outFields.howpublished = `\\url{${outFields.url}}`;
      }
      if (outFields.urldate && !outFields.note) {
        outFields.note = `Acesso em: ${outFields.urldate}`;
      }
      const orderedKeys = Object.keys(outFields).filter((k) => outFields[k]?.trim() !== '');
      const lines = orderedKeys.map((k) => `  ${k.padEnd(13, ' ')} = {${outFields[k]}}`);
      return `@${outType}{${e.key},\n${lines.join(',\n')}\n}`;
    })
    .join('\n\n');
}

export function formatNatbibInText(e: BibEntry): { citet: string; citep: string } {
  const raw = (e.fields.author || e.fields.editor || 'Autor').replace(/[{}]/g, '');
  const parts = raw.split(/\s+and\s+/i).map((a) => {
    const trimmed = a.trim();
    return trimmed.includes(',')
      ? trimmed.split(',')[0].trim()
      : trimmed.split(/\s+/).pop() || trimmed;
  });
  const authLabel =
    parts.length === 1
      ? parts[0]
      : parts.length === 2
      ? `${parts[0]} & ${parts[1]}`
      : `${parts[0]} et al.`;
  const year = (e.fields.year || e.fields.date || 's.d.').slice(0, 4);
  return {
    citet: `${authLabel} (${year})`,
    citep: `(${authLabel}, ${year})`,
  };
}

function readBalanced(src: string, startIdx: number): { value: string; nextIdx: number } {
  const openChar = src[startIdx];
  const closeChar = openChar === '{' ? '}' : '"';
  let depth = 0;
  for (let i = startIdx; i < src.length; i++) {
    const ch = src[i];
    if (ch === '\\') {
      i++;
      continue;
    }
    if (openChar === '{') {
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) return { value: src.slice(startIdx + 1, i), nextIdx: i + 1 };
      }
    } else if (ch === closeChar && i > startIdx) {
      return { value: src.slice(startIdx + 1, i), nextIdx: i + 1 };
    }
  }
  return { value: src.slice(startIdx + 1), nextIdx: src.length };
}

export function parseBibText(raw: string): BibEntry[] {
  const out: BibEntry[] = [];
  let idx = 0;
  let count = 0;
  while (idx < raw.length) {
    const atIdx = raw.indexOf('@', idx);
    if (atIdx === -1) break;
    const braceIdx = raw.indexOf('{', atIdx);
    if (braceIdx === -1) break;
    const typeRaw = raw.slice(atIdx + 1, braceIdx).trim().toLowerCase();
    if (!typeRaw || typeRaw === 'comment' || typeRaw === 'preamble' || typeRaw === 'string') {
      idx = braceIdx + 1;
      continue;
    }
    const bodyRead = readBalanced(raw, braceIdx);
    idx = bodyRead.nextIdx;
    const inner = bodyRead.value;
    const firstComma = inner.indexOf(',');
    if (firstComma === -1) continue;
    const key = inner.slice(0, firstComma).trim();
    const fieldsStr = inner.slice(firstComma + 1);

    const fields: Record<string, string> = {};
    let fIdx = 0;
    while (fIdx < fieldsStr.length) {
      while (fIdx < fieldsStr.length && /[\s,]/.test(fieldsStr[fIdx])) fIdx++;
      if (fIdx >= fieldsStr.length) break;
      const eqIdx = fieldsStr.indexOf('=', fIdx);
      if (eqIdx === -1) break;
      const fieldName = fieldsStr.slice(fIdx, eqIdx).trim();
      let vIdx = eqIdx + 1;
      while (vIdx < fieldsStr.length && /\s/.test(fieldsStr[vIdx])) vIdx++;
      if (vIdx >= fieldsStr.length) break;
      if (fieldsStr[vIdx] === '{' || fieldsStr[vIdx] === '"') {
        const valRead = readBalanced(fieldsStr, vIdx);
        fields[fieldName] = valRead.value.trim();
        fIdx = valRead.nextIdx;
      } else {
        const comma = fieldsStr.indexOf(',', vIdx);
        const end = comma === -1 ? fieldsStr.length : comma;
        fields[fieldName] = fieldsStr.slice(vIdx, end).trim();
        fIdx = end + 1;
      }
    }
    count++;
    out.push({
      id: `bib-${count}-${key || Date.now()}`,
      type: (typeRaw as BibEntryType) || 'misc',
      key: key || `ref${count}`,
      fields,
    });
  }
  return out;
}

export function generateStandardKey(entry: BibEntry, existingKeys: Set<string>): string {
  const authorRaw = (entry.fields.author || entry.fields.editor || 'autor').replace(/[{}]/g, '');
  const firstAuthor = authorRaw.split(/\s+and\s+/i)[0] || 'autor';
  const lastName = (firstAuthor.includes(',') ? firstAuthor.split(',')[0] : firstAuthor.split(/\s+/).pop() || 'autor')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
  const year = (entry.fields.year || entry.fields.date || '2026').replace(/[^0-9]/g, '').slice(0, 4) || '2026';
  const titleWord = (entry.fields.title || 'ref')
    .replace(/[{}]/g, '')
    .split(/\s+/)
    .find((w) => w.length > 3)
    ?.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase() || 'ref';

  const base = `${lastName || 'ref'}${year}${titleWord}`;
  if (!existingKeys.has(base)) return base;
  let suffix = 97;
  while (existingKeys.has(`${base}${String.fromCharCode(suffix)}`)) suffix++;
  return `${base}${String.fromCharCode(suffix)}`;
}

export function protectAcronymsInTitle(title: string): string {
  return title.replace(/(^|\s)([A-Z]{2,}[A-Z0-9\-]*|LaTeX|BibTeX|BibLaTeX)(?=\s|$|[.,:;!?])/g, (m, pre, word) => {
    if (word.startsWith('{') && word.endsWith('}')) return m;
    return `${pre}{${word}}`;
  });
}

export function toggleCorporateAuthor(author: string): string {
  const trimmed = author.trim();
  if (trimmed.startsWith('{{') && trimmed.endsWith('}}')) {
    return trimmed.slice(2, -2);
  }
  return `{{${trimmed.replace(/^\{+|\}+$/g, '')}}}`;
}

export function lintBibEntries(
  entries: BibEntry[],
  engine: BibEngineMode = 'biblatex'
): LintIssue[] {
  const issues: LintIssue[] = [];
  const keyCounts = new Map<string, number>();
  for (const e of entries) {
    keyCounts.set(e.key, (keyCounts.get(e.key) || 0) + 1);
  }

  const requiredMap: Partial<Record<BibEntryType, string[]>> = {
    article: ['author', 'title', 'journal', 'year'],
    periodical: ['editor', 'title', 'year'],
    book: ['author', 'title', 'publisher', 'year'],
    mvbook: ['author', 'title', 'year'],
    inbook: ['author', 'title', 'booktitle', 'year'],
    bookinbook: ['author', 'title', 'booktitle', 'year'],
    booklet: ['title', 'year'],
    collection: ['editor', 'title', 'publisher', 'year'],
    mvcollection: ['editor', 'title', 'year'],
    incollection: ['author', 'title', 'booktitle', 'year'],
    inproceedings: ['author', 'title', 'booktitle', 'year'],
    conference: ['author', 'title', 'booktitle', 'year'],
    proceedings: ['title', 'year'],
    mvproceedings: ['title', 'year'],
    thesis: ['author', 'title', 'institution', 'year'],
    phdthesis: ['author', 'title', 'school', 'year'],
    mastersthesis: ['author', 'title', 'school', 'year'],
    report: ['author', 'title', 'institution', 'year'],
    techreport: ['author', 'title', 'institution', 'year'],
    manual: ['title', 'year'],
    reference: ['editor', 'title', 'year'],
    inreference: ['title', 'booktitle', 'year'],
    online: ['title', 'url', 'urldate'],
    electronic: ['title', 'url'],
    www: ['title', 'url'],
    dataset: ['author', 'title', 'year'],
    software: ['author', 'title', 'year'],
    patent: ['author', 'title', 'number', 'year'],
    unpublished: ['author', 'title'],
    set: ['entryset'],
    misc: ['title'],
  };

  for (const e of entries) {
    if ((keyCounts.get(e.key) || 0) > 1) {
      issues.push({
        entryId: e.id,
        entryKey: e.key,
        severity: 'error',
        code: 'dup-key',
        message: `Chave duplicada "@${e.key}" — Biber/BibTeX irá ignorar ou gerar conflito.`,
      });
    }

    const req = requiredMap[e.type] || ['title'];
    for (const f of req) {
      const hasAlt =
        (f === 'journal' && Boolean(e.fields.journal || e.fields.journaltitle)) ||
        (f === 'author' && Boolean(e.fields.author || e.fields.editor)) ||
        (f === 'year' && Boolean(e.fields.year || e.fields.date)) ||
        (f === 'institution' && Boolean(e.fields.institution || e.fields.school));
      if (!e.fields[f]?.trim() && !hasAlt) {
        issues.push({
          entryId: e.id,
          entryKey: e.key,
          severity: 'warn',
          code: 'missing-field',
          message: `Campo obrigatório ausente para @${e.type}: "${f}".`,
        });
      }
    }

    for (const [fk, fv] of Object.entries(e.fields)) {
      if (!fv) continue;
      if (fk !== 'url' && fk !== 'doi' && /(?<!\\)[&%#]/.test(fv)) {
        issues.push({
          entryId: e.id,
          entryKey: e.key,
          severity: 'error',
          code: 'unescaped',
          message: `Caractere especial não escapado (&, % ou #) no campo "${fk}". Use \\&, \\% ou \\#.`,
        });
      }
      let depth = 0;
      for (let i = 0; i < fv.length; i++) {
        if (fv[i] === '\\') {
          i++;
          continue;
        }
        if (fv[i] === '{') depth++;
        else if (fv[i] === '}') depth--;
      }
      if (depth !== 0) {
        issues.push({
          entryId: e.id,
          entryKey: e.key,
          severity: 'error',
          code: 'unbalanced',
          message: `Chaves {} desbalanceadas no campo "${fk}".`,
        });
      }
    }

    if (e.fields.title?.trim().startsWith('{') && e.fields.title?.trim().endsWith('}')) {
      issues.push({
        entryId: e.id,
        entryKey: e.key,
        severity: 'warn',
        code: 'double-braced-title',
        message: 'Evite envolver o título inteiro com {{...}}; proteja apenas siglas individuais.',
      });
    }

    if (e.fields.doi?.trim() && e.fields.url?.includes('doi.org')) {
      issues.push({
        entryId: e.id,
        entryKey: e.key,
        severity: 'warn',
        code: 'doi-url-clash',
        message: 'Campo "doi" e "url" apontam ambos para doi.org (pode duplicar link no PDF).',
      });
    }

    if (e.fields.url?.trim() && !e.fields.urldate?.trim()) {
      issues.push({
        entryId: e.id,
        entryKey: e.key,
        severity: 'warn',
        code: 'abnt-urldate',
        message: 'Padrão ABNT: entradas com "url" exigem "urldate" (data de acesso).',
      });
    }

    if (engine === 'natbib' && e.fields.date?.trim() && !e.fields.year?.trim()) {
      issues.push({
        entryId: e.id,
        entryKey: e.key,
        severity: 'warn',
        code: 'missing-field',
        message: 'Modo natbib: estilos .bst clássicos usam "year" em vez de "date" (convertido na exportação).',
      });
    }
  }
  return issues;
}

export function findDuplicates(entries: BibEntry[]): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];
  const byDoi = new Map<string, BibEntry[]>();
  const byTitle = new Map<string, BibEntry[]>();

  for (const e of entries) {
    const doi = e.fields.doi?.trim().toLowerCase();
    if (doi) byDoi.set(doi, [...(byDoi.get(doi) || []), e]);
    const normTitle = (e.fields.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (normTitle.length > 8) {
      byTitle.set(normTitle, [...(byTitle.get(normTitle) || []), e]);
    }
  }

  for (const [doi, list] of byDoi) {
    if (list.length > 1) groups.push({ reason: `Mesmo DOI (${doi})`, entries: list });
  }
  for (const [, list] of byTitle) {
    if (list.length > 1) groups.push({ reason: 'Título idêntico', entries: list });
  }
  return groups;
}

export function formatPreviewCitation(e: BibEntry, style: CitationStyle): string {
  const author = (e.fields.author || e.fields.editor || 'Autor Desconhecido').replace(/[{}]/g, '');
  const title = (e.fields.title || 'Sem título').replace(/[{}]/g, '');
  const year = e.fields.year || e.fields.date || 's.d.';
  const venue =
    e.fields.journal ||
    e.fields.journaltitle ||
    e.fields.booktitle ||
    e.fields.publisher ||
    e.fields.institution ||
    e.fields.school ||
    '';
  const vol = e.fields.volume ? `v. ${e.fields.volume}` : '';
  const pages = e.fields.pages ? `p. ${e.fields.pages.replace('--', '-')}` : '';
  const pagesDash = e.fields.pages ? e.fields.pages.replace('--', '-') : '';
  const doi = e.fields.doi ? `DOI: ${e.fields.doi}.` : '';
  const url = e.fields.url ? `Disponível em: ${e.fields.url}.` : '';
  const access = e.fields.urldate ? `Acesso em: ${e.fields.urldate}.` : '';

  const abntAuth = author
    .split(/\s+and\s+/i)
    .map((a) => {
      const parts = a.split(',').map((s) => s.trim());
      return parts.length >= 2 ? `${parts[0].toUpperCase()}, ${parts[1]}` : a.toUpperCase();
    })
    .join('; ');

  switch (style) {
    case 'abnt':
      return `${abntAuth}. ${title}. ${venue ? venue + ', ' : ''}${vol ? vol + ', ' : ''}${pages ? pages + ', ' : ''}${year}. ${doi || url} ${access}`.replace(/\s+/g, ' ').trim();
    case 'abnt-num':
      return `[1] ${abntAuth}. ${title}. ${venue ? venue + ', ' : ''}${year}. ${doi}`.replace(/\s+/g, ' ').trim();
    case 'ieee':
    case 'numeric':
      return `[1] ${author}, "${title}," ${venue ? venue + ', ' : ''}${e.fields.volume ? 'vol. ' + e.fields.volume + ', ' : ''}${pagesDash ? 'pp. ' + pagesDash + ', ' : ''}${year}. ${doi}`.replace(/\s+/g, ' ').trim();
    case 'alphabetic': {
      const tag = author.slice(0, 3) + year.slice(-2);
      return `[${tag}] ${author}. "${title}". In: ${venue} (${year}). ${pagesDash ? 'pp. ' + pagesDash : ''}`.trim();
    }
    case 'apa':
      return `${author} (${year}). ${title}. ${venue ? venue + '. ' : ''}${e.fields.doi ? 'https://doi.org/' + e.fields.doi : ''}`.trim();
    case 'chicago-authordate':
      return `${author}. ${year}. "${title}." ${venue}${e.fields.volume ? ' ' + e.fields.volume : ''}${pagesDash ? ': ' + pagesDash : ''}. ${doi}`.replace(/\s+/g, ' ').trim();
    case 'chicago-notes':
      return `${author}, "${title}," ${venue}${e.fields.volume ? ' ' + e.fields.volume : ''} (${year})${pagesDash ? ': ' + pagesDash : ''}.`.replace(/\s+/g, ' ').trim();
    case 'mla':
      return `${author}. "${title}." ${venue}, ${year}${pagesDash ? ', pp. ' + pagesDash : ''}.`.replace(/\s+/g, ' ').trim();
    case 'vancouver':
      return `1. ${author}. ${title}. ${venue}. ${year}${e.fields.volume ? ';' + e.fields.volume : ''}${pagesDash ? ':' + pagesDash : ''}.`.replace(/\s+/g, ' ').trim();
    case 'harvard':
      return `${author} (${year}) '${title}', ${venue}${pagesDash ? ', pp. ' + pagesDash : ''}.`.replace(/\s+/g, ' ').trim();
    case 'nature':
      return `1. ${author} ${title}. ${venue} ${e.fields.volume || ''}, ${pagesDash} (${year}).`.replace(/\s+/g, ' ').trim();
    case 'science':
      return `1. ${author}, ${title}. ${venue} ${e.fields.volume || ''}, ${pagesDash} (${year}).`.replace(/\s+/g, ' ').trim();
    case 'acm':
      return `[1] ${author}. ${year}. ${title}. In ${venue}${pagesDash ? ', ' + pagesDash : ''}. ${e.fields.doi ? 'https://doi.org/' + e.fields.doi : ''}`.replace(/\s+/g, ' ').trim();
    case 'springer-lncs':
      return `1. ${author}: ${title}. ${venue} ${e.fields.volume || ''}, ${pagesDash} (${year})`.replace(/\s+/g, ' ').trim();
    case 'aps':
      return `[1] ${author}, ${title}, ${venue} ${e.fields.volume || ''}, ${pagesDash} (${year}).`.replace(/\s+/g, ' ').trim();
    case 'iso690':
      return `${abntAuth}. ${title}. ${venue}. ${year}${pagesDash ? ', p. ' + pagesDash : ''}. ${doi}`.replace(/\s+/g, ' ').trim();
    case 'authoryear':
    default:
      return `${author} (${year}). ${title}. ${venue}. ${pages}`.replace(/\s+/g, ' ').trim();
  }
}

export function auditTexAgainstBib(texContent: string, entries: BibEntry[]) {
  const bibKeys = new Set(entries.map((e) => e.key));
  const citedKeys = new Set<string>();
  const re = /\\(?:[a-zA-Z]*cite[a-zA-Z]*)\*?(?:\[[^\]]*\])*\{([^}]+)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(texContent)) !== null) {
    for (const part of m[1].split(',')) {
      const k = part.trim();
      if (k) citedKeys.add(k);
    }
  }
  const missingInBib = [...citedKeys].filter((k) => !bibKeys.has(k));
  const unusedInTex = [...bibKeys].filter((k) => !citedKeys.has(k));
  return { citedCount: citedKeys.size, missingInBib, unusedInTex };
}

export function parseArxivXmlToEntry(xml: string, arxivId: string): BibEntry {
  const entryXml = /<entry>([\s\S]*?)<\/entry>/.exec(xml)?.[1] || xml;
  const title = /<title>([\s\S]*?)<\/title>/.exec(entryXml)?.[1]?.replace(/\s+/g, ' ').trim() || 'arXiv Preprint';
  const authors = [...entryXml.matchAll(/<author>\s*<name>([^<]+)<\/name>/g)].map((m) => m[1].trim());
  const published = /<published>(\d{4})/.exec(entryXml)?.[1] || '2026';
  const primaryClass = /<arxiv:primary_class[^>]*term="([^"]+)"/.exec(entryXml)?.[1] || 'cs.LG';
  const cleanId = arxivId.replace(/^arXiv:/i, '').trim();
  const firstLast = (authors[0]?.split(/\s+/).pop() || 'arxiv').toLowerCase().replace(/[^a-z0-9]/g, '');

  return {
    id: `bib-${Date.now()}`,
    type: 'misc',
    key: `${firstLast}${published}arxiv`,
    fields: {
      author: authors.join(' and ') || 'Author',
      title,
      year: published,
      eprint: cleanId,
      archivePrefix: 'arXiv',
      primaryClass,
    },
  };
}
