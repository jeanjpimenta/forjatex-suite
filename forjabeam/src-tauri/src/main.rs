#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::Path;
use std::process::Command;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[derive(serde::Serialize)]
struct CompileBeamerResult {
    message: String,
    pdf_path: String,
}

fn launch_os_path(path: &Path) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg(path)
            .spawn()
            .map_err(|e| format!("Falha ao abrir arquivo: {}", e))?;
    }
    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(path)
            .spawn()
            .map_err(|e| format!("Falha ao abrir arquivo: {}", e))?;
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(path)
            .spawn()
            .map_err(|e| format!("Falha ao abrir arquivo: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
fn save_text_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content).map_err(|e| format!("Falha ao salvar arquivo: {}", e))
}

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("Falha ao abrir arquivo: {}", e))
}

#[tauri::command]
fn open_file_path(path: String) -> Result<(), String> {
    let target = Path::new(&path);
    if !target.exists() {
        return Err(format!("Arquivo não encontrado: {}", path));
    }
    launch_os_path(target)
}

#[tauri::command]
fn compile_beamer_pdf(tex_full: String, file_stamp: Option<String>) -> Result<CompileBeamerResult, String> {
    let dir = std::env::temp_dir().join("forjabeam-preview");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let raw_stamp = file_stamp.unwrap_or_else(|| "preview".to_string());
    let safe_stamp: String = raw_stamp
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_')
        .collect();
    let base_name = if safe_stamp.is_empty() {
        "forjabeam_preview".to_string()
    } else {
        format!("forjabeam_{}", safe_stamp)
    };
    let tex_filename = format!("{}.tex", base_name);
    let pdf_filename = format!("{}.pdf", base_name);
    let tex_path = dir.join(&tex_filename);
    let pdf_path = dir.join(&pdf_filename);

    fs::write(&tex_path, &tex_full).map_err(|e| e.to_string())?;

    // Run pdflatex twice when toc/references might need a second pass
    let mut last_out = None;
    for _ in 0..2 {
        let mut cmd = Command::new("pdflatex");
        #[cfg(target_os = "windows")]
        cmd.creation_flags(0x08000000);
        let out = cmd
            .args(["-interaction=nonstopmode", &tex_filename])
            .current_dir(&dir)
            .output()
            .map_err(|e| format!("pdflatex não encontrado: {}", e))?;
        let ok = out.status.success();
        last_out = Some(out);
        if !ok {
            break;
        }
    }

    if let Some(out) = last_out {
        if out.status.success() && pdf_path.exists() {
            let pdf_str = pdf_path.to_string_lossy().to_string();
            return Ok(CompileBeamerResult {
                message: format!("Apresentação compilada! PDF gerado em: {}", pdf_str),
                pdf_path: pdf_str,
            });
        }
        let errors: Vec<&str> = std::str::from_utf8(&out.stdout)
            .unwrap_or("")
            .lines()
            .filter(|l| l.starts_with('!'))
            .collect();
        return Err(format!(
            "Erro na compilação Beamer:\n{}",
            if errors.is_empty() {
                "Verifique pacotes instalados (ex: beamer, pgfpages, listings).".to_string()
            } else {
                errors.join("\n")
            }
        ));
    }

    Err("Falha inesperada ao executar pdflatex.".to_string())
}

#[tauri::command]
fn launch_forjaslide_with_pdf(pdf_path: String) -> Result<(), String> {
    let mut candidates: Vec<std::path::PathBuf> = Vec::new();
    #[cfg(target_os = "windows")]
    {
        if let Ok(local) = std::env::var("LOCALAPPDATA") {
            candidates.push(Path::new(&local).join("ForjaSlide").join("forjaslide.exe"));
            candidates.push(Path::new(&local).join("Programs").join("ForjaSlide").join("forjaslide.exe"));
        }
        if let Ok(pf) = std::env::var("ProgramFiles") {
            candidates.push(Path::new(&pf).join("ForjaSlide").join("forjaslide.exe"));
        }
    }
    #[cfg(target_os = "linux")]
    {
        candidates.push(Path::new("/usr/bin/forjaslide").to_path_buf());
        candidates.push(Path::new("/usr/local/bin/forjaslide").to_path_buf());
    }

    for exe in candidates {
        if exe.exists() {
            Command::new(&exe)
                .arg(&pdf_path)
                .spawn()
                .map_err(|e| format!("Falha ao abrir ForjaSlide: {}", e))?;
            return Ok(());
        }
    }
    Err("ForjaSlide não encontrado no sistema. Instale-o pelo ForjaTeX App Suite ou abra o PDF manualmente no ForjaSlide.".to_string())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            save_text_file,
            read_text_file,
            open_file_path,
            compile_beamer_pdf,
            launch_forjaslide_with_pdf
        ])
        .run(tauri::generate_context!())
        .expect("error while running ForjaBeam");
}

