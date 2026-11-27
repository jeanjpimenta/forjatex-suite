#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::Path;
use tauri::{Emitter, Manager, PhysicalPosition, PhysicalSize, WebviewUrl, WebviewWindowBuilder};

#[derive(serde::Serialize)]
struct MonitorInfo {
    index: usize,
    name: String,
    width: u32,
    height: u32,
    x: i32,
    y: i32,
}

#[tauri::command]
fn list_monitors(app: tauri::AppHandle) -> Result<Vec<MonitorInfo>, String> {
    let monitors = app.available_monitors().map_err(|e| e.to_string())?;
    Ok(monitors
        .into_iter()
        .enumerate()
        .map(|(index, m)| {
            let size = m.size();
            let pos = m.position();
            let raw_name = m
                .name()
                .map(|n| n.to_string())
                .unwrap_or_else(|| format!("Monitor {}", index + 1));
            MonitorInfo {
                index,
                name: format!("{} ({}×{})", raw_name, size.width, size.height),
                width: size.width,
                height: size.height,
                x: pos.x,
                y: pos.y,
            }
        })
        .collect())
}

#[tauri::command]
fn open_audience_window(app: tauri::AppHandle, monitor_index: usize) -> Result<(), String> {
    let monitors = app.available_monitors().map_err(|e| e.to_string())?;
    let target_mon = monitors.get(monitor_index).or_else(|| monitors.first());

    if let Some(existing) = app.get_webview_window("audience") {
        if let Some(m) = target_mon {
            let _ = existing.set_position(PhysicalPosition::new(m.position().x, m.position().y));
            let _ = existing.set_size(PhysicalSize::new(m.size().width, m.size().height));
        }
        let _ = existing.set_fullscreen(true);
        let _ = existing.show();
        let _ = existing.set_focus();
        return Ok(());
    }

    let mut builder = WebviewWindowBuilder::new(
        &app,
        "audience",
        WebviewUrl::App("index.html?view=audience".into()),
    )
    .title("ForjaSlide — Público")
    .decorations(false)
    .always_on_top(false);

    if let Some(m) = target_mon {
        builder = builder
            .position(m.position().x as f64, m.position().y as f64)
            .inner_size(m.size().width as f64, m.size().height as f64);
    }

    let win = builder.build().map_err(|e| format!("Falha ao abrir janela do público: {}", e))?;
    let _ = win.set_fullscreen(true);
    Ok(())
}

#[tauri::command]
fn close_audience_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("audience") {
        win.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn sync_slide_state(app: tauri::AppHandle, state_json: String) -> Result<(), String> {
    app.emit("slide-sync", state_json).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_pdf_bytes(path: String) -> Result<Vec<u8>, String> {
    fs::read(&path).map_err(|e| format!("Falha ao ler PDF: {}", e))
}

#[tauri::command]
fn save_text_file(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content).map_err(|e| format!("Falha ao salvar arquivo: {}", e))
}

#[tauri::command]
fn read_text_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("Falha ao ler arquivo: {}", e))
}

#[tauri::command]
fn get_initial_pdf_arg() -> Option<String> {
    std::env::args().skip(1).find(|a| {
        let low = a.to_lowercase();
        low.ends_with(".pdf") && Path::new(a).exists()
    })
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
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&dest)
            .spawn()
            .map_err(|e| format!("Falha ao abrir PDF: {}", e))?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&dest)
            .spawn()
            .map_err(|e| format!("Falha ao abrir PDF: {}", e))?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
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
        .invoke_handler(tauri::generate_handler![
            list_monitors,
            open_audience_window,
            close_audience_window,
            sync_slide_state,
            read_pdf_bytes,
            save_text_file,
            read_text_file,
            get_initial_pdf_arg,
            open_manual_pdf
        ])
        .run(tauri::generate_context!())
        .expect("error while running ForjaSlide");
}

