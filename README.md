<div align="center">
  <img src="forjatex-suite/public/logo.png" alt="ForjaTeX App Suite" width="84" />
  <h1>ForjaTeX App Suite</h1>
  <p>
    <strong>Ecossistema modular e gratuito para escrita científica em LaTeX</strong><br />
    <em>A free, modular ecosystem for scientific writing in LaTeX</em>
  </p>
  <p>
    <a href="#-português-brasil">Português (BR)</a> •
    <a href="#-english">English</a> •
    <a href="https://github.com/jeanjpimenta/forjatex-suite/releases">Downloads (Releases)</a> •
    <a href="src/i18n/README.md">Traduções / Translations</a>
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
| **ForjaSnap** | OCR de equações e tabelas (captura de tela/PDF → LaTeX). | Em breve |
| **ForjaBib** | Gerenciador visual de bibliografias `.bib` por DOI, ISBN e arXiv. | Em breve |
| **ForjaDiff** | Comparador visual de revisões com `latexdiff`. | Em breve |

### Download
Baixe os instaladores `.exe` (NSIS) e `.msi` diretamente na aba [**Releases**](https://github.com/jeanjpimenta/forjatex-suite/releases).

> **Requisito para compilação local:** tenha uma distribuição TeX instalada no sistema (**MiKTeX**, **TeX Live** ou **Tectonic**).
>
> **Nota sobre Assinatura Digital (Code Signing):** os instaladores atuais ainda **não possuem certificado de assinatura digital de código**, pois é um projeto independente em fase inicial. Por isso, o Windows SmartScreen pode exibir um aviso na primeira execução (basta clicar em *Mais informações → Executar assim mesmo*). Pretendo adicionar assinatura digital oficial assim que possível.

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
| **ForjaSnap** | Equation & table OCR (screenshot/PDF → LaTeX). | Coming soon |
| **ForjaBib** | Visual `.bib` bibliography manager with DOI, ISBN, and arXiv lookup. | Coming soon |
| **ForjaDiff** | Visual revision comparator powered by `latexdiff`. | Coming soon |

### Download
Grab the latest Windows `.exe` (NSIS) and `.msi` installers from [**GitHub Releases**](https://github.com/jeanjpimenta/forjatex-suite/releases).

> **Prerequisite for local LaTeX compilation:** install **MiKTeX**, **TeX Live**, or **Tectonic**.
>
> **Note on Code Signing:** current installers do **not yet have a digital code-signing certificate**, as this is an early-stage independent project. Because of this, Windows SmartScreen may show a warning on first launch (click *More info → Run anyway*). Official code signing is planned as soon as possible.

### Community Translations
Want to help translate **ForjaTeX** into Spanish, French, German, or another language? Check [src/i18n/README.md](src/i18n/README.md) — translations use simple JSON files!
