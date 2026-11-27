import React, { useMemo, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import { open as openExternal } from '@tauri-apps/plugin-shell';
import {
  AlertTriangle,
  BookOpen,
  Check,
  ChevronUp,
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
  BIB_TYPE_GROUPS,
  CITATION_STYLES,
  createDefaultBibEntries,
  findDuplicates,
  formatNatbibInText,
  formatPreviewCitation,
  generateStandardKey,
  lintBibEntries,
  parseArxivXmlToEntry,
  parseBibText,
  protectAcronymsInTitle,
  serializeBibEntries,
  toggleCorporateAuthor,
  type BibEngineMode,
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

const LIBRARY_KEY = 'forjabib_library_v1';
const WORKSPACE_KEY = 'forjabib_workspace_v2';

interface BibTab {
  id: string;
  title: string;
  filePath: string | null;
  includedIds: string[];
  selectedId: string;
  citationStyle: CitationStyle;
  bibEngine?: BibEngineMode;
  texAudit: {
    fileName: string;
    citedCount: number;
    missingInBib: string[];
    unusedInTex: string[];
  } | null;
}

function loadSavedLibrary(): BibEntry[] {
  try {
    const raw = localStorage.getItem(LIBRARY_KEY) || localStorage.getItem('forjabib_workspace_v1');
    if (raw) {
      const parsed = JSON.parse(raw) as BibEntry[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    // ignore
  }
  return createDefaultBibEntries();
}

function loadSavedTabs(library: BibEntry[]): { tabs: BibTab[]; activeTabId: string } {
  try {
    const raw = localStorage.getItem(WORKSPACE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { tabs?: BibTab[]; activeTabId?: string };
      if (Array.isArray(parsed.tabs) && parsed.tabs.length > 0) {
        const activeId =
          parsed.tabs.find((t) => t.id === parsed.activeTabId)?.id || parsed.tabs[0].id;
        return { tabs: parsed.tabs, activeTabId: activeId };
      }
    }
  } catch {
    // ignore
  }
  const first: BibTab = {
    id: `bibtab-${Date.now()}`,
    title: 'referencias.bib',
    filePath: null,
    includedIds: library.map((e) => e.id),
    selectedId: library[0]?.id || '',
    citationStyle: 'abnt',
    texAudit: null,
  };
  return { tabs: [first], activeTabId: first.id };
}

export default function App() {
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>('dark');
  const [library, setLibrary] = useState<BibEntry[]>(() => loadSavedLibrary());
  const initialTabs = useMemo(() => loadSavedTabs(library), []);
  const [tabs, setTabs] = useState<BibTab[]>(initialTabs.tabs);
  const [activeTabId, setActiveTabId] = useState<string>(initialTabs.activeTabId);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTabTitle, setEditingTabTitle] = useState('');

  const [search, setSearch] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  // Lookup bar (DOI / arXiv / ISBN)
  const [lookupInput, setLookupInput] = useState('');
  const [lookupBusy, setLookupBusy] = useState(false);

  // Upward searchable style dropdown
  const [styleOpen, setStyleOpen] = useState(false);
  const [styleSearch, setStyleSearch] = useState('');
  const stylePickerRef = useRef<HTMLDivElement | null>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
  const includedSet = useMemo(() => new Set(activeTab.includedIds), [activeTab.includedIds]);
  const tabEntries = useMemo(
    () => library.filter((e) => includedSet.has(e.id)),
    [library, includedSet]
  );

  // Bidirectional raw .bib editor (scoped to the active tab's checked entries)
  const activeEngine: BibEngineMode = activeTab.bibEngine || 'biblatex';
  const serialized = useMemo(
    () => serializeBibEntries(tabEntries, activeEngine),
    [tabEntries, activeEngine]
  );
  const [rawBib, setRawBib] = useState<string>(() => serialized);
  const editSourceRef = useRef<'visual' | 'code'>('visual');
  const parseTimerRef = useRef<number | null>(null);

  const [sidebarWidth, setSidebarWidth] = useState(340);
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
      localStorage.setItem(LIBRARY_KEY, JSON.stringify(library));
    } catch {
      // ignore
    }
  }, [library]);

  React.useEffect(() => {
    try {
      localStorage.setItem(WORKSPACE_KEY, JSON.stringify({ activeTabId, tabs }));
    } catch {
      // ignore
    }
  }, [activeTabId, tabs]);

  React.useEffect(() => {
    if (editSourceRef.current === 'visual') {
      setRawBib(serialized);
    }
    editSourceRef.current = 'visual';
  }, [serialized, activeTabId]);

  React.useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (stylePickerRef.current && !stylePickerRef.current.contains(e.target as Node)) {
        setStyleOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  React.useEffect(() => {
    generatePixQrDataUrl('DoacaoForjaBib')
      .then(({ brCode, qrUrl }) => {
        setPixBrCode(brCode);
        setPixQrUrl(qrUrl);
      })
      .catch(() => {});
  }, []);

  const updateActiveTab = (updater: (prev: BibTab) => BibTab) => {
    setTabs((prev) => prev.map((tb) => (tb.id === activeTabId ? updater(tb) : tb)));
  };

  const selectedEntry =
    library.find((e) => e.id === activeTab.selectedId) || tabEntries[0] || library[0];
  const issues = useMemo(
    () => lintBibEntries(tabEntries, activeEngine),
    [tabEntries, activeEngine]
  );
  const duplicates = useMemo(() => findDuplicates(tabEntries), [tabEntries]);

  const filteredLibrary = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return library;
    return library.filter(
      (e) =>
        e.key.toLowerCase().includes(q) ||
        (e.fields.title || '').toLowerCase().includes(q) ||
        (e.fields.author || '').toLowerCase().includes(q) ||
        (e.fields.year || '').includes(q)
    );
  }, [library, search]);

  const filteredStyles = useMemo(() => {
    const q = styleSearch.trim().toLowerCase();
    if (!q) return CITATION_STYLES;
    return CITATION_STYLES.filter(
      (s) => s.label.toLowerCase().includes(q) || s.group.toLowerCase().includes(q)
    );
  }, [styleSearch]);

  const updateLibraryVisual = (updater: (prev: BibEntry[]) => BibEntry[]) => {
    editSourceRef.current = 'visual';
    setLibrary(updater);
  };

  const updateSelected = (patch: Partial<BibEntry>) => {
    if (!selectedEntry) return;
    updateLibraryVisual((prev) =>
      prev.map((e) => (e.id === selectedEntry.id ? { ...e, ...patch } : e))
    );
  };

  const updateField = (field: string, value: string) => {
    if (!selectedEntry) return;
    updateLibraryVisual((prev) =>
      prev.map((e) =>
        e.id === selectedEntry.id
          ? { ...e, fields: { ...e.fields, [field]: value } }
          : e
      )
    );
  };

  const toggleIncludeInTab = (entryId: string) => {
    editSourceRef.current = 'visual';
    updateActiveTab((tb) => {
      const exists = tb.includedIds.includes(entryId);
      return {
        ...tb,
        includedIds: exists
          ? tb.includedIds.filter((id) => id !== entryId)
          : [...tb.includedIds, entryId],
      };
    });
  };

  const handleRawBibChange = (nextText: string) => {
    editSourceRef.current = 'code';
    setRawBib(nextText);
    if (parseTimerRef.current) window.clearTimeout(parseTimerRef.current);
    parseTimerRef.current = window.setTimeout(() => {
      const parsed = parseBibText(nextText);
      editSourceRef.current = 'code';
      if (parsed.length === 0 && nextText.trim() === '') {
        updateActiveTab((tb) => ({ ...tb, includedIds: [] }));
        return;
      }
      if (parsed.length > 0) {
        setLibrary((prevLib) => {
          const nextLib = [...prevLib];
          const tabIds: string[] = [];
          for (const p of parsed) {
            const existingIdx = nextLib.findIndex(
              (item) => item.id === p.id || item.key === p.key
            );
            if (existingIdx >= 0) {
              const keepId = nextLib[existingIdx].id;
              nextLib[existingIdx] = { ...p, id: keepId };
              tabIds.push(keepId);
            } else {
              nextLib.push(p);
              tabIds.push(p.id);
            }
          }
          updateActiveTab((tb) => ({ ...tb, includedIds: tabIds }));
          return nextLib;
        });
      }
    }, 300);
  };

  const addEntryAndInclude = (entry: BibEntry) => {
    updateLibraryVisual((prev) => [...prev, entry]);
    updateActiveTab((tb) => ({
      ...tb,
      includedIds: tb.includedIds.includes(entry.id) ? tb.includedIds : [...tb.includedIds, entry.id],
      selectedId: entry.id,
    }));
  };

  const addNewEntry = (type: BibEntryType = 'article') => {
    const id = `bib-${Date.now()}`;
    const existingKeys = new Set(library.map((e) => e.key));
    let key = `ref${library.length + 1}`;
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
    addEntryAndInclude(next);
  };

  const removeFromLibrary = (id: string) => {
    if (library.length <= 1) return;
    updateLibraryVisual((prev) => prev.filter((e) => e.id !== id));
    setTabs((prev) =>
      prev.map((tb) => ({
        ...tb,
        includedIds: tb.includedIds.filter((x) => x !== id),
        selectedId: tb.selectedId === id ? library.find((x) => x.id !== id)?.id || '' : tb.selectedId,
      }))
    );
  };

  const createNewTab = () => {
    const newTab: BibTab = {
      id: `bibtab-${Date.now()}`,
      title: `projeto-${tabs.length + 1}.bib`,
      filePath: null,
      includedIds: [],
      selectedId: library[0]?.id || '',
      citationStyle: activeTab.citationStyle,
      texAudit: null,
    };
    editSourceRef.current = 'visual';
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
  };

  const closeTab = (id: string) => {
    editSourceRef.current = 'visual';
    if (tabs.length === 1) {
      setTabs([
        {
          id: tabs[0].id,
          title: 'referencias.bib',
          filePath: null,
          includedIds: [],
          selectedId: library[0]?.id || '',
          citationStyle: 'abnt',
          texAudit: null,
        },
      ]);
      return;
    }
    const idx = tabs.findIndex((tb) => tb.id === id);
    const remaining = tabs.filter((tb) => tb.id !== id);
    setTabs(remaining);
    if (id === activeTabId) {
      setActiveTabId((remaining[Math.max(0, idx - 1)] || remaining[0]).id);
    }
  };

  const handleImportLookup = async () => {
    const q = lookupInput.trim();
    if (!q) return;
    setLookupBusy(true);
    setStatusMsg('Buscando metadados...');
    try {
      if (/^10\.\d{4,9}\/\S+$/i.test(q) || q.includes('doi.org/')) {
        const doi = q.replace(/^https?:\/\/(dx\.)?doi\.org\//i, '').trim();
        const bib = await invoke<string>('fetch_url_text', {
          url: `https://api.crossref.org/works/${encodeURIComponent(doi)}/transform/application/x-bibtex`,
          accept: 'application/x-bibtex',
        });
        const parsed = parseBibText(bib);
        if (parsed.length === 0) throw new Error('DOI não retornou BibTeX válido.');
        const imported = { ...parsed[0], id: `bib-${Date.now()}` };
        addEntryAndInclude(imported);
        setLookupInput('');
        setStatusMsg(`DOI importado na biblioteca e marcado na aba: @${imported.key}`);
        return;
      }

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
        addEntryAndInclude(imported);
        setLookupInput('');
        setStatusMsg(`arXiv importado (@misc eprint): @${imported.key}`);
        return;
      }

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
        temp.key = generateStandardKey(temp, new Set(library.map((e) => e.key)));
        addEntryAndInclude(temp);
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

      const mergedIds: string[] = [];
      setLibrary((prevLib) => {
        const nextLib = [...prevLib];
        for (const p of parsed) {
          const existing = nextLib.find((x) => x.key === p.key);
          if (existing) {
            mergedIds.push(existing.id);
          } else {
            nextLib.push(p);
            mergedIds.push(p.id);
          }
        }
        return nextLib;
      });
      const fileName = selected.split(/[\\/]/).pop() || 'referencias.bib';
      updateActiveTab((tb) => ({
        ...tb,
        title: fileName,
        filePath: selected,
        includedIds: mergedIds,
        selectedId: mergedIds[0] || tb.selectedId,
      }));
      setStatusMsg(`Arquivo aberto na aba: ${selected} (${parsed.length} referências)`);
    } catch (e) {
      setStatusMsg(String(e));
    }
  };

  const handleSaveBib = async (saveAs = false) => {
    let target = saveAs ? null : activeTab.filePath;
    if (!target) {
      const chosen = await save({
        filters: [{ name: 'BibTeX / BibLaTeX', extensions: ['bib'] }],
        defaultPath: activeTab.title.endsWith('.bib') ? activeTab.title : `${activeTab.title}.bib`,
      });
      if (!chosen) return;
      target = chosen;
    }
    try {
      await invoke('save_text_file', { path: target, content: rawBib });
      const fileName = target.split(/[\\/]/).pop() || activeTab.title;
      updateActiveTab((tb) => ({ ...tb, title: fileName, filePath: target }));
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
      const res = auditTexAgainstBib(texContent, tabEntries);
      updateActiveTab((tb) => ({
        ...tb,
        texAudit: {
          fileName: selected.split(/[\\/]/).pop() || selected,
          ...res,
        },
      }));
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
  const activeStyleObj =
    CITATION_STYLES.find((s) => s.id === activeTab.citationStyle) || CITATION_STYLES[0];

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
              setStatusMsg(`Código .bib da aba "${activeTab.title}" copiado!`);
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

      {/* Independent Renameable Tabs */}
      <div className="fbib-tabbar">
        <div className="fbib-tabbar-list">
          {tabs.map((tb) => (
            <div
              key={tb.id}
              className={`fbib-proj-tab ${tb.id === activeTabId ? 'active' : ''}`}
              onClick={() => {
                editSourceRef.current = 'visual';
                setActiveTabId(tb.id);
              }}
              onDoubleClick={() => {
                setEditingTabId(tb.id);
                setEditingTabTitle(tb.title);
              }}
              title="Clique duplo para renomear esta aba"
            >
              <span className="fbib-badge">{tb.includedIds.length}</span>
              {editingTabId === tb.id ? (
                <input
                  autoFocus
                  style={{ width: 115, height: 18, fontSize: 11 }}
                  value={editingTabTitle}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setEditingTabTitle(e.target.value)}
                  onBlur={() => {
                    const trimmed = editingTabTitle.trim();
                    if (trimmed) {
                      setTabs((prev) =>
                        prev.map((item) => (item.id === tb.id ? { ...item, title: trimmed } : item))
                      );
                    }
                    setEditingTabId(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                    if (e.key === 'Escape') setEditingTabId(null);
                  }}
                />
              ) : (
                <span className="fbib-proj-title">{tb.title}</span>
              )}
              <button
                type="button"
                className="fbib-proj-close"
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tb.id);
                }}
              >
                <X size={11} />
              </button>
            </div>
          ))}
          <button type="button" className="fbib-btn" style={{ padding: '3px 7px' }} onClick={createNewTab} title="Nova aba .bib">
            <Plus size={12} />
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>Motor:</span>
          <select
            value={activeEngine}
            onChange={(e) => {
              editSourceRef.current = 'visual';
              updateActiveTab((tb) => ({ ...tb, bibEngine: e.target.value as BibEngineMode }));
            }}
            style={{
              padding: '3px 7px',
              borderRadius: 5,
              border: '1px solid var(--border)',
              background: 'var(--panel)',
              color: 'var(--text)',
              fontSize: 11,
              fontWeight: 600,
            }}
            title="Escolha entre BibLaTeX (Biber) ou natbib (BibTeX clássico)"
          >
            <option value="biblatex">BibLaTeX (Biber)</option>
            <option value="natbib">natbib (BibTeX Clássico)</option>
          </select>
        </div>
      </div>

      {statusMsg && <div className="fbib-status">{statusMsg}</div>}

      <main
        className="fbib-main"
        style={{ gridTemplateColumns: `${sidebarWidth}px 5px 1fr 5px ${codeWidth}px` }}
      >
        {/* Left: Shared Global Library with Checkboxes for active tab */}
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
              <span>Referências ({library.length} no acervo · {tabEntries.length} na aba)</span>
              <button type="button" className="fbib-chip" onClick={() => addNewEntry('article')}>
                <Plus size={11} /> Nova
              </button>
            </div>
            <div className="fbib-chip-row">
              <button
                type="button"
                className="fbib-chip"
                onClick={() => {
                  editSourceRef.current = 'visual';
                  updateActiveTab((tb) => ({ ...tb, includedIds: library.map((e) => e.id) }));
                }}
              >
                Marcar todas
              </button>
              <button
                type="button"
                className="fbib-chip"
                onClick={() => {
                  editSourceRef.current = 'visual';
                  updateActiveTab((tb) => ({ ...tb, includedIds: [] }));
                }}
              >
                Desmarcar todas
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

            {filteredLibrary.map((e) => {
              const isChecked = includedSet.has(e.id);
              const countIssues = isChecked
                ? issues.filter((i) => i.entryId === e.id).length
                : 0;
              return (
                <div
                  key={e.id}
                  className={`fbib-entry-item ${e.id === selectedEntry?.id ? 'active' : ''}`}
                  onClick={() => updateActiveTab((tb) => ({ ...tb, selectedId: e.id }))}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                    <label
                      style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', minWidth: 0 }}
                      onClick={(ev) => ev.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleIncludeInTab(e.id)}
                        title="Marcar para incluir no .bib desta aba"
                      />
                      <strong style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        @{e.key}
                      </strong>
                    </label>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <span className="fbib-badge">{e.type}</span>
                      {countIssues > 0 && (
                        <span className="fbib-badge warn">{countIssues}</span>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingLeft: 20 }}>
                    {e.fields.title || 'Sem título'}
                  </div>
                </div>
              );
            })}
          </div>
        </aside>

        <div className="fbib-resizer" onMouseDown={(e) => startResize('left', e)} />

        {/* Center: Visual Editor + Searchable Preview + Linter + Tex Audit */}
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
                        library.filter((x) => x.id !== selectedEntry.id).map((x) => x.key)
                      );
                      updateSelected({ key: generateStandardKey(selectedEntry, used) });
                    }}
                  >
                    Gerar Chave Única
                  </button>
                  <button
                    type="button"
                    className="fbib-chip"
                    onClick={() => removeFromLibrary(selectedEntry.id)}
                    style={{ color: '#f43f5e' }}
                    title="Excluir do acervo global"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              <div className="fbib-grid2">
                <label className="fbib-field">
                  Tipo (@type — BibTeX & BibLaTeX)
                  <select
                    value={selectedEntry.type}
                    onChange={(e) => updateSelected({ type: e.target.value as BibEntryType })}
                  >
                    {BIB_TYPE_GROUPS.map((grp) => (
                      <optgroup key={grp.label} label={grp.label}>
                        {grp.types.map((tp) => (
                          <option key={tp.id} value={tp.id}>
                            @{tp.id} — {tp.desc}
                          </option>
                        ))}
                      </optgroup>
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
                  Revista / Anais / Editora / Instituição
                  <input
                    value={
                      selectedEntry.fields.journal ||
                      selectedEntry.fields.journaltitle ||
                      selectedEntry.fields.booktitle ||
                      selectedEntry.fields.publisher ||
                      selectedEntry.fields.institution ||
                      selectedEntry.fields.school ||
                      ''
                    }
                    onChange={(e) => {
                      const t = selectedEntry.type;
                      const key =
                        t === 'article' || t === 'periodical'
                          ? 'journal'
                          : t === 'inproceedings' ||
                            t === 'conference' ||
                            t === 'incollection' ||
                            t === 'inbook' ||
                            t === 'bookinbook' ||
                            t === 'inreference'
                          ? 'booktitle'
                          : t === 'thesis' || t === 'report' || t === 'techreport'
                          ? 'institution'
                          : t === 'phdthesis' || t === 'mastersthesis'
                          ? 'school'
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

              {(selectedEntry.type === 'collection' ||
                selectedEntry.type === 'incollection' ||
                selectedEntry.type === 'proceedings' ||
                selectedEntry.type === 'reference') && (
                <label className="fbib-field">
                  Editor(es) / Organizador(es) (editor)
                  <input
                    value={selectedEntry.fields.editor || ''}
                    onChange={(e) => updateField('editor', e.target.value)}
                  />
                </label>
              )}

              {(selectedEntry.type === 'software' || selectedEntry.type === 'dataset') && (
                <label className="fbib-field">
                  Versão (version)
                  <input
                    placeholder="Ex: 1.4.2"
                    value={selectedEntry.fields.version || ''}
                    onChange={(e) => updateField('version', e.target.value)}
                  />
                </label>
              )}

              {selectedEntry.type === 'patent' && (
                <div className="fbib-grid2">
                  <label className="fbib-field">
                    Número da Patente (number)
                    <input
                      value={selectedEntry.fields.number || ''}
                      onChange={(e) => updateField('number', e.target.value)}
                    />
                  </label>
                  <label className="fbib-field">
                    Titular (holder)
                    <input
                      value={selectedEntry.fields.holder || ''}
                      onChange={(e) => updateField('holder', e.target.value)}
                    />
                  </label>
                </div>
              )}

              {selectedEntry.type === 'set' && (
                <label className="fbib-field">
                  Chaves agrupadas (entryset — separadas por vírgula)
                  <input
                    placeholder="chave1, chave2, chave3"
                    value={selectedEntry.fields.entryset || ''}
                    onChange={(e) => updateField('entryset', e.target.value)}
                  />
                </label>
              )}

              <div className="fbib-grid2">
                <label className="fbib-field">
                  Páginas
                  <input
                    placeholder="Ex: 769--789"
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
                {activeEngine === 'natbib' ? (
                  <>
                    <button
                      type="button"
                      className="fbib-chip"
                      onClick={async () => {
                        await navigator.clipboard.writeText(`\\citep{${selectedEntry.key}}`);
                        setStatusMsg(`Copiado: \\citep{${selectedEntry.key}}`);
                      }}
                    >
                      Copiar \citep{'{' + selectedEntry.key + '}'}
                    </button>
                    <button
                      type="button"
                      className="fbib-chip"
                      onClick={async () => {
                        await navigator.clipboard.writeText(`\\citet{${selectedEntry.key}}`);
                        setStatusMsg(`Copiado: \\citet{${selectedEntry.key}}`);
                      }}
                    >
                      Copiar \citet{'{' + selectedEntry.key + '}'}
                    </button>
                    <button
                      type="button"
                      className="fbib-chip"
                      onClick={async () => {
                        const base = activeTab.title.replace(/\.bib$/i, '');
                        await navigator.clipboard.writeText(
                          `\\usepackage[round,authoryear]{natbib}\n\\bibliographystyle{plainnat}\n\\bibliography{${base}}`
                        );
                        setStatusMsg('Preâmbulo natbib (plainnat) copiado!');
                      }}
                    >
                      Preâmbulo natbib
                    </button>
                    <button
                      type="button"
                      className="fbib-chip"
                      onClick={async () => {
                        const base = activeTab.title.replace(/\.bib$/i, '');
                        await navigator.clipboard.writeText(
                          `\\usepackage[alf]{abntex2cite}\n\\bibliography{${base}}`
                        );
                        setStatusMsg('Preâmbulo abntex2cite copiado!');
                      }}
                    >
                      Preâmbulo abntex2cite
                    </button>
                  </>
                ) : (
                  <>
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
                        await navigator.clipboard.writeText(`\\parencite{${selectedEntry.key}}`);
                        setStatusMsg(`Copiado: \\parencite{${selectedEntry.key}}`);
                      }}
                    >
                      Copiar \parencite
                    </button>
                    <button
                      type="button"
                      className="fbib-chip"
                      onClick={async () => {
                        await navigator.clipboard.writeText(`\\textcite{${selectedEntry.key}}`);
                        setStatusMsg(`Copiado: \\textcite{${selectedEntry.key}}`);
                      }}
                    >
                      Copiar \textcite
                    </button>
                    <button
                      type="button"
                      className="fbib-chip"
                      onClick={async () => {
                        await navigator.clipboard.writeText(
                          `\\usepackage[style=abnt,backend=biber]{biblatex}\n\\addbibresource{${activeTab.title}}`
                        );
                        setStatusMsg('Preâmbulo biblatex-abnt copiado!');
                      }}
                    >
                      Copiar Preâmbulo ABNT
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Formatted Preview with upward-opening searchable dropdown (max 12 visible) */}
          {selectedEntry && (
            <div className="fbib-card">
              <div className="fbib-sec-title">
                <span>Prévia Formatada</span>
                <div className="fbib-style-picker" ref={stylePickerRef}>
                  <button
                    type="button"
                    className="fbib-chip"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
                    onClick={() => {
                      setStyleOpen((v) => !v);
                      setStyleSearch('');
                    }}
                  >
                    <span>{activeStyleObj.label}</span>
                    <ChevronUp size={12} />
                  </button>
                  {styleOpen && (
                    <div className="fbib-style-popover">
                      <input
                        autoFocus
                        className="fbib-style-search"
                        placeholder="Pesquisar estilo (ex: ABNT, IEEE, Nature)..."
                        value={styleSearch}
                        onChange={(e) => setStyleSearch(e.target.value)}
                      />
                      <div className="fbib-style-list">
                        {filteredStyles.length === 0 ? (
                          <div style={{ fontSize: 11, color: 'var(--muted)', padding: 6 }}>
                            Nenhum estilo encontrado.
                          </div>
                        ) : (
                          filteredStyles.map((st) => (
                            <button
                              key={st.id}
                              type="button"
                              className={`fbib-style-opt ${
                                st.id === activeTab.citationStyle ? 'active' : ''
                              }`}
                              onClick={() => {
                                updateActiveTab((tb) => ({ ...tb, citationStyle: st.id }));
                                setStyleOpen(false);
                              }}
                            >
                              <span>{st.label}</span>
                              <span style={{ fontSize: 9.5, opacity: 0.7 }}>{st.group}</span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="fbib-preview-box">
                {formatPreviewCitation(selectedEntry, activeTab.citationStyle)}
                {activeEngine === 'natbib' && (() => {
                  const nt = formatNatbibInText(selectedEntry);
                  return (
                    <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px dashed var(--border)', fontSize: 11, color: 'var(--muted)' }}>
                      <strong>natbib no texto:</strong> <code>\citet</code> → {nt.citet} &nbsp;|&nbsp; <code>\citep</code> → {nt.citep}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Pre-Flight Linter + Duplicates */}
          <div className="fbib-card">
            <div className="fbib-sec-title">
              <span>Linter Pre-Flight & Duplicatas (Aba Atual)</span>
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
                          updateLibraryVisual((prev) =>
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
                      onClick={() =>
                        toggleIncludeInTab(dup.entries[dup.entries.length - 1].id)
                      }
                    >
                      Desmarcar cópia da aba
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* .tex Audit */}
          {activeTab.texAudit && (
            <div className="fbib-card">
              <div className="fbib-sec-title">
                <span>Auditoria .tex ({activeTab.texAudit.fileName})</span>
                <button
                  type="button"
                  className="fbib-chip"
                  onClick={() => updateActiveTab((tb) => ({ ...tb, texAudit: null }))}
                >
                  Fechar
                </button>
              </div>
              <div style={{ fontSize: 12 }}>
                Citações únicas encontradas no texto: <strong>{activeTab.texAudit.citedCount}</strong>
              </div>
              {activeTab.texAudit.missingInBib.length > 0 && (
                <div style={{ fontSize: 11.5, color: '#f43f5e' }}>
                  <strong>Faltam no .bib desta aba ([?]):</strong>{' '}
                  {activeTab.texAudit.missingInBib.join(', ')}
                </div>
              )}
              {activeTab.texAudit.unusedInTex.length > 0 && (
                <div style={{ fontSize: 11.5, color: '#f59e0b' }}>
                  <strong>Marcadas na aba mas não citadas:</strong>{' '}
                  {activeTab.texAudit.unusedInTex.join(', ')}
                </div>
              )}
            </div>
          )}
        </section>

        <div className="fbib-resizer" onMouseDown={(e) => startResize('right', e)} />

        {/* Right: Editable .bib code for active tab */}
        <aside className="fbib-code-pane">
          <div className="fbib-sec-title">
            <span>
              <BookOpen size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              Código .bib — {activeTab.title}
            </span>
          </div>
          <textarea
            className="fbib-code-editor"
            spellCheck={false}
            value={rawBib}
            onChange={(e) => handleRawBibChange(e.target.value)}
            placeholder="Marque referências à esquerda para incluí-las neste arquivo .bib..."
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
