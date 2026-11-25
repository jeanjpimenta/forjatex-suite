# Banco de Dores Contínuo — Nicho LaTeX

> **Critério de corte:** Pontuação mínima **18/25** (Frequência, Intensidade, Disposição a Pagar/Migrar, Facilidade de Alcance, Viabilidade de MVP em 14 dias).  
> **Última atualização:** 2026-11-24

---

## Dor #1 — Configuração local traumática, `.sty` ausentes e erros crípticos (23/25)
* **Pontuação:** Frequência `5` | Intensidade `5` | Disposição a Pagar/Adotar `4` | Alcance `5` | Viabilidade MVP `4` = **23/25**
* **Quem sente:** Estudantes, pesquisadores e professores migrando do Overleaf (por causa do timeout de 10s) para editores locais (MiKTeX / TeX Live / VS Code).
* **Evidências e Sinais:**
  * Reclamações recorrentes no `r/LaTeX` e `r/math` sobre o Overleaf cortar compilações em 10s ("holding PDFs hostage") e a dor de configurar pacotes locais manualmente.
  * Queixas no `r/LaTeX` e TeX StackExchange sobre erros como `Undefined control sequence`, `Missing } inserted` apontando para `l.end document`, e arquivos `.sty`/`.cls` de editoras (IEEE, Springer, ACM) que falham fora da pasta raiz.
  * Fontes observadas: `r/LaTeX`, `r/math`, [Trustpilot Overleaf](https://www.trustpilot.com/), [G2 Overleaf](https://www.g2.com/), [TeX StackExchange](https://tex.stackexchange.com/).

---

## Dor #2 — SyncTeX frágil e perda de contexto em projetos multi-arquivo (22/25)
* **Pontuação:** Frequência `4` | Intensidade `5` | Disposição a Pagar/Adotar `4` | Alcance `5` | Viabilidade MVP `4` = **22/25**
* **Quem sente:** Doutorandos, autores de livros/teses e engenheiros escrevendo documentos divididos em múltiplos capítulos (`\include`, `\input`, `.cls`, `.bib`).
* **Evidências e Sinais:**
  * Issues recorrentes no [LaTeX-Workshop](https://github.com/James-Yu/LaTeX-Workshop/issues) e [TeXstudio](https://github.com/texstudio-org/texstudio/issues) sobre SyncTeX quebrando quando há arquivos auxiliares em subpastas (`build/`), necessidade de magic comments (`%! TEX root = main.tex`) para compilar a partir de subarquivos, e perda de sincronização entre PDF e código.
  * Usuários relatam no `r/LaTeX` ter que apagar `.synctex.gz`, `.aux` e `.log` manualmente e reiniciar o editor.

---

## Dor #3 — IA genérica (Cursor/Copilot) quebrando layouts e alucinando chaves BibTeX (21/25)
* **Pontuação:** Frequência `4` | Intensidade `4` | Disposição a Pagar/Adotar `4` | Alcance `5` | Viabilidade MVP `4` = **21/25**
* **Quem sente:** Pesquisadores e estudantes que usam Cursor ou VS Code + Copilot para acelerar escrita LaTeX.
* **Evidências e Sinais:**
  * Discussões em `r/cursor`, `r/LaTeX` e `r/ChatGPTCoding` apontam que assistentes genéricos entram em loop infinito com chaves `{}` não fechadas, reescrevem o preâmbulo quebrando partes que já compilavam, poluem o contexto com logs de 4.000 linhas e inventam pacotes ou chaves `\cite{}` inexistentes no `.bib`.

---

## Dor #4 — Tabelas em LaTeX e criação de provas/avaliações (20/25)
* **Pontuação:** Frequência `5` | Intensidade `4` | Disposição a Pagar/Adotar `4` | Alcance `4` | Viabilidade MVP `3` = **20/25**
* **Quem sente:** Professores, criadores de provas (`exam` class), engenheiros e estudantes.
* **Evidências e Sinais:**
  * No `r/LaTeX`, tabelas são apontadas como o ponto mais odiado ("sintaxe dos anos 70", texto que vaza da margem); usuários dependem de sites externos como `TablesGenerator.com` ou colagem de planilhas.
  * Professores relatam dificuldade em alinhar pontuações, espaçamento de alternativas e gerar versões A/B de provas sem quebrar o layout.

---

## Dor #5 — Dança de compilação BibTeX/Biber e referências `[?]` (19/25)
* **Pontuação:** Frequência `4` | Intensidade `4` | Disposição a Pagar/Adotar `3` | Alcance `4` | Viabilidade MVP `4` = **19/25**
* **Quem sente:** Estudantes de graduação/pós e editoras científicas.
* **Evidências e Sinais:**
  * Usuários no `r/LaTeX` e `r/PhD` reclamam da obrigação de rodar `LaTeX -> BibTeX -> LaTeX -> LaTeX` manualmente ou configurar `latexmk` corretamente, e de passar horas caçando por que citações viram `[?]`.

