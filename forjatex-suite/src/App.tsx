import { useEffect, useMemo, useState } from 'react';
import { getVersion } from '@tauri-apps/api/app';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
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
import {
  detectSuiteLocale,
  saveSuiteLocale,
  SUITE_DICT,
  type SuiteLocale,
} from './i18n';

interface InstalledAppInfo {
  id: string;
  installed: boolean;
  exe_path: string | null;
  version: string | null;
}

interface DownloadProgress {
  id: string;
  downloaded: number;
  total: number;
}

interface SuiteSelfInfo {
  latestVersion: string;
  installerUrl: string;
  installerFile: string;
  msiUrl?: string;
  msiFile?: string;
  exeUrl?: string;
  exeFile?: string;
  debUrl?: string;
  debFile?: string;
  appImageUrl?: string;
  appImageFile?: string;
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
  msiUrl?: string;
  msiFile?: string;
  exeUrl?: string;
  exeFile?: string;
  debUrl?: string;
  debFile?: string;
  appImageUrl?: string;
  appImageFile?: string;
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
      'https://github.com/jeanjpimenta/forjatex-suite/releases/latest/download/ForjaTeX_1.3.0_x64_en-US.msi',
    installerFile: 'ForjaTeX_1.3.0_x64_en-US.msi',
    msiUrl:
      'https://github.com/jeanjpimenta/forjatex-suite/releases/latest/download/ForjaTeX_1.3.0_x64_en-US.msi',
    msiFile: 'ForjaTeX_1.3.0_x64_en-US.msi',
    exeUrl:
      'https://github.com/jeanjpimenta/forjatex-suite/releases/latest/download/ForjaTeX_1.3.0_x64-setup.exe',
    exeFile: 'ForjaTeX_1.3.0_x64-setup.exe',
    debUrl:
      'https://github.com/jeanjpimenta/forjatex-suite/releases/latest/download/ForjaTeX_1.3.0_amd64.deb',
    debFile: 'ForjaTeX_1.3.0_amd64.deb',
    appImageUrl:
      'https://github.com/jeanjpimenta/forjatex-suite/releases/latest/download/ForjaTeX_1.3.0_amd64.AppImage',
    appImageFile: 'ForjaTeX_1.3.0_amd64.AppImage',
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
      'https://github.com/jeanjpimenta/forjatex-suite/releases/latest/download/ForjaTikZ_1.0.0_x64_en-US.msi',
    installerFile: 'ForjaTikZ_1.0.0_x64_en-US.msi',
    msiUrl:
      'https://github.com/jeanjpimenta/forjatex-suite/releases/latest/download/ForjaTikZ_1.1.0_x64_en-US.msi',
    msiFile: 'ForjaTikZ_1.1.0_x64_en-US.msi',
    exeUrl:
      'https://github.com/jeanjpimenta/forjatex-suite/releases/latest/download/ForjaTikZ_1.1.0_x64-setup.exe',
    exeFile: 'ForjaTikZ_1.1.0_x64-setup.exe',
    debUrl:
      'https://github.com/jeanjpimenta/forjatex-suite/releases/latest/download/ForjaTikZ_1.1.0_amd64.deb',
    debFile: 'ForjaTikZ_1.1.0_amd64.deb',
    appImageUrl:
      'https://github.com/jeanjpimenta/forjatex-suite/releases/latest/download/ForjaTikZ_1.1.0_amd64.AppImage',
    appImageFile: 'ForjaTikZ_1.1.0_amd64.AppImage',
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
    iconUrl: '/forjasnap-icon.svg',
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
    iconUrl: '/forjabib-icon.svg',
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
    iconUrl: '/forjadiff-icon.svg',
    accentColor: '#E11D48',
    installerUrl: '',
    installerFile: '',
    changelog: 'Planejado para a próxima entrega da suíte.',
    comingSoon: true,
  },
];

const MANIFEST_KEY = 'forjatex_suite_manifest_url_v1';
const SORT_KEY = 'forjatex_suite_sort_by_v1';
const THEME_KEY = 'forjatex_suite_theme_v1';
const DOWNLOAD_DIR_KEY = 'forjatex_suite_download_dir_v1';
const AUTOCHECK_MIN_KEY = 'forjatex_suite_autocheck_min_v1';
const GITHUB_REPO_URL = 'https://github.com/jeanjpimenta/forjatex-suite';
const DISCORD_INVITE_URL = 'https://discord.gg/HSwh6MM9Bn';

interface CacheInfo {
  cache_dir: string;
  file_count: number;
  total_bytes: number;
}

function formatMb(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1);
}

function compareSemver(a: string, b: string): number {
  const pa = a.replace(/^v/i, '').split('.').map(Number);
  const pb = b.replace(/^v/i, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const da = pa[i] || 0;
    const db = pb[i] || 0;
    if (da > db) return 1;
    if (da < db) return -1;
  }
  return 0;
}

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem(THEME_KEY);
    return saved === 'dark' ? 'dark' : 'light';
  });
  const [locale, setLocale] = useState<SuiteLocale>(() => detectSuiteLocale());
  const t = (key: string) => SUITE_DICT[locale][key] ?? SUITE_DICT['pt-BR'][key] ?? key;
  const [suiteVersion, setSuiteVersion] = useState('1.2.3');
  const [suiteRemote, setSuiteRemote] = useState<SuiteSelfInfo | null>(null);
  const [apps, setApps] = useState<SuiteAppEntry[]>(DEFAULT_APPS);
  const [installedMap, setInstalledMap] = useState<Record<string, InstalledAppInfo>>({});
  const [progressMap, setProgressMap] = useState<Record<string, DownloadProgress>>({});
  const [manifestUrl, setManifestUrl] = useState<string>(
    () =>
      localStorage.getItem(MANIFEST_KEY) ||
      'https://github.com/jeanjpimenta/forjatex-suite/releases/latest/download/suite-manifest.json'
  );
  const [downloadDir, setDownloadDir] = useState<string>(
    () => localStorage.getItem(DOWNLOAD_DIR_KEY) || ''
  );
  const [autoCheckMin, setAutoCheckMin] = useState<number>(() => {
    const raw = Number(localStorage.getItem(AUTOCHECK_MIN_KEY));
    return Number.isFinite(raw) && raw >= 0 ? raw : 15;
  });
  const [cacheInfo, setCacheInfo] = useState<CacheInfo | null>(null);
  const [settingsTab, setSettingsTab] = useState<'general' | 'updates' | 'storage' | 'about'>('general');
  const [search, setSearch] = useState('');
  const isLinux = typeof navigator !== 'undefined' && /linux/i.test(navigator.userAgent);
  const [sortBy, setSortBy] = useState<'name' | 'status'>(() => {
    const saved = localStorage.getItem(SORT_KEY);
    return saved === 'status' ? 'status' : 'name';
  });
  const [installerFormat, setInstallerFormat] = useState<'msi' | 'exe' | 'deb' | 'appimage'>(() => {
    const saved = localStorage.getItem('forjatex_suite_installer_fmt_v1');
    if (isLinux) return saved === 'appimage' ? 'appimage' : 'deb';
    return saved === 'exe' ? 'exe' : 'msi';
  });
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showConfig, setShowConfig] = useState(false);
  const [donateOpen, setDonateOpen] = useState(false);
  const [donateTab, setDonateTab] = useState<'donate' | 'feedback'>('donate');
  const [fbKind, setFbKind] = useState<'feature' | 'bug'>('feature');
  const [fbTitle, setFbTitle] = useState('');
  const [fbDetails, setFbDetails] = useState('');
  const [fbContact, setFbContact] = useState('');
  const [fbSending, setFbSending] = useState(false);
  const [fbStatus, setFbStatus] = useState<string | null>(null);
  const [pixQrUrl, setPixQrUrl] = useState('');
  const [pixBrCode, setPixBrCode] = useState('');
  const [copyTag, setCopyTag] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [bannerText, setBannerText] = useState<string | null>(null);
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
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const refreshCacheInfo = async (dirOverride?: string) => {
    try {
      const info = await invoke<CacheInfo>('get_installer_cache_info', {
        downloadDir: (dirOverride ?? downloadDir).trim() || null,
      });
      setCacheInfo(info);
    } catch {
      // ignore in non-tauri preview
    }
  };

  useEffect(() => {
    getVersion().then(setSuiteVersion).catch(() => {});
    scanInstalled();
    void checkUpdates(true);
    void refreshCacheInfo();
    generatePixQrDataUrl('DoacaoFjTexSuite')
      .then(({ brCode, qrUrl }) => {
        setPixBrCode(brCode);
        setPixQrUrl(qrUrl);
      })
      .catch(() => {});

    const unlistenPromise = listen<DownloadProgress>('download-progress', (ev) => {
      setProgressMap((prev) => ({ ...prev, [ev.payload.id]: ev.payload }));
    });
    return () => {
      unlistenPromise.then((fn) => fn());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (autoCheckMin <= 0) return;
    const timer = window.setInterval(() => {
      void checkUpdates(true);
    }, autoCheckMin * 60 * 1000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCheckMin, manifestUrl]);

  useEffect(() => {
    const close = () => setOpenMenuId(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  const checkUpdates = async (silent = false) => {
    if (!silent) setBusyId('manifest');
    localStorage.setItem(MANIFEST_KEY, manifestUrl);
    try {
      const raw = await invoke<string>('fetch_manifest_json', { url: manifestUrl });
      const parsed = JSON.parse(raw);
      if (parsed.suite?.latestVersion) {
        setSuiteRemote(parsed.suite);
      }
      if (Array.isArray(parsed.apps)) {
        setApps((prev) =>
          prev.map((a) => {
            const remote = parsed.apps.find((r: Partial<SuiteAppEntry>) => r.id === a.id);
            return remote ? { ...a, ...remote, comingSoon: false } : a;
          })
        );
      }
      setLastChecked('agora mesmo');
      if (!silent) {
        setBannerText('Catálogo sincronizado com sucesso via GitHub Releases.');
      }
    } catch (e) {
      if (!silent) {
        setBannerText(`Manifesto remoto indisponível: ${String(e)}`);
      }
    } finally {
      if (!silent) setBusyId(null);
      await scanInstalled();
    }
  };

  const handleCheckUpdates = () => checkUpdates(false);

  const handleLaunch = async (app: SuiteAppEntry) => {
    const info = installedMap[app.id];
    if (!info?.exe_path) return;
    try {
      await invoke('launch_app', { exePath: info.exe_path });
    } catch (e) {
      setBannerText(String(e));
    }
  };

  const resolvePackage = (item: {
    installerUrl: string;
    installerFile: string;
    msiUrl?: string;
    msiFile?: string;
    exeUrl?: string;
    exeFile?: string;
    debUrl?: string;
    debFile?: string;
    appImageUrl?: string;
    appImageFile?: string;
  }) => {
    if (installerFormat === 'deb' && item.debUrl && item.debFile) {
      return { url: item.debUrl, fileName: item.debFile };
    }
    if (installerFormat === 'appimage' && item.appImageUrl && item.appImageFile) {
      return { url: item.appImageUrl, fileName: item.appImageFile };
    }
    if (installerFormat === 'msi' && item.msiUrl && item.msiFile) {
      return { url: item.msiUrl, fileName: item.msiFile };
    }
    if (installerFormat === 'exe' && item.exeUrl && item.exeFile) {
      return { url: item.exeUrl, fileName: item.exeFile };
    }
    return { url: item.installerUrl, fileName: item.installerFile };
  };

  const handleInstallOrUpdate = async (app: SuiteAppEntry, silent = true) => {
    const pkg = resolvePackage(app);
    if (!pkg.url || !pkg.fileName) return;
    setBusyId(app.id);
    try {
      const msg = await invoke<string>('download_and_run_installer', {
        id: app.id,
        url: pkg.url,
        fileName: pkg.fileName,
        silent,
        selfUpdate: false,
        downloadDir: downloadDir.trim() || null,
      });
      setBannerText(msg);
      await scanInstalled();
    } catch (e) {
      setBannerText(`Erro ao instalar ${app.name}: ${String(e)}`);
    } finally {
      setBusyId(null);
      setProgressMap((p) => {
        const next = { ...p };
        delete next[app.id];
        return next;
      });
    }
  };

  const handleSelfUpdate = async () => {
    if (!suiteRemote) return;
    const pkg = resolvePackage(suiteRemote);
    setBusyId('suite-self');
    try {
      await invoke<string>('download_and_run_installer', {
        id: 'suite-self',
        url: pkg.url,
        fileName: pkg.fileName,
        silent: true,
        selfUpdate: true,
        downloadDir: downloadDir.trim() || null,
      });
    } catch (e) {
      setBannerText(`Erro ao atualizar ForjaTeX Suite: ${String(e)}`);
      setBusyId(null);
    }
  };

  const hasSuiteUpdate =
    suiteRemote && compareSemver(suiteRemote.latestVersion, suiteVersion) > 0;

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

  const suiteProg = progressMap['suite-self'];

  return (
    <div className="ac-shell">
      {/* Top Window Bar */}
      <header className="ac-topbar">
        <div className="ac-topbar-inner">
          <div className="ac-brand">
            <img src="/logo.png" alt="ForjaTeX" className="ac-brand-logo" />
            <span className="ac-brand-name">FORJATEX</span>
            <span className="ac-brand-sep">|</span>
            <span className="ac-brand-sub">FORJATEX APP SUITE · V{suiteVersion}</span>
          </div>
          <div className="ac-topbar-right">
            <select
              className="ac-select"
              style={{ height: 26, fontSize: 11 }}
              value={locale}
              onChange={(e) => {
                const next = e.target.value as SuiteLocale;
                setLocale(next);
                saveSuiteLocale(next);
              }}
              title="Idioma / Language"
            >
              <option value="pt-BR">PT-BR</option>
              <option value="en">EN</option>
            </select>
            {hasSuiteUpdate && suiteRemote && (
              <button
                type="button"
                className="ac-btn-dark"
                style={{ padding: '4px 10px', fontSize: 11 }}
                onClick={handleSelfUpdate}
                disabled={busyId === 'suite-self'}
                title={`Atualizar ForjaTeX App Suite para v${suiteRemote.latestVersion}`}
              >
                {busyId === 'suite-self'
                  ? (locale === 'pt-BR' ? 'BAIXANDO...' : 'DOWNLOADING...')
                  : `${locale === 'pt-BR' ? 'ATUALIZAR SUITE' : 'UPDATE SUITE'} v${suiteRemote.latestVersion}`}
              </button>
            )}
            <button
              type="button"
              className="ac-donate-btn"
              onClick={() => setDonateOpen(true)}
              title="Apoiar o ForjaTeX App Suite (Pix / PayPal)"
            >
              <Heart size={13} /> {t('support')}
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
        </div>
      </header>

      <div className="ac-container">
        {/* Self-Update Banner (ArtCraft style) */}
        {hasSuiteUpdate && suiteRemote && (
          <div className="ac-banner" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div className="ac-banner-left">
                <span className="ac-banner-pill">{locale === 'pt-BR' ? 'ATUALIZAR' : 'UPDATE'}</span>
                <span>
                  {locale === 'pt-BR'
                    ? `ForjaTeX App Suite ${suiteRemote.latestVersion} está disponível.`
                    : `ForjaTeX App Suite ${suiteRemote.latestVersion} is available.`}
                </span>
              </div>
              <div className="ac-banner-right">
                <button
                  type="button"
                  className="ac-link-upper"
                  onClick={() => open(`${GITHUB_REPO_URL}/releases`)}
                >
                  {locale === 'pt-BR' ? 'NOVIDADES' : 'RELEASE NOTES'} <ArrowUpRight size={12} />
                </button>
                <button
                  type="button"
                  className="ac-btn-dark"
                  onClick={handleSelfUpdate}
                  disabled={busyId === 'suite-self'}
                >
                  {busyId === 'suite-self'
                    ? (locale === 'pt-BR' ? 'BAIXANDO...' : 'DOWNLOADING...')
                    : (locale === 'pt-BR' ? 'ATUALIZAR E REINICIAR' : 'UPDATE & RESTART')}
                </button>
              </div>
            </div>

            {busyId === 'suite-self' && (
              <div className="ac-progress-wrap" style={{ margin: 0 }}>
                <div className="ac-progress-text">
                  <span>
                    {suiteProg ? `${formatMb(suiteProg.downloaded)} MB` : '0.0 MB'}
                    {suiteProg && suiteProg.total > 0 ? ` / ${formatMb(suiteProg.total)} MB` : ''}
                  </span>
                  <span>
                    {suiteProg && suiteProg.total > 0
                      ? `${Math.min(100, Math.round((suiteProg.downloaded / suiteProg.total) * 100))}%`
                      : '...'}
                  </span>
                </div>
                <div className="ac-progress-track">
                  <div
                    className="ac-progress-bar"
                    style={{
                      width: `${
                        suiteProg && suiteProg.total > 0
                          ? Math.min(100, Math.round((suiteProg.downloaded / suiteProg.total) * 100))
                          : 20
                      }%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Info Banner */}
        {bannerText && (
          <div className="ac-banner info">
            <div className="ac-banner-left">
              <span className="ac-banner-pill">STATUS</span>
              <span>{bannerText}</span>
            </div>
            <button
              type="button"
              className="ac-banner-close"
              onClick={() => setBannerText(null)}
            >
              <X size={14} />
            </button>
          </div>
        )}

        {showConfig && (
          <div className="ac-modal-backdrop" onClick={() => setShowConfig(false)}>
            <div className="ac-modal ac-settings-modal" onClick={(e) => e.stopPropagation()}>
              <div className="ac-modal-head">
                <div className="ac-modal-tabs">
                  <button
                    type="button"
                    className={settingsTab === 'general' ? 'active' : ''}
                    onClick={() => setSettingsTab('general')}
                  >
                    {locale === 'pt-BR' ? 'GERAL & APARÊNCIA' : 'GENERAL & APPEARANCE'}
                  </button>
                  <button
                    type="button"
                    className={settingsTab === 'updates' ? 'active' : ''}
                    onClick={() => setSettingsTab('updates')}
                  >
                    {locale === 'pt-BR' ? 'ATUALIZAÇÕES' : 'UPDATES'}
                  </button>
                  <button
                    type="button"
                    className={settingsTab === 'storage' ? 'active' : ''}
                    onClick={() => {
                      setSettingsTab('storage');
                      void refreshCacheInfo();
                    }}
                  >
                    {locale === 'pt-BR' ? 'DOWNLOADS & CACHE' : 'DOWNLOADS & CACHE'}
                  </button>
                  <button
                    type="button"
                    className={settingsTab === 'about' ? 'active' : ''}
                    onClick={() => setSettingsTab('about')}
                  >
                    {locale === 'pt-BR' ? 'SOBRE & LOGS' : 'ABOUT & LOGS'}
                  </button>
                </div>
                <button
                  type="button"
                  className="ac-banner-close"
                  onClick={() => setShowConfig(false)}
                >
                  <X size={14} />
                </button>
              </div>

              <div className="ac-modal-body ac-settings-body">
                {settingsTab === 'general' && (
                  <div className="ac-settings-grid">
                    <label className="ac-settings-field">
                      <span>{locale === 'pt-BR' ? 'Idioma da interface' : 'Interface language'}</span>
                      <select
                        className="ac-select"
                        value={locale}
                        onChange={(e) => {
                          const next = e.target.value as SuiteLocale;
                          setLocale(next);
                          saveSuiteLocale(next);
                        }}
                      >
                        <option value="pt-BR">Português (Brasil)</option>
                        <option value="en">English (US)</option>
                      </select>
                    </label>

                    <label className="ac-settings-field">
                      <span>{locale === 'pt-BR' ? 'Tema visual' : 'Visual theme'}</span>
                      <select
                        className="ac-select"
                        value={theme}
                        onChange={(e) => setTheme(e.target.value as 'light' | 'dark')}
                      >
                        <option value="light">{locale === 'pt-BR' ? 'Claro (ArtCraft)' : 'Light (ArtCraft)'}</option>
                        <option value="dark">{locale === 'pt-BR' ? 'Escuro' : 'Dark'}</option>
                      </select>
                    </label>

                    <label className="ac-settings-field">
                      <span>{locale === 'pt-BR' ? 'Ordenação padrão dos apps' : 'Default app sorting'}</span>
                      <select
                        className="ac-select"
                        value={sortBy}
                        onChange={(e) => {
                          const next = e.target.value as 'name' | 'status';
                          setSortBy(next);
                          localStorage.setItem(SORT_KEY, next);
                        }}
                      >
                        <option value="name">{t('sortName')}</option>
                        <option value="status">{t('sortStatus')}</option>
                      </select>
                    </label>

                    <label className="ac-settings-field">
                      <span>{locale === 'pt-BR' ? 'Formato padrão de instalador' : 'Default installer format'}</span>
                      <select
                        className="ac-select"
                        value={installerFormat}
                        onChange={(e) => {
                          const fmt = e.target.value as 'msi' | 'exe' | 'deb' | 'appimage';
                          setInstallerFormat(fmt);
                          localStorage.setItem('forjatex_suite_installer_fmt_v1', fmt);
                        }}
                      >
                        {isLinux ? (
                          <>
                            <option value="deb">.DEB (Ubuntu/Debian)</option>
                            <option value="appimage">.AppImage</option>
                          </>
                        ) : (
                          <>
                            <option value="msi">.MSI (Windows Installer)</option>
                            <option value="exe">.EXE (NSIS)</option>
                          </>
                        )}
                      </select>
                    </label>
                  </div>
                )}

                {settingsTab === 'updates' && (
                  <div className="ac-settings-stack">
                    <label className="ac-settings-field">
                      <span>{t('manifestUrlLabel')}</span>
                      <input
                        type="text"
                        className="ac-settings-input"
                        value={manifestUrl}
                        onChange={(e) => {
                          setManifestUrl(e.target.value);
                          localStorage.setItem(MANIFEST_KEY, e.target.value);
                        }}
                      />
                    </label>

                    <label className="ac-settings-field">
                      <span>
                        {locale === 'pt-BR'
                          ? 'Frequência de verificação automática'
                          : 'Automatic update check frequency'}
                      </span>
                      <select
                        className="ac-select"
                        value={autoCheckMin}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setAutoCheckMin(val);
                          localStorage.setItem(AUTOCHECK_MIN_KEY, String(val));
                        }}
                      >
                        <option value={5}>{locale === 'pt-BR' ? 'Ao iniciar + a cada 5 minutos' : 'On launch + every 5 minutes'}</option>
                        <option value={15}>{locale === 'pt-BR' ? 'Ao iniciar + a cada 15 minutos (Padrão)' : 'On launch + every 15 minutes (Default)'}</option>
                        <option value={60}>{locale === 'pt-BR' ? 'Ao iniciar + a cada 60 minutos' : 'On launch + every 60 minutes'}</option>
                        <option value={0}>{locale === 'pt-BR' ? 'Apenas ao iniciar o Suite' : 'Only on Suite launch'}</option>
                      </select>
                    </label>

                    <div className="ac-settings-row">
                      <span className="ac-donate-desc">
                        {locale === 'pt-BR' ? 'Última verificação:' : 'Last checked:'} <strong>{lastChecked}</strong>
                      </span>
                      <button
                        type="button"
                        className="ac-btn-dark"
                        onClick={() => {
                          void handleCheckUpdates();
                        }}
                      >
                        {t('saveSync')}
                      </button>
                    </div>
                  </div>
                )}

                {settingsTab === 'storage' && (
                  <div className="ac-settings-stack">
                    <label className="ac-settings-field">
                      <span>
                        {locale === 'pt-BR'
                          ? 'Pasta de download dos instaladores (vazio = pasta temporária do sistema)'
                          : 'Installer download folder (empty = system temp directory)'}
                      </span>
                      <div className="ac-settings-row">
                        <input
                          type="text"
                          className="ac-settings-input"
                          placeholder={cacheInfo?.cache_dir || '%TEMP%\\forjatex-suite'}
                          value={downloadDir}
                          onChange={(e) => {
                            setDownloadDir(e.target.value);
                            localStorage.setItem(DOWNLOAD_DIR_KEY, e.target.value);
                          }}
                          onBlur={() => void refreshCacheInfo()}
                        />
                        <button
                          type="button"
                          className="ac-btn-dark"
                          onClick={() => {
                            setDownloadDir('');
                            localStorage.removeItem(DOWNLOAD_DIR_KEY);
                            void refreshCacheInfo('');
                          }}
                        >
                          {locale === 'pt-BR' ? 'Padrão' : 'Default'}
                        </button>
                      </div>
                    </label>

                    <div className="ac-settings-cache-box">
                      <div>
                        <strong>{locale === 'pt-BR' ? 'Cache de instaladores' : 'Installer cache'}</strong>
                        <div className="ac-donate-desc">
                          {cacheInfo
                            ? `${cacheInfo.file_count} arquivo(s) · ${formatMb(cacheInfo.total_bytes)} MB em ${cacheInfo.cache_dir}`
                            : '...'}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="ac-btn-dark"
                        onClick={async () => {
                          try {
                            const freed = await invoke<number>('clear_installer_cache', {
                              downloadDir: downloadDir.trim() || null,
                            });
                            await refreshCacheInfo();
                            setBannerText(
                              locale === 'pt-BR'
                                ? `Cache limpo (${formatMb(freed)} MB liberados).`
                                : `Cache cleared (${formatMb(freed)} MB freed).`
                            );
                          } catch (e) {
                            setBannerText(String(e));
                          }
                        }}
                      >
                        {locale === 'pt-BR' ? 'Limpar Cache' : 'Clear Cache'}
                      </button>
                    </div>
                  </div>
                )}

                {settingsTab === 'about' && (
                  <div className="ac-settings-stack">
                    <div className="ac-settings-cache-box">
                      <div>
                        <strong>ForjaTeX App Suite v{suiteVersion}</strong>
                        <div className="ac-donate-desc">
                          {locale === 'pt-BR' ? 'Sistema detectado:' : 'Detected OS:'}{' '}
                          <strong>{isLinux ? 'Linux' : 'Windows'}</strong> · GNU GPL v3.0
                        </div>
                      </div>
                      <button
                        type="button"
                        className="ac-action-main"
                        style={{ flex: 'none', padding: '0 12px', height: 30 }}
                        onClick={() =>
                          window.open(
                            locale === 'pt-BR' ? '/manuals/manual-pt-BR.pdf' : '/manuals/manual-en-US.pdf',
                            '_blank'
                          )
                        }
                      >
                        {locale === 'pt-BR' ? 'MANUAL (PDF · PT-BR)' : 'MANUAL (PDF · EN-US)'}
                      </button>
                    </div>

                    <div className="ac-settings-row" style={{ flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="ac-btn-dark"
                        onClick={() => open('https://forjatex.com.br')}
                      >
                        forjatex.com.br
                      </button>
                      <button
                        type="button"
                        className="ac-btn-dark"
                        onClick={() => open(`${GITHUB_REPO_URL}/releases`)}
                      >
                        GitHub Releases
                      </button>
                      <button
                        type="button"
                        className="ac-btn-dark"
                        onClick={() => open(DISCORD_INVITE_URL)}
                      >
                        Discord
                      </button>
                    </div>

                    <div className="ac-donate-desc">
                      {apps
                        .filter((a) => !a.comingSoon)
                        .map((a) => {
                          const inst = installedMap[a.id];
                          return `${a.name}: ${
                            inst?.installed ? `v${inst.version} (${inst.exe_path})` : 'não instalado'
                          }`;
                        })
                        .join(' | ')}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Filter / Sort Toolbar */}
        <div className="ac-toolbar">
          <button
            type="button"
            className="ac-square-btn"
            onClick={handleCheckUpdates}
            title="Verificar atualizações"
          >
            <RefreshCw size={14} className={busyId === 'manifest' ? 'spin' : ''} />
          </button>

          <div className="ac-toolbar-right">
            <span className="ac-sort-label">{t('installer')}</span>
            <select
              className="ac-select"
              value={installerFormat}
              onChange={(e) => {
                const fmt = e.target.value as 'msi' | 'exe' | 'deb' | 'appimage';
                setInstallerFormat(fmt);
                localStorage.setItem('forjatex_suite_installer_fmt_v1', fmt);
              }}
              title="Escolha o formato padrão dos instaladores baixados pelo Suite"
            >
              {isLinux ? (
                <>
                  <option value="deb">.DEB (Ubuntu/Debian)</option>
                  <option value="appimage">.AppImage</option>
                </>
              ) : (
                <>
                  <option value="msi">.MSI</option>
                  <option value="exe">.EXE (NSIS)</option>
                </>
              )}
            </select>
            <span className="ac-sort-label">{t('sort')}</span>
            <select
              className="ac-select"
              value={sortBy}
              onChange={(e) => {
                const next = e.target.value as 'name' | 'status';
                setSortBy(next);
                localStorage.setItem(SORT_KEY, next);
              }}
            >
              <option value="name">{t('sortName')}</option>
              <option value="status">{t('sortStatus')}</option>
            </select>
            <input
              type="text"
              className="ac-search"
              placeholder={t('searchPlaceholder')}
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

        {/* Uniform Fixed-Area Grid / List */}
        <main className={viewMode === 'grid' ? 'ac-grid' : 'ac-list'}>
          {filteredApps.map((app) => {
            const info = installedMap[app.id];
            const isInstalled = Boolean(info?.installed);
            const installedVer = info?.version || app.latestVersion;
            const hasUpdate =
              isInstalled &&
              Boolean(info?.version) &&
              compareSemver(app.latestVersion, installedVer) > 0;
            const prog = progressMap[app.id];
            const pct =
              prog && prog.total > 0 ? Math.min(100, Math.round((prog.downloaded / prog.total) * 100)) : 0;

            return (
              <article
                key={app.id}
                className={`ac-card ${isInstalled ? 'installed' : ''} ${app.comingSoon ? 'soon' : ''}`}
              >
                <div className="ac-card-meta">
                  <span className="ac-version" style={{ color: app.accentColor }}>
                    V{isInstalled ? installedVer : app.latestVersion}
                    {hasUpdate && <span className="ac-upd-chip"> → V{app.latestVersion}</span>}
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

                {busyId === app.id && prog && (
                  <div className="ac-progress-wrap">
                    <div className="ac-progress-text">
                      <span>
                        {formatMb(prog.downloaded)} MB
                        {prog.total > 0 ? ` / ${formatMb(prog.total)} MB` : ''}
                      </span>
                      {prog.total > 0 && <span>{pct}%</span>}
                    </div>
                    <div className="ac-progress-track">
                      <div className="ac-progress-bar" style={{ width: `${pct || 20}%` }} />
                    </div>
                  </div>
                )}

                  <div className="ac-card-actions">
                  {app.comingSoon ? (
                    <button type="button" className="ac-action-main" disabled>
                      {t('comingSoon')}
                    </button>
                  ) : isInstalled && hasUpdate ? (
                    <>
                      <button
                        type="button"
                        className="ac-action-main"
                        onClick={() => handleLaunch(app)}
                      >
                        {t('open')}
                      </button>
                      <button
                        type="button"
                        className="ac-action-main update"
                        disabled={busyId === app.id}
                        onClick={() => handleInstallOrUpdate(app, true)}
                      >
                        {busyId === app.id ? t('updating') : `${t('updateTo')} V${app.latestVersion}`}
                      </button>
                    </>
                  ) : hasUpdate ? (
                    <button
                      type="button"
                      className="ac-action-main update"
                      disabled={busyId === app.id}
                      onClick={() => handleInstallOrUpdate(app, true)}
                    >
                      {busyId === app.id ? t('updating') : `${t('updateTo')} V${app.latestVersion}`}
                    </button>
                  ) : isInstalled ? (
                    <button
                      type="button"
                      className="ac-action-main"
                      onClick={() => handleLaunch(app)}
                    >
                      {t('open')}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="ac-action-main"
                      disabled={busyId === app.id}
                      onClick={() => handleInstallOrUpdate(app, true)}
                    >
                      {busyId === app.id ? t('downloading') : t('install')}
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
                          {isInstalled && (
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuId(null);
                                handleLaunch(app);
                              }}
                            >
                              Abrir aplicativo
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null);
                              handleInstallOrUpdate(app, true);
                            }}
                          >
                            Reinstalar / Atualizar (v{app.latestVersion})
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
      </div>

      <footer className="ac-footer">
        <div className="ac-footer-inner">
          <span>
            VERIFICADO {lastChecked.toUpperCase()} · POR{' '}
            <button
              type="button"
              className="ac-link-upper"
              onClick={() => open('https://jeanpimenta.com.br')}
            >
              JEAN PIMENTA
            </button>{' '}
            ·{' '}
            <button
              type="button"
              className="ac-link-upper"
              onClick={() => open('https://arkhecode.com.br')}
            >
              ARKHÉ CODE <ArrowUpRight size={10} />
            </button>
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="ac-link-upper"
              onClick={() => open('https://forjatex.com.br')}
            >
              FORJATEX.COM.BR <ArrowUpRight size={11} />
            </button>
            <button
              type="button"
              className="ac-link-upper"
              onClick={() => open(GITHUB_REPO_URL)}
            >
              GITHUB <ArrowUpRight size={11} />
            </button>
          </div>
        </div>
      </footer>

      {donateOpen && (
        <div className="ac-modal-backdrop" onClick={() => setDonateOpen(false)}>
          <div className="ac-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ac-modal-head">
              <div className="ac-modal-tabs">
                <button
                  type="button"
                  className={donateTab === 'donate' ? 'active' : ''}
                  onClick={() => setDonateTab('donate')}
                >
                  Apoiar (Pix / PayPal)
                </button>
                <button
                  type="button"
                  className={donateTab === 'feedback' ? 'active' : ''}
                  onClick={() => setDonateTab('feedback')}
                >
                  Pedidos &amp; Bugs
                </button>
              </div>
              <button type="button" className="ac-icon-btn" onClick={() => setDonateOpen(false)}>
                <X size={14} />
              </button>
            </div>
            <div className="ac-modal-body">
              {donateTab === 'donate' ? (
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
              ) : (
                <div className="ac-fb-form">
                  <div className="ac-donate-btns">
                    <button
                      type="button"
                      className={fbKind === 'feature' ? 'ac-btn-dark' : 'ac-action-main'}
                      onClick={() => setFbKind('feature')}
                    >
                      Sugerir Recurso
                    </button>
                    <button
                      type="button"
                      className={fbKind === 'bug' ? 'ac-btn-dark' : 'ac-action-main'}
                      onClick={() => setFbKind('bug')}
                    >
                      Reportar Erro
                    </button>
                  </div>
                  <input
                    type="text"
                    className="ac-fb-input"
                    placeholder="Resumo do pedido ou erro..."
                    value={fbTitle}
                    onChange={(e) => setFbTitle(e.target.value)}
                  />
                  <textarea
                    rows={4}
                    className="ac-fb-input"
                    placeholder={t('fbDetailsPh')}
                    value={fbDetails}
                    onChange={(e) => setFbDetails(e.target.value)}
                  />
                  <input
                    type="email"
                    className="ac-fb-input"
                    placeholder="E-mail opcional (para retorno)..."
                    value={fbContact}
                    onChange={(e) => setFbContact(e.target.value)}
                  />
                  {fbStatus && <div className="ac-donate-desc">{fbStatus}</div>}
                  <div className="ac-donate-btns">
                    <button
                      type="button"
                      className="ac-btn-dark"
                      disabled={fbSending || !fbTitle.trim() || !fbDetails.trim()}
                      onClick={async () => {
                        setFbSending(true);
                        setFbStatus(null);
                        try {
                          const r = await fetch('https://forjatex.com.br/wp-json/forjatex/v1/feedback', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              app: 'ForjaTeX Suite',
                              version: suiteVersion,
                              kind: fbKind,
                              title: fbTitle.trim(),
                              details: fbDetails.trim(),
                              contact: fbContact.trim(),
                              locale,
                              client_ts: new Date().toISOString(),
                            }),
                          });
                          if (!r.ok) throw new Error(`HTTP ${r.status}`);
                          setFbStatus('Enviado para forjatex.com.br! Obrigado.');
                          setFbTitle('');
                          setFbDetails('');
                        } catch (e) {
                          setFbStatus(`Erro ao enviar (${String(e)}). Tente GitHub ou E-mail.`);
                        } finally {
                          setFbSending(false);
                        }
                      }}
                    >
                      {fbSending ? '...' : 'ENVIAR (SITE)'}
                    </button>
                    <button
                      type="button"
                      className="ac-action-main"
                      onClick={() => {
                        const body = `[${fbKind === 'bug' ? 'BUG' : 'FEATURE'}] ${fbTitle}\nApp: ForjaTeX Suite v${suiteVersion}\n---\n${fbDetails}`;
                        const p = new URLSearchParams({
                          title: `[${fbKind === 'bug' ? 'Bug' : 'Feature'}][Suite] ${fbTitle || 'Relatório'}`,
                          body,
                          labels: fbKind === 'bug' ? 'bug' : 'enhancement',
                        });
                        open(`${GITHUB_REPO_URL}/issues/new?${p.toString()}`);
                      }}
                    >
                      GITHUB
                    </button>
                    <button
                      type="button"
                      className="ac-action-main"
                      onClick={() => {
                        const body = `[${fbKind === 'bug' ? 'BUG' : 'FEATURE'}] ${fbTitle}\nApp: ForjaTeX Suite v${suiteVersion}\n---\n${fbDetails}`;
                        const p = new URLSearchParams({
                          subject: `[ForjaTeX Suite] ${fbTitle || 'Relatório'}`,
                          body,
                        });
                        open(`mailto:${PAYPAL_EMAIL}?${p.toString()}`);
                      }}
                    >
                      E-MAIL
                    </button>
                    <button
                      type="button"
                      className="ac-action-main"
                      onClick={async () => {
                        const body = `[${fbKind === 'bug' ? 'BUG' : 'FEATURE'}] ${fbTitle}\nApp: ForjaTeX Suite v${suiteVersion}\n---\n${fbDetails}`;
                        await navigator.clipboard.writeText(body);
                        setCopyTag('fb');
                        setTimeout(() => setCopyTag(null), 2000);
                      }}
                    >
                      {copyTag === 'fb' ? 'COPIADO!' : 'COPIAR'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
