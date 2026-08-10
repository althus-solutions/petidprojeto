# MyPetID

Plataforma de reencontro de animais perdidos — QR Code fixo na coleira + matching por IA entre ocorrências de perda e registros de resgate.

**Meta:** lançamento na feira pet de 12–14 de agosto de 2026.

## Stack

- **Frontend:** React + Vite + Tailwind (PWA)
- **Backend:** Supabase (Postgres + PostGIS + pgvector + Auth + Storage)
- **Orquestração:** n8n (matching, notificações)
- **IA:** Ollama self-hosted (visão)
- **Deploy:** Vercel

## Documentação

Toda a documentação do projeto está em **[`docs/`](docs/README.md)**.

Comece pelo [**PRD**](docs/PRD.md) para visão de produto e status de implementação.

## Desenvolvimento local

```bash
cp .env.example .env.local
# Preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY

npm install
npm run dev
```

## Migrations Supabase

Arquivos em `supabase/migrations/` — aplicar em ordem no SQL Editor do Supabase ou via CLI.

## Prompts de implementação

Siga a ordem em [`docs/PROMPTS.md`](docs/PROMPTS.md).
