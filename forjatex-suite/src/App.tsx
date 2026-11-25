import { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-shell';
import {
  ArrowUpRight,
  Check,
  Copy,
  Heart,
  LayoutGrid,
  List,
  Moon,
  MoreHorizontal,
  RefreshCw,
  Settings,
  Sun,
  X,
} from 'lucide-react';
import {
  generatePixQrDataUrl,
  getPayPalDonateUrl,
  PAYPAL_EMAIL,
  PIX_KEY,
} from './pixDonate';

interface InstalledAppInfo {
  id: string;
  installed: boolean;
  exe_path: string | null;
  version: string | null;
}

interface SuiteAppEntry {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  latestVersion: string;
  updatedAt: string;
  iconUrl: string;
  accentColor: string;
  installerUrl: string;
  installerFile: string;
  changelog: string;
  comingSoon?: boolean;
}

const DEFAULT_APPS: SuiteAppEntry[] = [
  {
    id: 'forjatex',
    name: 'ForjaTeX IDE',
    subtitle: 'Editor LaTeX profissional',
    description:
      'IDE completa com Monaco Editor, PDF Preview + SyncTeX, Assistentes visuais, Corretor LaTeX-Aware e GitHub.',
    latestVersion: '1.3.0',
    updatedAt: '25 de nov. de 2026',
    iconUrl: '/forjatex-icon.png',
    accentColor: '#0284C7',
    installerUrl:
      'https://github.com/jeanjpimenta/forjatex-suite/releases/latest/download/ForjaTeX_1.3.0_x64-setup.exe',
    installerFile: 'ForjaTeX_1.3.0_x64-setup.exe',
    changelog: 'v1.3.0: i18n comunitário (PT-BR/EN), Git completo com PAT/Clone e Tooltip na régua.',
  },
  {
    id: 'forjatikz',
    name: 'ForjaTikZ',
    subtitle: 'Diagramas TikZ e gráficos PGF',
    description:
      'Desenhe grafos, fluxogramas e curvas PGFPlots visualmente e exporte código LaTeX limpo em segundos.',
    latestVersion: '1.0.0',
    updatedAt: '25 de nov. de 2026',
    iconUrl: '/forjatikz-icon.png',
    accentColor: '#D97706',
    installerUrl:
      'https://github.com/jeanjpimenta/forjatex-suite/releases/latest/download/ForjaTikZ_1.0.0_x64-setup.exe',
    installerFile: 'ForjaTikZ_1.0.0_x64-setup.exe',
    changelog: 'v1.0.0: Canvas interativo TikZ + Gerador PGFPlots + Validação via pdflatex.',
  },
  {
    id: 'forjasnap',
    name: 'ForjaSnap',
    subtitle: 'OCR de equações e tabelas',
    description:
      'Converta capturas de tela, PDFs e anotações manuscritas diretamente em código LaTeX.',
    latestVersion: '0.1.0',
    updatedAt: 'Em desenvolvimento',
    iconUrl: '/logo.png',
    accentColor: '#7C3AED',
    installerUrl: '',
    installerFile: '',
    changelog: 'Planejado para a próxima entrega da suíte.',
    comingSoon: true,
  },
  {
    id: 'forjabib',
    name: 'ForjaBib',
    subtitle: 'Gerenciador de bibliografias',
    description:
      'Busque referências por DOI, ISBN ou arXiv e valide citações ABNT e BibLaTeX automaticamente.',
    latestVersion: '0.1.0',
    updatedAt: 'Em desenvolvimento',
    iconUrl: '/logo.png',
    accentColor: '#059669',
    installerUrl: '',
    installerFile: '',
    changelog: 'Planejado para a próxima entrega da suíte.',
    comingSoon: true,
  },
  {
    id: 'forjadiff',
    name: 'ForjaDiff',
    subtitle: 'Comparador visual latexdiff',
    description:
      'Compare duas versões de um artigo .tex e gere o PDF com inserções e remoções destacadas.',
    latestVersion: '0.1.0',
    updatedAt: 'Em desenvolvimento',
    iconUrl: '/logo.png',
    accentColor: '#E11D48',
    installerUrl: '',
    installerFile: '',
    changelog: 'Planejado para a próxima entrega da suíte.',
    comingSoon: true,
  },
];

const MANIFEST_KEY = 'forjatex_suite_manifest_url_v1';
const GITHUB_REPO_URL = 'https://github.com/jeanjpimenta/forjatex-suite';

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [apps, setApps] = useState<SuiteAppEntry[]>(DEFAULT_APPS);
  const [installedMap, setInstalledMap] = useState<Record<string, InstalledAppInfo>>({});
  const [manifestUrl, setManifestUrl] = useState<string>(
    () =>
      localStorage.getItem(MANIFEST_KEY) ||
      'https://github.com/jeanjpimenta/forjatex-suite/releases/latest/download/suite-manifest.json'
  );
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'status'>('name');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showConfig, setShowConfig] = useState(false);
  const [donateOpen, setDonateOpen] = useState(false);
  const [pixQrUrl, setPixQrUrl] = useState('');
  const [pixBrCode, setPixBrCode] = useState('');
  const [copyTag, setCopyTag] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [bannerText, setBannerText] = useState<string | null>(
    'ForjaTeX App Suite conectado ao GitHub Releases (jeanjpimenta/forjatex-suite).'
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState('agora');

  const scanInstalled = async () => {
    try {
      const list = await invoke<InstalledAppInfo[]>('check_installed_apps');
      const map: Record<string, InstalledAppInfo> = {};
      for (const item of list) map[item.id] = item;
      setInstalledMap(map);
    } catch (e) {
      setBannerText(String(e));
    }
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    scanInstalled();
    generatePixQrDataUrl('DoacaoFjTexSuite')
      .then(({ brCode, qrUrl }) => {
        setPixBrCode(brCode);
        setPixQrUrl(qrUrl);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const close = () => setOpenMenuId(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  const handleCheckUpdates = async () => {
    setBusyId('manifest');
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
        setBannerText('Catálogo sincronizado com sucesso via GitHub Releases.');
        setLastChecked('agora mesmo');
      }
    } catch (e) {
      setBannerText(`Manifesto remoto ainda indisponível: ${String(e)}`);
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
    } catch (e) {
      setBannerText(String(e));
    }
  };

  const handleInstallOrUpdate = async (app: SuiteAppEntry) => {
    if (!app.installerUrl || !app.installerFile) return;
    setBusyId(app.id);
    setBannerText(`Baixando ${app.name} v${app.latestVersion}...`);
    try {
      const msg = await invoke<string>('download_and_run_installer', {
        url: app.installerUrl,
        fileName: app.installerFile,
      });
      setBannerText(msg);
      setTimeout(scanInstalled, 3000);
    } catch (e) {
      setBannerText(`Erro ao baixar ${app.name}: ${String(e)}`);
    } finally {
      setBusyId(null);
    }
  };

  const filteredApps = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = apps.filter(
      (a) =>
        !q ||
        a.name.toLowerCase().includes(q) ||
        a.subtitle.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q)
    );
    return [...list].sort((a, b) => {
      if (sortBy === 'status') {
        const ia = installedMap[a.id]?.installed ? 0 : a.comingSoon ? 2 : 1;
        const ib = installedMap[b.id]?.installed ? 0 : b.comingSoon ? 2 : 1;
        if (ia !== ib) return ia - ib;
      }
      return a.name.localeCompare(b.name);
    });
  }, [apps, search, sortBy, installedMap]);

  return (
    <div className="ac-shell">
      {/* Top Window Bar */}
      <header className="ac-topbar">
        <div className="ac-brand">
          <img src="/logo.png" alt="ForjaTeX" className="ac-brand-logo" />
          <span className="ac-brand-name">FORJATEX</span>
          <span className="ac-brand-sep">|</span>
          <span className="ac-brand-sub">FORJATEX APP SUITE</span>
        </div>
        <div className="ac-topbar-right">
          <button
            type="button"
            className="ac-donate-btn"
            onClick={() => setDonateOpen(true)}
            title="Apoiar o ForjaTeX App Suite (Pix / PayPal)"
          >
            <Heart size={13} /> APOIAR
          </button>
          <button
            type="button"
            className="ac-icon-btn"
            onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
            title="Alternar tema Claro / Escuro"
          >
            {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
          </button>
          <button
            type="button"
            className={`ac-icon-btn ${showConfig ? 'active' : ''}`}
            onClick={() => setShowConfig((v) => !v)}
            title="Configurar URL do Manifesto GitHub"
          >
            <Settings size={14} />
          </button>
        </div>
      </header>

      {/* Update / Info Banner */}
      {bannerText && (
        <div className="ac-banner">
          <div className="ac-banner-left">
            <span className="ac-banner-pill">SUITE</span>
            <span>{bannerText}</span>
          </div>
          <div className="ac-banner-right">
            <button
              type="button"
              className="ac-link-upper"
              onClick={() => open(`${GITHUB_REPO_URL}/releases`)}
            >
              NOVIDADES <ArrowUpRight size={12} />
            </button>
            <button
              type="button"
              className="ac-btn-dark"
              onClick={handleCheckUpdates}
              disabled={busyId === 'manifest'}
            >
              {busyId === 'manifest' ? 'VERIFICANDO...' : 'VERIFICAR AGORA'}
            </button>
            <button
              type="button"
              className="ac-banner-close"
              onClick={() => setBannerText(null)}
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {showConfig && (
        <div className="ac-config-bar">
          <label>
            <span>URL DO MANIFESTO (GITHUB RELEASES)</span>
            <input
              type="text"
              value={manifestUrl}
              onChange={(e) => setManifestUrl(e.target.value)}
            />
          </label>
          <button type="button" className="ac-btn-dark" onClick={handleCheckUpdates}>
            SALVAR E SINCRONIZAR
          </button>
        </div>
      )}

      {/* Filter / Sort Toolbar */}
      <div className="ac-toolbar">
        <button
          type="button"
          className="ac-square-btn"
          onClick={handleCheckUpdates}
          title="Recarregar status e atualizações"
        >
          <RefreshCw size={14} className={busyId === 'manifest' ? 'spin' : ''} />
        </button>

        <div className="ac-toolbar-right">
          <span className="ac-sort-label">ORDENAR</span>
          <select
            className="ac-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'name' | 'status')}
          >
            <option value="name">Nome (A-Z)</option>
            <option value="status">Instalados primeiro</option>
          </select>
          <input
            type="text"
            className="ac-search"
            placeholder="Buscar aplicativos"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="ac-view-toggle">
            <button
              type="button"
              className={viewMode === 'grid' ? 'active' : ''}
              onClick={() => setViewMode('grid')}
              title="Grade"
            >
              <LayoutGrid size={14} />
            </button>
            <button
              type="button"
              className={viewMode === 'list' ? 'active' : ''}
              onClick={() => setViewMode('list')}
              title="Lista"
            >
              <List size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Uniform Hairline Grid / List */}
      <main className={viewMode === 'grid' ? 'ac-grid' : 'ac-list'}>
        {filteredApps.map((app) => {
          const info = installedMap[app.id];
          const isInstalled = Boolean(info?.installed);
          return (
            <article
              key={app.id}
              className={`ac-card ${isInstalled ? 'installed' : ''} ${app.comingSoon ? 'soon' : ''}`}
            >
              <div className="ac-card-meta">
                <span className="ac-version" style={{ color: app.accentColor }}>
                  V{app.latestVersion}
                </span>
                <button
                  type="button"
                  className="ac-link-upper"
                  onClick={() => open(`${GITHUB_REPO_URL}/releases`)}
                >
                  GITHUB <ArrowUpRight size={11} />
                </button>
              </div>

              <div className="ac-card-head">
                <img src={app.iconUrl} alt={app.name} className="ac-app-icon" />
                <div className="ac-card-titles">
                  <div className="ac-card-title-row">
                    <h2>{app.name}</h2>
                    <span className="ac-by-tag">POR FORJATEX</span>
                  </div>
                  <p className="ac-subtitle">{app.subtitle}</p>
                </div>
              </div>

              <p className="ac-desc">{app.description}</p>
              <div className="ac-updated">Última atualização: {app.updatedAt}</div>

              <div className="ac-card-actions">
                {app.comingSoon ? (
                  <button type="button" className="ac-action-main" disabled>
                    EM BREVE
                  </button>
                ) : isInstalled ? (
                  <button
                    type="button"
                    className="ac-action-main"
                    onClick={() => handleLaunch(app)}
                  >
                    ABRIR
                  </button>
                ) : (
                  <button
                    type="button"
                    className="ac-action-main"
                    disabled={busyId === app.id}
                    onClick={() => handleInstallOrUpdate(app)}
                  >
                    {busyId === app.id ? 'BAIXANDO...' : 'INSTALAR'}
                  </button>
                )}

                {!app.comingSoon && (
                  <div className="ac-more-wrap" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="ac-action-more"
                      onClick={() =>
                        setOpenMenuId((prev) => (prev === app.id ? null : app.id))
                      }
                      title="Mais opções"
                    >
                      <MoreHorizontal size={14} />
                    </button>
                    {openMenuId === app.id && (
                      <div className="ac-dropdown">
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenuId(null);
                            handleInstallOrUpdate(app);
                          }}
                        >
                          {isInstalled ? `Atualizar / Reinstalar (v${app.latestVersion})` : `Instalar v${app.latestVersion}`}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenuId(null);
                            setBannerText(`${app.name}: ${app.changelog}`);
                          }}
                        >
                          Ver novidades da versão
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </main>

      <footer className="ac-footer">
        <span>VERIFICADO {lastChecked.toUpperCase()} · VIA GITHUB RELEASES</span>
        <button
          type="button"
          className="ac-link-upper"
          onClick={() => open(GITHUB_REPO_URL)}
        >
          GITHUB.COM/JEANJPIMENTA/FORJATEX-SUITE <ArrowUpRight size={11} />
        </button>
      </footer>

      {donateOpen && (
        <div className="ac-modal-backdrop" onClick={() => setDonateOpen(false)}>
          <div className="ac-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ac-modal-head">
              <strong>Apoiar o ForjaTeX App Suite</strong>
              <button type="button" className="ac-icon-btn" onClick={() => setDonateOpen(false)}>
                <X size={14} />
              </button>
            </div>
            <div className="ac-modal-body">
              <div className="ac-donate-grid">
                <div className="ac-donate-box">
                  <strong>Pix (Chave Aleatória)</strong>
                  {pixQrUrl && <img src={pixQrUrl} alt="QR Code Pix" className="ac-qr" />}
                  <code>{PIX_KEY}</code>
                  <span className="ac-donate-desc">Descrição: DoacaoFjTexSuite</span>
                  <div className="ac-donate-btns">
                    <button
                      type="button"
                      className="ac-action-main"
                      onClick={async () => {
                        await navigator.clipboard.writeText(PIX_KEY);
                        setCopyTag('key');
                        setTimeout(() => setCopyTag(null), 2000);
                      }}
                    >
                      {copyTag === 'key' ? <Check size={12} /> : <Copy size={12} />} CHAVE
                    </button>
                    {pixBrCode && (
                      <button
                        type="button"
                        className="ac-btn-dark"
                        onClick={async () => {
                          await navigator.clipboard.writeText(pixBrCode);
                          setCopyTag('code');
                          setTimeout(() => setCopyTag(null), 2000);
                        }}
                      >
                        {copyTag === 'code' ? 'COPIADO!' : 'COPIA E COLA'}
                      </button>
                    )}
                  </div>
                </div>
                <div className="ac-donate-box">
                  <strong>PayPal</strong>
                  <code>{PAYPAL_EMAIL}</code>
                  <span className="ac-donate-desc">Descrição: DoacaoFjTexSuite</span>
                  <div className="ac-donate-btns">
                    <button
                      type="button"
                      className="ac-action-main"
                      onClick={async () => {
                        await navigator.clipboard.writeText(PAYPAL_EMAIL);
                        setCopyTag('pp');
                        setTimeout(() => setCopyTag(null), 2000);
                      }}
                    >
                      {copyTag === 'pp' ? 'COPIADO!' : 'COPIAR E-MAIL'}
                    </button>
                    <button
                      type="button"
                      className="ac-btn-dark"
                      onClick={() => open(getPayPalDonateUrl('DoacaoFjTexSuite'))}
                    >
                      ABRIR PAYPAL
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
