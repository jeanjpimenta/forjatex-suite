<div align="center">
  <img src="forjatex-suite/public/logo.png" alt="ForjaTeX App Suite" width="84" />
  <h1>ForjaTeX App Suite</h1>
  <p>
    <strong>Ecossistema modular e gratuito para escrita científica em LaTeX</strong><br />
    <em>A free, modular ecosystem for scientific writing in LaTeX</em>
  </p>
  <p>
    <a href="https://forjatex.com.br">Site Oficial (forjatex.com.br)</a> •
    <a href="#-português-brasil">Português (BR)</a> •
    <a href="#-english">English</a> •
    <a href="https://github.com/jeanjpimenta/forjatex-suite/releases">Downloads (Releases)</a> •
    <a href="https://discord.gg/HSwh6MM9Bn">Discord</a> •
    <a href="src/i18n/README.md">Traduções / Translations</a>
  </p>
  <p>
    <a href="https://discord.gg/HSwh6MM9Bn">
      <img src="https://img.shields.io/badge/Discord-Comunidade%20ForjaTeX-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="Discord ForjaTeX" />
    </a>
  </p>
</div>

---

## 🇧🇷 Português (Brasil)

O **ForjaTeX App Suite** reúne aplicativos desktop rápidos, offline-first e de código aberto desenvolvidos em **Tauri v2 + Rust + React** para simplificar todo o fluxo de trabalho acadêmico e científico em LaTeX.

### Aplicativos da Suíte

| Aplicativo | Descrição | Status |
| :--- | :--- | :--- |
| **ForjaTeX App Suite** | Hub central para abrir, instalar e atualizar todos os aplicativos da suíte via GitHub Releases. | Disponível |
| **ForjaTeX IDE** | Editor LaTeX completo com Monaco Editor, PDF Preview + SyncTeX, Assistentes visuais (Tabelas, Matrizes, Fontes, Imagens, Bibliografia), Corretor LaTeX-Aware, Git integrado e IA (BYOK). | Disponível |
| **ForjaTikZ** | Studio visual interativo para criar diagramas **TikZ** (`tikzpicture`) e gráficos matemáticos **PGFPlots** com exportação `.tex` e validação via `pdflatex`. | Disponível |
| **ForjaBeam** | Construtor visual de apresentações **LaTeX Beamer** com galeria de temas, 2 colunas, blocos semânticos, overlays, notas `pgfpages` e edição bidirecional `.tex`. | Disponível |
| **ForjaSlide** | Apresentador ao vivo de PDFs e slides **Beamer** em duas telas (visão do apresentador + janela do público), suporte nativo a `pgfpages`, laser, caneta e cronômetro. | Disponível |
| **ForjaSnap** | OCR de equações e tabelas (captura de tela/PDF → LaTeX). | Em breve |
| **ForjaBib** | Gerenciador visual de bibliografias `.bib` com importação por DOI, arXiv e ISBN, linter pre-flight, proteção de siglas/ABNT, prévia formatada e auditoria `.tex`. | Disponível |
| **ForjaDiff** | Comparador visual de revisões com `latexdiff`. | Em breve |

### Download
Baixe os instaladores para **Windows** (`.exe` / `.msi`) e **Linux** (`.deb` / `.AppImage`) diretamente na aba [**Releases**](https://github.com/jeanjpimenta/forjatex-suite/releases).

> **Requisito para compilação local:** tenha uma distribuição TeX instalada no sistema (**MiKTeX**, **TeX Live** ou **Tectonic**).
>
> **Nota sobre Assinatura Digital (Code Signing):** os instaladores atuais ainda **não possuem certificado de assinatura digital de código**, pois é um projeto independente em fase inicial. Por isso, o Windows SmartScreen pode exibir um aviso na primeira execução (basta clicar em *Mais informações → Executar assim mesmo*). Pretendo adicionar assinatura digital oficial assim que possível.

### Comunidade no Discord
Tem dúvidas sobre LaTeX/ABNT, sugestões de recursos, bugs ou quer acompanhar as novidades? Entre no servidor oficial do ForjaTeX no Discord: [**discord.gg/HSwh6MM9Bn**](https://discord.gg/HSwh6MM9Bn).

### Contribua com Traduções
Quer ajudar a traduzir o **ForjaTeX** para Espanhol, Francês, Alemão ou outro idioma? Veja o passo a passo simples em [src/i18n/README.md](src/i18n/README.md).

---

## 🇺🇸 English

**ForjaTeX App Suite** is a free, open-source, offline-first desktop ecosystem built with **Tauri v2 + Rust + React** designed to streamline scientific writing in LaTeX.

### Suite Applications

| Application | Description | Status |
| :--- | :--- | :--- |
| **ForjaTeX App Suite** | Central launcher and updater for installing, launching, and updating all suite apps via GitHub Releases. | Available |
| **ForjaTeX IDE** | Full-featured LaTeX IDE with Monaco Editor, PDF Preview + SyncTeX, Visual Wizards (Tables, Matrices, Fonts, Images, Bibliography), LaTeX-Aware Spell & Grammar Checker, built-in Git, and BYOK AI assistant. | Available |
| **ForjaTikZ** | Interactive visual studio for **TikZ** diagrams and **PGFPlots** math graphs with live LaTeX code generation, `.tex` export, and `pdflatex` validation. | Available |
| **ForjaBeam** | Visual **LaTeX Beamer** presentation builder with theme gallery, 2-column layouts, semantic blocks, overlays, `pgfpages` notes, and bidirectional `.tex` editing. | Available |
| **ForjaSlide** | Dual-screen live PDF & **Beamer** presenter (presenter view + fullscreen audience window) with native `pgfpages` notes, laser pointer, pen ink, and timer. | Available |
| **ForjaSnap** | Equation & table OCR (screenshot/PDF → LaTeX). | Coming soon |
| **ForjaBib** | Visual `.bib` bibliography manager with DOI, ISBN, and arXiv lookup, pre-flight linter, acronym/ABNT helpers, live preview, and `.tex` citation audit. | Available |
| **ForjaDiff** | Visual revision comparator powered by `latexdiff`. | Coming soon |

### Download
Grab the latest **Windows** (`.exe` / `.msi`) and **Linux** (`.deb` / `.AppImage`) installers from [**GitHub Releases**](https://github.com/jeanjpimenta/forjatex-suite/releases).

> **Prerequisite for local LaTeX compilation:** install **MiKTeX**, **TeX Live**, or **Tectonic**.
>
> **Note on Code Signing (Windows):** current Windows installers do **not yet have a digital code-signing certificate**, as this is an early-stage independent project. Because of this, Windows SmartScreen may show a warning on first launch (click *More info → Run anyway*). Official code signing is planned as soon as possible.

### Estrutura do Repositório / Repository Structure

| Path | Description |
| --- | --- |
| `src/` & `src-tauri/` | **ForjaTeX IDE** — Desktop LaTeX IDE (React + TypeScript + Tauri v2 / Rust). |
| `forjatex-suite/` | **ForjaTeX App Suite** — Cross-platform launcher, installer & updater (Windows `.msi`/`.exe` & Linux `.deb`/`.AppImage`). |
| `forjatikz/` | **ForjaTikZ** — Visual TikZ & PGFPlots diagram studio (Windows & Linux). |
| `forjabeam/` | **ForjaBeam** — Visual LaTeX Beamer presentation builder (Windows & Linux). |
| `forjaslide/` | **ForjaSlide** — Dual-screen PDF & Beamer live presenter (Windows & Linux). |
| `forjabib/` | **ForjaBib** — Visual BibTeX & BibLaTeX (ABNT) bibliography manager (Windows & Linux). |
| `docs/manuals/` | Official bilingual user manuals (`PT-BR` & `EN-US`) in Markdown and PDF, bundled inside each app. |
| `docs/GUIA-GITHUB-RELEASES.md` | Maintainer guide for versioning, tags, and automated GitHub Releases. |
| `.github/workflows/` | `ci-verify.yml` (cross-platform build check on every push) & `release-suite.yml` (Windows + Linux release builds). |
| `suite-manifest.json` | Live release manifest consumed by **ForjaTeX App Suite** on Windows and Linux. |

### Discord Community
Have questions, feature ideas, bug reports, or want to share your TikZ/PGFPlots creations? Join the official ForjaTeX Discord server: [**discord.gg/HSwh6MM9Bn**](https://discord.gg/HSwh6MM9Bn).

### Community Translations
Want to help translate **ForjaTeX** into Spanish, French, German, or another language? Check [src/i18n/README.md](src/i18n/README.md) — translations use simple JSON files!

---

## Licença & Marca / License & Credits

- **Código-fonte / Source Code:** [GNU GPL v3.0](LICENSE) — qualquer versão modificada distribuída deve permanecer com código aberto sob GPL v3.
- **Marca e Logotipos / Trademarks & Logos:** consulte [NOTICE.md](NOTICE.md).
- **Idealizado e mantido por / Created & maintained by:** [**Jean Pimenta**](https://jeanpimenta.com.br) · [**Arkhé Code**](https://arkhecode.com.br) — Desenvolvimento de software, automação e soluções digitais.
