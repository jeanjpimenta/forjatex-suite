import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Camera,
  Download,
  FileCode2,
  FilePlus,
  FileText,
  Folder,
  FolderPlus,
  GraduationCap,
  Pencil,
  Plus,
  Presentation,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import type { CustomTemplate, TemplateFileEntry } from '../types/ide';
import {
  createTemplateProject,
  deleteCustomTemplate,
  instantiateCustomTemplate,
  listCustomTemplates,
  pickProjectFolder,
  saveCustomTemplate,
  snapshotProjectAsTemplate,
} from '../utils/tauriBridge';

interface NewProjectModalProps {
  open: boolean;
  currentProjectDir: string | null;
  currentMainFile: string;
  onClose: () => void;
  onProjectCreated: (dir: string, preferredMainFile?: string) => Promise<void>;
}

const BUILTIN_TEMPLATES = [
  {
    id: 'article',
    title: 'Artigo Científico',
    desc: 'article + amsmath + booktabs + references.bib pronto para compilar.',
    icon: FileText,
  },
  {
    id: 'abnt-thesis',
    title: 'TCC / Dissertação em Capítulos',
    desc: 'main.tex + pasta chapters/ + references.bib para projetos longos.',
    icon: BookOpen,
  },
  {
    id: 'exam',
    title: 'Prova / Avaliação (exam)',
    desc: 'Classe exam com pontuação automática, questões e alternativas.',
    icon: GraduationCap,
  },
  {
    id: 'beamer',
    title: 'Apresentação Beamer',
    desc: 'Slides acadêmicos com tema Madrid e estrutura de frames.',
    icon: Presentation,
  },
];

function extractVariables(entries: TemplateFileEntry[]): string[] {
  const vars = new Set<string>();
  const regex = /\{\{([A-Za-z0-9_]+)\}\}/g;
  for (const e of entries) {
    let m: RegExpExecArray | null;
    while ((m = regex.exec(e.relative_path)) !== null) vars.add(m[1]);
    while ((m = regex.exec(e.content)) !== null) vars.add(m[1]);
  }
  return Array.from(vars);
}

export const NewProjectModal: React.FC<NewProjectModalProps> = ({
  open,
  currentProjectDir,
  currentMainFile,
  onClose,
  onProjectCreated,
}) => {
  const [tab, setTab] = useState<'use' | 'builder' | 'snapshot'>('use');
  const [customTemplates, setCustomTemplates] = useState<CustomTemplate[]>([]);
  const [selectedBuiltin, setSelectedBuiltin] = useState<string | null>('article');
  const [selectedCustomId, setSelectedCustomId] = useState<string | null>(null);
  const [varValues, setVarValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  // Builder state
  const [editId, setEditId] = useState<string | null>(null);
  const [tplName, setTplName] = useState('');
  const [tplDesc, setTplDesc] = useState('');
  const [tplMain, setTplMain] = useState('main.tex');
  const [entries, setEntries] = useState<TemplateFileEntry[]>([
    {
      relative_path: 'main.tex',
      is_dir: false,
      content:
        '\\documentclass[12pt,a4paper]{article}\n\\usepackage[utf8]{inputenc}\n\\title{{{TITULO}}}\n\\author{{{AUTOR}}}\n\\begin{document}\n\\maketitle\n\\end{document}\n',
    },
  ]);
  const [activeEntryIdx, setActiveEntryIdx] = useState(0);
  const [newEntryPath, setNewEntryPath] = useState('');

  // Snapshot state
  const [snapName, setSnapName] = useState('');
  const [snapDesc, setSnapDesc] = useState('');

  const loadTemplates = async () => {
    try {
      const list = await listCustomTemplates();
      setCustomTemplates(list);
    } catch {
      // ignore in browser preview
    }
  };

  useEffect(() => {
    if (open) {
      loadTemplates();
    }
  }, [open]);

  const selectedCustom = useMemo(
    () => customTemplates.find((t) => t.id === selectedCustomId) || null,
    [customTemplates, selectedCustomId]
  );

  const detectedVars = useMemo(
    () => (selectedCustom ? extractVariables(selectedCustom.entries) : []),
    [selectedCustom]
  );

  useEffect(() => {
    if (detectedVars.length === 0) return;
    setVarValues((prev) => {
      const next = { ...prev };
      for (const v of detectedVars) {
        if (!(v in next)) next[v] = '';
      }
      return next;
    });
  }, [detectedVars]);

  if (!open) return null;

  const handleInstantiate = async () => {
    const dir = await pickProjectFolder();
    if (!dir) return;
    setBusy(true);
    try {
      if (selectedCustom) {
        await instantiateCustomTemplate(dir, selectedCustom.entries, varValues);
        await onProjectCreated(dir, selectedCustom.main_file);
      } else if (selectedBuiltin) {
        await createTemplateProject(dir, selectedBuiltin);
        await onProjectCreated(dir, 'main.tex');
      }
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const handleSaveBuilder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tplName.trim() || entries.length === 0) return;
    const now = Math.floor(Date.now() / 1000);
    const slug = tplName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const tpl: CustomTemplate = {
      id: editId || `${slug || 'template'}-${now}`,
      name: tplName.trim(),
      description: tplDesc.trim() || 'Template personalizado do usuário',
      main_file: tplMain.trim() || 'main.tex',
      entries,
      created_at: now,
    };
    await saveCustomTemplate(tpl);
    await loadTemplates();
    setEditId(null);
    setSelectedBuiltin(null);
    setSelectedCustomId(tpl.id);
    setTab('use');
  };

  const handleSnapshot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProjectDir || !snapName.trim()) return;
    setBusy(true);
    try {
      const created = await snapshotProjectAsTemplate(
        currentProjectDir,
        snapName.trim(),
        snapDesc.trim() || 'Criado a partir de projeto existente',
        currentMainFile
      );
      await loadTemplates();
      setSnapName('');
      setSnapDesc('');
      setSelectedBuiltin(null);
      setSelectedCustomId(created.id);
      setTab('use');
    } finally {
      setBusy(false);
    }
  };

  const handleExportTemplate = (tpl: CustomTemplate, e: React.MouseEvent) => {
    e.stopPropagation();
    const blob = new Blob([JSON.stringify(tpl, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tpl.id}.forjatex-template.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportTemplate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as CustomTemplate;
      if (parsed.name && Array.isArray(parsed.entries)) {
        await saveCustomTemplate({
          ...parsed,
          id: `${parsed.id || 'imported'}-${Date.now()}`,
          created_at: Math.floor(Date.now() / 1000),
        });
        await loadTemplates();
      }
    } catch {
      alert('Arquivo de template inválido.');
    }
    e.target.value = '';
  };

  const activeEntry = entries[activeEntryIdx];

  return (
    <div className="tf-modal-backdrop" onClick={onClose}>
      <div className="tf-modal tf-modal-xl" onClick={(e) => e.stopPropagation()}>
        <div className="tf-modal-header">
          <div className="tf-modal-tabs">
            <button
              type="button"
              className={`tf-modal-tab ${tab === 'use' ? 'active' : ''}`}
              onClick={() => setTab('use')}
            >
              <FolderPlus size={14} /> Usar Template
            </button>
            <button
              type="button"
              className={`tf-modal-tab ${tab === 'builder' ? 'active' : ''}`}
              onClick={() => setTab('builder')}
            >
              <Plus size={14} /> Criar / Editar Template
            </button>
            {currentProjectDir && (
              <button
                type="button"
                className={`tf-modal-tab ${tab === 'snapshot' ? 'active' : ''}`}
                onClick={() => setTab('snapshot')}
              >
                <Camera size={14} /> Salvar Projeto Atual
              </button>
            )}
          </div>
          <button type="button" className="tf-icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="tf-modal-body">
          {tab === 'use' && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">Templates Oficiais</span>
                <label className="tf-link-btn cursor-pointer">
                  <Upload size={12} /> Importar (.json)
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    style={{ display: 'none' }}
                    onChange={handleImportTemplate}
                  />
                </label>
              </div>

              <div className="tf-template-grid">
                {BUILTIN_TEMPLATES.map((t) => {
                  const Icon = t.icon;
                  return (
                    <div
                      key={t.id}
                      className={`tf-template-card ${selectedBuiltin === t.id ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedBuiltin(t.id);
                        setSelectedCustomId(null);
                      }}
                    >
                      <Icon size={18} className="text-sky-400" />
                      <strong>{t.title}</strong>
                      <span>{t.desc}</span>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between mt-2">
                <span className="text-xs font-semibold text-amber-400">
                  Meus Templates Personalizados ({customTemplates.length})
                </span>
              </div>

              {customTemplates.length === 0 ? (
                <div className="tf-empty-custom-tpl">
                  Você ainda não criou templates próprios. Use a aba{' '}
                  <strong>Criar / Editar Template</strong> ou{' '}
                  <strong>Salvar Projeto Atual</strong>.
                </div>
              ) : (
                <div className="tf-template-grid">
                  {customTemplates.map((tpl) => (
                    <div
                      key={tpl.id}
                      className={`tf-template-card ${selectedCustomId === tpl.id ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedCustomId(tpl.id);
                        setSelectedBuiltin(null);
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <strong>{tpl.name}</strong>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            className="tf-icon-btn"
                            title="Editar template"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditId(tpl.id);
                              setTplName(tpl.name);
                              setTplDesc(tpl.description);
                              setTplMain(tpl.main_file);
                              setEntries(tpl.entries);
                              setActiveEntryIdx(0);
                              setTab('builder');
                            }}
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            type="button"
                            className="tf-icon-btn"
                            title="Exportar JSON"
                            onClick={(e) => handleExportTemplate(tpl, e)}
                          >
                            <Download size={12} />
                          </button>
                          <button
                            type="button"
                            className="tf-icon-btn"
                            title="Excluir template"
                            onClick={async (e) => {
                              e.stopPropagation();
                              await deleteCustomTemplate(tpl.id);
                              if (selectedCustomId === tpl.id) setSelectedCustomId(null);
                              await loadTemplates();
                            }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                      <span>{tpl.description}</span>
                      <span className="text-[10px] text-slate-500">
                        {tpl.entries.length} item(ns) · Principal: {tpl.main_file}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {selectedCustom && detectedVars.length > 0 && (
                <div className="tf-vars-box">
                  <strong className="text-xs text-sky-400">
                    Variáveis detectadas neste template:
                  </strong>
                  <div className="tf-vars-grid">
                    {detectedVars.map((v) => (
                      <label key={v}>
                        <span>{`{{${v}}}`}</span>
                        <input
                          type="text"
                          placeholder={`Valor para ${v}...`}
                          value={varValues[v] ?? ''}
                          onChange={(e) =>
                            setVarValues((prev) => ({ ...prev, [v]: e.target.value }))
                          }
                        />
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {tab === 'builder' && (
            <form onSubmit={handleSaveBuilder} className="tf-builder-form">
              <div className="tf-form-grid">
                <label>
                  <span>Nome do Template</span>
                  <input
                    required
                    type="text"
                    placeholder="Ex: Prova Padrão Cálculo I"
                    value={tplName}
                    onChange={(e) => setTplName(e.target.value)}
                  />
                </label>
                <label>
                  <span>Arquivo Principal</span>
                  <input
                    type="text"
                    placeholder="main.tex"
                    value={tplMain}
                    onChange={(e) => setTplMain(e.target.value)}
                  />
                </label>
              </div>

              <label className="tf-full-label">
                <span>Descrição</span>
                <input
                  type="text"
                  placeholder="Breve descrição do modelo..."
                  value={tplDesc}
                  onChange={(e) => setTplDesc(e.target.value)}
                />
              </label>

              <div className="tf-builder-split">
                <div className="tf-builder-tree">
                  <div className="tf-builder-add-row">
                    <input
                      type="text"
                      placeholder="ex: chapters/cap1.tex"
                      value={newEntryPath}
                      onChange={(e) => setNewEntryPath(e.target.value)}
                    />
                    <button
                      type="button"
                      className="tf-icon-btn"
                      title="Adicionar Arquivo"
                      onClick={() => {
                        const p = newEntryPath.trim().replace(/\\/g, '/');
                        if (!p) return;
                        setEntries((prev) => [
                          ...prev,
                          { relative_path: p, is_dir: false, content: '% Novo arquivo\n' },
                        ]);
                        setActiveEntryIdx(entries.length);
                        setNewEntryPath('');
                      }}
                    >
                      <FilePlus size={14} />
                    </button>
                    <button
                      type="button"
                      className="tf-icon-btn"
                      title="Adicionar Pasta"
                      onClick={() => {
                        const p = newEntryPath.trim().replace(/\\/g, '/');
                        if (!p) return;
                        setEntries((prev) => [
                          ...prev,
                          { relative_path: p, is_dir: true, content: '' },
                        ]);
                        setNewEntryPath('');
                      }}
                    >
                      <FolderPlus size={14} />
                    </button>
                  </div>

                  <div className="tf-builder-list">
                    {entries.map((ent, idx) => (
                      <div
                        key={`${ent.relative_path}-${idx}`}
                        className={`tf-tree-row ${idx === activeEntryIdx ? 'tf-tree-active' : ''}`}
                        style={{ paddingLeft: '8px' }}
                        onClick={() => setActiveEntryIdx(idx)}
                      >
                        {ent.is_dir ? (
                          <Folder size={13} className="text-amber-400 shrink-0" />
                        ) : (
                          <FileCode2 size={13} className="text-sky-400 shrink-0" />
                        )}
                        <span className="tf-tree-name">{ent.relative_path}</span>
                        {entries.length > 1 && (
                          <button
                            type="button"
                            className="tf-icon-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEntries((prev) => prev.filter((_, i) => i !== idx));
                              setActiveEntryIdx(0);
                            }}
                          >
                            <Trash2 size={11} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="tf-builder-editor">
                  {activeEntry && !activeEntry.is_dir ? (
                    <>
                      <div className="text-[11px] text-slate-400 mb-1">
                        Editando <code>{activeEntry.relative_path}</code> — Dica: use{' '}
                        <code>{'{{TITULO}}'}</code>, <code>{'{{AUTOR}}'}</code> como variáveis.
                      </div>
                      <textarea
                        rows={11}
                        value={activeEntry.content}
                        onChange={(e) => {
                          const val = e.target.value;
                          setEntries((prev) =>
                            prev.map((item, i) =>
                              i === activeEntryIdx ? { ...item, content: val } : item
                            )
                          );
                        }}
                      />
                    </>
                  ) : (
                    <div className="text-xs text-slate-500 p-4">
                      Pasta vazia selecionada. Selecione um arquivo para editar seu conteúdo base.
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end mt-2">
                <button type="submit" className="tf-btn-primary">
                  Salvar Template na Biblioteca
                </button>
              </div>
            </form>
          )}

          {tab === 'snapshot' && (
            <form onSubmit={handleSnapshot} className="tf-feedback-form">
              <p className="tf-section-desc">
                Salva toda a estrutura de pastas e arquivos de <code>{currentProjectDir}</code> como
                um template reutilizável (ignorando <code>.aux</code>, <code>.log</code>,{' '}
                <code>.pdf</code> e <code>build/</code>).
              </p>
              <label className="tf-full-label">
                <span>Nome do Template</span>
                <input
                  required
                  type="text"
                  placeholder="Ex: Meu Modelo TCC UFABC"
                  value={snapName}
                  onChange={(e) => setSnapName(e.target.value)}
                />
              </label>
              <label className="tf-full-label">
                <span>Descrição</span>
                <input
                  type="text"
                  placeholder="O que este modelo inclui..."
                  value={snapDesc}
                  onChange={(e) => setSnapDesc(e.target.value)}
                />
              </label>
              <button type="submit" className="tf-btn-primary" disabled={busy}>
                <Camera size={14} />{' '}
                {busy ? 'Salvando...' : 'Salvar Projeto Atual como Template'}
              </button>
            </form>
          )}
        </div>

        {tab === 'use' && (
          <div className="tf-modal-footer">
            <button
              type="button"
              className="tf-btn-primary"
              disabled={busy || (!selectedBuiltin && !selectedCustom)}
              onClick={handleInstantiate}
            >
              {busy ? 'Criando...' : 'Escolher Pasta e Criar Projeto'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
