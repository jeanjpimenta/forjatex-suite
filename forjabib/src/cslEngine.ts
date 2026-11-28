import CSL from 'citeproc';
import type { BibEntry } from './bibEngine';
import type { CustomBibStyleConfig } from './styleEngine';

export interface CslPreset {
  slug: string;
  label: string;
}

export const POPULAR_CSL_STYLES: CslPreset[] = [
  { slug: 'associacao-brasileira-de-normas-tecnicas', label: 'ABNT (NBR 6023 - Oficial CSL)' },
  { slug: 'ieee', label: 'IEEE' },
  { slug: 'apa', label: 'APA 7th Edition' },
  { slug: 'chicago-author-date', label: 'Chicago (Author-Date)' },
  { slug: 'vancouver', label: 'Vancouver' },
  { slug: 'nature', label: 'Nature' },
  { slug: 'science', label: 'Science' },
  { slug: 'harvard-cite-them-right', label: 'Harvard (Cite Them Right)' },
  { slug: 'acm-sig-proceedings', label: 'ACM SIG Proceedings' },
  { slug: 'springer-lecture-notes-in-computer-science', label: 'Springer LNCS' },
];

export const DEFAULT_ABNT_CSL = `<?xml version="1.0" encoding="utf-8"?>
<style xmlns="http://purl.org/net/xbiblio/csl" version="1.0" class="in-text" default-locale="pt-BR">
  <info>
    <title>ABNT ForjaBib (Exemplo Local)</title>
    <id>http://forjatex.com.br/csl/abnt-local</id>
    <category citation-format="author-date"/>
  </info>
  <macro name="author">
    <names variable="author">
      <name name-as-sort-order="all" sort-separator=", " delimiter="; " initialize-with=". "/>
    </names>
  </macro>
  <citation et-al-min="4" et-al-use-first="1">
    <layout prefix="(" suffix=")" delimiter="; ">
      <group delimiter=", ">
        <names variable="author"><name form="short"/></names>
        <date variable="issued"><date-part name="year"/></date>
      </group>
    </layout>
  </citation>
  <bibliography>
    <layout suffix=".">
      <group delimiter=". ">
        <text macro="author"/>
        <text variable="title"/>
        <text variable="container-title" font-style="italic"/>
        <date variable="issued"><date-part name="year"/></date>
      </group>
    </layout>
  </bibliography>
</style>`;

const MINIMAL_LOCALE_XML = `<?xml version="1.0" encoding="utf-8"?>
<locale xmlns="http://purl.org/net/xbiblio/csl" version="1.0" xml:lang="pt-BR">
  <terms>
    <term name="et-al">et al.</term>
    <term name="and">e</term>
    <term name="retrieved">Disponível em</term>
    <term name="accessed">Acesso em</term>
    <term name="page" form="short">p.</term>
    <term name="volume" form="short">v.</term>
  </terms>
</locale>`;

export function bibEntryToCslJson(e: BibEntry): Record<string, unknown> {
  const rawAuth = (e.fields.author || e.fields.editor || 'Autor').replace(/[{}]/g, '');
  const authors = rawAuth.split(/\s+and\s+/i).map((a) => {
    const t = a.trim();
    if (t.includes(',')) {
      const [family, given] = t.split(',').map((s) => s.trim());
      return { family, given };
    }
    const parts = t.split(/\s+/);
    const family = parts.pop() || t;
    return { family, given: parts.join(' ') };
  });

  const yearStr = (e.fields.year || e.fields.date || '2026').replace(/[^0-9]/g, '').slice(0, 4);
  const typeMap: Record<string, string> = {
    article: 'article-journal',
    book: 'book',
    mvbook: 'book',
    inbook: 'chapter',
    incollection: 'chapter',
    inproceedings: 'paper-conference',
    conference: 'paper-conference',
    thesis: 'thesis',
    phdthesis: 'thesis',
    mastersthesis: 'thesis',
    report: 'report',
    techreport: 'report',
    online: 'webpage',
    software: 'software',
    dataset: 'dataset',
    patent: 'patent',
    misc: 'article',
  };

  return {
    id: e.key,
    type: typeMap[e.type] || 'article',
    title: (e.fields.title || 'Sem título').replace(/[{}]/g, ''),
    author: authors,
    'container-title': e.fields.journal || e.fields.journaltitle || e.fields.booktitle || '',
    publisher: e.fields.publisher || e.fields.institution || e.fields.school || '',
    volume: e.fields.volume || '',
    page: (e.fields.pages || '').replace('--', '-'),
    DOI: e.fields.doi || '',
    URL: e.fields.url || '',
    issued: yearStr ? { 'date-parts': [[Number(yearStr)]] } : undefined,
  };
}

export function renderWithCiteproc(
  entries: BibEntry[],
  cslXml: string
): { inText: string[]; bibHtml: string[]; error?: string } {
  try {
    const itemMap: Record<string, Record<string, unknown>> = {};
    const ids: string[] = [];
    for (const e of entries) {
      itemMap[e.key] = bibEntryToCslJson(e);
      ids.push(e.key);
    }
    if (ids.length === 0) return { inText: [], bibHtml: [] };

    const engine = new CSL.Engine(
      {
        retrieveLocale: () => MINIMAL_LOCALE_XML,
        retrieveItem: (id: string) => itemMap[id],
      },
      cslXml
    );
    engine.updateItems(ids);
    const inText: string[] = [];
    for (let i = 0; i < Math.min(2, ids.length); i++) {
      const res = engine.processCitationCluster(
        { citationItems: [{ id: ids[i] }], properties: { noteIndex: i + 1 } },
        [],
        []
      );
      const txt = res?.[1]?.[0]?.[1];
      if (txt) inText.push(txt);
    }
    const bib = engine.makeBibliography();
    const bibHtml = bib ? bib[1] : [];
    return { inText, bibHtml };
  } catch (err) {
    return { inText: [], bibHtml: [], error: String(err) };
  }
}

export function parseCslTitle(cslXml: string): string {
  const m = /<title>([^<]+)<\/title>/i.exec(cslXml);
  return m ? m[1].trim() : 'Estilo CSL Customizado';
}

export function extractBiblatexHintsFromCsl(
  cslXml: string,
  prev: CustomBibStyleConfig
): CustomBibStyleConfig {
  const next: CustomBibStyleConfig = { ...prev, engine: 'biblatex' };
  const cat = /citation-format="([^"]+)"/i.exec(cslXml)?.[1]?.toLowerCase();
  if (cat === 'numeric') next.baseStyle = 'numeric';
  else if (cat === 'author-date') next.baseStyle = 'authoryear';
  else if (cat === 'label') next.baseStyle = 'alphabetic';

  if (/initialize-with=/i.test(cslXml)) next.givenInits = true;
  if (/name-as-sort-order="all"/i.test(cslXml)) next.nameOrder = 'family-given';
  else if (/name-as-sort-order="first"/i.test(cslXml)) next.nameOrder = 'family-given';

  const etAl = /et-al-min="(\d+)"/i.exec(cslXml);
  if (etAl) next.maxCiteNames = Math.max(1, Number(etAl[1]) - 1);

  if (/variable="title"[^>]*quotes="true"/i.test(cslXml)) next.titleFormat = 'quote';
  else if (/variable="title"[^>]*font-style="italic"/i.test(cslXml)) next.titleFormat = 'italic';

  if (/variable="container-title"[^>]*font-style="italic"/i.test(cslXml)) {
    next.venueFormat = 'italic';
  }
  return next;
}

export function generateCslLatexPreamble(cslSlugOrName: string, bibFileName: string): string {
  const cleanStyle = (cslSlugOrName || 'apa').replace(/\.csl$/i, '');
  const cleanBib = bibFileName.trim() || 'referencias.bib';
  return [
    '\\usepackage{citation-style-language}',
    `\\cslsetup{style = ${cleanStyle}}`,
    `\\addbibresource{${cleanBib}}`,
    '% No final do documento use: \\printbibliography',
  ].join('\n');
}
