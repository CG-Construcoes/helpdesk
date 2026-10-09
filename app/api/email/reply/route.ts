import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sendCustomEmail, sendTicketResolvedEmail } from "@/services/email/email.service";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || (session.role !== "ADMIN" && session.role !== "TI")) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const data = await request.json();
    const { to, subject, content, inReplyTo, menuPath, isPublic, attachments, cc, ticketId, nextStatus, solutionHtml } = data;

    if (!to || !subject || !content) {
      return NextResponse.json({ error: "Campos 'to', 'subject' e 'content' são obrigatórios" }, { status: 400 });
    }
    
    // Convert cc string to array if it exists and is a string, or use directly if it's an array
    let ccArray: string[] | undefined = undefined;
    if (cc) {
      if (typeof cc === 'string') {
        ccArray = cc.split(/[,;]+/).map(email => email.trim()).filter(Boolean);
      } else if (Array.isArray(cc)) {
        ccArray = cc.map(email => typeof email === 'string' ? email.trim() : email).filter(Boolean);
      }
    }
    if (ccArray && to) {
      ccArray = ccArray.filter(e => e.toLowerCase() !== to.toLowerCase());
      if (ccArray.length === 0) ccArray = undefined;
    }

    const result = await sendCustomEmail(to, subject, content, inReplyTo, ccArray, attachments);

    if (!result.success) {
      return NextResponse.json({ error: "Falha ao enviar e-mail", details: result.error }, { status: 500 });
    }

    // Salvar histórico no banco
    if (inReplyTo) {
      const existing = await prisma.processedEmail.findUnique({
        where: { messageId: inReplyTo }
      });
      
      if (existing) {
        const newReply = {
          date: new Date().toISOString(),
          adminName: session.name || "Admin",
          subject,
          content,
          menuPath: menuPath || null,
          isPublic: isPublic !== undefined ? isPublic : true,
          attachments: attachments || []
        };
        
        let replies: any[] = [];
        if (existing.manualReplies) {
          if (Array.isArray(existing.manualReplies)) {
            replies = [...existing.manualReplies];
          } else {
            replies = [existing.manualReplies];
          }
        }
        
        replies.push(newReply);
        let safeSolution = undefined;
        if (solutionHtml && isPublic) {
          const sanitizeHtml = require("sanitize-html");
          safeSolution = sanitizeHtml(solutionHtml);
        }

        await prisma.$transaction(async (tx) => {
          await tx.processedEmail.update({
            where: { messageId: inReplyTo },
            data: { manualReplies: replies }
          });
          
          if (ticketId) {
            const ccStr = typeof cc === 'string' ? cc : (Array.isArray(cc) ? cc.join(', ') : undefined);
            const dataToUpdate: any = {};
            if (nextStatus) dataToUpdate.status = nextStatus;
            if (safeSolution !== undefined) dataToUpdate.solution = safeSolution;
            if (ccStr !== undefined) dataToUpdate.cc = ccStr ? ccStr.trim() : null;

            if (Object.keys(dataToUpdate).length > 0) {
              await tx.ticket.update({
                where: { id: ticketId },
                data: dataToUpdate
              });
            }

            if (nextStatus) {
              await tx.ticketHistory.create({
                data: {
                  ticketId,
                  actorId: session.id || "admin",
                  actorName: session.name || "Admin",
                  eventType: "STATUS_CHANGED",
                  description: `Alterou o status para ${nextStatus}.`,
                },
              });
            }
          }
        });
      }
    } else if (ticketId) {
      // Caso não seja um inReplyTo (ex: e-mail solto mas atrelado a ticketId), ainda queremos atualizar status/cc
      let safeSolution = undefined;
      if (solutionHtml && isPublic) {
        const sanitizeHtml = require("sanitize-html");
        safeSolution = sanitizeHtml(solutionHtml);
      }
      await prisma.$transaction(async (tx) => {
        const ccStr = typeof cc === 'string' ? cc : (Array.isArray(cc) ? cc.join(', ') : undefined);
        const dataToUpdate: any = {};
        if (nextStatus) dataToUpdate.status = nextStatus;
        if (safeSolution !== undefined) dataToUpdate.solution = safeSolution;
        if (ccStr !== undefined) dataToUpdate.cc = ccStr ? ccStr.trim() : null;

        if (Object.keys(dataToUpdate).length > 0) {
          await tx.ticket.update({
            where: { id: ticketId },
            data: dataToUpdate
          });
        }

        // Salvar a ação pública (o e-mail enviado) como comentário, já que não temos um ProcessedEmail
        await tx.ticketComment.create({
          data: {
            ticketId,
            authorId: session.id || "admin",
            content: content.trim(),
            isInternal: false,
          }
        });

        await tx.ticketHistory.create({
          data: {
            ticketId,
            actorId: session.id || "admin",
            actorName: session.name || "Admin",
            eventType: "COMMENT_ADDED",
            description: `Enviou resposta por e-mail para ${to}.`,
          },
        });

        if (nextStatus) {
          await tx.ticketHistory.create({
            data: {
              ticketId,
              actorId: session.id || "admin",
              actorName: session.name || "Admin",
              eventType: "STATUS_CHANGED",
              description: `Alterou o status para ${nextStatus}.`,
            },
          });
        }
      });
    }

    if (ticketId && nextStatus === "RESOLVIDO") {
      try {
        const ticket = await prisma.ticket.findUnique({
          where: { id: ticketId },
          include: { requester: true, sector: true, technician: true, service: true }
        });
        if (ticket && ticket.requester.email) {
          let safeSolution = undefined;
          if (solutionHtml) {
            const sanitizeHtml = require("sanitize-html");
            safeSolution = sanitizeHtml(solutionHtml);
          }
          await sendTicketResolvedEmail(
            ticket,
            ticket.requester.email,
            ticket.requester.name,
            safeSolution || "Chamado finalizado pela equipe de suporte."
          );
        }
      } catch (err) {
        console.error("[EMAIL] Erro ao enviar e-mail de resolução:", err);
      }
    }

    return NextResponse.json({ success: true, message: "E-mail enviado com sucesso" });
  } catch (error: any) {
    console.error("[Email Reply POST] Erro:", error);
    return NextResponse.json({ error: "Erro interno", details: error.message }, { status: 500 });
  }
}
