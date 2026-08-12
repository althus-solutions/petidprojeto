# Spec — Plataforma de Reencontro de Animais Perdidos (MVP v1.0)

> Fonte: PRD v1.0 (reunião 08/06/2026). Este documento descreve **o quê** o sistema deve fazer, sem amarrar em stack específica — a stack fica em `plan.md`.

## 1. Objetivo do MVP

Permitir que um tutor cadastre seu animal com **identificação única** (QR + link NFC), e que o reencontro aconteça por **dois caminhos**:

1. **Com tag** — leitura do QR/NFC abre a página pública do animal → termos → Confirmar Resgate → modal de localização → notifica o tutor + chat  
2. **Sem tag** — site `/resgate` → formulário + matching por IA → notifica o tutor se houver score suficiente  

Pronto para uso na feira pet de 12–14 de agosto de 2026.

> **Modelo Híbrido (decisão 24/jul/2026):** tag única por animal + página pública do pet; animais sem identificação seguem o fluxo genérico `/resgate` + matching. Substitui o Modelo B puro (QR só genérico).

## 2. Perfis de usuário

| Perfil | Autenticação | Capacidades |
|---|---|---|
| Tutor | Conta própria | Cadastra pets, gera QR + link NFC únicos, abre ocorrência de perda, gerencia assinatura |
| Pessoa que encontra | Anônimo ou conta leve | Lê QR/NFC do pet **ou** registra resgate sem tag em `/resgate` |
| Órgão/ONG | Conta corporativa aprovada | Registra resgates, recebe alertas regionais, visualiza painel |

## 3. Requisitos funcionais

### RF-01 — Cadastro de tutor e pets
- **Dado que** um visitante cria conta como tutor, **quando** preenche dados de contato, **então** o sistema cria o perfil e libera cadastro de pets.
- Tutor pode cadastrar múltiplos pets ("Packs"), cada um com: nome, espécie, sexo, idade (opcional), castrado (opcional), raça, porte, cores (multi-select), padrão de pelagem, peso, características, **1 foto** (`animal_fotos` / capa) e consentimento LGPD registrado (`consentimento_fotos_em`).
- Campos do formulário de pet devem ser configuráveis por um painel de administração (sem deploy de código para adicionar campo novo).
- **Perfil do tutor** (`/tutor/perfil`, separado do cadastro de pet): editar nome, canal preferido de notificação e **múltiplos telefones**; marcar exatamente um como **principal** (notificações WhatsApp e CTA pós-resgate na tag).

### RF-02 — Geração de QR Code + link NFC (único por animal)
- **Dado que** um pet é cadastrado, **quando** o tutor acessa o detalhe do pet, **então** o sistema gera identificação única (`qr_payload`) e exibe:
  1. **QR Code** (imagem) apontando para a página pública do animal (`/pet/{payload}`)
  2. **URL** do mesmo destino, para gravação em **NFC**
- QR e NFC compartilham a **mesma URL** — não há destino diferente.
- Deve suportar variante co-branded (logo de patrocinador) sem alterar a URL/payload.
- Leitura não exige app — abre página web pública; WhatsApp direto fica como evolução (RF-08).

### RF-03 — Página pública do animal (tag QR/NFC)
- **Dado que** alguém lê o QR ou aproxima o NFC, **quando** a página `/pet/{payload}` carrega, **então** o sistema exibe o “perfil público” do animal:
  - foto, nome e dados públicos do pet
  - indicação de que possui tutor + **nome completo do tutor**
  - no perfil: **não** exibir telefone, e-mail ou WhatsApp (contato direto só após confirmação)
- Ação principal: botão **Confirmar Resgate**, habilitado somente após checkbox de aceite dos **termos**.
- Ao confirmar, abre **modal** pedindo localização (compartilhar ou continuar sem). GPS só grava pin se as coordenadas forem obtidas de fato.
- Após a escolha no modal: registra a leitura, notifica o tutor (se ocorrência aberta), abre conversa no chat e navega o finder para `/pet/{payload}/chat`.
- **Gatilho de notificação:** o tutor **só é notificado** (e o WhatsApp só é liberado) se existir ocorrência de perda com status **`aberta`**. Sem ocorrência aberta, a leitura ainda é gravada (auditoria), mas `notificado=false`.
- WhatsApp (`wa.me` com telefone principal) permanece opcional na tela de confirmação/fallback. Telefone não vem de `obter_pet_por_qr`.
- Rate limiting no endpoint público de registro da leitura.
- Sem texto “animal sem coleira” nesta tela.

### RF-04 — Ocorrência de animal perdido
- Tutor pode abrir uma ocorrência informando data, local e características do animal perdido, incluindo casos retroativos.
- Tela agregada `/tutor/ocorrencias`: **mapa** (ponto da perda + último ponto da tag se localizado) e **galeria/lista** das ocorrências abertas (com foto). Ao abrir, a ocorrência aparece nessa lista.
- Abrir ocorrência é o **gatilho** que habilita notificações quando a tag é lida (RF-03).
- Ocorrência fica em estado "aberta" até reencontro confirmado ou expiração por retenção (ver `constitution.md` Art. 6).

### RF-05 — Registro de animal resgatado/encontrado (sem tag)
- Entrada principal: área autenticada de **órgão/ONG/prefeitura** (`/orgao`) — botão **Encontrei um animal** abre `/orgao/encontrei` (formulário completo).
- Tutor **não** usa esse fluxo; CTAs públicos na home/nav foram removidos.
- Rota `/resgate` permanece apenas como legado/deep-link (sem destaque na home).
- Localização só com autorização explícita (Art. 1). Matching (RF-06) pode notificar tutores com ocorrências abertas compatíveis.

### RF-06 — Matching por Inteligência Artificial
- Pipeline assíncrono (não bloqueia upload): outbox `matching_jobs` → Edge `analyze-pet` (AI Provider) → RPC matching.
- Extrai da foto: espécie, raça, porte, cores, idade, sexo, embedding (`PetVisualAnalysis`).
- Cruza resgates × ocorrências abertas (PostGIS + pgvector + score `1.0`).
- Acima do limiar: notifica tutor (`match_sugerido`); UI `/tutor/matches` para confirmar/descartar.
- Abaixo do limiar: permanece em `matches` para busca manual.

### RF-07 — Acesso para órgãos públicos e ONGs
- Login dedicado por entidade (prefeitura, PM, bombeiros, CCZ, ONG, clínica veterinária).
- Cadastro de nova entidade exige aprovação (não é self-service livre).
- Entidade recebe alerta de animais perdidos/resgatados na sua região de atuação.
- Entidade registra resgate sem tag via **Encontrei um animal** no painel (`/orgao`).
- Painel com indicadores: nº de animais perdidos/resgatados por região/período.
- Entidade pode registrar resgate diretamente, disparando o mesmo fluxo de matching do RF-06.
- Inventário próprio em `/orgao/animais` (`animais_organizacao`) — resgates e cadastros manuais, com microchip opcional.
- **Prefeitura** (`organizacoes.tipo = prefeitura`): mesma conta `orgao`, porém leitura consolidada do inventário de **todas** as organizações aprovadas (exceção documentada ao isolamento multi-tenant).
- Pós-lançamento (backlog): pré-checagem de duplicidade avançada; gestão de rede de protetores/voluntários.

### RF-08 — Integração WhatsApp Oficial (a validar)
- Pessoa que encontrou pode enviar foto diretamente pelo WhatsApp oficial da plataforma.
- Foto recebida entra no mesmo pipeline de RF-05/RF-06.
- Custo por mensagem deve ser monitorado (Art. 5 da constituição); avaliar enquadramento de utilidade pública / janela gratuita de 24h.

### RF-09 — Fora do escopo do MVP (não implementar agora)
- Comunidade social completa dentro da plataforma.
- Programa de recompensa e "caçadores de recompensa".
- Geração automática de arte de divulgação.
- Integração com planos de saúde pet.
- Coleira eletrônica / hardware avançado.

### RF-10 — Adoção (parceria TeleCão) — tutor autenticado
- Aba **Adoção** no painel do tutor (`/tutor/adocao`): galeria de animais disponíveis + filtros laterais.
- Tutor pode **cadastrar** animal para adoção (formulário completo) ou **referenciar pet já cadastrado** (`animal_id`).
- Identidade visual da parceria **TeleCão** (laranja) apenas nesta área; restante do app permanece MyPetID.
- Detalhe do anúncio com botão **Tenho interesse** → registra interesse e notifica o responsável (`interesse_adocao` na fila de notificações).
- Consentimentos LGPD / termo de adoção com timestamp + contexto JSONB.
- Fora deste RF (backlog): listagem pública sem login, painel órgão, moderação admin, chat dedicado de adoção.

## 4. Requisitos não-funcionais (resumo — detalhe em `constitution.md` e `security.md`)

- Privacidade e consentimento explícito em qualquer compartilhamento de localização/dados.
- QR Code deve funcionar sem fricção (sem download de app).
- Banco preparado para centenas de registros/mês por região, com trajetória para volume nacional.
- Notificações multicanal configuráveis.
- Custo de mensageria monitorado por unidade.

## 5. Métricas de sucesso do MVP

| Métrica | Meta de referência |
|---|---|
| Animais cadastrados | Crescimento mensal consistente |
| Resgates registrados | Mín. 200/mês (estimativa ONG) |
| Taxa de reencontro | A definir após baseline |
| Tempo médio de reencontro | Reduzir continuamente |
| Assinantes pagantes | Referência: 10.000 usuários a R$ 5–10/mês |

## 6. Pontos em aberto

1. ~~Canal de acionamento do QR Code~~ — **decidido (jul/2026):** página pública.
2. ~~Modelo do QR~~ — **decidido (24/jul/2026):** **Modelo Híbrido** — tag única (`/pet/{payload}`) + `/resgate` sem tag. (Substitui Modelo B de 15/jul.)
3. Prazo exato de retenção de dados de animal sem dono identificado (referência: 30 dias em `dias_retencao_sem_dono`).
4. Modelo de precificação final (assinatura, licença por órgão, patrocínio de QR).
5. Enquadramento de custo/isenção de mensageria WhatsApp como utilidade pública.
