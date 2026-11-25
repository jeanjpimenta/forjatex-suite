# Contribuindo com Traduções / Contributing Translations

O **ForjaTeX** utiliza arquivos JSON simples em `src/i18n/locales/` para facilitar a tradução pela comunidade.

## Como adicionar um novo idioma (ex: Espanhol `es.json`)

1. Copie `src/i18n/locales/en.json` ou `src/i18n/locales/pt-BR.json` para `src/i18n/locales/<codigo>.json` (ex: `es.json`, `fr.json`, `de.json`).
2. Traduza apenas os **valores** mantendo exatamente as mesmas **chaves**.
3. Registre o novo idioma em `AVAILABLE_LOCALES` no arquivo `src/i18n/index.tsx`.
4. Abra um Pull Request no repositório do ForjaTeX!

