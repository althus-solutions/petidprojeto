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
foto_url text  -- path no bucket pets: {tutor_id}/perfil/foto.{ext} (migration 017)
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
cor text                    -- espelho legível de cores[]
cores text[]                -- multi-select estruturado (migration 018)
sexo text check (macho|femea|nao_sei)
data_nascimento date null
idade_estimada_valor numeric null
idade_estimada_unidade text check (meses|anos) null
castrado text check (sim|nao|nao_sei) null
padrao_pelagem text check (curto|medio|longo|enrolado|sem_pelo) null
peso numeric
caracteristicas text
microchip text null         -- único (case-insensitive) quando preenchido; migration 033
foto_url text               -- capa = animal_fotos.ordem=1
consentimento_fotos_em timestamptz null
consentimento_fotos_contexto jsonb null
qr_payload text unique null -- gerado só após “Gerar QR/NFC” (035); URL = /pet/{qr_payload}
                            -- IMUTÁVEL após definido (trigger 021/035)
tag_status text             -- nao_solicitada | solicitada | registrada (035)
created_at timestamptz default now()
```

### `animal_fotos` (migration 018)
```
id uuid pk
animal_id uuid references animais(id) on delete cascade
storage_path text           -- bucket pets: {tutor_id}/{animal_id}/{ordem}.ext
slot text check (corpo|lateral|rosto|marca|outro)
ordem smallint 1..4 unique por animal  -- UI atual usa 1 foto (capa); trigger ainda permite até 4
embedding vector(512)       -- por foto
analise_visual jsonb
ia_status text
created_at timestamptz
```
RLS: tutor só CRUD fotos dos próprios animais. Matching: Edge processa as fotos; embedding canônico em `animais.embedding`.

**Leitura pública NFC/QR (bucket `pets`):** policy `pets_public_qr_select` chama `storage_object_is_pet_foto` (SECURITY DEFINER, `row_security=off` — migrations `037`/`041`). Permite `createSignedUrl` para `anon` nas fotos de pets com `qr_payload` (pasta `{tutor_id}/{animal_id}/*`). Sem isso, a página `/pet` carrega metadados via RPC mas a imagem não aparece.

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
horario_perda time null
horario_desconhecido boolean default true
localizacao geography(Point, 4326)  -- PostGIS; lat/lng do centroide cidade/bairro
estado text                         -- UF sigla (025)
cidade text                         -- lista IBGE por UF (023)
bairro text                         -- lista OSM/Photon por cidade; sem rua/número
endereco_aproximado text            -- espelho "Bairro, Cidade"
fonte_localizacao text check (autocomplete|manual|gps)
com_identificacao text check (sim|nao|nao_sei)  -- coleira/tag/NFC na perda
circunstancias text null
foto_dia_path text null             -- foto opcional “como estava no dia”
raio_busca_km numeric default 2 check (1|2|5|10)  -- interno (matching); UI não expõe na abertura
contato_alternativo text null
consentimento_ocorrencia_em timestamptz
consentimento_ocorrencia_contexto jsonb
status text check (in ('aberta','reencontrado','expirada')) default 'aberta'
retroativa boolean default false
created_at timestamptz default now()
```
RLS: tutor CRUD próprio; órgão SELECT se `organizacao_cobre_ponto(localizacao)`; matching via RPCs security definer / service_role (não client anon). Migration `022`.

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
microchip text null  -- migration 033; resgate autenticado/órgão
embedding vector(512)  -- gerado pelo Ollama, dimensão ajustar ao modelo escolhido
status text check (in ('disponivel','em_analise','reencontrado','anonimizado')) default 'disponivel'
created_at timestamptz default now()
```

### `animais_organizacao` (inventário institucional — migration 033)
```
id uuid pk
organizacao_id uuid references organizacoes(id)
registrado_por_user_id uuid references auth.users null
registro_resgate_id uuid references registros_resgate(id) null  -- se veio de "Encontrei"
nome text null
especie / raca / porte / cor / sexo / caracteristicas text null
microchip text null  -- único (case-insensitive) quando preenchido
foto_url text null   -- path no bucket resgates
status text check (sob_cuidados|disponivel_adocao|devolvido|transferido|obito)
created_at / updated_at timestamptz
```
RLS: membro da org CRUD na própria; **prefeitura aprovada** (e admin plataforma) SELECT em todas as orgs aprovadas. RPCs: `listar_animais_organizacao`, `criar_animal_organizacao`.

### `cadastros_evento` (feira / leads — migration 040)
```
id uuid pk
tipo_publico text check (tutor|parceiro)
nome, email, telefone, cidade, estado (UF)
-- tutor: qtd_pets, especies_pets[], ja_conhece_mypetid, interesses_tutor[], como_soube
-- parceiro: organizacao_nome, organizacao_tipo (ong|prefeitura|clinica_veterinaria|petshop|outro),
--           cnpj, cargo, regiao_atuacao, volume_animais_mes, interesses_parceiro[], ja_usa_sistema
aceita_contato boolean
consentimento_lgpd_em + contexto jsonb
origem, user_agent, created_at
```
RLS: insert anon/authenticated; select só `is_platform_admin()`.
RPC: `registrar_cadastro_evento(p_dados jsonb)`.

### `listagens_adocao` (parceria TeleCão — migration 039)
```
id uuid pk
tutor_id uuid references tutores(id)          -- responsável / publicador
animal_id uuid references animais(id) null    -- pet já cadastrado (opcional)
nome, especie (cao|gato|outro), raca, sexo, idade_faixa, porte, peso_kg, cores[]
campos saúde / temperamento / histórico / requisitos (ver migration 039)
responsavel_nome, responsavel_contato, responsavel_tipo
status text check (disponivel|em_processo|adotado)
taxa_adocao_aplica boolean, taxa_adocao_valor numeric null
termo_adocao_aceito_em / consentimento_lgpd_em (+ contexto jsonb)
created_at / updated_at
```
RLS: tutores leem `disponivel|em_processo` (ou próprias); CRUD só do dono.
RPC: `manifestar_interesse_adocao(listagem_id, mensagem)` → `interesses_adocao` + notificação.

### `adocao_midia` (039)
```
id uuid pk
listagem_id uuid references listagens_adocao(id)
storage_path text   -- bucket pets: {tutor_id}/adocao/{listagem_id}/...
tipo text check (foto|video)
ordem int
```

### `interesses_adocao` (039)
```
id uuid pk
listagem_id uuid
tutor_interessado_id uuid
mensagem text null
unique (listagem_id, tutor_interessado_id)
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

## 4.1 Chat na plataforma (migration 020)

Tabelas `conversas` (animal + tutor + `finder_fingerprint`) e `mensagens` (autor `tutor`|`finder`).

- Tutor: RLS nas próprias conversas/mensagens; badge via `contar_nao_lidas_tutor`
- Finder anônimo: sem SELECT direto — RPCs security definer com fingerprint (`abrir_conversa_pet`, `listar_conversas_finder`, `listar_mensagens_finder`, `enviar_mensagem_finder`, `contar_nao_lidas_finder`)
- UI: FAB canto inferior em `/tutor` e `/pet/:payload`

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
