import React, { useEffect, useMemo, useState } from 'react';
import { Check, ImagePlus, X } from 'lucide-react';
import type { FileNode } from '../types/ide';
import { readProjectFile } from '../utils/tauriBridge';

interface ImageWizardModalProps {
  open: boolean;
  tree: FileNode[];
  onClose: () => void;
  onInsert: (code: string) => void;
}

function collectImages(nodes: FileNode[]): FileNode[] {
  const out: FileNode[] = [];
  for (const n of nodes) {
    if (!n.is_dir && ['png', 'jpg', 'jpeg', 'webp', 'svg', 'pdf'].includes(n.extension)) {
      out.push(n);
    } else if (n.is_dir && n.children) {
      out.push(...collectImages(n.children));
    }
  }
  return out;
}

export const ImageWizardModal: React.FC<ImageWizardModalProps> = ({
  open,
  tree,
  onClose,
  onInsert,
}) => {
  const images = useMemo(() => collectImages(tree), [tree]);
  const [selectedRel, setSelectedRel] = useState('');
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [width, setWidth] = useState('0.8\\textwidth');
  const [wrapFigure, setWrapFigure] = useState(true);
  const [centered, setCentered] = useState(true);
  const [caption, setCaption] = useState('Descrição da figura');
  const [label, setLabel] = useState('fig:figura1');

  useEffect(() => {
    if (open && images.length > 0 && !selectedRel) {
      setSelectedRel(images[0].relative_path);
    }
  }, [open, images, selectedRel]);

  useEffect(() => {
    const node = images.find((i) => i.relative_path === selectedRel);
    if (!node || node.extension === 'pdf') {
      setPreviewSrc(null);
      return;
    }
    readProjectFile(node.path)
      .then((res) => {
        if (res.is_binary && res.mime_type.startsWith('image/')) {
          setPreviewSrc(`data:${res.mime_type};base64,${res.content}`);
        } else {
          setPreviewSrc(null);
        }
      })
      .catch(() => setPreviewSrc(null));
  }, [selectedRel, images]);

  if (!open) return null;

  const imgPath = selectedRel || 'imagem.png';
  const includeLine = `\\includegraphics${width ? `[width=${width}]` : ''}{${imgPath}}`;

  const generated = wrapFigure
    ? [
        `\\begin{figure}[htbp]`,
        centered ? `  \\centering` : null,
        `  ${includeLine}`,
        caption ? `  \\caption{${caption}}` : null,
        label ? `  \\label{${label}}` : null,
        `\\end{figure}`,
      ]
        .filter(Boolean)
        .join('\n')
    : includeLine;

  return (
    <div className="tf-modal-backdrop" onClick={onClose}>
      <div className="tf-modal tf-modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="tf-modal-header">
          <h2 className="flex items-center gap-2">
            <ImagePlus size={16} className="text-emerald-400" /> Assistente Visual de Imagem
          </h2>
          <button type="button" className="tf-icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="tf-modal-body">
          <div className="tf-img-wizard-split">
            <div className="tf-img-list">
              <div className="text-xs font-semibold text-slate-300 mb-1">
                Imagens do Projeto ({images.length})
              </div>
              {images.length === 0 ? (
                <div className="text-xs text-slate-500 p-2">
                  Nenhuma imagem encontrada na pasta do projeto.
                </div>
              ) : (
                images.map((img) => (
                  <button
                    key={img.path}
                    type="button"
                    className={`tf-img-item ${selectedRel === img.relative_path ? 'active' : ''}`}
                    onClick={() => setSelectedRel(img.relative_path)}
                  >
                    {img.relative_path}
                  </button>
                ))
              )}
            </div>

            <div className="tf-img-preview-box">
              {previewSrc ? (
                <img src={previewSrc} alt={selectedRel} className="tf-img-thumb" />
              ) : (
                <span className="text-xs text-slate-500">Sem preview visual</span>
              )}
            </div>
          </div>

          <div className="tf-form-grid">
            <label>
              <span>Caminho da Imagem</span>
              <input
                type="text"
                value={selectedRel}
                onChange={(e) => setSelectedRel(e.target.value)}
                placeholder="ex: figuras/grafico.png"
              />
            </label>
            <label>
              <span>Largura</span>
              <input
                type="text"
                value={width}
                onChange={(e) => setWidth(e.target.value)}
                placeholder="0.8\textwidth ou 10cm"
              />
            </label>
          </div>

          <div className="flex gap-4">
            <label className="tf-checkbox-inline">
              <input
                type="checkbox"
                checked={wrapFigure}
                onChange={(e) => setWrapFigure(e.target.checked)}
              />
              <span>Ambiente figure (com legenda)</span>
            </label>
            <label className="tf-checkbox-inline">
              <input
                type="checkbox"
                checked={centered}
                onChange={(e) => setCentered(e.target.checked)}
              />
              <span>Centralizar (\centering)</span>
            </label>
          </div>

          {wrapFigure && (
            <div className="tf-form-grid">
              <label>
                <span>Legenda (\caption)</span>
                <input type="text" value={caption} onChange={(e) => setCaption(e.target.value)} />
              </label>
              <label>
                <span>Rótulo (\label)</span>
                <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} />
              </label>
            </div>
          )}

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
            <Check size={14} /> Inserir Imagem no Editor
          </button>
        </div>
      </div>
    </div>
  );
};

