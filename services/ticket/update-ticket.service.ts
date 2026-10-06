import { prisma } from "@/lib/prisma";
import { OrigemType, PrioridadeType, StatusType } from "@prisma/client";
import { createAuditLog } from "@/services/audit/audit.service";
import { getOrCreateRequester } from "@/services/requester/requester.service";
import { calculateTotalTimeMinutes, getStatusLabel, formatTotalTimeMinutes } from "./ticket-utils";
import { sendTicketResolvedEmail } from "../email/email.service";

export interface UpdateTicketInput {
  requesterName?: string;
  requesterEmail?: string;
  requesterId?: string;
  sectorId?: string;
  technicianId?: string | null;
  serviceId?: string;
  problem?: string;
  description?: string;
  status?: StatusType;
  origin?: OrigemType;
  priority?: PrioridadeType;
  startTime?: Date | null;
  endTime?: Date | null;
  observations?: string;
  solutionText?: string;
  hasUnreadReply?: boolean;
  cc?: string | null;
  pauseReason?: string;
  pauseNote?: string;
}

/**
 * Edita um chamado e registra histórico das alterações ocorridas na Timeline
 */
export async function updateTicket(
  id: string,
  input: UpdateTicketInput,
  actorId?: string,
  actorName?: string,
  ipAddress?: string
) {
  const existing = await prisma.ticket.findUnique({
    where: { id },
    include: {
      requester: true,
      sector: true,
      technician: true,
      service: true,
    },
  });

  if (!existing || existing.deletedAt) {
    throw new Error("Chamado não encontrado");
  }

  let requesterId = existing.requesterId;
  if (input.requesterName && input.requesterName !== existing.requester.name) {
    const requester = await getOrCreateRequester({
      id: input.requesterId,
      name: input.requesterName,
      email: input.requesterEmail,
    });
    requesterId = requester.id;
  } else if (input.requesterId) {
    requesterId = input.requesterId;
  }

  let startTime = input.startTime !== undefined ? (input.startTime ? new Date(input.startTime) : null) : existing.startTime;
  if (!existing.technicianId && input.technicianId && !startTime) {
    startTime = new Date();
  } else if (input.status === "EM_ATENDIMENTO" && existing.status !== "EM_ATENDIMENTO" && !startTime) {
    startTime = new Date();
  }

  let endTime = input.endTime !== undefined ? (input.endTime ? new Date(input.endTime) : null) : existing.endTime;
  const status = input.status || existing.status;

  if (status === "RESOLVIDO" && !endTime) {
    endTime = new Date();
  } else if (status !== "RESOLVIDO" && input.status && existing.status === "RESOLVIDO" && !input.endTime) {
    endTime = null;
  }

  if (status === "RESOLVIDO" && existing.status !== "RESOLVIDO") {
    const openChildrenCount = await prisma.ticket.count({
      where: {
        parentId: id,
        status: {
          notIn: ["RESOLVIDO", "CANCELADO"]
        }
      }
    });

    if (openChildrenCount > 0) {
      throw new Error("Não é possível resolver este chamado pois ele possui chamados filhos ainda em aberto.");
    }
  }

  const totalTimeMinutes = calculateTotalTimeMinutes(startTime, endTime);

  let dueDate = existing.dueDate;
  if (input.serviceId !== undefined && input.serviceId !== existing.serviceId) {
    const service = await prisma.service.findUnique({ where: { id: input.serviceId }, select: { slaHours: true } });
    const hours = service?.slaHours || 2; // Default to 2 hours
    dueDate = new Date(new Date(existing.ticketDate).getTime() + hours * 60 * 60 * 1000);
  }

  const updated = await prisma.ticket.update({
    where: { id },
    data: {
      requesterId,
      sectorId: input.sectorId !== undefined ? input.sectorId : existing.sectorId,
      technicianId: input.technicianId !== undefined ? input.technicianId : existing.technicianId,
      serviceId: input.serviceId !== undefined ? input.serviceId : existing.serviceId,
      problem: input.problem !== undefined ? input.problem.trim() : existing.problem,
      description: input.description !== undefined ? (input.description ? input.description.trim() : null) : existing.description,
      status,
      origin: input.origin || existing.origin,
      priority: input.priority || existing.priority,
      startTime,
      endTime,
      totalTimeMinutes,
      dueDate,
      observations: input.observations !== undefined ? (input.observations ? input.observations.trim() : null) : existing.observations,
      hasUnreadReply: input.hasUnreadReply !== undefined ? input.hasUnreadReply : existing.hasUnreadReply,
      cc: input.cc !== undefined ? (input.cc ? input.cc.trim() : null) : existing.cc,
      ...(input.solutionText !== undefined ? { solution: input.solutionText ? require("sanitize-html")(input.solutionText.replace(/\n/g, '<br/>')) : null } : {})
    },
    include: {
      requester: true,
      sector: true,
      technician: { select: { id: true, name: true, email: true } },
      service: true,
    },
  });

  const historyEntries: Array<{ eventType: string; description: string; oldValue?: string; newValue?: string }> = [];

  // Ticket Pause Logic (Aguardando Terceiros e Aguardando Usuário)
  if (existing.status !== updated.status) {
    const isPausedStatus = (status: string) => ["AGUARDANDO_TERCEIROS", "AGUARDANDO_USUARIO", "AGUARDANDO_PECA", "AGENDADO"].includes(status);

    if (isPausedStatus(updated.status)) {
      // Entrando em pausa
      const openPause = await prisma.ticketPause.findFirst({
        where: { ticketId: id, endTime: null }
      });
      if (!openPause) {
        await prisma.ticketPause.create({
          data: {
            ticketId: id,
            userId: actorId || null,
            reason: input.pauseReason || `Pausa: ${updated.status}`,
            startTime: new Date()
          }
        });
        historyEntries.push({
          eventType: "SLA_PAUSED",
          description: `SLA Pausado: ${input.pauseReason || getStatusLabel(updated.status)}`,
          oldValue: undefined,
          newValue: undefined,
        });
        if (input.pauseNote) {
          historyEntries.push({
            eventType: "PAUSE_NOTE",
            description: `Observação da pausa: ${input.pauseNote}`,
          });
        }
      }
    } else if (isPausedStatus(existing.status)) {
      // Saindo da pausa
      const openPause = await prisma.ticketPause.findFirst({
        where: { ticketId: id, endTime: null },
        orderBy: { startTime: 'desc' }
      });
      if (openPause) {
        const endTime = new Date();
        const duration = calculateTotalTimeMinutes(openPause.startTime, endTime) || 0;
        await prisma.ticketPause.update({
          where: { id: openPause.id },
          data: { endTime, duration }
        });
        historyEntries.push({
          eventType: "SLA_RESUMED",
          description: `SLA Retomado. Tempo aguardando: ${formatTotalTimeMinutes(duration)}`,
        });
      }
    }
  }


  if (input.cc !== undefined && input.cc !== existing.cc) {
    historyEntries.push({
      eventType: "CC_CHANGED",
      description: input.cc ? `Atualizou destinatários em cópia (Cc): ${input.cc}` : "Removeu destinatários em cópia.",
      oldValue: existing.cc || undefined,
      newValue: input.cc || undefined,
    });
  }

  if (existing.technicianId !== updated.technicianId) {
    if (updated.technician) {
      historyEntries.push({
        eventType: "TECHNICIAN_ASSIGNED",
        description: `${updated.technician.name} assumiu.`,
        oldValue: existing.technician?.name || "Sem técnico",
        newValue: updated.technician.name,
      });
    } else {
      historyEntries.push({
        eventType: "TECHNICIAN_ASSIGNED",
        description: "Técnico responsável removido.",
        oldValue: existing.technician?.name || "",
        newValue: "Sem técnico",
      });
    }
  }

  if (existing.serviceId !== updated.serviceId) {
    historyEntries.push({
      eventType: "SERVICE_CHANGED",
      description: `Serviço alterado para "${updated.service?.name || "Sem serviço"}".`,
      oldValue: existing.service?.name || "Sem serviço",
      newValue: updated.service?.name || "Sem serviço",
    });
  }

  if (existing.status !== updated.status) {
    const label = getStatusLabel(updated.status);
    historyEntries.push({
      eventType: updated.status === "RESOLVIDO" ? "COMPLETED" : "STATUS_CHANGED",
      description: updated.status === "RESOLVIDO" ? "Resolvido." : `Status alterado para ${label}.`,
      oldValue: getStatusLabel(existing.status),
      newValue: label,
    });
  }

  for (const entry of historyEntries) {
    await prisma.ticketHistory.create({
      data: {
        ticketId: updated.id,
        actorId: actorId || null,
        actorName: actorName || "Sistema",
        eventType: entry.eventType,
        description: entry.description,
        oldValue: entry.oldValue || null,
        newValue: entry.newValue || null,
      },
    });
  }

  await createAuditLog({
    userId: actorId,
    action: "UPDATE_TICKET",
    entity: "Ticket",
    entityId: updated.id,
    details: `Atualizou chamado #${updated.ticketNumber} (${updated.problem})`,
    ipAddress,
  });

  if (existing.status !== "RESOLVIDO" && updated.status === "RESOLVIDO") {
    // Tenta enviar o e-mail de fechamento
    try {
      await sendTicketResolvedEmail(updated, updated.requester.email, updated.requester.name, input.solutionText || updated.observations || "Chamado finalizado pela equipe de suporte.");
    } catch (err) {
      console.error("[EMAIL] Erro ao enviar e-mail de resolução:", err);
    }
  }

  return updated;
}
