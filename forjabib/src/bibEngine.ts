export type BibEntryType =
  | 'article'
  | 'book'
  | 'inproceedings'
  | 'misc'
  | 'phdthesis'
  | 'mastersthesis'
  | 'techreport'
  | 'online';

export type CitationStyle = 'abnt' | 'ieee' | 'apa' | 'authoryear';

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

export function serializeBibEntries(entries: BibEntry[]): string {
  return entries
    .map((e) => {
      const orderedKeys = Object.keys(e.fields).filter((k) => e.fields[k]?.trim() !== '');
      const lines = orderedKeys.map((k) => `  ${k.padEnd(13, ' ')} = {${e.fields[k]}}`);
      return `@${e.type}{${e.key},\n${lines.join(',\n')}\n}`;
    })
    .join('\n\n');
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
  const authorRaw = (entry.fields.author || 'autor').replace(/[{}]/g, '');
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
  let suffix = 97; // 'a'
  while (existingKeys.has(`${base}${String.fromCharCode(suffix)}`)) suffix++;
  return `${base}${String.fromCharCode(suffix)}`;
}

export function protectAcronymsInTitle(title: string): string {
  // Wrap standalone ALL-CAPS/mixed-case acronyms (e.g., COVID-19, USA, LaTeX, ABNT, DNA) without double-bracing the whole title
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

export function lintBibEntries(entries: BibEntry[]): LintIssue[] {
  const issues: LintIssue[] = [];
  const keyCounts = new Map<string, number>();
  for (const e of entries) {
    keyCounts.set(e.key, (keyCounts.get(e.key) || 0) + 1);
  }

  const requiredMap: Record<BibEntryType, string[]> = {
    article: ['author', 'title', 'journal', 'year'],
    book: ['author', 'title', 'publisher', 'year'],
    inproceedings: ['author', 'title', 'booktitle', 'year'],
    misc: ['title'],
    phdthesis: ['author', 'title', 'school', 'year'],
    mastersthesis: ['author', 'title', 'school', 'year'],
    techreport: ['author', 'title', 'institution', 'year'],
    online: ['title', 'url', 'urldate'],
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
      const hasAlt = f === 'journal' ? Boolean(e.fields.journal || e.fields.journaltitle) : false;
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
    const normTitle = (e.fields.title || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
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
  const author = (e.fields.author || 'Autor Desconhecido').replace(/[{}]/g, '');
  const title = (e.fields.title || 'Sem título').replace(/[{}]/g, '');
  const year = e.fields.year || e.fields.date || 's.d.';
  const venue = e.fields.journal || e.fields.journaltitle || e.fields.booktitle || e.fields.publisher || '';
  const vol = e.fields.volume ? `v. ${e.fields.volume}` : '';
  const pages = e.fields.pages ? `p. ${e.fields.pages.replace('--', '-')}` : '';
  const doi = e.fields.doi ? `DOI: ${e.fields.doi}.` : '';
  const url = e.fields.url ? `Disponível em: ${e.fields.url}.` : '';
  const access = e.fields.urldate ? `Acesso em: ${e.fields.urldate}.` : '';

  if (style === 'abnt') {
    const abntAuth = author
      .split(/\s+and\s+/i)
      .map((a) => {
        const parts = a.split(',').map((s) => s.trim());
        return parts.length >= 2 ? `${parts[0].toUpperCase()}, ${parts[1]}` : a.toUpperCase();
      })
      .join('; ');
    return `${abntAuth}. ${title}. ${venue ? venue + ', ' : ''}${vol ? vol + ', ' : ''}${pages ? pages + ', ' : ''}${year}. ${doi || url} ${access}`.replace(/\s+/g, ' ').trim();
  }

  if (style === 'ieee') {
    return `[1] ${author}, "${title}," ${venue ? venue + ', ' : ''}${vol ? 'vol. ' + e.fields.volume + ', ' : ''}${pages ? 'pp. ' + e.fields.pages?.replace('--', '-') + ', ' : ''}${year}. ${doi}`.replace(/\s+/g, ' ').trim();
  }

  if (style === 'apa') {
    return `${author} (${year}). ${title}. ${venue ? venue + '. ' : ''}${e.fields.doi ? 'https://doi.org/' + e.fields.doi : ''}`.trim();
  }

  return `${author} (${year}). ${title}. ${venue}. ${pages}`.replace(/\s+/g, ' ').trim();
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
  const tag = (name: string) => {
    const m = new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`).exec(xml);
    return m ? m[1].replace(/\s+/g, ' ').trim() : '';
  };
  const entryXml = /<entry>([\s\S]*?)<\/entry>/.exec(xml)?.[1] || xml;
  const title = tag.call(null, 'title') || /<title>([\s\S]*?)<\/title>/.exec(entryXml)?.[1]?.replace(/\s+/g, ' ').trim() || 'arXiv Preprint';
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
