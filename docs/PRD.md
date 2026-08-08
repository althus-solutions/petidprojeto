# PRD — Plataforma de Reencontro de Animais Perdidos

> **Documento mestre de produto** (PetID / Kainon Tech)  
> Versão 1.0 (MVP) · Documento de trabalho consolidado  
> Base: reunião de 08/06/2026 — Nathan Silva e Samuel Souza  
> Elaborado em junho/2026 · Atualizado em julho/2026 com status de implementação

Este documento consolida o PRD original (`sources/PRD_Plataforma_Animais_Perdidos.docx`) com as decisões técnicas e o progresso do repositório. Para detalhes de engenharia, consulte os documentos complementares listados na [seção 12](#12-mapa-da-documentação).

---

## 1. Visão geral do produto

A plataforma é um **site e PWA** cujo objetivo central é **reduzir ao máximo o tempo de reencontro** entre tutores e seus animais perdidos. O produto conecta três mundos que hoje não se comunicam:

1. O **tutor** que perdeu o animal  
2. A **pessoa** que encontrou o animal na rua  
3. Os **órgãos/ONGs** que resgatam animais (prefeituras, PM, bombeiros, CCZ, clínicas veterinárias)

O reencontro acontece pelo **Modelo Híbrido** (decisão 24/jul/2026):

| Mecanismo | Descrição |
|-----------|-----------|
| **Tag única (QR + NFC)** | Cadastro gera ID único → QR e link NFC apontam para `/pet/{payload}` (perfil público do animal) → aceite de termos + localização → Confirmar Resgate → tela “Tutor foi notificado” + CTA WhatsApp (telefone só após confirmação) |
| **Sem identificação** | Órgão/ONG em `/orgao` → **Encontrei um animal** + matching por IA → notifica tutor se score suficiente (`/resgate` público = legado) |

### 1.1. Problema

- Animais fogem com frequência, muitas vezes sem coleira ou identificação (ex.: durante banho em pet shop).
- Quem encontra um animal na rua não sabe quem é o dono nem como contatá-lo.
- Publicações dispersas em redes sociais ficam restritas a bolhas e não alcançam o tutor.
- Prefeituras, ONGs e veterinários recebem animais resgatados sem canal padronizado para localizar o dono — muitos acabam em abrigos sem necessidade.

### 1.2. Proposta de valor

| Público | Valor |
|---------|-------|
| **Tutor** | Identificação imediata do animal e reencontro mais rápido; sensação de ter o pet "assegurado" na plataforma |
| **Quem encontra** | Forma simples e anônima de comunicar que achou um animal |
| **Órgãos/ONGs** | Visão de perdidos/resgatados por região; devolução direta ao tutor, reduzindo sobrecarga de abrigos |
| **Ecossistema pet** | Comunidade engajada, base de dados e oportunidade de patrocínio/doações para ONGs |

---

## 2. Objetivos e métricas

### 2.1. Objetivos do MVP

- [x] Cadastro de tutor e animais com **tag única** (QR + link NFC)
- [x] Perfil do tutor com múltiplos telefones + número principal (`/tutor/perfil`)
- [x] Página pública do animal ao ler QR/NFC (perfil + Confirmar Resgate)
- [x] Ocorrência de animal perdido e registro de resgate (anônimo ou autenticado)
- [x] Matching por IA (características visuais + geolocalização) — migrations 009–010 aplicadas; deploy Edge/n8n pendente
- [x] Login e painel para órgãos/ONGs aprovados — migration 007 aplicada; definir região das orgs no admin
- [x] Notificações multicanal reais (WhatsApp, e-mail, push) — fila no banco; deploy n8n + credenciais pendente
- [x] Job de retenção (Prompt 9) — migration 008 aplicada; dry-run em staging antes de `agendamento_ativo`
- [ ] Pronto para lançamento na **feira pet de 12–14 de agosto de 2026**

### 2.2. Métricas de sucesso

| Métrica | Descrição | Meta de referência |
|---------|-----------|-------------------|
| Animais cadastrados | Total de pets na base | Crescimento mensal consistente |
| Resgates registrados | Animais resgatados via app/órgãos | Mín. 200/mês (estimativa ONG) |
| Taxa de reencontro | % de casos perdidos que resultam em match | A definir após baseline |
| Tempo médio de reencontro | Da ocorrência ao reencontro | Reduzir continuamente |
| Assinantes pagantes | Tutores em plano recorrente | Ex.: 10.000 usuários a R$ 5–10/mês |

---

## 3. Públicos / Personas

| Público | Tipo | Como interage |
|---------|------|---------------|
| **Tutor** | Direto | Cadastra animais, recebe QR Code, abre ocorrência de perda, paga assinatura |
| **Quem encontra** | Direto / indireto | Lê QR Code ou registra animal resgatado; pode ser anônimo |
| **Órgãos/ONGs** | Parceiro | Login próprio, registram resgates, recebem alertas por região |

> **Alcance indireto:** quem encontra um animal e não conhece a plataforma é alcançado via QR na coleira, divulgação (adesivos, redes) ou ao acionar prefeitura/ONG que registra o caso.

---

## 4. Funcionalidades e requisitos

Cada item do PRD original mapeia para um **RF-XX** em [`spec.md`](spec.md). Status reflete o repositório em julho/2026.

| PRD | RF | Funcionalidade | Status |
|-----|-----|----------------|--------|
| 4.1 | RF-01 | Cadastro de tutor e pets (campos configuráveis) + perfil com multi-telefones | ✅ Implementado (perfil 2026-08-04) |
| 4.2 | RF-02 | QR + link NFC **únicos** por animal (`/pet/{payload}`) | ✅ Modelo Híbrido (24/jul/2026) |
| 4.3 | RF-03 | Página pública do pet → Confirmar Resgate → notifica tutor | ✅ Modelo Híbrido |
| 4.4 | RF-04 | Ocorrência de animal perdido (incl. retroativa) | ✅ Implementado |
| 4.5 | RF-05 | Registro de animal resgatado/encontrado | ✅ Implementado (CAPTCHA Turnstile no anônimo) |
| 4.6 | RF-06 | Matching por IA (cor, porte, raça, score, raio) | ✅ Banco (009–010); deploy Edge `analyze-pet` + n8n pendente |
| 4.7 | RF-07 | Painel de órgãos/ONGs | ✅ Migration 007 aplicada; configurar região de atuação das orgs |
| 4.8 | RF-08 | Integração WhatsApp oficial | 🟡 Z-API via n8n (Prompt 7); templates Meta a validar |
| 4.9 | RF-09 | Comunidade, recompensa, arte, plano saúde, hardware | 🚫 Fora do MVP |

### 4.3. Acionamento por tag (QR/NFC) — Modelo Híbrido (oficial desde 24/jul/2026)

**Com tag:**

1. Cadastro do pet gera `qr_payload` único
2. Tutor baixa QR (imagem) e copia URL para NFC — ambos apontam para `/pet/{payload}`
3. Tutor abre **ocorrência de perda** (`/tutor/ocorrencias`) — gatilho para notificações
4. Quem encontra abre o **perfil público**, aceita termos e confirma o resgate
5. Se houver ocorrência aberta → plataforma **notifica o tutor** (+ CTA WhatsApp); senão, só registra a leitura

**Sem tag:**

1. Órgão/ONG → `/orgao` → **Encontrei um animal** → formulário (foto + dados)
2. Matching (RF-06) → notifica tutor se score ≥ limiar
3. `/resgate` público permanece só como legado/deep-link

> O Modelo B (QR só genérico, 15/jul) foi **substituído** pelo híbrido. `/qr/:payload` redireciona para `/pet/:payload`.

---

## 5. Requisitos não funcionais

| Requisito | Detalhe | Documento |
|-----------|---------|-----------|
| Privacidade e consentimento | LGPD desde o dia 1; consentimento com timestamp e contexto | [`constitution.md`](constitution.md) Art. 1 |
| QR sem fricção | Página web/PWA, sem download de app | [`plan.md`](plan.md) |
| Segurança | RLS em todas as tabelas sensíveis; rate limiting em rotas públicas | [`security.md`](security.md) |
| Escalabilidade | PostGIS + pgvector; multi-tenant por `organizacao_id` | [`database.md`](database.md) |
| Multicanal | WhatsApp, e-mail, push configuráveis por tutor | [`architecture.md`](architecture.md) |
| Custo controlado | Monitorar custo por mensagem WhatsApp | [`constitution.md`](constitution.md) Art. 5 |
| Propriedade intelectual | Registrar/patentear antes de exposição pública ampla | Risco de negócio |

---

## 6. Modelo de negócio e monetização

> Valores são hipóteses da reunião de 08/06/2026 — validar antes de implementar cobrança.

| Frente | Descrição | Hipótese |
|--------|-----------|----------|
| Assinatura do tutor | Plano recorrente com QR Code e funcionalidades | ~R$ 9,90–10/mês |
| Freemium | Gratuito avisa; pago libera dados de quem resgatou | A definir |
| Doação para ONGs | Parte da assinatura repassada a ONGs parceiras | ~30–40% (ex.: R$ 3–4 de R$ 9,90) |
| Licença para órgãos | Contrato por entidade | Valor por corporação |
| Patrocínio de QR Code | QR co-branded com marca patrocinadora | Contrato anual |
| Programa de recompensa | Tutor oferece recompensa; rede recebe alertas | Evolução pós-MVP |
| Parcerias (plano saúde pet) | Integração com planos de saúde animal | Evolução pós-MVP |

**Estratégia de adesão:** link promocional de lançamento (ex.: 50% desconto), reforçando apelo de "ajudar uma ONG".

---

## 7. Escopo do MVP

### 7.1. Dentro do escopo (v1)

- PWA + site com cadastro de tutor e animais
- Geração de QR Code e produção inicial de pingentes
- Página de acionamento ao ler o QR Code
- Ocorrência de perdido e registro de resgatado (foto + geolocalização com consentimento)
- Matching por IA por características + proximidade
- Login e painel básico para órgãos/ONGs

### 7.2. Fora do escopo (evoluções futuras — RF-09)

- Comunidade completa na plataforma
- Programa de recompensa e "caçadores de recompensa"
- Geração automática de arte de divulgação
- Integrações com planos de saúde pet
- Coleira eletrônica / hardware avançado

---

## 8. Cronograma e marcos

| Marco | Descrição | Prazo |
|-------|-----------|-------|
| Organização do material | Etapas, processos, investimento | Semana da reunião (jun/2026) |
| Piloto / protótipo visual | Versão visual para investidores | Curto prazo |
| Produção do MVP | PWA + plataforma + QR + órgãos | ~2 meses |
| **Lançamento** | Feira pet | **12–14 de agosto de 2026** |

### Fases técnicas (ver [`plan.md`](plan.md))

| Fase | Conteúdo | Status |
|------|----------|--------|
| 1 — Fundação | Banco, auth, cadastro tutor/pets, QR | ✅ Concluída |
| 2 — Ocorrências e resgates | QR público, perdido, resgate anônimo | ✅ Concluída |
| 3 — Matching IA | n8n + AI Provider + pgvector | ✅ Código Prompt 6 (fake provider; Ollama opcional) |
| 4 — Órgãos e polimento | Painel ONG, notificações, testes | 🟡 Código + banco prontos; falta deploy n8n/Edge, região orgs, smoke tests feira |

---

## 9. Investimento e próximos passos

### Itens de custo identificados

- Ferramentas de desenvolvimento e testes
- Produção de QR Codes/pingentes para o evento
- Equipe de desenvolvimento
- Mensageria WhatsApp conforme volume

### Próximos passos de produto

1. ~~RF-04 e RF-05 (Prompt 5)~~ — concluído
2. ~~Migrations 006–010 no Supabase~~ — aplicadas (jul/2026)
3. **Deploy operacional:** Edge `analyze-pet` + `send-push`; n8n (notificação + matching + retenção); webhooks; credenciais Z-API/Resend/VAPID
4. **Config produção:** região das orgs no admin; `ai_provider` fake → ollama; Turnstile produção; dry-run retenção
5. **Smoke tests** ponta a ponta + testes automatizados (Art. 7.1 constituição)
6. Consolidar precificação e parcerias (ONGs, prefeituras, marcas pet)
7. Produção de pingentes QR + deploy Vercel para feira **12–14 ago/2026**

---

## 10. Riscos e pontos em aberto

| Ponto | Observação | Status |
|-------|------------|--------|
| Alcance ao público indireto | Depende de divulgação e parcerias | Monitorar |
| Custo de mensageria WhatsApp | Validar utilidade pública / janela 24h | Pendente |
| Canal de acionamento do QR | Página própria vs. WhatsApp direto | ✅ **Decidido: página própria** (jul/2026) |
| Modelo do QR | Único / genérico / híbrido | ✅ **Híbrido** — tag única `/pet/{payload}` + `/resgate` sem tag (24/jul/2026) |
| Proteção da ideia | Registrar/patentear rapidamente | Negócio |
| Modelo de preço | Considerar custo do pingente + plataforma | Pendente |
| Retenção de dados | Prazo para animais sem dono (ref.: 30 dias) | Configurável em `dias_retencao_sem_dono` |
| Modelo de visão (Ollama) | Validar `qwen2.5vl` ou equivalente | Pendente |

---

## 11. Decisões técnicas registradas

| Data | Decisão | Referência |
|------|---------|------------|
| 2026-07-06 | PWA responsiva em vez de app nativo no MVP | [`memory.md`](memory.md) |
| 2026-07-06 | Supabase definitivo (Postgres + Auth + Storage + Edge Functions) | Projeto `sqwywmevqqlxadknwppu` |
| 2026-07-06 | Schema inicial via `supabase/schema.sql` + migrations | [`database.md`](database.md) |
| 2026-07-07 | Canal QR = **página pública** | RF-03 (evoluiu para Modelo B em 15/jul) |
| 2026-07-07 | RF-03 legado (leitura + consentimento + notificação direta) | Migration `004_qr_read_public.sql` — fluxo Modelo A aposentado na UI |
| 2026-07-08 | Migrations **006–010** aplicadas no Supabase remoto | Projeto `sqwywmevqqlxadknwppu`; inclui painel órgãos (007) e revisão perf (010) |
| 2026-07-15 | Modelo B — QR genérico | Superado em 24/jul pelo Modelo Híbrido |
| 2026-07-24 | **Modelo Híbrido** — tag única (QR+NFC → `/pet/{payload}`) + `/resgate` sem tag | Página pública do animal; Confirmar Resgate + consentimento; nome completo do tutor sem contato |

---

## 12. Mapa da documentação

```
docs/
├── PRD.md              ← este documento (visão de produto + status)
├── spec.md             ← requisitos funcionais (RF-01 a RF-09)
├── plan.md             ← stack, fases, arquitetura de implementação
├── architecture.md     ← componentes e contratos entre serviços
├── constitution.md     ← princípios não-negociáveis (LGPD, RLS, escala)
├── security.md         ← LGPD operacional, auth, endpoints públicos
├── database.md         ← schema, RLS, índices, retenção
├── memory.md           ← log vivo de decisões e pendências
├── PROMPTS.md          ← prompts ordenados para o Cursor (Prompt 0–9)
└── sources/
    └── PRD_Plataforma_Animais_Perdidos.docx   ← PRD original da reunião
```

**Código e infraestrutura:**

```
supabase/
├── schema.sql          ← schema completo de referência
└── migrations/         ← migrations incrementais (002–010)
src/                    ← frontend React + Vite + PWA
```

---

## 13. Nota sobre este documento

Este PRD foi elaborado a partir da transcrição da reunião de 08/06/2026 e consolidado com o progresso real do repositório PetID. Valores, prazos e funcionalidades de negócio devem ser revisados pelos envolvidos antes de decisões comerciais. Para implementação, **`constitution.md` vence** em caso de conflito com pedidos pontuais.

*Última atualização: 24/jul/2026 — Modelo Híbrido (tag única + resgate sem tag) formalizado; migration `013` para nome do tutor na RPC pública.*
