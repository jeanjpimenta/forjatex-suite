#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::Path;
use std::process::Command;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[derive(serde::Serialize)]
struct CompileStyleResult {
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
fn open_file_path(path: String) -> Result<(), String> {
    let target = Path::new(&path);
    if !target.exists() {
        return Err(format!("Arquivo não encontrado: {}", path));
    }
    launch_os_path(target)
}

#[tauri::command]
fn compile_bib_style_test(
    bib_content: String,
    style_preamble: String,
    use_biber: bool,
    bib_style_name: Option<String>,
    csl_content: Option<String>,
    csl_name: Option<String>,
) -> Result<CompileStyleResult, String> {
    let dir = std::env::temp_dir().join("forjabib-style-test");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    fs::write(dir.join("ref_test.bib"), &bib_content).map_err(|e| e.to_string())?;

    let body = if let Some(csl_xml) = csl_content {
        let slug = csl_name
            .unwrap_or_else(|| "custom_style".to_string())
            .replace(".csl", "");
        fs::write(dir.join(format!("{}.csl", slug)), csl_xml).map_err(|e| e.to_string())?;
        format!(
            "\\documentclass[11pt,a4paper]{{article}}\n\\usepackage[utf8]{{inputenc}}\n\\usepackage[T1]{{fontenc}}\n\\usepackage{{citation-style-language}}\n\\cslsetup{{style = {}}}\n\\addbibresource{{ref_test.bib}}\n\\begin{{document}}\n\\section*{{Teste de Estilo CSL ({})}}\n\\nocite{{*}}\n\\printbibliography\n\\end{{document}}\n",
            slug, slug
        )
    } else if use_biber {
        format!(
            "\\documentclass[11pt,a4paper]{{article}}\n\\usepackage[utf8]{{inputenc}}\n\\usepackage[T1]{{fontenc}}\n{}\n\\addbibresource{{ref_test.bib}}\n\\begin{{document}}\n\\section*{{Teste de Estilo Bibliográfico}}\nExemplo de citação no texto: \\cite{{*}}\\nocite{{*}}\n\\printbibliography\n\\end{{document}}\n",
            style_preamble
        )
    } else {
        let bst = bib_style_name.unwrap_or_else(|| "plainnat".to_string());
        format!(
            "\\documentclass[11pt,a4paper]{{article}}\n\\usepackage[utf8]{{inputenc}}\n\\usepackage[T1]{{fontenc}}\n\\usepackage{{url}}\n{}\n\\begin{{document}}\n\\section*{{Teste de Estilo Bibliográfico (natbib)}}\n\\nocite{{*}}\n\\bibliographystyle{{{}}}\n\\bibliography{{ref_test}}\n\\end{{document}}\n",
            style_preamble, bst
        )
    };
    fs::write(dir.join("style_test.tex"), body).map_err(|e| e.to_string())?;

    let run_cmd = |prog: &str, args: &[&str]| -> Result<std::process::Output, String> {
        let mut cmd = Command::new(prog);
        #[cfg(target_os = "windows")]
        cmd.creation_flags(0x08000000);
        cmd.args(args)
            .current_dir(&dir)
            .output()
            .map_err(|e| format!("{} não encontrado: {}", prog, e))
    };

    let out = if dir.join("style_test.tex").exists()
        && fs::read_to_string(dir.join("style_test.tex"))
            .unwrap_or_default()
            .contains("citation-style-language")
    {
        let _ = run_cmd("pdflatex", &["-interaction=nonstopmode", "style_test.tex"])?;
        run_cmd("pdflatex", &["-interaction=nonstopmode", "style_test.tex"])?
    } else {
        let _ = run_cmd("pdflatex", &["-interaction=nonstopmode", "style_test.tex"])?;
        let backend = if use_biber { "biber" } else { "bibtex" };
        let _ = run_cmd(backend, &["style_test"])?;
        let _ = run_cmd("pdflatex", &["-interaction=nonstopmode", "style_test.tex"])?;
        run_cmd("pdflatex", &["-interaction=nonstopmode", "style_test.tex"])?
    };

    let pdf_path = dir.join("style_test.pdf");
    if out.status.success() && pdf_path.exists() {
        let pdf_str = pdf_path.to_string_lossy().to_string();
        Ok(CompileStyleResult {
            message: format!("Estilo compilado com sucesso! PDF gerado em: {}", pdf_str),
            pdf_path: pdf_str,
        })
    } else {
        Err("Erro ao compilar teste de estilo (verifique se biber/biblatex/natbib estão instalados).".to_string())
    }
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
            open_file_path,
            compile_bib_style_test,
            open_manual_pdf
        ])
        .run(tauri::generate_context!())
        .expect("error while running ForjaBib");
}

