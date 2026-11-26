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

  const handleGenerate = async () => {
    setBusy(true);
    setError('');
    try {
      const latex = await convertMarkdownToLatex({
        filePath: filePath ?? undefined,
        markdown: filePath ? undefined : markdown,
        template,
        title,
        author,
        institution,
        convertCitations,
      });
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
        out = await convertMarkdownToLatex({
          filePath: filePath ?? undefined,
          markdown: filePath ? undefined : markdown,
          template,
          title,
          author,
          institution,
          convertCitations,
        });
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
        out = await convertMarkdownToLatex({
          filePath: filePath ?? undefined,
          markdown: filePath ? undefined : markdown,
          template,
          title,
          author,
          institution,
          convertCitations,
        });
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
      <div
        className="tf-modal tf-modal-wide"
        style={{ maxWidth: '880px', width: '94vw' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="tf-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FileCode2 size={18} className="text-sky-400" />
            <h3>{t('md.title')}</h3>
          </div>
          <button type="button" className="tf-icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="tf-modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {/* Left: Source & Options */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button type="button" className="tf-btn-secondary" onClick={handlePick}>
                <FolderOpen size={14} /> {t('md.pickFile')}
              </button>
              {filePath && (
                <button
                  type="button"
                  className="tf-btn-ghost"
                  onClick={() => setFilePath(null)}
                  title="Limpar arquivo selecionado"
                >
                  × {filePath.split(/[\\/]/).pop()}
                </button>
              )}
            </div>

            {!filePath && (
              <label className="tf-field">
                <span>{t('md.orPaste')}</span>
                <textarea
                  rows={8}
                  value={markdown}
                  onChange={(e) => setMarkdown(e.target.value)}
                  style={{ fontFamily: 'monospace', fontSize: 12 }}
                />
              </label>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <label className="tf-field">
                <span>{t('md.template')}</span>
                <select value={template} onChange={(e) => setTemplate(e.target.value as typeof template)}>
                  <option value="abnt">ABNT (TCC / Monografia)</option>
                  <option value="article">Article (Artigo Científico)</option>
                  <option value="beamer">Beamer (Apresentação)</option>
                  <option value="snippet">Snippet (Apenas corpo)</option>
                </select>
              </label>

              <label className="tf-field">
                <span>{t('md.docTitle')}</span>
                <input value={title} onChange={(e) => setTitle(e.target.value)} />
              </label>

              <label className="tf-field">
                <span>{t('md.author')}</span>
                <input value={author} onChange={(e) => setAuthor(e.target.value)} />
              </label>

              <label className="tf-field">
                <span>{t('md.institution')}</span>
                <input value={institution} onChange={(e) => setInstitution(e.target.value)} />
              </label>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={convertCitations}
                onChange={(e) => setConvertCitations(e.target.checked)}
              />
              <span>{t('md.citations')}</span>
            </label>

            {error && (
              <div style={{ color: '#f87171', fontSize: 12, padding: '6px 8px', background: 'rgba(239,68,68,0.1)', borderRadius: 6 }}>
                {error}
              </div>
            )}
          </div>

          {/* Right: Preview */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 600, opacity: 0.85 }}>
                <FileText size={13} style={{ display: 'inline', marginRight: 4 }} />
                Preview LaTeX (.tex)
              </span>
              <button type="button" className="tf-btn-secondary" onClick={handleGenerate} disabled={busy}>
                <Sparkles size={13} /> {busy ? '...' : t('md.generate')}
              </button>
            </div>

            <textarea
              rows={14}
              value={preview}
              onChange={(e) => setPreview(e.target.value)}
              placeholder="Clique em Gerar LaTeX para visualizar o código convertido..."
              style={{ fontFamily: 'monospace', fontSize: 12, flex: 1 }}
            />

            {hasProject && (
              <label className="tf-field">
                <span>Nome do arquivo no projeto</span>
                <input value={fileName} onChange={(e) => setFileName(e.target.value)} />
              </label>
            )}
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

