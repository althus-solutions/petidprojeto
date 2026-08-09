# Memory — Plataforma de Reencontro de Animais Perdidos

> Log vivo de contexto e decisões. Atualizar sempre que uma decisão relevante for tomada ou um desvio da constituição/spec acontecer (Art. 8.2).
>
> **Automação:** o Cursor deve atualizar este arquivo ao concluir cada Prompt (`docs/PROMPTS.md`) ou entrega relevante — ver `.cursor/rules/memory-log.mdc`.

## Contexto do projeto

- Origem: PRD v1.0, elaborado a partir de reunião de 08/06/2026 entre Nathan Silva e Samuel Souza.
- Meta de lançamento: feira pet de 12 a 14 de agosto de 2026 (~2 meses de produção a partir de junho/2026).
- Este é um projeto novo da Kainon Tech, distinto de CortesClip e da SaaS de segmentação de vídeo — mas reaproveita padrões de stack já validados (Supabase, Ollama self-hosted, n8n, WhatsApp via Z-API/ZPro, Vercel).

## Progresso de implementação (Prompts)

### Fase MVP funcional (concluída)

| Prompt | Título | RF | Status | Concluído em |
|--------|--------|-----|--------|--------------|
| 0 | Setup PWA (React + Vite + Tailwind) | — | ✅ concluído | 2026-07-06 |
| 1 | Schema do banco (Supabase) | — | ✅ concluído | 2026-07-06 |
| 2 | Autenticação e perfis | — | ✅ concluído | 2026-07-06 |
| 3 | Cadastro tutor/pets + QR Code | RF-01, RF-02 | ✅ **Híbrido** + perfil tutor (`/tutor/perfil`) | 2026-07-06 / 2026-07-24 / 2026-08-04 |
| 4 | Página pública leitura QR | RF-03 | ✅ **Híbrido** (`/pet` + chat in-app + WhatsApp opcional) | 2026-07-07 / 2026-08-08 |
| 5 | Ocorrência perdido + registro resgate | RF-04, RF-05 | ✅ **RF-04 enriquecida** (geocoding, raio, consent) | 2026-07-07 / 2026-08-08 |
| 6 | Pipeline matching IA (n8n + Ollama) | RF-06 | ✅ concluído | 2026-07-08 |
| 7 | Notificações multicanal | RF-03, RF-06 | ✅ concluído | 2026-07-08 |
| 8 | Painel órgãos/ONGs | RF-07 | ✅ concluído | 2026-07-08 |
| 9 | Job de retenção de dados | Art. 6 | ✅ concluído | 2026-07-08 |

### Fase Design System (UI — sem alterar lógica)

| Prompt | Título | RF | Status | Concluído em |
|--------|--------|-----|--------|--------------|
| DS-0 | Design System — tokens + componentes base | — | ✅ concluído | 2026-07-08 |
| DS-1 | PublicLayout + HomePage | — | ✅ concluído | 2026-07-08 |
| DS-2 | Autenticação (Login, Cadastro tutor, Cadastro organização) | — | ✅ concluído | 2026-07-08 |
| DS-3 | AppLayout (header autenticado) | — | ✅ concluído | 2026-07-08 |
| DS-4 | Área do tutor (dashboard, pet, matches, perda) | — | ✅ concluído | 2026-07-08 |
| DS-5 | Rotas públicas críticas (QR + Resgate) | RF-03, RF-05 | ✅ concluído (refino) | 2026-07-08 |
| DS-6 | Área do órgão | RF-07 | ✅ concluído (refino 2) | 2026-07-09 |
| DS-7 | Área admin (+ MFA) | — | ✅ concluído (refino) | 2026-07-08 |

## Changelog de implementação

> Entradas mais recentes no topo. O agente adiciona uma ao concluir cada prompt/entrega.

### 2026-08-08 — UX — Ocorrências: pin com nome + sem CTA abrir
- **RF:** RF-03 / RF-04
- **Entregas:** removidos botões “Abrir ocorrência — {pet}”; pin verde mostra nome do pet (não “Aqui”); tipagem `declare` corrigida na `031` (reencontro remove ocorrência/pin do mapa e `/pet` volta a “não está perdido”)
- **Arquivos:** `TutorOcorrenciasPage.tsx`, `OcorrenciasMap.tsx`, `031_registrar_reencontro_tutor.sql`, `index.css`
- **Ops:** reaplicar `031` se a versão anterior falhou por typo `declarea`

### 2026-08-08 — UX — Bottom nav mobile no painel tutor
- **RF:** —
- **Entregas:** topo só logo + avatar; abas **Meus pets** / **Ocorrências** viram ícones na barra inferior; badge de alerta permanece em Ocorrências; chat FAB sobe acima da bottom nav; barras flutuantes com cantos `rounded-[22px]`
- **Arquivos:** `AppLayout.tsx`, `ChatWidget.tsx`

### 2026-08-08 — Feature — Instalar app (PWA) em Meu perfil
- **RF:** — (mobile / PWA)
- **Entregas:** bloco **Baixar o aplicativo** em `/tutor/perfil` sempre visível (mesmo com perfil carregando); botão **Baixar aplicativo** sempre exibido + copiar link; prompt nativo quando disponível; instruções iOS/Android/desktop
- **Arquivos:** `InstallAppCard.tsx`, `usePwaInstall.ts`, `pwa-install.ts`, `main.tsx`, `vite.config.ts`, `index.html`, `public/pwa-*.png`, `TutorProfilePage.tsx`
- **Decisões:** MVP mobile = PWA instalável (conforme `plan.md`); Capacitor/lojas fica como evolução pós-feira

### 2026-08-08 — UX — Card de ocorrência mobile (ações à direita)
- **RF:** RF-04
- **Entregas:** bloco expandido com foto/info à esquerda; **Pet encontrado** e **Ver pet** empilhados à direita dentro do card; confirmação de reencontro no rodapé do mesmo bloco; lista em coluna única
- **Arquivos:** `TutorOcorrenciasPage.tsx`

### 2026-08-08 — Feature — Tutor registra reencontro na aba Ocorrências
- **RF:** RF-04
- **Entregas:** botão **Pet encontrado** em cada ocorrência aberta; confirmação inline; RPC `registrar_reencontro_tutor` marca `status=reencontrado`, descarta matches sugeridos e encerra chats do animal
- **Arquivos:** `031_registrar_reencontro_tutor.sql`, `ocorrencias.ts`, `TutorOcorrenciasPage.tsx`
- **Ops:** aplicar `031` no SQL Editor do Supabase

### 2026-08-08 — Fix — Badge na aba Ocorrências
- **RF:** RF-03 / RF-04
- **Entregas:** sinalizador vermelho na aba **Ocorrências** quando há leitura da tag ainda não vista; `ultima_interacao_em` (qualquer leitura, com ou sem GPS); banner na página adapta texto; dismiss limpa o badge
- **Arquivos:** `030_alerta_leitura_ocorrencias_tutor.sql`, `ocorrencia-alertas.ts`, `AppLayout.tsx`, `TutorOcorrenciasPage.tsx`
- **Ops:** aplicar `030` no SQL Editor (senão o badge só funciona com leituras que já tinham `ultima_leitura_em`/GPS)

### 2026-08-08 — Fix — Badge do chat ao confirmar resgate
- **RF:** RF-03
- **Entregas:** ao enfileirar notificação de leitura QR, abre conversa + mensagem automática do finder; tutor vê o sinalizador vermelho no ícone de chat; polling do tutor a 5s; fallback no `ChatWidget` se a migration ainda não estiver aplicada
- **Arquivos:** `029_chat_aviso_apos_leitura_qr.sql`, `ChatWidget.tsx`
- **Ops:** aplicar `029` no SQL Editor do Supabase

### 2026-08-08 — UX — /pet: termos obrigatórios, localização opcional
- **RF:** RF-03
- **Entregas:** checkbox de termos libera “Confirmar Resgate”; localização em checkbox separado (opcional, default marcado)
- **Arquivos:** `PetPublicPage.tsx`, `qr-read.ts` (texto padrão)

### 2026-08-08 — Fix — Galeria /pet + foto sem corte
- **RF:** RF-03
- **Entregas:** migration `028` reaplica policy Storage para `animal_fotos` + RPC com todas as fotos; UI `object-contain` 4:5, setas/miniaturas/contador
- **Arquivos:** `028_pet_publico_galeria_storage.sql`, `PetPublicPage.tsx`, `qr-read.ts`
- **Ops:** aplicar `028` no SQL Editor (sem isso a galeria continua só com a capa)

### 2026-08-08 — UX — Geocode preciso via Google (sem arrastar pin)
- **RF:** RF-04
- **Entregas:** pin não é mais arrastável; `geocodeEnderecoCompleto` usa Google Geocoding se `VITE_GOOGLE_MAPS_API_KEY` (ROOFTOP/RANGE_INTERPOLATED); fallback Photon
- **Arquivos:** `geocode.ts`, `OcorrenciasMap.tsx`, `TutorEnderecoFields.tsx`, `.env.example`
- **Ops:** criar chave Google Cloud com Geocoding API e colocar em `.env.local`
- **Decisões:** OSM/Photon não tem nº na maioria das ruas BR — precisão de porta exige Google (ou similar)

### 2026-08-08 — UX — Mapa: sem pin Perda + pin Você arrastável
- **RF:** RF-04 / RF-03
- **Entregas:** removido pin cinza “Perda”; pin arrastável (depois removido em favor do Google)
- **Arquivos:** `OcorrenciasMap.tsx`, `TutorOcorrenciasPage.tsx`, `geocode.ts`

### 2026-08-08 — UX — CEP auto-preenche endereço do tutor
- **RF:** RF-04
- **Entregas:** ViaCEP preenche rua, bairro, cidade e UF; usuário informa só número/complemento
- **Arquivos:** `localidades-br.ts` (`fetchEnderecoByCep`), `TutorEnderecoFields.tsx`

### 2026-08-08 — UX — Um endereço no perfil (sem tipo)
- **RF:** RF-04
- **Entregas:** perfil com um único endereço (rua/número/etc.); pin “Você” no mapa; sem Residência/Trabalho
- **Arquivos:** `TutorEnderecoFields`, `tutor-enderecos.ts`, `OcorrenciasMap`, `TutorProfilePage`

### 2026-08-08 — UX — Endereços Residência/Trabalho + leitura com endereço
- **RF:** RF-04 / RF-03
- **Entregas:**
  - Tabela `tutor_enderecos` com rua, número, complemento, CEP, UF/cidade/bairro
  - Pin privado no mapa + pin verde com endereço textual da leitura QR/NFC
  - Reverse geocode no `/pet` ao confirmar resgate com localização; `leituras_qr.endereco_texto`
- **Arquivos:** `027_tutor_enderecos_leitura_texto.sql`, `TutorEnderecoFields`, `tutor-enderecos.ts`, `geocode.ts`, mapa/perfil/QR
- **Ops:** aplicar `026` + `027`
- **Validação:** pendente após migrations
- **Obs.:** UI simplificada depois para um endereço só (sem tipo)

### 2026-08-08 — UX — Mapa moderno + endereço privado do tutor
- **RF:** RF-04 / RF-03
- **Entregas:**
  - Endereço residencial no perfil do tutor (UF/cidade/bairro + lat/lng + consentimento) — **privado**, nunca no `/pet`
  - Mapa com tiles Carto Voyager, pins custom (casa / perda / encontrado piscando)
  - Aviso ao abrir ocorrências quando há localização compartilhada na tag
- **Arquivos:** `026_tutor_endereco_mapa.sql`, `TutorProfilePage`, `OcorrenciasMap`, `TutorOcorrenciasPage`, `auth.ts`, `tutor-perfil.ts`, `index.css`
- **Decisões:** pin da casa só no app autenticado; pin piscante = última `leituras_qr` com GPS após abertura
- **Ops:** aplicar `026` no SQL Editor
- **Validação:** pendente no ambiente após migration

### 2026-08-08 — Fix — Geocode Photon (`lang=pt` inválido)
- **RF:** RF-04
- **Entregas:** Photon deixou de aceitar `lang=pt` (só default/de/en/fr) — geocode de bairro falhava; corrigido + removida mensagem “Tente outro bairro”
- **Arquivos:** `localidades-br.ts`, `geocode.ts`, `EstadoCidadeBairroFields.tsx`
- **Validação:** query “Cidade Edson, Suzano, SP” retorna coords no Photon

### 2026-08-08 — UX — Local da perda: só selects (sem filtro)
- **RF:** RF-04
- **Entregas:** removidos contador “N bairro(s)” e bloco “Filtrar ou digitar bairro” / “Confirmar bairro”; seleção só pelo select
- **Arquivos:** `EstadoCidadeBairroFields.tsx`
- **Validação:** visual no formulário de perda

### 2026-08-08 — UX — Local da perda: UF → cidade → bairro (listas)
- **RF:** RF-04
- **Entregas:** selects em cascata (UF sigla, cidades IBGE, bairros OSM/Photon); coluna `estado`; RPC com `p_estado`
- **Arquivos:** `025_ocorrencia_estado_uf.sql`, `localidades-br.ts`, `EstadoCidadeBairroFields.tsx`, `LostOccurrenceForm.tsx`
- **Ops:** aplicar `025` (após 022–024)

### 2026-08-08 — UX — /pet só resgata se ocorrência aberta
- **RF:** RF-03
- **Entregas:** `obter_pet_por_qr` retorna `ocorrencia_aberta`; UI mostra “Este animal não está perdido” sem CTA de resgate/chat quando fechada/inexistente
- **Arquivos:** `024_pet_publico_somente_se_perdido.sql`, `PetPublicPage.tsx`, `types/qr-read.ts`
- **Ops:** aplicar `024` no SQL Editor

### 2026-08-08 — UX — Ocorrência: cidade/bairro (sem rua) + raio interno
- **RF:** RF-04
- **Entregas:** campos `cidade`/`bairro`; UI sem rua/número e sem seletor de raio; geocode por bairro+cidade; raio 2km só no backend
- **Arquivos:** `023_ocorrencia_cidade_bairro.sql`, `CidadeBairroFields.tsx`, `LostOccurrenceForm.tsx`, `geocode.ts`
- **Decisões:** alertas de comunidade por bairro/raio ficam para depois da abertura; matching geo continua interno
- **Ops:** aplicar `022` + `023`

### 2026-08-08 — Feature — Ocorrência de perda enriquecida
- **RF:** RF-04
- **Entregas:**
  - Geocoding → lat/lng em `localizacao` PostGIS; horário; coleira/tag; circunstâncias; foto do dia; contato; consentimento; pós-submit
  - Migration `022`: novos campos + RPC ampliada; matching usa `raio_busca_km` (default interno)
- **Arquivos:** `022_ocorrencia_perdido_enriquecida.sql`, `LostOccurrenceForm.tsx`, `geocode.ts`, `ocorrencias.ts`, docs
- **Decisões:** geocoding via Photon (sem API key)
- **Ops:** aplicar `022` no SQL Editor
- **RLS:** auditado — tutor próprio; órgão por região; matching security definer

### 2026-08-08 — Feature — Edição de pet (QR/link imutáveis)
- **RF:** RF-01
- **Entregas:**
  - Rota `/tutor/pets/:id/editar` + botão na tela do pet
  - `updateAnimal` atualiza dados/fotos sem enviar `qr_payload`
  - Migration `021`: trigger impede alteração de `qr_payload` no banco
- **Arquivos:** `PetEditPage.tsx`, `PetForm.tsx`, `pets.ts`, `PetDetailPage.tsx`, `021_qr_payload_imutavel.sql`
- **Decisões:** tag (QR + NFC) gerada só no cadastro; edição nunca regenera payload
- **Ops:** aplicar `021_qr_payload_imutavel.sql` no SQL Editor

### 2026-08-08 — Feature — Chat na plataforma (FAB + badge)
- **RF:** RF-03 (contato pós-leitura)
- **Entregas:**
  - Migration `020`: tabelas `conversas`/`mensagens`, RLS tutor, RPCs finder por fingerprint
  - FAB flutuante com badge de não lidas; painel de lista + thread
  - Tutor: widget em `AppLayout`; finder: `/pet/:payload` (abre após confirmar resgate)
- **Arquivos:** `020_chat_plataforma.sql`, `src/lib/chat.ts`, `src/types/chat.ts`, `ChatWidget.tsx`, `AppLayout.tsx`, `PetPublicPage.tsx`, `docs/database.md`
- **Ops:** aplicar `020_chat_plataforma.sql` no SQL Editor
- **Validação:** pendente após migration

### 2026-08-08 — UX — Galeria na página pública NFC/QR
- **RF:** RF-03
- **Entregas:** foto maior e quadrada em `/pet/:payload`; carrossel com todas as `animal_fotos`; migration `019` (`foto_paths[]` + policy Storage)
- **Arquivos:** `019_pet_publico_galeria_fotos.sql`, `PetPublicPage.tsx`, `qr-read.ts`, `types/qr-read.ts`
- **Ops:** aplicar `019` no SQL Editor

### 2026-08-08 — UX — Cadastro de pet sem sugestão IA (MVP)
- **RF:** RF-01
- **Entregas:** removidos modal/CTA/Edge de sugestão IA no cadastro; preenchimento manual + fotos no mesmo form
- **Arquivos:** `PetForm.tsx` (removidos `PetAiSuggestModal`, `pet-ai-suggest.ts`, `suggest-pet-attributes`)
- **Decisões:** autofill por IA adiado para depois do MVP

### 2026-08-08 — Feature — Cadastro de pet enriquecido (multi-foto + campos)
- **RF:** RF-01, RF-06
- **Entregas:**
  - Migration `018`: colunas sexo/idade/castrado/pelagem/cores/consentimento; tabela `animal_fotos` + RLS; contexto matching com `foto_paths[]`; seed `campos_formulario_pet`
  - Form: 1–4 fotos com slots, cores multi-select, sexo/idade/castrado/pelagem, checkbox LGPD
  - Edge `analyze-pet`: processa todas as fotos, embedding por foto + canônico (média)
  - Rota placeholder `/privacidade`
- **Arquivos:** `018_pet_cadastro_enriquecido.sql`, `PetForm.tsx`, `pets.ts`, `configuracoes.ts`, `analyze-pet/index.ts`, `PrivacyPolicyPage.tsx`, docs
- **Ops:** aplicar migration `018` no SQL Editor; redeploy Edge `analyze-pet`
- **Validação:** pendente após migration

### 2026-08-08 — Fix — Login quebrava sem migration 017
- **RF:** —
- **Entregas:** `loadTutorProfile` / `ensureTutorProfile` fazem fallback se `tutores.foto_url` não existir; mensagem clara ao salvar foto sem migration
- **Arquivos:** `src/lib/auth.ts`, `src/lib/tutor-perfil.ts`
- **Ops:** ainda é necessário aplicar `017_tutor_foto_perfil.sql` para a foto funcionar

### 2026-08-08 — UX — Removido canal preferido do perfil
- **RF:** —
- **Entregas:** campo “Canal preferido de notificação” removido de `/tutor/perfil` (valor atual preservado no save)
- **Arquivos:** `TutorProfilePage.tsx`

### 2026-08-08 — Feature — Foto do tutor no perfil
- **RF:** RF-01
- **Entregas:**
  - Coluna `tutores.foto_url` (migration `017`)
  - Upload no bucket `pets` em `{tutor_id}/perfil/foto.*`
  - UI em `/tutor/perfil` + avatar no ícone da topbar
- **Arquivos:** `017_tutor_foto_perfil.sql`, `TutorProfilePage.tsx`, `tutor-perfil.ts`, `auth.ts`, `AppLayout.tsx`, `docs/database.md`
- **Ops:** aplicar migration `017` no SQL Editor do Supabase
- **Validação:** pendente após migration

### 2026-08-08 — UX — Removido CTA “Possíveis matches” do dashboard
- **RF:** —
- **Entregas:** removido botão “Possíveis matches” de `/tutor` (rota `/tutor/matches` permanece)
- **Arquivos:** `TutorDashboardPage.tsx`

### 2026-08-08 — UX — Ocorrências na topbar do tutor
- **RF:** RF-04
- **Entregas:**
  - Abas na topbar do tutor: **Meus pets** e **Ocorrências**
  - Removido botão solto “Ocorrências” do dashboard
- **Arquivos:** `AppLayout.tsx`, `TutorDashboardPage.tsx`
- **Validação:** pendente visual em `/tutor` e `/tutor/ocorrencias`

### 2026-08-08 — UX — Push só na ocorrência de perdido
- **RF:** RF-04 / RF-07 (notificações)
- **Entregas:**
  - Removido banner `PushOptIn` do dashboard `/tutor`
  - Opt-in de push aparece ao abrir ocorrência em `/tutor/pets/:id/perdido`
  - Copy alinhada a alertas com ocorrência aberta (tag/matches)
- **Arquivos:** `TutorDashboardPage.tsx`, `LostOccurrencePage.tsx`, `PushOptIn.tsx`
- **Validação:** pendente visual no fluxo “Animal perdido”

### 2026-08-08 — UX — Menu de conta no AppLayout
- **RF:** —
- **Entregas:**
  - Removidos e-mail e link/botão “Meu perfil” do header autenticado
  - Ícone de perfil com dropdown: **Meu perfil** (tutor) e **Sair**
  - Removido botão “Meu perfil” da home do tutor (acesso só pelo ícone)
- **Arquivos:** `src/components/layouts/AppLayout.tsx`, `src/pages/tutor/TutorDashboardPage.tsx`
- **Validação:** pendente visual em `/tutor`

### 2026-08-04 — Ops — Porta 5181 ocupada / página em branco (Vite)
- **RF:** —
- **Entregas:** liberada `:5181`; cache `node_modules/.vite` limpo (causa: `504 Outdated Optimize Dep` → tela branca); troubleshooting em `docs/README.md`
- **Arquivos:** `docs/README.md`, `docs/memory.md`
- **Validação:** login renderiza “Bem-vindo de volta” + “Criar conta” em http://localhost:5181/login

### 2026-08-04 — UX — Remove landing; `/` → login
- **RF:** auth UX
- **Entregas:** removida `HomePage`; `/` e rotas inválidas redirecionam para `/login`; mantidos CTAs **Criar conta** no login e **criar uma conta** no `PublicLayout` (cadastro); links “início” apontam para `/login`
- **Arquivos:** `src/routes/index.tsx`, `HomePage.tsx` (removido), `LoginPage.tsx`, `PetIdLogo.tsx`, `AppLayout.tsx`, `ProtectedRoute.tsx`, `PetPublicPage.tsx`, `OrgaoPendingPage.tsx`, `MfaPage.tsx`, `vite.config.ts`, `docs/memory.md`
- **Validação:** `npm run build`

### 2026-08-04 — UX — Removido **Achei o Pet** da home
- **RF:** RF-03 / RF-05
- **Entregas:** removidos CTA na landing `/`, rota `/home` e página demo `AcheiPetDemoPage`; home pública volta a só cadastro/login; órgão `/orgao/encontrei` inalterado
- **Arquivos:** `HomePage.tsx`, `src/routes/index.tsx`, `AcheiPetDemoPage.tsx` (removido), docs
- **Validação:** —

### 2026-08-04 — UX — Home: demo **Achei o Pet** (`/home`) ~~(revertido no mesmo dia)~~
- **RF:** RF-03 (demo), RF-05 (sem misturar com órgão)
- **Entregas:**
  - ~~Rota pública `/home` com página de exemplo do fluxo pós-QR~~
  - ~~CTA **Achei o Pet** na landing `/`~~
  - Painel `/orgao` e `/orgao/encontrei` **não alterados**
- **Arquivos:** ~~`AcheiPetDemoPage.tsx`~~, `HomePage.tsx`, `src/routes/index.tsx`, docs
- **Validação:** `npm run build` (antes do revert)

### 2026-08-04 — UX — Órgão: botão Encontrei um animal → página dedicada
- **RF:** RF-05, RF-07
- **Entregas:** removido formulário embutido do dashboard; botão navega para `/orgao/encontrei` (página com o form, no estilo do `/resgate` antigo)
- **Arquivos:** `OrgaoDashboardPage.tsx`, `OrgaoEncontreiPage.tsx`, `src/routes/index.tsx`, `docs/PROMPTS_CORRECOES.md`, `docs/memory.md`
- **Validação:** `npm run build`

### 2026-08-04 — Lote UX — PROMPTS_CORRECOES #1–#4
- **RF:** RF-01, RF-03, RF-04, RF-05, RF-07
- **Entregas:**
  - #1–#2: removidos CTAs “Encontrei um animal” da home/nav; órgão com CTA/seção **Encontrei um animal**; `/resgate` legado com aviso
  - #3: perfil tutor já existente validado (`/tutor/perfil`)
  - #4: `/tutor/ocorrencias` (mapa Leaflet + galeria); gate de notificação QR só com ocorrência aberta; migration `016`
- **Arquivos:** `HomePage`, `PublicLayout`, `OrgaoDashboardPage`, `RescueRegisterPage`, `PetPublicPage`, `TutorOcorrenciasPage`, `OcorrenciasMap`, `LostOccurrencePage`, `ocorrencias.ts`, `016_*.sql`, docs
- **Decisões:** `/resgate` público = legado; notificação tag exige ocorrência `aberta`; leitura sem ocorrência ainda é auditada
- **Ops:** aplicar migrations `015` e `016` no SQL Editor
- **Validação:** `npm run build` OK

### 2026-08-04 — Docs — Correção UX #4 registrada (lote completo; sem implementar)
- **RF:** RF-03, RF-04
- **Entregas:** Prompt 4 em `PROMPTS_CORRECOES.md` — tela Abrir Ocorrência com mapa + lista; notificação via QR só com ocorrência aberta (mudança de regra vs. comportamento atual)
- **Arquivos:** `docs/PROMPTS_CORRECOES.md`, `docs/memory.md`
- **Decisões (a confirmar na implementação):** leitura da tag sem ocorrência aberta = sem mensagem ao tutor
- **Validação:** —

### 2026-08-04 — Docs — Correção UX #3 registrada (sem reimplementar)
- **RF:** RF-01
- **Entregas:** Prompt 3 em `PROMPTS_CORRECOES.md` — perfil do tutor; nota de que `/tutor/perfil` + migration `015` já existem (validar no lote)
- **Arquivos:** `docs/PROMPTS_CORRECOES.md`, `docs/memory.md`
- **Validação:** —

### 2026-08-04 — Docs — Correção UX #2 registrada (sem implementar)
- **RF:** RF-05, RF-07
- **Entregas:** Prompt 2 em `PROMPTS_CORRECOES.md` — mover “Encontrei um animal” (sem tag) para área órgão/ONG; UI no design system do tutor; complementar ao #1
- **Arquivos:** `docs/PROMPTS_CORRECOES.md`, `docs/memory.md`
- **Validação:** —

### 2026-08-04 — Docs — Correção UX #1 registrada (sem implementar)
- **RF:** auth UX; RF-05
- **Entregas:** criado `docs/PROMPTS_CORRECOES.md` com Prompt 1 (corrigida): login split (já parcialmente feito) + mover “Encontrei um animal” para área órgão/ONG (fora do tutor); link no `docs/README.md`; pendência no `memory.md`
- **Arquivos:** `docs/PROMPTS_CORRECOES.md`, `docs/README.md`, `docs/memory.md`
- **Decisões:** registrar os 4 prompts antes de implementar o lote
- **Validação:** —

### 2026-08-04 — Feature — Perfil do tutor (`/tutor/perfil`)
- **RF:** RF-01
- **Entregas:**
  - Tela de perfil separada do cadastro de pet: editar nome, canal de notificação e múltiplos telefones
  - Marcar número **principal** (espelha `tutores.telefone` para WhatsApp/notificações)
  - Migration `015_tutor_perfil_contatos.sql`: tabela `tutor_contatos`, RLS, triggers de sync, RPC `salvar_perfil_tutor`
  - Links no dashboard e no header do painel do tutor
- **Arquivos:** `TutorProfilePage.tsx`, `src/lib/tutor-perfil.ts`, `src/types/tutor-perfil.ts`, `src/routes/index.tsx`, `AppLayout.tsx`, `TutorDashboardPage.tsx`, `supabase/migrations/015_*.sql`, docs
- **Ops:** aplicar migration `015` no SQL Editor (MCP read-only)
- **Validação:** `npm run build` OK

### 2026-08-04 — UX — Pós-confirmação: tela final + WhatsApp do tutor
- **RF:** RF-03
- **Entregas:**
  - Confirmação com termo marcado vai direto para **Tutor foi notificado** (sem tela intermediária de localização — já coberta pelo aceite)
  - CTA **Conversar diretamente com o tutor** → `wa.me` com telefone E.164 do tutor
  - Migration `014_leitura_qr_tutor_whatsapp.sql`: `registrar_leitura_qr` retorna `tutor_telefone_whatsapp` só após confirmação (não em `obter_pet_por_qr`)
- **Arquivos:** `PetPublicPage.tsx`, `src/lib/qr-read.ts`, `src/types/qr-read.ts`, `supabase/migrations/014_*.sql`, `docs/spec.md`, `docs/security.md`, `docs/PRD.md`, `docs/memory.md`
- **Decisões:** WhatsApp direto pós-confirmação (exceção a intermediação total); telefone só no retorno da RPC de confirmação + rate limit
- **Ops:** aplicar migration `014` no SQL Editor do Supabase (MCP read-only)
- **Validação:** `npm run build` OK; WhatsApp depende da migration `014` aplicada

### 2026-08-04 — UX — Aceite de termos na página pública `/pet/:payload`
- **RF:** RF-03
- **Entregas:**
  - Checkbox de aceite antes de **Confirmar Resgate** (“Aceito os termos e condições e compartilhar minha localização…”)
  - Botão só avança com checkbox marcado; confirmação captura GPS e notifica o tutor
  - Removida a frase “Animal sem coleira?” da tela da tag
  - Etapa intermediária de consentimento (sim/não) unificada no checkbox
- **Arquivos:** `src/pages/public/PetPublicPage.tsx`, `src/types/qr-read.ts`, `docs/spec.md`, `docs/memory.md`
- **Decisões:** aceite de termos + localização no mesmo checkbox na página do perfil (QR/NFC); ausência de GPS no navegador ainda pode falhar a captura (erro exibido)
- **Validação:** pendente (teste manual na tag)

### 2026-08-04 — UI — Login split (tutor + órgão)
- **RF:** —
- **Entregas:** tela `/login` em layout dividido (formulário à esquerda + imagem de pet à direita); campos e-mail/senha, botão Entrar, link **Criar conta** abaixo da senha; login único com roteamento pós-auth (tutor → `/tutor`, órgão → `/orgao`, admin → MFA/admin); sem fluxo de “produtor”; imagem `public/login-pet.png`
- **Arquivos:** `src/pages/auth/LoginPage.tsx`, `src/routes/index.tsx`, `public/login-pet.png`, `docs/memory.md`
- **Decisões:** login fora do `PublicLayout` para full-bleed; paleta PetID (não azul do mock externo); lógica `resolveRedirect` intacta
- **Validação:** `npm run build` OK

### 2026-07-24 — Produto — Modelo Híbrido (tag única + resgate sem tag)
- **RF:** RF-02, RF-03, RF-05
- **Entregas:**
  - Docs: PRD, spec, plan, architecture, database, security, PROMPTS, README, `.cursorrules`
  - URL canônica **`/pet/{payload}`** (QR + NFC); `/qr/:payload` redireciona
  - Página pública do animal: foto, dados, nome completo do tutor (sem contato), **Confirmar Resgate** → consentimento de localização → `registrar_leitura_qr`
  - `QrCodeDisplay`: PNG do QR + copiar link NFC (mesma URL)
  - `/resgate` permanece para animais **sem tag** + matching
  - Migration `013_pet_publico_tutor_nome.sql` (RPC `obter_pet_por_qr` retorna `tutor_nome`)
- **Arquivos:** `src/pages/public/PetPublicPage.tsx`, `QrReadPage.tsx`, `QrCodeDisplay.tsx`, `src/lib/pets.ts`, `src/lib/qr-read.ts`, `src/types/qr-read.ts`, `src/routes/index.tsx`, `supabase/migrations/013_*.sql`, docs/*
- **Decisões:** nome completo do tutor na página pública; sem WhatsApp/telefone; caminho `/pet/:payload`; Modelo B puro (15/jul) substituído
- **Ops:** aplicar migration `013` no SQL Editor do Supabase (MCP estava read-only)
- **Validação:** `npm run build` OK

### 2026-07-15 — Produto — Modelo B (QR genérico + formulário + matching)
- **RF:** RF-02, RF-03, RF-05, RF-06
- **Entregas:**
  - Docs atualizados: `PRD.md`, `spec.md`, `plan.md`, `architecture.md`, `database.md`, `security.md`, `PROMPTS.md`, `README.md`, `.cursorrules`, `memory.md`
  - QR impresso aponta para URL genérica `/resgate` (`buildPublicRescueQrUrl`)
  - `QrCodeDisplay` e textos da home/resgate alinhados ao fluxo: formulário → localização opcional → matching → notifica tutor
  - `/qr/:payload` (legado Modelo A) redireciona para `/resgate`
- **Arquivos:** `src/lib/pets.ts`, `src/components/pets/QrCodeDisplay.tsx`, `src/pages/public/QrReadPage.tsx`, `src/pages/public/RescueRegisterPage.tsx`, `src/components/resgate/RescueForm.tsx`, `src/pages/public/HomePage.tsx`, `src/components/layouts/PublicLayout.tsx`
- **Decisões:** Modelo A (QR único → notificação direta) **substituído** pelo Modelo B; `qr_payload` interno permanece para auditoria; notificação ao tutor depende do matching (RF-06), não da leitura do QR
- **Validação:** `npm run build` OK

### 2026-07-09 — UX — Hub de cadastro (`/cadastro`)
- **RF:** —
- **Entregas:** nova rota `/cadastro` com dois cards (tutor vs órgão/ONG); badge “Sujeito a aprovação manual” no card de organização; links da home, header público e login apontam para o hub; formulários `/cadastro/tutor` e `/cadastro/organizacao` intactos com link “Escolher outro perfil”
- **Arquivos:** `src/pages/auth/RegisterHubPage.tsx`, `src/routes/index.tsx`, `src/components/layouts/PublicLayout.tsx`, `src/pages/public/HomePage.tsx`, `src/pages/auth/LoginPage.tsx`, `src/pages/auth/RegisterTutorPage.tsx`, `src/pages/auth/RegisterOrgaoPage.tsx`
- **Decisões:** ponto único de entrada para cadastro; lógica `signUpTutor`/`signUpOrgao` inalterada (`security.md` — órgão continua com aprovação manual explícita)
- **Validação:** `npm run build` OK

### 2026-07-09 — DS-6 (refino 2) — Área do órgão alinhada aos mocks HTML
- **RF:** RF-07 (UI)
- **Entregas:** telas aguardando/rejeitado com copy dos mocks (`Cadastro em análise` / `Cadastro não aprovado`), chip da org, ícone circular de status e CTA suporte; dashboard com pills 7/30/90, 2 cards destaque roxos (resgates/perdidos no período) + 3 métricas secundárias com ícone lilás; `OrgaoAlertasList` em cards individuais com timestamp relativo; aviso amarelo com borda; quick actions no card de alertas; `RescueForm` embutido com scroll suave
- **Arquivos:** `src/pages/orgao/*`, `src/components/orgao/*`
- **Decisões:** `src/lib/orgao` e multi-tenant intactos; referência `petid-orgao-dashboard/status.html`
- **Validação:** `npm run build` OK

### 2026-07-09 — DS-7 (refino 2) — Área admin alinhada aos mocks HTML
- **RF:** —
- **Entregas:** dashboard com cards de overview (pets, resgates, matches, notificações) + 3 módulos clicáveis; `/admin/campos-pet` com editor JSON em card segmentado; `/admin/organizacoes` com filter pills contando totais e filtro padrão "Todas"; `/admin/retencao` com ícones nos botões dry-run/aplicar; MFA com `MfaOtpInput` de 6 caixas (paste + navegação por teclado)
- **Arquivos:** `src/lib/admin.ts`, `src/components/admin/MfaOtpInput.tsx`, `src/pages/admin/*`
- **Decisões:** lógica de aprovação, MFA, retenção e campos intacta; overview via count queries com RLS admin (sem nova migration)
- **Validação:** `npm run build` OK

### 2026-07-09 — Fix — Login órgão após aprovação (email not confirmed)
- **RF:** RF-07
- **Entregas:** migration `012_org_approval_confirm_email.sql` — ao aprovar org, confirma `email_confirmed_at` dos responsáveis em `auth.users`; backfill para orgs já aprovadas; `mapAuthErrorMessage` traduz "Email not confirmed" no login
- **Arquivos:** `supabase/migrations/012_org_approval_confirm_email.sql`, `src/lib/auth.ts`, `src/pages/auth/LoginPage.tsx`
- **Ops:** aplicar migration `012` no SQL Editor; ou confirmar manualmente `petsvida@petsvida.com` em Authentication → Users
- **Validação:** `npm run build` OK

### 2026-07-09 — Fix — Cadastro órgão não aparecia no painel admin
- **RF:** RF-07
- **Entregas:** migration `011_org_signup_trigger.sql` — trigger em `auth.users` cria `organizacoes` pendente + vínculo mesmo sem sessão (confirmação de e-mail); backfill para usuários órgão órfãos; `signUpOrgao` detecta e-mail já cadastrado (`identities` vazio)
- **Arquivos:** `supabase/migrations/011_org_signup_trigger.sql`, `src/lib/auth.ts`, `src/pages/auth/RegisterOrgaoPage.tsx`
- **Ops:** aplicar migration `011` no SQL Editor do Supabase (MCP read-only); cadastro anterior pode ter falhado se e-mail já existia — não há 4º usuário em `auth.users`
- **Validação:** `npm run build` OK; após migration, novo cadastro órgão → aba Pendentes no admin

### 2026-07-09 — Fix — MFA admin: QR e fator duplicado
- **RF:** —
- **Entregas:** `prepareAdminMfaEnrollment` remove fator `unverified` antes de recriar; QR gerado via `otpauth://` (lib `qrcode`); aviso para escanear dentro do Google/Microsoft Authenticator (não câmera/Bloco de Notas); botão copiar chave manual
- **Arquivos:** `src/lib/mfa.ts`, `src/pages/admin/MfaPage.tsx`
- **Validação:** `npm run build` OK

### 2026-07-09 — Ops — Config Supabase admin (diagnóstico)
- **RF:** —
- **Entregas:** diagnóstico remoto — `fernandosilva.alvus+petidadmin@gmail.com` sem `role` em metadata; MFA não cadastrado; Auth Hooks **não necessários**
- **Ação manual:** definir `app_metadata.role = admin` no Supabase; URLs `localhost:5180`; primeiro login → `/admin/mfa/cadastrar`
- **Validação:** login admin → MFA → `/admin`

### 2026-07-09 — Fix — Login admin redirecionando de volta ao /login
- **RF:** —
- **Entregas:** `resolveRoleFromUser` lê `role` em `user_metadata` **ou** `app_metadata` (igual `is_platform_admin` no Postgres); `refreshUser` com `flushSync` evita corrida sessão→rota protegida; `ProtectedRoute` aguarda perfil quando há `session` sem `user`
- **Arquivos:** `src/lib/auth.ts`, `src/contexts/AuthContext.tsx`, `src/pages/auth/LoginPage.tsx`, `src/components/auth/ProtectedRoute.tsx`
- **Validação:** `npm run build` OK

### 2026-07-09 — Fix — Links criar conta / entrar na home
- **RF:** —
- **Entregas:** `/login` e `/cadastro/tutor` deixam de redirecionar silenciosamente quando há sessão ativa (só redireciona se veio de rota protegida); cadastro faz `signOut` antes do submit se necessário; links do header público visíveis em mobile
- **Arquivos:** `src/pages/auth/LoginPage.tsx`, `src/pages/auth/RegisterTutorPage.tsx`, `src/pages/auth/RegisterOrgaoPage.tsx`, `src/components/layouts/PublicLayout.tsx`
- **Validação:** `npm run build` OK

### 2026-07-09 — Fix — Cadastro sem autofill de login
- **RF:** —
- **Entregas:** formulários `/cadastro/tutor` e `/cadastro/organizacao` com `autoComplete="off"`, nomes de campo distintos e trava readonly até foco; login com `username`/`current-password` para separar do cadastro; usuário já autenticado redirecionado ao painel (não abre cadastro com sessão ativa)
- **Arquivos:** `src/lib/form-autofill.ts`, `src/pages/auth/RegisterTutorPage.tsx`, `src/pages/auth/RegisterOrgaoPage.tsx`, `src/pages/auth/LoginPage.tsx`
- **Validação:** `npm run build` OK

### 2026-07-09 — UX — Nav pública: novos rótulos e rotas
- **RF:** —
- **Entregas:** header público (`PublicLayout`) e home com “Encontrei um animal” → `/resgate`, “criar uma conta” → `/cadastro/tutor`, “entrar” → `/login`; link no rodapé do login alinhado
- **Arquivos:** `src/components/layouts/PublicLayout.tsx`, `src/pages/public/HomePage.tsx`, `src/pages/auth/LoginPage.tsx`
- **Validação:** `npm run build` OK

### 2026-07-09 — Fix — Login: remove aviso de sessão ativa
- **RF:** —
- **Entregas:** removido card “Você já está conectado…” com “Ir para meu painel” / “Sair e entrar com outra conta”; `/login` volta a redirecionar automaticamente quando já há sessão
- **Arquivos:** `src/pages/auth/LoginPage.tsx`
- **Validação:** `npm run build` OK

### 2026-07-09 — Fix — Login acessível com sessão ativa
- **RF:** —
- **Entregas:** ~~`/login` deixa de redirecionar silenciosamente quando o usuário já está logado; exibe aviso de sessão ativa com “Ir para meu painel” e “Sair e entrar com outra conta”~~ **revertido**; botões Entrar / Já tenho conta na home passam a abrir a tela de login
- **Arquivos:** `src/pages/auth/LoginPage.tsx`
- **Validação:** `npm run build` OK

### 2026-07-08 — DS-7 (refino) — Área admin (+ MFA)
- **RF:** —
- **Entregas:** dashboard com 3 módulos clicáveis (ícone + CTA →); `/admin/campos-pet` com breadcrumb e editor JSON limpo; `/admin/organizacoes` em tabela com filter pills, `Badge` de status e botões de ação coloridos + região expansível; `/admin/retencao` com card de prazo, toggle de agendamento, dry-run outline + aplicar primary com confirmação, histórico em tabela; MFA cadastrar/verificar com header PetID, ícone cadeado e input de código estilizado; chip “MFA verificado” no `AppLayout` admin
- **Arquivos:** `src/pages/admin/*`, `src/components/admin/AdminBreadcrumb.tsx`, `src/components/layouts/AppLayout.tsx`
- **Decisões:** lógica de aprovação, MFA, retenção e campos intacta; série DS-0…DS-7 concluída com refinos visuais
- **Validação:** `npm run build` OK

### 2026-07-08 — DS-6 (refino) — Área do órgão
- **RF:** RF-07 (UI)
- **Entregas:** telas aguardando/rejeitado com header PetID + Sair, ícone circular de status, chip da organização e card centralizado (ref. `petid-orgao-status.html`); dashboard com bloco org (ícone prédio + nome/tipo), seletor 7/30/90 em pills, aviso amarelo de região; `OrgaoIndicadores` com número grande + label + ícone lilás; `OrgaoAlertasList` em card com itens separados por borda e timestamp relativo; grid alertas + `RescueForm` reestilizado (DS-5)
- **Arquivos:** `src/pages/orgao/*`, `src/components/orgao/*`
- **Decisões:** `src/lib/orgao` e multi-tenant intactos; textos de negócio preservados
- **Validação:** `npm run build` OK

### 2026-07-08 — DS-5 (refino) — Rotas públicas críticas (QR + Resgate)
- **RF:** RF-03, RF-05 (UI)
- **Entregas:** `/qr/:payload` alinhado ao mock HTML — card único centralizado, foto circular, lista de características, consentimento com dois botões (primary/outline) sem checkbox; estados loading/erro/sucesso na paleta roxa; textos de `pagina_qr` preservados; `/resgate` com eyebrow, aviso “sem conta”, upload clicável com preview inline; `RescueForm` com nota de privacidade e container Turnstile estilizado; nav “Registrar resgate” ativa em `/resgate`
- **Arquivos:** `src/pages/public/QrReadPage.tsx`, `src/pages/public/RescueRegisterPage.tsx`, `src/components/resgate/RescueForm.tsx`, `src/components/layouts/PublicLayout.tsx`
- **Decisões:** consentimento QR simplificado para aceitar/recusar direto (sem etapa `consent` + checkbox); lógica `enviarLeitura`, rate limit, Turnstile e honeypot intactos
- **Validação:** `npm run build` OK

### 2026-07-08 — DS-7 — Área admin (+ MFA)
- **RF:** —
- **Entregas:** dashboard admin com 3 módulos em cards clicáveis; `/admin/campos-pet` editor JSON estilizado; `/admin/organizacoes` com `Badge` de status e botões de ação; `/admin/retencao` dry-run outline + aplicar primary com confirmação + histórico em tabela; MFA cadastrar/verificar com `Input` estilizado e fundo `brand-50`
- **Arquivos:** `src/pages/admin/*`
- **Decisões:** lógica de aprovação, MFA, retenção e configuração de campos intacta; série DS-0…DS-7 concluída
- **Validação:** `npm run build` OK

### 2026-07-08 — DS-6 — Área do órgão
- **RF:** RF-07 (UI)
- **Entregas:** telas aguardando/rejeitado com ícones e `Card` centralizado; dashboard com seletor de período em pills (7/30/90 dias); `OrgaoIndicadores` como cards de métrica com ícone circular lilás; `OrgaoAlertasList` como cards com ícone de alerta e timestamp relativo; aviso amarelo de região; `RescueForm` reutilizado no painel
- **Arquivos:** `src/pages/orgao/*`, `src/components/orgao/*`
- **Decisões:** lógica multi-tenant e `src/lib/orgao` intactos; textos e comportamento preservados
- **Validação:** `npm run build` OK

### 2026-07-08 — DS-5 — Rotas públicas críticas (QR + Resgate)
- **RF:** RF-03, RF-05 (UI)
- **Entregas:** `/qr/:payload` com layout confiável (logo pata, card do pet, consentimento com botões outline/primary distintos); estados loading/erro/sucesso na paleta roxa; textos de `configuracoes_sistema.pagina_qr` preservados; `/resgate` + `RescueForm` com `Input`/`Select`/`Textarea`/`Button`, upload com preview, container estilizado para Turnstile; honeypot e validações intactos
- **Arquivos:** `src/pages/public/QrReadPage.tsx`, `src/pages/public/RescueRegisterPage.tsx`, `src/components/resgate/RescueForm.tsx`
- **Decisões:** consentimento QR exibe os dois botões lado a lado (recusar/aceitar localização); aceitar permanece desabilitado até marcar checkbox — mesma lógica de `enviarLeitura`
- **Validação:** `npm run build` OK

### 2026-07-08 — DS-4 — Área do tutor (núcleo do produto)
- **RF:** RF-01, RF-02, RF-04, RF-06 (UI)
- **Entregas:** dashboard com `PetCard`, banner push amarelo, grid + card "Adicionar pet"; `PetForm`/`PetNewPage` com `Input`/`Select`/`Textarea` e upload estilizado; detalhe do pet + `QrCodeDisplay` (QR roxo); `LostOccurrenceForm`/`LostOccurrencePage`; `TutorMatchesPage` com fotos lado a lado e badge de compatibilidade
- **Arquivos:** `src/pages/tutor/*`, `src/components/pets/*`, `src/components/notificacoes/PushOptIn.tsx`, `src/components/ocorrencias/LostOccurrenceForm.tsx`, `src/components/ui/PawIcon.tsx`, `src/components/tutor/TutorBackLink.tsx`
- **Decisões:** lógica e textos de ação mantidos ("Confirmar reencontro", "Descartar"); badge de score no formato `N% de compatibilidade`; verde ≥70%, roxo abaixo; nenhuma alteração em `src/lib/`
- **Validação:** `npm run build` OK

### 2026-07-08 — DS-3 — AppLayout (header autenticado)
- **RF:** —
- **Entregas:** header `/tutor`, `/orgao`, `/admin` com logo PetID + subtítulo da área, e-mail à direita, `Button outline sm` para Sair; fundo `brand-50`; componente compartilhado `PetIdLogo`/`PetIdLogoMark` extraído e reutilizado no `PublicLayout`
- **Arquivos:** `src/components/layouts/AppLayout.tsx`, `src/components/ui/PetIdLogo.tsx`, `src/components/layouts/PublicLayout.tsx`
- **Decisões:** labels de área alinhados ao guia visual ("Painel do órgão", "Painel admin"); logout inalterado (`signOut()`)
- **Validação:** `npm run build` OK

### 2026-07-08 — DS-2 — Autenticação (Login + cadastros)
- **RF:** —
- **Entregas:** `/login`, `/cadastro/tutor`, `/cadastro/organizacao` reestilizados com `Card`, `Input`, `Select`, `Button`; `AuthForm` atualizado (links `brand-500`, erros discretos); componente `Select` adicionado ao design system; MFA step do login também migrado visualmente
- **Arquivos:** `src/pages/auth/*`, `src/components/auth/AuthForm.tsx`, `src/components/ui/Input.tsx`
- **Decisões:** campos, ordem, labels, textos e lógica de submit/auth inalterados; aviso de aprovação manual da org estilizado como notice amarelo (referência HTML)
- **Validação:** `npm run build` OK

### 2026-07-08 — DS-1 — PublicLayout + HomePage
- **RF:** —
- **Entregas:** header com logo PetID (pata em quadrado roxo gradiente), nav com hover `brand-500` e pill "Entrar"; HomePage com `Card`, `ButtonLink` (primary/outline), tipografia Sora/Manrope, fundo `brand-50`; `ButtonLink` adicionado ao design system para CTAs com roteamento
- **Arquivos:** `src/components/layouts/PublicLayout.tsx`, `src/pages/public/HomePage.tsx`, `src/components/ui/Button.tsx`
- **Decisões:** textos, links e rotas mantidos idênticos ao MVP; referência visual `petid-home.html`
- **Validação:** `npm run build` OK

### 2026-07-08 — DS-0 — Design System (tokens + componentes base)
- **RF:** —
- **Entregas:** tokens `brand-*` roxo (#6C4FE0) em `tailwind.config.js`; fontes Sora (display) + Manrope (sans) via Google Fonts; componentes base `Button`, `Input`, `Textarea`, `Card`, `Badge` em `src/components/ui/`; referência visual em `Design System.txt` (desktop)
- **Arquivos:** `tailwind.config.js`, `src/index.css`, `index.html`, `src/components/ui/*`
- **Decisões:** Tailwind v4 mantido com `@config` apontando para `tailwind.config.js`; tons intermediários `brand-200/300/700/800/900` derivados do guia visual para não quebrar classes existentes; páginas ainda **não** migradas para os novos componentes (próximos prompts)
- **Validação:** `npm run build` OK (tsc + vite)

### 2026-07-08 — Docs — Migrations 006–010 aplicadas no Supabase
- **RF:** —
- **Entregas:** sincronização de `PRD.md`, `README.md` e `memory.md` com estado real do banco remoto (`sqwywmevqqlxadknwppu`)
- **Decisões:** migrations 002–010 aplicadas via SQL Editor; 007 confirmada (RPCs painel órgão)
- **Pendências operacionais atualizadas:** deploy n8n/Edge, região das orgs, `ai_provider` fake→ollama, dry-run retenção, smoke tests feira

### 2026-07-08 — Revisão técnica — Performance, segurança e concorrência
- **RF:** RF-06, Art. 6 (retenção)
- **Entregas:** migration `010_review_perf_security.sql` — índices HNSW/GiST/parciais; `reclaim_stale_matching_jobs`; `executar_match_par` (matching O(n) com limite configurável); notificação atômica via `notificado_em`; retenção limpa `analise_visual`; fix `bytesToBase64` Edge; guard AbortController em `TutorMatchesPage`
- **Arquivos:** `supabase/migrations/010_review_perf_security.sql`, `supabase/functions/_shared/ai/providers.ts`, `src/pages/tutor/TutorMatchesPage.tsx`
- **Validação:** revisão estática; migration 010 aplicada no Supabase

### 2026-07-08 — Prompt 6 — Matching por IA (RF-06)
- **RF:** RF-06
- **Entregas:** outbox `matching_jobs` + triggers pós-INSERT; embedding em `animais`; RPCs claim/contexto/aplicar análise/matching PostGIS+pgvector/score v1/notify; Edge `analyze-pet` com AI Provider (`fake` + `ollama`); n8n `on_novo_resgate`; UI `/tutor/matches` confirmar/descartar
- **Arquivos:** `supabase/migrations/009_matching_ia_rf06.sql`, `supabase/functions/analyze-pet/`, `supabase/functions/_shared/ai/`, `n8n/workflows/on_novo_resgate.json`, `src/lib/matches.ts`, `src/pages/tutor/TutorMatchesPage.tsx`
- **Decisões:** Adapter desacoplado; default `active_provider=fake`; geo opcional com `require_geo_for_auto_notify`; reusa `enfileirar_notificacao_tutor`
- **Validação:** build frontend OK; migrations 009–010 aplicadas; deploy Edge + importar n8n; Ollama opcional

### 2026-07-08 — Docs — Arquitetura RF-06 (AI Provider + contrato)
- **RF:** RF-06 (desenho; código do pipeline ainda não)
- **Entregas:** arquitetura definida em `architecture.md` §4 — AI Provider (Adapter), contrato `PetVisualAnalysis`, fluxo assíncrono 9 passos, matching no Postgres, reuso da fila Prompt 7
- **Arquivos:** `docs/architecture.md`, `docs/memory.md`
- **Decisões:** Adapter obrigatório; n8n só orquestra; trocar modelo sem alterar regras de score/raio; embedding space versionado
- **Validação:** documentação apenas (sem implementação de código)

### 2026-07-08 — Prompt 9 — Job de retenção de dados
- **RF:** Art. 6.1 (constituição)
- **Entregas:** migration `008` com `executar_retencao_registros_sem_dono` (dry_run/aplicar), elegíveis sem match `confirmado_tutor`, `foto_url` nullable, auditoria `retencao_execucoes`, RPCs admin + painel `/admin/retencao`, flag `job_retencao.agendamento_ativo=false` (pg_cron no-op), workflow n8n `job_retencao_dados` (dry-run)
- **Arquivos:** `supabase/migrations/008_job_retencao_dados.sql`, `src/lib/retencao.ts`, `src/types/retencao.ts`, `src/pages/admin/AdminRetencaoPage.tsx`, `n8n/workflows/job_retencao_dados.json`
- **Decisões:** agendamento desligado por padrão até dry-run em staging; prazo só em `dias_retencao_sem_dono`
- **Validação:** build OK; migration 008 aplicada; dry-run em `/admin/retencao` antes de ligar agendamento

### 2026-07-08 — Prompt 8 — Painel de órgãos/ONGs
- **RF:** RF-07
- **Entregas:** RPC `obter_painel_organizacao` (indicadores + alertas regionais sem PII do tutor); admin `listar_organizacoes_admin`, `atualizar_status_organizacao`, `admin_definir_regiao_organizacao`; painel órgão com indicadores, alertas e `RescueForm`; página admin `/admin/organizacoes`
- **Arquivos:** `supabase/migrations/007_painel_orgaos.sql`, `src/lib/orgao.ts`, `src/types/orgao.ts`, `src/components/orgao/`, `src/pages/orgao/OrgaoDashboardPage.tsx`, `src/pages/admin/AdminOrganizacoesPage.tsx`
- **Decisões:** matching IA (Prompt 6) acionado depois; registro de resgate no painel usa mesmo pipeline do RF-05
- **Validação:** build OK; migration 007 aplicada no Supabase; definir região das orgs no admin

### 2026-07-08 — Prompt 7 — Notificações multicanal
- **RF:** RF-03 (envio real), RF-06 (infra para `match_sugerido` futuro)
- **Entregas:** fila `notificacoes.status=pendente`; RPCs `obter_contexto_notificacao_envio`, `confirmar_envio_notificacao`, `registrar_falha_notificacao`, `enfileirar_notificacao_tutor`; `push_subscriptions` + `salvar_push_subscription`; workflow n8n `enviar_notificacao`; Edge Function `send-push`; opt-in push no painel tutor
- **Arquivos:** `supabase/migrations/006_notificacoes_multicanal.sql`, `n8n/workflows/enviar_notificacao.json`, `n8n/README.md`, `supabase/functions/send-push/index.ts`, `src/lib/push.ts`, `src/components/notificacoes/PushOptIn.tsx`, `public/push-handler.js`
- **Decisões:** Prompt 6 adiado até fechar stack de IA; notificações enfileiram no Postgres e n8n envia por canal preferido com fallback e `custo_estimado` no WhatsApp
- **Validação:** build OK; migration 006 aplicada no Supabase; n8n/webhook/Z-API/Resend/VAPID configurar em deploy

### 2026-07-07 — Prompt 5 — Ocorrência perdido + registro resgate
- **RF:** RF-04, RF-05
- **Entregas:** tutor abre ocorrência (`abrir_ocorrencia_perdido`); resgate anônimo com CAPTCHA Turnstile + honeypot + rate limit; resgate autenticado (órgão/usuário); bucket `resgates`; campo `regiao_aproximada`
- **Arquivos:** `supabase/migrations/005_ocorrencias_resgate.sql`, `RescueForm.tsx`, `LostOccurrenceForm.tsx`, `RescueRegisterPage.tsx`, `LostOccurrencePage.tsx`, `lib/resgate.ts`, `lib/ocorrencias.ts`
- **Validação:** build OK; migration a aplicar no Supabase SQL Editor

### 2026-07-07 — Docs — Reorganização + PRD + memory automático
- **RF:** —
- **Entregas:** pasta `docs/`; `docs/PRD.md` consolidado; docx original em `docs/sources/`; regra `.cursor/rules/memory-log.mdc`; hook `stop` em `.cursor/hooks.json`
- **Arquivos:** `docs/PRD.md`, `docs/README.md`, `README.md`, `.cursorrules`, `.cursor/rules/memory-log.mdc`, `.cursor/hooks.json`
- **Validação:** estrutura de pastas e links verificados

### 2026-07-07 — Prompt 4 — Página pública leitura QR
- **RF:** RF-03
- **Entregas:** `leituras_qr`; RPCs `obter_pet_por_qr` e `registrar_leitura_qr`; rate limiting; `QrReadPage` com consentimento; notificação no banco
- **Arquivos:** `supabase/migrations/004_qr_read_public.sql`, `src/pages/public/QrReadPage.tsx`, `src/lib/qr-read.ts`
- **Decisões:** canal QR = página pública `/qr/{payload}`
- **Validação:** teste manual — leitura + consentimento + registros em `leituras_qr` e `notificacoes`

### 2026-07-06 — Prompt 3 — Cadastro pets + QR
- **RF:** RF-01, RF-02
- **Entregas:** formulário dinâmico de pet; upload foto Storage; geração QR; painel admin campos
- **Arquivos:** `supabase/migrations/003_pets_storage_and_config.sql`, `src/components/pets/`, `src/lib/pets.ts`
- **Validação:** cadastro de pets Toddynho / Toddynho 2

### 2026-07-06 — Prompts 0–2 — Fundação
- **RF:** —
- **Entregas:** PWA + rotas; `schema.sql` + migrations 002; auth tutor/órgão/admin + MFA + guards
- **Arquivos:** `supabase/schema.sql`, `supabase/migrations/002_auth_signup_rls.sql`, `src/contexts/AuthContext.tsx`, `src/components/auth/`
- **Validação:** login e cadastros funcionando

## Decisões tomadas

| Data | Decisão | Justificativa |
|---|---|---|
| 2026-07-06 | PWA responsiva em vez de app nativo no MVP | Prazo de 2 meses não comporta app nativo com qualidade; QR Code funciona via navegador |
| 2026-07-06 | **Supabase como banco definitivo** (Postgres + Auth + Storage + Edge Functions) | Decisão explícita do time; não considerar alternativas de banco. PostGIS + pgvector + RLS nativos. Projeto: `sqwywmevqqlxadknwppu` |
| 2026-07-06 | Schema inicial aplicado via `supabase/schema.sql` | 9 tabelas + RLS + configs seed; `spatial_ref_sys` (PostGIS) sem RLS é esperado |
| 2026-07-07 | Canal de acionamento do QR = **página pública** | WhatsApp direto fica como evolução/RF-08 |
| 2026-07-07 | RF-03 legado (Modelo A) validado | Migration `004`; fluxo de notificação direta por `/qr/{payload}` aposentado na UI em 15/jul |
| 2026-07-15 | Modelo B — QR genérico | Superado em 24/jul pelo Modelo Híbrido |
| 2026-07-24 | **Modelo Híbrido** — tag única (QR+NFC → `/pet/{payload}`) + `/resgate` sem tag | Perfil público; Confirmar Resgate + consentimento; nome completo do tutor sem contato |
| 2026-08-04 | WhatsApp direto **após** confirmar resgate na tag | CTA na tela final; telefone só em `registrar_leitura_qr` (não no perfil); mitiga exposição vs intermediação total |
| 2026-08-04 | Perfil do tutor com múltiplos telefones | `tutor_contatos` + principal espelhado em `tutores.telefone`; UI `/tutor/perfil` |
| 2026-08-04 | Resgate sem tag = fluxo de órgão/ONG | CTAs públicos removidos; `/resgate` legado |
| 2026-08-04 | Notificação da tag exige ocorrência aberta | Leitura auditada sempre; `notificado` só com `ocorrencias_perdido.status=aberta` |
| 2026-08-08 | `qr_payload` imutável após cadastro | Edição de pet não regenera QR/link; tag física permanece válida (trigger 021) |
| 2026-08-08 | Local da perda = cidade + bairro (sem rua) | Privacidade + base para alertas de comunidade |
| 2026-08-08 | Raio de matching interno (default 2km) | Tutor não escolhe na abertura; alertas por raio/bairro depois |
| 2026-07-07 | Documentação reorganizada em `docs/` | PRD consolidado em `docs/PRD.md`; fonte original em `docs/sources/` |
| 2026-07-07 | **memory.md atualizado automaticamente** via regra Cursor + hook `stop` | Rastreabilidade de cada prompt/entrega sem depender de memória do chat |
| 2026-07-08 | **Prompt 6 adiado** — ordem 7 → 8 → 9 → 6 enquanto decide stack de IA | QR + notificações reais não dependem de matching IA |
| 2026-07-08 | n8n workflow `enviar_notificacao` + Z-API/Resend/push | Fila em `notificacoes`; custo WhatsApp em `custo_estimado` (Art. 5.2) |
| 2026-07-08 | Job retenção com **dry-run + flag** `agendamento_ativo` | Não rodar às cegas em produção (security.md §7 / Prompt 9) |
| 2026-07-08 | **RF-06: AI Provider (Adapter) + contrato `PetVisualAnalysis`** | Trocar Ollama/OpenAI/Gemini sem alterar matching; n8n orquestra; score no Postgres (`architecture.md` §4) |
| 2026-07-08 | Prompt 6 implementado com provider **fake** default | Permite validar pipeline sem Ollama; trocar via `ai_provider.active_provider` |
| 2026-07-08 | **Migrations 006–010 aplicadas** no Supabase remoto | Inclui 007 (painel órgãos) e 010 (revisão perf/seg); aplicadas via SQL Editor |
| 2026-07-08 | **Identidade visual roxa** (brand #6C4FE0) substitui teal no MVP | Guia `Design System.txt` aprovado; reestilização incremental tela a tela (DS-1+) sem tocar em `src/lib/` nem backend |

## Gaps de produto (decidir depois)

| Item | PRD/RF | Situação atual | Decisão pendente |
|------|--------|----------------|------------------|
| Ownership de `/resgate` (“Encontrei um animal”) | RF-05 | ✅ área `/orgao`; home/nav sem CTA; `/resgate` legado | — |
| Notificação QR só com ocorrência aberta | RF-03, RF-04 | ✅ migration `016` (aplicar no SQL Editor) | — |
| QR co-branded (logo patrocinador) | RF-02 | QR genérico `/resgate` funciona; sem overlay de marca | Incluir no MVP da feira ou pós-lançamento? |
| ~~Múltiplas fotos por pet~~ | RF-01 | ~~Apenas 1 foto~~ → `animal_fotos` 1–4 (018) | ✅ 2026-08-08 |
| Monetização / assinatura | PRD §6 | Não implementado | Freemium antes da feira ou depois? |

## Correções UX em lote (ago/2026)

> Fonte: [`PROMPTS_CORRECOES.md`](PROMPTS_CORRECOES.md). **Lote 1–4 implementado em 2026-08-04.**

| # | Título | Status |
|---|--------|--------|
| 1 | Login split + “Encontrei um animal” só na área órgão | ✅ |
| 2 | Mover “Encontrei um animal” (sem tag) para área ONGs/Prefeitura | ✅ |
| 3 | Tela de perfil do tutor (multi-telefones + principal) | ✅ |
| 4 | Abrir ocorrência com mapa + notificação QR só com ocorrência aberta | ✅ |

## Pendências operacionais (pós-migrations — feira ago/2026)

1. **Deploy infra:** Edge `analyze-pet` + `send-push`; workflows n8n; webhook `notificacoes` → n8n; credenciais Z-API/Resend/VAPID.
2. **Config produção:** `ai_provider.active_provider` fake → ollama; Turnstile chaves reais; definir **região de atuação** das orgs em `/admin/organizacoes`; **usuário admin** `fernandosilva.alvus+petidadmin@gmail.com` precisa de `role: admin` em `app_metadata` (ver changelog 2026-07-09 config admin); ~~aplicar migrations `013`–`016`~~ **014–016 aplicadas** (2026-08-04); aplicar `020`–`027` se ainda pendentes (chat, ocorrência enriquecida, endereços tutor/mapa, leitura com endereço)
3. **Validação staging:** dry-run retenção (`/admin/retencao`); smoke test resgate → match → notificação; testes automatizados (Art. 7.1).
4. **LGPD:** fluxo de exclusão de conta (security.md §1) — não implementado.
5. **Deploy frontend** Vercel + domínio.

## Pendências que bloqueiam decisões de negócio

1. ~~**Canal de acionamento do QR Code**~~ → **resolvido:** página própria (jul/2026).
2. ~~**Prazo exato de retenção de dados**~~ → configurável em `dias_retencao_sem_dono` (ref. 30 dias); confirmar valor final se != 30.
3. **Modelo de precificação final** (assinatura, licença por órgão, patrocínio de QR Code).
4. **Enquadramento de custo do WhatsApp Business** (utilidade pública / isenção na janela de 24h).
5. ~~Modelo concreto MVP do Adapter~~ → `FakeAiProvider` + `OllamaProvider`; **validar qualidade Ollama em staging** antes da feira.
6. ~~**Aplicar migrations no Supabase** (006–010)~~ → **resolvido** (jul/2026); falta deploy Edge/n8n.
7. ~~**Implementar código RF-06**~~ → concluído no repo e banco.

## Riscos monitorados (do PRD original)

- Baixa barreira técnica de entrada — necessário registrar/patentear a solução antes de exposição pública ampla.
- Alcance ao público indireto (quem encontra um animal e não conhece a plataforma) depende fortemente de divulgação/parcerias — fora do escopo técnico, mas afeta a métrica de taxa de reencontro.
- Custo de mensageria WhatsApp cresce com volume — monitorar desde o MVP (ver `notificacoes.custo_estimado` em `database.md`).

## Convenção de atualização deste arquivo

Ao tomar uma decisão que:
- **muda um artigo da constituição** → registrar aqui a justificativa antes de implementar.
- **resolve uma pendência da lista acima** → mover para "Decisões tomadas" com data.
- **contraria algo do PRD original** → registrar o motivo explicitamente (o PRD é ponto de partida, não camisa de força, mas divergências precisam ser rastreáveis).
- **conclui um Prompt ou entrega de código** → atualizar tabela "Progresso" + adicionar entrada no "Changelog" (formato em `.cursor/rules/memory-log.mdc`).
