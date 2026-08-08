# Constitution — Plataforma de Reencontro de Animais Perdidos

> Este documento define os princípios **não-negociáveis** do projeto. Toda spec, plano, tarefa ou linha de código gerada por IA (Cursor, Spec Kit, etc.) deve respeitar estas regras. Em caso de conflito entre um pedido pontual e esta constituição, a constituição vence.

Versão: 1.0 · Baseado no PRD v1.0 (reunião 08/06/2026 — Nathan Silva e Samuel Souza)

---

## Artigo 1 — Privacidade e Consentimento em Primeiro Lugar

1.1. Nenhum dado de localização, foto ou contato pode ser compartilhado entre partes (tutor ↔ quem encontrou ↔ órgão) sem consentimento explícito e registrado no momento da ação.

1.2. Toda coleta de geolocalização (foto de animal resgatado, ocorrência de perdido) deve ter opção de recusa, e a ausência de consentimento não pode bloquear o cadastro básico do registro.

1.3. Registro de "quem encontrou" deve suportar modo **anônimo real** — sem exigir nome, e-mail ou telefone, salvo região/porte/características do animal.

1.4. Tratamos este sistema como sujeito à **LGPD** (Lei 13.709/2018) desde o dia 1, não como algo a ser adicionado depois:
   - Base legal documentada para cada tipo de dado coletado.
   - Direito de exclusão (esquecimento) implementável via um único fluxo, não gambiarra manual.
   - Dados de menores de idade (ex.: tutor jovem) tratados com cautela adicional se identificados.

1.5. Dados de localização de foto (EXIF/GPS) só podem ser extraídos e persistidos mediante autorização explícita do usuário no momento do upload — nunca silenciosamente.

## Artigo 2 — Segurança por Padrão

2.1. Autenticação obrigatória e diferenciada por perfil: tutor, pessoa anônima (sem conta), órgão/ONG (conta corporativa com aprovação manual de cadastro).

2.2. Toda tabela de dados sensíveis (contatos, localização, fotos vinculadas a pessoas) usa **Row Level Security (RLS)** no banco — nunca controle de acesso feito apenas na camada de aplicação.

2.3. Segredos (chaves de API, tokens do WhatsApp Business, credenciais de banco) nunca em código-fonte ou repositório — sempre em variáveis de ambiente/vault, seguindo o mesmo padrão já usado em outros projetos (`.env` + `.gitignore` reforçado).

2.4. Endpoints públicos (leitura de QR Code, formulário de "encontrei um animal") são o maior vetor de abuso — exigem rate limiting e proteção anti-spam/anti-bot desde o MVP, não depois de um incidente.

2.5. Toda ação destrutiva ou sensível (exclusão de cadastro, aprovação de novo órgão parceiro, mudança de plano) precisa de log de auditoria com autor, timestamp e ação.

## Artigo 3 — Arquitetura para Escala Gradual

3.1. O MVP é regional e enxuto, mas nenhuma decisão de dia 1 pode impedir crescimento nacional/multi-região sem reescrita completa. Concretamente:
   - Geolocalização e busca por raio devem usar extensão espacial nativa do banco (ex.: PostGIS), não cálculo de distância em memória na aplicação.
   - Estrutura de dados de "órgão/ONG" já nasce multi-tenant (cada entidade isolada por `organizacao_id`), mesmo com poucos tenants no MVP.

3.2. Matching por IA deve ser desacoplado do fluxo síncrono de cadastro — processamento assíncrono (fila) desde o início, para não travar UX quando o volume crescer.

3.3. Custo operacional (mensageria WhatsApp, inferência de IA) deve ser mensurável por unidade (por mensagem, por match processado) desde o MVP, permitindo decisão de precificação futura com dados reais.

## Artigo 4 — IA como Auxiliar, Não Autoridade Única

4.1. O matching por IA gera **sugestões com score de confiança**, nunca reencontro automático sem confirmação humana das duas partes (tutor e quem encontrou/órgão).

4.2. Abaixo de um limiar de confiança configurável (referência inicial do PRD: 75%), o sistema não notifica como "match provável" — evita alarme falso e frustração do tutor.

4.3. Todo modelo de IA usado (classificação de características do animal, comparação de imagem) deve ter fallback manual: um humano (tutor, ONG) sempre pode buscar e comparar manualmente, o sistema não pode ser o único caminho.

## Artigo 5 — Multicanal e Custo Controlado

5.1. Notificação é multicanal por padrão (WhatsApp, e-mail, push), mas o canal preferencial é configurável por usuário/entidade — nunca hardcoded para um único canal.

5.2. Toda integração com WhatsApp Business Oficial deve monitorar e logar custo por mensagem, com alertas de orçamento — consistente com o padrão de controle de custo de mensageria já usado em outros projetos da Kainon.

## Artigo 6 — Retenção e Minimização de Dados

6.1. Registros de animal resgatado sem identificação de dono têm prazo de retenção definido (referência inicial do PRD: 30 dias) após o qual dados pessoais associados são anonimizados ou excluídos — o prazo exato é parâmetro de configuração, não constante fixa no código.

6.2. Fotos usadas para matching de IA podem ser processadas para gerar embeddings/características, mas a foto original só é retida pelo tempo necessário ao processo de reencontro.

## Artigo 7 — Testes e Qualidade Antes de Deploy

7.1. Fluxos críticos (matching de IA, autenticação, notificação de reencontro, consentimento de compartilhamento) exigem teste automatizado antes de qualquer deploy em produção — não é opcional mesmo sob pressão de prazo (lançamento na feira pet).

7.2. Qualquer alteração em regra de negócio de matching (raio geográfico, score mínimo) deve ser versionada e documentada, nunca alterada silenciosamente em produção.

## Artigo 8 — Documentação Viva

8.1. `docs/spec.md`, `docs/plan.md` e `docs/database.md` são atualizados sempre que uma decisão de arquitetura muda — o código nunca deve divergir silenciosamente da documentação.

8.2. Toda decisão que contraria um artigo desta constituição precisa de justificativa explícita registrada em `docs/memory.md`, não apenas implementada.

---

*Esta constituição pode e deve evoluir, mas mudanças em artigos de segurança (2) e privacidade (1) exigem revisão explícita antes de merge.*
