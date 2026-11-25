import React, { useState } from 'react';
import { Play, Plus, Terminal, Trash2, Tag, X } from 'lucide-react';
import type { UserTag } from '../types/ide';

interface UserTagsScriptsModalProps {
  open: boolean;
  userTags: UserTag[];
  activeContent: string;
  onClose: () => void;
  onChangeTags: (next: UserTag[]) => void;
  onApplyTransformedText: (nextText: string) => void;
  onInsertSnippet: (snippet: string) => void;
}

export const UserTagsScriptsModal: React.FC<UserTagsScriptsModalProps> = ({
  open,
  userTags,
  activeContent,
  onClose,
  onChangeTags,
  onApplyTransformedText,
  onInsertSnippet,
}) => {
  const [tab, setTab] = useState<'tags' | 'scripts'>('tags');
  const [trigger, setTrigger] = useState(':teorema');
  const [label, setLabel] = useState('Bloco de Teorema');
  const [snippet, setSnippet] = useState('\\begin{theorem}\n  $1\n\\end{theorem}');
  const [customJs, setCustomJs] = useState(
    '// Recebe `text` e deve retornar a string transformada\nreturn text.replace(/[ \\t]+$/gm, "");'
  );
  const [scriptError, setScriptError] = useState<string | null>(null);

  if (!open) return null;

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trigger.trim() || !snippet.trim()) return;
    const normTrigger = trigger.trim().startsWith(':') ? trigger.trim() : `:${trigger.trim()}`;
    const next: UserTag = {
      id: `tag-${Date.now()}`,
      trigger: normTrigger,
      label: label.trim() || normTrigger,
      snippet,
    };
    onChangeTags([next, ...userTags.filter((t) => t.trigger !== normTrigger)]);
    setTrigger(':');
    setLabel('');
    setSnippet('');
  };

  const runWordWrap80 = () => {
    const wrapped = activeContent
      .split('\n')
      .map((line) => {
        if (line.length <= 80 || line.trim().startsWith('%') || line.trim().startsWith('\\')) {
          return line;
        }
        const words = line.split(' ');
        const lines: string[] = [];
        let cur = '';
        for (const w of words) {
          if ((cur + ' ' + w).trim().length > 80) {
            if (cur) lines.push(cur);
            cur = w;
          } else {
            cur = cur ? `${cur} ${w}` : w;
          }
        }
        if (cur) lines.push(cur);
        return lines.join('\n');
      })
      .join('\n');
    onApplyTransformedText(wrapped);
    onClose();
  };

  const runRemoveExtraBlankLines = () => {
    onApplyTransformedText(activeContent.replace(/\n{3,}/g, '\n\n'));
    onClose();
  };

  const runCustomJs = () => {
    setScriptError(null);
    try {
      const fn = new Function('text', customJs);
      const result = fn(activeContent);
      if (typeof result !== 'string') {
        throw new Error('O script precisa retornar uma string.');
      }
      onApplyTransformedText(result);
      onClose();
    } catch (err) {
      setScriptError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="tf-modal-backdrop" onClick={onClose}>
      <div className="tf-modal tf-modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="tf-modal-header">
          <div className="tf-modal-tabs">
            <button
              type="button"
              className={`tf-modal-tab ${tab === 'tags' ? 'active' : ''}`}
              onClick={() => setTab('tags')}
            >
              <Tag size={14} /> User Tags (:gatilho)
            </button>
            <button
              type="button"
              className={`tf-modal-tab ${tab === 'scripts' ? 'active' : ''}`}
              onClick={() => setTab('scripts')}
            >
              <Terminal size={14} /> Scripts de Automação
            </button>
          </div>
          <button type="button" className="tf-icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="tf-modal-body">
          {tab === 'tags' ? (
            <>
              <p className="tf-section-desc">
                Crie seus próprios gatilhos. Ao digitar <code>:nome</code> no editor LaTeX, o
                autocompletar sugere o bloco automaticamente.
              </p>

              <form onSubmit={handleAddTag} className="tf-builder-form">
                <div className="tf-form-grid">
                  <label>
                    <span>Gatilho (ex: :teorema)</span>
                    <input
                      required
                      type="text"
                      value={trigger}
                      onChange={(e) => setTrigger(e.target.value)}
                    />
                  </label>
                  <label>
                    <span>Descrição</span>
                    <input
                      type="text"
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                    />
                  </label>
                </div>
                <label className="tf-full-label">
                  <span>Conteúdo LaTeX (use $1, $2 para posição do cursor)</span>
                  <textarea
                    rows={3}
                    required
                    className="tf-mono-textarea"
                    value={snippet}
                    onChange={(e) => setSnippet(e.target.value)}
                  />
                </label>
                <div className="flex justify-end">
                  <button type="submit" className="tf-btn-primary">
                    <Plus size={13} /> Salvar Tag
                  </button>
                </div>
              </form>

              <div className="tf-detected-list">
                {userTags.length === 0 ? (
                  <div className="text-xs text-slate-500">Nenhuma tag cadastrada.</div>
                ) : (
                  userTags.map((t) => (
                    <div key={t.id} className="tf-detected-item justify-between">
                      <button
                        type="button"
                        className="tf-link-btn"
                        onClick={() => {
                          onInsertSnippet(t.snippet.replace(/\$\d+/g, ''));
                          onClose();
                        }}
                      >
                        <code>{t.trigger}</code> — {t.label}
                      </button>
                      <button
                        type="button"
                        className="tf-icon-btn"
                        onClick={() => onChangeTags(userTags.filter((x) => x.id !== t.id))}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <>
              <p className="tf-section-desc">
                Execute transformações rápidas sobre o arquivo ativo no editor.
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="tf-btn-secondary" onClick={runWordWrap80}>
                  <Play size={12} /> Quebrar linhas em 80 colunas
                </button>
                <button type="button" className="tf-btn-secondary" onClick={runRemoveExtraBlankLines}>
                  <Play size={12} /> Remover linhas em branco extras
                </button>
              </div>

              <label className="tf-full-label mt-2">
                <span>Script JS Personalizado (recebe variável <code>text</code>)</span>
                <textarea
                  rows={5}
                  className="tf-mono-textarea"
                  value={customJs}
                  onChange={(e) => setCustomJs(e.target.value)}
                />
              </label>
              {scriptError && <div className="text-xs text-rose-400">{scriptError}</div>}
              <div className="flex justify-end">
                <button type="button" className="tf-btn-primary" onClick={runCustomJs}>
                  <Play size={13} /> Executar Script no Arquivo Ativo
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

