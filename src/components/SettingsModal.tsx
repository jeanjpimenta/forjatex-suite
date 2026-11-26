import React, { useEffect, useState } from 'react';
import {
  RefreshCw,
  X,
  CheckCircle2,
  AlertCircle,
  FolderOpen,
  Play,
  Cpu,
  Sliders,
  Sparkles,
  Plus,
  Trash2,
  GitBranch,
} from 'lucide-react';
import type {
  AISettings,
  AIProvider,
  CompilerDistribution,
  CompilerEngine,
  CompilerInfo,
  CompilerSettings,
  CompilerTestResult,
  KeyShortcuts,
  QuickBuildProfile,
} from '../types/ide';
import {
  gitClone,
  gitCreateLatexGitignore,
  gitSaveCredential,
  gitSetRemote,
  gitSetUserConfig,
  gitStatus,
  pickProjectFolder,
  testCompiler,
  openManualPdf,
} from '../utils/tauriBridge';
import { AVAILABLE_LOCALES, useI18n, type LocaleCode } from '../i18n';

interface SettingsModalProps {
  open: boolean;
  initialTab?: 'compiler' | 'editor' | 'ai' | 'git';
  projectDir?: string | null;
  mainFile: string;
  availableTexFiles: string[];
  theme: 'dark' | 'light';
  shortcuts: KeyShortcuts;
  quickBuildProfiles: QuickBuildProfile[];
  compilerSettings: CompilerSettings;
  aiSettings: AISettings;
  detectedCompilers: CompilerInfo[];
  onClose: () => void;
  onChangeMainFile: (relPath: string) => void;
  onChangeTheme: (next: 'dark' | 'light') => void;
  onChangeShortcuts: (next: KeyShortcuts) => void;
  onChangeQuickBuildProfiles: (next: QuickBuildProfile[]) => void;
  onChangeCompiler: (next: CompilerSettings) => void;
  onChangeAI: (next: AISettings) => void;
  onRefreshCompilers: () => void;
}

const DEFAULT_MODELS: Record<AIProvider, string> = {
  gemini: 'gemini-2.5-flash',
  openai: 'gpt-4o-mini',
  anthropic: 'claude-3-5-sonnet-latest',
  ollama: 'llama3.2',
  custom: 'gpt-4o-mini',
};

export const SettingsModal: React.FC<SettingsModalProps> = ({
  open,
  initialTab = 'compiler',
  projectDir,
  mainFile,
  availableTexFiles,
  theme,
  shortcuts,
  quickBuildProfiles,
  compilerSettings,
  aiSettings,
  detectedCompilers,
  onClose,
  onChangeMainFile,
  onChangeTheme,
  onChangeShortcuts,
  onChangeQuickBuildProfiles,
  onChangeCompiler,
  onChangeAI,
  onRefreshCompilers,
}) => {
  const [tab, setTab] = useState<'compiler' | 'editor' | 'ai' | 'git'>(initialTab);
  const [testResult, setTestResult] = useState<Record<string, CompilerTestResult>>({});
  const [newQbName, setNewQbName] = useState('');
  const [newQbSteps, setNewQbSteps] = useState('pdflatex, bibtex, pdflatex, pdflatex');
  const [gitInstalled, setGitInstalled] = useState(true);
  const [gitName, setGitName] = useState('');
  const [gitEmail, setGitEmail] = useState('');
  const [gitRemote, setGitRemote] = useState('');
  const [gitTokenHost, setGitTokenHost] = useState('github.com');
  const [gitTokenUser, setGitTokenUser] = useState('');
  const [gitToken, setGitToken] = useState('');
  const [gitCloneUrl, setGitCloneUrl] = useState('');
  const [gitFeedback, setGitFeedback] = useState('');
  const { locale, setLocale, t } = useI18n();

  useEffect(() => {
    if (open) {
      setTab(initialTab);
      setGitFeedback('');
      if (projectDir) {
        gitStatus(projectDir)
          .then((info) => {
            setGitInstalled(info.git_installed);
            setGitName(info.user_name);
            setGitEmail(info.user_email);
            setGitRemote(info.remote_url);
          })
          .catch(() => {});
      }
    }
  }, [open, initialTab, projectDir]);

  if (!open) return null;

  const handleBrowseFolder = async (
    field: 'miktexBinDir' | 'texliveBinDir' | 'tectonicBinDir' | 'customBinDir'
  ) => {
    const dir = await pickProjectFolder();
    if (dir) {
      onChangeCompiler({ ...compilerSettings, [field]: dir });
    }
  };

  const handleTest = async (dist: string, binDir?: string) => {
    const res = await testCompiler(dist, compilerSettings.engine, binDir);
    setTestResult((prev) => ({ ...prev, [dist]: res }));
  };

  return (
    <div className="tf-modal-backdrop" onClick={onClose}>
      <div className="tf-modal tf-modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="tf-modal-header">
          <div className="tf-modal-tabs">
            <button
              type="button"
              className={`tf-modal-tab ${tab === 'compiler' ? 'active' : ''}`}
              onClick={() => setTab('compiler')}
            >
              <Cpu size={14} /> {t('settings.tabCompiler')}
            </button>
            <button
              type="button"
              className={`tf-modal-tab ${tab === 'editor' ? 'active' : ''}`}
              onClick={() => setTab('editor')}
            >
              <Sliders size={14} /> {t('settings.tabEditor')}
            </button>
            <button
              type="button"
              className={`tf-modal-tab ${tab === 'ai' ? 'active' : ''}`}
              onClick={() => setTab('ai')}
            >
              <Sparkles size={14} /> {t('settings.tabAi')}
            </button>
            <button
              type="button"
              className={`tf-modal-tab ${tab === 'git' ? 'active' : ''}`}
              onClick={() => setTab('git')}
            >
              <GitBranch size={14} /> {t('settings.tabGit')}
            </button>
          </div>
          <button type="button" className="tf-icon-btn" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="tf-modal-body">
          {tab === 'compiler' && (
            <section className="tf-settings-section">
              <div className="tf-section-title-row">
                <h3>Compilador LaTeX &amp; Projeto</h3>
                <button type="button" className="tf-link-btn" onClick={onRefreshCompilers}>
                  <RefreshCw size={12} /> Detectar instalados
                </button>
              </div>

              <div className="tf-form-grid">
                <label>
                  <span>Distribuição</span>
                  <select
                    value={compilerSettings.distribution}
                    onChange={(e) =>
                      onChangeCompiler({
                        ...compilerSettings,
                        distribution: e.target.value as CompilerDistribution,
                      })
                    }
                  >
                    <option value="auto">Auto-detectar</option>
                    <option value="miktex">MiKTeX</option>
                    <option value="texlive">TeX Live</option>
                    <option value="tectonic">Tectonic</option>
                    <option value="custom">Caminho Personalizado</option>
                  </select>
                </label>

                <label>
                  <span>Motor (Engine)</span>
                  <select
                    value={compilerSettings.engine}
                    onChange={(e) =>
                      onChangeCompiler({
                        ...compilerSettings,
                        engine: e.target.value as CompilerEngine,
                      })
                    }
                  >
                    <option value="pdflatex">pdflatex</option>
                    <option value="xelatex">xelatex</option>
                    <option value="lualatex">lualatex</option>
                    <option value="latexmk">latexmk (multi-passagem auto)</option>
                  </select>
                </label>
              </div>

              <label className="tf-full-label">
                <span>Arquivo Principal de Compilação</span>
                {availableTexFiles.length > 0 ? (
                  <select value={mainFile} onChange={(e) => onChangeMainFile(e.target.value)}>
                    {availableTexFiles.map((file) => (
                      <option key={file} value={file}>
                        {file}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={mainFile}
                    onChange={(e) => onChangeMainFile(e.target.value)}
                    placeholder="main.tex"
                  />
                )}
              </label>

              <div className="tf-distro-paths-box">
                <div className="text-xs font-semibold text-slate-300 mb-1">
                  Pastas dos Compiladores (opcional se já estiver no PATH)
                </div>
                {(
                  [
                    { key: 'miktex', label: 'MiKTeX (pasta bin)', field: 'miktexBinDir' },
                    { key: 'texlive', label: 'TeX Live (pasta bin)', field: 'texliveBinDir' },
                    { key: 'tectonic', label: 'Tectonic (pasta)', field: 'tectonicBinDir' },
                    { key: 'custom', label: 'Personalizado (pasta bin)', field: 'customBinDir' },
                  ] as const
                ).map((row) => {
                  const val = compilerSettings[row.field];
                  const tr = testResult[row.key];
                  return (
                    <div key={row.key} className="tf-distro-path-row">
                      <span className="tf-distro-label">{row.label}</span>
                      <input
                        type="text"
                        placeholder="Auto-detectado do sistema / PATH"
                        value={val}
                        onChange={(e) =>
                          onChangeCompiler({ ...compilerSettings, [row.field]: e.target.value })
                        }
                      />
                      <button
                        type="button"
                        className="tf-btn-secondary"
                        onClick={() => handleBrowseFolder(row.field)}
                        title="Procurar pasta"
                      >
                        <FolderOpen size={12} />
                      </button>
                      <button
                        type="button"
                        className="tf-btn-secondary flex items-center gap-1"
                        onClick={() => handleTest(row.key, val)}
                        title="Testar execução e versão"
                      >
                        <Play size={11} /> Testar
                      </button>
                      {tr && (
                        <span
                          className={`text-[11px] ${tr.ok ? 'text-emerald-400' : 'text-rose-400'}`}
                          title={tr.binary_path}
                        >
                          {tr.version_line}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="tf-detected-list">
                {detectedCompilers.map((c) => (
                  <div key={c.id} className="tf-detected-item">
                    {c.available ? (
                      <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                    ) : (
                      <AlertCircle size={13} className="text-slate-500 shrink-0" />
                    )}
                    <span className="tf-detected-name">{c.name}</span>
                    <span className="tf-detected-path">
                      {c.available ? c.path : 'Não encontrado'}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {tab === 'editor' && (
            <section className="tf-settings-section">
              <h3>Aparência, Quick Build Sequencial &amp; Atalhos</h3>

              <div className="tf-form-grid">
                <label>
                  <span>{t('settings.language')}</span>
                  <select
                    value={locale}
                    onChange={(e) => setLocale(e.target.value as LocaleCode)}
                  >
                    {AVAILABLE_LOCALES.map((loc) => (
                      <option key={loc.code} value={loc.code}>
                        {loc.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="flex items-end">
                  <button
                    type="button"
                    className="tf-btn-small w-full justify-center"
                    style={{ height: 34 }}
                    onClick={() => void openManualPdf(locale)}
                  >
                    {locale === 'pt-BR'
                      ? 'Abrir Manual do Usuário (PDF · PT-BR)'
                      : 'Open User Manual (PDF · EN-US)'}
                  </button>
                </div>

                <label>
                  <span>{t('settings.theme')}</span>
                  <select
                    value={theme}
                    onChange={(e) => onChangeTheme(e.target.value as 'dark' | 'light')}
                  >
                    <option value="dark">{t('settings.themeDark')}</option>
                    <option value="light">{t('settings.themeLight')}</option>
                  </select>
                </label>

                <label>
                  <span>Auto-Save / Backup Automático</span>
                  <select
                    value={compilerSettings.autoSaveIntervalSec}
                    onChange={(e) =>
                      onChangeCompiler({
                        ...compilerSettings,
                        autoSaveIntervalSec: Number(e.target.value),
                      })
                    }
                  >
                    <option value={0}>Desativado (Ctrl+S manual)</option>
                    <option value={30}>A cada 30 segundos</option>
                    <option value={60}>A cada 60 segundos</option>
                  </select>
                </label>
              </div>

              <label className="tf-checkbox-row">
                <input
                  type="checkbox"
                  checked={compilerSettings.autoCompileOnSave}
                  onChange={(e) =>
                    onChangeCompiler({ ...compilerSettings, autoCompileOnSave: e.target.checked })
                  }
                />
                <span>Recompilar PDF automaticamente ao salvar (Ctrl+S)</span>
              </label>

              <label className="tf-checkbox-row">
                <input
                  type="checkbox"
                  checked={compilerSettings.useBuildDir}
                  onChange={(e) =>
                    onChangeCompiler({ ...compilerSettings, useBuildDir: e.target.checked })
                  }
                />
                <span>Isolar arquivos auxiliares (.aux, .log, .pdf) na subpasta build/</span>
              </label>

              <div className="tf-distro-paths-box">
                <div className="text-xs font-semibold text-slate-300">
                  Perfis de Quick Build Sequencial (use botão direito em Compilar)
                </div>

                <label className="tf-full-label">
                  <span>Padrão Global</span>
                  <select
                    value={compilerSettings.quickBuildPreset}
                    onChange={(e) =>
                      onChangeCompiler({
                        ...compilerSettings,
                        quickBuildPreset: e.target.value,
                      })
                    }
                  >
                    <option value="auto">Automático (detecta .bib e roda BibTeX/Biber + 2 passes)</option>
                    {quickBuildProfiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.steps.join(' → ')})
                      </option>
                    ))}
                  </select>
                </label>

                <div className="flex flex-wrap gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Nome (ex: Artigo IEEE)"
                    value={newQbName}
                    onChange={(e) => setNewQbName(e.target.value)}
                    style={{ width: '160px' }}
                  />
                  <input
                    type="text"
                    placeholder="Passos (ex: pdflatex, bibtex, pdflatex, pdflatex)"
                    value={newQbSteps}
                    onChange={(e) => setNewQbSteps(e.target.value)}
                    className="flex-1"
                  />
                  <button
                    type="button"
                    className="tf-btn-primary"
                    onClick={() => {
                      const steps = newQbSteps
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean);
                      if (!newQbName.trim() || steps.length === 0) return;
                      const item: QuickBuildProfile = {
                        id: `qb-${Date.now()}`,
                        name: newQbName.trim(),
                        steps,
                      };
                      onChangeQuickBuildProfiles([...quickBuildProfiles, item]);
                      setNewQbName('');
                    }}
                  >
                    <Plus size={12} /> Adicionar
                  </button>
                </div>

                <div className="tf-detected-list">
                  {quickBuildProfiles.map((p) => (
                    <div key={p.id} className="tf-detected-item justify-between">
                      <span>
                        <strong>{p.name}</strong> — <code>{p.steps.join(' → ')}</code>
                      </span>
                      <button
                        type="button"
                        className="tf-icon-btn"
                        onClick={() =>
                          onChangeQuickBuildProfiles(
                            quickBuildProfiles.filter((item) => item.id !== p.id)
                          )
                        }
                        title="Remover perfil"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>

                <label className="tf-checkbox-row">
                  <input
                    type="checkbox"
                    checked={compilerSettings.autoRunBib}
                    onChange={(e) =>
                      onChangeCompiler({ ...compilerSettings, autoRunBib: e.target.checked })
                    }
                  />
                  <span>No modo Automático, rodar BibTeX/Biber + 2 passes quando houver .bib</span>
                </label>
              </div>

              <div className="tf-distro-paths-box">
                <div className="text-xs font-semibold text-slate-300">Atalhos de Teclado</div>
                <div className="tf-form-grid">
                  <label>
                    <span>Compilar</span>
                    <input
                      type="text"
                      value={shortcuts.compile}
                      onChange={(e) => onChangeShortcuts({ ...shortcuts, compile: e.target.value })}
                    />
                  </label>
                  <label>
                    <span>Referência Rápida</span>
                    <input
                      type="text"
                      value={shortcuts.quickRef}
                      onChange={(e) => onChangeShortcuts({ ...shortcuts, quickRef: e.target.value })}
                    />
                  </label>
                  <label>
                    <span>Símbolos Matemáticos</span>
                    <input
                      type="text"
                      value={shortcuts.symbols}
                      onChange={(e) => onChangeShortcuts({ ...shortcuts, symbols: e.target.value })}
                    />
                  </label>
                  <label>
                    <span>Estúdio de Tabelas</span>
                    <input
                      type="text"
                      value={shortcuts.tables}
                      onChange={(e) => onChangeShortcuts({ ...shortcuts, tables: e.target.value })}
                    />
                  </label>
                </div>
              </div>
            </section>
          )}

          {tab === 'ai' && (
            <section className="tf-settings-section">
              <h3>Inteligência Artificial (BYOK — Sua Própria Chave)</h3>
              <p className="tf-section-desc">
                Sua chave é salva apenas localmente no seu dispositivo. A IA aparece como aba ao
                lado do <strong>PDF Preview</strong> no painel direito, preservando 100% do espaço
                do editor.
              </p>

              <div className="tf-form-grid">
                <label>
                  <span>Provedor de IA</span>
                  <select
                    value={aiSettings.provider}
                    onChange={(e) => {
                      const provider = e.target.value as AIProvider;
                      onChangeAI({
                        ...aiSettings,
                        provider,
                        model: DEFAULT_MODELS[provider],
                      });
                    }}
                  >
                    <option value="gemini">Google Gemini</option>
                    <option value="openai">OpenAI</option>
                    <option value="anthropic">Anthropic Claude</option>
                    <option value="ollama">Ollama (Local / Gratuito)</option>
                    <option value="custom">Endpoint Compatível (OpenAI)</option>
                  </select>
                </label>

                <label>
                  <span>Modelo</span>
                  <input
                    type="text"
                    value={aiSettings.model}
                    onChange={(e) => onChangeAI({ ...aiSettings, model: e.target.value })}
                    placeholder={DEFAULT_MODELS[aiSettings.provider]}
                  />
                </label>
              </div>

              {aiSettings.provider !== 'ollama' && (
                <label className="tf-full-label">
                  <span>API Key</span>
                  <input
                    type="password"
                    value={aiSettings.apiKey}
                    onChange={(e) => onChangeAI({ ...aiSettings, apiKey: e.target.value })}
                    placeholder="Cole sua API Key aqui..."
                  />
                </label>
              )}

              {(aiSettings.provider === 'ollama' || aiSettings.provider === 'custom') && (
                <label className="tf-full-label">
                  <span>Endpoint URL</span>
                  <input
                    type="text"
                    value={aiSettings.customEndpoint}
                    onChange={(e) => onChangeAI({ ...aiSettings, customEndpoint: e.target.value })}
                    placeholder={
                      aiSettings.provider === 'ollama'
                        ? 'http://localhost:11434'
                        : 'https://api.exemplo.com/v1/chat/completions'
                    }
                  />
                </label>
              )}
            </section>
          )}

          {tab === 'git' && (
            <section className="tf-settings-section">
              <h3>Configuração do Git &amp; GitHub</h3>
              <div className="tf-detected-row">
                {gitInstalled && gitName && gitEmail ? (
                  <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle size={14} className="text-amber-400 shrink-0" />
                )}
                <span className="text-xs">
                  {!gitInstalled
                    ? 'Git não encontrado no PATH do sistema.'
                    : gitName && gitEmail
                    ? `Conectado como ${gitName} <${gitEmail}>`
                    : 'Identidade global do Git (user.name / user.email) ainda não configurada.'}
                </span>
              </div>

              {gitFeedback && <div className="tf-git-feedback">{gitFeedback}</div>}

              <div className="tf-form-grid">
                <label>
                  <span>Nome do Autor (git config --global user.name)</span>
                  <input
                    type="text"
                    value={gitName}
                    onChange={(e) => setGitName(e.target.value)}
                    placeholder="Ex: Maria Silva"
                  />
                </label>
                <label>
                  <span>E-mail (git config --global user.email)</span>
                  <input
                    type="email"
                    value={gitEmail}
                    onChange={(e) => setGitEmail(e.target.value)}
                    placeholder="maria@exemplo.com"
                  />
                </label>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  className="tf-btn-primary"
                  onClick={async () => {
                    try {
                      const msg = await gitSetUserConfig(gitName, gitEmail);
                      setGitFeedback(msg);
                    } catch (e) {
                      setGitFeedback(String(e));
                    }
                  }}
                >
                  Salvar Identidade Global
                </button>
              </div>

              <div className="tf-distro-paths-box">
                <div className="text-xs font-semibold text-slate-300">
                  Autenticação Online (GitHub / GitLab — Personal Access Token)
                </div>
                <p className="text-[11px] text-slate-400">
                  No GitHub, gere um <strong>Personal Access Token</strong> (Settings → Developer settings → Personal access tokens) com permissão <code>repo</code> e salve aqui para fazer Push/Pull sem pedir senha.
                </p>
                <div className="tf-form-grid">
                  <label>
                    <span>Servidor</span>
                    <select
                      value={gitTokenHost}
                      onChange={(e) => setGitTokenHost(e.target.value)}
                    >
                      <option value="github.com">GitHub (github.com)</option>
                      <option value="gitlab.com">GitLab (gitlab.com)</option>
                    </select>
                  </label>
                  <label>
                    <span>Usuário GitHub / GitLab</span>
                    <input
                      type="text"
                      value={gitTokenUser}
                      onChange={(e) => setGitTokenUser(e.target.value)}
                      placeholder="seu-usuario"
                    />
                  </label>
                </div>
                <label className="tf-full-label">
                  <span>Personal Access Token (PAT)</span>
                  <input
                    type="password"
                    value={gitToken}
                    onChange={(e) => setGitToken(e.target.value)}
                    placeholder="ghp_... ou glpat-..."
                  />
                </label>
                <div className="flex justify-end">
                  <button
                    type="button"
                    className="tf-btn-small"
                    onClick={async () => {
                      try {
                        const msg = await gitSaveCredential(gitTokenHost, gitTokenUser, gitToken);
                        setGitToken('');
                        setGitFeedback(msg);
                      } catch (e) {
                        setGitFeedback(String(e));
                      }
                    }}
                  >
                    Salvar Token no Windows
                  </button>
                </div>
              </div>

              <div className="tf-distro-paths-box">
                <div className="text-xs font-semibold text-slate-300">
                  Clonar Repositório Existente (GitHub / GitLab)
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    className="tf-git-input flex-1"
                    value={gitCloneUrl}
                    onChange={(e) => setGitCloneUrl(e.target.value)}
                    placeholder="https://github.com/usuario/repositorio.git"
                  />
                  <button
                    type="button"
                    className="tf-btn-small"
                    onClick={async () => {
                      const target = await pickProjectFolder();
                      if (!target) return;
                      try {
                        const msg = await gitClone(gitCloneUrl, target);
                        setGitFeedback(`${msg} (${target})`);
                      } catch (e) {
                        setGitFeedback(String(e));
                      }
                    }}
                  >
                    Clonar em Pasta...
                  </button>
                </div>
              </div>

              {projectDir && (
                <>
                  <label className="tf-full-label">
                    <span>Repositório Remoto (origin) do Projeto Atual</span>
                    <input
                      type="text"
                      value={gitRemote}
                      onChange={(e) => setGitRemote(e.target.value)}
                      placeholder="https://github.com/usuario/repositorio.git"
                    />
                  </label>
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      className="tf-btn-small"
                      onClick={async () => {
                        try {
                          const msg = await gitCreateLatexGitignore(projectDir);
                          setGitFeedback(msg);
                        } catch (e) {
                          setGitFeedback(String(e));
                        }
                      }}
                    >
                      Gerar .gitignore LaTeX
                    </button>
                    <button
                      type="button"
                      className="tf-btn-small"
                      onClick={async () => {
                        try {
                          const msg = await gitSetRemote(projectDir, gitRemote);
                          setGitFeedback(msg);
                        } catch (e) {
                          setGitFeedback(String(e));
                        }
                      }}
                    >
                      Salvar Remoto (origin)
                    </button>
                  </div>
                </>
              )}
            </section>
          )}
        </div>

        <div className="tf-modal-footer">
          <button type="button" className="tf-btn-primary" onClick={onClose}>
            {t('settings.done')}
          </button>
        </div>
      </div>
    </div>
  );
};
