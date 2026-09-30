require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const settings = await prisma.settings.findFirst() || { systemName: "CG Construções HelpDesk" };

  await prisma.emailTemplate.upsert({
    where: { code: 'TICKET_CREATED' },
    update: {},
    create: {
      code: 'TICKET_CREATED',
      name: 'Abertura de Chamado',
      subject: `Chamado #{{ticketNumber}} aberto — {{systemName}}`,
      bodyHtml: `
<p style="margin-top: 0;">Olá, <strong>{{requesterName}}</strong>.</p>
<p>Recebemos sua solicitação e ela foi registrada com sucesso em nossa Central de Suporte de TI.</p>

<div style="border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; margin: 32px 0;" class="ticket-card">
  <div style="background-color: #f8fafc; padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 11px; font-weight: 700; color: #64748b; letter-spacing: 0.5px; text-transform: uppercase;" class="ticket-header">
    Detalhes do Atendimento
  </div>
  <div style="padding: 16px;">
    <div style="margin-bottom: 16px;">
      <div style="font-size: 12px; color: #64748b; margin-bottom: 2px;" class="ticket-label">Chamado</div>
      <div style="font-size: 16px; font-weight: 700; color: #0f172a;" class="ticket-value">#{{ticketNumber}}</div>
    </div>
    <div style="margin-bottom: 16px;">
      <div style="font-size: 12px; color: #64748b; margin-bottom: 2px;" class="ticket-label">Solicitação</div>
      <div style="font-size: 15px; color: #334155;" class="ticket-value">{{problem}}</div>
    </div>
    <div>
      <div style="font-size: 12px; color: #64748b; margin-bottom: 2px;" class="ticket-label">Data de abertura</div>
      <div style="font-size: 14px; color: #334155;" class="ticket-value">{{date}}</div>
    </div>
  </div>
</div>

<div style="display: flex; align-items: center; margin-bottom: 24px; color: #16a34a; font-weight: 600; font-size: 14px;">
  <span style="display: inline-block; margin-right: 8px;">✓</span> Solicitação recebida
</div>

<p>Nossa equipe técnica já recebeu sua solicitação e realizará a análise necessária para dar continuidade ao atendimento.</p>
<p>Você receberá novas notificações sempre que houver uma atualização relevante em sua solicitação.</p>
      `,
      showPriority: true,
      showStatus: true,
      primaryColor: '#2563eb'
    }
  });

  await prisma.emailTemplate.upsert({
    where: { code: 'TICKET_RESOLVED' },
    update: {},
    create: {
      code: 'TICKET_RESOLVED',
      name: 'Conclusão de Chamado',
      subject: `Chamado #{{ticketNumber}} resolvido — {{systemName}}`,
      bodyHtml: `
<p style="margin-top: 0;">Olá, <strong>{{requesterName}}</strong>!</p>
<p>Temos uma ótima notícia: o seu chamado foi <strong>resolvido</strong>!</p>

<div style="margin-top: 25px; background-color: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0; padding: 16px;">
  <p style="margin-top: 0; font-size: 14px; color: #333333; line-height: 1.6;">
    <strong>Chamado:</strong> #{{ticketNumber}}<br>
    <strong>Solução:</strong> {{solution}}
  </p>
</div>

<p style="margin-top: 25px;">Se precisar de mais alguma coisa, não hesite em abrir um novo chamado.</p>
      `,
      showPriority: true,
      showStatus: true,
      primaryColor: '#16a34a'
    }
  });

  console.log('Templates populados com sucesso!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
