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
    let full = format!(
        "\\documentclass[tikz,border=4pt]{{standalone}}\n\\usepackage{{pgfplots}}\n\\pgfplotsset{{compat=1.18}}\n\\usetikzlibrary{{arrows.meta,positioning}}\n\\begin{{document}}\n{}\n\\end{{document}}\n",
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

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![save_tex_file, compile_tikz_check])
        .run(tauri::generate_context!())
        .expect("error while running ForjaTikZ");
}

