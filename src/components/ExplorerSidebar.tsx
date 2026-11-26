import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  FileCode2,
  FileImage,
  FilePlus,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  RefreshCw,
  Star,
  Eye,
  EyeOff,
  ListTree,
  Bookmark,
  Hash,
  GitBranch,
  ArrowUp,
  ArrowDown,
  Check,
} from 'lucide-react';
import type { FileNode, OutlineItem } from '../types/ide';
import {
  gitCommitAll,
  gitCreateLatexGitignore,
  gitInit,
  gitPull,
  gitPush,
  gitSetRemote,
  gitStatus,
  type GitStatusInfo,
} from '../utils/tauriBridge';
import { useI18n } from '../i18n';

interface ExplorerSidebarProps {
  projectDir: string | null;
  tree: FileNode[];
  outline: OutlineItem[];
  mainFile: string;
  activeFilePath: string | null;
  highlightedFile: string | null;
  onOpenFolder: () => void;
  onNewTemplateProject: () => void;
  onRefresh: () => void;
  onSelectFile: (node: FileNode) => void;
  onJumpToOutline: (fileRel: string, line: number) => void;
  onSetMainFile: (relativePath: string) => void;
  onCreateEntry: (parentDir: string, name: string, isDir: boolean) => Promise<void>;
  onOpenGitSettings: () => void;
  activeTab?: 'files' | 'structure' | 'git';
  onTabChange?: (tab: 'files' | 'structure' | 'git') => void;
}

function getFileIcon(ext: string) {
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) {
    return <FileImage size={14} className="text-emerald-400 shrink-0" />;
  }
  if (['tex', 'cls', 'sty', 'ltx'].includes(ext)) {
    return <FileCode2 size={14} className="text-sky-400 shrink-0" />;
  }
  if (['bib', 'html', 'xml', 'json', 'md'].includes(ext)) {
    return <FileCode2 size={14} className="text-amber-400 shrink-0" />;
  }
  return <FileText size={14} className="text-slate-400 shrink-0" />;
}

export const ExplorerSidebar: React.FC<ExplorerSidebarProps> = ({
  projectDir,
  tree,
  outline,
  mainFile,
  activeFilePath,
  highlightedFile,
  onOpenFolder,
  onNewTemplateProject,
  onRefresh,
  onSelectFile,
  onJumpToOutline,
  onSetMainFile,
  onCreateEntry,
  onOpenGitSettings,
  activeTab: controlledTab,
  onTabChange,
}) => {
  const [internalTab, setInternalTab] = useState<'files' | 'structure' | 'git'>('files');
  const sidebarTab = controlledTab ?? internalTab;
  const setSidebarTab = (tab: 'files' | 'structure' | 'git') => {
    setInternalTab(tab);
    onTabChange?.(tab);
  };
  const [gitInfo, setGitInfo] = useState<GitStatusInfo | null>(null);
  const [gitBusy, setGitBusy] = useState(false);
  const [gitMsg, setGitMsg] = useState('');
  const [commitMessage, setCommitMessage] = useState('');
  const [remoteInput, setRemoteInput] = useState('');
  const { t } = useI18n();
  const [expandedDirs, setExpandedDirs] = useState<Record<string, boolean>>({});
  const [showAux, setShowAux] = useState(false);
  const [creating, setCreating] = useState<{ isDir: boolean } | null>(null);
  const [newName, setNewName] = useState('');
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    relativePath: string;
    name: string;
  } | null>(null);
  const highlightRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (sidebarTab === 'git' && projectDir) {
      refreshGit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sidebarTab, projectDir]);

  const refreshGit = async () => {
    if (!projectDir) return;
    setGitBusy(true);
    try {
      const info = await gitStatus(projectDir);
      setGitInfo(info);
      setRemoteInput(info.remote_url);
      setGitMsg('');
    } catch (e) {
      setGitMsg(String(e));
    } finally {
      setGitBusy(false);
    }
  };

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    window.addEventListener('contextmenu', close);
    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('contextmenu', close);
    };
  }, [contextMenu]);

  // Auto-expand parent folders and scroll into view when SyncTeX single-click highlights a file
  useEffect(() => {
    if (!highlightedFile) return;
    const parts = highlightedFile.split('/');
    if (parts.length > 1) {
      setExpandedDirs((prev) => {
        const next = { ...prev };
        let acc = '';
        for (let i = 0; i < parts.length - 1; i++) {
          acc = acc ? `${acc}/${parts[i]}` : parts[i];
          next[acc] = true;
        }
        return next;
      });
    }
    setTimeout(() => {
      highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 60);
  }, [highlightedFile]);

  const toggleDir = (relPath: string) => {
    setExpandedDirs((prev) => ({ ...prev, [relPath]: !prev[relPath] }));
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creating || !projectDir || !newName.trim()) return;
    await onCreateEntry(projectDir, newName.trim(), creating.isDir);
    setNewName('');
    setCreating(null);
  };

  const renderNodes = (nodes: FileNode[], depth = 0): React.ReactNode => {
    return nodes
      .filter((n) => showAux || !n.is_aux)
      .map((node) => {
        const isExpanded = expandedDirs[node.relative_path] ?? depth === 0;
        const isMain = !node.is_dir && node.relative_path === mainFile;
        const isActive = !node.is_dir && node.path === activeFilePath;
        const isHighlighted =
          !node.is_dir &&
          highlightedFile !== null &&
          (node.relative_path === highlightedFile || node.path === highlightedFile);

        if (node.is_dir) {
          return (
            <div key={node.path}>
              <div
                className="tf-tree-row"
                style={{ paddingLeft: `${8 + depth * 14}px` }}
                onClick={() => toggleDir(node.relative_path)}
              >
                {isExpanded ? (
                  <ChevronDown size={14} className="text-slate-400 shrink-0" />
                ) : (
                  <ChevronRight size={14} className="text-slate-400 shrink-0" />
                )}
                {isExpanded ? (
                  <FolderOpen size={14} className="text-amber-400 shrink-0" />
                ) : (
                  <Folder size={14} className="text-amber-400 shrink-0" />
                )}
                <span className="tf-tree-name">{node.name}</span>
              </div>
              {isExpanded && node.children && <div>{renderNodes(node.children, depth + 1)}</div>}
            </div>
          );
        }

        return (
          <div
            key={node.path}
            ref={isHighlighted ? highlightRef : undefined}
            className={`tf-tree-row group ${isActive ? 'tf-tree-active' : ''} ${isHighlighted ? 'tf-tree-synctex-highlight' : ''
              }`}
            style={{ paddingLeft: `${22 + depth * 14}px` }}
            onClick={() => onSelectFile(node)}
            onContextMenu={(e) => {
              if (node.extension !== 'tex') return;
              e.preventDefault();
              e.stopPropagation();
              setContextMenu({
                x: e.clientX,
                y: e.clientY,
                relativePath: node.relative_path,
                name: node.name,
              });
            }}
            title={
              node.extension === 'tex'
                ? `${node.relative_path} (botão direito para definir como principal)`
                : node.relative_path
            }
          >
            {getFileIcon(node.extension)}
            <span className="tf-tree-name">{node.name}</span>

            {isHighlighted && (
              <span className="tf-synctex-pill" title="Localizado no PDF (clique simples)">
                SyncTeX
              </span>
            )}

            {isMain && (
              <span className="tf-main-star is-main" title="Arquivo principal de compilação">
                <Star size={12} fill="currentColor" />
              </span>
            )}
          </div>
        );
      });
  };

  return (
    <aside className="tf-sidebar">
      <div className="tf-panel-header">
        <div className="tf-sidebar-tabs">
          <button
            type="button"
            className={`tf-sidebar-tab ${sidebarTab === 'files' ? 'active' : ''}`}
            onClick={() => setSidebarTab('files')}
          >
            {t('sidebar.explorer')}
          </button>
          <button
            type="button"
            className={`tf-sidebar-tab ${sidebarTab === 'structure' ? 'active' : ''}`}
            onClick={() => setSidebarTab('structure')}
            title="Estrutura do documento (\section, \chapter, \label)"
          >
            <ListTree size={12} /> {t('sidebar.structure')}
          </button>
          <button
            type="button"
            className={`tf-sidebar-tab ${sidebarTab === 'git' ? 'active' : ''}`}
            onClick={() => setSidebarTab('git')}
            title="Controle de Versão Git (Offline e GitHub)"
          >
            <GitBranch size={12} /> {t('sidebar.git')}
          </button>
        </div>
        <div className="tf-panel-actions">
          {projectDir && (
            <>
              <button
                type="button"
                className="tf-icon-btn"
                title="Novo arquivo"
                onClick={() => setCreating({ isDir: false })}
              >
                <FilePlus size={14} />
              </button>
              <button
                type="button"
                className="tf-icon-btn"
                title="Nova pasta"
                onClick={() => setCreating({ isDir: true })}
              >
                <FolderPlus size={14} />
              </button>
              <button
                type="button"
                className="tf-icon-btn"
                title={showAux ? 'Ocultar arquivos auxiliares (.aux, .log)' : 'Mostrar arquivos auxiliares'}
                onClick={() => setShowAux((v) => !v)}
              >
                {showAux ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
              <button type="button" className="tf-icon-btn" title="Atualizar árvore" onClick={onRefresh}>
                <RefreshCw size={14} />
              </button>
            </>
          )}
        </div>
      </div>

      {!projectDir ? (
        <div className="tf-empty-explorer">
          <p>Nenhuma pasta aberta.</p>
          <button type="button" className="tf-btn-primary" onClick={onOpenFolder}>
            Abrir Pasta do Projeto
          </button>
          <button type="button" className="tf-btn-secondary" onClick={onNewTemplateProject}>
            Novo Projeto (Template)
          </button>
        </div>
      ) : sidebarTab === 'git' ? (
        <div className="tf-git-pane">
          <div className="tf-git-header-row">
            <span className="flex items-center gap-1.5 text-xs font-semibold">
              <GitBranch size={13} className="text-sky-400" />
              {gitInfo?.is_repo ? `Branch: ${gitInfo.branch}` : 'Git'}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="tf-link-btn"
                onClick={onOpenGitSettings}
                title="Abrir Configurações de Git"
              >
                Configurar Git
              </button>
              <button
                type="button"
                className="tf-icon-btn"
                onClick={refreshGit}
                disabled={gitBusy}
                title="Atualizar status Git"
              >
                <RefreshCw size={12} />
              </button>
            </div>
          </div>

          {gitInfo && (
            <div className="tf-git-status-pill">
              {!gitInfo.git_installed ? (
                <span className="text-rose-400">Git não instalado no sistema</span>
              ) : gitInfo.user_name && gitInfo.user_email ? (
                <span className="text-emerald-400">
                  Conectado: {gitInfo.user_name} ({gitInfo.remote_url ? 'com remoto' : 'offline'})
                </span>
              ) : (
                <button type="button" className="tf-link-btn text-amber-400" onClick={onOpenGitSettings}>
                  Git não configurado — clique para configurar autor/e-mail
                </button>
              )}
            </div>
          )}

          {gitMsg && <div className="tf-git-feedback">{gitMsg}</div>}

          {!gitInfo ? (
            <div className="tf-empty-explorer">Carregando status Git...</div>
          ) : !gitInfo.git_installed ? (
            <div className="tf-empty-explorer">
              <p>Git não encontrado no PATH do sistema. Instale o Git para habilitar o versionamento.</p>
            </div>
          ) : !gitInfo.is_repo ? (
            <div className="tf-empty-explorer">
              <p>Este projeto ainda não possui um repositório Git.</p>
              <button
                type="button"
                className="tf-btn-primary"
                disabled={gitBusy}
                onClick={async () => {
                  if (!projectDir) return;
                  setGitBusy(true);
                  try {
                    const res = await gitInit(projectDir);
                    await refreshGit();
                    setGitMsg(res);
                  } catch (e) {
                    setGitMsg(String(e));
                  } finally {
                    setGitBusy(false);
                  }
                }}
              >
                Inicializar Repositório Git
              </button>
            </div>
          ) : (
            <div className="tf-git-body">
              <div className="tf-git-section">
                <span className="tf-git-label">Commit Rápido ({gitInfo.changes.length} alterações)</span>
                <input
                  type="text"
                  className="tf-git-input"
                  placeholder="Mensagem do commit..."
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                />
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    className="tf-btn-primary flex-1 justify-center"
                    disabled={gitBusy || !commitMessage.trim()}
                    onClick={async () => {
                      if (!projectDir) return;
                      setGitBusy(true);
                      try {
                        const res = await gitCommitAll(projectDir, commitMessage);
                        setCommitMessage('');
                        await refreshGit();
                        setGitMsg(res || 'Commit criado.');
                      } catch (e) {
                        setGitMsg(String(e));
                      } finally {
                        setGitBusy(false);
                      }
                    }}
                  >
                    <Check size={12} /> Commit
                  </button>
                  <button
                    type="button"
                    className="tf-btn-small"
                    disabled={gitBusy || !gitInfo.remote_url}
                    title="Git Pull"
                    onClick={async () => {
                      if (!projectDir) return;
                      setGitBusy(true);
                      try {
                        const res = await gitPull(projectDir);
                        await refreshGit();
                        onRefresh();
                        setGitMsg(res || 'Pull concluído.');
                      } catch (e) {
                        setGitMsg(String(e));
                      } finally {
                        setGitBusy(false);
                      }
                    }}
                  >
                    <ArrowDown size={12} /> Pull
                  </button>
                  <button
                    type="button"
                    className="tf-btn-small"
                    disabled={gitBusy || !gitInfo.remote_url}
                    title="Git Push"
                    onClick={async () => {
                      if (!projectDir) return;
                      setGitBusy(true);
                      try {
                        const res = await gitPush(projectDir);
                        await refreshGit();
                        setGitMsg(res);
                      } catch (e) {
                        setGitMsg(String(e));
                      } finally {
                        setGitBusy(false);
                      }
                    }}
                  >
                    <ArrowUp size={12} /> Push
                  </button>
                </div>
              </div>

              <div className="tf-git-section">
                <span className="tf-git-label">Remoto (GitHub / GitLab)</span>
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    className="tf-git-input flex-1"
                    placeholder="https://github.com/usuario/repo.git"
                    value={remoteInput}
                    onChange={(e) => setRemoteInput(e.target.value)}
                  />
                  <button
                    type="button"
                    className="tf-btn-small"
                    disabled={gitBusy}
                    onClick={async () => {
                      if (!projectDir) return;
                      setGitBusy(true);
                      try {
                        const res = await gitSetRemote(projectDir, remoteInput);
                        await refreshGit();
                        setGitMsg(res);
                      } catch (e) {
                        setGitMsg(String(e));
                      } finally {
                        setGitBusy(false);
                      }
                    }}
                  >
                    Salvar
                  </button>
                </div>
                <button
                  type="button"
                  className="tf-btn-small"
                  disabled={gitBusy}
                  onClick={async () => {
                    if (!projectDir) return;
                    setGitBusy(true);
                    try {
                      const res = await gitCreateLatexGitignore(projectDir);
                      await refreshGit();
                      onRefresh();
                      setGitMsg(res);
                    } catch (e) {
                      setGitMsg(String(e));
                    } finally {
                      setGitBusy(false);
                    }
                  }}
                >
                  {t('git.createGitignore')}
                </button>
              </div>

              {gitInfo.changes.length > 0 && (
                <div className="tf-git-section">
                  <span className="tf-git-label">Arquivos Modificados</span>
                  <div className="tf-git-list">
                    {gitInfo.changes.map((ch) => (
                      <div key={ch.path} className="tf-git-change-row" title={ch.path}>
                        <span className="tf-git-badge">{ch.status || 'M'}</span>
                        <span className="truncate">{ch.path}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {gitInfo.commits.length > 0 && (
                <div className="tf-git-section">
                  <span className="tf-git-label">Histórico Recente</span>
                  <div className="tf-git-list">
                    {gitInfo.commits.map((c) => (
                      <div key={c.hash} className="tf-git-commit-row" title={`${c.author} · ${c.date}`}>
                        <span className="tf-git-hash">{c.hash}</span>
                        <span className="truncate">{c.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      ) : sidebarTab === 'structure' ? (
        <div className="tf-tree-scroll">
          {outline.length === 0 ? (
            <div className="tf-empty-explorer">
              <p>Nenhuma seção ou \label encontrada ainda.</p>
            </div>
          ) : (
            outline.map((item, idx) => (
              <div
                key={`${item.file}-${item.line}-${idx}`}
                className="tf-tree-row"
                style={{
                  paddingLeft:
                    item.kind === 'chapter' || item.kind === 'part'
                      ? '10px'
                      : item.kind === 'section'
                        ? '18px'
                        : '28px',
                }}
                onClick={() => onJumpToOutline(item.file, item.line)}
                title={`${item.file}:${item.line}`}
              >
                {item.kind === 'label' ? (
                  <Bookmark size={12} className="text-amber-400 shrink-0" />
                ) : (
                  <Hash size={12} className="text-sky-400 shrink-0" />
                )}
                <span className="tf-tree-name">{item.title}</span>
                <span className="text-[10px] text-slate-500">:{item.line}</span>
              </div>
            ))
          )}
        </div>
      ) : (
        <>
          <div className="tf-project-banner">
            <div className="tf-project-folder" title={projectDir}>
              {projectDir.split(/[\\/]/).pop() || projectDir}
            </div>
            <button type="button" className="tf-link-btn" onClick={onOpenFolder}>
              Trocar
            </button>
          </div>

          <div className="tf-main-indicator">
            <Star size={11} className="text-amber-400 shrink-0" fill="currentColor" />
            <span>
              Principal: <strong>{mainFile}</strong>
            </span>
          </div>

          {creating && (
            <form onSubmit={handleCreateSubmit} className="tf-new-entry-form">
              <input
                autoFocus
                type="text"
                placeholder={creating.isDir ? 'Nome da pasta...' : 'ex: capitulo2.tex'}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && setCreating(null)}
              />
            </form>
          )}

          <div className="tf-tree-scroll">{renderNodes(tree)}</div>

          {contextMenu && (
            <div
              className="tf-context-menu"
              style={{ top: contextMenu.y, left: contextMenu.x }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="tf-context-menu-item"
                disabled={contextMenu.relativePath === mainFile}
                onClick={() => {
                  onSetMainFile(contextMenu.relativePath);
                  setContextMenu(null);
                }}
              >
                <Star size={13} className="text-amber-400" fill="currentColor" />
                <span>
                  {contextMenu.relativePath === mainFile
                    ? `Principal atual (${contextMenu.name})`
                    : `Definir "${contextMenu.name}" como arquivo principal`}
                </span>
              </button>
            </div>
          )}
        </>
      )}
    </aside>
  );
};
