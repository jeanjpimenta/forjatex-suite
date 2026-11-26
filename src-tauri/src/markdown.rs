use pulldown_cmark::{Alignment, CodeBlockKind, Event, HeadingLevel, Options, Parser, Tag, TagEnd};
use std::fs;
use std::path::Path;

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MarkdownConvertRequest {
    pub markdown: Option<String>,
    pub file_path: Option<String>,
    pub template: String, // "article" | "abnt" | "beamer" | "snippet"
    pub title: String,
    pub author: String,
    pub institution: String,
    pub convert_citations: bool,
}

fn escape_latex_text(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for ch in s.chars() {
        match ch {
            '\\' => out.push_str("\\textbackslash{}"),
            '{' => out.push_str("\\{"),
            '}' => out.push_str("\\}"),
            '$' => out.push_str("\\$"),
            '&' => out.push_str("\\&"),
            '%' => out.push_str("\\%"),
            '#' => out.push_str("\\#"),
            '_' => out.push_str("\\_"),
            '^' => out.push_str("\\textasciicircum{}"),
            '~' => out.push_str("\\textasciitilde{}"),
            _ => out.push(ch),
        }
    }
    out
}

fn convert_pandoc_citations(text: &str) -> String {
    // Converts [@key1; @key2] or [@key] into \cite{key1,key2}
    let mut result = String::with_capacity(text.len());
    let bytes = text.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'[' && i + 1 < bytes.len() && bytes[i + 1] == b'@' {
            if let Some(end_rel) = text[i..].find(']') {
                let inner = &text[i + 1..i + end_rel];
                let keys: Vec<String> = inner
                    .split([';', ','])
                    .map(|part| part.trim().trim_start_matches('@').trim().to_string())
                    .filter(|k| !k.is_empty() && k.chars().all(|c| c.is_alphanumeric() || c == '_' || c == '-' || c == ':'))
                    .collect();
                if !keys.is_empty() {
                    result.push_str(&format!("\\cite{{{}}}", keys.join(",")));
                    i += end_rel + 1;
                    continue;
                }
            }
        }
        let ch = text[i..].chars().next().unwrap();
        result.push(ch);
        i += ch.len_utf8();
    }
    result
}

fn markdown_body_to_latex(md: &str, convert_citations: bool, is_beamer: bool) -> String {
    let mut opts = Options::empty();
    opts.insert(Options::ENABLE_TABLES);
    opts.insert(Options::ENABLE_STRIKETHROUGH);
    opts.insert(Options::ENABLE_TASKLISTS);
    opts.insert(Options::ENABLE_MATH);

    let parser = Parser::new_ext(md, opts);
    let mut out = String::new();
    let mut in_code_block = false;
    let mut in_table = false;
    let mut in_table_head = false;
    let mut table_row: Vec<String> = Vec::new();
    let mut current_cell = String::new();
    let mut in_table_cell = false;
    let mut list_stack: Vec<bool> = Vec::new(); // true = ordered
    let mut link_url: Option<String> = None;
    let mut link_text = String::new();
    let mut in_link = false;
    let mut in_image = false;
    let mut image_url = String::new();
    let mut image_alt = String::new();
    let mut frame_open = false;

    macro_rules! target {
        () => {
            if in_table_cell {
                &mut current_cell
            } else if in_link {
                &mut link_text
            } else if in_image {
                &mut image_alt
            } else {
                &mut out
            }
        };
    }

    for event in parser {
        match event {
            Event::Start(tag) => match tag {
                Tag::Heading { level, .. } => {
                    if is_beamer && (level == HeadingLevel::H1 || level == HeadingLevel::H2) {
                        if frame_open {
                            out.push_str("\\end{frame}\n\n");
                            frame_open = false;
                        }
                        if level == HeadingLevel::H1 {
                            out.push_str("\\section{");
                        } else {
                            out.push_str("\\begin{frame}{");
                            frame_open = true;
                        }
                    } else {
                        let cmd = match level {
                            HeadingLevel::H1 => "\\section{",
                            HeadingLevel::H2 => "\\subsection{",
                            HeadingLevel::H3 => "\\subsubsection{",
                            _ => "\\paragraph{",
                        };
                        out.push_str(cmd);
                    }
                }
                Tag::Paragraph => {}
                Tag::BlockQuote(_) => {
                    out.push_str("\\begin{quote}\n");
                }
                Tag::CodeBlock(kind) => {
                    in_code_block = true;
                    let lang = match kind {
                        CodeBlockKind::Fenced(l) => l.trim().to_string(),
                        CodeBlockKind::Indented => String::new(),
                    };
                    if lang.is_empty() {
                        out.push_str("\\begin{lstlisting}\n");
                    } else {
                        out.push_str(&format!("\\begin{{lstlisting}}[language={}]\n", lang));
                    }
                }
                Tag::List(first_num) => {
                    let ordered = first_num.is_some();
                    list_stack.push(ordered);
                    out.push_str(if ordered {
                        "\\begin{enumerate}\n"
                    } else {
                        "\\begin{itemize}\n"
                    });
                }
                Tag::Item => {
                    out.push_str("  \\item ");
                }
                Tag::Emphasis => {
                    target!().push_str("\\textit{");
                }
                Tag::Strong => {
                    target!().push_str("\\textbf{");
                }
                Tag::Strikethrough => {
                    target!().push_str("\\sout{");
                }
                Tag::Link { dest_url, .. } => {
                    in_link = true;
                    link_url = Some(dest_url.to_string());
                    link_text.clear();
                }
                Tag::Image { dest_url, .. } => {
                    in_image = true;
                    image_url = dest_url.to_string();
                    image_alt.clear();
                }
                Tag::Table(aligns) => {
                    in_table = true;
                    let col_spec: String = aligns
                        .iter()
                        .map(|a| match a {
                            Alignment::Center => 'c',
                            Alignment::Right => 'r',
                            _ => 'l',
                        })
                        .collect();
                    let col_spec = if col_spec.is_empty() {
                        "ll".to_string()
                    } else {
                        col_spec
                    };
                    out.push_str(&format!(
                        "\\begin{{table}}[htbp]\n\\centering\n\\begin{{tabular}}{{{}}}\n\\toprule\n",
                        col_spec
                    ));
                }
                Tag::TableHead => {
                    in_table_head = true;
                    table_row.clear();
                }
                Tag::TableRow => {
                    table_row.clear();
                }
                Tag::TableCell => {
                    in_table_cell = true;
                    current_cell.clear();
                }
                _ => {}
            },
            Event::End(tag_end) => match tag_end {
                TagEnd::Heading(level) => {
                    if is_beamer && level == HeadingLevel::H2 {
                        out.push_str("}\n");
                    } else {
                        out.push_str("}\n\n");
                    }
                }
                TagEnd::Paragraph => {
                    out.push_str("\n\n");
                }
                TagEnd::BlockQuote(_) => {
                    out.push_str("\\end{quote}\n\n");
                }
                TagEnd::CodeBlock => {
                    in_code_block = false;
                    out.push_str("\\end{lstlisting}\n\n");
                }
                TagEnd::List(_) => {
                    let ordered = list_stack.pop().unwrap_or(false);
                    out.push_str(if ordered {
                        "\\end{enumerate}\n\n"
                    } else {
                        "\\end{itemize}\n\n"
                    });
                }
                TagEnd::Item => {
                    out.push('\n');
                }
                TagEnd::Emphasis | TagEnd::Strong | TagEnd::Strikethrough => {
                    target!().push('}');
                }
                TagEnd::Link => {
                    in_link = false;
                    let url = link_url.take().unwrap_or_default();
                    let rendered = format!("\\href{{{}}}{{{}}}", url, link_text);
                    link_text.clear();
                    target!().push_str(&rendered);
                }
                TagEnd::Image => {
                    in_image = false;
                    let cap = if image_alt.trim().is_empty() {
                        "Figura importada".to_string()
                    } else {
                        image_alt.trim().to_string()
                    };
                    out.push_str(&format!(
                        "\\begin{{figure}}[htbp]\n  \\centering\n  \\includegraphics[width=0.8\\textwidth]{{{}}}\n  \\caption{{{}}}\n\\end{{figure}}\n\n",
                        image_url, cap
                    ));
                    image_url.clear();
                    image_alt.clear();
                }
                TagEnd::TableCell => {
                    in_table_cell = false;
                    let cell = current_cell.trim().to_string();
                    table_row.push(if in_table_head {
                        format!("\\textbf{{{}}}", cell)
                    } else {
                        cell
                    });
                    current_cell.clear();
                }
                TagEnd::TableHead => {
                    in_table_head = false;
                    out.push_str(&table_row.join(" & "));
                    out.push_str(" \\\\\n\\midrule\n");
                    table_row.clear();
                }
                TagEnd::TableRow => {
                    if !table_row.is_empty() {
                        out.push_str(&table_row.join(" & "));
                        out.push_str(" \\\\\n");
                        table_row.clear();
                    }
                }
                TagEnd::Table => {
                    in_table = false;
                    out.push_str("\\bottomrule\n\\end{tabular}\n\\end{table}\n\n");
                }
                _ => {}
            },
            Event::Text(text) => {
                if in_code_block {
                    out.push_str(&text);
                } else {
                    let raw = text.as_ref();
                    if convert_citations && raw.contains("[@") {
                        // Preserve \cite{...} unescaped while escaping prose around it
                        let replaced = convert_pandoc_citations(raw);
                        let mut rest = replaced.as_str();
                        while let Some(pos) = rest.find("\\cite{") {
                            let before = &rest[..pos];
                            target!().push_str(&escape_latex_text(before));
                            let after = &rest[pos..];
                            if let Some(end_b) = after.find('}') {
                                target!().push_str(&after[..=end_b]);
                                rest = &after[end_b + 1..];
                            } else {
                                target!().push_str(&escape_latex_text(after));
                                rest = "";
                            }
                        }
                        target!().push_str(&escape_latex_text(rest));
                    } else {
                        target!().push_str(&escape_latex_text(raw));
                    }
                }
            }
            Event::Code(code) => {
                target!().push_str(&format!("\\texttt{{{}}}", escape_latex_text(&code)));
            }
            Event::InlineMath(math) => {
                target!().push_str(&format!("${}$", math));
            }
            Event::DisplayMath(math) => {
                target!().push_str(&format!("\n\\[\n{}\n\\]\n", math.trim()));
            }
            Event::SoftBreak => {
                target!().push(' ');
            }
            Event::HardBreak => {
                target!().push_str(" \\\\\n");
            }
            Event::Rule => {
                if !in_table {
                    out.push_str("\\noindent\\rule{\\textwidth}{0.4pt}\n\n");
                }
            }
            Event::TaskListMarker(checked) => {
                target!().push_str(if checked { "[x] " } else { "[ ] " });
            }
            _ => {}
        }
    }

    if is_beamer && frame_open {
        out.push_str("\\end{frame}\n");
    }

    out
}

#[tauri::command]
pub fn convert_markdown_to_latex(req: MarkdownConvertRequest) -> Result<String, String> {
    let md_source = if let Some(path) = req.file_path.as_deref().filter(|p| !p.trim().is_empty()) {
        fs::read_to_string(Path::new(path))
            .map_err(|e| format!("Falha ao ler arquivo Markdown: {}", e))?
    } else {
        req.markdown.unwrap_or_default()
    };

    if md_source.trim().is_empty() {
        return Err("Conteudo Markdown vazio.".to_string());
    }

    let is_beamer = req.template == "beamer";
    let body = markdown_body_to_latex(&md_source, req.convert_citations, is_beamer);

    if req.template == "snippet" {
        return Ok(body.trim().to_string());
    }

    let title = escape_latex_text(if req.title.trim().is_empty() {
        "Documento Importado"
    } else {
        req.title.trim()
    });
    let author = escape_latex_text(if req.author.trim().is_empty() {
        "Autor"
    } else {
        req.author.trim()
    });
    let inst = escape_latex_text(req.institution.trim());

    let doc = match req.template.as_str() {
        "abnt" => format!(
            r#"\documentclass[12pt,a4paper]{{article}}
\usepackage[utf8]{{inputenc}}
\usepackage[T1]{{fontenc}}
\usepackage{{lmodern}}
\usepackage[top=3cm,bottom=2cm,left=3cm,right=2cm]{{geometry}}
\usepackage{{setspace}}
\onehalfspacing
\usepackage{{graphicx,booktabs,amsmath,amssymb,listings,hyperref}}
\usepackage[normalem]{{ulem}}

\title{{\textbf{{{title}}}}}
\author{{{author}{inst_line}}}
\date{{\today}}

\begin{{document}}
\maketitle
\tableofcontents
\newpage

{body}
\end{{document}}
"#,
            title = title,
            author = author,
            inst_line = if inst.is_empty() {
                String::new()
            } else {
                format!(" \\\\ {}", inst)
            },
            body = body.trim()
        ),
        "beamer" => format!(
            r#"\documentclass{{beamer}}
\usetheme{{Madrid}}
\usepackage[utf8]{{inputenc}}
\usepackage[T1]{{fontenc}}
\usepackage{{lmodern}}
\usepackage{{graphicx,booktabs,amsmath,amssymb,listings}}
\usepackage[normalem]{{ulem}}

\title{{{title}}}
\author{{{author}}}
{inst_cmd}
\date{{\today}}

\begin{{document}}
\begin{{frame}}
  \titlepage
\end{{frame}}

{body}
\end{{document}}
"#,
            title = title,
            author = author,
            inst_cmd = if inst.is_empty() {
                String::new()
            } else {
                format!("\\institute{{{}}}", inst)
            },
            body = body.trim()
        ),
        _ => format!(
            r#"\documentclass[11pt,a4paper]{{article}}
\usepackage[utf8]{{inputenc}}
\usepackage[T1]{{fontenc}}
\usepackage{{lmodern}}
\usepackage[margin=2.5cm]{{geometry}}
\usepackage{{graphicx,booktabs,amsmath,amssymb,listings,hyperref}}
\usepackage[normalem]{{ulem}}

\title{{{title}}}
\author{{{author}{inst_line}}}
\date{{\today}}

\begin{{document}}
\maketitle

{body}
\end{{document}}
"#,
            title = title,
            author = author,
            inst_line = if inst.is_empty() {
                String::new()
            } else {
                format!(" \\\\ {}", inst)
            },
            body = body.trim()
        ),
    };

    Ok(doc)
}

