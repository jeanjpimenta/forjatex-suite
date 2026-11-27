#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::Path;
use std::process::Command;

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
fn fetch_url_text(url: String, accept: Option<String>) -> Result<String, String> {
    let mut req = ureq::get(&url).set("User-Agent", "ForjaBib/1.0 (https://forjatex.com.br)");
    if let Some(acc) = accept {
        req = req.set("Accept", &acc);
    }
    let resp = req.call().map_err(|e| format!("Erro na consulta HTTP: {}", e))?;
    resp.into_string()
        .map_err(|e| format!("Falha ao ler resposta: {}", e))
}

#[tauri::command]
fn open_manual_pdf(file_name: String, bytes: Vec<u8>) -> Result<(), String> {
    let dir = std::env::temp_dir().join("forjatex-manuals");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let safe_name = Path::new(&file_name)
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
            save_text_file,
            read_text_file,
            fetch_url_text,
            open_manual_pdf
        ])
        .run(tauri::generate_context!())
        .expect("error while running ForjaBib");
}

