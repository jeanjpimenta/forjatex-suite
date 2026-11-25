# Estudo de Pacotes e Arquitetura do Assistente Avançado de Tabelas — ForjaTeX

## 1. Análise dos Pacotes LaTeX para Tabelas Complexas

### A. Paradigma Moderno: `tabularray` (LaTeX3 — Recomendado)
* **Por que é superior:** Unifica em um único pacote os papéis de `tabular`, `tabularx` (colunas `X` com quebra de linha), `multirow`, `longtable` (`longtblr`), `colortbl` e `makecell`, separando estilo de conteúdo (estilo CSS).
* **Bibliotecas complementares:** `\UseTblrLibrary{booktabs, siunitx}` traz as réguas tipográficas do `booktabs` (`\toprule`, `\midrule`, `\bottomrule`, `\cmidrule`) e alinhamento decimal do `siunitx` (`S`).
* **Mesclagem limpa:** `\SetCell[c=2, r=2]{c}` substitui o aninhamento frágil de `\multicolumn` + `\multirow`.
* **Multipágina sem dor:** `\begin{longtblr}{ rowhead = 1, ... }` repete o cabeçalho em todas as páginas automaticamente.

### B. Paradigma Clássico (Compatibilidade com Editoras / Templates Legados)
* **`booktabs`:** Padrão ouro acadêmico para linhas horizontais (`\toprule`, `\midrule`, `\bottomrule`, `\cmidrule(lr){a-b}`).
* **`multirow` + `\multicolumn`:** Mesclagem vertical e horizontal (exige células vazias `&` nas linhas cobertas).
* **`tabularx`:** Colunas `X` que quebram texto automaticamente dentro da largura da página (`\textwidth`).
* **`longtable`:** Tabelas que atravessam múltiplas páginas.
* **`siunitx`:** Coluna tipo `S` para alinhar números pelo separador decimal.
* **`threeparttable`:** Notas de rodapé (`\tnote{1}` + `\begin{tablenotes}`) alinhadas exatamente à largura da tabela.
* **`xcolor` (`[table]`) / `colortbl`:** Cores de fundo em linhas (`\rowcolor`) e células (`\cellcolor`).

---

## 2. Como Tornar Tudo Isso Intuitivo no Assistente Visual do ForjaTeX

1. **Seletor de Motor de Tabela:**
   * **Moderno (`tabularray` — Recomendado)**
   * **Clássico (`booktabs + multirow + tabularx`)**
2. **Grade Interativa estilo Planilha (com Seleção por Arraste / Shift+Clique):**
   * **Mesclar / Desfazer Mesclagem (`colSpan` e `rowSpan` visuais):** Seleciona um bloco (ex.: 2×2 ou 1×3) e clica em **Mesclar**; a grade já exibe a célula mesclada e o gerador cuida dos `&` vazios e `\cmidrule(lr){...}` automaticamente.
   * **Formatação por Célula:** Negrito, Itálico, Alinhamento individual e **Cor de fundo** (paleta sutil acadêmica: sem cor, cinza claro, azul suave, âmbar suave, verde suave).
3. **Configuração por Coluna (clicando no cabeçalho `Col A`, `Col B`...):**
   * Tipo: `l` (Esquerda), `c` (Centro), `r` (Direita), `X` (Texto longo com quebra), `p{...}` (Largura fixa) ou `S` (Numérico decimal `siunitx`).
4. **Opções Estruturais em 1 Clique:**
   * **Estilo de Bordas:** Acadêmico (`booktabs`), Grade Completa, Minimalista.
   * **Listrado (Zebra Striping):** Alternância suave nas linhas de dados.
   * **Multipágina (`longtblr` / `longtable`)** com repetição de cabeçalho.
   * **Notas de Rodapé (`threeparttable` / `talltblr`):** Lista simples para adicionar notas numeradas `[1]`, `[2]`.
5. **Preview ao Vivo + Pacotes Necessários:**
   * Painel lateral/inferior mostrando o código LaTeX gerado em tempo real e os `\usepackage{...}` requeridos (com botão de cópia rápida ou inserção no preâmbulo).

