import { prisma } from "@/lib/prisma";
import { OrigemType, PrioridadeType, StatusType } from "@prisma/client";
import { createAuditLog } from "@/services/audit/audit.service";
import { getOrCreateRequester } from "@/services/requester/requester.service";
import { calculateTotalTimeMinutes, getTicketMonthYear } from "./ticket-utils";
import { sendTicketCreatedEmail, sendTicketResolvedEmail } from "@/services/email/email.service";

export interface CreateTicketInput {
  requesterName: string;
  requesterEmail?: string;
  requesterId?: string;
  sectorId?: string | null;
  technicianId?: string | null;
  serviceId?: string | null;
  problem: string;
  description?: string;
  status?: StatusType;
  origin?: OrigemType;
  priority?: PrioridadeType;
  ticketDate?: Date;
  startTime?: Date | null;
  endTime?: Date | null;
  observations?: string;
  cc?: string | null;
  totalTimeMinutes?: number | null;
  isArchived?: boolean;
  parentId?: string | null;
}

/**
 * Cria o ticket no banco gerando número sequencial mensal atômico e com retry para concorrência
 */
export async function createTicketInMonthWithRetry(dataWithoutNum: any, ticketDateObj: Date) {
  const ticketMonthYear = getTicketMonthYear(ticketDateObj);
  let attempt = 0;
  const maxAttempts = 5;

  while (attempt < maxAttempts) {
    try {
      return await prisma.$transaction(async (tx) => {
        const lastTicket = await tx.ticket.findFirst({
          where: { ticketMonthYear },
          orderBy: { ticketNumber: "desc" },
          select: { ticketNumber: true },
        });

        const nextNumber = (lastTicket?.ticketNumber || 0) + 1;

        return await tx.ticket.create({
          data: {
            ...dataWithoutNum,
            ticketNumber: nextNumber,
            ticketMonthYear,
          },
          include: {
            requester: true,
            sector: true,
            technician: { select: { id: true, name: true, email: true } },
            service: true,
          },
        });
      });
    } catch (err: any) {
      console.error(`[CREATE TICKET] Error on attempt ${attempt + 1}:`, err);
      attempt++;
      if (attempt >= maxAttempts) {
        throw new Error(
          "Não foi possível gerar número único de chamado para este mês após tentativas concorrentes."
        );
      }
    }
  }
}

/**
 * Cria um chamado, incluindo criação automática de solicitante caso não exista
 */
export async function createTicket(
  input: CreateTicketInput,
  actorId?: string,
  actorName?: string,
  ipAddress?: string,
  sendEmail: boolean = true
) {
  const requester = await getOrCreateRequester({
    id: input.requesterId,
    name: input.requesterName,
    email: input.requesterEmail,
  });

  const startTime = input.startTime ? new Date(input.startTime) : new Date();
  let endTime = input.endTime ? new Date(input.endTime) : null;
  const status = input.status || "ABERTO";

  if (status === "RESOLVIDO" && !endTime) {
    endTime = new Date();
  }

  const totalTimeMinutes = calculateTotalTimeMinutes(startTime, endTime);
  const ticketDateObj = input.ticketDate ? new Date(input.ticketDate) : new Date();

  let dueDate: Date | null = null;
  if (input.serviceId) {
    const service = await prisma.service.findUnique({
      where: { id: input.serviceId },
      select: { slaHours: true }
    });
    
    if (service?.slaHours) {
      dueDate = new Date(ticketDateObj.getTime());
      dueDate.setHours(dueDate.getHours() + service.slaHours);
    }
  }

  if (input.parentId) {
    const parentTicket = await prisma.ticket.findUnique({
      where: { id: input.parentId },
      select: { id: true, parentId: true }
    });
    if (!parentTicket) {
      throw new Error("O chamado pai informado não existe.");
    }
    if (parentTicket.parentId) {
      throw new Error("A hierarquia de chamados é limitada a 1 nível. Não é possível vincular um chamado a outro que já é um chamado filho.");
    }
  }

  const ticket: any = await createTicketInMonthWithRetry(
    {
      problem: input.problem.trim(),
      description: input.description?.trim() || null,
      requesterId: requester.id,
      sectorId: input.sectorId || null,
      technicianId: input.technicianId || null,
      serviceId: input.serviceId || null,
      status,
      origin: input.origin || "MANUAL",
      priority: input.priority || "MEDIA",
      ticketDate: ticketDateObj,
      dueDate,
      startTime,
      endTime,
      totalTimeMinutes,
      observations: input.observations?.trim() || null,
      isArchived: input.isArchived || false,
      cc: input.cc || null,
      parentId: input.parentId || null,
    },
    ticketDateObj
  );

  await prisma.ticketHistory.create({
    data: {
      ticketId: ticket.id,
      actorId: actorId || null,
      actorName: actorName || "Sistema",
      eventType: "CREATED",
      description: ticket.origin === "EMAIL" ? "Ticket aberto por e-mail." : "Ticket criado.",
    },
  });

  if (ticket.technician) {
    await prisma.ticketHistory.create({
      data: {
        ticketId: ticket.id,
        actorId: actorId || null,
        actorName: actorName || "Sistema",
        eventType: "TECHNICIAN_ASSIGNED",
        description: `${ticket.technician.name} assumiu.`,
      },
    });
  }

  await createAuditLog({
    userId: actorId,
    action: "CREATE_TICKET",
    entity: "Ticket",
    entityId: ticket.id,
    details: `Criou chamado #${ticket.ticketNumber} — Problema: "${ticket.problem}" — Solicitante: "${requester.name}"`,
    ipAddress,
  });

  // Dispara o e-mail de notificação de forma assíncrona (não bloqueante)
  if (sendEmail && requester.email) {
    if (status === "RESOLVIDO") {
      // Se foi criado já como resolvido (comum em chamados manuais retroativos)
      const solutionText = input.observations || "Chamado finalizado pela equipe de suporte.";
      sendTicketResolvedEmail(ticket, requester.email, requester.name, solutionText).catch((err) => {
        console.error("[EMAIL] Erro inesperado ao tentar notificar conclusão imediata do chamado:", err);
      });
    } else {
      // Criação normal
      sendTicketCreatedEmail(ticket, requester.email, requester.name).catch((err) => {
        console.error("[EMAIL] Erro inesperado ao tentar notificar abertura do chamado:", err);
      });
    }
  }

  return ticket;
}
