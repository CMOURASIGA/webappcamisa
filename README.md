# WebApp de Solicitação de Camisas (React + Google Apps Script)

Aplicação frontend em React/Vite integrada ao backend em Google Apps Script para gravar solicitações na planilha oficial.

## Pré-requisitos

- Node.js 18+
- Projeto publicado no Google Apps Script como Web App

## Variáveis de ambiente

Crie um `.env.local` com base no `.env.example`.

- `VITE_GAS_WEB_APP_URL`: URL `/exec` do Web App do Apps Script
- `VITE_USE_MOCK_API`: `true` para validar UI com mock, `false` para integração real

## Rodar local

1. `npm install`
2. Ajustar `.env.local`
3. `npm run dev`

## Build

- `npm run build`

## Deploy na Vercel

Configure as mesmas variáveis no projeto da Vercel:

- `VITE_GAS_WEB_APP_URL`
- `VITE_USE_MOCK_API` (normalmente `false`)

## Google Apps Script

O arquivo pronto para colar no Apps Script está em:

- `google-apps-script/code.gs`

Depois de publicar, copie a URL `/exec` e use em `VITE_GAS_WEB_APP_URL`.
