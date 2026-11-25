# 3 Ideias / Módulos-Âncora nas Brechas do Mercado

> **Contexto do Projeto:** Software gratuito (donationware), multiplataforma (Windows/Linux/Mac), layout estilo VS Code/Antigravity, suporte a MiKTeX/TeX Live, Explorer com definição visual do arquivo principal (`main.tex`), SyncTeX inteligente (1 clique destaca no Explorer, 2 cliques abre o arquivo), painel de IA opcional (70/30) com chave do próprio usuário.  
> **Sugestões iniciais de Nome para o IDE:** **TexForge**, **VellumTeX**, **Scriptorium** ou **LumenTeX** (decidiremos juntos antes de gerar logo/favicon).

---

## Ideia 1 (Rank #1 — Recomendada): **Overleaf Escape & Zero-Config Local Compiler**
* **Pitch em 1 linha:** Um IDE desktop gratuito e instantâneo onde você escolhe MiKTeX, TeX Live ou Tectonic com 1 clique, importa ZIPs do Overleaf sem timeout de 10s e tem diagnósticos humanos em vez de logs de 4.000 linhas.
* **Lacuna preenchida:** Overleaf cobra caro ou trava em 10s no plano grátis; VS Code exige JSON recipes e setup complexo; TeXstudio tem UI dos anos 2000. Ninguém entrega **experiência moderna estilo VS Code + zero configuração + compilação local ilimitada**.
* **Quem sente a dor:** Estudantes de graduação/pós-graduação, pesquisadores com prazos apertados e engenheiros que não podem subir docs confidenciais para a nuvem.
* **Provas reais (fontes):** Reclamações sobre timeout de 10s no `r/LaTeX` e Trustpilot; queixas de setup no `r/LaTeX` e issues do `LaTeX-Workshop`; elogios à simplicidade do Overleaf no G2.
* **Pontuação da dor:** **23/25** (Freq 5, Int 5, Adoção 4, Alcance 5, MVP 4).
* **Por que concorrentes falham:** Overleaf depende de receita de servidor (não pode dar compilação pesada grátis); VS Code é generalista; TeXstudio prioriza compatibilidade legada sobre UX moderna.
* **Modelo & Doação (estimativa):** 100% gratuito e open-source; botão discreto de "Reportar Bug / Sugerir Recurso" + "Apoiar o Projeto" (Pix/Stripe/GitHub Sponsors — estimativa: conversão de 1–3% de usuários ativos recorrentes pode cobrir custos de domínio/assinatura de código dentro do orçamento de R$5.000).
* **MVP (14 dias):**
  * *Principal:* Explorer à esquerda com botão "Definir como Principal" (`main.tex`), detector automático de MiKTeX/TeX Live no sistema, compilação `latexmk` com barra de progresso e tradutor de erros (extrai linha exata e mensagem limpa do `.log`), visualizador PDF.js à direita.
  * *Cortar no MVP:* Colaboração real-time na nuvem, editor WYSIWYG completo, loja de plugins.
  * *Stack:* Tauri v2 (Rust) + React + TypeScript + Monaco Editor + PDF.js.
* **Primeiros 10 usuários & Roteiro:** `r/LaTeX`, grupos de pós-graduação/TCC no Brasil e Discord acadêmico.  
  * *DM/Post:* *"Vi que você bateu no limite de 10s do Overleaf com sua tese/artigo. Estou construindo um IDE LaTeX gratuito e offline estilo VS Code que detecta seu MiKTeX/TeX Live automaticamente e compila sem limites. Quer testar o build de Windows/Mac/Linux e me dizer o que falta?"*
* **O QUE MATARIA ESTA IDEIA?**
  * Usuários não quererem instalar MiKTeX/TeX Live (4 GB+) mesmo com um bom IDE. *Teste mais barato esta semana:* Oferecer detecção + instalador guiado (ou suporte opcional ao `Tectonic`, binário único de ~30 MB que baixa pacotes sob demanda) e validar com 5 usuários do Overleaf se eles conseguem compilar um `.zip` exportado em menos de 3 minutos.

---

## Ideia 2 (Rank #2): **SyncTeX Explorer-First & Multi-File Studio**
* **Pitch em 1 linha:** O primeiro IDE LaTeX onde clicar no PDF destaca instantaneamente o capítulo/arquivo no Explorer e mantém `.aux`/`.log`/`.synctex.gz` isolados sem nunca quebrar a sincronização.
* **Lacuna preenchida:** Em projetos grandes (teses, livros de editoras científicas, manuais de engenharia com 20+ arquivos `.tex`), editores atuais perdem o `root file`, exigem magic comments manuais e quebram o SyncTeX quando arquivos de build são separados.
* **Quem sente a dor:** Doutorandos, editores científicos (IEEE/Springer/ABNT) e engenheiros de documentação técnica.
* **Provas reais (fontes):** Issues no GitHub do `LaTeX-Workshop` e `TeXstudio` sobre `rootFile` e `-synctex=1`; threads no `r/LaTeX` e TeX StackExchange sobre SyncTeX pulando para páginas erradas.
* **Pontuação da dor:** **22/25** (Freq 4, Int 5, Adoção 4, Alcance 5, MVP 4).
* **Por que concorrentes falham:** VS Code trata pastas como código genérico; TeXstudio acopla mal a árvore de arquivos com o visualizador PDF.
* **MVP (14 dias):**
  * *Principal:* Parser de `.synctex.gz` em Rust conectado ao PDF.js: 1 clique no PDF ilumina o arquivo correspondente na árvore do Explorer; 2 cliques abre/foca a aba exata na linha no editor central. Pasta `.build/` oculta por padrão sem quebrar caminhos.
  * *Cortar no MVP:* Preview visual de TikZ inline, diff visual de PDFs.
* **Primeiros 10 usuários:** Autores de teses em `r/PhD`, `r/LaTeX` e canais de pós-graduação.
* **O QUE MATARIA ESTA IDEIA?**
  * Documentos com macros muito complexas onde o próprio `synctex` do TeX gera coordenadas imprecisas. *Teste mais barato:* Rodar nosso parser de `.synctex.gz` contra 5 templates reais (tese ABNT, artigo IEEE, livro Springer, prova `exam`, relatório técnico) antes de fechar a UI.

---

## Ideia 3 (Rank #3): **Safe-Context LaTeX AI & Visual Table/Exam Copilot (70/30 Split)**
* **Pitch em 1 linha:** Um copiloto de IA acoplado (split 70/30 redimensionável) usando a própria chave do usuário, que só aplica alterações após validar a compilação e traz construtor rápido de tabelas e provas.
* **Lacuna preenchida:** Cursor e Copilot quebram o preâmbulo, inventam chaves `\cite{}` e poluem o contexto; Overleaf AI é pago e limitado. Ninguém oferece **IA BYOK (Bring Your Own Key) com sandbox de compilação LaTeX + validação de `.bib`**.
* **Quem sente a dor:** Pesquisadores que já usam IA, professores criando provas (`exam` class) e estudantes lutando com tabelas.
* **Provas reais (fontes):** Queixas em `r/cursor` e `r/LaTeX` sobre alucinações e loops; ódio generalizado a tabelas manuais e uso de `TablesGenerator.com` no `r/LaTeX`.
* **Pontuação da dor:** **21/25** (Freq 4, Int 4, Adoção 4, Alcance 5, MVP 4).
* **Por que concorrentes falham:** Murfy e Crixet cobram assinatura mensal pela IA na nuvem; Cursor não entende semântica de `.bib` nem valida `.log` automaticamente antes de aplicar o diff.
* **MVP (14 dias):**
  * *Principal:* Painel lateral/central 70/30 redimensionável com suporte a chave OpenAI / Gemini / Anthropic / Ollama local; injeção automática apenas do arquivo ativo + `.bib` keys + últimas 30 linhas de erro do `.log`; botão "Aplicar e Compilar" com rollback em 1 clique se falhar.
  * *Cortar no MVP:* Geração visual drag-and-drop de TikZ, banco de questões completo.
* **Primeiros 10 usuários:** Usuários de `r/LaTeX` e `r/cursor` que escrevem artigos com IA, além de professores de exatas.
* **O QUE MATARIA ESTA IDEIA?**
  * Usuários iniciantes não saberem gerar uma API Key, ou a API de IA custar caro para o usuário final. *Teste mais barato:* Suportar também modelos gratuitos/locais (Ollama) e tier gratuito do Gemini API nas configurações, e testar com 5 usuários se o fluxo BYOK é claro.

