import React, { useState } from 'react';
import { FileCode2, FileText, FolderOpen, Sparkles, X } from 'lucide-react';
import { convertMarkdownToLatex, pickMarkdownFile } from '../utils/tauriBridge';
import { useI18n } from '../i18n';

interface MarkdownImportModalProps {
  open: boolean;
  hasProject: boolean;
  onClose: () => void;
  onInsertIntoEditor: (latex: string) => void;
  onSaveAsNewFile: (fileName: string, latex: string) => Promise<void>;
}

const SAMPLE_MD = `# Introdução

Escreva ou cole seu texto em **Markdown** (ou notas do *Obsidian*) com equações $E = mc^2$ e citações [@knuth1984].

## Resultados

| Método | Precisão | Tempo |
| :--- | :---: | ---: |
| Base | 89.2% | 1.4s |
| ForjaTeX | 98.7% | 0.6s |
`;

export const MarkdownImportModal: React.FC<MarkdownImportModalProps> = ({
  open,
  hasProject,
  onClose,
  onInsertIntoEditor,
  onSaveAsNewFile,
}) => {
  const { t } = useI18n();
  const [filePath, setFilePath] = useState<string | null>(null);
  const [markdown, setMarkdown] = useState(SAMPLE_MD);
  const [template, setTemplate] = useState<'abnt' | 'article' | 'beamer' | 'snippet'>('abnt');
  const [title, setTitle] = useState('Documento Importado');
  const [author, setAuthor] = useState('Autor');
  const [institution, setInstitution] = useState('');
  const [convertCitations, setConvertCitations] = useState(true);
  const [fileName, setFileName] = useState('importado.tex');
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const handlePick = async () => {
    setError('');
    try {
      const picked = await pickMarkdownFile();
      if (picked) {
        setFilePath(picked);
        const base = picked.split(/[\\/]/).pop()?.replace(/\.(md|markdown|txt)$/i, '') || 'importado';
        setFileName(`${base}.tex`);
        setTitle(base);
      }
    } catch (e) {
      setError(String(e));
    }
  };

  const runConversion = async () => {
    return convertMarkdownToLatex({
      filePath: filePath ?? undefined,
      markdown: filePath ? undefined : markdown,
      template,
      title,
      author,
      institution,
      convertCitations,
    });
  };

  const handleGenerate = async () => {
    setBusy(true);
    setError('');
    try {
      const latex = await runConversion();
      setPreview(latex);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  const handleInsert = async () => {
    let out = preview;
    if (!out) {
      setBusy(true);
      try {
        out = await runConversion();
      } catch (e) {
        setError(String(e));
        setBusy(false);
        return;
      }
      setBusy(false);
    }
    onInsertIntoEditor(out);
    onClose();
  };

  const handleSave = async () => {
    let out = preview;
    if (!out) {
      setBusy(true);
      try {
        out = await runConversion();
      } catch (e) {
        setError(String(e));
        setBusy(false);
        return;
      }
      setBusy(false);
    }
    const cleanName = fileName.trim().endsWith('.tex') ? fileName.trim() : `${fileName.trim() || 'importado'}.tex`;
    await onSaveAsNewFile(cleanName, out);
    onClose();
  };

  return (
    <div className="tf-modal-backdrop" onClick={onClose}>
      <div className="tf-modal tf-md-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tf-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileCode2 size={18} className="text-sky-400" />
            <h3>{t('md.title')}</h3>
          </div>
          <button type="button" className="tf-icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="tf-modal-body tf-md-body">
          {/* Top Metadata Grid */}
          <div className="tf-md-meta-grid">
            <label className="tf-md-field">
              <span>{t('md.template')}</span>
              <select
                className="tf-md-input"
                value={template}
                onChange={(e) => setTemplate(e.target.value as typeof template)}
              >
                <option value="abnt">ABNT (TCC / Monografia)</option>
                <option value="article">Article (Artigo Científico)</option>
                <option value="beamer">Beamer (Apresentação)</option>
                <option value="snippet">Snippet (Apenas corpo)</option>
              </select>
            </label>

            <label className="tf-md-field">
              <span>{t('md.docTitle')}</span>
              <input className="tf-md-input" value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>

            <label className="tf-md-field">
              <span>{t('md.author')}</span>
              <input className="tf-md-input" value={author} onChange={(e) => setAuthor(e.target.value)} />
            </label>

            <label className="tf-md-field">
              <span>{t('md.institution')}</span>
              <input
                className="tf-md-input"
                value={institution}
                placeholder="Ex.: Universidade / Instituição"
                onChange={(e) => setInstitution(e.target.value)}
              />
            </label>
          </div>

          {/* Options & File Bar */}
          <div className="tf-md-options-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <button type="button" className="tf-btn-secondary" onClick={handlePick}>
                <FolderOpen size={14} /> {t('md.pickFile')}
              </button>
              {filePath && (
                <button
                  type="button"
                  className="tf-btn-ghost"
                  onClick={() => setFilePath(null)}
                  title="Voltar para edição manual de texto"
                >
                  × {filePath.split(/[\\/]/).pop()}
                </button>
              )}
              <label className="tf-md-checkbox">
                <input
                  type="checkbox"
                  checked={convertCitations}
                  onChange={(e) => setConvertCitations(e.target.checked)}
                />
                <span>{t('md.citations')}</span>
              </label>
            </div>

            {hasProject && (
              <label className="tf-md-filename">
                <span>Arquivo .tex:</span>
                <input
                  className="tf-md-input"
                  style={{ width: 170 }}
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                />
              </label>
            )}
          </div>

          {error && <div className="tf-md-error">{error}</div>}

          {/* Large Side-by-Side Editors */}
          <div className="tf-md-split">
            <div className="tf-md-pane">
              <div className="tf-md-pane-header">
                <span>Markdown / Obsidian</span>
                {filePath ? (
                  <span className="tf-md-badge">{filePath.split(/[\\/]/).pop()}</span>
                ) : (
                  <span className="tf-md-hint">{t('md.orPaste')}</span>
                )}
              </div>
              {filePath ? (
                <div className="tf-md-file-placeholder">
                  <FolderOpen size={28} className="text-sky-400" />
                  <strong>{filePath}</strong>
                  <span>Clique em &ldquo;{t('md.generate')}&rdquo; para converter o arquivo selecionado.</span>
                </div>
              ) : (
                <textarea
                  className="tf-md-textarea"
                  value={markdown}
                  onChange={(e) => setMarkdown(e.target.value)}
                  spellCheck={false}
                />
              )}
            </div>

            <div className="tf-md-pane">
              <div className="tf-md-pane-header">
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FileText size={14} className="text-sky-400" />
                  Preview LaTeX (.tex)
                </span>
                <button type="button" className="tf-btn-secondary" onClick={handleGenerate} disabled={busy}>
                  <Sparkles size={13} /> {busy ? '...' : t('md.generate')}
                </button>
              </div>
              <textarea
                className="tf-md-textarea"
                value={preview}
                onChange={(e) => setPreview(e.target.value)}
                placeholder="Clique em Gerar LaTeX para visualizar o código convertido..."
                spellCheck={false}
              />
            </div>
          </div>
        </div>

        <div className="tf-modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="tf-btn-secondary" onClick={handleInsert} disabled={busy}>
            {t('md.insertEditor')}
          </button>
          {hasProject && (
            <button type="button" className="tf-btn-primary" onClick={handleSave} disabled={busy}>
              {t('md.saveToProject')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
