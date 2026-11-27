import React, { useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { open as openExternal } from '@tauri-apps/plugin-shell';
import {
  AlertTriangle,
  BookOpen,
  Check,
  Copy,
  FileSearch,
  FolderOpen,
  Heart,
  Moon,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  X,
} from 'lucide-react';
import {
  auditTexAgainstBib,
  createDefaultBibEntries,
  findDuplicates,
  formatPreviewCitation,
  generateStandardKey,
  lintBibEntries,
  parseArxivXmlToEntry,
  parseBibText,
  protectAcronymsInTitle,
  serializeBibEntries,
  toggleCorporateAuthor,
  type BibEntry,
  type BibEntryType,
  type CitationStyle,
} from './bibEngine';
import {
  generatePixQrDataUrl,
  getPayPalDonateUrl,
  PAYPAL_EMAIL,
  PIX_KEY,
} from './pixDonate';

const STORAGE_KEY = 'forjabib_workspace_v1';

const ENTRY_TYPES: BibEntryType[] = [
  'article',
  'book',
  'inproceedings',
  'misc',
  'phdthesis',
  'mastersthesis',
  'techreport',
  'online',
];

function loadSavedEntries(): BibEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as BibEntry[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // ignore
  }
  return createDefaultBibEntries();
}

export default function App() {
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>('dark');
  const [entries, setEntries] = useState<BibEntry[]>(() => loadSavedEntries());
  const [selectedId, setSelectedId] = useState<string>(() => entries[0]?.id || '');
  const [bibFilePath, setBibFilePath] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [citationStyle, setCitationStyle] = useState<CitationStyle>('abnt');
  const [statusMsg, setStatusMsg] = useState('');

  // Lookup bar (DOI / arXiv / ISBN)
  const [lookupInput, setLookupInput] = useState('');
  const [lookupBusy, setLookupBusy] = useState(false);

  // .tex audit
  const [texAudit, setTexAudit] = useState<{
    fileName: string;
    citedCount: number;
    missingInBib: string[];
    unusedInTex: string[];
  } | null>(null);

  // Bidirectional raw .bib editor
  const serialized = useMemo(() => serializeBibEntries(entries), [entries]);
  const [rawBib, setRawBib] = useState<string>(() => serialized);
  const editSourceRef = useRef<'visual' | 'code'>('visual');
  const parseTimerRef = useRef<number | null>(null);

  const [sidebarWidth, setSidebarWidth] = useState(330);
  const [codeWidth, setCodeWidth] = useState(390);
  const [donateOpen, setDonateOpen] = useState(false);
  const [pixQrUrl, setPixQrUrl] = useState('');
  const [pixBrCode, setPixBrCode] = useState('');
  const [copyTag, setCopyTag] = useState<string | null>(null);

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeMode);
  }, [themeMode]);

  React.useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      // ignore
    }
  }, [entries]);

  React.useEffect(() => {
    if (editSourceRef.current === 'visual') {
      setRawBib(serialized);
    }
    editSourceRef.current = 'visual';
  }, [serialized]);

  React.useEffect(() => {
    generatePixQrDataUrl('DoacaoForjaBib')
      .then(({ brCode, qrUrl }) => {
        setPixBrCode(brCode);
        setPixQrUrl(qrUrl);
      })
      .catch(() => {});
  }, []);

  const selectedEntry = entries.find((e) => e.id === selectedId) || entries[0];
  const issues = useMemo(() => lintBibEntries(entries), [entries]);
  const duplicates = useMemo(() => findDuplicates(entries), [entries]);

  const filteredEntries = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) =>
        e.key.toLowerCase().includes(q) ||
        (e.fields.title || '').toLowerCase().includes(q) ||
        (e.fields.author || '').toLowerCase().includes(q) ||
        (e.fields.year || '').includes(q)
    );
  }, [entries, search]);

  const updateEntriesVisual = (updater: (prev: BibEntry[]) => BibEntry[]) => {
    editSourceRef.current = 'visual';
    setEntries(updater);
  };

  const updateSelected = (patch: Partial<BibEntry>) => {
    if (!selectedEntry) return;
    updateEntriesVisual((prev) =>
      prev.map((e) => (e.id === selectedEntry.id ? { ...e, ...patch } : e))
    );
  };

  const updateField = (field: string, value: string) => {
    if (!selectedEntry) return;
    updateEntriesVisual((prev) =>
      prev.map((e) =>
        e.id === selectedEntry.id
          ? { ...e, fields: { ...e.fields, [field]: value } }
          : e
      )
    );
  };

  const handleRawBibChange = (nextText: string) => {
    editSourceRef.current = 'code';
    setRawBib(nextText);
    if (parseTimerRef.current) window.clearTimeout(parseTimerRef.current);
    parseTimerRef.current = window.setTimeout(() => {
      const parsed = parseBibText(nextText);
      if (parsed.length > 0) {
        editSourceRef.current = 'code';
        setEntries(parsed);
        if (!parsed.some((p) => p.id === selectedId)) {
          setSelectedId(parsed[0].id);
        }
      }
    }, 300);
  };

  const addNewEntry = (type: BibEntryType = 'article') => {
    const id = `bib-${Date.now()}`;
    const existingKeys = new Set(entries.map((e) => e.key));
    let key = `ref${entries.length + 1}`;
    while (existingKeys.has(key)) key += 'a';
    const next: BibEntry = {
      id,
      type,
      key,
      fields: {
        author: 'Sobrenome, Nome',
        title: 'Título da Referência',
        year: '2026',
        ...(type === 'article' ? { journal: 'Revista Científica' } : {}),
        ...(type === 'book' ? { publisher: 'Editora' } : {}),
        ...(type === 'online' ? { url: 'https://', urldate: '2026-11-27' } : {}),
      },
    };
    updateEntriesVisual((prev) => [...prev, next]);
    setSelectedId(id);
  };

  const removeEntry = (id: string) => {
    if (entries.length <= 1) return;
    updateEntriesVisual((prev) => {
      const rem = prev.filter((e) => e.id !== id);
      if (selectedId === id) setSelectedId(rem[0]?.id || '');
      return rem;
    });
  };

  const handleImportLookup = async () => {
    const q = lookupInput.trim();
    if (!q) return;
    setLookupBusy(true);
    setStatusMsg('Buscando metadados...');
    try {
      // 1. DOI
      if (/^10\.\d{4,9}\/\S+$/i.test(q) || q.includes('doi.org/')) {
        const doi = q.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').trim();
        const bib = await invoke<string>('fetch_url_text', {
          url: `https://api.crossref.org/works/${encodeURIComponent(doi)}/transform/application/x-bibtex`,
          accept: 'application/x-bibtex',
        });
        const parsed = parseBibText(bib);
        if (parsed.length === 0) throw new Error('DOI não retornou BibTeX válido.');
        const imported = { ...parsed[0], id: `bib-${Date.now()}` };
        updateEntriesVisual((prev) => [...prev, imported]);
        setSelectedId(imported.id);
        setLookupInput('');
        setStatusMsg(`DOI importado: @${imported.key}`);
        return;
      }

      // 2. arXiv
      if (/^arXiv:/i.test(q) || /^\d{4}\.\d{4,5}(v\d+)?$/.test(q) || q.includes('arxiv.org/')) {
        const arxivId = q
          .replace(/^https?:\/\/arxiv\.org\/(abs|pdf)\//i, '')
          .replace(/^arXiv:/i, '')
          .replace(/\.pdf$/i, '')
          .trim();
        const xml = await invoke<string>('fetch_url_text', {
          url: `https://export.arxiv.org/api/query?id_list=${encodeURIComponent(arxivId)}`,
        });
        const imported = parseArxivXmlToEntry(xml, arxivId);
        updateEntriesVisual((prev) => [...prev, imported]);
        setSelectedId(imported.id);
        setLookupInput('');
        setStatusMsg(`arXiv importado (@misc eprint): @${imported.key}`);
        return;
      }

      // 3. ISBN
      const isbn = q.replace(/[-\s]/g, '');
      if (/^(\d{10}|\d{13})$/.test(isbn)) {
        const jsonStr = await invoke<string>('fetch_url_text', {
          url: `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`,
        });
        const data = JSON.parse(jsonStr) as Record<
          string,
          {
            title?: string;
            authors?: Array<{ name: string }>;
            publishers?: Array<{ name: string }>;
            publish_date?: string;
          }
        >;
        const book = data[`ISBN:${isbn}`];
        if (!book) throw new Error('ISBN não encontrado na OpenLibrary.');
        const yearMatch = /\d{4}/.exec(book.publish_date || '');
        const authorsStr = book.authors?.map((a) => a.name).join(' and ') || 'Autor';
        const temp: BibEntry = {
          id: `bib-${Date.now()}`,
          type: 'book',
          key: 'book',
          fields: {
            author: authorsStr,
            title: book.title || 'Livro',
            publisher: book.publishers?.[0]?.name || 'Editora',
            year: yearMatch?.[0] || '2026',
            isbn,
          },
        };
        temp.key = generateStandardKey(temp, new Set(entries.map((e) => e.key)));
        updateEntriesVisual((prev) => [...prev, temp]);
        setSelectedId(temp.id);
        setLookupInput('');
        setStatusMsg(`ISBN importado: @${temp.key}`);
        return;
      }

      setStatusMsg('Informe um DOI (10.xxxx/...), arXiv ID (2401.12345) ou ISBN (10/13 dígitos).');
    } catch (e) {
      setStatusMsg(String(e));
    } finally {
      setLookupBusy(false);
    }
  };

  const handleOpenBib = async () => {
    const selected = await open({
      filters: [{ name: 'BibTeX / BibLaTeX', extensions: ['bib'] }],
      multiple: false,
    });
    if (!selected || Array.isArray(selected)) return;
    try {
      const content = await invoke<string>('read_text_file', { path: selected });
      const parsed = parseBibText(content);
      if (parsed.length === 0) throw new Error('Nenhuma entrada .bib válida encontrada.');
      editSourceRef.current = 'visual';
      setEntries(parsed);
      setSelectedId(parsed[0].id);
      setBibFilePath(selected);
      setStatusMsg(`Arquivo aberto: ${selected} (${parsed.length} referências)`);
    } catch (e) {
      setStatusMsg(String(e));
    }
  };

  const handleSaveBib = async (saveAs = false) => {
    let target = saveAs ? null : bibFilePath;
    if (!target) {
      const chosen = await save({
        filters: [{ name: 'BibTeX / BibLaTeX', extensions: ['bib'] }],
        defaultPath: 'referencias.bib',
      });
      if (!chosen) return;
      target = chosen;
    }
    try {
      await invoke('save_text_file', { path: target, content: rawBib });
      setBibFilePath(target);
      setStatusMsg(`Arquivo .bib salvo em: ${target}`);
    } catch (e) {
      setStatusMsg(String(e));
    }
  };

  const handleAuditTex = async () => {
    const selected = await open({
      filters: [{ name: 'Documento LaTeX', extensions: ['tex'] }],
      multiple: false,
    });
    if (!selected || Array.isArray(selected)) return;
    try {
      const texContent = await invoke<string>('read_text_file', { path: selected });
      const res = auditTexAgainstBib(texContent, entries);
      setTexAudit({
        fileName: selected.split(/[\\/]/).pop() || selected,
        ...res,
      });
      setStatusMsg(`Auditoria concluída em ${selected}`);
    } catch (e) {
      setStatusMsg(String(e));
    }
  };

  const startResize = (side: 'left' | 'right', e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = side === 'left' ? sidebarWidth : codeWidth;
    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      if (side === 'left') setSidebarWidth(Math.max(260, Math.min(520, startW + dx)));
      else setCodeWidth(Math.max(280, Math.min(620, startW - dx)));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const entryIssues = selectedEntry
    ? issues.filter((i) => i.entryId === selectedEntry.id)
    : [];

  return (
    <div className="fbib-shell">
      <header className="fbib-header">
        <div className="fbib-brand">
          <img src="/logo.png" alt="ForjaBib" className="fbib-logo" />
          <div>
            <h1>ForjaBib</h1>
            <span>Gerenciador Visual BibTeX & BibLaTeX (ABNT)</span>
          </div>
        </div>

        <div className="fbib-actions">
          <button type="button" className="fbib-btn" onClick={handleOpenBib}>
            <FolderOpen size={14} /> Abrir .bib
          </button>
          <button type="button" className="fbib-btn" onClick={() => handleSaveBib(false)}>
            <Save size={14} /> Salvar .bib
          </button>
          <button type="button" className="fbib-btn" onClick={handleAuditTex}>
            <FileSearch size={14} /> Auditar .tex
          </button>
          <button
            type="button"
            className="fbib-btn primary"
            onClick={async () => {
              await navigator.clipboard.writeText(rawBib);
              setStatusMsg('Arquivo .bib completo copiado!');
            }}
          >
            <Copy size={14} /> Copiar .bib
          </button>
          <button
            type="button"
            className="fbib-btn"
            onClick={async () => {
              const isPt = (navigator.language || '').toLowerCase().startsWith('pt');
              const url = isPt ? '/manuals/manual-pt-BR.pdf' : '/manuals/manual-en-US.pdf';
              const fileName = isPt ? 'manual-forjabib-pt-BR.pdf' : 'manual-forjabib-en-US.pdf';
              try {
                const resp = await fetch(url);
                const buf = await resp.arrayBuffer();
                await invoke('open_manual_pdf', {
                  fileName,
                  bytes: Array.from(new Uint8Array(buf)),
                });
              } catch {
                window.open(url, '_blank');
              }
            }}
          >
            Manual (PDF)
          </button>
          <button type="button" className="fbib-btn" onClick={() => setDonateOpen(true)}>
            <Heart size={14} color="#f43f5e" /> Apoiar
          </button>
          <button
            type="button"
            className="fbib-btn"
            onClick={() => setThemeMode((m) => (m === 'dark' ? 'light' : 'dark'))}
          >
            {themeMode === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>
      </header>

      {statusMsg && <div className="fbib-status">{statusMsg}</div>}

      <main
        className="fbib-main"
        style={{ gridTemplateColumns: `${sidebarWidth}px 5px 1fr 5px ${codeWidth}px` }}
      >
        {/* Left: Lookup + Entries List */}
        <aside className="fbib-sidebar">
          <div className="fbib-card">
            <div className="fbib-sec-title">
              <span>Importar por DOI / arXiv / ISBN</span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                style={{
                  flex: 1,
                  padding: '6px 8px',
                  borderRadius: 5,
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  fontSize: 12,
                }}
                placeholder="Ex: 10.1103/... ou 1412.6980"
                value={lookupInput}
                onChange={(e) => setLookupInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void handleImportLookup()}
              />
              <button
                type="button"
                className="fbib-btn primary"
                disabled={lookupBusy}
                onClick={handleImportLookup}
              >
                <Sparkles size={13} /> {lookupBusy ? '...' : 'Buscar'}
              </button>
            </div>
          </div>

          <div className="fbib-card">
            <div className="fbib-sec-title">
              <span>Referências ({entries.length})</span>
              <button type="button" className="fbib-chip" onClick={() => addNewEntry('article')}>
                <Plus size={11} /> Nova
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Search size={13} color="var(--muted)" />
              <input
                style={{
                  flex: 1,
                  padding: '5px 8px',
                  borderRadius: 5,
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  fontSize: 12,
                }}
                placeholder="Filtrar chave, autor ou título..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {filteredEntries.map((e) => {
              const countIssues = issues.filter((i) => i.entryId === e.id).length;
              return (
                <div
                  key={e.id}
                  className={`fbib-entry-item ${e.id === selectedEntry?.id ? 'active' : ''}`}
                  onClick={() => setSelectedId(e.id)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                    <strong style={{ fontSize: 12 }}>@{e.key}</strong>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <span className="fbib-badge">{e.type}</span>
                      {countIssues > 0 && (
                        <span className="fbib-badge warn">{countIssues} alerta(s)</span>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.fields.title || 'Sem título'}
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        <div className="fbib-resizer" onMouseDown={(e) => startResize('left', e)} />

        {/* Center: Visual Editor + ABNT Preview + Linter + Tex Audit */}
        <section className="fbib-center">
          {selectedEntry && (
            <div className="fbib-card">
              <div className="fbib-sec-title">
                <span>Editar Referência (@{selectedEntry.key})</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="button"
                    className="fbib-chip"
                    onClick={() => {
                      const used = new Set(
                        entries.filter((x) => x.id !== selectedEntry.id).map((x) => x.key)
                      );
                      updateSelected({ key: generateStandardKey(selectedEntry, used) });
                    }}
                    title="Gerar chave única padronizada (autor+ano+palavra)"
                  >
                    Gerar Chave Única
                  </button>
                  <button
                    type="button"
                    className="fbib-chip"
                    onClick={() => removeEntry(selectedEntry.id)}
                    style={{ color: '#f43f5e' }}
                    title="Remover entrada"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              <div className="fbib-grid2">
                <label className="fbib-field">
                  Tipo (@type)
                  <select
                    value={selectedEntry.type}
                    onChange={(e) => updateSelected({ type: e.target.value as BibEntryType })}
                  >
                    {ENTRY_TYPES.map((tp) => (
                      <option key={tp} value={tp}>
                        @{tp}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="fbib-field">
                  Chave de Citação (\cite{'{...}'})
                  <input
                    value={selectedEntry.key}
                    onChange={(e) => updateSelected({ key: e.target.value.replace(/\s+/g, '') })}
                  />
                </label>
              </div>

              <label className="fbib-field">
                <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Autor(es) (separe múltiplos com "and")</span>
                  <button
                    type="button"
                    className="fbib-chip"
                    onClick={() =>
                      updateField('author', toggleCorporateAuthor(selectedEntry.fields.author || ''))
                    }
                    title="Envolve com {{...}} para o biblatex-abnt não inverter nome institucional"
                  >
                    Autor Corporativo {'{{...}}'}
                  </button>
                </span>
                <input
                  value={selectedEntry.fields.author || ''}
                  onChange={(e) => updateField('author', e.target.value)}
                />
              </label>

              <label className="fbib-field">
                <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Título</span>
                  <button
                    type="button"
                    className="fbib-chip"
                    onClick={() =>
                      updateField('title', protectAcronymsInTitle(selectedEntry.fields.title || ''))
                    }
                    title="Protege siglas (COVID-19, USA, LaTeX) com chaves individuais {SIGLA}"
                  >
                    Proteger Siglas {'{ABC}'}
                  </button>
                </span>
                <input
                  value={selectedEntry.fields.title || ''}
                  onChange={(e) => updateField('title', e.target.value)}
                />
              </label>

              <div className="fbib-grid2">
                <label className="fbib-field">
                  Revista / Anais / Editora
                  <input
                    value={
                      selectedEntry.fields.journal ||
                      selectedEntry.fields.journaltitle ||
                      selectedEntry.fields.booktitle ||
                      selectedEntry.fields.publisher ||
                      ''
                    }
                    onChange={(e) => {
                      const key =
                        selectedEntry.type === 'article'
                          ? 'journal'
                          : selectedEntry.type === 'inproceedings'
                          ? 'booktitle'
                          : 'publisher';
                      updateField(key, e.target.value);
                    }}
                  />
                </label>
                <label className="fbib-field">
                  Ano
                  <input
                    value={selectedEntry.fields.year || ''}
                    onChange={(e) => updateField('year', e.target.value)}
                  />
                </label>
              </div>

              <div className="fbib-grid2">
                <label className="fbib-field">
                  Volume / Páginas
                  <input
                    placeholder="Ex: 76 | 769--789"
                    value={selectedEntry.fields.pages || ''}
                    onChange={(e) => updateField('pages', e.target.value)}
                  />
                </label>
                <label className="fbib-field">
                  DOI
                  <input
                    value={selectedEntry.fields.doi || ''}
                    onChange={(e) => updateField('doi', e.target.value)}
                  />
                </label>
              </div>

              <div className="fbib-grid2">
                <label className="fbib-field">
                  URL
                  <input
                    value={selectedEntry.fields.url || ''}
                    onChange={(e) => updateField('url', e.target.value)}
                  />
                </label>
                <label className="fbib-field">
                  Data de Acesso (urldate — ABNT)
                  <input
                    placeholder="YYYY-MM-DD"
                    value={selectedEntry.fields.urldate || ''}
                    onChange={(e) => updateField('urldate', e.target.value)}
                  />
                </label>
              </div>

              {selectedEntry.type === 'misc' && (
                <div className="fbib-grid2">
                  <label className="fbib-field">
                    arXiv eprint
                    <input
                      value={selectedEntry.fields.eprint || ''}
                      onChange={(e) => updateField('eprint', e.target.value)}
                    />
                  </label>
                  <label className="fbib-field">
                    primaryClass
                    <input
                      value={selectedEntry.fields.primaryClass || ''}
                      onChange={(e) => updateField('primaryClass', e.target.value)}
                    />
                  </label>
                </div>
              )}

              <div className="fbib-chip-row">
                <button
                  type="button"
                  className="fbib-chip"
                  onClick={async () => {
                    await navigator.clipboard.writeText(`\\cite{${selectedEntry.key}}`);
                    setStatusMsg(`Copiado: \\cite{${selectedEntry.key}}`);
                  }}
                >
                  Copiar \cite{'{' + selectedEntry.key + '}'}
                </button>
                <button
                  type="button"
                  className="fbib-chip"
                  onClick={async () => {
                    await navigator.clipboard.writeText(
                      `\\usepackage[style=abnt,backend=biber]{biblatex}\n\\addbibresource{referencias.bib}`
                    );
                    setStatusMsg('Preâmbulo biblatex-abnt copiado!');
                  }}
                >
                  Copiar Preâmbulo ABNT
                </button>
              </div>
            </div>
          )}

          {/* Citation Preview */}
          {selectedEntry && (
            <div className="fbib-card">
              <div className="fbib-sec-title">
                <span>Prévia Formatada</span>
                <select
                  value={citationStyle}
                  onChange={(e) => setCitationStyle(e.target.value as CitationStyle)}
                  style={{
                    padding: '3px 6px',
                    borderRadius: 4,
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    color: 'var(--text)',
                    fontSize: 11,
                  }}
                >
                  <option value="abnt">ABNT (NBR 6023)</option>
                  <option value="ieee">IEEE</option>
                  <option value="apa">APA</option>
                  <option value="authoryear">Author-Year</option>
                </select>
              </div>
              <div className="fbib-preview-box">
                {formatPreviewCitation(selectedEntry, citationStyle)}
              </div>
            </div>
          )}

          {/* Pre-Flight Linter + Duplicates */}
          <div className="fbib-card">
            <div className="fbib-sec-title">
              <span>Linter Pre-Flight & Duplicatas</span>
              <span className={`fbib-badge ${issues.length === 0 ? '' : 'warn'}`}>
                {issues.length === 0 ? 'Sem erros' : `${issues.length} alerta(s)`}
              </span>
            </div>
            {issues.length === 0 && duplicates.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <ShieldCheck size={15} /> Tudo limpo para compilar com Biber/BibTeX!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {(entryIssues.length > 0 ? entryIssues : issues.slice(0, 6)).map((iss, idx) => (
                  <div
                    key={idx}
                    style={{
                      fontSize: 11.5,
                      padding: '6px 8px',
                      borderRadius: 5,
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <span>
                      <AlertTriangle
                        size={12}
                        color={iss.severity === 'error' ? '#f43f5e' : '#f59e0b'}
                        style={{ verticalAlign: 'middle', marginRight: 5 }}
                      />
                      <strong>@{iss.entryKey}:</strong> {iss.message}
                    </span>
                    {iss.code === 'doi-url-clash' && (
                      <button
                        type="button"
                        className="fbib-chip"
                        onClick={() =>
                          updateEntriesVisual((prev) =>
                            prev.map((e) =>
                              e.id === iss.entryId
                                ? { ...e, fields: { ...e.fields, url: '' } }
                                : e
                            )
                          )
                        }
                      >
                        Remover URL
                      </button>
                    )}
                  </div>
                ))}
                {duplicates.map((dup, idx) => (
                  <div
                    key={`dup-${idx}`}
                    style={{
                      fontSize: 11.5,
                      padding: '6px 8px',
                      borderRadius: 5,
                      background: 'rgba(244,63,94,0.1)',
                      border: '1px solid rgba(244,63,94,0.35)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span>
                      Duplicata ({dup.reason}): {dup.entries.map((d) => `@${d.key}`).join(', ')}
                    </span>
                    <button
                      type="button"
                      className="fbib-chip"
                      onClick={() => removeEntry(dup.entries[dup.entries.length - 1].id)}
                    >
                      Mesclar / Remover cópia
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* .tex Audit */}
          {texAudit && (
            <div className="fbib-card">
              <div className="fbib-sec-title">
                <span>Auditoria .tex ({texAudit.fileName})</span>
                <button type="button" className="fbib-chip" onClick={() => setTexAudit(null)}>
                  Fechar
                </button>
              </div>
              <div style={{ fontSize: 12 }}>
                Citações únicas encontradas no texto: <strong>{texAudit.citedCount}</strong>
              </div>
              {texAudit.missingInBib.length > 0 && (
                <div style={{ fontSize: 11.5, color: '#f43f5e' }}>
                  <strong>Faltam no .bib ([?]):</strong> {texAudit.missingInBib.join(', ')}
                </div>
              )}
              {texAudit.unusedInTex.length > 0 && (
                <div style={{ fontSize: 11.5, color: '#f59e0b' }}>
                  <strong>Órfãs (não citadas no .tex):</strong> {texAudit.unusedInTex.join(', ')}
                </div>
              )}
            </div>
          )}
        </section>

        <div className="fbib-resizer" onMouseDown={(e) => startResize('right', e)} />

        {/* Right: Editable .bib code */}
        <aside className="fbib-code-pane">
          <div className="fbib-sec-title">
            <span>
              <BookOpen size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              Código .bib (Edição Bidirecional)
            </span>
          </div>
          <textarea
            className="fbib-code-editor"
            spellCheck={false}
            value={rawBib}
            onChange={(e) => handleRawBibChange(e.target.value)}
            title="Edite o .bib diretamente — macros LaTeX como \\apj ou $...$ são preservadas"
          />
        </aside>
      </main>

      {donateOpen && (
        <div className="fbib-modal-backdrop" onClick={() => setDonateOpen(false)}>
          <div className="fbib-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>Apoiar o ForjaBib (Ecossistema ForjaTeX)</strong>
              <button type="button" className="fbib-btn" onClick={() => setDonateOpen(false)}>
                <X size={13} />
              </button>
            </div>
            <div className="fbib-donate-grid">
              <div className="fbib-donate-box">
                <strong>Pix</strong>
                {pixQrUrl && <img src={pixQrUrl} alt="QR Pix" className="fbib-qr" />}
                <code style={{ fontSize: 10, wordBreak: 'break-all' }}>{PIX_KEY}</code>
                <button
                  type="button"
                  className="fbib-btn primary"
                  onClick={async () => {
                    await navigator.clipboard.writeText(pixBrCode || PIX_KEY);
                    setCopyTag('pix');
                    setTimeout(() => setCopyTag(null), 2000);
                  }}
                >
                  {copyTag === 'pix' ? <Check size={12} /> : <Copy size={12} />}{' '}
                  {copyTag === 'pix' ? 'Copiado!' : 'Copiar Pix'}
                </button>
              </div>
              <div className="fbib-donate-box">
                <strong>PayPal</strong>
                <code style={{ fontSize: 10 }}>{PAYPAL_EMAIL}</code>
                <button
                  type="button"
                  className="fbib-btn primary"
                  onClick={() => openExternal(getPayPalDonateUrl('DoacaoForjaBib'))}
                >
                  Abrir PayPal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
