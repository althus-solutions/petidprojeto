# Database — Plataforma de Reencontro de Animais Perdidos

> Schema de referência para Supabase/Postgres. Nomes em português para consistência com o domínio do negócio. Ajustar tipos exatos durante implementação, mas manter a estrutura de relacionamento e as regras de RLS descritas aqui.

## 1. Extensões necessárias

```sql
create extension if not exists postgis;
create extension if not exists vector; -- pgvector
create extension if not exists pg_cron; -- para job de retenção agendado
```

## 2. Tabelas principais

### `tutores`
```
id uuid pk
user_id uuid references auth.users (não nulo)
nome text
telefone text  -- espelho do contato principal (notificações / WhatsApp)
email text
canal_notificacao_preferido text check (in ('whatsapp','email','push'))
created_at timestamptz default now()
```

### `tutor_contatos` (migration 015)
```
id uuid pk
tutor_id uuid references tutores(id) on delete cascade
telefone text not null
rotulo text  -- ex.: Celular, Trabalho
principal boolean  -- exatamente um por tutor; sync → tutores.telefone
created_at timestamptz default now()
```
RLS: tutor só CRUD os próprios contatos. RPC `salvar_perfil_tutor(nome, canal, contatos jsonb)`.

### `animais`
```
id uuid pk
tutor_id uuid references tutores(id)
nome text
especie text
raca text
porte text
cor text
peso numeric
caracteristicas text
foto_url text
qr_payload text unique  -- ID único da tag; URL pública = /pet/{qr_payload} (QR + NFC)
created_at timestamptz default now()
```

### `organizacoes` (órgãos públicos / ONGs — multi-tenant desde o dia 1)
```
id uuid pk
nome text
tipo text check (in ('prefeitura','pm','bombeiros','ccz','ong','veterinaria'))
status_aprovacao text check (in ('pendente','aprovado','rejeitado')) default 'pendente'
regiao_atuacao geography(Polygon, 4326)  -- ou um raio/centro simples no MVP
created_at timestamptz default now()
```

### `usuarios_organizacao`
```
id uuid pk
organizacao_id uuid references organizacoes(id)
user_id uuid references auth.users
papel text check (in ('admin_org','operador'))
```

### `ocorrencias_perdido`
```
id uuid pk
animal_id uuid references animais(id)
tutor_id uuid references tutores(id)
data_perda date
localizacao geography(Point, 4326)
endereco_aproximado text
status text check (in ('aberta','reencontrado','expirada')) default 'aberta'
retroativa boolean default false
created_at timestamptz default now()
```

### `registros_resgate`
```
id uuid pk
registrado_por_user_id uuid references auth.users null  -- null = anônimo
organizacao_id uuid references organizacoes(id) null    -- preenchido se órgão registrou
foto_url text not null
localizacao geography(Point, 4326) null  -- null se consentimento negado
consentimento_localizacao boolean default false
descricao text
porte_estimado text
cor_estimada text
raca_estimada text
embedding vector(512)  -- gerado pelo Ollama, dimensão ajustar ao modelo escolhido
status text check (in ('disponivel','em_analise','reencontrado','anonimizado')) default 'disponivel'
created_at timestamptz default now()
```

### `matches`
```
id uuid pk
ocorrencia_id uuid references ocorrencias_perdido(id)
registro_resgate_id uuid references registros_resgate(id)
score numeric  -- 0 a 100
status text check (in ('sugerido','confirmado_tutor','descartado')) default 'sugerido'
created_at timestamptz default now()
```

### `notificacoes`
```
id uuid pk
destinatario_user_id uuid references auth.users
canal text check (in ('whatsapp','email','push'))
tipo_evento text  -- 'qr_lido', 'match_sugerido', 'resgate_registrado', etc.
custo_estimado numeric null  -- para WhatsApp, monitorar custo por mensagem (Art. 5)
enviado_em timestamptz default now()
```

### `configuracoes_sistema`
```
chave text pk  -- ex: 'raio_matching_km', 'score_minimo_notificacao', 'dias_retencao_sem_dono'
valor jsonb
```

## 3. Índices recomendados

```sql
create index on ocorrencias_perdido using gist (localizacao);
create index on registros_resgate using gist (localizacao);
create index on registros_resgate using ivfflat (embedding vector_cosine_ops);
create index on ocorrencias_perdido (status);
create index on registros_resgate (status);
```

## 4. Row Level Security (RLS) — regras obrigatórias (Art. 2.2 da constituição)

Todas as tabelas com dados pessoais/sensíveis têm RLS **ativado por padrão**. Exemplos de política:

```sql
-- tutores só veem/editam o próprio registro
alter table tutores enable row level security;
create policy tutor_self on tutores
  for all using (auth.uid() = user_id);

-- ocorrências: tutor vê as suas; organizações aprovadas veem as da sua região (via função)
alter table ocorrencias_perdido enable row level security;
create policy tutor_ve_suas_ocorrencias on ocorrencias_perdido
  for select using (
    tutor_id in (select id from tutores where user_id = auth.uid())
  );

-- registros de resgate anônimos: leitura pública limitada a campos não-sensíveis
-- (recomenda-se view pública separada, sem localizacao exata quando não houver
--  necessidade, expondo apenas região aproximada)
```

## 5. Job de retenção (Art. 6.1)

Implementado em `supabase/migrations/008_job_retencao_dados.sql`.

- Prazo: `configuracoes_sistema.dias_retencao_sem_dono` (nunca constante no código)
- Flag: `configuracoes_sistema.job_retencao.agendamento_ativo` (padrão `false`)
- Critério: `status in ('disponivel','em_analise')`, sem match `confirmado_tutor`, `created_at` além do prazo
- Efeito: zera `foto_url`, `localizacao`, embedding e campos estimados; `status = 'anonimizado'`
- Dry-run/aplicar: RPCs admin `simular_retencao_admin` / `aplicar_retencao_admin` (painel `/admin/retencao`)
- Alternativa n8n: `n8n/workflows/job_retencao_dados.json` → `executar_retencao_n8n`

```sql
-- núcleo (resumo); execução real via executar_retencao_registros_sem_dono
update registros_resgate
set foto_url = null, localizacao = null, status = 'anonimizado'
where status in ('disponivel', 'em_analise')
  and created_at < now() - make_interval(days => dias_cfg)
  and not exists (
    select 1 from matches m
    where m.registro_resgate_id = registros_resgate.id
      and m.status = 'confirmado_tutor'
  );
```

> **Staging:** rode dry-run e confira `retencao_execucoes` antes de ligar `agendamento_ativo`.

## 5.1 Matching por IA (RF-06)

Implementado em `supabase/migrations/009_matching_ia_rf06.sql` (+ revisão `010_review_perf_security.sql`).

- Outbox: `matching_jobs` (claim `FOR UPDATE SKIP LOCKED`)
- Embedding simétrico: `animais.embedding` + `registros_resgate.embedding` + `analise_visual` (PetVisualAnalysis)
- Config: `ai_provider` (`active_provider`, `embedding_space_id`, `score_versao`, `require_geo_for_auto_notify`)
- RPCs: `claim_matching_job`, `concluir_job_matching_com_analise`, `executar_matching_para_resgate`, `listar_matches_tutor`, `atualizar_status_match_tutor`
- Inferência: Edge Function `analyze-pet` (Adapter fake/ollama)
- Notificação: reusa `enfileirar_notificacao_tutor` + workflow Prompt 7
- Índices HNSW em `animais.embedding` e `registros_resgate.embedding` (migration 010)
- `reclaim_stale_matching_jobs` + `executar_match_par` com limite `max_candidatos_por_execucao`

## 6. Observação sobre multi-tenancy

Mesmo com poucas organizações no MVP, toda query de painel de órgão/ONG deve filtrar por `organizacao_id` desde o primeiro dia — isso evita uma migração dolorosa quando o número de entidades parceiras crescer (Art. 3.1).
