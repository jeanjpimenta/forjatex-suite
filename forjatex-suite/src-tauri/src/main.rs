#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
use std::fs::File;
use std::io::{Read, Write};
use std::path::Path;
use std::process::Command;
use tauri::{AppHandle, Emitter};

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

#[derive(Clone, Serialize)]
struct DownloadProgressPayload {
    id: String,
    downloaded: u64,
    total: u64,
}

fn read_exe_version(exe_path: &Path) -> Option<String> {
    #[cfg(target_os = "windows")]
    {
        let p = exe_path.to_string_lossy().replace('\'', "''");
        let out = silent_command("powershell")
            .args([
                "-NoProfile",
                "-Command",
                &format!("(Get-Item '{}').VersionInfo.ProductVersion", p),
            ])
            .output()
            .ok()?;
        if out.status.success() {
            let v = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !v.is_empty() {
                // Trim optional 4th .0 segment if Windows returns 1.3.0.0
                let parts: Vec<&str> = v.split('.').collect();
                if parts.len() == 4 && parts[3] == "0" {
                    return Some(format!("{}.{}.{}", parts[0], parts[1], parts[2]));
                }
                return Some(v);
            }
        }
    }
    let _ = exe_path;
    None
}

fn find_windows_app(
    display_names: &[&str],
    exe_names: &[&str],
) -> (bool, Option<String>, Option<String>) {
    #[cfg(target_os = "windows")]
    {
        let local_app_data = std::env::var("LOCALAPPDATA").unwrap_or_default();
        let program_files =
            std::env::var("ProgramFiles").unwrap_or_else(|_| "C:\\Program Files".to_string());
        for folder in display_names {
            for exe in exe_names {
                let p1 = Path::new(&local_app_data).join(folder).join(exe);
                if p1.exists() {
                    return (
                        true,
                        Some(p1.to_string_lossy().to_string()),
                        read_exe_version(&p1),
                    );
                }
                let p2 = Path::new(&program_files).join(folder).join(exe);
                if p2.exists() {
                    return (
                        true,
                        Some(p2.to_string_lossy().to_string()),
                        read_exe_version(&p2),
                    );
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
    let resp = ureq::get(&url)
        .set("User-Agent", "ForjaTeX-Suite/1.2")
        .call()
        .map_err(|e| format!("Falha ao consultar manifesto: {}", e))?;
    let body = resp
        .into_string()
        .map_err(|e| format!("Falha ao ler manifesto: {}", e))?;
    Ok(body.trim_start_matches('\u{FEFF}').trim().to_string())
}

#[tauri::command]
async fn download_and_run_installer(
    app: AppHandle,
    id: String,
    url: String,
    file_name: String,
    silent: bool,
    self_update: bool,
) -> Result<String, String> {
    let temp_dir = std::env::temp_dir().join("forjatex-suite");
    std::fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;
    let dest = temp_dir.join(&file_name);

    let app_clone = app.clone();
    let id_clone = id.clone();
    let dest_clone = dest.clone();

    tauri::async_runtime::spawn_blocking(move || -> Result<(), String> {
        let resp = ureq::get(&url)
            .set("User-Agent", "ForjaTeX-Suite/1.2")
            .call()
            .map_err(|e| format!("Falha ao baixar instalador: {}", e))?;

        let total: u64 = resp
            .header("Content-Length")
            .and_then(|s| s.parse().ok())
            .unwrap_or(0);

        let mut reader = resp.into_reader();
        let mut file = File::create(&dest_clone).map_err(|e| e.to_string())?;
        let mut buf = [0u8; 32768];
        let mut downloaded: u64 = 0;

        loop {
            let n = reader.read(&mut buf).map_err(|e| e.to_string())?;
            if n == 0 {
                break;
            }
            file.write_all(&buf[..n]).map_err(|e| e.to_string())?;
            downloaded += n as u64;
            let _ = app_clone.emit(
                "download-progress",
                DownloadProgressPayload {
                    id: id_clone.clone(),
                    downloaded,
                    total,
                },
            );
        }
        Ok(())
    })
    .await
    .map_err(|e| e.to_string())??;

    if self_update {
        let current_exe = std::env::current_exe().map_err(|e| e.to_string())?;
        let installer_str = dest.to_string_lossy().to_string();
        let current_str = current_exe.to_string_lossy().to_string();
        let install_cmd = if file_name.to_lowercase().ends_with(".msi") {
            format!("msiexec /i \"{}\" /passive", installer_str)
        } else {
            format!("\"{}\" /S", installer_str)
        };
        silent_command("cmd")
            .args([
                "/C",
                &format!(
                    "timeout /t 1 /nobreak >nul & {} & start \"\" \"{}\"",
                    install_cmd, current_str
                ),
            ])
            .spawn()
            .map_err(|e| format!("Falha ao iniciar atualização do Suite: {}", e))?;
        app.exit(0);
        return Ok("Reiniciando para aplicar atualização...".to_string());
    }

    if file_name.to_lowercase().ends_with(".msi") {
        let mut args = vec!["/i", dest.to_str().unwrap_or_default()];
        if silent {
            args.push("/passive");
        }
        let status = Command::new("msiexec")
            .args(&args)
            .status()
            .map_err(|e| format!("Falha ao executar msiexec: {}", e))?;
        if status.success() {
            Ok(format!("{} instalado/atualizado via MSI!", id))
        } else {
            Err("Instalador MSI cancelado ou retornou erro.".to_string())
        }
    } else if silent && file_name.to_lowercase().ends_with(".exe") {
        let status = Command::new(&dest)
            .arg("/S")
            .status()
            .map_err(|e| format!("Falha ao executar instalador silencioso: {}", e))?;
        if status.success() {
            Ok(format!("{} atualizado/instalado com sucesso!", id))
        } else {
            Err("Instalador retornou erro.".to_string())
        }
    } else {
        Command::new(&dest)
            .spawn()
            .map_err(|e| format!("Falha ao iniciar instalador: {}", e))?;
        Ok(format!("Instalador iniciado: {}", file_name))
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
