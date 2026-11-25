use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use flate2::read::GzDecoder;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{Instant, SystemTime, UNIX_EPOCH};
use tauri::Manager;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Debug, Serialize, Clone)]
pub struct CompilerInfo {
    pub id: String,
    pub name: String,
    pub distribution: String,
    pub path: String,
    pub available: bool,
}

#[derive(Debug, Serialize, Clone)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub relative_path: String,
    pub is_dir: bool,
    pub extension: String,
    pub is_aux: bool,
    pub children: Option<Vec<FileNode>>,
}

#[derive(Debug, Serialize)]
pub struct FileContentResult {
    pub is_binary: bool,
    pub mime_type: String,
    pub content: String,
}

#[derive(Debug, Deserialize)]
pub struct CompileRequest {
    pub project_dir: String,
    pub main_file: String,
    pub distribution: String,
    pub engine: String,
    pub custom_bin_dir: Option<String>,
    pub miktex_bin_dir: Option<String>,
    pub texlive_bin_dir: Option<String>,
    pub tectonic_bin_dir: Option<String>,
    pub use_build_dir: Option<bool>,
    pub auto_run_bib: Option<bool>,
    pub quick_build_steps: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Clone)]
pub struct DiagnosticItem {
    pub severity: String,
    pub file: String,
    pub line: Option<u32>,
    pub message: String,
    pub hint: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ExistingPdfResult {
    pub pdf_base64: String,
    pub synctex_available: bool,
}

#[derive(Debug, Serialize)]
pub struct CompileResult {
    pub success: bool,
    pub pdf_base64: Option<String>,
    pub log: String,
    pub diagnostics: Vec<DiagnosticItem>,
    pub duration_ms: u128,
    pub synctex_available: bool,
    pub used_command: String,
}

#[derive(Debug, Serialize)]
pub struct SyncTexLocation {
    pub file: String,
    pub relative_file: String,
    pub line: u32,
}

#[derive(Debug, Serialize)]
pub struct ForwardSyncLocation {
    pub page: u32,
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Serialize, Clone)]
pub struct BibEntryInfo {
    pub key: String,
    pub entry_type: String,
    pub title: String,
    pub author: String,
    pub file: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct LabelInfo {
    pub name: String,
    pub file: String,
    pub line: u32,
}

#[derive(Debug, Serialize, Clone)]
pub struct OutlineItem {
    pub kind: String,
    pub title: String,
    pub file: String,
    pub line: u32,
}

#[derive(Debug, Serialize)]
pub struct ProjectIndex {
    pub bib_keys: Vec<BibEntryInfo>,
    pub labels: Vec<LabelInfo>,
    pub outline: Vec<OutlineItem>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TemplateFileEntry {
    pub relative_path: String,
    pub is_dir: bool,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CustomTemplate {
    pub id: String,
    pub name: String,
    pub description: String,
    pub main_file: String,
    pub entries: Vec<TemplateFileEntry>,
    pub created_at: u64,
}

fn silent_command(program: &str) -> Command {
    let mut cmd = Command::new(program);
    #[cfg(target_os = "windows")]
    {
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd
}

fn find_in_path(exe_name: &str) -> Option<String> {
    let which_cmd = if cfg!(target_os = "windows") {
        "where"
    } else {
        "which"
    };
    if let Ok(output) = silent_command(which_cmd).arg(exe_name).output() {
        if output.status.success() {
            let stdout = String::from_utf8_lossy(&output.stdout);
            if let Some(first_line) = stdout.lines().next() {
                let trimmed = first_line.trim();
                if !trimmed.is_empty() {
                    return Some(trimmed.to_string());
                }
            }
        }
    }
    None
}

fn check_known_locations(distribution: &str, engine: &str) -> Option<String> {
    let exe_suffix = if cfg!(target_os = "windows") {
        ".exe"
    } else {
        ""
    };
    let bin_name = format!("{}{}", engine, exe_suffix);

    let mut candidates: Vec<PathBuf> = Vec::new();
    if cfg!(target_os = "windows") {
        if distribution == "miktex" {
            candidates.push(PathBuf::from(format!(
                "C:\\Program Files\\MiKTeX\\miktex\\bin\\x64\\{}",
                bin_name
            )));
            if let Ok(local_app) = std::env::var("LOCALAPPDATA") {
                candidates.push(PathBuf::from(format!(
                    "{}\\Programs\\MiKTeX\\miktex\\bin\\x64\\{}",
                    local_app, bin_name
                )));
            }
        } else if distribution == "texlive" {
            for year in (2022..=2027).rev() {
                candidates.push(PathBuf::from(format!(
                    "C:\\texlive\\{}\\bin\\windows\\{}",
                    year, bin_name
                )));
                candidates.push(PathBuf::from(format!(
                    "C:\\texlive\\{}\\bin\\win32\\{}",
                    year, bin_name
                )));
            }
        }
    } else if cfg!(target_os = "macos") {
        if distribution == "texlive" {
            candidates.push(PathBuf::from(format!("/Library/TeX/texbin/{}", bin_name)));
            candidates.push(PathBuf::from(format!("/usr/local/texlive/2025/bin/universal-darwin/{}", bin_name)));
        }
    } else if distribution == "texlive" {
        candidates.push(PathBuf::from(format!("/usr/bin/{}", bin_name)));
        candidates.push(PathBuf::from(format!("/usr/local/bin/{}", bin_name)));
    }

    for candidate in candidates {
        if candidate.exists() {
            return Some(candidate.to_string_lossy().to_string());
        }
    }

    if let Some(found) = find_in_path(engine) {
        let lower = found.to_lowercase();
        if distribution == "auto"
            || (distribution == "miktex" && lower.contains("miktex"))
            || (distribution == "texlive" && lower.contains("texlive"))
            || distribution == "tectonic"
        {
            return Some(found);
        }
        // If user asked for texlive/miktex and it's in PATH without distro in path name
        if distribution == "texlive" && !lower.contains("miktex") {
            return Some(found);
        }
    }

    None
}

#[tauri::command]
fn detect_compilers() -> Vec<CompilerInfo> {
    let mut results = Vec::new();
    let checks = vec![
        ("miktex-pdflatex", "MiKTeX (pdflatex)", "miktex", "pdflatex"),
        ("miktex-xelatex", "MiKTeX (xelatex)", "miktex", "xelatex"),
        ("texlive-pdflatex", "TeX Live (pdflatex)", "texlive", "pdflatex"),
        ("texlive-lualatex", "TeX Live (lualatex)", "texlive", "lualatex"),
        ("tectonic", "Tectonic", "tectonic", "tectonic"),
        ("latexmk", "Latexmk", "auto", "latexmk"),
    ];

    for (id, name, dist, bin) in checks {
        let path = check_known_locations(dist, bin).unwrap_or_default();
        results.push(CompilerInfo {
            id: id.to_string(),
            name: name.to_string(),
            distribution: dist.to_string(),
            available: !path.is_empty(),
            path,
        });
    }
    results
}

fn is_aux_extension(ext: &str) -> bool {
    matches!(
        ext,
        "aux" | "log" | "fls" | "fdb_latexmk" | "synctex" | "gz" | "toc" | "lof" | "lot" | "out" | "bbl" | "blg" | "nav" | "snm" | "vrb"
    )
}

fn build_tree(dir: &Path, root: &Path) -> Result<Vec<FileNode>, String> {
    let mut entries = fs::read_dir(dir)
        .map_err(|e| format!("Falha ao ler diretório {}: {}", dir.display(), e))?
        .filter_map(|e| e.ok())
        .collect::<Vec<_>>();

    entries.sort_by(|a, b| {
        let a_dir = a.path().is_dir();
        let b_dir = b.path().is_dir();
        match (a_dir, b_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a
                .file_name()
                .to_string_lossy()
                .to_lowercase()
                .cmp(&b.file_name().to_string_lossy().to_lowercase()),
        }
    });

    let mut nodes = Vec::new();
    for entry in entries {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        if name == ".git" || name == "node_modules" || name == ".DS_Store" {
            continue;
        }
        let is_dir = path.is_dir();
        let relative_path = path
            .strip_prefix(root)
            .unwrap_or(&path)
            .to_string_lossy()
            .replace('\\', "/");

        let extension = if is_dir {
            String::new()
        } else {
            path.extension()
                .map(|s| s.to_string_lossy().to_lowercase())
                .unwrap_or_default()
        };

        let is_aux = !is_dir && (is_aux_extension(&extension) || name.ends_with(".synctex.gz"));
        let children = if is_dir {
            Some(build_tree(&path, root)?)
        } else {
            None
        };

        nodes.push(FileNode {
            name,
            path: path.to_string_lossy().to_string(),
            relative_path,
            is_dir,
            extension,
            is_aux,
            children,
        });
    }
    Ok(nodes)
}

#[tauri::command]
fn scan_project(root_path: String) -> Result<Vec<FileNode>, String> {
    let root = Path::new(&root_path);
    if !root.exists() || !root.is_dir() {
        return Err(format!("Diretório inválido: {}", root_path));
    }
    build_tree(root, root)
}

#[tauri::command]
fn read_project_file(path: String) -> Result<FileContentResult, String> {
    let p = Path::new(&path);
    let ext = p
        .extension()
        .map(|s| s.to_string_lossy().to_lowercase())
        .unwrap_or_default();

    let (is_binary, mime_type) = match ext.as_str() {
        "png" => (true, "image/png"),
        "jpg" | "jpeg" => (true, "image/jpeg"),
        "gif" => (true, "image/gif"),
        "webp" => (true, "image/webp"),
        "svg" => (true, "image/svg+xml"),
        "pdf" => (true, "application/pdf"),
        _ => (false, "text/plain"),
    };

    if is_binary {
        let bytes = fs::read(p).map_err(|e| format!("Erro ao ler arquivo binário: {}", e))?;
        Ok(FileContentResult {
            is_binary: true,
            mime_type: mime_type.to_string(),
            content: BASE64.encode(bytes),
        })
    } else {
        let content = fs::read_to_string(p).map_err(|e| format!("Erro ao ler arquivo texto: {}", e))?;
        Ok(FileContentResult {
            is_binary: false,
            mime_type: mime_type.to_string(),
            content,
        })
    }
}

#[tauri::command]
fn write_project_file(path: String, content: String) -> Result<(), String> {
    if let Some(parent) = Path::new(&path).parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Erro ao criar diretórios: {}", e))?;
    }
    fs::write(&path, content).map_err(|e| format!("Erro ao salvar arquivo: {}", e))
}

#[tauri::command]
fn create_project_entry(path: String, is_dir: bool) -> Result<(), String> {
    let p = Path::new(&path);
    if is_dir {
        fs::create_dir_all(p).map_err(|e| format!("Erro ao criar pasta: {}", e))
    } else {
        if let Some(parent) = p.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("Erro ao criar pasta pai: {}", e))?;
        }
        fs::write(p, "").map_err(|e| format!("Erro ao criar arquivo: {}", e))
    }
}

fn parse_latex_log(log_text: &str, default_file: &str) -> Vec<DiagnosticItem> {
    let mut diagnostics = Vec::new();
    let lines: Vec<&str> = log_text.lines().collect();

    for (idx, line) in lines.iter().enumerate() {
        let trimmed = line.trim();
        if trimmed.starts_with('!') {
            let msg = trimmed.trim_start_matches('!').trim().to_string();
            let mut found_line: Option<u32> = None;
            for offset in 1..=4 {
                if let Some(next_line) = lines.get(idx + offset) {
                    let nt = next_line.trim();
                    if let Some(rest) = nt.strip_prefix("l.") {
                        let num_str: String = rest.chars().take_while(|c| c.is_ascii_digit()).collect();
                        if let Ok(n) = num_str.parse::<u32>() {
                            found_line = Some(n);
                            break;
                        }
                    }
                }
            }

            let hint = if msg.contains("Undefined control sequence") {
                Some("Verifique se o comando foi digitado corretamente ou se o pacote necessário foi importado com \\usepackage{...}.".to_string())
            } else if msg.contains("File `") && msg.contains("not found") {
                Some("Pacote ou arquivo ausente. No MiKTeX, ative a instalação automática de pacotes ou coloque o arquivo .sty/.cls na pasta raiz.".to_string())
            } else if msg.contains("Missing $ inserted") {
                Some("Símbolo matemático usado fora do modo matemático ($...$) ou caractere '_' / '^' sem escape.".to_string())
            } else {
                None
            };

            diagnostics.push(DiagnosticItem {
                severity: "error".to_string(),
                file: default_file.to_string(),
                line: found_line,
                message: msg,
                hint,
            });
        } else if trimmed.starts_with("LaTeX Warning:") && diagnostics.len() < 30 {
            diagnostics.push(DiagnosticItem {
                severity: "warning".to_string(),
                file: default_file.to_string(),
                line: None,
                message: trimmed.trim_start_matches("LaTeX Warning:").trim().to_string(),
                hint: None,
            });
        }
    }
    diagnostics
}

fn resolve_compiler_binary(
    distribution: &str,
    engine: &str,
    custom_bin_dir: &Option<String>,
    miktex_bin_dir: &Option<String>,
    texlive_bin_dir: &Option<String>,
    tectonic_bin_dir: &Option<String>,
) -> String {
    let exe_suffix = if cfg!(target_os = "windows") {
        ".exe"
    } else {
        ""
    };

    let override_dir = match distribution {
        "miktex" => miktex_bin_dir,
        "texlive" => texlive_bin_dir,
        "tectonic" => tectonic_bin_dir,
        "custom" => custom_bin_dir,
        _ => &None,
    };

    if let Some(dir) = override_dir {
        let trimmed = dir.trim();
        if !trimmed.is_empty() {
            let candidate = Path::new(trimmed).join(format!("{}{}", engine, exe_suffix));
            if candidate.exists() {
                return candidate.to_string_lossy().to_string();
            }
            let direct = Path::new(trimmed);
            if direct.is_file() {
                return direct.to_string_lossy().to_string();
            }
        }
    }

    if distribution == "tectonic" {
        return check_known_locations("tectonic", "tectonic").unwrap_or_else(|| "tectonic".to_string());
    }
    check_known_locations(distribution, engine).unwrap_or_else(|| engine.to_string())
}

#[derive(Debug, Serialize)]
pub struct CompilerTestResult {
    pub ok: bool,
    pub binary_path: String,
    pub version_line: String,
}

#[tauri::command]
fn test_compiler(
    distribution: String,
    engine: String,
    bin_dir: Option<String>,
) -> CompilerTestResult {
    let effective_engine = if distribution == "tectonic" {
        "tectonic"
    } else {
        engine.as_str()
    };
    let binary = resolve_compiler_binary(
        &distribution,
        effective_engine,
        &bin_dir,
        &bin_dir,
        &bin_dir,
        &bin_dir,
    );
    match silent_command(&binary).arg("--version").output() {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout);
            let stderr = String::from_utf8_lossy(&out.stderr);
            let first = stdout
                .lines()
                .chain(stderr.lines())
                .find(|l| !l.trim().is_empty())
                .unwrap_or("Executado com sucesso")
                .trim()
                .to_string();
            CompilerTestResult {
                ok: out.status.success(),
                binary_path: binary,
                version_line: first,
            }
        }
        Err(e) => CompilerTestResult {
            ok: false,
            binary_path: binary,
            version_line: format!("Falha ao executar: {}", e),
        },
    }
}

#[tauri::command]
fn load_existing_pdf(
    project_dir: String,
    main_file: String,
) -> Result<Option<ExistingPdfResult>, String> {
    let project_path = Path::new(&project_dir);
    let main_full = project_path.join(&main_file);
    let work_dir = main_full.parent().unwrap_or(project_path);
    let Some(stem) = main_full.file_stem().map(|s| s.to_string_lossy().to_string()) else {
        return Ok(None);
    };

    let build_pdf = work_dir.join("build").join(format!("{}.pdf", stem));
    let root_pdf = work_dir.join(format!("{}.pdf", stem));
    let pdf_path = if build_pdf.exists() {
        build_pdf
    } else if root_pdf.exists() {
        root_pdf
    } else {
        return Ok(None);
    };

    let bytes = fs::read(&pdf_path).map_err(|e| format!("Erro ao ler PDF: {}", e))?;
    let synctex_available = work_dir.join("build").join(format!("{}.synctex.gz", stem)).exists()
        || work_dir.join(format!("{}.synctex.gz", stem)).exists();

    Ok(Some(ExistingPdfResult {
        pdf_base64: BASE64.encode(bytes),
        synctex_available,
    }))
}

#[tauri::command]
fn compile_latex(request: CompileRequest) -> Result<CompileResult, String> {
    let start = Instant::now();
    let project_path = Path::new(&request.project_dir);
    let main_rel = Path::new(&request.main_file);
    let main_full = project_path.join(main_rel);

    if !main_full.exists() {
        return Err(format!("Arquivo principal não encontrado: {}", main_full.display()));
    }

    let work_dir = main_full.parent().unwrap_or(project_path);
    let main_filename = main_full
        .file_name()
        .ok_or("Nome de arquivo inválido")?
        .to_string_lossy()
        .to_string();
    let stem = main_full
        .file_stem()
        .ok_or("Stem inválido")?
        .to_string_lossy()
        .to_string();

    let engine = if request.distribution == "tectonic" {
        "tectonic".to_string()
    } else {
        request.engine.clone()
    };

    let use_build_dir = request.use_build_dir.unwrap_or(false) && engine != "tectonic";
    let out_dir = if use_build_dir {
        let b = work_dir.join("build");
        let _ = fs::create_dir_all(&b);
        b
    } else {
        work_dir.to_path_buf()
    };

    let binary = resolve_compiler_binary(
        &request.distribution,
        &engine,
        &request.custom_bin_dir,
        &request.miktex_bin_dir,
        &request.texlive_bin_dir,
        &request.tectonic_bin_dir,
    );
    let mut cmd = silent_command(&binary);
    cmd.current_dir(work_dir);

    let used_command: String;
    if engine == "tectonic" {
        cmd.args(["-X", "compile", &main_filename, "--synctex"]);
        used_command = format!("{} -X compile {} --synctex", binary, main_filename);
    } else if engine == "latexmk" {
        let mut args = vec![
            "-pdf".to_string(),
            "-synctex=1".to_string(),
            "-interaction=nonstopmode".to_string(),
        ];
        if use_build_dir {
            args.push("-outdir=build".to_string());
        }
        args.push(main_filename.clone());
        cmd.args(&args);
        used_command = format!("{} {}", binary, args.join(" "));
    } else {
        let mut args = vec![
            "-synctex=1".to_string(),
            "-interaction=nonstopmode".to_string(),
        ];
        if use_build_dir {
            args.push("-output-directory=build".to_string());
        }
        args.push(main_filename.clone());
        cmd.args(&args);
        used_command = format!("{} {}", binary, args.join(" "));
    }

    let output = cmd
        .output()
        .map_err(|e| format!("Não foi possível executar '{}': {}. Verifique se o compilador está instalado.", binary, e))?;

    // Sequential Quick Build: if custom quick_build_steps are provided, run remaining steps;
    // otherwise if auto_run_bib is enabled, detect .bcf / \bibdata and run bib + 2 passes.
    if let Some(steps) = &request.quick_build_steps {
        if steps.len() > 1 {
            for step in steps.iter().skip(1) {
                let s = step.trim().to_lowercase();
                if s.is_empty() {
                    continue;
                }
                if s == "bibtex" || s == "biber" {
                    let arg = if s == "biber" {
                        format!("{}.bcf", stem)
                    } else {
                        format!("{}.aux", stem)
                    };
                    let bin = resolve_compiler_binary(
                        &request.distribution,
                        &s,
                        &request.custom_bin_dir,
                        &request.miktex_bin_dir,
                        &request.texlive_bin_dir,
                        &request.tectonic_bin_dir,
                    );
                    let _ = silent_command(&bin).current_dir(&out_dir).arg(&arg).output();
                } else if s == "makeindex" {
                    let bin = resolve_compiler_binary(
                        &request.distribution,
                        "makeindex",
                        &request.custom_bin_dir,
                        &request.miktex_bin_dir,
                        &request.texlive_bin_dir,
                        &request.tectonic_bin_dir,
                    );
                    let _ = silent_command(&bin)
                        .current_dir(&out_dir)
                        .arg(format!("{}.idx", stem))
                        .output();
                } else {
                    let bin = resolve_compiler_binary(
                        &request.distribution,
                        &s,
                        &request.custom_bin_dir,
                        &request.miktex_bin_dir,
                        &request.texlive_bin_dir,
                        &request.tectonic_bin_dir,
                    );
                    let mut args = vec![
                        "-synctex=1".to_string(),
                        "-interaction=nonstopmode".to_string(),
                    ];
                    if use_build_dir {
                        args.push("-output-directory=build".to_string());
                    }
                    args.push(main_filename.clone());
                    let _ = silent_command(&bin).current_dir(work_dir).args(&args).output();
                }
            }
        }
    } else if request.auto_run_bib.unwrap_or(false) && engine != "latexmk" && engine != "tectonic" {
        let bcf_path = out_dir.join(format!("{}.bcf", stem));
        let aux_path = out_dir.join(format!("{}.aux", stem));
        let aux_content = fs::read_to_string(&aux_path).unwrap_or_default();

        let bib_tool = if bcf_path.exists() {
            Some(("biber", format!("{}.bcf", stem)))
        } else if aux_content.contains("\\bibdata") {
            Some(("bibtex", format!("{}.aux", stem)))
        } else {
            None
        };

        if let Some((bib_name, bib_arg)) = bib_tool {
            let bib_bin = resolve_compiler_binary(
                &request.distribution,
                bib_name,
                &request.custom_bin_dir,
                &request.miktex_bin_dir,
                &request.texlive_bin_dir,
                &request.tectonic_bin_dir,
            );
            let mut bib_cmd = silent_command(&bib_bin);
            bib_cmd.current_dir(&out_dir);
            bib_cmd.arg(&bib_arg);
            let _ = bib_cmd.output();

            for _ in 0..2 {
                let mut pass_cmd = silent_command(&binary);
                pass_cmd.current_dir(work_dir);
                let mut pass_args = vec![
                    "-synctex=1".to_string(),
                    "-interaction=nonstopmode".to_string(),
                ];
                if use_build_dir {
                    pass_args.push("-output-directory=build".to_string());
                }
                pass_args.push(main_filename.clone());
                pass_cmd.args(&pass_args);
                let _ = pass_cmd.output();
            }
        }
    }

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();

    let log_path = out_dir.join(format!("{}.log", stem));
    let log_text = fs::read_to_string(&log_path).unwrap_or_else(|_| format!("{}\n{}", stdout, stderr));

    let pdf_path = out_dir.join(format!("{}.pdf", stem));
    let pdf_base64 = if pdf_path.exists() {
        fs::read(&pdf_path).ok().map(|bytes| BASE64.encode(bytes))
    } else {
        None
    };

    let synctex_path = out_dir.join(format!("{}.synctex.gz", stem));
    let synctex_available = synctex_path.exists();
    let diagnostics = parse_latex_log(&log_text, &request.main_file);

    Ok(CompileResult {
        success: output.status.success() && pdf_base64.is_some(),
        pdf_base64,
        log: log_text,
        diagnostics,
        duration_ms: start.elapsed().as_millis(),
        synctex_available,
        used_command,
    })
}

fn normalize_relative(project_dir: &Path, raw_file: &str) -> (String, String) {
    let cleaned = raw_file.replace("/./", "/").replace("\\.\\", "\\");
    let p = Path::new(&cleaned);
    let abs = if p.is_absolute() {
        p.to_path_buf()
    } else {
        project_dir.join(p)
    };
    let rel = abs
        .strip_prefix(project_dir)
        .unwrap_or(&abs)
        .to_string_lossy()
        .replace('\\', "/");
    (abs.to_string_lossy().to_string(), rel)
}

#[tauri::command]
fn synctex_lookup(
    project_dir: String,
    main_file: String,
    page: u32,
    x: f64,
    y: f64,
) -> Result<Option<SyncTexLocation>, String> {
    let project_path = Path::new(&project_dir);
    let main_full = project_path.join(&main_file);
    let work_dir = main_full.parent().unwrap_or(project_path);
    let stem = main_full
        .file_stem()
        .ok_or("Arquivo principal inválido")?
        .to_string_lossy()
        .to_string();
    let build_pdf = work_dir.join("build").join(format!("{}.pdf", stem));
    let pdf_path = if build_pdf.exists() {
        build_pdf
    } else {
        work_dir.join(format!("{}.pdf", stem))
    };
    let build_synctex = work_dir.join("build").join(format!("{}.synctex.gz", stem));
    let synctex_gz = if build_synctex.exists() {
        build_synctex
    } else {
        work_dir.join(format!("{}.synctex.gz", stem))
    };

    // 1. Try native synctex CLI if available
    if let Some(synctex_bin) = find_in_path("synctex") {
        let query = format!("{}:{}:{}:{}", page, x.round(), y.round(), pdf_path.to_string_lossy());
        if let Ok(out) = silent_command(&synctex_bin).args(["edit", "-o", &query]).output() {
            if out.status.success() {
                let text = String::from_utf8_lossy(&out.stdout);
                let mut found_file: Option<String> = None;
                let mut found_line: Option<u32> = None;
                for l in text.lines() {
                    if let Some(rest) = l.strip_prefix("Input:") {
                        found_file = Some(rest.trim().to_string());
                    } else if let Some(rest) = l.strip_prefix("Line:") {
                        found_line = rest.trim().parse::<u32>().ok();
                    }
                }
                if let (Some(f), Some(line)) = (found_file, found_line) {
                    let (abs_f, rel_f) = normalize_relative(project_path, &f);
                    return Ok(Some(SyncTexLocation {
                        file: abs_f,
                        relative_file: rel_f,
                        line,
                    }));
                }
            }
        }
    }

    // 2. Fallback: Built-in Rust .synctex.gz parser
    if !synctex_gz.exists() {
        return Ok(None);
    }

    let file = fs::File::open(&synctex_gz).map_err(|e| e.to_string())?;
    let mut decoder = GzDecoder::new(file);
    let mut content = String::new();
    decoder.read_to_string(&mut content).map_err(|e| e.to_string())?;

    let mut inputs: HashMap<u32, String> = HashMap::new();
    let mut current_page: u32 = 0;
    let mut best_dist = f64::MAX;
    let mut best_match: Option<(u32, u32)> = None;

    for line in content.lines() {
        if let Some(rest) = line.strip_prefix("Input:") {
            if let Some((id_str, path_str)) = rest.split_once(':') {
                if let Ok(id) = id_str.trim().parse::<u32>() {
                    inputs.insert(id, path_str.trim().to_string());
                }
            }
        } else if let Some(rest) = line.strip_prefix('{') {
            if let Ok(p) = rest.trim().parse::<u32>() {
                current_page = p;
            }
        } else if current_page == page {
            // SyncTeX node lines: h<tag>,<line>:<h>,<v>:<W>,<H>,<D> or x<tag>,<line>:<h>,<v>
            let first = line.chars().next().unwrap_or(' ');
            if matches!(first, 'h' | 'v' | 'x' | 'k' | 'g' | '$') {
                let body = &line[1..];
                if let Some((left, right)) = body.split_once(':') {
                    let mut left_parts = left.split(',');
                    let tag_opt = left_parts.next().and_then(|s| s.parse::<u32>().ok());
                    let line_opt = left_parts.next().and_then(|s| s.parse::<u32>().ok());
                    let coords_str = right.split(':').next().unwrap_or("");
                    let mut coord_parts = coords_str.split(',');
                    let hx_opt = coord_parts.next().and_then(|s| s.parse::<f64>().ok());
                    let vy_opt = coord_parts.next().and_then(|s| s.parse::<f64>().ok());

                    if let (Some(tag), Some(src_line), Some(hx_sp), Some(vy_sp)) =
                        (tag_opt, line_opt, hx_opt, vy_opt)
                    {
                        // 1 pt = 65536 TeX scaled points (sp)
                        let px = hx_sp / 65536.0;
                        let py = vy_sp / 65536.0;
                        let dist = (px - x).powi(2) + (py - y).powi(2);
                        if dist < best_dist && inputs.contains_key(&tag) {
                            best_dist = dist;
                            best_match = Some((tag, src_line));
                        }
                    }
                }
            }
        }
    }

    if let Some((tag, src_line)) = best_match {
        if let Some(raw_file) = inputs.get(&tag) {
            let (abs_f, rel_f) = normalize_relative(project_path, raw_file);
            return Ok(Some(SyncTexLocation {
                file: abs_f,
                relative_file: rel_f,
                line: src_line,
            }));
        }
    }

    Ok(None)
}

#[tauri::command]
fn synctex_forward(
    project_dir: String,
    main_file: String,
    file: String,
    line: u32,
) -> Result<Option<ForwardSyncLocation>, String> {
    let project_path = Path::new(&project_dir);
    let main_full = project_path.join(&main_file);
    let work_dir = main_full.parent().unwrap_or(project_path);
    let stem = main_full
        .file_stem()
        .ok_or("Arquivo principal inválido")?
        .to_string_lossy()
        .to_string();

    let build_synctex = work_dir.join("build").join(format!("{}.synctex.gz", stem));
    let synctex_gz = if build_synctex.exists() {
        build_synctex
    } else {
        work_dir.join(format!("{}.synctex.gz", stem))
    };

    if !synctex_gz.exists() {
        return Ok(None);
    }

    let target_abs = Path::new(&file)
        .canonicalize()
        .unwrap_or_else(|_| project_path.join(&file));
    let target_name = Path::new(&file)
        .file_name()
        .map(|s| s.to_string_lossy().to_lowercase())
        .unwrap_or_default();

    let f = fs::File::open(&synctex_gz).map_err(|e| e.to_string())?;
    let mut decoder = GzDecoder::new(f);
    let mut content = String::new();
    decoder.read_to_string(&mut content).map_err(|e| e.to_string())?;

    let mut matching_tags: Vec<u32> = Vec::new();
    let mut current_page: u32 = 0;
    let mut best_line_diff: u32 = u32::MAX;
    let mut best_loc: Option<ForwardSyncLocation> = None;

    for l in content.lines() {
        if let Some(rest) = l.strip_prefix("Input:") {
            if let Some((id_str, path_str)) = rest.split_once(':') {
                if let Ok(id) = id_str.trim().parse::<u32>() {
                    let cleaned = path_str.trim().replace("/./", "/").replace("\\.\\", "\\");
                    let p = Path::new(&cleaned);
                    let cand_abs = p.canonicalize().unwrap_or_else(|_| work_dir.join(p));
                    let cand_name = p
                        .file_name()
                        .map(|s| s.to_string_lossy().to_lowercase())
                        .unwrap_or_default();
                    if cand_abs == target_abs || (!target_name.is_empty() && cand_name == target_name) {
                        matching_tags.push(id);
                    }
                }
            }
        } else if let Some(rest) = l.strip_prefix('{') {
            if let Ok(p) = rest.trim().parse::<u32>() {
                current_page = p;
            }
        } else if current_page > 0 && !matching_tags.is_empty() {
            let first = l.chars().next().unwrap_or(' ');
            if matches!(first, 'h' | 'v' | 'x' | 'k' | 'g' | '$') {
                let body = &l[1..];
                if let Some((left, right)) = body.split_once(':') {
                    let mut left_parts = left.split(',');
                    let tag_opt = left_parts.next().and_then(|s| s.parse::<u32>().ok());
                    let line_opt = left_parts.next().and_then(|s| s.parse::<u32>().ok());
                    let coords_str = right.split(':').next().unwrap_or("");
                    let mut coord_parts = coords_str.split(',');
                    let hx_opt = coord_parts.next().and_then(|s| s.parse::<f64>().ok());
                    let vy_opt = coord_parts.next().and_then(|s| s.parse::<f64>().ok());

                    if let (Some(tag), Some(src_line), Some(hx_sp), Some(vy_sp)) =
                        (tag_opt, line_opt, hx_opt, vy_opt)
                    {
                        if matching_tags.contains(&tag) {
                            let diff = src_line.abs_diff(line);
                            if diff < best_line_diff {
                                best_line_diff = diff;
                                best_loc = Some(ForwardSyncLocation {
                                    page: current_page,
                                    x: hx_sp / 65536.0,
                                    y: vy_sp / 65536.0,
                                });
                                if diff == 0 {
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(best_loc)
}

#[tauri::command]
fn clean_auxiliary_files(project_dir: String, main_file: String) -> Result<u32, String> {
    let project_path = Path::new(&project_dir);
    let main_full = project_path.join(&main_file);
    let work_dir = main_full.parent().unwrap_or(project_path);

    let mut deleted: u32 = 0;
    for dir in [work_dir.to_path_buf(), work_dir.join("build")] {
        if !dir.exists() || !dir.is_dir() {
            continue;
        }
        if let Ok(entries) = fs::read_dir(&dir) {
            for entry in entries.flatten() {
                let p = entry.path();
                if p.is_file() {
                    let name = p
                        .file_name()
                        .map(|s| s.to_string_lossy().to_lowercase())
                        .unwrap_or_default();
                    let ext = p
                        .extension()
                        .map(|s| s.to_string_lossy().to_lowercase())
                        .unwrap_or_default();
                    if is_aux_extension(&ext) || name.ends_with(".synctex.gz") {
                        if fs::remove_file(&p).is_ok() {
                            deleted += 1;
                        }
                    }
                }
            }
        }
    }
    Ok(deleted)
}

fn extract_braced_arg(text: &str, cmd: &str) -> Option<String> {
    let pos = text.find(cmd)?;
    let after = &text[pos + cmd.len()..];
    let after_trim = after.trim_start();
    let after_opt = if after_trim.starts_with('[') {
        if let Some(end_opt) = after_trim.find(']') {
            after_trim[end_opt + 1..].trim_start()
        } else {
            after_trim
        }
    } else {
        after_trim
    };
    let rest = after_opt.strip_prefix('{')?;
    let end = rest.find('}')?;
    Some(rest[..end].trim().to_string())
}

fn collect_index_recursive(
    dir: &Path,
    root: &Path,
    bib_keys: &mut Vec<BibEntryInfo>,
    labels: &mut Vec<LabelInfo>,
    outline: &mut Vec<OutlineItem>,
) {
    let Ok(entries) = fs::read_dir(dir) else { return };
    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        if name == ".git" || name == "node_modules" || name == "build" {
            continue;
        }
        if path.is_dir() {
            collect_index_recursive(&path, root, bib_keys, labels, outline);
            continue;
        }
        let ext = path
            .extension()
            .map(|s| s.to_string_lossy().to_lowercase())
            .unwrap_or_default();
        let rel = path
            .strip_prefix(root)
            .unwrap_or(&path)
            .to_string_lossy()
            .replace('\\', "/");

        if ext == "tex" {
            if let Ok(text) = fs::read_to_string(&path) {
                for (idx, line) in text.lines().enumerate() {
                    let line_num = (idx + 1) as u32;
                    let trimmed = line.trim();
                    if trimmed.starts_with('%') {
                        continue;
                    }
                    for (cmd, kind) in [
                        ("\\part", "part"),
                        ("\\chapter", "chapter"),
                        ("\\section", "section"),
                        ("\\subsection", "subsection"),
                        ("\\subsubsection", "subsubsection"),
                    ] {
                        if trimmed.contains(cmd) {
                            if let Some(title) = extract_braced_arg(trimmed, cmd) {
                                outline.push(OutlineItem {
                                    kind: kind.to_string(),
                                    title,
                                    file: rel.clone(),
                                    line: line_num,
                                });
                            }
                        }
                    }
                    if trimmed.contains("\\label{") {
                        if let Some(lbl) = extract_braced_arg(trimmed, "\\label") {
                            labels.push(LabelInfo {
                                name: lbl.clone(),
                                file: rel.clone(),
                                line: line_num,
                            });
                            outline.push(OutlineItem {
                                kind: "label".to_string(),
                                title: lbl,
                                file: rel.clone(),
                                line: line_num,
                            });
                        }
                    }
                }
            }
        } else if ext == "bib" {
            if let Ok(text) = fs::read_to_string(&path) {
                let mut current_type = String::new();
                let mut current_key = String::new();
                let mut current_title = String::new();
                let mut current_author = String::new();

                for line in text.lines() {
                    let t = line.trim();
                    if t.starts_with('@') {
                        if !current_key.is_empty() {
                            bib_keys.push(BibEntryInfo {
                                key: current_key.clone(),
                                entry_type: current_type.clone(),
                                title: current_title.clone(),
                                author: current_author.clone(),
                                file: rel.clone(),
                            });
                        }
                        current_title.clear();
                        current_author.clear();
                        if let Some((left, right)) = t[1..].split_once('{') {
                            current_type = left.trim().to_lowercase();
                            current_key = right.split(',').next().unwrap_or("").trim().to_string();
                        } else {
                            current_key.clear();
                        }
                    } else if !current_key.is_empty() {
                        let lower = t.to_lowercase();
                        if lower.starts_with("title") {
                            if let Some((_, val)) = t.split_once('=') {
                                current_title = val
                                    .trim()
                                    .trim_end_matches(',')
                                    .trim_matches(|c| c == '{' || c == '}' || c == '"')
                                    .to_string();
                            }
                        } else if lower.starts_with("author") {
                            if let Some((_, val)) = t.split_once('=') {
                                current_author = val
                                    .trim()
                                    .trim_end_matches(',')
                                    .trim_matches(|c| c == '{' || c == '}' || c == '"')
                                    .to_string();
                            }
                        }
                    }
                }
                if !current_key.is_empty() {
                    bib_keys.push(BibEntryInfo {
                        key: current_key,
                        entry_type: current_type,
                        title: current_title,
                        author: current_author,
                        file: rel,
                    });
                }
            }
        }
    }
}

#[tauri::command]
fn scan_project_symbols(project_dir: String) -> Result<ProjectIndex, String> {
    let root = Path::new(&project_dir);
    if !root.exists() {
        return Err("Diretório do projeto não encontrado".to_string());
    }
    let mut bib_keys = Vec::new();
    let mut labels = Vec::new();
    let mut outline = Vec::new();
    collect_index_recursive(root, root, &mut bib_keys, &mut labels, &mut outline);
    Ok(ProjectIndex {
        bib_keys,
        labels,
        outline,
    })
}

#[tauri::command]
fn create_template_project(target_dir: String, template_id: String) -> Result<(), String> {
    let root = Path::new(&target_dir);
    fs::create_dir_all(root).map_err(|e| e.to_string())?;

    match template_id.as_str() {
        "abnt-thesis" => {
            fs::create_dir_all(root.join("chapters")).map_err(|e| e.to_string())?;
            fs::write(
                root.join("main.tex"),
                r#"\documentclass[12pt,a4paper]{report}
\usepackage[utf8]{inputenc}
\usepackage[T1]{fontenc}
\usepackage[brazil]{babel}
\usepackage{amsmath,amssymb,booktabs,graphicx}
\usepackage{hyperref}

\title{Título da Dissertação ou TCC}
\author{Autor(a)}
\date{\today}

\begin{document}
\maketitle
\tableofcontents

\include{chapters/introducao}
\include{chapters/metodologia}

\bibliographystyle{plain}
\bibliography{references}
\end{document}
"#,
            )
            .map_err(|e| e.to_string())?;
            fs::write(
                root.join("chapters/introducao.tex"),
                r#"\chapter{Introdução}
\label{chap:introducao}

Este trabalho foi estruturado no \textbf{ForjaTeX}. Veja a metodologia no Capítulo~\ref{chap:metodologia} e a referência~\cite{exemplo2026}.
"#,
            )
            .map_err(|e| e.to_string())?;
            fs::write(
                root.join("chapters/metodologia.tex"),
                r#"\chapter{Metodologia}
\label{chap:metodologia}

\section{Equação Fundamental}
\begin{equation}
E = mc^2
\end{equation}
"#,
            )
            .map_err(|e| e.to_string())?;
            fs::write(
                root.join("references.bib"),
                r#"@article{exemplo2026,
  author = {Silva, Maria},
  title = {Exemplo de Referência Bibliográfica},
  journal = {Revista Científica},
  year = {2026}
}
"#,
            )
            .map_err(|e| e.to_string())?;
        }
        "exam" => {
            fs::write(
                root.join("main.tex"),
                r#"\documentclass[11pt,a4paper,addpoints]{exam}
\usepackage[utf8]{inputenc}
\usepackage[T1]{fontenc}
\usepackage[brazil]{babel}
\usepackage{amsmath,amssymb}

\pagestyle{headandfoot}
\firstpageheader{Disciplina: Cálculo I}{Prova 1}{Data: \today}

\begin{document}
\begin{center}
  \fbox{\fbox{\parbox{5.5in}{\centering Responda com clareza e justifique seus passos. Total: \numpoints~pontos.}}}
\end{center}

\begin{questions}
  \question[5] Calcule a integral definida:
  \[
    \int_{0}^{1} (3x^2 + 2x)\,dx
  \]

  \question[5] Assinale a alternativa correta para $\lim_{x \to 0} \frac{\sin x}{x}$:
  \begin{choices}
    \choice $0$
    \CorrectChoice $1$
    \choice $\infty$
    \choice Não existe
  \end{choices}
\end{questions}
\end{document}
"#,
            )
            .map_err(|e| e.to_string())?;
        }
        "beamer" => {
            fs::write(
                root.join("main.tex"),
                r#"\documentclass{beamer}
\usetheme{Madrid}
\usepackage[utf8]{inputenc}
\usepackage[T1]{fontenc}
\usepackage[brazil]{babel}

\title{Apresentação no ForjaTeX}
\author{Seu Nome}
\date{\today}

\begin{document}
\begin{frame}
  \titlepage
\end{frame}

\begin{frame}{Tópicos Principais}
  \begin{itemize}
    \item Compilação local rápida sem timeouts
    \item SyncTeX bidirecional inteligente
    \item Copiloto de IA opcional (Split 70/30)
  \end{itemize}
\end{frame}
\end{document}
"#,
            )
            .map_err(|e| e.to_string())?;
        }
        _ => {
            fs::write(
                root.join("main.tex"),
                r#"\documentclass[12pt,a4paper]{article}
\usepackage[utf8]{inputenc}
\usepackage[T1]{fontenc}
\usepackage[brazil]{babel}
\usepackage{amsmath,amssymb,booktabs,graphicx}
\usepackage{hyperref}

\title{Artigo Científico}
\author{Autor(a)}
\date{\today}

\begin{document}
\maketitle

\begin{abstract}
Resumo do artigo gerado no ForjaTeX.
\end{abstract}

\section{Introdução}
\label{sec:intro}
Texto introdutório com citação~\cite{knuth1984}.

\section{Resultados}
\label{sec:resultados}
Veja a Seção~\ref{sec:intro}.

\bibliographystyle{plain}
\bibliography{references}
\end{document}
"#,
            )
            .map_err(|e| e.to_string())?;
            fs::write(
                root.join("references.bib"),
                r#"@book{knuth1984,
  author = {Knuth, Donald E.},
  title = {The TeXbook},
  publisher = {Addison-Wesley},
  year = {1984}
}
"#,
            )
            .map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

fn templates_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Erro ao localizar app_data_dir: {}", e))?;
    let dir = base.join("templates");
    fs::create_dir_all(&dir).map_err(|e| format!("Erro ao criar pasta de templates: {}", e))?;
    Ok(dir)
}

#[tauri::command]
fn list_custom_templates(app: tauri::AppHandle) -> Result<Vec<CustomTemplate>, String> {
    let dir = templates_dir(&app)?;
    let mut list = Vec::new();
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.extension().and_then(|s| s.to_str()) == Some("json") {
                if let Ok(raw) = fs::read_to_string(&p) {
                    if let Ok(tpl) = serde_json::from_str::<CustomTemplate>(&raw) {
                        list.push(tpl);
                    }
                }
            }
        }
    }
    list.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(list)
}

#[tauri::command]
fn save_custom_template(app: tauri::AppHandle, template: CustomTemplate) -> Result<(), String> {
    let dir = templates_dir(&app)?;
    let safe_id: String = template
        .id
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { '-' })
        .collect();
    let file_path = dir.join(format!("{}.json", safe_id));
    let json = serde_json::to_string_pretty(&template).map_err(|e| e.to_string())?;
    fs::write(file_path, json).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_custom_template(app: tauri::AppHandle, template_id: String) -> Result<(), String> {
    let dir = templates_dir(&app)?;
    let safe_id: String = template_id
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() || c == '-' || c == '_' { c } else { '-' })
        .collect();
    let file_path = dir.join(format!("{}.json", safe_id));
    if file_path.exists() {
        fs::remove_file(file_path).map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn collect_snapshot_entries(dir: &Path, root: &Path, out: &mut Vec<TemplateFileEntry>) {
    let Ok(entries) = fs::read_dir(dir) else { return };
    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        if name == ".git" || name == "node_modules" || name == "build" || name == ".DS_Store" {
            continue;
        }
        let rel = path
            .strip_prefix(root)
            .unwrap_or(&path)
            .to_string_lossy()
            .replace('\\', "/");

        if path.is_dir() {
            out.push(TemplateFileEntry {
                relative_path: rel,
                is_dir: true,
                content: String::new(),
            });
            collect_snapshot_entries(&path, root, out);
        } else {
            let ext = path
                .extension()
                .map(|s| s.to_string_lossy().to_lowercase())
                .unwrap_or_default();
            if is_aux_extension(&ext) || ext == "pdf" || name.ends_with(".synctex.gz") {
                continue;
            }
            if let Ok(text) = fs::read_to_string(&path) {
                out.push(TemplateFileEntry {
                    relative_path: rel,
                    is_dir: false,
                    content: text,
                });
            }
        }
    }
}

#[tauri::command]
fn snapshot_project_as_template(
    app: tauri::AppHandle,
    project_dir: String,
    name: String,
    description: String,
    main_file: String,
) -> Result<CustomTemplate, String> {
    let root = Path::new(&project_dir);
    if !root.exists() || !root.is_dir() {
        return Err("Pasta do projeto inválida".to_string());
    }
    let mut entries = Vec::new();
    collect_snapshot_entries(root, root, &mut entries);
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let slug: String = name
        .to_lowercase()
        .chars()
        .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
        .collect();
    let tpl = CustomTemplate {
        id: format!("{}-{}", slug.trim_matches('-'), ts),
        name,
        description,
        main_file,
        entries,
        created_at: ts,
    };
    save_custom_template(app, tpl.clone())?;
    Ok(tpl)
}

#[tauri::command]
fn instantiate_custom_template(
    target_dir: String,
    entries: Vec<TemplateFileEntry>,
    variables: HashMap<String, String>,
) -> Result<(), String> {
    let root = Path::new(&target_dir);
    fs::create_dir_all(root).map_err(|e| e.to_string())?;

    let replace_vars = |input: &str| -> String {
        let mut res = input.to_string();
        for (k, v) in &variables {
            res = res.replace(&format!("{{{{{}}}}}", k), v);
        }
        res
    };

    for entry in entries {
        let rel = replace_vars(&entry.relative_path);
        let full = root.join(rel);
        if entry.is_dir {
            fs::create_dir_all(&full).map_err(|e| e.to_string())?;
        } else {
            if let Some(parent) = full.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            let body = replace_vars(&entry.content);
            fs::write(&full, body).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
fn list_system_fonts() -> Vec<String> {
    let mut fonts = std::collections::BTreeSet::new();
    let mut dirs: Vec<PathBuf> = Vec::new();

    if cfg!(target_os = "windows") {
        dirs.push(PathBuf::from("C:\\Windows\\Fonts"));
        if let Ok(local) = std::env::var("LOCALAPPDATA") {
            dirs.push(PathBuf::from(format!("{}\\Microsoft\\Windows\\Fonts", local)));
        }
    } else if cfg!(target_os = "macos") {
        dirs.push(PathBuf::from("/System/Library/Fonts"));
        dirs.push(PathBuf::from("/Library/Fonts"));
        if let Ok(home) = std::env::var("HOME") {
            dirs.push(PathBuf::from(format!("{}/Library/Fonts", home)));
        }
    } else {
        dirs.push(PathBuf::from("/usr/share/fonts"));
        if let Ok(home) = std::env::var("HOME") {
            dirs.push(PathBuf::from(format!("{}/.local/share/fonts", home)));
        }
    }

    for d in dirs {
        if !d.exists() {
            continue;
        }
        if let Ok(entries) = fs::read_dir(&d) {
            for entry in entries.flatten() {
                let p = entry.path();
                if p.is_file() {
                    let ext = p
                        .extension()
                        .map(|s| s.to_string_lossy().to_lowercase())
                        .unwrap_or_default();
                    if ext == "ttf" || ext == "otf" {
                        if let Some(stem) = p.file_stem() {
                            fonts.insert(stem.to_string_lossy().to_string());
                        }
                    }
                }
            }
        }
    }

    fonts.into_iter().collect()
}

#[tauri::command]
fn copy_font_files_to_project(
    project_dir: String,
    files: Vec<String>,
) -> Result<Vec<String>, String> {
    let fonts_dir = Path::new(&project_dir).join("fonts");
    fs::create_dir_all(&fonts_dir).map_err(|e| format!("Erro ao criar pasta fonts/: {}", e))?;

    let mut copied = Vec::new();
    for src_str in files {
        let src = Path::new(&src_str);
        if src.exists() && src.is_file() {
            if let Some(fname) = src.file_name() {
                let dest = fonts_dir.join(fname);
                fs::copy(src, &dest).map_err(|e| format!("Erro ao copiar fonte: {}", e))?;
                copied.push(fname.to_string_lossy().to_string());
            }
        }
    }
    Ok(copied)
}

#[tauri::command]
fn import_overleaf_zip(zip_path: String, target_dir: String) -> Result<String, String> {
    let file = fs::File::open(&zip_path).map_err(|e| format!("Erro ao abrir ZIP: {}", e))?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| format!("ZIP inválido: {}", e))?;
    let dest_root = Path::new(&target_dir);
    fs::create_dir_all(dest_root).map_err(|e| format!("Erro ao criar pasta destino: {}", e))?;

    let mut first_tex: Option<String> = None;
    let mut found_main: Option<String> = None;

    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
        let Some(rel_path) = entry.enclosed_name().map(|p| p.to_path_buf()) else {
            continue;
        };
        let out_path = dest_root.join(&rel_path);
        if entry.is_dir() {
            fs::create_dir_all(&out_path).map_err(|e| e.to_string())?;
        } else {
            if let Some(parent) = out_path.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            let mut out_file = fs::File::create(&out_path).map_err(|e| e.to_string())?;
            std::io::copy(&mut entry, &mut out_file).map_err(|e| e.to_string())?;

            let rel_str = rel_path.to_string_lossy().replace('\\', "/");
            if rel_str.to_lowercase().ends_with(".tex") {
                if first_tex.is_none() {
                    first_tex = Some(rel_str.clone());
                }
                if rel_path.file_name().and_then(|s| s.to_str()).map(|s| s.eq_ignore_ascii_case("main.tex")).unwrap_or(false) {
                    found_main = Some(rel_str);
                }
            }
        }
    }

    Ok(found_main.or(first_tex).unwrap_or_else(|| "main.tex".to_string()))
}

#[tauri::command]
fn install_tex_package(package_name: String, distribution: String) -> Result<String, String> {
    let clean_pkg: String = package_name
        .trim()
        .trim_end_matches(".sty")
        .trim_end_matches(".cls")
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_')
        .collect();

    if clean_pkg.is_empty() {
        return Err("Nome de pacote inválido.".to_string());
    }

    let use_miktex = if distribution == "miktex" {
        true
    } else if distribution == "texlive" {
        false
    } else {
        check_known_locations("miktex", "mpm").is_some() || find_in_path("mpm").is_some()
    };

    if use_miktex {
        let mpm = check_known_locations("miktex", "mpm").unwrap_or_else(|| "mpm".to_string());
        let out = silent_command(&mpm)
            .args(["--install", &clean_pkg])
            .output()
            .map_err(|e| format!("Falha ao executar mpm: {}", e))?;
        if out.status.success() {
            Ok(format!("Pacote '{}' instalado via MiKTeX (mpm).", clean_pkg))
        } else {
            Err(format!(
                "mpm falhou: {}",
                String::from_utf8_lossy(&out.stderr)
            ))
        }
    } else {
        let tlmgr = check_known_locations("texlive", "tlmgr").unwrap_or_else(|| "tlmgr".to_string());
        let out = silent_command(&tlmgr)
            .args(["install", &clean_pkg])
            .output()
            .map_err(|e| format!("Falha ao executar tlmgr: {}", e))?;
        if out.status.success() {
            Ok(format!("Pacote '{}' instalado via TeX Live (tlmgr).", clean_pkg))
        } else {
            Err(format!(
                "tlmgr falhou: {}",
                String::from_utf8_lossy(&out.stderr)
            ))
        }
    }
}

#[derive(Serialize)]
struct GitFileChange {
    status: String,
    path: String,
}

#[derive(Serialize)]
struct GitCommitEntry {
    hash: String,
    author: String,
    date: String,
    message: String,
}

#[derive(Serialize)]
struct GitStatusInfo {
    git_installed: bool,
    is_repo: bool,
    branch: String,
    remote_url: String,
    user_name: String,
    user_email: String,
    changes: Vec<GitFileChange>,
    commits: Vec<GitCommitEntry>,
}

fn run_git(project_dir: &str, args: &[&str]) -> Result<std::process::Output, String> {
    silent_command("git")
        .args(args)
        .current_dir(project_dir)
        .output()
        .map_err(|e| format!("Falha ao executar git: {}", e))
}

#[tauri::command]
fn git_status(project_dir: String) -> Result<GitStatusInfo, String> {
    let ver = silent_command("git").arg("--version").output();
    if ver.map(|o| !o.status.success()).unwrap_or(true) {
        return Ok(GitStatusInfo {
            git_installed: false,
            is_repo: false,
            branch: String::new(),
            remote_url: String::new(),
            user_name: String::new(),
            user_email: String::new(),
            changes: vec![],
            commits: vec![],
        });
    }

    let uname_out = silent_command("git").args(["config", "user.name"]).output();
    let user_name = uname_out
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_default();

    let uemail_out = silent_command("git").args(["config", "user.email"]).output();
    let user_email = uemail_out
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .unwrap_or_default();

    let inside = run_git(&project_dir, &["rev-parse", "--is-inside-work-tree"])?;
    if !inside.status.success() {
        return Ok(GitStatusInfo {
            git_installed: true,
            is_repo: false,
            branch: String::new(),
            remote_url: String::new(),
            user_name,
            user_email,
            changes: vec![],
            commits: vec![],
        });
    }

    let branch_out = run_git(&project_dir, &["rev-parse", "--abbrev-ref", "HEAD"])?;
    let branch = String::from_utf8_lossy(&branch_out.stdout).trim().to_string();

    let remote_out = run_git(&project_dir, &["remote", "get-url", "origin"])?;
    let remote_url = if remote_out.status.success() {
        String::from_utf8_lossy(&remote_out.stdout).trim().to_string()
    } else {
        String::new()
    };

    let status_out = run_git(&project_dir, &["status", "--porcelain"])?;
    let mut changes = Vec::new();
    for line in String::from_utf8_lossy(&status_out.stdout).lines() {
        if line.len() >= 4 {
            let status = line[..2].trim().to_string();
            let path = line[3..].trim().to_string();
            changes.push(GitFileChange { status, path });
        }
    }

    let log_out = run_git(
        &project_dir,
        &["log", "-n", "12", "--pretty=format:%h|%an|%ad|%s", "--date=short"],
    )?;
    let mut commits = Vec::new();
    if log_out.status.success() {
        for line in String::from_utf8_lossy(&log_out.stdout).lines() {
            let parts: Vec<&str> = line.splitn(4, '|').collect();
            if parts.len() == 4 {
                commits.push(GitCommitEntry {
                    hash: parts[0].to_string(),
                    author: parts[1].to_string(),
                    date: parts[2].to_string(),
                    message: parts[3].to_string(),
                });
            }
        }
    }

    Ok(GitStatusInfo {
        git_installed: true,
        is_repo: true,
        branch,
        remote_url,
        user_name,
        user_email,
        changes,
        commits,
    })
}

#[tauri::command]
fn git_set_user_config(name: String, email: String) -> Result<String, String> {
    let n = name.trim();
    let e = email.trim();
    if n.is_empty() || e.is_empty() {
        return Err("Informe nome e e-mail do Git.".to_string());
    }
    let o1 = silent_command("git")
        .args(["config", "--global", "user.name", n])
        .output()
        .map_err(|err| format!("Falha ao configurar user.name: {}", err))?;
    if !o1.status.success() {
        return Err(String::from_utf8_lossy(&o1.stderr).to_string());
    }
    let o2 = silent_command("git")
        .args(["config", "--global", "user.email", e])
        .output()
        .map_err(|err| format!("Falha ao configurar user.email: {}", err))?;
    if !o2.status.success() {
        return Err(String::from_utf8_lossy(&o2.stderr).to_string());
    }
    Ok("Identidade global do Git salva com sucesso.".to_string())
}

#[tauri::command]
fn git_init(project_dir: String) -> Result<String, String> {
    let out = run_git(&project_dir, &["init", "-b", "main"])?;
    if out.status.success() {
        Ok("Repositório Git inicializado (branch main).".to_string())
    } else {
        let fallback = run_git(&project_dir, &["init"])?;
        if fallback.status.success() {
            Ok("Repositório Git inicializado.".to_string())
        } else {
            Err(String::from_utf8_lossy(&fallback.stderr).to_string())
        }
    }
}

#[tauri::command]
fn git_create_latex_gitignore(project_dir: String) -> Result<String, String> {
    let gi_path = Path::new(&project_dir).join(".gitignore");
    let content = "# LaTeX arquivos auxiliares (ForjaTeX)\n*.aux\n*.log\n*.synctex.gz\n*.toc\n*.lof\n*.lot\n*.out\n*.bbl\n*.blg\n*.bcf\n*.run.xml\n*.fls\n*.fdb_latexmk\n*.nav\n*.snm\n*.vrb\n*.idx\n*.ind\n*.ilg\n";
    fs::write(&gi_path, content).map_err(|e| format!("Falha ao gravar .gitignore: {}", e))?;
    Ok(".gitignore LaTeX criado com sucesso.".to_string())
}

#[tauri::command]
fn git_save_credential(host: String, username: String, token: String) -> Result<String, String> {
    use std::io::Write;
    let h = host.trim();
    let u = if username.trim().is_empty() { "oauth2" } else { username.trim() };
    let t = token.trim();
    if h.is_empty() || t.is_empty() {
        return Err("Informe o host (ex: github.com) e o Token (PAT).".to_string());
    }
    let mut child = silent_command("git")
        .args(["credential", "approve"])
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Falha ao iniciar git credential: {}", e))?;
    if let Some(mut stdin) = child.stdin.take() {
        let payload = format!("protocol=https\nhost={}\nusername={}\npassword={}\n\n", h, u, t);
        let _ = stdin.write_all(payload.as_bytes());
    }
    let out = child
        .wait_with_output()
        .map_err(|e| format!("Falha ao salvar credencial: {}", e))?;
    if out.status.success() {
        Ok(format!("Token salvo no gerenciador de credenciais para {}.", h))
    } else {
        Err(String::from_utf8_lossy(&out.stderr).to_string())
    }
}

#[tauri::command]
fn git_clone(url: String, target_dir: String) -> Result<String, String> {
    let clean = url.trim();
    if clean.is_empty() {
        return Err("Informe a URL do repositório para clonar.".to_string());
    }
    let out = silent_command("git")
        .args(["clone", clean, &target_dir])
        .output()
        .map_err(|e| format!("Falha ao executar git clone: {}", e))?;
    if out.status.success() {
        Ok("Repositório clonado com sucesso.".to_string())
    } else {
        Err(String::from_utf8_lossy(&out.stderr).to_string())
    }
}

#[tauri::command]
fn git_commit_all(project_dir: String, message: String) -> Result<String, String> {
    let msg = message.trim();
    if msg.is_empty() {
        return Err("Informe uma mensagem de commit.".to_string());
    }
    let add = run_git(&project_dir, &["add", "-A"])?;
    if !add.status.success() {
        return Err(String::from_utf8_lossy(&add.stderr).to_string());
    }
    let commit = run_git(&project_dir, &["commit", "-m", msg])?;
    if commit.status.success() {
        Ok(String::from_utf8_lossy(&commit.stdout).trim().to_string())
    } else {
        let err = String::from_utf8_lossy(&commit.stderr).trim().to_string();
        let out = String::from_utf8_lossy(&commit.stdout).trim().to_string();
        Err(if err.is_empty() { out } else { err })
    }
}

#[tauri::command]
fn git_set_remote(project_dir: String, url: String) -> Result<String, String> {
    let clean = url.trim();
    if clean.is_empty() {
        return Err("Informe a URL do repositório remoto.".to_string());
    }
    let existing = run_git(&project_dir, &["remote", "get-url", "origin"])?;
    let out = if existing.status.success() {
        run_git(&project_dir, &["remote", "set-url", "origin", clean])?
    } else {
        run_git(&project_dir, &["remote", "add", "origin", clean])?
    };
    if out.status.success() {
        Ok("Remoto 'origin' configurado.".to_string())
    } else {
        Err(String::from_utf8_lossy(&out.stderr).to_string())
    }
}

#[tauri::command]
fn git_push(project_dir: String) -> Result<String, String> {
    let out = run_git(&project_dir, &["push", "-u", "origin", "HEAD"])?;
    if out.status.success() {
        Ok("Push concluído com sucesso.".to_string())
    } else {
        Err(String::from_utf8_lossy(&out.stderr).to_string())
    }
}

#[tauri::command]
fn git_pull(project_dir: String) -> Result<String, String> {
    let out = run_git(&project_dir, &["pull"])?;
    if out.status.success() {
        Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
    } else {
        Err(String::from_utf8_lossy(&out.stderr).to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            detect_compilers,
            test_compiler,
            scan_project,
            read_project_file,
            write_project_file,
            create_project_entry,
            load_existing_pdf,
            compile_latex,
            synctex_lookup,
            synctex_forward,
            clean_auxiliary_files,
            scan_project_symbols,
            create_template_project,
            list_custom_templates,
            save_custom_template,
            delete_custom_template,
            snapshot_project_as_template,
            instantiate_custom_template,
            list_system_fonts,
            copy_font_files_to_project,
            import_overleaf_zip,
            install_tex_package,
            git_status,
            git_init,
            git_commit_all,
            git_set_remote,
            git_push,
            git_pull,
            git_set_user_config,
            git_create_latex_gitignore,
            git_save_credential,
            git_clone
        ])
        .run(tauri::generate_context!())
        .expect("error while building ForjaTeX");
}
