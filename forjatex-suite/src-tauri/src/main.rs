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

#[cfg(target_os = "windows")]
fn read_exe_version(exe_path: &Path) -> Option<String> {
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
            let parts: Vec<&str> = v.split('.').collect();
            if parts.len() == 4 && parts[3] == "0" {
                return Some(format!("{}.{}.{}", parts[0], parts[1], parts[2]));
            }
            return Some(v);
        }
    }
    None
}

#[cfg(target_os = "linux")]
fn read_linux_pkg_version(pkg_names: &[&str]) -> Option<String> {
    for pkg in pkg_names {
        if let Ok(out) = Command::new("dpkg-query")
            .args(["-W", "-f=${Version}", pkg])
            .output()
        {
            if out.status.success() {
                let raw = String::from_utf8_lossy(&out.stdout).trim().to_string();
                if !raw.is_empty() {
                    let clean = raw.split('-').next().unwrap_or(&raw).to_string();
                    return Some(clean);
                }
            }
        }
    }
    None
}

fn find_installed_app(
    display_names: &[&str],
    exe_names: &[&str],
    linux_bins: &[&str],
) -> (bool, Option<String>, Option<String>) {
    #[cfg(target_os = "windows")]
    {
        let _ = linux_bins;
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

    #[cfg(target_os = "linux")]
    {
        let _ = (display_names, exe_names);
        let home = std::env::var("HOME").unwrap_or_default();
        let candidates = [
            "/usr/bin".to_string(),
            "/usr/local/bin".to_string(),
            format!("{}/.local/bin", home),
        ];
        for dir in &candidates {
            for bin in linux_bins {
                let p = Path::new(dir).join(bin);
                if p.exists() {
                    return (
                        true,
                        Some(p.to_string_lossy().to_string()),
                        read_linux_pkg_version(linux_bins),
                    );
                }
                let appimg = Path::new(dir).join(format!("{}.AppImage", bin));
                if appimg.exists() {
                    return (true, Some(appimg.to_string_lossy().to_string()), None);
                }
            }
        }
    }

    #[cfg(not(any(target_os = "windows", target_os = "linux")))]
    let _ = (display_names, exe_names, linux_bins);

    (false, None, None)
}

#[tauri::command]
fn check_installed_apps() -> Vec<InstalledAppInfo> {
    let specs = [
        ("forjatex", vec!["ForjaTeX"], vec!["forjatex.exe", "ForjaTeX.exe"], vec!["forjatex"]),
        ("forjatikz", vec!["ForjaTikZ"], vec!["forjatikz.exe", "ForjaTikZ.exe"], vec!["forjatikz"]),
        ("forjasnap", vec!["ForjaSnap"], vec!["forjasnap.exe"], vec!["forjasnap"]),
        ("forjabib", vec!["ForjaBib"], vec!["forjabib.exe"], vec!["forjabib"]),
        ("forjadiff", vec!["ForjaDiff"], vec!["forjadiff.exe"], vec!["forjadiff"]),
    ];

    specs
        .iter()
        .map(|(id, dirs, exes, linux_bins)| {
            let (installed, exe_path, version) = find_installed_app(dirs, exes, linux_bins);
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
        .set("User-Agent", "ForjaTeX-Suite/1.3")
        .call()
        .map_err(|e| format!("Falha ao consultar manifesto: {}", e))?;
    let body = resp
        .into_string()
        .map_err(|e| format!("Falha ao ler manifesto: {}", e))?;
    Ok(body.trim_start_matches('\u{FEFF}').trim().to_string())
}

fn resolve_download_dir(custom_dir: Option<&str>) -> std::path::PathBuf {
    if let Some(dir) = custom_dir.map(|s| s.trim()).filter(|s| !s.is_empty()) {
        std::path::PathBuf::from(dir)
    } else {
        std::env::temp_dir().join("forjatex-suite")
    }
}

#[derive(Serialize)]
struct CacheInfo {
    cache_dir: String,
    file_count: usize,
    total_bytes: u64,
}

#[tauri::command]
fn get_installer_cache_info(download_dir: Option<String>) -> Result<CacheInfo, String> {
    let dir = resolve_download_dir(download_dir.as_deref());
    let mut file_count = 0usize;
    let mut total_bytes = 0u64;
    if dir.exists() {
        if let Ok(entries) = std::fs::read_dir(&dir) {
            for entry in entries.flatten() {
                if let Ok(meta) = entry.metadata() {
                    if meta.is_file() {
                        file_count += 1;
                        total_bytes += meta.len();
                    }
                }
            }
        }
    }
    Ok(CacheInfo {
        cache_dir: dir.to_string_lossy().to_string(),
        file_count,
        total_bytes,
    })
}

#[tauri::command]
fn clear_installer_cache(download_dir: Option<String>) -> Result<u64, String> {
    let dir = resolve_download_dir(download_dir.as_deref());
    let mut freed = 0u64;
    if dir.exists() {
        let entries = std::fs::read_dir(&dir).map_err(|e| e.to_string())?;
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                let name = path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("")
                    .to_lowercase();
                if name.ends_with(".msi")
                    || name.ends_with(".exe")
                    || name.ends_with(".deb")
                    || name.ends_with(".appimage")
                    || name.ends_with(".cmd")
                {
                    if let Ok(meta) = entry.metadata() {
                        freed += meta.len();
                    }
                    let _ = std::fs::remove_file(&path);
                }
            }
        }
    }
    Ok(freed)
}

#[tauri::command]
async fn download_and_run_installer(
    app: AppHandle,
    id: String,
    url: String,
    file_name: String,
    silent: bool,
    self_update: bool,
    download_dir: Option<String>,
) -> Result<String, String> {
    let temp_dir = resolve_download_dir(download_dir.as_deref());
    std::fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;
    let dest = temp_dir.join(&file_name);

    let app_clone = app.clone();
    let id_clone = id.clone();
    let dest_clone = dest.clone();

    tauri::async_runtime::spawn_blocking(move || -> Result<(), String> {
        let resp = ureq::get(&url)
            .set("User-Agent", "ForjaTeX-Suite/1.3")
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

    #[cfg(target_os = "windows")]
    {
        if self_update {
            let current_exe = std::env::current_exe().map_err(|e| e.to_string())?;
            let installer_str = dest.to_string_lossy().to_string();
            let current_str = current_exe.to_string_lossy().to_string();
            let install_cmd = if file_name.to_lowercase().ends_with(".msi") {
                format!("start /wait \"\" msiexec /i \"{}\" /passive", installer_str)
            } else {
                format!("start /wait \"\" \"{}\" /S", installer_str)
            };
            let bat_path = temp_dir.join("suite-self-update.cmd");
            let bat_content = format!(
                "@echo off\r\nping 127.0.0.1 -n 2 >nul\r\n{}\r\nping 127.0.0.1 -n 2 >nul\r\nexplorer.exe \"{}\"\r\n",
                install_cmd, current_str
            );
            std::fs::write(&bat_path, bat_content)
                .map_err(|e| format!("Falha ao preparar script de atualização: {}", e))?;
            silent_command("cmd")
                .args(["/C", &bat_path.to_string_lossy()])
                .spawn()
                .map_err(|e| format!("Falha ao iniciar atualização do Suite: {}", e))?;
            app.exit(0);
            return Ok("Reiniciando para aplicar atualização...".to_string());
        }

        if file_name.to_lowercase().ends_with(".msi") {
            let path_str = dest.to_str().unwrap_or_default();
            let mut args = vec!["/i", path_str];
            if silent {
                args.push("/passive");
            }
            let status = Command::new("msiexec")
                .args(&args)
                .status()
                .map_err(|e| format!("Falha ao executar msiexec: {}", e))?;
            let code = status.code().unwrap_or(-1);
            if status.success() || code == 3010 {
                Ok(format!("{} instalado/atualizado via MSI!", id))
            } else if silent && code != 1602 {
                // Fallback to interactive MSI so Windows SmartScreen/UAC prompts can be handled by the user
                let fallback = Command::new("msiexec")
                    .args(["/i", path_str])
                    .status()
                    .map_err(|e| format!("Falha ao executar msiexec interativo: {}", e))?;
                let fb_code = fallback.code().unwrap_or(-1);
                if fallback.success() || fb_code == 3010 {
                    Ok(format!("{} instalado/atualizado via MSI!", id))
                } else {
                    Err(format!(
                        "Instalador MSI cancelado ou retornou erro (código {}).",
                        fb_code
                    ))
                }
            } else {
                Err(format!(
                    "Instalador MSI cancelado ou retornou erro (código {}).",
                    code
                ))
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

    #[cfg(target_os = "linux")]
    {
        let lower = file_name.to_lowercase();
        if lower.ends_with(".deb") {
            let status = Command::new("pkexec")
                .args(["dpkg", "-i", dest.to_str().unwrap_or_default()])
                .status()
                .map_err(|e| format!("Falha ao executar pkexec dpkg: {}", e))?;
            if status.success() {
                if self_update {
                    if let Ok(exe) = std::env::current_exe() {
                        let _ = Command::new(exe).spawn();
                    }
                    app.exit(0);
                }
                Ok(format!("{} instalado via .deb!", id))
            } else {
                Err("Instalação .deb cancelada ou falhou.".to_string())
            }
        } else if lower.ends_with(".appimage") {
            use std::os::unix::fs::PermissionsExt;
            let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_string());
            let bin_dir = Path::new(&home).join(".local/bin");
            std::fs::create_dir_all(&bin_dir).map_err(|e| e.to_string())?;
            let target_bin = bin_dir.join(format!("{}.AppImage", id));
            std::fs::copy(&dest, &target_bin).map_err(|e| e.to_string())?;
            let mut perms = std::fs::metadata(&target_bin)
                .map_err(|e| e.to_string())?
                .permissions();
            perms.set_mode(0o755);
            std::fs::set_permissions(&target_bin, perms).map_err(|e| e.to_string())?;
            if self_update {
                let _ = Command::new(&target_bin).spawn();
                app.exit(0);
            }
            Ok(format!("{} instalado em ~/.local/bin!", id))
        } else {
            let _ = (silent, self_update);
            Err("Formato de instalador não suportado no Linux.".to_string())
        }
    }

    #[cfg(not(any(target_os = "windows", target_os = "linux")))]
    {
        let _ = (app, id, file_name, silent, self_update, dest);
        Err("Sistema operacional ainda não suportado para instalação automática.".to_string())
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
            download_and_run_installer,
            get_installer_cache_info,
            clear_installer_cache
        ])
        .run(tauri::generate_context!())
        .expect("error while running ForjaTeX Suite");
}
