# Auditoria Completa do TeXmaker 6.0.0 (via Craft Anything) & Roadmap do ForjaTeX

> **Alvo analisado:** `C:\Program Files (x86)\Texmaker\texmaker.exe` (v6.0.0, PE x86_64 C++/Qt6, MSVC 14.29) + `usermanual_en.html` + `CHANGELOG.txt`.  
> **Bibliotecas internas identificadas no binário:** Pdfium / QtPDF / qpdfview (PDF), Hunspell 1.7 (ortografia offline), SyncTeX 1.21, jsdifflib (diff visual), QJSEngine (scripts `.tms`), GitHelper.

---

## 1. Inventário Completo de Funcionalidades do TeXmaker 6.0.0

### A. Editor & Navegação
* **Placeholders `•` navegáveis com `Tab` / `Shift+Tab`:** Ao inserir comandos/ambientes, o cursor pula entre os campos `•` (ou preenche o primeiro com o texto selecionado).
* **Structure View (Visão de Estrutura):** Árvore dinâmica com `\part`, `\chapter`, `\section`, `\subsection`, `\label`, `\include`/`\input` e blocos BibTeX.
* **Code Folding contextual:** Dobrar/desdobrar seções e ambientes `\begin{...}...\end{...}` + comando "Ir para o fim do bloco".
* **3 Bookmarks por arquivo:** Marcação rápida na margem de número de linha + botões de salto na barra de status.
* **Seleção em bloco (Alt + Mouse)** e **Comentar/Descomentar (`Ctrl+T` / `Ctrl+U`)**.
* **Buscar/Substituir com Regex** (capturas `$1`).
* **Source Viewer (Painel de Referência):** Abre um segundo arquivo em somente-leitura ao lado do editor para copiar trechos, com **Diff Visual (`jsdifflib`)** entre o arquivo editado e o de referência.
* **Restaurar Sessão Anterior (`Ctrl+Shift+F8`)** e **Backup automático em intervalo configurável**.

### B. Assistentes (Wizards) & Inserção Rápida
* **Quick Start Wizard:** Gera preâmbulo (classe, tamanho de papel, codificação, pacotes comuns).
* **XeLaTeX Wizard & Beamer Presentation Wizard:** Inclui preview de temas Beamer.
* **Tabular Wizard & Array/Matrix Wizard:** Grade visual onde o usuário digita diretamente nas células e gera `\begin{tabular}` ou `matrix`/`pmatrix`.
* **Tabbing Wizard** e **Inserção de Imagem (`\includegraphics`)** com navegador de arquivo e criação automática de ambiente `figure`.
* **Painel de 400+ Símbolos Matemáticos + Painel de Favoritos (`*`):** Clique com botão direito para favoritar símbolos.
* **Atalhos de formatação `[selection]`:** Envolve texto selecionado em `\textbf{}`, `\textit{}`, `\emph{}`, etc.
* **Suporte a Pstricks / Metapost / TikZ / Asymptote** (botões PS, MP, TI, AS).

### C. Bibliografia & Ortografia
* **Parser automático de `.bib`:** Detecta arquivos `.bib` do projeto e popula o autocompletar de `\cite{...}`.
* **Menu Bibliography:** Insere templates (`@article`, `@book`, `@patent`, etc.) + comando **Clean** para remover campos opcionais vazios.
* **Corretor Ortográfico Hunspell:** Dicionários `.aff`/`.dic` (já vem com `en_US`, `pt_PT`, `es_ES`, `fr_FR`, `de_DE`, etc.), sublinhado vermelho em tempo real, menu de sugestões com botão direito, ignora comandos `\cite{}` e `\label{}`.

### D. Compilação, Limpeza & Diagnóstico
* **Quick Build (F1) configurável em sequência:** Ex.: `PdfLaTeX + Bib(la)tex + PdfLaTeX (2x) + View PDF`, `LuaLaTeX + View PDF`, `XeLaTeX`, `Sweave`, `Asymptote`.
* **Atalhos individuais (`F2`..`F12`)** e **Comandos do Usuário (`Alt+Shift+F1`..`F5`)**.
* **Subdiretório `build/` (`--output-directory=build`):** Mantém a pasta raiz limpa.
* **Comando Clean:** Remove `.aux`, `.log`, `.toc`, `.bbl`, `.nav`, `.snm`, `.vrb`, `.listing`, `.spx` preservando `.pdf`.
* **Resumo de Erros/Avisos antes do Log completo** + **Próximo/Anterior Erro LaTeX** clicável para a linha.
* **Meta-tags mágicas:** `% !TEX root =`, `% !TEX encoding =`, `% !TEX spellcheck =`.

### E. PDF Viewer, SyncTeX & Automação
* **PDF Viewer integrado (Pdfium/QtPDF):** Zoom até 800%, modo 2 páginas, apresentação, contagem de palavras da página, atalhos `Home`/`End`.
* **SyncTeX bidirecional:** Código → PDF e PDF → Código.
* **User Tags (`Shift+F1`..`F10` + gatilho `:tag`):** Snippets customizados ilimitados.
* **Scripts `.tms` (QJSEngine):** Automação em JavaScript sobre texto/seleção (ex.: `hardwordwrap_selection_80col.tms`, `titlecase_selection.tms`).
* **GitHelper** (substituiu o antigo SVN helper na v6.0.0).

---

## 2. O que o ForjaTeX já tem vs. O que Adicionar e Melhorar

| Recurso | TeXmaker 6.0.0 | ForjaTeX (Atual v0.1.3) | Como podemos **superar** no ForjaTeX |
| :--- | :--- | :--- | :--- |
| **Layout & Redimensionamento** | Painéis acoplados estilo Qt clássico | Estilo VS Code/Antigravity, 3 colunas redimensionáveis + label `EDITOR` | Já superior em estética moderna; podemos adicionar **atalho para ocultar/mostrar Explorer ou PDF** (`Ctrl+B` / `Ctrl+P`). |
| **Árvore de Arquivos & Estrutura** | Structure View separado (sem árvore completa de pastas) | Explorer completo com pastas/subpastas + botão direito para Principal | **Adicionar aba/subpainel "Estrutura"** no Explorer mostrando `\section`, `\subsection`, `\label` e `\cite` clicáveis! |
| **Quick Build & Subpasta `build/`** | Sequência manual ou presets fixos | Seletor MiKTeX / TeX Live / Tectonic + `pdflatex`/`xelatex`/`lualatex`/`latexmk` | **Adicionar opção "Isolar arquivos auxiliares em `.build/`"** + botão **Limpar Auxiliares** + preset **LaTeX + BibTeX/Biber automático**. |
| **Autocompletar de `\cite{}` e `\ref{}`** | Parser `.bib` + diálogo `\ref` | Monaco Editor com syntax highlighting LaTeX | **Adicionar IntelliSense real no Monaco** para `\cite{}` (lendo `.bib` do projeto), `\ref{}` (lendo `\label{}`), e comandos `\begin{...}` com placeholders! |
| **Assistentes Visuais (Tabelas / Beamer / Quick Start)** | Diálogos modais antigos (Tabular, Quick Start, Beamer) | Copiloto IA (Split 70/30) | **Unir o melhor dos dois:** Criar **Assistente Visual de Tabelas** (colar do Excel/CSV → gera `booktabs` perfeito) + **Gerador de Novo Projeto** (Artigo, Tese ABNT, Prova `exam`, Beamer) sem depender de IA! |
| **Painel de Símbolos Matemáticos** | 400 botões fixos na lateral | Não possui ainda | **Barra rápida/drawer de Símbolos LaTeX & Favoritos** com busca instantânea por nome (ex.: digitar "integral" → `\int`). |
| **Corretor Ortográfico** | Hunspell local (`.dic`/`.aff`) | Não possui ainda | **Corretor ortográfico offline** (integrado ao Rust ou dicionários PT-BR/EN-US) ignorando comandos `\...` e `\cite{}`. |
| **Navegação de Erros & SyncTeX** | Próximo/Anterior erro + SyncTeX | Diagnósticos traduzidos + SyncTeX 1 clique (Explorer) e 2 cliques (Editor) | **Tornar os erros no painel inferior clicáveis** para saltar direto para a linha no Monaco + SyncTeX reverso (**Código → PDF**, `Ctrl+Click` no editor rola o PDF até a página!). |
| **IA Nativa (Diferencial ForjaTeX)** | Não possui | Split 70/30 BYOK (Gemini, OpenAI, Anthropic, Ollama) | Já é um diferencial exclusivo do ForjaTeX; adicionar **Rollback em 1 clique** se a edição da IA quebrar a compilação. |

