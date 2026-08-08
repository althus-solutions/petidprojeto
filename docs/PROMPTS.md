# Prompts — Plataforma de Reencontro de Animais Perdidos

> Prompts prontos pra colar no Cursor, em ordem. Cada um assume que `docs/PRD.md`, `docs/constitution.md`, `docs/spec.md`, `docs/plan.md`, `docs/architecture.md`, `docs/database.md`, `docs/security.md`, `docs/memory.md` e `.cursorrules` já existem no projeto.

---

## Prompt 0 — Setup do projeto (PWA única para site + app)

```
Crie a estrutura inicial de um projeto React + Vite + Tailwind, configurado como PWA
(Progressive Web App) responsiva, seguindo o que está descrito em plan.md e
architecture.md. Este é o único frontend do projeto — serve tanto como site
(acesso via navegador, sem exigir instalação) quanto como app (instalável na tela
inicial do celular via manifest.json e service worker).

Requisitos:
- Configurar manifest.json com nome, ícone e tema do app (usar placeholder por enquanto)
- Configurar service worker básico (cache de assets estáticos, sem cache agressivo
  de dados dinâmicos — dados de matching/localização nunca podem ficar desatualizados)
- Estrutura de rotas: rotas públicas (leitura de QR, registro de resgate anônimo)
  separadas de rotas autenticadas (painel do tutor, painel de órgão/ONG, admin)
- Cliente Supabase configurado via variáveis de ambiente (nunca hardcoded)
- Siga .cursorrules para convenções de código
```

---

## Prompt 1 — Schema do banco (Supabase)

```
Com base em database.md, gere o script SQL completo para criar no Supabase:
- Extensões: postgis, vector, pg_cron
- Todas as tabelas descritas (tutores, animais, organizacoes,
  usuarios_organizacao, ocorrencias_perdido, registros_resgate, matches,
  notificacoes, configuracoes_sistema)
- Índices geoespaciais (gist) e de similaridade (ivfflat)
- Todas as policies de RLS descritas na seção 4 de database.md
- O job de retenção agendado (seção 5), usando o parâmetro de
  configuracoes_sistema.dias_retencao_sem_dono

Gere como um único arquivo .sql pronto para colar no SQL Editor do Supabase,
comentado por seção.
```

---

## Prompt 2 — Autenticação e perfis

```
Implemente o fluxo de autenticação usando Supabase Auth, com os 3 perfis
definidos em security.md seção 2: tutor, órgão/ONG (com aprovação manual de
admin antes de liberar acesso) e admin (com exigência de MFA).

Inclua:
- Tela/fluxo de cadastro de tutor
- Tela/fluxo de solicitação de cadastro de organização (fica pendente até
  aprovação manual — não é self-service)
- Middleware/guard de rotas que bloqueia acesso de órgão não aprovado
- Nenhuma chave service_role exposta no client (apenas anon key)
```

---

## Prompt 3 — Cadastro de tutor e pets + geração de QR Code

```
Implemente RF-01 e RF-02 de spec.md (Modelo Híbrido):
- Formulário de cadastro de pet com campos configuráveis via painel admin
- Geração de qr_payload único por pet
- QR Code (imagem) + URL para NFC apontando para /pet/{payload}
- Upload de foto para Supabase Storage, respeitando RLS (dono do pet)
```

---

## Prompt 4 — Página pública do animal (tag QR/NFC)

```
Implemente RF-03 de spec.md (Modelo Híbrido): escanear QR ou NFC abre
/pet/{payload} — perfil público do animal (não o formulário genérico).

Fluxo:
1. Exibir foto, dados públicos do pet, “possui tutor” + nome completo do tutor
   (telefone/e-mail não no perfil — security.md)
2. Checkbox de termos (inclui localização) + botão Confirmar Resgate
3. Registrar leitura, notificar tutor, tela final “Tutor foi notificado”
4. CTA WhatsApp com telefone do tutor (só no retorno de registrar_leitura_qr)

Animais sem tag continuam em /resgate (RF-05) + matching (RF-06).
URL legada /qr/:payload redireciona para /pet/:payload.
```

---

## Prompt 5 — Ocorrência de perdido e registro de resgate

```
Implemente RF-04 e RF-05 de spec.md:
- Tutor pode abrir ocorrência de animal perdido (inclusive retroativa)
- Qualquer pessoa (anônima ou autenticada) ou organização pode registrar
  animal resgatado: foto, descrição, localização (só com consentimento
  explícito), porte estimado

Modo anônimo: exigir apenas foto, região aproximada e porte — nunca forçar
dado de contato.
```

---

## Prompt 6 — Pipeline de matching por IA (n8n + Ollama)

```
Com base em architecture.md seção 1.3 e 1.4, monte o workflow n8n
"on_novo_resgate":
1. Trigger: novo INSERT em registros_resgate (Database Webhook do Supabase)
2. Chama serviço Ollama (self-hosted) passando a URL assinada da foto,
   recebe: cor estimada, porte estimado, raça provável, embedding vetorial
3. Grava o embedding e as características na tabela registros_resgate
4. Executa a query de matching: filtro geográfico via ST_DWithin (PostGIS)
   cruzado com similaridade via pgvector, contra ocorrencias_perdido abertas
5. Para cada candidato, grava um registro em matches com o score calculado
6. Se score >= configuracoes_sistema.score_minimo_notificacao: dispara
   workflow de notificação ao tutor (RF-06 de spec.md)

Processamento sempre assíncrono — nunca bloqueando o request do usuário
que fez o upload (constitution.md Art. 3.2).
```

---

## Prompt 7 — Notificações multicanal

```
Monte o workflow n8n de notificação multicanal (WhatsApp via Z-API/ZPro,
e-mail, push), respeitando o canal_notificacao_preferido de cada tutor
(tabela tutores). Registrar cada envio na tabela notificacoes, incluindo
custo_estimado para mensagens de WhatsApp (constitution.md Art. 5.2).
```

---

## Prompt 8 — Painel de órgãos/ONGs

```
Implemente RF-07 de spec.md: painel autenticado para organizações aprovadas,
filtrando toda query por organizacao_id (multi-tenant desde o schema).

Incluir:
- Alertas de animais perdidos/resgatados na região de atuação
- Indicadores: nº de perdidos/resgatados por região/período
- Opção de registrar resgate diretamente pelo painel (aciona o mesmo
  pipeline do Prompt 6)
```

---

## Prompt 9 — Job de retenção de dados

```
Implemente o job agendado (pg_cron ou n8n scheduled) que aplica
constitution.md Art. 6.1: após configuracoes_sistema.dias_retencao_sem_dono,
anonimiza registros_resgate sem match confirmado (remove foto_url e
localizacao, muda status para 'anonimizado').

Testar em ambiente de staging antes de agendar em produção — não é aceitável
rodar às cegas contra dados reais.
```

---

## Como usar

Rode os prompts em ordem — cada um assume que o anterior já está implementado. Se precisar pular a ordem por causa de prioridade de negócio, registre isso em `docs/memory.md` antes de seguir.

### Ao concluir cada prompt

O agente **deve** atualizar `docs/memory.md` automaticamente:

1. Marcar o prompt como `✅ concluído` na tabela **Progresso de implementação**
2. Adicionar entrada no **Changelog de implementação** (formato em `.cursor/rules/memory-log.mdc`)
3. Registrar decisões novas em **Decisões tomadas**, se houver
4. Atualizar status correspondente em `docs/PRD.md`

Isso é reforçado por `.cursor/rules/memory-log.mdc` e pelo hook `stop` em `.cursor/hooks.json`.
