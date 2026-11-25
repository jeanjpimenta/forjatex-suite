import React, { useState } from 'react';
import { BookMarked, Check, Search, X } from 'lucide-react';

interface BibWizardModalProps {
  open: boolean;
  onClose: () => void;
  onInsert: (bibEntry: string) => void;
}

export const BibWizardModal: React.FC<BibWizardModalProps> = ({
  open,
  onClose,
  onInsert,
}) => {
  const [entryType, setEntryType] = useState<'article' | 'book' | 'inproceedings' | 'misc'>('article');
  const [doi, setDoi] = useState('');
  const [loadingDoi, setLoadingDoi] = useState(false);
  const [doiError, setDoiError] = useState<string | null>(null);

  const [key, setKey] = useState('silva2026');
  const [author, setAuthor] = useState('');
  const [title, setTitle] = useState('');
  const [venue, setVenue] = useState('');
  const [year, setYear] = useState('2026');

  if (!open) return null;

  const handleFetchDoi = async () => {
    const clean = doi.trim().replace(/^https?:\/\/doi\.org\//i, '');
    if (!clean) return;
    setLoadingDoi(true);
    setDoiError(null);
    try {
      const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(clean)}`);
      if (!res.ok) throw new Error('DOI não encontrado na base Crossref.');
      const data = await res.json();
      const msg = data?.message;
      const authors = Array.isArray(msg?.author)
        ? msg.author.map((a: { family?: string; given?: string }) => `${a.family || ''}, ${a.given || ''}`).join(' and ')
        : '';
      const firstFamily = msg?.author?.[0]?.family?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'ref';
      const pubYear = String(msg?.published?.['date-parts']?.[0]?.[0] || new Date().getFullYear());
      setAuthor(authors);
      setTitle(msg?.title?.[0] || '');
      setVenue(msg?.['container-title']?.[0] || msg?.publisher || '');
      setYear(pubYear);
      setKey(`${firstFamily}${pubYear}`);
      if (msg?.type === 'book') setEntryType('book');
      else if (msg?.type === 'proceedings-article') setEntryType('inproceedings');
      else setEntryType('article');
    } catch (err) {
      setDoiError(err instanceof Error ? err.message : 'Falha ao buscar DOI.');
    } finally {
      setLoadingDoi(false);
    }
  };

  const venueField =
    entryType === 'book' ? 'publisher' : entryType === 'inproceedings' ? 'booktitle' : 'journal';

  const generated = [
    `@${entryType}{${key || 'referencia'},`,
    author ? `  author = {${author}},` : null,
    title ? `  title = {${title}},` : null,
    venue ? `  ${venueField} = {${venue}},` : null,
    year ? `  year = {${year}},` : null,
    doi ? `  doi = {${doi.trim()}},` : null,
    `}`,
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <div className="tf-modal-backdrop" onClick={onClose}>
      <div className="tf-modal tf-modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="tf-modal-header">
          <h2 className="flex items-center gap-2">
            <BookMarked size={16} className="text-amber-400" /> Assistente de Bibliografia (.bib) &amp; DOI
          </h2>
          <button type="button" className="tf-icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="tf-modal-body">
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Cole um DOI (ex: 10.1145/3544548.3580910) para preencher automaticamente..."
              value={doi}
              onChange={(e) => setDoi(e.target.value)}
              className="tf-doi-input flex-1"
            />
            <button
              type="button"
              className="tf-btn-secondary flex items-center gap-1"
              disabled={loadingDoi || !doi.trim()}
              onClick={handleFetchDoi}
            >
              <Search size={13} /> {loadingDoi ? 'Buscando...' : 'Buscar DOI'}
            </button>
          </div>
          {doiError && <div className="text-xs text-rose-400">{doiError}</div>}

          <div className="tf-form-grid">
            <label>
              <span>Tipo de Entrada</span>
              <select
                value={entryType}
                onChange={(e) =>
                  setEntryType(e.target.value as 'article' | 'book' | 'inproceedings' | 'misc')
                }
              >
                <option value="article">@article (Artigo)</option>
                <option value="book">@book (Livro)</option>
                <option value="inproceedings">@inproceedings (Congresso)</option>
                <option value="misc">@misc (Site / Outro)</option>
              </select>
            </label>
            <label>
              <span>Chave de Citação (\cite)</span>
              <input type="text" value={key} onChange={(e) => setKey(e.target.value)} />
            </label>
            <label>
              <span>Autor(es)</span>
              <input
                type="text"
                placeholder="Sobrenome, Nome and ..."
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
              />
            </label>
            <label>
              <span>Ano</span>
              <input type="text" value={year} onChange={(e) => setYear(e.target.value)} />
            </label>
          </div>

          <label className="tf-full-label">
            <span>Título</span>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>

          <label className="tf-full-label">
            <span>{entryType === 'book' ? 'Editora' : 'Revista / Conferência'}</span>
            <input type="text" value={venue} onChange={(e) => setVenue(e.target.value)} />
          </label>

          <pre className="tf-live-code">{generated}</pre>
        </div>

        <div className="tf-modal-footer">
          <button
            type="button"
            className="tf-btn-primary"
            onClick={() => {
              onInsert(generated);
              onClose();
            }}
          >
            <Check size={14} /> Inserir Entrada BibTeX
          </button>
        </div>
      </div>
    </div>
  );
};

