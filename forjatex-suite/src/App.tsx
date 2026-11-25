import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  CheckCircle2,
  Download,
  ExternalLink,
  Moon,
  Play,
  RefreshCw,
  Settings,
  Sparkles,
  Sun,
} from 'lucide-react';

interface InstalledAppInfo {
  id: string;
  installed: boolean;
  exe_path: string | null;
  version: string | null;
}

interface SuiteAppEntry {
  id: string;
  name: string;
  tagline: string;
  description: string;
  latestVersion: string;
  installerUrl: string;
  installerFile: string;
  changelog: string;
  badgeColor: string;
  comingSoon?: boolean;
}

const DEFAULT_APPS: SuiteAppEntry[] = [
  {
    id: 'forjatex',
    name: 'ForjaTeX IDE',
    tagline: 'Editor LaTeX Profissional',
    description:
      'IDE completa com Monaco Editor, PDF Preview com SyncTeX, Assistentes de Matriz/Tabela/Fontes, Corretor LaTeX-Aware, GitHub e IA.',
    latestVersion: '1.3.0',
    installerUrl:
      'https://github.com/jeanjpimenta/forjatex-suite/releases/latest/download/ForjaTeX_1.3.0_x64-setup.exe',
    installerFile: 'ForjaTeX_1.3.0_x64-setup.exe',
    changelog: 'v1.3.0: i18n comunitário (PT-BR/EN), Git completo com PAT/Clone e Tooltip na régua.',
    badgeColor: '#38BDF8',
  },
  {
    id: 'forjatikz',
    name: 'ForjaTikZ',
    tagline: 'Studio Visual TikZ & PGFPlots',
    description:
      'Crie diagramas, grafos, nós, setas e gráficos matemáticos PGFPlots visualmente e exporte código LaTeX limpo em segundos.',
    latestVersion: '1.0.0',
    installerUrl:
      'https://github.com/jeanjpimenta/forjatex-suite/releases/latest/download/ForjaTikZ_1.0.0_x64-setup.exe',
    installerFile: 'ForjaTikZ_1.0.0_x64-setup.exe',
    changelog: 'v1.0.0: Canvas interativo TikZ + Gerador PGFPlots + Validação via pdflatex.',
    badgeColor: '#F59E0B',
  },
  {
    id: 'forjasnap',
    name: 'ForjaSnap',
    tagline: 'OCR de Equações e Tabelas',
    description:
      'Converta capturas de tela, PDFs e anotações manuscritas em código LaTeX pronto para colar.',
    latestVersion: '0.1.0',
    installerUrl: '',
    installerFile: '',
    changelog: 'Planejado para a próxima entrega da suíte.',
    badgeColor: '#A855F7',
    comingSoon: true,
  },
  {
    id: 'forjabib',
    name: 'ForjaBib',
    tagline: 'Gerenciador de Bibliografias .bib',
    description:
      'Busque referências por DOI, ISBN ou arXiv e valide citações ABNT e BibLaTeX automaticamente.',
    latestVersion: '0.1.0',
    installerUrl: '',
    installerFile: '',
    changelog: 'Planejado para a próxima entrega da suíte.',
    badgeColor: '#10B981',
    comingSoon: true,
  },
  {
    id: 'forjadiff',
    name: 'ForjaDiff',
    tagline: 'Comparador Visual latexdiff',
    description:
      'Compare duas versões de um artigo .tex e gere o PDF com inserções e remoções destacadas para revisores.',
    latestVersion: '0.1.0',
    installerUrl: '',
    installerFile: '',
    changelog: 'Planejado para a próxima entrega da suíte.',
    badgeColor: '#F43F5E',
    comingSoon: true,
  },
];

const MANIFEST_KEY = 'forjatex_suite_manifest_url_v1';

export default function App() {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [apps, setApps] = useState<SuiteAppEntry[]>(DEFAULT_APPS);
  const [installedMap, setInstalledMap] = useState<Record<string, InstalledAppInfo>>({});
  const [manifestUrl, setManifestUrl] = useState<string>(
    () =>
      localStorage.getItem(MANIFEST_KEY) ||
      'https://github.com/jeanjpimenta/forjatex-suite/releases/latest/download/suite-manifest.json'
  );
  const [showConfig, setShowConfig] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState('Pronto para gerenciar seus aplicativos LaTeX.');

  const scanInstalled = async () => {
    try {
      const list = await invoke<InstalledAppInfo[]>('check_installed_apps');
      const map: Record<string, InstalledAppInfo> = {};
      for (const item of list) map[item.id] = item;
      setInstalledMap(map);
    } catch (e) {
      setStatusMsg(String(e));
    }
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    scanInstalled();
  }, []);

  const handleCheckUpdates = async () => {
    setBusyId('manifest');
    setStatusMsg('Verificando manifesto de atualizações no GitHub Releases...');
    localStorage.setItem(MANIFEST_KEY, manifestUrl);
    try {
      const raw = await invoke<string>('fetch_manifest_json', { url: manifestUrl });
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.apps)) {
        setApps((prev) =>
          prev.map((a) => {
            const remote = parsed.apps.find((r: Partial<SuiteAppEntry>) => r.id === a.id);
            return remote ? { ...a, ...remote, comingSoon: false } : a;
          })
        );
        setStatusMsg('Catálogo atualizado com sucesso via GitHub Releases!');
      } else {
        setStatusMsg('Manifesto lido, mas o formato não contém a lista "apps".');
      }
    } catch (e) {
      setStatusMsg(`Aviso ao consultar manifesto remoto: ${String(e)}`);
    } finally {
      setBusyId(null);
      await scanInstalled();
    }
  };

  const handleLaunch = async (app: SuiteAppEntry) => {
    const info = installedMap[app.id];
    if (!info?.exe_path) return;
    try {
      await invoke('launch_app', { exePath: info.exe_path });
      setStatusMsg(`${app.name} aberto.`);
    } catch (e) {
      setStatusMsg(String(e));
    }
  };

  const handleInstallOrUpdate = async (app: SuiteAppEntry) => {
    if (!app.installerUrl || !app.installerFile) return;
    setBusyId(app.id);
    setStatusMsg(`Baixando ${app.name} v${app.latestVersion}...`);
    try {
      const msg = await invoke<string>('download_and_run_installer', {
        url: app.installerUrl,
        fileName: app.installerFile,
      });
      setStatusMsg(msg);
      setTimeout(scanInstalled, 3000);
    } catch (e) {
      setStatusMsg(`Erro ao baixar ${app.name}: ${String(e)}`);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="suite-shell">
      <header className="suite-header">
        <div className="suite-brand">
          <img src="/logo.png" alt="ForjaTeX Suite" className="suite-logo" />
          <div>
            <h1>ForjaTeX App Suite</h1>
            <span>Ecossistema Modular para Escrita Científica em LaTeX</span>
          </div>
        </div>
        <div className="suite-actions">
          <button
            type="button"
            className="suite-btn"
            onClick={handleCheckUpdates}
            disabled={busyId === 'manifest'}
          >
            <RefreshCw size={14} className={busyId === 'manifest' ? 'spin' : ''} />
            Verificar Atualizações
          </button>
          <button
            type="button"
            className="suite-btn"
            onClick={() => setShowConfig((v) => !v)}
          >
            <Settings size={14} /> Fonte (GitHub)
          </button>
          <button
            type="button"
            className="suite-btn"
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            title="Alternar tema"
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>
      </header>

      {showConfig && (
        <div className="suite-config-bar">
          <label>
            <span>URL do Manifesto (GitHub Releases `suite-manifest.json`):</span>
            <input
              type="text"
              value={manifestUrl}
              onChange={(e) => setManifestUrl(e.target.value)}
            />
          </label>
          <button type="button" className="suite-btn primary" onClick={handleCheckUpdates}>
            Salvar &amp; Atualizar
          </button>
        </div>
      )}

      <div className="suite-status-banner">
        <Sparkles size={14} />
        <span>{statusMsg}</span>
      </div>

      <main className="suite-grid">
        {apps.map((app) => {
          const info = installedMap[app.id];
          const isInstalled = Boolean(info?.installed);
          return (
            <div key={app.id} className={`suite-card ${app.comingSoon ? 'soon' : ''}`}>
              <div className="suite-card-top">
                <div className="suite-card-badge" style={{ borderColor: app.badgeColor }}>
                  <span style={{ color: app.badgeColor }}>{app.name.slice(0, 2).toUpperCase()}</span>
                </div>
                <div className="suite-card-title">
                  <h2>{app.name}</h2>
                  <span className="suite-tagline">{app.tagline}</span>
                </div>
                <span className={`suite-pill ${isInstalled ? 'ok' : ''}`}>
                  {app.comingSoon ? 'Em breve' : isInstalled ? 'Instalado' : `v${app.latestVersion}`}
                </span>
              </div>

              <p className="suite-desc">{app.description}</p>
              <div className="suite-changelog">{app.changelog}</div>

              <div className="suite-card-footer">
                {app.comingSoon ? (
                  <button type="button" className="suite-btn" disabled>
                    Próximo lançamento
                  </button>
                ) : (
                  <>
                    {isInstalled && (
                      <button
                        type="button"
                        className="suite-btn primary"
                        onClick={() => handleLaunch(app)}
                      >
                        <Play size={13} /> Abrir
                      </button>
                    )}
                    <button
                      type="button"
                      className={`suite-btn ${!isInstalled ? 'primary' : ''}`}
                      disabled={busyId === app.id}
                      onClick={() => handleInstallOrUpdate(app)}
                    >
                      <Download size={13} />
                      {busyId === app.id
                        ? 'Baixando...'
                        : isInstalled
                        ? `Atualizar (v${app.latestVersion})`
                        : `Instalar v${app.latestVersion}`}
                    </button>
                    {isInstalled && (
                      <span className="suite-installed-mark" title={info?.exe_path ?? ''}>
                        <CheckCircle2 size={14} /> Pronto
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </main>

      <footer className="suite-footer">
        <span>ForjaTeX App Suite v1.0.0 — Distribuição gratuita via GitHub Releases</span>
        <span className="flex items-center gap-1">
          <ExternalLink size={12} /> Atualizações centralizadas por manifesto JSON
        </span>
      </footer>
    </div>
  );
}

