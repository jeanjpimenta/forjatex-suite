import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from './i18n';
import {
  Play,
  Settings,
  Sparkles,
  Heart,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Eraser,
  FolderPlus,
  FolderOpen,
  Plus,
  X,
  Sun,
  Moon,
  BookOpen,
  FileArchive,
} from 'lucide-react';
import { ExplorerSidebar } from './components/ExplorerSidebar';
import { EditorPane } from './components/EditorPane';
import { AiPromptPane } from './components/AiPromptPane';
import { PdfPreviewPane } from './components/PdfPreviewPane';
import { SettingsModal } from './components/SettingsModal';
import { FeedbackDonateModal } from './components/FeedbackDonateModal';
import { TableWizardModal } from './components/TableWizardModal';
import { MathSymbolsModal } from './components/MathSymbolsModal';
import { NewProjectModal } from './components/NewProjectModal';
import { BibWizardModal } from './components/BibWizardModal';
import { MatrixPreambleModal } from './components/MatrixPreambleModal';
import { UserTagsScriptsModal } from './components/UserTagsScriptsModal';
import { FontWizardModal } from './components/FontWizardModal';
import { ImageWizardModal } from './components/ImageWizardModal';
import { QuickRefModal } from './components/QuickRefModal';
import type {
  AISettings,
  CompilerDistribution,
  CompilerEngine,
  CompilerInfo,
  CompilerSettings,
  FileNode,
  KeyShortcuts,
  OpenTab,
  QuickBuildProfile,
  UserTag,
  WorkspaceSession,
} from './types/ide';
import {
  cleanAuxiliaryFiles,
  compileLatex,
  createProjectEntry,
  detectCompilers,
  importOverleafZip,
  installTexPackage,
  isTauriRuntime,
  loadExistingPdf,
  pickProjectFolder,
  pickZipFile,
  readProjectFile,
  scanProject,
  scanProjectSymbols,
  synctexForward,
  synctexLookup,
  writeProjectFile,
} from './utils/tauriBridge';

const STORAGE_COMPILER_KEY = 'texforge_compiler_settings_v1';
const STORAGE_AI_KEY = 'texforge_ai_settings_v1';
const STORAGE_LAYOUT_KEY = 'forjatex_layout_v1';
const STORAGE_WORKSPACES_KEY = 'forjatex_workspaces_v2';
const STORAGE_USER_TAGS_KEY = 'forjatex_user_tags_v1';
const STORAGE_THEME_KEY = 'forjatex_theme_v1';
const STORAGE_SHORTCUTS_KEY = 'forjatex_shortcuts_v1';
const STORAGE_QUICK_BUILDS_KEY = 'forjatex_quick_builds_v1';

const DEFAULT_QUICK_BUILDS: QuickBuildProfile[] = [
  { id: 'pdflatex-bibtex', name: 'PdfLaTeX + BibTeX', steps: ['pdflatex', 'bibtex', 'pdflatex', 'pdflatex'] },
  { id: 'xelatex-biber', name: 'XeLaTeX + Biber', steps: ['xelatex', 'biber', 'xelatex', 'xelatex'] },
  { id: 'lualatex-biber', name: 'LuaLaTeX + Biber', steps: ['lualatex', 'biber', 'lualatex', 'lualatex'] },
];

const DEFAULT_COMPILER_SETTINGS: CompilerSettings = {
  distribution: 'auto',
  engine: 'pdflatex',
  customBinDir: '',
  miktexBinDir: '',
  texliveBinDir: '',
  tectonicBinDir: '',
  autoCompileOnSave: false,
  useBuildDir: false,
  autoRunBib: true,
  autoSaveIntervalSec: 0,
  quickBuildPreset: 'auto',
  customQuickBuildSteps: [],
};

const DEFAULT_SHORTCUTS: KeyShortcuts = {
  compile: 'Ctrl+B',
  quickRef: 'F1',
  symbols: 'Ctrl+Shift+M',
  tables: 'Ctrl+Shift+T',
};

const DEFAULT_AI_SETTINGS: AISettings = {
  enabled: false,
  provider: 'gemini',
  apiKey: '',
  model: 'gemini-2.5-flash',
  customEndpoint: '',
};

function createEmptyWorkspace(id = `ws-${Date.now()}`): WorkspaceSession {
  return {
    id,
    name: 'Novo Espaço',
    projectDir: null,
    mainFile: 'main.tex',
    tree: [],
    tabs: [],
    activeTabPath: null,
    highlightedFile: null,
    projectIndex: { bib_keys: [], labels: [], outline: [] },
    pdfBase64: null,
    synctexAvailable: false,
    diagnostics: [],
    compileDuration: null,
  };
}

function findFirstMainTex(nodes: FileNode[]): string {
  for (const n of nodes) {
    if (!n.is_dir && n.name.toLowerCase() === 'main.tex') {
      return n.relative_path;
    }
  }
  for (const n of nodes) {
    if (!n.is_dir && n.extension === 'tex') {
      return n.relative_path;
    }
    if (n.is_dir && n.children) {
      const nested = findFirstMainTex(n.children);
      if (nested) return nested;
    }
  }
  return 'main.tex';
}

function findNodeByPath(nodes: FileNode[], target: string): FileNode | null {
  for (const n of nodes) {
    if (n.path === target || n.relative_path === target) return n;
    if (n.is_dir && n.children) {
      const found = findNodeByPath(n.children, target);
      if (found) return found;
    }
  }
  return null;
}

function collectTexFiles(nodes: FileNode[]): string[] {
  const result: string[] = [];
  for (const n of nodes) {
    if (!n.is_dir && n.extension === 'tex') {
      result.push(n.relative_path);
    } else if (n.is_dir && n.children) {
      result.push(...collectTexFiles(n.children));
    }
  }
  return result;
}

export function App() {
  const [workspaces, setWorkspaces] = useState<WorkspaceSession[]>(() => [
    createEmptyWorkspace('ws-initial'),
  ]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>('ws-initial');

  const activeWs =
    workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];

  const updateWorkspace = useCallback(
    (wsId: string, updater: (prev: WorkspaceSession) => WorkspaceSession) => {
      setWorkspaces((prev) => prev.map((w) => (w.id === wsId ? updater(w) : w)));
    },
    []
  );

  const [isCompiling, setIsCompiling] = useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);

  const [detectedCompilers, setDetectedCompilers] = useState<CompilerInfo[]>([]);
  const [compilerSettings, setCompilerSettings] = useState<CompilerSettings>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_COMPILER_KEY);
      return raw ? { ...DEFAULT_COMPILER_SETTINGS, ...JSON.parse(raw) } : DEFAULT_COMPILER_SETTINGS;
    } catch {
      return DEFAULT_COMPILER_SETTINGS;
    }
  });
  const [aiSettings, setAiSettings] = useState<AISettings>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_AI_KEY);
      return raw ? { ...DEFAULT_AI_SETTINGS, ...JSON.parse(raw) } : DEFAULT_AI_SETTINGS;
    } catch {
      return DEFAULT_AI_SETTINGS;
    }
  });

  const splitContainerRef = useRef<HTMLDivElement | null>(null);

  const [leftWidthPx, setLeftWidthPx] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_LAYOUT_KEY);
      return raw ? JSON.parse(raw).leftWidthPx ?? 260 : 260;
    } catch {
      return 260;
    }
  });
  const [rightWidthPct, setRightWidthPct] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_LAYOUT_KEY);
      return raw ? JSON.parse(raw).rightWidthPct ?? 40 : 40;
    } catch {
      return 40;
    }
  });
  const workspaceRef = useRef<HTMLElement | null>(null);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'compiler' | 'editor' | 'ai' | 'git'>('compiler');
  const [rightTab, setRightTab] = useState<'pdf' | 'ai'>('pdf');
  const { t } = useI18n();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [tableWizardOpen, setTableWizardOpen] = useState(false);
  const [mathSymbolsOpen, setMathSymbolsOpen] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [bibWizardOpen, setBibWizardOpen] = useState(false);
  const [matrixPreambleOpen, setMatrixPreambleOpen] = useState(false);
  const [tagsScriptsOpen, setTagsScriptsOpen] = useState(false);
  const [fontWizardOpen, setFontWizardOpen] = useState(false);
  const [imageWizardOpen, setImageWizardOpen] = useState(false);
  const [quickRefOpen, setQuickRefOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem(STORAGE_THEME_KEY);
    return saved === 'light' ? 'light' : 'dark';
  });
  const [shortcuts, setShortcuts] = useState<KeyShortcuts>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_SHORTCUTS_KEY);
      return raw ? { ...DEFAULT_SHORTCUTS, ...JSON.parse(raw) } : DEFAULT_SHORTCUTS;
    } catch {
      return DEFAULT_SHORTCUTS;
    }
  });
  const [quickBuildProfiles, setQuickBuildProfiles] = useState<QuickBuildProfile[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_QUICK_BUILDS_KEY);
      return raw ? JSON.parse(raw) : DEFAULT_QUICK_BUILDS;
    } catch {
      return DEFAULT_QUICK_BUILDS;
    }
  });
  const [compileMenu, setCompileMenu] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_QUICK_BUILDS_KEY, JSON.stringify(quickBuildProfiles));
  }, [quickBuildProfiles]);

  useEffect(() => {
    if (!compileMenu) return;
    const close = () => setCompileMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [compileMenu]);

  useEffect(() => {
    localStorage.setItem(STORAGE_THEME_KEY, theme);
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(STORAGE_SHORTCUTS_KEY, JSON.stringify(shortcuts));
  }, [shortcuts]);
  const [userTags, setUserTags] = useState<UserTag[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_USER_TAGS_KEY);
      return raw
        ? JSON.parse(raw)
        : [
          {
            id: 'tag-default-1',
            trigger: ':eq',
            label: 'Equação numerada',
            snippet: '\\begin{equation}\n  $1\n  \\label{eq:$2}\n\\end{equation}',
          },
        ];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_USER_TAGS_KEY, JSON.stringify(userTags));
  }, [userTags]);
  const [pendingInsert, setPendingInsert] = useState<{ text: string; nonce: number } | null>(null);
  const [scrollToPage, setScrollToPage] = useState<{ page: number; nonce: number } | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_LAYOUT_KEY, JSON.stringify({ leftWidthPx, rightWidthPct }));
  }, [leftWidthPx, rightWidthPct]);

  useEffect(() => {
    localStorage.setItem(STORAGE_COMPILER_KEY, JSON.stringify(compilerSettings));
  }, [compilerSettings]);

  useEffect(() => {
    localStorage.setItem(STORAGE_AI_KEY, JSON.stringify(aiSettings));
  }, [aiSettings]);

  const refreshCompilers = useCallback(async () => {
    try {
      const list = await detectCompilers();
      setDetectedCompilers(list);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    refreshCompilers();
  }, [refreshCompilers]);

  // Persist all open workspaces
  useEffect(() => {
    const serializable = workspaces
      .filter((w) => w.projectDir)
      .map((w) => ({
        id: w.id,
        name: w.name,
        projectDir: w.projectDir,
        mainFile: w.mainFile,
        quickBuildId: w.quickBuildId ?? null,
        openRelPaths: w.tabs.map((t) => t.relative_path),
        activeRelPath: w.tabs.find((t) => t.path === w.activeTabPath)?.relative_path || null,
      }));
    if (serializable.length > 0) {
      localStorage.setItem(
        STORAGE_WORKSPACES_KEY,
        JSON.stringify({ activeWorkspaceId, workspaces: serializable })
      );
    }
  }, [workspaces, activeWorkspaceId]);

  const hydrateWorkspaceFromDisk = useCallback(
    async (
      wsId: string,
      dir: string,
      preferredMain?: string,
      openRels?: string[],
      activeRel?: string | null,
      quickBuildId?: string | null
    ) => {
      const [nodes, idx] = await Promise.all([
        scanProject(dir),
        scanProjectSymbols(dir).catch(() => ({ bib_keys: [], labels: [], outline: [] })),
      ]);

      const mainTex =
        preferredMain && findNodeByPath(nodes, preferredMain)
          ? preferredMain
          : findFirstMainTex(nodes);

      const relsToOpen = openRels && openRels.length > 0 ? openRels : [mainTex];
      const restoredTabs: OpenTab[] = [];
      for (const rel of relsToOpen) {
        const node = findNodeByPath(nodes, rel);
        if (!node || node.is_dir) continue;
        try {
          const res = await readProjectFile(node.path);
          restoredTabs.push({
            path: node.path,
            relative_path: node.relative_path,
            name: node.name,
            extension: node.extension,
            is_binary: res.is_binary,
            mime_type: res.mime_type,
            content: res.content,
            saved_content: res.content,
            dirty: false,
          });
        } catch {
          // ignore unreadable
        }
      }

      const existingPdf = await loadExistingPdf(dir, mainTex).catch(() => null);
      const activeMatch = restoredTabs.find((t) => t.relative_path === activeRel);

      updateWorkspace(wsId, (w) => ({
        ...w,
        name: dir.split(/[\\/]/).pop() || dir,
        projectDir: dir,
        mainFile: mainTex,
        quickBuildId: quickBuildId ?? null,
        tree: nodes,
        projectIndex: idx,
        tabs: restoredTabs,
        activeTabPath: activeMatch ? activeMatch.path : restoredTabs[0]?.path ?? null,
        pdfBase64: existingPdf?.pdf_base64 ?? null,
        synctexAvailable: existingPdf?.synctex_available ?? false,
        diagnostics: [],
      }));
    },
    [updateWorkspace]
  );

  // Restore workspaces on startup
  useEffect(() => {
    if (!isTauriRuntime()) return;
    const raw = localStorage.getItem(STORAGE_WORKSPACES_KEY);
    if (!raw) return;

    (async () => {
      try {
        const parsed = JSON.parse(raw) as {
          activeWorkspaceId?: string;
          workspaces?: Array<{
            id: string;
            name: string;
            projectDir: string;
            mainFile?: string;
            quickBuildId?: string | null;
            openRelPaths?: string[];
            activeRelPath?: string | null;
          }>;
        };
        if (!parsed.workspaces || parsed.workspaces.length === 0) return;

        const validShells = parsed.workspaces.map((s) => createEmptyWorkspace(s.id));
        setWorkspaces(validShells);
        setActiveWorkspaceId(parsed.activeWorkspaceId || validShells[0].id);

        for (const s of parsed.workspaces) {
          try {
            await hydrateWorkspaceFromDisk(
              s.id,
              s.projectDir,
              s.mainFile,
              s.openRelPaths,
              s.activeRelPath,
              s.quickBuildId
            );
          } catch {
            // skip missing folder
          }
        }
      } catch {
        // ignore
      }
    })();
  }, [hydrateWorkspaceFromDisk]);

  // Reload PDF if mainFile changes within active workspace
  const handleSetMainFile = useCallback(
    async (relPath: string) => {
      const wsId = activeWs.id;
      const dir = activeWs.projectDir;
      updateWorkspace(wsId, (w) => ({ ...w, mainFile: relPath }));
      if (dir && isTauriRuntime()) {
        const existing = await loadExistingPdf(dir, relPath).catch(() => null);
        updateWorkspace(wsId, (w) => ({
          ...w,
          pdfBase64: existing?.pdf_base64 ?? null,
          synctexAvailable: existing?.synctex_available ?? false,
        }));
      }
    },
    [activeWs.id, activeWs.projectDir, updateWorkspace]
  );

  const handleOpenFolder = async (inNewTab = false) => {
    if (!isTauriRuntime()) {
      alert('A abertura de pastas locais funciona no aplicativo desktop ForjaTeX (Tauri).');
      return;
    }
    const dir = await pickProjectFolder();
    if (!dir) return;

    if (inNewTab || activeWs.projectDir) {
      const existingWs = workspaces.find((w) => w.projectDir === dir);
      if (existingWs) {
        setActiveWorkspaceId(existingWs.id);
        return;
      }
      const newWs = createEmptyWorkspace();
      setWorkspaces((prev) => [...prev, newWs]);
      setActiveWorkspaceId(newWs.id);
      await hydrateWorkspaceFromDisk(newWs.id, dir);
    } else {
      await hydrateWorkspaceFromDisk(activeWs.id, dir);
    }
  };

  const handleRefreshTree = async () => {
    if (!activeWs.projectDir) return;
    const [nodes, idx] = await Promise.all([
      scanProject(activeWs.projectDir),
      scanProjectSymbols(activeWs.projectDir).catch(() => ({
        bib_keys: [],
        labels: [],
        outline: [],
      })),
    ]);
    updateWorkspace(activeWs.id, (w) => ({ ...w, tree: nodes, projectIndex: idx }));
  };

  const openFileNode = useCallback(
    async (node: FileNode, jumpToLine?: number) => {
      if (node.is_dir) return;
      const wsId = activeWs.id;
      const existing = activeWs.tabs.find((t) => t.path === node.path);
      if (existing) {
        updateWorkspace(wsId, (w) => ({
          ...w,
          activeTabPath: node.path,
          tabs: jumpToLine
            ? w.tabs.map((t) => (t.path === node.path ? { ...t, jumpToLine } : t))
            : w.tabs,
        }));
        return;
      }

      const res = await readProjectFile(node.path);
      const newTab: OpenTab = {
        path: node.path,
        relative_path: node.relative_path,
        name: node.name,
        extension: node.extension,
        is_binary: res.is_binary,
        mime_type: res.mime_type,
        content: res.content,
        saved_content: res.content,
        dirty: false,
        jumpToLine,
      };
      updateWorkspace(wsId, (w) => ({
        ...w,
        tabs: [...w.tabs, newTab],
        activeTabPath: node.path,
      }));
    },
    [activeWs.id, activeWs.tabs, updateWorkspace]
  );

  const handleCompile = useCallback(async () => {
    const ws = activeWs;
    if (!ws.projectDir) return;
    setIsCompiling(true);
    try {
      for (const tab of ws.tabs) {
        if (tab.dirty && !tab.is_binary) {
          await writeProjectFile(tab.path, tab.content);
        }
      }
      updateWorkspace(ws.id, (w) => ({
        ...w,
        tabs: w.tabs.map((t) =>
          t.dirty && !t.is_binary ? { ...t, saved_content: t.content, dirty: false } : t
        ),
      }));

      const chosenProfileId = ws.quickBuildId ?? (compilerSettings.quickBuildPreset !== 'auto' ? compilerSettings.quickBuildPreset : null);
      const chosenProfile = chosenProfileId
        ? quickBuildProfiles.find((p) => p.id === chosenProfileId)
        : undefined;

      const result = await compileLatex({
        project_dir: ws.projectDir,
        main_file: ws.mainFile,
        distribution: compilerSettings.distribution,
        engine:
          chosenProfile && chosenProfile.steps.length > 0
            ? chosenProfile.steps[0]
            : compilerSettings.engine,
        custom_bin_dir: compilerSettings.customBinDir || undefined,
        miktex_bin_dir: compilerSettings.miktexBinDir || undefined,
        texlive_bin_dir: compilerSettings.texliveBinDir || undefined,
        tectonic_bin_dir: compilerSettings.tectonicBinDir || undefined,
        use_build_dir: compilerSettings.useBuildDir,
        auto_run_bib: compilerSettings.autoRunBib,
        quick_build_steps:
          chosenProfile && chosenProfile.steps.length > 0
            ? chosenProfile.steps
            : undefined,
      });

      updateWorkspace(ws.id, (w) => ({
        ...w,
        pdfBase64: result.pdf_base64 ?? w.pdfBase64,
        synctexAvailable: result.synctex_available,
        diagnostics: result.diagnostics,
        compileDuration: result.duration_ms,
      }));
      if (result.diagnostics.some((d) => d.severity === 'error')) {
        setDiagnosticsOpen(true);
      }
    } catch (err) {
      updateWorkspace(ws.id, (w) => ({
        ...w,
        diagnostics: [
          {
            severity: 'error',
            file: ws.mainFile,
            message: err instanceof Error ? err.message : String(err),
          },
        ],
      }));
      setDiagnosticsOpen(true);
    } finally {
      setIsCompiling(false);
    }
  }, [activeWs, compilerSettings, updateWorkspace]);

  const handleSaveTab = useCallback(
    async (path: string) => {
      const ws = activeWs;
      const target = ws.tabs.find((t) => t.path === path);
      if (!target || target.is_binary) return;
      await writeProjectFile(target.path, target.content);
      updateWorkspace(ws.id, (w) => ({
        ...w,
        tabs: w.tabs.map((t) =>
          t.path === path ? { ...t, saved_content: t.content, dirty: false } : t
        ),
      }));
      if (compilerSettings.autoCompileOnSave) {
        handleCompile();
      } else if (ws.projectDir) {
        scanProjectSymbols(ws.projectDir)
          .then((idx) => updateWorkspace(ws.id, (w) => ({ ...w, projectIndex: idx })))
          .catch(() => { });
      }
    },
    [activeWs, compilerSettings.autoCompileOnSave, handleCompile, updateWorkspace]
  );

  // Periodic Auto-Save
  useEffect(() => {
    if (!compilerSettings.autoSaveIntervalSec || !isTauriRuntime()) return;
    const ms = compilerSettings.autoSaveIntervalSec * 1000;
    const timer = window.setInterval(async () => {
      for (const ws of workspaces) {
        const dirtyTabs = ws.tabs.filter((t) => t.dirty && !t.is_binary);
        if (dirtyTabs.length === 0) continue;
        for (const t of dirtyTabs) {
          await writeProjectFile(t.path, t.content).catch(() => { });
        }
        updateWorkspace(ws.id, (w) => ({
          ...w,
          tabs: w.tabs.map((t) =>
            t.dirty && !t.is_binary ? { ...t, saved_content: t.content, dirty: false } : t
          ),
        }));
      }
    }, ms);
    return () => window.clearInterval(timer);
  }, [compilerSettings.autoSaveIntervalSec, workspaces, updateWorkspace]);

  const handleCleanAux = async () => {
    if (!activeWs.projectDir) return;
    const count = await cleanAuxiliaryFiles(activeWs.projectDir, activeWs.mainFile);
    await handleRefreshTree();
    setStatusNotice(`${count} arquivo(s) auxiliar(es) removido(s).`);
    setTimeout(() => setStatusNotice(null), 3000);
  };

  const handleForwardSync = async (fileRel: string, line: number) => {
    if (!activeWs.projectDir) return;
    try {
      const loc = await synctexForward(activeWs.projectDir, activeWs.mainFile, fileRel, line);
      if (loc) {
        setScrollToPage({ page: loc.page, nonce: Date.now() });
      }
    } catch (err) {
      console.error('Forward SyncTeX failed:', err);
    }
  };

  const handleCloseTab = (path: string) => {
    updateWorkspace(activeWs.id, (w) => {
      const next = w.tabs.filter((t) => t.path !== path);
      return {
        ...w,
        tabs: next,
        activeTabPath:
          w.activeTabPath === path ? (next.length > 0 ? next[next.length - 1].path : null) : w.activeTabPath,
      };
    });
  };

  const handleSyncTexSingleClick = async (page: number, xPt: number, yPt: number) => {
    if (!activeWs.projectDir) return;
    try {
      const loc = await synctexLookup(activeWs.projectDir, activeWs.mainFile, page, xPt, yPt);
      if (loc) {
        updateWorkspace(activeWs.id, (w) => ({ ...w, highlightedFile: loc.relative_file }));
      }
    } catch (err) {
      console.error('SyncTeX lookup failed:', err);
    }
  };

  const handleSyncTexDoubleClick = async (page: number, xPt: number, yPt: number) => {
    if (!activeWs.projectDir) return;
    try {
      const loc = await synctexLookup(activeWs.projectDir, activeWs.mainFile, page, xPt, yPt);
      if (!loc) return;
      updateWorkspace(activeWs.id, (w) => ({ ...w, highlightedFile: loc.relative_file }));
      const node =
        findNodeByPath(activeWs.tree, loc.relative_file) || findNodeByPath(activeWs.tree, loc.file);
      if (node) {
        await openFileNode(node, loc.line);
      }
    } catch (err) {
      console.error('SyncTeX double-click failed:', err);
    }
  };

  const startLeftResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const ws = workspaceRef.current;
    if (!ws) return;
    const onMouseMove = (ev: MouseEvent) => {
      const rect = ws.getBoundingClientRect();
      setLeftWidthPx(Math.min(500, Math.max(170, Math.round(ev.clientX - rect.left))));
    };
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const startRightResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const ws = workspaceRef.current;
    if (!ws) return;
    const onMouseMove = (ev: MouseEvent) => {
      const rect = ws.getBoundingClientRect();
      const pct = ((rect.right - ev.clientX) / rect.width) * 100;
      setRightWidthPct(Math.min(65, Math.max(20, Math.round(pct))));
    };
    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleImportOverleafZip = async () => {
    if (!isTauriRuntime()) return;
    const zipPath = await pickZipFile();
    if (!zipPath) return;
    const targetDir = await pickProjectFolder();
    if (!targetDir) return;
    const detectedMain = await importOverleafZip(zipPath, targetDir);
    const newWs = createEmptyWorkspace();
    setWorkspaces((prev) => (activeWs.projectDir ? [...prev, newWs] : [newWs]));
    setActiveWorkspaceId(newWs.id);
    await hydrateWorkspaceFromDisk(newWs.id, targetDir, detectedMain);
  };

  // Customizable global keyboard shortcuts
  useEffect(() => {
    const matchShortcut = (e: KeyboardEvent, combo: string) => {
      const parts = combo.toLowerCase().split('+').map((p) => p.trim());
      const wantCtrl = parts.includes('ctrl');
      const wantShift = parts.includes('shift');
      const wantAlt = parts.includes('alt');
      const keyPart = parts.find((p) => !['ctrl', 'shift', 'alt'].includes(p)) || '';
      return (
        (e.ctrlKey || e.metaKey) === wantCtrl &&
        e.shiftKey === wantShift &&
        e.altKey === wantAlt &&
        e.key.toLowerCase() === keyPart
      );
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (matchShortcut(e, shortcuts.compile)) {
        e.preventDefault();
        handleCompile();
      } else if (matchShortcut(e, shortcuts.quickRef)) {
        e.preventDefault();
        setQuickRefOpen(true);
      } else if (matchShortcut(e, shortcuts.symbols)) {
        e.preventDefault();
        setMathSymbolsOpen(true);
      } else if (matchShortcut(e, shortcuts.tables)) {
        e.preventDefault();
        setTableWizardOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [shortcuts, handleCompile]);

  const activeTab = activeWs.tabs.find((t) => t.path === activeWs.activeTabPath) || null;
  const errorCount = activeWs.diagnostics.filter((d) => d.severity === 'error').length;
  const activeQuickBuild = activeWs.quickBuildId
    ? quickBuildProfiles.find((p) => p.id === activeWs.quickBuildId)
    : null;

  return (
    <div className="tf-app">
      {/* Top Bar */}
      <header className="tf-topbar">
        <div className="tf-brand">
          <img
            src={theme === 'dark' ? '/favicon-dark.png' : '/favicon.png'}
            alt="ForjaTeX"
          />
          <span className="tf-brand-name">ForjaTeX</span>
          <span className="tf-brand-tag">LaTeX IDE</span>
        </div>

        <div className="tf-compile-controls">
          <select
            className="tf-select-compact"
            value={compilerSettings.distribution}
            onChange={(e) =>
              setCompilerSettings({
                ...compilerSettings,
                distribution: e.target.value as CompilerDistribution,
              })
            }
            title="Distribuição TeX"
          >
            <option value="auto">Auto</option>
            <option value="miktex">MiKTeX</option>
            <option value="texlive">TeX Live</option>
            <option value="tectonic">Tectonic</option>
            <option value="custom">Custom</option>
          </select>

          <select
            className="tf-select-compact"
            value={compilerSettings.engine}
            onChange={(e) =>
              setCompilerSettings({
                ...compilerSettings,
                engine: e.target.value as CompilerEngine,
              })
            }
            title="Motor de compilação"
          >
            <option value="pdflatex">pdflatex</option>
            <option value="xelatex">xelatex</option>
            <option value="lualatex">lualatex</option>
            <option value="latexmk">latexmk</option>
          </select>

          <button
            type="button"
            className="tf-compile-btn"
            disabled={!activeWs.projectDir || isCompiling}
            onClick={handleCompile}
            onContextMenu={(e) => {
              e.preventDefault();
              setCompileMenu({ x: e.clientX, y: e.clientY });
            }}
            title={`Compilar (${shortcuts.compile}) — Botão direito para escolher Quick Build deste projeto`}
          >
            {isCompiling ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            <span>
              {t('topbar.compile')} ({activeWs.mainFile.split('/').pop()})
              {activeQuickBuild ? ` · ${activeQuickBuild.name}` : ''}
            </span>
          </button>

          {compileMenu && (
            <div
              className="tf-context-menu"
              style={{ top: compileMenu.y, left: compileMenu.x }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="tf-context-menu-item"
                onClick={() => {
                  updateWorkspace(activeWs.id, (w) => ({ ...w, quickBuildId: null }));
                  setCompileMenu(null);
                }}
              >
                <span>{!activeWs.quickBuildId ? '✓ ' : ''}Padrão (Configurações)</span>
              </button>
              {quickBuildProfiles.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="tf-context-menu-item"
                  onClick={() => {
                    updateWorkspace(activeWs.id, (w) => ({ ...w, quickBuildId: p.id }));
                    setCompileMenu(null);
                  }}
                >
                  <span>
                    {activeWs.quickBuildId === p.id ? '✓ ' : ''}
                    {p.name} ({p.steps.join(' → ')})
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="tf-topbar-right">
          <button
            type="button"
            className="tf-tool-btn"
            onClick={handleImportOverleafZip}
            title="Importar projeto .zip exportado do Overleaf"
          >
            <FileArchive size={14} />
            <span>Overleaf .zip</span>
          </button>

          <button
            type="button"
            className="tf-tool-btn"
            onClick={() => setNewProjectOpen(true)}
            title="Criar ou gerenciar templates"
          >
            <FolderPlus size={14} />
            <span>Templates</span>
          </button>

          <button
            type="button"
            className="tf-tool-btn"
            disabled={!activeWs.projectDir}
            onClick={handleCleanAux}
            title="Limpar arquivos auxiliares (.aux, .log, .toc) mantendo o PDF"
          >
            <Eraser size={14} />
            <span>{t('topbar.cleanAux')}</span>
          </button>

          <button
            type="button"
            className="tf-tool-btn"
            onClick={() => setQuickRefOpen(true)}
            title={`Referência Rápida LaTeX (${shortcuts.quickRef})`}
          >
            <BookOpen size={14} />
            <span>{t('topbar.help')}</span>
          </button>

          <button
            type="button"
            className="tf-tool-btn"
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            title={t('topbar.toggleTheme')}
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>

          <button
            type="button"
            className={`tf-tool-btn ${rightTab === 'ai' ? 'active' : ''}`}
            onClick={() => setRightTab((tab) => (tab === 'ai' ? 'pdf' : 'ai'))}
            title="Alternar entre PDF Preview e IA na área direita"
          >
            <Sparkles size={14} />
            <span>{t('topbar.ai')}</span>
          </button>

          <button
            type="button"
            className="tf-tool-btn"
            onClick={() => {
              setSettingsTab('compiler');
              setSettingsOpen(true);
            }}
            title="Configurações de Compilador, Editor, IA e Git"
          >
            <Settings size={14} />
            <span>{t('topbar.settings')}</span>
          </button>

          <button
            type="button"
            className="tf-tool-btn"
            onClick={() => setFeedbackOpen(true)}
            title="Enviar pedido, reportar erro ou apoiar o ForjaTeX"
          >
            <Heart size={14} className="text-rose-400" />
            <span>{t('topbar.donate')}</span>
          </button>
        </div>
      </header>

      {/* Multi-Project Workspace Tabs Bar */}
      <div className="tf-workspace-bar">
        {workspaces.map((ws) => {
          const isActive = ws.id === activeWs.id;
          return (
            <div
              key={ws.id}
              className={`tf-ws-tab ${isActive ? 'active' : ''}`}
              onClick={() => setActiveWorkspaceId(ws.id)}
              title={ws.projectDir || 'Espaço vazio'}
            >
              <FolderOpen size={12} className="text-amber-400 shrink-0" />
              <span>{ws.name}</span>
              {workspaces.length > 1 && (
                <button
                  type="button"
                  className="tf-tab-close"
                  onClick={(e) => {
                    e.stopPropagation();
                    setWorkspaces((prev) => {
                      const next = prev.filter((item) => item.id !== ws.id);
                      if (activeWorkspaceId === ws.id && next.length > 0) {
                        setActiveWorkspaceId(next[0].id);
                      }
                      return next;
                    });
                  }}
                  title="Fechar aba de projeto"
                >
                  <X size={11} />
                </button>
              )}
            </div>
          );
        })}
        <button
          type="button"
          className="tf-ws-add-btn"
          onClick={() => handleOpenFolder(true)}
          title="Abrir outro projeto em nova aba"
        >
          <Plus size={12} /> Abrir Projeto
        </button>
      </div>

      {/* Main 3-Pane IDE Workspace */}
      <main className="tf-workspace" ref={workspaceRef}>
        <div style={{ width: `${leftWidthPx}px`, display: 'flex', minHeight: 0, flexShrink: 0 }}>
          <ExplorerSidebar
            projectDir={activeWs.projectDir}
            tree={activeWs.tree}
            outline={activeWs.projectIndex.outline}
            mainFile={activeWs.mainFile}
            activeFilePath={activeWs.activeTabPath}
            highlightedFile={activeWs.highlightedFile}
            onOpenFolder={() => handleOpenFolder(false)}
            onNewTemplateProject={() => setNewProjectOpen(true)}
            onRefresh={handleRefreshTree}
            onSelectFile={(node) => openFileNode(node)}
            onJumpToOutline={async (fileRel, line) => {
              const node = findNodeByPath(activeWs.tree, fileRel);
              if (node) await openFileNode(node, line);
            }}
            onSetMainFile={handleSetMainFile}
            onCreateEntry={async (parentDir, name, isDir) => {
              const sep = parentDir.includes('\\') ? '\\' : '/';
              await createProjectEntry(`${parentDir}${sep}${name}`, isDir);
              await handleRefreshTree();
            }}
            onOpenGitSettings={() => {
              setSettingsTab('git');
              setSettingsOpen(true);
            }}
          />
        </div>

        <div
          className="tf-col-resizer"
          onMouseDown={startLeftResize}
          title="Arraste para redimensionar Explorer e Editor"
        />

        {/* Center: Editor + Diagnostics */}
        <section className="tf-center-column">
          <div className="tf-center-split" ref={splitContainerRef}>
            <div style={{ height: '100%', minHeight: 0 }}>
              <EditorPane
                tabs={activeWs.tabs}
                activeTabPath={activeWs.activeTabPath}
                theme={theme}
                projectIndex={activeWs.projectIndex}
                userTags={userTags}
                pendingInsert={pendingInsert}
                onSelectTab={(p) => updateWorkspace(activeWs.id, (w) => ({ ...w, activeTabPath: p }))}
                onCloseTab={handleCloseTab}
                onChangeContent={(path, content) =>
                  updateWorkspace(activeWs.id, (w) => ({
                    ...w,
                    tabs: w.tabs.map((t) =>
                      t.path === path
                        ? { ...t, content, dirty: content !== t.saved_content }
                        : t
                    ),
                  }))
                }
                onSaveTab={handleSaveTab}
                onOpenTableWizard={() => setTableWizardOpen(true)}
                onOpenMathSymbols={() => setMathSymbolsOpen(true)}
                onOpenBibWizard={() => setBibWizardOpen(true)}
                onOpenMatrixPreamble={() => setMatrixPreambleOpen(true)}
                onOpenTagsScripts={() => setTagsScriptsOpen(true)}
                onOpenFontWizard={() => setFontWizardOpen(true)}
                onOpenImageWizard={() => setImageWizardOpen(true)}
                onForwardSync={handleForwardSync}
              />
            </div>
          </div>

          {/* Collapsible Diagnostics Bar */}
          <div className="tf-diagnostics-bar">
            <div
              className="tf-diagnostics-summary"
              onClick={() => setDiagnosticsOpen((v) => !v)}
            >
              <span className="flex items-center gap-2">
                {errorCount > 0 ? (
                  <>
                    <AlertTriangle size={13} className="text-rose-400" />
                    <strong className="text-rose-400">
                      {errorCount} {t('diagnostics.errors')}
                    </strong>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={13} className="text-emerald-400" />
                    <span>{t('diagnostics.ready')}</span>
                  </>
                )}
                {activeWs.compileDuration !== null && (
                  <span className="text-slate-500">
                    · {t('diagnostics.lastCompile')}: {activeWs.compileDuration} ms
                  </span>
                )}
                {statusNotice && <span className="text-sky-400">· {statusNotice}</span>}
              </span>
              {diagnosticsOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </div>

            {diagnosticsOpen && (
              <div className="tf-diagnostics-list">
                {activeWs.diagnostics.length === 0 ? (
                  <div className="text-slate-500 text-xs">Nenhum aviso ou erro no log.</div>
                ) : (
                  activeWs.diagnostics.map((d, idx) => {
                    const pkgMatch = d.message.match(/File `([^']+)\.sty' not found/i);
                    return (
                      <div
                        key={idx}
                        className={`tf-diag-item ${d.severity} clickable`}
                        onClick={async () => {
                          const node = findNodeByPath(activeWs.tree, d.file);
                          if (node) {
                            await openFileNode(node, d.line ?? 1);
                          }
                        }}
                        title="Clique para ir até a linha no editor"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <strong>
                              {d.file}
                              {d.line ? `:${d.line}` : ''}
                            </strong>{' '}
                            — {d.message}
                          </div>
                          {pkgMatch && (
                            <button
                              type="button"
                              className="tf-btn-small accent"
                              onClick={async (e) => {
                                e.stopPropagation();
                                setStatusNotice(`Instalando pacote ${pkgMatch[1]}...`);
                                try {
                                  const msg = await installTexPackage(
                                    pkgMatch[1],
                                    compilerSettings.distribution
                                  );
                                  setStatusNotice(msg);
                                } catch (err) {
                                  setStatusNotice(
                                    err instanceof Error ? err.message : String(err)
                                  );
                                }
                              }}
                            >
                              Instalar {pkgMatch[1]}
                            </button>
                          )}
                        </div>
                        {d.hint && <div className="tf-diag-hint">Dica: {d.hint}</div>}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </section>

        <div
          className="tf-col-resizer"
          onMouseDown={startRightResize}
          title="Arraste para redimensionar Editor e PDF Preview"
        />

        {/* Right: PDF Preview / IA Tabs */}
        <div
          className="tf-right-pane-shell"
          style={{ width: `${rightWidthPct}%`, display: 'flex', flexDirection: 'column', minHeight: 0, flexShrink: 0 }}
        >
          <div className="tf-right-tabs">
            <button
              type="button"
              className={`tf-right-tab ${rightTab === 'pdf' ? 'active' : ''}`}
              onClick={() => setRightTab('pdf')}
            >
              {t('right.pdfPreview')}
            </button>
            <button
              type="button"
              className={`tf-right-tab ${rightTab === 'ai' ? 'active' : ''}`}
              onClick={() => setRightTab('ai')}
            >
              <Sparkles size={12} /> {t('right.ai')}
            </button>
          </div>
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            {rightTab === 'pdf' ? (
              <PdfPreviewPane
                pdfBase64={activeWs.pdfBase64}
                synctexAvailable={activeWs.synctexAvailable}
                isCompiling={isCompiling}
                scrollToPage={scrollToPage}
                onSyncTexSingleClick={handleSyncTexSingleClick}
                onSyncTexDoubleClick={handleSyncTexDoubleClick}
              />
            ) : (
              <AiPromptPane
                aiSettings={aiSettings}
                activeFileName={activeTab?.relative_path || activeWs.mainFile}
                activeFileContent={activeTab && !activeTab.is_binary ? activeTab.content : ''}
                diagnostics={activeWs.diagnostics}
                onOpenSettings={() => {
                  setSettingsTab('ai');
                  setSettingsOpen(true);
                }}
                onApplyLatex={(code, compileAfter) => {
                  if (!activeTab || activeTab.is_binary) return;
                  updateWorkspace(activeWs.id, (w) => ({
                    ...w,
                    tabs: w.tabs.map((t) =>
                      t.path === activeTab.path
                        ? { ...t, content: code, dirty: code !== t.saved_content }
                        : t
                    ),
                  }));
                  if (compileAfter) {
                    setTimeout(() => handleCompile(), 50);
                  }
                }}
              />
            )}
          </div>
        </div>
      </main>

      <SettingsModal
        open={settingsOpen}
        initialTab={settingsTab}
        projectDir={activeWs.projectDir}
        mainFile={activeWs.mainFile}
        availableTexFiles={collectTexFiles(activeWs.tree)}
        theme={theme}
        shortcuts={shortcuts}
        quickBuildProfiles={quickBuildProfiles}
        compilerSettings={compilerSettings}
        aiSettings={aiSettings}
        detectedCompilers={detectedCompilers}
        onClose={() => setSettingsOpen(false)}
        onChangeMainFile={handleSetMainFile}
        onChangeTheme={setTheme}
        onChangeShortcuts={setShortcuts}
        onChangeQuickBuildProfiles={setQuickBuildProfiles}
        onChangeCompiler={setCompilerSettings}
        onChangeAI={setAiSettings}
        onRefreshCompilers={refreshCompilers}
      />

      <FeedbackDonateModal
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        compilerSummary={`${compilerSettings.distribution} / ${compilerSettings.engine}`}
      />

      <TableWizardModal
        open={tableWizardOpen}
        onClose={() => setTableWizardOpen(false)}
        onInsert={(code) => setPendingInsert({ text: code, nonce: Date.now() })}
      />

      <MathSymbolsModal
        open={mathSymbolsOpen}
        onClose={() => setMathSymbolsOpen(false)}
        onInsert={(cmd) => setPendingInsert({ text: cmd, nonce: Date.now() })}
      />

      <BibWizardModal
        open={bibWizardOpen}
        onClose={() => setBibWizardOpen(false)}
        onInsert={(entry) => setPendingInsert({ text: entry, nonce: Date.now() })}
      />

      <MatrixPreambleModal
        open={matrixPreambleOpen}
        onClose={() => setMatrixPreambleOpen(false)}
        onInsert={(code) => setPendingInsert({ text: code, nonce: Date.now() })}
      />

      <FontWizardModal
        open={fontWizardOpen}
        projectDir={activeWs.projectDir}
        currentEngine={compilerSettings.engine}
        onClose={() => setFontWizardOpen(false)}
        onSwitchEngine={(engine) => setCompilerSettings({ ...compilerSettings, engine })}
        onInsert={(code) => setPendingInsert({ text: code, nonce: Date.now() })}
        onProjectFilesUpdated={handleRefreshTree}
      />

      <ImageWizardModal
        open={imageWizardOpen}
        tree={activeWs.tree}
        onClose={() => setImageWizardOpen(false)}
        onInsert={(code) => setPendingInsert({ text: code, nonce: Date.now() })}
      />

      <QuickRefModal
        open={quickRefOpen}
        onClose={() => setQuickRefOpen(false)}
        onInsert={(code) => setPendingInsert({ text: code, nonce: Date.now() })}
      />

      <UserTagsScriptsModal
        open={tagsScriptsOpen}
        userTags={userTags}
        activeContent={activeTab && !activeTab.is_binary ? activeTab.content : ''}
        onClose={() => setTagsScriptsOpen(false)}
        onChangeTags={setUserTags}
        onInsertSnippet={(code) => setPendingInsert({ text: code, nonce: Date.now() })}
        onApplyTransformedText={(nextText) => {
          if (!activeTab || activeTab.is_binary) return;
          updateWorkspace(activeWs.id, (w) => ({
            ...w,
            tabs: w.tabs.map((t) =>
              t.path === activeTab.path
                ? { ...t, content: nextText, dirty: nextText !== t.saved_content }
                : t
            ),
          }));
        }}
      />

      <NewProjectModal
        open={newProjectOpen}
        currentProjectDir={activeWs.projectDir}
        currentMainFile={activeWs.mainFile}
        onClose={() => setNewProjectOpen(false)}
        onProjectCreated={async (dir, preferredMainFile) => {
          const newWs = createEmptyWorkspace();
          setWorkspaces((prev) =>
            activeWs.projectDir ? [...prev, newWs] : [newWs]
          );
          setActiveWorkspaceId(newWs.id);
          await hydrateWorkspaceFromDisk(newWs.id, dir, preferredMainFile);
        }}
      />
    </div>
  );
}

export default App;
