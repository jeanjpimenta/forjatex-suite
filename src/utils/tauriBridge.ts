import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import type {
  CompileRequest,
  CompileResult,
  CompilerInfo,
  CompilerTestResult,
  CustomTemplate,
  FileNode,
  ForwardSyncLocation,
  ProjectIndex,
  SyncTexLocation,
  TemplateFileEntry,
} from '../types/ide';

export interface FileContentResult {
  is_binary: boolean;
  mime_type: string;
  content: string;
}

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function pickProjectFolder(): Promise<string | null> {
  if (!isTauriRuntime()) {
    return null;
  }
  const selected = await open({
    directory: true,
    multiple: false,
    title: 'Abrir pasta do projeto LaTeX',
  });
  return typeof selected === 'string' ? selected : null;
}

export async function detectCompilers(): Promise<CompilerInfo[]> {
  if (!isTauriRuntime()) {
    return [
      { id: 'miktex-pdflatex', name: 'MiKTeX (pdflatex)', distribution: 'miktex', path: 'Demo Mode', available: false },
      { id: 'texlive-pdflatex', name: 'TeX Live (pdflatex)', distribution: 'texlive', path: 'Demo Mode', available: false },
    ];
  }
  return invoke<CompilerInfo[]>('detect_compilers');
}

export async function testCompiler(
  distribution: string,
  engine: string,
  binDir?: string
): Promise<CompilerTestResult> {
  return invoke<CompilerTestResult>('test_compiler', {
    distribution,
    engine,
    binDir: binDir || null,
  });
}

export async function scanProject(rootPath: string): Promise<FileNode[]> {
  return invoke<FileNode[]>('scan_project', { rootPath });
}

export async function readProjectFile(path: string): Promise<FileContentResult> {
  return invoke<FileContentResult>('read_project_file', { path });
}

export async function writeProjectFile(path: string, content: string): Promise<void> {
  return invoke<void>('write_project_file', { path, content });
}

export async function createProjectEntry(path: string, isDir: boolean): Promise<void> {
  return invoke<void>('create_project_entry', { path, isDir });
}

export interface ExistingPdfResult {
  pdf_base64: string;
  synctex_available: boolean;
}

export async function loadExistingPdf(
  projectDir: string,
  mainFile: string
): Promise<ExistingPdfResult | null> {
  return invoke<ExistingPdfResult | null>('load_existing_pdf', {
    projectDir,
    mainFile,
  });
}

export async function compileLatex(request: CompileRequest): Promise<CompileResult> {
  return invoke<CompileResult>('compile_latex', { request });
}

export async function synctexLookup(
  projectDir: string,
  mainFile: string,
  page: number,
  x: number,
  y: number
): Promise<SyncTexLocation | null> {
  return invoke<SyncTexLocation | null>('synctex_lookup', {
    projectDir,
    mainFile,
    page,
    x,
    y,
  });
}

export async function synctexForward(
  projectDir: string,
  mainFile: string,
  file: string,
  line: number
): Promise<ForwardSyncLocation | null> {
  return invoke<ForwardSyncLocation | null>('synctex_forward', {
    projectDir,
    mainFile,
    file,
    line,
  });
}

export async function cleanAuxiliaryFiles(
  projectDir: string,
  mainFile: string
): Promise<number> {
  return invoke<number>('clean_auxiliary_files', { projectDir, mainFile });
}

export async function scanProjectSymbols(projectDir: string): Promise<ProjectIndex> {
  return invoke<ProjectIndex>('scan_project_symbols', { projectDir });
}

export async function createTemplateProject(
  targetDir: string,
  templateId: string
): Promise<void> {
  return invoke<void>('create_template_project', { targetDir, templateId });
}

export async function listCustomTemplates(): Promise<CustomTemplate[]> {
  return invoke<CustomTemplate[]>('list_custom_templates');
}

export async function saveCustomTemplate(template: CustomTemplate): Promise<void> {
  return invoke<void>('save_custom_template', { template });
}

export async function deleteCustomTemplate(templateId: string): Promise<void> {
  return invoke<void>('delete_custom_template', { templateId });
}

export async function snapshotProjectAsTemplate(
  projectDir: string,
  name: string,
  description: string,
  mainFile: string
): Promise<CustomTemplate> {
  return invoke<CustomTemplate>('snapshot_project_as_template', {
    projectDir,
    name,
    description,
    mainFile,
  });
}

export async function instantiateCustomTemplate(
  targetDir: string,
  entries: TemplateFileEntry[],
  variables: Record<string, string>
): Promise<void> {
  return invoke<void>('instantiate_custom_template', {
    targetDir,
    entries,
    variables,
  });
}

export async function listSystemFonts(): Promise<string[]> {
  if (!isTauriRuntime()) {
    return ['Arial', 'Cambria', 'Fira Sans', 'Garamond', 'Georgia', 'Times New Roman'];
  }
  return invoke<string[]>('list_system_fonts');
}

export async function copyFontFilesToProject(
  projectDir: string,
  files: string[]
): Promise<string[]> {
  return invoke<string[]>('copy_font_files_to_project', { projectDir, files });
}

export async function pickFontFiles(): Promise<string[]> {
  if (!isTauriRuntime()) return [];
  const selected = await open({
    multiple: true,
    filters: [{ name: 'Fontes (TTF / OTF)', extensions: ['ttf', 'otf'] }],
    title: 'Selecionar arquivos de fonte (.ttf / .otf)',
  });
  if (Array.isArray(selected)) return selected;
  if (typeof selected === 'string') return [selected];
  return [];
}

export async function pickZipFile(): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  const selected = await open({
    multiple: false,
    filters: [{ name: 'Projeto Overleaf (.zip)', extensions: ['zip'] }],
    title: 'Selecionar arquivo .zip do Overleaf',
  });
  return typeof selected === 'string' ? selected : null;
}

export async function importOverleafZip(
  zipPath: string,
  targetDir: string
): Promise<string> {
  return invoke<string>('import_overleaf_zip', { zipPath, targetDir });
}

export async function installTexPackage(
  packageName: string,
  distribution: string
): Promise<string> {
  return invoke<string>('install_tex_package', { packageName, distribution });
}

export interface GitFileChange {
  status: string;
  path: string;
}

export interface GitCommitEntry {
  hash: string;
  author: string;
  date: string;
  message: string;
}

export interface GitStatusInfo {
  git_installed: boolean;
  is_repo: boolean;
  branch: string;
  remote_url: string;
  user_name: string;
  user_email: string;
  changes: GitFileChange[];
  commits: GitCommitEntry[];
}

export async function gitStatus(projectDir: string): Promise<GitStatusInfo> {
  return invoke<GitStatusInfo>('git_status', { projectDir });
}

export async function gitInit(projectDir: string): Promise<string> {
  return invoke<string>('git_init', { projectDir });
}

export async function gitCommitAll(projectDir: string, message: string): Promise<string> {
  return invoke<string>('git_commit_all', { projectDir, message });
}

export async function gitSetRemote(projectDir: string, url: string): Promise<string> {
  return invoke<string>('git_set_remote', { projectDir, url });
}

export async function gitPush(projectDir: string): Promise<string> {
  return invoke<string>('git_push', { projectDir });
}

export async function gitPull(projectDir: string): Promise<string> {
  return invoke<string>('git_pull', { projectDir });
}

export async function gitSetUserConfig(name: string, email: string): Promise<string> {
  return invoke<string>('git_set_user_config', { name, email });
}

export async function gitCreateLatexGitignore(projectDir: string): Promise<string> {
  return invoke<string>('git_create_latex_gitignore', { projectDir });
}

export async function gitSaveCredential(
  host: string,
  username: string,
  token: string
): Promise<string> {
  return invoke<string>('git_save_credential', { host, username, token });
}

export async function gitClone(url: string, targetDir: string): Promise<string> {
  return invoke<string>('git_clone', { url, targetDir });
}
