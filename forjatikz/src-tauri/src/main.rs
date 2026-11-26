#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::process::Command;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[tauri::command]
fn save_tex_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content).map_err(|e| format!("Falha ao salvar arquivo: {}", e))
}

#[tauri::command]
fn compile_tikz_check(tex_snippet: String) -> Result<String, String> {
    let dir = std::env::temp_dir().join("forjatikz-preview");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let tex_path = dir.join("preview.tex");
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
        .args(["-interaction=nonstopmode", "preview.tex"])
        .current_dir(&dir)
        .output()
        .map_err(|e| format!("pdflatex não encontrado: {}", e))?;

    if out.status.success() {
        Ok(format!(
            "Compilado com sucesso! PDF gerado em: {}",
            dir.join("preview.pdf").to_string_lossy()
        ))
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
    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .arg(&dest)
            .spawn()
            .map_err(|e| format!("Falha ao abrir PDF: {}", e))?;
    }
    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(&dest)
            .spawn()
            .map_err(|e| format!("Falha ao abrir PDF: {}", e))?;
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&dest)
            .spawn()
            .map_err(|e| format!("Falha ao abrir PDF: {}", e))?;
    }
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![save_tex_file, compile_tikz_check, open_manual_pdf])
        .run(tauri::generate_context!())
        .expect("error while running ForjaTikZ");
}

