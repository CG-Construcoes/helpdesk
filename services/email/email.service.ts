import sgMail from '@sendgrid/mail';
import { getCorporateSettings } from "@/services/settings/settings.service";
import { prisma } from "@/lib/prisma";

// Set the API key if available
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

/**
 * Base email layout to inject content into, styled according to the corporate settings.
 */
function getEmailLayout(settings: any, title: string, content: string): string {
  const primaryColor = settings.primaryColor || '#2563eb';
  
  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="color-scheme" content="light dark">
      <meta name="supported-color-schemes" content="light dark">
      <style>
        :root {
          color-scheme: light dark;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          background-color: #f4f4f5;
          margin: 0;
          padding: 0;
          -webkit-font-smoothing: antialiased;
        }
        .wrapper {
          padding: 40px 20px;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          background-color: #ffffff;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
          border: 1px solid #e5e7eb;
        }
        .header {
          padding: 32px 32px 0 32px;
          text-align: left;
        }
        .logo-text {
          font-weight: 800;
          font-size: 20px;
          color: ${primaryColor};
          letter-spacing: -0.5px;
          margin: 0;
          text-transform: uppercase;
        }
        .subtitle-text {
          font-size: 13px;
          color: #64748b;
          margin-top: 4px;
          font-weight: 500;
        }
        .divider {
          height: 1px;
          background-color: #e2e8f0;
          margin: 24px 32px;
        }
        .content {
          padding: 0 32px 32px 32px;
          color: #334155;
          line-height: 1.6;
          font-size: 15px;
        }
        .content h1 {
          margin: 0 0 24px 0;
          font-size: 22px;
          font-weight: 700;
          color: #0f172a;
          letter-spacing: -0.5px;
        }
        .footer {
          background-color: #f8fafc;
          padding: 24px 32px;
          text-align: left;
          font-size: 12px;
          color: #64748b;
          line-height: 1.6;
          border-top: 1px solid #e2e8f0;
        }
        .button {
          display: inline-block;
          background-color: ${primaryColor};
          color: #ffffff;
          padding: 12px 24px;
          text-decoration: none;
          border-radius: 6px;
          font-weight: 600;
          margin-top: 16px;
          font-size: 14px;
        }

        /* DARK MODE STYLES */
        @media (prefers-color-scheme: dark) {
          body { background-color: #121212 !important; }
          .container { background-color: #1e1e1e !important; border-color: #333 !important; }
          .content { color: #e2e8f0 !important; }
          .content h1 { color: #f8fafc !important; }
          .subtitle-text { color: #94a3b8 !important; }
          .divider { background-color: #334155 !important; }
          .footer { background-color: #121212 !important; color: #94a3b8 !important; border-top-color: #334155 !important; }
          .footer strong { color: #f1f5f9 !important; }
          
          /* Classes internas (Cartões, Assinaturas) */
          .ticket-card { border-color: #334155 !important; }
          .ticket-header { background-color: #121212 !important; border-bottom-color: #334155 !important; color: #94a3b8 !important; }
          .ticket-label { color: #94a3b8 !important; }
          .ticket-value { color: #f8fafc !important; }
          
          .sig-text { color: #e2e8f0 !important; }
          .sig-muted { color: #94a3b8 !important; }
          .sig-border { border-right-color: #334155 !important; }
        }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="container">
          <div class="header">
            <div class="logo-text">CG CONSTRUÇÕES</div>
            <div class="subtitle-text">Central de Suporte de TI</div>
          </div>
          
          <div class="divider"></div>
          
          <div class="content">
            ${title ? `<h1>${title}</h1>` : ''}
            ${content}
          </div>
          
          <div class="footer">
            <strong style="color: #475569;">CG Construções</strong><br>
            Central de Suporte de TI<br><br>
            Esta é uma mensagem automática enviada pelo sistema de chamados.<br>
            Por favor, não responda diretamente a este e-mail.
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Extrai imagens base64 (data:image/...) do HTML e converte em anexos CID inline,
 * garantindo compatibilidade com clientes de e-mail (como Gmail e Outlook) que bloqueiam data URIs.
 */
function extractInlineBase64Images(html: string) {
  const attachments: Array<{
    content: string;
    filename: string;
    type: string;
    disposition: string;
    content_id: string;
  }> = [];

  let index = 0;
  const processedHtml = html.replace(
    /<img([^>]+)src=["']data:(image\/[a-zA-Z0-9+.-]+);base64,([^"']+)["']([^>]*)>/gi,
    (match, prefix, mimeType, base64Data, suffix) => {
      const ext = mimeType.split('/')[1] || 'png';
      const cid = `inline_img_${index}_${Date.now()}`;
      attachments.push({
        content: base64Data.trim(),
        filename: `signature_logo_${index}.${ext}`,
        type: mimeType,
        disposition: 'inline',
        content_id: cid,
      });
      index++;
      return `<img${prefix}src="cid:${cid}"${suffix}>`;
    }
  );

  return { html: processedHtml, attachments };
}

/**
 * Sends a raw HTML email using SendGrid.
 */
export async function sendHtmlEmail(
  to: string, 
  subject: string, 
  html: string, 
  inReplyToMessageId?: string, 
  cc?: string[],
  existingAttachments?: any[],
  metadata?: { ticketId?: string, reason: string }
) {
  const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'suporte@empresa.com.br';
  const fromName = process.env.SENDGRID_FROM_NAME || 'HelpDesk';

  // Converte imagens base64 em anexos inline (CID) para visualização perfeita no Gmail/Outlook
  const { html: emailHtml, attachments: inlineAttachments } = extractInlineBase64Images(html);
  const allAttachments = [...(existingAttachments || []), ...inlineAttachments];

  const msg: any = {
    to,
    from: {
      email: fromEmail,
      name: fromName,
    },
    subject,
    html: emailHtml,
  };

  if (cc && cc.length > 0) {
    msg.cc = cc;
  }

  if (allAttachments.length > 0) {
    msg.attachments = allAttachments;
  }

  if (inReplyToMessageId) {
    // Para agrupar no GMail / Outlook
    msg.headers = {
      'In-Reply-To': inReplyToMessageId,
      'References': inReplyToMessageId,
    };
  }

  try {
    await sgMail.send(msg);
    console.log(`[EMAIL] E-mail enviado com sucesso para ${to}`);
    
    // Log to SentEmail
    if (metadata) {
      await prisma.sentEmail.create({
        data: {
          to,
          subject,
          bodyHtml: emailHtml,
          ticketId: metadata.ticketId,
          reason: metadata.reason,
        }
      }).catch(e => console.error("[EMAIL] Erro ao salvar log de e-mail enviado:", e));
    }

    return { success: true, bodyHtml: emailHtml };
  } catch (error: any) {
    console.error(`[EMAIL] Falha ao enviar e-mail para ${to}:`, error.response?.body || error.message);
    // Retornamos falso em vez de lançar exceção para não quebrar fluxos (ex: criação de chamado)
    return { success: false, error: error.message, bodyHtml: emailHtml };
  }
}

async function getTicketEmailMetadata(ticketId: string, requesterEmail?: string) {
  try {
    const t = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { 
        cc: true, 
        processedEmails: { 
          orderBy: { receivedAt: 'asc' }, 
          take: 1, 
          select: { messageId: true } 
        } 
      }
    });
    let ccList = t?.cc 
      ? t.cc.split(/[,;]+/).map(c => c.trim()).filter(Boolean) 
      : undefined;

    if (ccList && requesterEmail) {
      ccList = ccList.filter(c => c.toLowerCase() !== requesterEmail.toLowerCase());
    }
    if (ccList && ccList.length === 0) {
      ccList = undefined;
    }

    const inReplyTo = t?.processedEmails?.[0]?.messageId;
    return { ccList, inReplyTo };
  } catch (e) {
    return { ccList: undefined, inReplyTo: undefined };
  }
}

/**
 * Envia um e-mail customizado digitado manualmente pelo administrador.
 */
export async function sendCustomEmail(
  to: string, 
  subject: string, 
  content: string, 
  inReplyToMessageId?: string, 
  cc?: string[],
  attachments?: any[]
) {
  const settings = await getCorporateSettings();
  
  let cleanCc = cc;
  if (cleanCc && Array.isArray(cleanCc)) {
    cleanCc = cleanCc
      .map(c => typeof c === 'string' ? c.trim() : c)
      .filter(Boolean)
      .filter(c => c.toLowerCase() !== to.toLowerCase());
    if (cleanCc.length === 0) {
      cleanCc = undefined;
    }
  }

  // Como o content já vem como HTML (do editor frontend ou templates),
  // não substituímos os \n por <br /> para não quebrar tabelas e layouts como a assinatura.
  const html = getEmailLayout(settings, "", content);
  return sendHtmlEmail(to, subject, html, inReplyToMessageId, cleanCc, attachments, { reason: "RESPOSTA_MANUAL", ticketId: undefined }); // we don't have ticketId easily here unless passed, let's update signature later if needed.
}

/**
 * Envia um e-mail de teste utilizando o layout corporativo.
 */
export async function sendTestEmail(to: string) {
  console.log(`[EMAIL] Preparando e-mail de teste para ${to}...`);
  const settings = await getCorporateSettings();
  
  const content = `
    <p>Olá!</p>
    <p>Este é um e-mail de teste enviado pelo sistema <strong>${settings.systemName}</strong>.</p>
    <p>A integração com o serviço de e-mail (SendGrid) está funcionando corretamente!</p>
  `;
  
  const html = getEmailLayout(settings, 'E-mail de Teste — Integração Concluída', content);
  
  return sendHtmlEmail(to, 'Teste de Integração de E-mail', html);
}

/**
 * Envia um e-mail notificando o solicitante sobre a abertura de um novo chamado.
 */
export async function sendTicketCreatedEmail(ticketData: any, requesterEmail: string, requesterName: string) {
  if (!requesterEmail) {
    console.log(`[EMAIL] Solicitante ${requesterName} não possui e-mail cadastrado. Abortando notificação.`);
    return { success: false, reason: 'NO_EMAIL' };
  }

  console.log(`[EMAIL] Preparando notificação de abertura de chamado para ${requesterEmail}...`);
  const settings = await getCorporateSettings();
  const dateStr = ticketData.ticketDate ? new Date(ticketData.ticketDate).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR');
  
  // Buscar template no banco
  let template = await prisma.emailTemplate.findUnique({
    where: { code: 'TICKET_CREATED' }
  });
  
  // Variáveis disponíveis
  const vars: Record<string, string> = {
    '{{requesterName}}': requesterName || 'Cliente',
    '{{ticketNumber}}': String(ticketData.ticketNumber || ''),
    '{{problem}}': ticketData.problem || '',
    '{{status}}': ticketData.status || '',
    '{{priority}}': ticketData.priority || '',
    '{{date}}': dateStr,
    '{{systemName}}': settings.systemName,
  };
  
  let subject = `Chamado #${ticketData.ticketNumber} aberto — ${settings.systemName}`;
  let content = '';

  if (template) {
    subject = template.subject;
    content = template.bodyHtml;
    // Apply variables to subject and content
    for (const [key, value] of Object.entries(vars)) {
      subject = subject.replace(new RegExp(key, 'g'), value);
      content = content.replace(new RegExp(key, 'g'), value);
    }
    
    // Fallback if the user removes all content
    if (!content.trim()) {
      content = `<p>Seu chamado foi registrado.</p>`;
    }
  } else {
    // Template hardcoded fallback (caso ainda não exista no banco)
    content = `
      <p style="margin-top: 0;">Olá, <strong>${requesterName}</strong>.</p>
      <p>Recebemos sua solicitação e ela foi registrada com sucesso em nossa Central de Suporte de TI.</p>
      
      <div style="border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; margin: 32px 0;" class="ticket-card">
        <div style="background-color: #f8fafc; padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 11px; font-weight: 700; color: #64748b; letter-spacing: 0.5px; text-transform: uppercase;" class="ticket-header">
          Detalhes do Atendimento
        </div>
        <div style="padding: 16px;">
          <div style="margin-bottom: 16px;">
            <div style="font-size: 12px; color: #64748b; margin-bottom: 2px;" class="ticket-label">Chamado</div>
            <div style="font-size: 16px; font-weight: 700; color: #0f172a;" class="ticket-value">#${ticketData.ticketNumber}</div>
          </div>
          <div style="margin-bottom: 16px;">
            <div style="font-size: 12px; color: #64748b; margin-bottom: 2px;" class="ticket-label">Solicitação</div>
            <div style="font-size: 15px; color: #334155;" class="ticket-value">${ticketData.problem}</div>
          </div>
          <div>
            <div style="font-size: 12px; color: #64748b; margin-bottom: 2px;" class="ticket-label">Data de abertura</div>
            <div style="font-size: 14px; color: #334155;" class="ticket-value">${dateStr}</div>
          </div>
        </div>
      </div>
      
      <div style="display: flex; align-items: center; margin-bottom: 24px; color: #16a34a; font-weight: 600; font-size: 14px;">
        <span style="display: inline-block; margin-right: 8px;">✓</span> Solicitação recebida
      </div>
      
      <p>Nossa equipe técnica já recebeu sua solicitação e realizará a análise necessária para dar continuidade ao atendimento.</p>
      <p>Você receberá novas notificações sempre que houver uma atualização relevante em sua solicitação.</p>
    `;
  }
  
  const html = getEmailLayout(
    template?.primaryColor ? { ...settings, primaryColor: template.primaryColor } : settings, 
    template?.name || "Seu chamado foi registrado", 
    content
  );
  
  const { ccList, inReplyTo } = await getTicketEmailMetadata(ticketData.id, requesterEmail);
  
  return sendHtmlEmail(requesterEmail, subject, html, inReplyTo, ccList, undefined, { ticketId: ticketData.id, reason: "ABERTURA" });
}

/**
 * Envia um e-mail notificando o solicitante sobre a resolução de um chamado.
 */
export async function sendTicketResolvedEmail(ticketData: any, requesterEmail: string, requesterName: string, solutionText: string) {
  if (!requesterEmail) return { success: false, reason: 'NO_EMAIL' };

  console.log(`[EMAIL] Preparando notificação de resolução para ${requesterEmail}...`);
  const settings = await getCorporateSettings();
  
  let template = await prisma.emailTemplate.findUnique({
    where: { code: 'TICKET_RESOLVED' }
  });
  
  const vars: Record<string, string> = {
    '{{requesterName}}': requesterName || 'Cliente',
    '{{ticketNumber}}': String(ticketData.ticketNumber || ''),
    '{{solution}}': solutionText || 'Chamado finalizado pela equipe de suporte.',
    '{{systemName}}': settings.systemName,
  };
  
  let subject = `Chamado #${ticketData.ticketNumber} resolvido — ${settings.systemName}`;
  let content = '';

  if (template) {
    subject = template.subject;
    content = template.bodyHtml;
    for (const [key, value] of Object.entries(vars)) {
      subject = subject.replace(new RegExp(key, 'g'), value);
      content = content.replace(new RegExp(key, 'g'), value);
    }
    
    if (!content.trim()) {
      content = `<p>Seu chamado foi resolvido.</p>`;
    }
  } else {
    content = `
      <p style="margin-top: 0;">Olá, <strong>${vars['{{requesterName}}']}</strong>!</p>
      <p>Temos uma ótima notícia: o seu chamado foi <strong>resolvido</strong>!</p>
      
      <div style="margin-top: 25px; background-color: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0; padding: 16px;">
        <p style="margin-top: 0; font-size: 14px; color: #333333; line-height: 1.6;">
          <strong>Chamado:</strong> #${vars['{{ticketNumber}}']}<br>
          <strong>Solução:</strong> ${vars['{{solution}}']}
        </p>
      </div>
      
      <p style="margin-top: 25px;">Se precisar de mais alguma coisa, não hesite em abrir um novo chamado.</p>
    `;
  }

  const html = getEmailLayout(
    template?.primaryColor ? { ...settings, primaryColor: template.primaryColor } : settings, 
    template?.name || "Chamado Resolvido", 
    content
  );
  
  const { ccList, inReplyTo } = await getTicketEmailMetadata(ticketData.id, requesterEmail);

  return sendHtmlEmail(requesterEmail, subject, html, inReplyTo, ccList, undefined, { ticketId: ticketData.id, reason: "FECHAMENTO" });
}
/**
 * Sends a recess auto-reply when the system is in recess mode.
 */
export async function sendRecessEmail(ticket: any, toEmail: string, returnDate?: string): Promise<{ success: boolean; bodyHtml?: string; error?: any }> {
  try {
    const settings = await getCorporateSettings();
    if (!settings.emailIntegrationStatus || settings.emailIntegrationStatus !== 'CONNECTED') {
      return { success: false, error: 'E-mail integration not connected.' };
    }

    const returnDateStr = returnDate 
      ? new Date(returnDate).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) 
      : "em breve";

    const content = `
      <div style="margin-bottom: 24px; padding: 20px; background-color: #f8fafc; border-left: 4px solid #f59e0b; border-radius: 4px;">
        <h3 style="color: #d97706; margin-top: 0; margin-bottom: 12px; font-size: 16px;">Estamos em Recesso / Férias Coletivas</h3>
        <p style="margin-bottom: 0; color: #475569; font-size: 14px; line-height: 1.6;">
          Gostaríamos de informar que nossa equipe encontra-se atualmente em recesso.<br/><br/>
          Seu chamado <strong>#HD-${String(ticket.ticketNumber).padStart(6, '0')}</strong> foi recebido e registrado com sucesso em nosso sistema, porém o prazo de atendimento está pausado e só iniciaremos a tratativa no nosso retorno.<br/><br/>
          <strong>Data prevista de retorno: ${returnDateStr}</strong>.
        </p>
      </div>
      <p style="color: #64748b; font-size: 13px;">Agradecemos a sua compreensão.</p>
    `;

    const html = getEmailLayout(settings, `[Recesso] Retornaremos dia ${returnDateStr}`, content);

    const msg = {
      to: toEmail,
      from: {
        name: settings.systemName || "HelpDesk",
        email: process.env.SENDGRID_FROM_EMAIL || "suporte@cgconstrucoes.com.br"
      },
      subject: `Re: ${ticket.problem}`,
      html: html,
      headers: {
        'References': ticket.id,
        'In-Reply-To': ticket.id
      }
    };

    await sgMail.send(msg);
    
    await prisma.sentEmail.create({
      data: {
        to: toEmail,
        subject: msg.subject,
        bodyHtml: html,
        ticketId: ticket.id,
        reason: "RECESSO",
      }
    }).catch(e => console.error("[EMAIL] Erro ao salvar log de e-mail de recesso:", e));

    return { success: true, bodyHtml: html };
  } catch (error) {
    console.error("[EMAIL SERVICE] Falha ao enviar email de recesso:", error);
    return { success: false, error };
  }
}
