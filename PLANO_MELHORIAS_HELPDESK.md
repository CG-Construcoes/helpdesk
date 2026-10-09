# PLANO DE MELHORIAS - HELPDESK PRO

## Diagnóstico

### P0 — CRÍTICO (Segurança e Confiabilidade)

**1. IDOR (Insecure Direct Object Reference) em Rotas de Chamados (GET, PUT, DELETE e Comments)**
- **Arquivo(s):** `app/api/tickets/[id]/route.ts`, `app/api/tickets/[id]/comments/route.ts`, `app/api/tickets/[id]/history/route.ts`
- **Problema:** Um usuário do tipo `SOLICITANTE` que consiga adivinhar ou obter o ID (UUID) de um chamado de outra pessoa consegue visualizá-lo, editá-lo ou inserir comentários, pois as APIs apenas verificam a string de permissão (`chamados.read`, `chamados.update`) sem validar a posse do recurso (row-level authorization).
- **Risco:** Alto. Vazamento de dados confidenciais e manipulação indevida de informações de chamados de terceiros.
- **Solução Recomendada:** Adicionar verificações em nível de registro nas rotas e services, garantindo que se o usuário for um `SOLICITANTE`, ele só poderá acessar o chamado se o `requester.email` for o dele (ou seu `userId`).

**2. Segredo JWT Hardcoded (Fallback Inseguro)**
- **Arquivo(s):** `lib/auth.ts`, `proxy.ts`
- **Problema:** O código utiliza o valor `"helpdesk_pro_secret_key_cg_construcoes_2026_super_secure"` caso a variável de ambiente `JWT_SECRET` não exista.
- **Risco:** Crítico. Se a variável não for definida em produção, qualquer invasor com acesso ao código fonte (ou que adivinhe o fallback) pode forjar um cookie de sessão como `ADMIN`.
- **Solução Recomendada:** Lançar uma exceção ou falhar catastroficamente (fail-close) na inicialização se `JWT_SECRET` não for fornecida. Se houver fallback temporário para dev, bloqueá-lo estritamente no ambiente de produção (`NODE_ENV === "production"`).

**3. Condição de Corrida (Race Condition) no Processamento de Emails**
- **Arquivo(s):** `app/api/email/check/route.ts`, `services/email/email-processor.service.ts`
- **Problema:** A rota de verificação de emails pode ser chamada simultaneamente. O bloqueio `client.getMailboxLock('INBOX')` afeta apenas operações IMAP, não o banco. Múltiplos processos podem buscar as mesmas mensagens não lidas e tentar criar tickets, gerando chamados duplicados e possivelmente falhando no `prisma.processedEmail.create` por violação de Unique Constraint do `messageId`.
- **Risco:** Alto. Chamados duplicados geram ruído e poluem as estatísticas.
- **Solução Recomendada:** Registrar o `messageId` com status temporário (ex: `PROCESSING`) *antes* de tentar criar o ticket. Se ocorrer um erro de violação de chave única neste momento, abortar, pois outro processo já pegou este e-mail.

### P1 — ALTA PRIORIDADE

**4. Otimizações da Query de Tickets**
- **Arquivo(s):** `services/ticket/query-tickets.service.ts`
- **Problema:** Embora otimizada, a recuperação de chamados com `getTicketById` traz todas as relações (historico, comentarios, requester, tech, etc) independentemente do caso de uso.
- **Solução:** Filtrar o que é retornado conforme a necessidade, mas para essa auditoria priorizaremos o vazamento de dados de IDOR.

### P2 — DESEMPENHO

**5. Uso Indiscriminado de Promise.all Sem Necessidade em Alguns Fluxos**
- **Arquivo(s):** Onde aplicável na dashboard.
- **Solução:** Validaremos as rotas da dashboard.

---

## Estratégia de Execução

**Fase 1 — Segurança Crítica (P0)**
1. Corrigir o fallback do `JWT_SECRET` em `proxy.ts` e `lib/auth.ts` para proibir fallback em produção.
2. Adicionar autorização row-level em `app/api/tickets/[id]/route.ts` para bloquear leitura, atualização e deleção caso o solicitante tente acessar um chamado de terceiros.
3. Adicionar a mesma validação em `app/api/tickets/[id]/comments/route.ts`, `/attachments/route.ts`, e `/history/route.ts`.
4. Mitigar race condition do IMAP alterando `services/email/email-processor.service.ts` para tentar inserir no `ProcessedEmail` ANTES de criar o ticket.

**Fase 2 — Testes e Qualidade (P3)**
1. Escrever/rodar testes para validação do JWT.
2. Validar que chamados bloqueados via API retornem `403 Forbidden`.
