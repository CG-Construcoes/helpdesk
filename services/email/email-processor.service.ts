import { simpleParser, ParsedMail } from 'mailparser';
import { connectToImap } from './imap.service';
import { prisma } from '@/lib/prisma';
import { createTicket } from '../ticket/create-ticket.service';
import { getCorporateSettings, updateCorporateSettings } from '../settings/settings.service';
import { sendTicketCreatedEmail, sendRecessEmail } from './email.service';

/**
 * Checks the inbox for new unseen emails, processes them, creates tickets, and records them to prevent duplicates.
 */
export async function checkAndProcessEmails() {
  const settings = await getCorporateSettings();
  let client;
  let processedCount = 0;
  let errorCount = 0;

  try {
    console.log('[EMAIL-INBOUND] Iniciando verificação');
    client = await connectToImap();
    
    // Seleciona a caixa de entrada (INBOX)
    let lock = await client.getMailboxLock('INBOX');
    try {
      // Busca e-mails não lidos
      const searchStatus = await client.search({ seen: false });
      
      if (!searchStatus || searchStatus.length === 0) {
        console.log('[EMAIL-INBOUND] Nenhuma nova mensagem encontrada.');
      } else {
        console.log(`[EMAIL-INBOUND] ${searchStatus.length} mensagens não lidas encontradas.`);
        
        for (const seq of searchStatus) {
          const message = await client.fetchOne(seq, { source: true, uid: true, envelope: true });
          if (!message || !message.source) continue;

          const parsedMail: ParsedMail = await simpleParser(message.source);
          
          const messageId = parsedMail.messageId || `uid-${message.uid}`;
          
          // Verifica duplicidade no banco usando um insert otimista para evitar race conditions
          try {
            await prisma.processedEmail.create({
              data: { messageId, status: 'PROCESSING' }
            });
          } catch (createErr: any) {
            // Se falhar por unique constraint (P2002), outro processo pegou ou já foi processado
            if (createErr.code === 'P2002') {
              console.log(`[EMAIL-INBOUND] E-mail ${messageId} já processado ou em processamento. Ignorando.`);
              // Marca como visto no IMAP apenas para segurança
              await client.messageFlagsAdd({ uid: message.uid }, ['\\Seen'], { uid: true });
              continue;
            }
            throw createErr;
          }

          console.log(`[EMAIL-INBOUND] Processando Message-ID ${messageId}`);
          
          try {
            // Extrai dados do e-mail
            const fromAddress = parsedMail.from?.value[0]?.address || 'desconhecido@email.com';
            const fromName = parsedMail.from?.value[0]?.name || fromAddress;
            const ccAddresses = (Array.isArray(parsedMail.cc) ? parsedMail.cc.flatMap((c: any) => c.value) : (parsedMail.cc as any)?.value)?.map((v: any) => v.address).filter(Boolean).join(', ') || null;
            const subject = parsedMail.subject || '(Sem Assunto)';
            
            // Pega o texto puro como descrição, ou HTML se não houver texto puro
            let description = parsedMail.text || parsedMail.html || '(Corpo vazio)';
            
            // Verifica se é resposta a um chamado existente
            let linkedTicket = null;
            
            // Tenta achar pelo assunto: "#21"
            const match = subject.match(/#(\d+)/);
            if (match) {
              const ticketNum = parseInt(match[1], 10);
              linkedTicket = await prisma.ticket.findFirst({
                where: { ticketNumber: ticketNum },
                orderBy: { createdAt: 'desc' },
                include: { requester: true }
              });
            }

            // Tenta achar pelo inReplyTo ou references (caso tenha o ProcessedEmail com ticketId)
            if (!linkedTicket) {
              const rawRefs = [
                parsedMail.inReplyTo,
                ...(Array.isArray(parsedMail.references) ? parsedMail.references : [parsedMail.references])
              ].filter(Boolean) as string[];

              const references: string[] = [];
              for (const r of rawRefs) {
                const matches = r.match(/<[^>]+>/g);
                if (matches) {
                  references.push(...matches);
                } else {
                  const parts = r.split(/\s+/).filter(Boolean);
                  for (const p of parts) {
                    if (p.startsWith('<') && p.endsWith('>')) {
                      references.push(p);
                    } else {
                      references.push(`<${p}>`);
                    }
                  }
                }
              }

              if (references.length > 0) {
                const pastEmail = await prisma.processedEmail.findFirst({
                  where: {
                    messageId: { in: references },
                    ticketId: { not: null }
                  },
                  orderBy: { receivedAt: 'desc' }
                });
                if (pastEmail && pastEmail.ticketId) {
                  linkedTicket = await prisma.ticket.findUnique({
                    where: { id: pastEmail.ticketId },
                    include: { requester: true }
                  });
                }
              }
            }

            // Tenta achar pelo assunto base se for uma resposta
            if (!linkedTicket) {
              const cleanSubject = (s: string) => {
                let cleaned = s;
                let prev = '';
                while (cleaned !== prev) {
                  prev = cleaned;
                  cleaned = cleaned.replace(/^(Re|Fwd|Enc|Res|En|Tr|Aw|Resolvido|Resolved|Fechado|Closed|Conclu[íi]do):\s*/ig, '').trim();
                }
                return cleaned;
              };
              const baseSubject = cleanSubject(subject);
              
              if (baseSubject && baseSubject !== subject && baseSubject.length > 5) {
                const recentTicketBySubject = await prisma.ticket.findFirst({
                  where: { 
                    problem: { contains: baseSubject, mode: "insensitive" },
                    status: { notIn: ['RESOLVIDO', 'CANCELADO'] }
                  },
                  orderBy: { createdAt: 'desc' },
                  include: { requester: true }
                });
                if (recentTicketBySubject) {
                  linkedTicket = recentTicketBySubject;
                  console.log(`[EMAIL-INBOUND] Ticket #${linkedTicket.ticketNumber} recuperado via fallback de assunto: ${baseSubject}`);
                }
              }
            }

            let ticketId = null;
            let bodySentHtml: string | null = null;

            if (linkedTicket) {
              console.log(`[EMAIL-INBOUND] E-mail identificado como resposta ao Ticket #${linkedTicket.ticketNumber}`);
              ticketId = linkedTicket.id;
              
              // Adicionar registro no histórico do ticket
              await prisma.ticketHistory.create({
                data: {
                  ticketId: linkedTicket.id,
                  actorName: fromName,
                  eventType: "CUSTOMER_REPLY",
                  description: `Resposta enviada por e-mail: ${subject}`,
                  newValue: description.substring(0, 1000) // Salvar um trecho para histórico
                }
              });

              // Atualiza a flag de resposta não lida e também adiciona CCs que surgirem
              await prisma.ticket.update({
                where: { id: linkedTicket.id },
                data: { 
                  hasUnreadReply: true,
                  cc: ccAddresses || linkedTicket.cc
                }
              });

            } else {
              // Criação de um novo ticket
              const ticket = await createTicket(
                {
                  requesterName: fromName,
                  requesterEmail: fromAddress,
                  problem: subject,
                  description: description,
                  origin: 'EMAIL',
                  status: 'ABERTO', // Force ABERTO to increment "Em Aberto" queue properly
                  priority: settings.defaultPriority as any || 'MEDIA',
                  cc: ccAddresses,
                },
                undefined,
                'Sistema IMAP',
                undefined,
                false // sendEmail = false
              );
  
              console.log(`[EMAIL-INBOUND] Ticket #${ticket.ticketNumber} criado para o e-mail ${messageId}`);
              ticketId = ticket.id;
  
              // Disparar email de notificação manualmente para pegar o corpo
              if (fromAddress && fromAddress !== 'desconhecido@email.com') {
                let emailResult;
                if (settings.recessActive) {
                  emailResult = await sendRecessEmail(ticket, fromAddress, settings.recessReturnDate?.toString());
                } else {
                  emailResult = await sendTicketCreatedEmail(ticket, fromAddress, fromName);
                }
                
                if (emailResult.success && 'bodyHtml' in emailResult && emailResult.bodyHtml) {
                  bodySentHtml = emailResult.bodyHtml as string;
                }
              }
            }

            // Registra sucesso e salva os corpos
            await prisma.processedEmail.update({
              where: { messageId },
              data: {
                from: fromAddress,
                subject,
                receivedAt: parsedMail.date || new Date(),
                ticketId: ticketId,
                status: 'PROCESSED',
                bodyReceived: parsedMail.html || parsedMail.textAsHtml || parsedMail.text || null,
                bodySent: bodySentHtml,
                cc: ccAddresses
              }
            });

            // Marca o e-mail como lido no Gmail
            await client.messageFlagsAdd({ uid: message.uid }, ['\\Seen'], { uid: true });
            
            processedCount++;
          } catch (err: any) {
            console.error(`[EMAIL-INBOUND] Erro ao processar e-mail ${messageId}:`, err);
            
            // Registra o erro no banco para não tentar repetidamente sem controle, 
            // ou podemos optar por não registrar para tentar de novo.
            // Optamos por registrar como ERROR para não bloquear outros e-mails.
            await prisma.processedEmail.update({
              where: { messageId },
              data: {
                from: parsedMail.from?.value[0]?.address,
                subject: parsedMail.subject,
                status: 'ERROR',
                bodyReceived: parsedMail.html || parsedMail.textAsHtml || parsedMail.text || null,
                cc: (Array.isArray(parsedMail.cc) ? parsedMail.cc.flatMap((c: any) => c.value) : (parsedMail.cc as any)?.value)?.map((v: any) => v.address).filter(Boolean).join(', ') || null
              }
            });
            errorCount++;
          }
        }
      }
    } finally {
      lock.release();
    }
    
    // Atualiza status na empresa
    await updateCorporateSettings({
      lastEmailCheck: new Date(),
      lastEmailProcessed: processedCount > 0 ? new Date() : settings.lastEmailProcessed,
      emailIntegrationStatus: 'CONNECTED',
      emailCheckError: null,
    });
    
    console.log(`[EMAIL-INBOUND] Verificação concluída. Criados: ${processedCount}, Erros: ${errorCount}`);
    
    return {
      success: true,
      processed: processedCount,
      errors: errorCount,
    };
  } catch (error: any) {
    console.error('[EMAIL-INBOUND] Falha geral na verificação IMAP:', error);
    
    // Atualiza status na empresa
    await updateCorporateSettings({
      lastEmailCheck: new Date(),
      emailIntegrationStatus: 'ERROR',
      emailCheckError: error.message,
    });
    
    return {
      success: false,
      error: error.message
    };
  } finally {
    if (client) {
      try {
        await client.logout();
      } catch (e) {
        // Ignora erros de desconexão
      }
    }
  }
}
