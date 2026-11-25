# Guia Passo a Passo: Publicar o ForjaTeX App Suite no GitHub Releases (100% Gratuito)

Este projeto já está configurado com **GitHub Actions** (`.github/workflows/release-suite.yml`) para compilar automaticamente o **ForjaTeX IDE**, o **ForjaTeX App Suite** e o **ForjaTikZ** na nuvem da Microsoft/GitHub, sem nenhum custo em repositórios públicos.

---

## Passo 1 — Criar a conta e o repositório público no GitHub
1. Crie uma conta gratuita em [github.com](https://github.com).
2. Clique em **New repository**, dê o nome `forjatex-suite` e deixe marcado como **Public** (repositórios públicos têm GitHub Actions e Releases gratuitos).

## Passo 2 — Gerar seu Token (PAT) para enviar o código
1. No GitHub, vá em **Settings → Developer settings → Personal access tokens → Tokens (classic)**.
2. Clique em **Generate new token (classic)**, marque a permissão **`repo`** e **`workflow`**, e copie o token (`ghp_...`).
3. No **ForjaTeX IDE**, abra **Configurações → Git**:
   - Preencha seu **Nome** e **E-mail**.
   - Cole o **Token (PAT)** e clique em **Salvar Token no Windows**.

## Passo 3 — Enviar o projeto para o GitHub
No terminal dentro da pasta `2.19 - IDE LaTeX`:
```powershell
git init -b main
git add .
git commit -m "ForjaTeX Suite v1.0.0"
git remote add origin https://github.com/jeanjpimenta/forjatex-suite.git
git push -u origin main
```

## Passo 4 — Publicar uma nova versão automática (Tag)
Sempre que quiser lançar uma atualização para todos os usuários do **ForjaTeX App Suite**, basta criar uma tag e enviar:
```powershell
git tag v1.3.0
git push origin v1.3.0
```
O **GitHub Actions** vai rodar sozinho (em ~8 minutos) e publicar na aba **Releases**:
- Todos os instaladores `.exe` e `.msi` do **ForjaTeX**, **ForjaTeX Suite** e **ForjaTikZ**;
- O arquivo `suite-manifest.json` atualizado.

## Passo 5 — Link para o seu site
No seu site de divulgação, o botão **"Baixar ForjaTeX App Suite"** deve apontar para:
```text
https://github.com/jeanjpimenta/forjatex-suite/releases/latest/download/ForjaTeX.Suite_1.0.0_x64-setup.exe
```
E dentro do **ForjaTeX App Suite**, configure a URL do manifesto para:
```text
https://github.com/jeanjpimenta/forjatex-suite/releases/latest/download/suite-manifest.json
```
Assim, qualquer usuário que clicar em **Verificar Atualizações** receberá os novos apps e versões automaticamente!

