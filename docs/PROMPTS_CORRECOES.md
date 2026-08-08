# Correções UX — lote ago/2026

> Prompts de correção de produto/UI. **Lote 1–4 implementado em 2026-08-04.**

## Referências visuais

| Uso | Arquivo |
|-----|---------|
| Imagem da tela de login (lado direito) | `public/login-pet.png` |

---

## Prompt 1 (corrigida) — Tela de login + ownership de `/resgate`

**Status:** ✅ implementado  
**RF:** auth UX; RF-05

### Checklist

- [x] Login split conferido (form esq. + imagem dir. + Criar conta)
- [x] Roteamento pós-login por perfil intacto
- [x] CTA “Encontrei um animal” removido do fluxo/tela do tutor (e da home/nav pública)
- [x] CTA de resgate sem tag disponível na área órgão/ONG
- [x] Docs (spec, PRD, memory) sincronizados

---

## Prompt 2 — Mover "Encontrei um animal" (sem tag) para área de ONGs/Prefeitura

**Status:** ✅ implementado  
**RF:** RF-05, RF-07

### Decisão

- Entrada principal: botão **Encontrei um animal** no painel `/orgao` → página dedicada `/orgao/encontrei` (formulário completo, padrão visual do `/resgate`).
- Formulário **não** fica embutido em card no dashboard.
- `/resgate` público permanece como **legado/deep-link**, sem CTA na home/nav.

### Checklist

- [x] Sem CTA de resgate sem tag no fluxo/tela do tutor
- [x] Entrada clara na área `/orgao` (“Encontrei um animal” / sem tag)
- [x] UI alinhada ao design system do tutor
- [x] Docs sincronizados

---

## Prompt 3 — Tela de perfil do tutor

**Status:** ✅ validado (já existia; mantido)  
**RF:** RF-01

### Checklist

- [x] `/tutor/perfil` acessível e separado do cadastro de pet
- [x] Editar dados pessoais (nome, canal)
- [x] Múltiplos telefones + rótulo
- [x] Número principal para notificações
- [ ] Migration `015` aplicada no Supabase (**ops** — SQL Editor)
- [x] Docs alinhados

---

## Prompt 4 — Tela de "Abrir Ocorrência" com mapa

**Status:** ✅ implementado  
**RF:** RF-03, RF-04

### Entregas

- `/tutor/ocorrencias` — mapa Leaflet + galeria de ocorrências abertas
- Abrir ocorrência (`/tutor/pets/:id/perdido`) redireciona para a lista/mapa
- Migration `016`: `registrar_leitura_qr` só notifica com ocorrência `aberta`; RPC `listar_ocorrencias_abertas_tutor`

### Checklist

- [x] Tela tutor com mapa + status localizado / não localizado
- [x] Lista/galeria de ocorrências abertas (com imagem)
- [x] Nova ocorrência aparece na lista após abrir
- [x] Sem ocorrência aberta → leitura da tag **não** dispara notificação ao tutor
- [x] Docs sincronizados
- [ ] Migration `016` aplicada no Supabase (**ops** — SQL Editor)

---

## Resumo do lote

| # | Título | Status |
|---|--------|--------|
| 1 | Login split + ownership “Encontrei um animal” | ✅ |
| 2 | Mover “Encontrei um animal” para área órgão | ✅ |
| 3 | Perfil do tutor (multi-telefones) | ✅ |
| 4 | Abrir ocorrência com mapa + gatilho de notificação | ✅ |
