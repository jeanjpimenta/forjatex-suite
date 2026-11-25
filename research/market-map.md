# Mapa de Mercado — Editores e IDEs LaTeX (Base Contínua)

> **Última atualização:** 2026-11-24  
> **Nichos monitorados:** Estudantes e pesquisadores acadêmicos, editoras científicas, engenharia/documentação técnica, professores/criadores de provas.

---

## 1. Como o Dinheiro Flui no Ecossistema

* **Quem paga:** Estudantes de graduação/pós-graduação (quando pressionados por prazos e timeouts), pesquisadores individuais, departamentos universitários e universidades inteiras (licenças institucionais *Commons* / SSO), além de empresas de P&D.
* **Quem recebe:** Majoritariamente **Overleaf** (controlado pela Digital Science), que monetiza conveniência na nuvem, colaboração em tempo real e remoção de limites de compilação. Novos entrantes (Murfy, Crixet/Octree) tentam capturar receita via assinaturas de IA nativa; **Typst** monetiza sua plataforma web colaborativa enquanto mantém o compilador em Rust open-source.
* **Onde os clientes pagam caro (ou sofrem) e continuam insatisfeitos:**
  1. **Overleaf Free → Student/Standard:** Usuários relatam sensação de "PDF refém de paywall" quando o limite de **10 segundos** no plano gratuito falha em teses, figuras TikZ ou templates padrão antes de prazos de entrega.
  2. **Dependência de nuvem e privacidade:** Pesquisadores e engenheiros não podem/não querem subir artigos inéditos ou documentação proprietária para servidores externos, mas editores locais gratuitos têm UX datada ou configuração complexa.

---

## 2. Os 5 Maiores Players e Preços

| Produto | Modelo / Preço | Tração / Status | Pontos Fortes | Principais Reclamações |
| :--- | :--- | :--- | :--- | :--- |
| **Overleaf** (Digital Science) | Free (\$0, timeout 10s, 1 colab.); Student (~\$8.25/mês anual); Standard (~\$16.75/mês anual); Pro (~\$33.25/mês anual); Institucional | Líder absoluto de mercado; lançou *AI Assist* (2025) e apertou limites do plano grátis | Zero setup, colaboração em tempo real, biblioteca de templates | Timeouts rígidos (10s no Free), histórico/Git pagos, erros crípticos, 100% dependente de internet |
| **VS Code + LaTeX Workshop** | Gratuito (Open Source) | Escolha dominante de *power users* e devs | Editor moderno, Git nativo, suporte a IA (Copilot/Cursor), extensível | Curva de setup (receitas JSON), SyncTeX quebra com diretórios `build/`, exige configurar TeX Live/MiKTeX |
| **TeXstudio** | Gratuito (Open Source) | Padrão clássico offline mais recomendado | Funciona *out-of-the-box* com TeX local, estrutura clara, estável | Visual datado, interface poluída, salto de placeholders irritante |
| **Texmaker** | Gratuito (Open Source) | Base legada grande, perdendo usuários para TeXstudio/VS Code | Simples para iniciantes, multiplataforma | Interface arcaica, erros repentinos de "arquivo não encontrado", menos recursos modernos |
| **Typst** (Web App + CLI) | Compilador Open Source (Rust); Web App Freemium/Pago | **Crescimento acelerado** (v0.14 PDF/UA-1 e v0.15 em 2026 com MathML/HTML) | Compilação instantânea, sintaxe moderna, financeiramente sustentável | Não é LaTeX puro (incompatível direto com `.cls`/`.sty` exigidos por editoras como IEEE/ACM/Springer) |

---

## 3. Novos Entrantes (Últimos 12–18 Meses)

* **Murfy (Murfy AI):** Editor LaTeX online focado em IA nativa para times de pesquisa — agentes de revisão em contexto, correção inline de erros de compilação e geração de slides Beamer.
* **Crixet / Octree (evolução via Prism):** Editores LaTeX com assistente de IA integrado (*Chirp* no Crixet) focados em depuração de erros e escrita assistida na nuvem.

---

## 4. Recomendação Técnica de Stack (para IA construir com alta confiabilidade)

Como o projeto será **100% gratuito (donationware)**, multiplataforma (**Windows, Linux, macOS**), rápido, confiável e com **baixo consumo de memória**:
* **Recomendação principal: Tauri v2 (Rust backend) + React + TypeScript + Monaco Editor (ou CodeMirror 6) + PDF.js (com parser SyncTeX em Rust).**
  * *Por quê:* Consome ~40–90 MB em repouso (contra ~150–300+ MB do Electron), abre em <0.5s, gera instaladores de ~10–20 MB, e o backend em Rust executa processos locais (`pdflatex`, `xelatex`, `lualatex`, `latexmk`, `biber`) e parsing de `.synctex.gz` sem travar a UI.
  * *Ponto de atenção:* Testes visuais no WebKitGTK (Linux), WKWebView (macOS) e WebView2 (Windows) para garantir paridade de CSS e PDF.js.

