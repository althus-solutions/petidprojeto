# Security — Plataforma de Reencontro de Animais Perdidos

> Detalha operacionalmente os Artigos 1 e 2 da `constitution.md`. Consultar antes de implementar qualquer fluxo que toque dado pessoal, foto ou localização.

## 1. LGPD — pontos práticos

- **Base legal por dado**: contato do tutor (execução de serviço/consentimento), localização de resgate (consentimento explícito), fotos (consentimento explícito, com finalidade declarada de matching).
- **Direito de exclusão**: implementar um único endpoint/fluxo admin que, dado um `tutor_id` ou `user_id`, remove/anonimiza em cascata: tutor, animais, ocorrências, notificações associadas. Não é aceitável exclusão parcial manual tabela por tabela.
- **Menores de idade**: se o cadastro identificar tutor menor de 18 anos, sinalizar para revisão manual antes de habilitar recursos que envolvam contato público (ex.: WhatsApp exposto).
- **Registro de consentimento**: cada consentimento (localização, foto) deve gravar timestamp e contexto (não apenas um booleano solto) — em caso de auditoria, é preciso provar quando e para quê o consentimento foi dado.

## 2. Autenticação e autorização

| Perfil | Método | Observação |
|---|---|---|
| Tutor | Supabase Auth (e-mail/senha ou OTP) | Padrão |
| Pessoa anônima (resgate) | Sem conta, token de sessão temporário | Nunca vincular a um `user_id` real sem consentimento |
| Órgão/ONG | Supabase Auth + aprovação manual de admin | Nunca self-service automático — mitiga fraude de "órgão falso" |
| Admin da plataforma | Supabase Auth com papel `admin`, MFA obrigatório | Acesso a dados de todos os tenants |

## 3. Proteção de endpoints públicos

- Rate limiting em: leitura/confirmação de resgate na tag (`/pet/{payload}`), submissão de registro de resgate sem tag (`/resgate`), formulário de contato.
- Página pública do pet (`/pet/{payload}`): exibe **nome completo do tutor**; **não** expõe telefone/e-mail no perfil nem em `obter_pet_por_qr`.
- **Exceção pós-confirmação (RF-03, 2026-08-04):** após `registrar_leitura_qr` bem-sucedido, a API pode devolver `tutor_telefone_whatsapp` (E.164) **somente** para o CTA “Conversar diretamente com o tutor” (WhatsApp). Rate limit da leitura mitiga scraping.
- CAPTCHA ou equivalente leve no formulário de registro de resgate anônimo (vetor comum de spam/abuso).
- E-mail do tutor permanece intermediado pela plataforma — nunca na página pública.

## 4. Segredos e infraestrutura

- Tokens do WhatsApp Business, chaves do Supabase (service role), credenciais do Ollama/n8n: apenas em variáveis de ambiente, nunca commitados.
- `.gitignore` reforçado desde o primeiro commit do repositório (mesmo padrão já usado no projeto CIWEB/roboexcelencia).
- Separar chave `service_role` (uso apenas em Edge Functions/backend) de chave `anon` (uso no client) — nunca usar `service_role` no frontend.

## 5. Auditoria

Tabela de log mínima para ações sensíveis:
```
auditoria(id, user_id, acao, entidade, entidade_id, detalhes jsonb, created_at)
```
Ações que exigem registro: aprovação/rejeição de organização, exclusão de conta, alteração de parâmetro de matching (`configuracoes_sistema`), acesso admin a dados de outro tenant.

## 6. Segurança específica de IA/matching

- Fotos enviadas para o Ollama trafegam apenas dentro da rede interna (n8n → Ollama), nunca expostas por URL pública sem assinatura/expiração.
- Embeddings gerados não devem ser tratados como "anônimos por natureza" — ainda estão vinculados a um registro de resgate/foto e seguem a mesma política de retenção (Art. 6 da constituição).

## 7. Checklist rápido antes de qualquer deploy em produção

- [ ] RLS ativado e testado em todas as tabelas novas
- [ ] Nenhum secret hardcoded ou em log
- [ ] Consentimento registrado com timestamp para toda captura de localização/foto
- [ ] Rate limiting ativo nos endpoints públicos
- [x] Job de retenção com dry-run admin + flag `agendamento_ativo` (Prompt 9; ligar só após staging)
- [ ] Fluxo de exclusão de conta testado ponta a ponta
