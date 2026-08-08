# Architecture — Plataforma de Reencontro de Animais Perdidos

> Complementa `plan.md` com detalhes de componentes e contratos entre serviços. Referência rápida para o Cursor durante implementação.

## 1. Componentes principais

### 1.1. Frontend (Vercel)
- App web/PWA responsiva. Rotas públicas:
  - **`/pet/:payload`** — perfil público do animal (QR + NFC; tag única)
  - **`/resgate`** — resgate sem identificação + matching
  - **`/qr/:payload`** — legado → redireciona para `/pet/:payload`
- **Modelo Híbrido:** tag identifica o pet; sem tag usa formulário + IA.
- Rotas autenticadas: painel do tutor, painel de órgão/ONG, admin.

### 1.2. Supabase (núcleo de dados)
- Postgres + PostGIS + pgvector.
- Auth com 3 tipos de papel: `tutor`, `orgao`, `admin` (ver `database.md` para RLS).
- Storage para fotos de pets e de resgates, com política de acesso vinculada ao dono do registro.
- Edge Functions para lógica que não pode rodar só no client (ex.: geração assinada de QR, signed URL de foto para IA, validação de consentimento).

### 1.3. n8n (orquestração)
Workflows:
- `on_novo_resgate` / `on_nova_ocorrencia` → claim do job → chama **AI Inference Service** → RPCs de persistência + matching (não calcula score no n8n).
- `enviar_notificacao` → consome fila `notificacoes` (WhatsApp / e-mail / push) — já existente (Prompt 7).
- `job_retencao_dados` (agendado) → aplica prazo de retenção (Art. 6), anonimizando registros expirados.

> **Não** usar n8n como implementação do modelo de IA (prompts/parse espalhados). n8n só orquestra.

### 1.4. AI Inference Service + AI Provider (Adapter) — RF-06
- Serviço HTTP interno (Edge Function ou microserviço) que conversa com modelos via **Adapter**.
- MVP: `OllamaProvider` (+ `FakeAiProvider` para testes Art. 7.1).
- Futuro: `OpenAiProvider`, `GeminiProvider`, `AnthropicProvider`, etc., **sem alterar** RPCs de matching nem limiares de negócio.
- Detalhe: [§4. AI Matching (RF-06)](#4-ai-matching-rf-06--arquitetura-definida).

### 1.5. Matching engine (query no Postgres, não serviço separado no MVP)
- RPC `security definer`: filtro geográfico (`ST_DWithin` / PostGIS) + similaridade vetorial (pgvector) + score versionado.
- Threshold de notificação automática: `configuracoes_sistema.score_minimo_notificacao`.
- Acima do limiar → `enfileirar_notificacao_tutor` (`tipo_evento = match_sugerido`); abaixo → só registro em `matches` para busca manual (Art. 4.2–4.3).

## 2. Contratos de dados entre componentes (resumo)

- **Frontend → Supabase**: SDK oficial, sempre RLS (nenhuma query admin exposta ao client).
- **Supabase → n8n**: Database Webhook em `INSERT` de resgate/ocorrência (ou consumer de outbox `matching_jobs`).
- **n8n → AI Inference Service**: HTTP autenticado; payload = referência da foto (bucket/path) ou URL assinada de TTL curto.
- **AI Inference Service → Provider**: Adapter específico (Ollama/OpenAI/…); saída sempre no contrato canônico `PetVisualAnalysis`.
- **n8n / Inference → Postgres**: RPCs `service_role` para gravar análise + executar matching + enfileirar notificação.
- **Fila → n8n `enviar_notificacao`**: reutiliza Prompt 7 (sem segundo canal WhatsApp no workflow de matching).

## 3. Escalabilidade — o que muda do MVP para produção em escala

| Aspecto | MVP (feira pet, 1 região) | Escala (nacional) |
|---|---|---|
| Matching | RPC sob demanda (baixo volume) | Pré-cálculo incremental / cache por região |
| Inferência | Um provider ativo (Ollama) + concurrency baixa no n8n | Pool de workers, fila com backpressure |
| Espaço vetorial | Um `embedding_space_id` (`petid-embed-v1`) | Multi-space + reindex / cutover |
| WhatsApp | Um número/conta | Múltiplos números por região se volume exigir |
| Multi-tenant órgãos | Poucas entidades, aprovação manual | Onboarding self-service com verificação automatizada |
| Observabilidade | Logs + custo por notificação | Custo/latência por inferência e por match |

O ponto central: **trocar modelo não reescreve regras de negócio** (raio, score, limiar, confirmação humana). Mudança de família de embedding exige novo `embedding_space_id` e reprocessamento — não mudança da fórmula de score.

---

## 4. AI Matching (RF-06) — arquitetura definida

> Decisão de desenho (jul/2026). **Implementação:** migration `009_matching_ia_rf06.sql`, Edge Function `analyze-pet`, workflow `on_novo_resgate`, UI `/tutor/matches`.

### 4.1. Princípio: três camadas separadas

| Camada | Responsabilidade | Não faz |
|--------|------------------|---------|
| **Inferência (AI Provider)** | Olhar a foto → `PetVisualAnalysis` | Score, raio, notificar |
| **Persistência tipada** | Gravar análise + embedding + metadados de modelo | Chamar Ollama/OpenAI |
| **Matching / negócio** | PostGIS + pgvector + score + limiar + enqueue | Conhecer o nome do provider |

Só a primeira camada muda ao trocar Ollama por OpenAI/Gemini/Claude.

### 4.2. Fluxo esperado (assíncrono — Art. 3.2)

Nenhuma etapa abaixo pode bloquear o upload do usuário (RF-05 já só faz `INSERT`).

```
1. INSERT registros_resgate (ou ocorrencias_perdido)
2. Processamento assíncrono (webhook/outbox → n8n → claim job)
3. Extração de características (via AI Provider)
4. Geração do embedding (mesmo Provider; pode ser 2º modelo interno ao Adapter)
5. Persistência (RPC: atributos + embedding + space_id + modelo)
6. Busca de candidatos (PostGIS + pgvector) — mesmo espaço vetorial
7. Cálculo do score (RPC versionada; lê configuracoes_sistema)
8. Upsert em matches (UNIQUE ocorrencia_id + registro_resgate_id)
9. Se score ≥ limiar e ainda não notificado → enfileirar_notificacao_tutor
   → workflow enviar_notificacao (já existente)
```

Simetria: embedding também no lado do **pet** (`animais`), reusado pela ocorrência — fecha o gap da auditoria (vetor só no resgate hoje).

### 4.3. AI Provider (Adapter) — recomendado: sim

```
AiProvider
  analyzePetImage(request) → PetVisualAnalysis
```

- `OllamaProvider` (MVP), `FakeAiProvider` (CI), depois cloud providers.
- Um Adapter pode compor **VisionClient + EmbedClient** e ainda devolver **um** contrato.
- Config ativa em `configuracoes_sistema.ai_provider` (`active_provider`, URLs, modelos, `embedding_space_id`, timeouts) — **nunca** hardcoded no matching.

### 4.4. Contrato de saída canônico — `PetVisualAnalysis`

Único formato que matching e banco entendem. Todo Adapter deve convergir para ele.

```text
PetVisualAnalysis
  schema_version: "1.0"

  embedding:
    vector: number[]
    dimensions: number
    space: "cosine" | "l2" | "ip"
    model_id: string
    normalized: boolean

  attributes:
    especie:       { value: "cao"|"gato"|"outro"|null, confidence: 0..1 }
    raca:          { value: string|null, confidence: 0..1 }
    porte:         { value: "pequeno"|"medio"|"grande"|null, confidence: 0..1 }
    cores:         { values: string[], confidence: 0..1 }
    idade_estimada:{ value: string|null, confidence: 0..1 }
    sexo:          { value: "macho"|"femea"|"indefinido"|null, confidence: 0..1 }

  confidence:
    overall: 0..1
    usable_for_auto_notify: boolean   # hint; limiar real continua no negócio

  model:
    provider: "ollama"|"openai"|"gemini"|"anthropic"|"fake"|…
    vision_model: string
    embedding_model: string
    prompt_version: string
    latency_ms?: number
    estimated_cost_brl?: number       # Art. 3.3

  warnings?: string[]
```

Regras:
- Null + confidence por campo — modelo sem certeza não inventa.
- Matching **recusa** comparar embeddings de `embedding_space_id` / dimensões diferentes.
- Colunas legadas (`cor_estimada`, `porte_estimado`, `raca_estimada`) são projeções do contrato, não a fonte da verdade (fonte: JSONB tipado da análise + vetor + metadados).

### 4.5. O que o Provider NÃO decide

- Raio PostGIS, fórmula de score, `score_minimo_notificacao`
- Se notifica ou não; confirmação do tutor; retenção

`confidence.overall` **informa** o score de negócio; **não o substitui** (Art. 4.1).

### 4.6. Troca de modelo sem quebrar negócio

- Config: `ai.embedding_space_id` (ex. `petid-embed-v1`).
- Novo modelo de embedding incompatível → novo space (`v2`) + reprocessamento + cutover.
- Troca só de Vision LLM (mesma família de embed) → config/`model_id`; RPCs de matching intactas.
- `schema_version` permite evoluir o DTO sem reescrever regras.

### 4.7. Reuso explícito (evitar duplicação)

| Já existe | Reusar em RF-06 |
|-----------|-----------------|
| Insert resgate/ocorrência (005) | Gatilho; sem IA no request |
| `enfileirar_notificacao_tutor` + `enviar_notificacao` | Passo 9 |
| `raio_matching_km` / `score_minimo_notificacao` | Matching |
| `matches` + RLS tutor update | Persistência + UI confirmar/descartar |
| Padrão retenção (claim/auditoria) | Espelhar em jobs de IA |
| Edge Function `send-push` | Padrão hospedagem do Inference Service |

### 4.8. Segurança (security.md §6)

- Foto só via URL assinada / rede interna.
- Provider cloud: secrets em env/vault.
- Validar schema da resposta do modelo antes de persistir (enum inválido → null + warning).

---

## 5. Mapa rápido de responsabilidade no RF-06

```
[PWA] INSERT resgate/ocorrência
   → [Webhook/outbox] → [n8n orquestrador]
        → [AI Inference + AiProvider] → PetVisualAnalysis
        → [RPC persistir análise]
        → [RPC matching PostGIS+pgvector]
        → [matches] + opcional [enfileirar_notificacao_tutor]
             → [n8n enviar_notificacao]  (Prompt 7)
```
