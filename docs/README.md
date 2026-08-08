# Documentação — PetID

Plataforma de Reencontro de Animais Perdidos (**Modelo Híbrido:** tag única QR/NFC → `/pet/{payload}` + `/resgate` sem tag + matching).

## Por onde começar

| Se você quer… | Leia |
|---------------|------|
| Visão de produto, escopo e status | [**PRD.md**](PRD.md) |
| Requisitos funcionais detalhados | [spec.md](spec.md) |
| Stack e fases de implementação | [plan.md](plan.md) |
| Regras não-negociáveis (LGPD, RLS) | [constitution.md](constitution.md) |
| Schema e políticas do banco | [database.md](database.md) |
| Segurança operacional | [security.md](security.md) |
| Decisões e pendências | [memory.md](memory.md) |
| Prompts para o Cursor (ordem de dev) | [PROMPTS.md](PROMPTS.md) |
| Correções UX em lote (ago/2026) | [PROMPTS_CORRECOES.md](PROMPTS_CORRECOES.md) |

## Hierarquia dos documentos

```
PRD.md          → o quê e por quê (produto)
spec.md         → requisitos testáveis (RF-XX)
constitution.md → princípios que não podem ser violados
plan.md         → como construir (stack + fases)
architecture.md → componentes e integrações
database.md     → modelo de dados
security.md     → LGPD, auth, endpoints públicos
memory.md       → log vivo: progresso, changelog, decisões (atualizado a cada prompt)
```

**Automação:** `.cursor/rules/memory-log.mdc` + hook `.cursor/hooks.json` pedem ao agente que atualize `memory.md` ao concluir entregas.

## PRD original

O documento Word da reunião de 08/06/2026 está em [`sources/PRD_Plataforma_Animais_Perdidos.docx`](sources/PRD_Plataforma_Animais_Perdidos.docx).

## Status atual (jul/2026)

- ✅ **Prompts 0–9:** código concluído (fundação → matching IA → notificações → órgãos → retenção)
- ✅ **Modelo Híbrido (24/jul/2026):** tag única `/pet/{payload}` (QR+NFC) + `/resgate` sem tag; substitui Modelo B puro
- ✅ **Banco Supabase:** migrations **002–010** aplicadas; **013** (`obter_pet_por_qr` + `tutor_nome`) — aplicar no SQL Editor se ainda não estiver remota
- 🟡 **Deploy pendente:** Edge Functions (`analyze-pet`, `send-push`), workflows n8n, webhooks, credenciais (Z-API/Resend/VAPID)
- 🟡 **Config pendente:** região das organizações no admin; `ai_provider` fake → ollama; Turnstile produção; dry-run retenção
- [ ] **Lançamento:** feira pet 12–14 de agosto de 2026

Detalhe das pendências: [`memory.md`](memory.md) §Pendências operacionais.

## Dev local (frontend)

```bash
npm run dev
```

- URL: **http://localhost:5181/** (raiz redireciona para `/login`)
- Porta fixa `5181` em `vite.config.ts` (evita conflito com outros projetos em `:5180`)

Se aparecer `Port 5181 is already in use`, há outro `vite`/`node` antigo. No Git Bash (Windows):

```bash
netstat -ano | grep ':5181'
taskkill //PID <PID> //F
npm run dev
```

Substitua `<PID>` pelo número da coluna final da linha `LISTENING`.

Se a página abrir **em branco** (console: `504 Outdated Optimize Dep`), limpe o cache do Vite e reinicie:

```bash
# encerre o npm run dev (Ctrl+C), depois:
rm -rf node_modules/.vite
npm run dev
```

Depois faça um hard refresh no navegador (`Ctrl+Shift+R`).
