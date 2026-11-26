#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::process::Command;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[derive(serde::Serialize)]
struct CompileCheckResult {
    message: String,
    pdf_path: String,
}

fn launch_os_path(path: &std::path::Path) -> Result<(), String> {
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
fn save_tex_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content).map_err(|e| format!("Falha ao salvar arquivo: {}", e))
}

#[tauri::command]
fn read_project_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("Falha ao abrir projeto: {}", e))
}

#[tauri::command]
fn open_file_path(path: String) -> Result<(), String> {
    let target = std::path::Path::new(&path);
    if !target.exists() {
        return Err(format!("Arquivo não encontrado: {}", path));
    }
    launch_os_path(target)
}

#[tauri::command]
fn compile_tikz_check(
    tex_snippet: String,
    file_stamp: Option<String>,
) -> Result<CompileCheckResult, String> {
    let dir = std::env::temp_dir().join("forjatikz-preview");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let raw_stamp = file_stamp.unwrap_or_else(|| "preview".to_string());
    let safe_stamp: String = raw_stamp
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_')
        .collect();
    let base_name = if safe_stamp.is_empty() {
        "forjatikz_preview".to_string()
    } else {
        format!("forjatikz_{}", safe_stamp)
    };
    let tex_filename = format!("{}.tex", base_name);
    let pdf_filename = format!("{}.pdf", base_name);
    let tex_path = dir.join(&tex_filename);
    let pdf_path = dir.join(&pdf_filename);
    let mut pgf_libs: Vec<&str> = Vec::new();
    if tex_snippet.contains("fill between") {
        pgf_libs.push("fillbetween");
    }
    if tex_snippet.contains("groupplot") {
        pgf_libs.push("groupplots");
    }
    if tex_snippet.contains("polaraxis") {
        pgf_libs.push("polar");
    }
    if tex_snippet.contains("ternaryaxis") {
        pgf_libs.push("ternary");
    }
    if tex_snippet.contains("smithchart") {
        pgf_libs.push("smithchart");
    }
    let pgf_lib_line = if pgf_libs.is_empty() {
        String::new()
    } else {
        format!("\\usepgfplotslibrary{{{}}}\n", pgf_libs.join(","))
    };
    let mut extra_pkgs = String::new();
    if tex_snippet.contains("circuitikz") {
        extra_pkgs.push_str("\\usepackage{circuitikz}\n");
    }
    let mut tikz_libs = vec![
        "arrows.meta",
        "positioning",
        "fit",
        "shapes.geometric",
        "calc",
        "decorations.pathmorphing",
        "decorations.pathreplacing",
    ];
    if tex_snippet.contains("tikzcd") {
        tikz_libs.push("cd");
    }
    if tex_snippet.contains("state") {
        tikz_libs.push("automata");
    }
    let full = format!(
        "\\documentclass[tikz,border=4pt]{{standalone}}\n\\usepackage{{pgfplots,pgfplotstable}}\n{}\\pgfplotsset{{compat=1.18}}\n{}\\usetikzlibrary{{{}}}\n\\begin{{document}}\n{}\n\\end{{document}}\n",
        extra_pkgs,
        pgf_lib_line,
        tikz_libs.join(","),
        tex_snippet
    );
    fs::write(&tex_path, full).map_err(|e| e.to_string())?;

    let mut cmd = Command::new("pdflatex");
    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000);
    let out = cmd
        .args(["-interaction=nonstopmode", &tex_filename])
        .current_dir(&dir)
        .output()
        .map_err(|e| format!("pdflatex não encontrado: {}", e))?;

    if out.status.success() {
        let pdf_str = pdf_path.to_string_lossy().to_string();
        Ok(CompileCheckResult {
            message: format!("Compilado com sucesso! PDF gerado em: {}", pdf_str),
            pdf_path: pdf_str,
        })
    } else {
        Err(format!(
            "Erro na compilação TikZ/PGF:\n{}",
            String::from_utf8_lossy(&out.stdout)
                .lines()
                .filter(|l| l.starts_with('!'))
                .collect::<Vec<_>>()
                .join("\n")
        ))
    }
}

#[tauri::command]
fn open_manual_pdf(file_name: String, bytes: Vec<u8>) -> Result<(), String> {
    let dir = std::env::temp_dir().join("forjatex-manuals");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let safe_name = std::path::Path::new(&file_name)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("manual.pdf");
    let dest = dir.join(safe_name);
    fs::write(&dest, bytes).map_err(|e| format!("Falha ao salvar manual: {}", e))?;
    launch_os_path(&dest)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            save_tex_file,
            read_project_file,
            open_file_path,
            compile_tikz_check,
            open_manual_pdf
        ])
        .run(tauri::generate_context!())
        .expect("error while running ForjaTikZ");
}

