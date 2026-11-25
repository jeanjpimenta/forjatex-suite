#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
use std::path::Path;
use std::process::Command;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

fn silent_command(program: &str) -> Command {
    let mut cmd = Command::new(program);
    #[cfg(target_os = "windows")]
    cmd.creation_flags(0x08000000);
    cmd
}

#[derive(Serialize)]
struct InstalledAppInfo {
    id: String,
    installed: bool,
    exe_path: Option<String>,
    version: Option<String>,
}

fn find_windows_app(display_names: &[&str], exe_names: &[&str]) -> (bool, Option<String>, Option<String>) {
    #[cfg(target_os = "windows")]
    {
        let local_app_data = std::env::var("LOCALAPPDATA").unwrap_or_default();
        let program_files = std::env::var("ProgramFiles").unwrap_or_else(|_| "C:\\Program Files".to_string());
        for folder in display_names {
            for exe in exe_names {
                let p1 = Path::new(&local_app_data).join(folder).join(exe);
                if p1.exists() {
                    return (true, Some(p1.to_string_lossy().to_string()), None);
                }
                let p2 = Path::new(&program_files).join(folder).join(exe);
                if p2.exists() {
                    return (true, Some(p2.to_string_lossy().to_string()), None);
                }
            }
        }
    }
    let _ = (display_names, exe_names);
    (false, None, None)
}

#[tauri::command]
fn check_installed_apps() -> Vec<InstalledAppInfo> {
    let specs = [
        ("forjatex", vec!["ForjaTeX"], vec!["forjatex.exe", "ForjaTeX.exe"]),
        ("forjatikz", vec!["ForjaTikZ"], vec!["forjatikz.exe", "ForjaTikZ.exe"]),
        ("forjasnap", vec!["ForjaSnap"], vec!["forjasnap.exe"]),
        ("forjabib", vec!["ForjaBib"], vec!["forjabib.exe"]),
        ("forjadiff", vec!["ForjaDiff"], vec!["forjadiff.exe"]),
    ];

    specs
        .iter()
        .map(|(id, dirs, exes)| {
            let (installed, exe_path, version) = find_windows_app(dirs, exes);
            InstalledAppInfo {
                id: id.to_string(),
                installed,
                exe_path,
                version,
            }
        })
        .collect()
}

#[tauri::command]
fn launch_app(exe_path: String) -> Result<(), String> {
    if !Path::new(&exe_path).exists() {
        return Err(format!("Executável não encontrado: {}", exe_path));
    }
    Command::new(&exe_path)
        .spawn()
        .map_err(|e| format!("Falha ao abrir aplicativo: {}", e))?;
    Ok(())
}

#[tauri::command]
fn fetch_manifest_json(url: String) -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        let script = format!(
            "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (Invoke-WebRequest -Uri '{}' -UseBasicParsing).Content",
            url.replace('\'', "''")
        );
        let out = silent_command("powershell")
            .args(["-NoProfile", "-Command", &script])
            .output()
            .map_err(|e| format!("Falha ao buscar manifesto: {}", e))?;
        if out.status.success() {
            Ok(String::from_utf8_lossy(&out.stdout).to_string())
        } else {
            Err(String::from_utf8_lossy(&out.stderr).to_string())
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        let out = Command::new("curl")
            .args(["-fsSL", &url])
            .output()
            .map_err(|e| format!("Falha ao buscar manifesto: {}", e))?;
        if out.status.success() {
            Ok(String::from_utf8_lossy(&out.stdout).to_string())
        } else {
            Err(String::from_utf8_lossy(&out.stderr).to_string())
        }
    }
}

#[tauri::command]
fn download_and_run_installer(url: String, file_name: String) -> Result<String, String> {
    let temp_dir = std::env::temp_dir().join("forjatex-suite");
    std::fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;
    let dest = temp_dir.join(&file_name);
    let dest_str = dest.to_string_lossy().to_string();

    #[cfg(target_os = "windows")]
    {
        let script = format!(
            "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '{}' -OutFile '{}' -UseBasicParsing",
            url.replace('\'', "''"),
            dest_str.replace('\'', "''")
        );
        let out = silent_command("powershell")
            .args(["-NoProfile", "-Command", &script])
            .output()
            .map_err(|e| format!("Falha ao baixar instalador: {}", e))?;
        if !out.status.success() {
            return Err(String::from_utf8_lossy(&out.stderr).to_string());
        }
        Command::new(&dest)
            .spawn()
            .map_err(|e| format!("Falha ao iniciar instalador: {}", e))?;
        Ok(format!("Instalador iniciado: {}", file_name))
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = (url, file_name, dest_str);
        Err("Download automático suportado apenas no Windows nesta versão.".to_string())
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            check_installed_apps,
            launch_app,
            fetch_manifest_json,
            download_and_run_installer
        ])
        .run(tauri::generate_context!())
        .expect("error while running ForjaTeX Suite");
}

