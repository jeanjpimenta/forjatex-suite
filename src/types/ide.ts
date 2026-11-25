export type CompilerDistribution = 'auto' | 'miktex' | 'texlive' | 'tectonic' | 'custom';
export type CompilerEngine = 'pdflatex' | 'xelatex' | 'lualatex' | 'latexmk';
export type AIProvider = 'gemini' | 'openai' | 'anthropic' | 'ollama' | 'custom';

export interface CompilerInfo {
  id: string;
  name: string;
  distribution: string;
  path: string;
  available: boolean;
}

export interface FileNode {
  name: string;
  path: string;
  relative_path: string;
  is_dir: boolean;
  extension: string;
  is_aux: boolean;
  children?: FileNode[] | null;
}

export interface OpenTab {
  path: string;
  relative_path: string;
  name: string;
  extension: string;
  is_binary: boolean;
  mime_type: string;
  content: string;
  saved_content: string;
  dirty: boolean;
  jumpToLine?: number;
}

export interface DiagnosticItem {
  severity: 'error' | 'warning' | string;
  file: string;
  line?: number | null;
  message: string;
  hint?: string | null;
}

export interface CompileRequest {
  project_dir: string;
  main_file: string;
  distribution: string;
  engine: string;
  custom_bin_dir?: string;
  miktex_bin_dir?: string;
  texlive_bin_dir?: string;
  tectonic_bin_dir?: string;
  use_build_dir?: boolean;
  auto_run_bib?: boolean;
  quick_build_steps?: string[];
}

export interface CompilerTestResult {
  ok: boolean;
  binary_path: string;
  version_line: string;
}

export interface CompileResult {
  success: boolean;
  pdf_base64?: string | null;
  log: string;
  diagnostics: DiagnosticItem[];
  duration_ms: number;
  synctex_available: boolean;
  used_command: string;
}

export interface SyncTexLocation {
  file: string;
  relative_file: string;
  line: number;
}

export interface ForwardSyncLocation {
  page: number;
  x: number;
  y: number;
}

export interface BibEntryInfo {
  key: string;
  entry_type: string;
  title: string;
  author: string;
  file: string;
}

export interface LabelInfo {
  name: string;
  file: string;
  line: number;
}

export interface OutlineItem {
  kind: string;
  title: string;
  file: string;
  line: number;
}

export interface ProjectIndex {
  bib_keys: BibEntryInfo[];
  labels: LabelInfo[];
  outline: OutlineItem[];
}

export interface TemplateFileEntry {
  relative_path: string;
  is_dir: boolean;
  content: string;
}

export interface CustomTemplate {
  id: string;
  name: string;
  description: string;
  main_file: string;
  entries: TemplateFileEntry[];
  created_at: number;
}

export interface CompilerSettings {
  distribution: CompilerDistribution;
  engine: CompilerEngine;
  customBinDir: string;
  miktexBinDir: string;
  texliveBinDir: string;
  tectonicBinDir: string;
  autoCompileOnSave: boolean;
  useBuildDir: boolean;
  autoRunBib: boolean;
  autoSaveIntervalSec: number;
  quickBuildPreset: string;
  customQuickBuildSteps: string[];
}

export interface KeyShortcuts {
  compile: string;
  quickRef: string;
  symbols: string;
  tables: string;
}

export interface QuickBuildProfile {
  id: string;
  name: string;
  steps: string[];
}

export interface UserTag {
  id: string;
  trigger: string;
  label: string;
  snippet: string;
}

export interface WorkspaceSession {
  id: string;
  name: string;
  projectDir: string | null;
  mainFile: string;
  quickBuildId?: string | null;
  tree: FileNode[];
  tabs: OpenTab[];
  activeTabPath: string | null;
  highlightedFile: string | null;
  projectIndex: ProjectIndex;
  pdfBase64: string | null;
  synctexAvailable: boolean;
  diagnostics: DiagnosticItem[];
  compileDuration: number | null;
}

export interface AISettings {
  enabled: boolean;
  provider: AIProvider;
  apiKey: string;
  model: string;
  customEndpoint: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  extractedLatex?: string;
  timestamp: number;
}
