# Plan — Plataforma de Reencontro de Animais Perdidos

> Fonte: `spec.md` + `constitution.md`. Define **como** construir, respeitando os princípios de escala gradual e custo controlado. Ajuste livremente conforme validação de custo/prazo, mas justifique desvios em `memory.md`.

## 1. Stack proposta

| Camada | Escolha | Justificativa |
|---|---|---|
| Banco de dados | **Supabase (Postgres)** com extensão **PostGIS** | Já é o padrão da Kainon; PostGIS resolve busca por raio geográfico nativamente, evitando cálculo em memória (Art. 3 da constituição) |
| Auth | Supabase Auth (multi-perfil: tutor, órgão, admin) + acesso anônimo controlado para RF-05 | Evita reescrever autenticação; RLS nativo do Supabase cobre Art. 2 |
| Storage de fotos | Supabase Storage | Já integrado ao auth/RLS do banco |
| Frontend web | React + Vite + Tailwind, deploy na **Vercel** | Padrão já usado pela Kainon em outros projetos |
| App mobile (MVP) | **PWA responsiva** em vez de app nativo no MVP | Prazo de ~2 meses até a feira pet não comporta app nativo com qualidade; QR Code + leitura via navegador já elimina a exigência de "baixar app" do PRD (RF-02). App nativo fica como evolução pós-MVP |
| Orquestração de workflows | **n8n** para: disparo de notificações multicanal, pipeline de matching assíncrono, integração WhatsApp | Consistente com o padrão de automação já usado em outros clientes da Kainon |
| IA de matching (visão) | **Ollama self-hosted** — modelo de visão (ex. `qwen2.5vl` ou equivalente) para extrair características (cor, porte, raça provável) da foto | Evita custo de API por chamada em alto volume; alinhado à preferência de infra self-hosted já validada no projeto de segmentação semântica de vídeo |
| Similaridade/matching | `pgvector` no Supabase, armazenando embedding da foto + metadados (região, data) | Permite busca por similaridade + filtro geográfico na mesma query |
| WhatsApp Business | Integração oficial via Z-API/ZPro (já em uso em outros projetos) orquestrada por n8n | Reaproveita conhecimento e infraestrutura já validados (anti-spam, templates Meta) |
| E-mail | Provedor transacional (ex. Resend) | Baixo custo, simples de integrar via n8n |
| Push notification | Web Push (via PWA) | Evita dependência de app nativo no MVP |
| Geração de QR + NFC | Biblioteca `qrcode` + URL pública `/pet/{qr_payload}` (mesmo link no NFC) | Tag única por animal; QR e NFC compartilham destino |

## 2. Arquitetura em alto nível

```
[Tutor / Web / PWA] ---- [Frontend Vercel] ---- [Supabase: Auth + Postgres/PostGIS + Storage]
                                                        |
                                                        |--> [Fila de eventos: novo resgate / nova ocorrência]
                                                        v
                                        [n8n: orquestração]
                                          |         |          |
                                   [Ollama: visão]  [WhatsApp]  [E-mail / Push]
                                   (extrai features,
                                    gera embedding)
                                          |
                                          v
                                 [pgvector: busca por similaridade
                                  + PostGIS: filtro por raio]
                                          |
                                          v
                                [Score de match >= limiar?]
                                    /              \
                              Sim: notifica tutor   Não: fica disponível
                              (WhatsApp/e-mail/push) para busca manual
```

## 3. Fases de implementação (mapeiam para `/tasks` do Spec Kit)

**Fase 1 — Fundação (semanas 1–2)**
- Modelagem do banco (`database.md`), RLS básico, auth de tutor e admin.
- Cadastro de tutor + pets, geração de QR Code.

**Fase 2 — Ocorrências e resgates (semanas 3–4)**
- Página pública de resgate aberta pelo QR genérico (sem app) — formulário + localização opcional.
- Fluxo de ocorrência de perdido; matching (Fase 3) notifica o tutor após cruzamento.

**Fase 3 — Matching por IA (semanas 5–6)**
- Desenho: AI Inference Service + **AI Provider (Adapter)**; contrato canônico `PetVisualAnalysis` (ver `architecture.md` §4).
- Pipeline assíncrono: INSERT → n8n (orquestração fina) → Provider → RPC persistir → RPC matching (PostGIS + pgvector) → `matches` → fila `enfileirar_notificacao_tutor`.
- MVP provider: Ollama (+ Fake para testes); troca futura de modelo sem alterar regras de score/raio.
- Notificação automática acima do limiar configurável (reusa Prompt 7).

**Fase 4 — Órgãos/ONGs e polimento (semanas 7–8)**
- Login e painel de entidades parceiras (multi-tenant desde o schema, Art. 3.1).
- Indicadores regionais básicos.
- Integração WhatsApp oficial (RF-08) se custo/enquadramento validado a tempo.
- Testes dos fluxos críticos (Art. 7), ajustes de performance, preparação para a feira pet.

## 4. Configuração, não hardcode

Os seguintes parâmetros vivem em tabela de configuração (não em código), conforme Art. 3.3 e 6.1:
- Raio de busca do matching (padrão inicial: 1–2 km).
- Limiar de score para notificação automática (padrão inicial: 75%).
- Prazo de retenção de dados sem dono identificado (padrão inicial: 30 dias).
- Canal de notificação preferencial por usuário/entidade.

## 5. Decisões em aberto que bloqueiam detalhamento total

Ver seção 6 de `docs/spec.md`. Modelo Híbrido: **`/pet/{payload}`** (tag) + **`/resgate`** (sem tag) — decidido 24/jul/2026.
