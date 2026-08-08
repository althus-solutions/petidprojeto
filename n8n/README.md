# PetID — Workflows n8n

Orquestração assíncrona conforme `docs/architecture.md` §1.3.

## Workflow: `enviar_notificacao`

**Arquivo:** `workflows/enviar_notificacao.json`

Dispara quando uma linha é inserida em `public.notificacoes` com `status = 'pendente'`.

### Fluxo

```
Database Webhook (INSERT notificacoes)
  → Filtrar status = pendente
  → RPC obter_contexto_notificacao_envio
  → Switch canal (whatsapp | email | push)
  → Enviar (Z-API / Resend / Edge Function send-push)
  → RPC confirmar_envio_notificacao (+ custo_estimado se WhatsApp)
  → Em erro: RPC registrar_falha_notificacao
```

### Variáveis de ambiente (n8n)

Copie `n8n/.env.example` para o ambiente do n8n (nunca commitar valores reais).

| Variável | Uso |
|----------|-----|
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | RPCs e Edge Function push |
| `Z_API_INSTANCE_ID` | Instância Z-API |
| `Z_API_TOKEN` | Token da instância |
| `Z_API_CLIENT_TOKEN` | Header `Client-Token` |
| `RESEND_API_KEY` | E-mail transacional |
| `RESEND_FROM` | Remetente (ex.: `PetID <notificacoes@dominio.com>`) |
| `PETID_N8N_WEBHOOK_SECRET` | (opcional) validar origem do webhook |

### 1. Importar workflow

1. Abra o n8n da Kainon.
2. **Workflows → Import from File** → `n8n/workflows/enviar_notificacao.json`.
3. Ajuste credenciais HTTP nos nós (ou use expressões `{{ $env.VAR }}`).

### 2. Database Webhook no Supabase

No painel Supabase → **Database → Webhooks**:

| Campo | Valor |
|-------|-------|
| Nome | `petid_notificacao_pendente` |
| Tabela | `notificacoes` |
| Eventos | `INSERT` |
| Método | `POST` |
| URL | URL do webhook do n8n (nó *Webhook Trigger*) |
| Headers | `Content-Type: application/json` |

Filtro recomendado (se disponível): `record.status = 'pendente'`.

### 3. Z-API (WhatsApp)

Endpoint usado no workflow:

```
POST https://api.z-api.io/instances/{INSTANCE}/token/{TOKEN}/send-text
Header: Client-Token: {CLIENT_TOKEN}
Body: { "phone": "5511999999999", "message": "..." }
```

O telefone vem de `destinatario.telefone_e164` (normalizado na RPC).

`custo_estimado` gravado conforme `configuracoes_sistema.notificacoes.custo_whatsapp_utility_brl` (padrão R$ 0,037).

### 4. Resend (e-mail)

```
POST https://api.resend.com/emails
Authorization: Bearer {RESEND_API_KEY}
```

### 5. Web Push (Edge Function)

Deploy:

```bash
supabase functions deploy send-push --no-verify-jwt
supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:...
```

Chamada (n8n):

```
POST {SUPABASE_URL}/functions/v1/send-push
Authorization: Bearer {SERVICE_ROLE_KEY}
Body: { "user_id", "title", "body", "notificacao_id" }
```

Tutores ativam push no painel (`/tutor`) — componente `PushOptIn`.

### 6. Fallback de canal

A RPC `obter_contexto_notificacao_envio` já aplica:

- `push` sem inscrição → `fallback_canal` (padrão `email`)
- `whatsapp` sem telefone → `email`

### 7. Teste manual

1. Aplique a migration `006_notificacoes_multicanal.sql`.
2. Leia um QR Code em `/qr/{payload}`.
3. Verifique `notificacoes` com `status = 'pendente'`.
4. Confirme envio real e `status = 'enviado'` + `custo_estimado` (WhatsApp).

### Tipos de evento suportados (mensagens)

| `tipo_evento` | Origem |
|---------------|--------|
| `qr_lido` | `registrar_leitura_qr` |
| `qr_lido_com_localizacao` | `registrar_leitura_qr` |
| `match_sugerido` | RF-06 via `enfileirar_notificacao_tutor` após score ≥ limiar |
| `ocorrencia_aberta` | futuro |
| `resgate_registrado` | futuro |

## Workflow: `job_retencao_dados` (Prompt 9)

**Arquivo:** `workflows/job_retencao_dados.json`

Alternativa ao pg_cron. Por padrão chama `executar_retencao_n8n` com **dry_run=true**.

| Variável | Uso |
|----------|-----|
| `SUPABASE_URL` | URL do projeto |
| `SUPABASE_SERVICE_ROLE_KEY` | RPC `executar_retencao_n8n` |

O JSON do workflow envia `"p_dry_run": true`. Após staging, edite o body do nó HTTP para `false` (ou use só o pg_cron com `agendamento_ativo=true`).

## Workflow: `on_novo_resgate` (Prompt 6 / RF-06)

**Arquivo:** `workflows/on_novo_resgate.json`

Poll a cada 30s + webhook opcional → Edge Function `analyze-pet`:

1. `claim_matching_job` (dentro da Edge se sem `job_id`)
2. Signed URL Storage → AI Provider (`fake` ou `ollama` via `configuracoes_sistema.ai_provider`)
3. RPC `concluir_job_matching_com_analise` (persiste + PostGIS/pgvector + `matches` + enqueue notify)

Triggers no Postgres (`matching_jobs`) após INSERT em `registros_resgate` / `animais` / `ocorrencias_perdido` — **não bloqueia** o upload do usuário.

Deploy Edge:

```bash
supabase functions deploy analyze-pet --no-verify-jwt
```

MVP: `ai_provider.active_provider = "fake"` (determinístico). Para Ollama: setar `"ollama"` + `OLLAMA_BASE_URL` acessível pela Edge.

## Outros workflows

| Workflow | Prompt | Status |
|----------|--------|--------|
| `on_novo_resgate` | 6 | ✅ Código pronto (provider fake por padrão) |
| `enviar_notificacao` | 7 | ✅ |
| `job_retencao_dados` | 9 | ✅ Código pronto (dry-run por padrão) |
