import { prisma } from "@/lib/prisma";
import { OrigemType, PrioridadeType, StatusType } from "@prisma/client";

export interface TicketFilterOptions {
  query?: string;
  status?: StatusType | "ALL";
  serviceId?: string | "ALL";
  sectorId?: string | "ALL";
  technicianId?: string | "ALL";
  origin?: OrigemType | "ALL";
  priority?: PrioridadeType | "ALL";
  isArchived?: boolean;
  startDate?: string;
  endDate?: string;
  monthYear?: string;
  sortBy?: "ticketDate" | "totalTimeMinutes" | "requester" | "service" | "ticketNumber";
  sortOrder?: "asc" | "desc";
  page?: number;
  limit?: number;
  userId?: string;
  role?: string;
  slaRisk?: boolean;
  userEmail?: string; // Otimização: evitar query extra para solicitantes
}

/**
 * Consulta um chamado específico por ID com todas as relações e timeline
 */
export async function getTicketById(id: string) {
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      requester: true,
      sector: true,
      technician: { select: { id: true, name: true, email: true, avatar: true } },
      service: true,
      comments: {
        orderBy: { createdAt: "desc" },
        include: {
          author: { select: { id: true, name: true, email: true, avatar: true, role: true } },
        },
      },
      history: {
        orderBy: { createdAt: "desc" },
      },
      attachments: true,
      processedEmails: {
        orderBy: { receivedAt: "asc" }
      },
      parent: { select: { id: true, ticketNumber: true, status: true, problem: true } },
      children: { select: { id: true, ticketNumber: true, status: true, problem: true } },
      pauses: { orderBy: { startTime: "asc" } }
    },
  });

  if (!ticket || ticket.deletedAt) return null;

  return ticket;
}

/**
 * Consulta paginada com filtros avançados e pesquisa em todas as propriedades
 */
export async function getTicketsPaginated(options: TicketFilterOptions) {
  const page = Math.max(1, options.page || 1);
  const limit = Math.max(1, Math.min(10000, options.limit || 10));
  const skip = (page - 1) * limit;

  const where: any = {
    deletedAt: null,
    isArchived: options.isArchived === true,
  };

  // Por padrão, não exibe chamados filhos na listagem e não contabiliza no dashboard
  // Apenas exibe se houver uma busca específica textual que encontre o chamado filho.
  if (!options.query || options.query.trim().length === 0) {
    where.parentId = null;
  }

  if (options.role === "SOLICITANTE" && options.userId) {
     // Otimização: usar userEmail se disponível, caso contrário fazer query
     if (options.userEmail) {
       where.requester = { email: options.userEmail };
     } else {
       const user = await prisma.user.findUnique({
         where: { id: options.userId },
         select: { email: true }
       });
       if (user) {
         where.requester = { email: user.email };
       }
     }
  }

  if (options.status && options.status !== "ALL") {
    if (options.status === "ABERTO") {
      // Aberto inclui status ABERTO OU sem técnico associado
      where.AND = [
        ...(where.AND || []),
        { OR: [{ status: "ABERTO" }, { technicianId: null }] }
      ];
    } else if (options.status === "AGUARDANDO") {
      where.status = { in: ["AGUARDANDO_USUARIO", "AGUARDANDO_TERCEIROS"] };
    } else {
      where.status = options.status;
    }
  }
  if (options.serviceId && options.serviceId !== "ALL") {
    where.serviceId = options.serviceId;
  }
  if (options.sectorId && options.sectorId !== "ALL") {
    where.sectorId = options.sectorId;
  }
  if (options.technicianId && options.technicianId !== "ALL") {
    where.technicianId = options.technicianId;
  }
  if (options.origin && options.origin !== "ALL") {
    where.origin = options.origin;
  }
  if (options.priority && options.priority !== "ALL") {
    where.priority = options.priority;
  }
  const dateFilter: any = {};
  if (options.monthYear && options.monthYear !== "ALL") {
    dateFilter.ticketMonthYear = options.monthYear;
  } else if (options.startDate || options.endDate) {
    dateFilter.ticketDate = {};
    if (options.startDate) {
      dateFilter.ticketDate.gte = new Date(options.startDate);
    }
    if (options.endDate) {
      dateFilter.ticketDate.lte = new Date(options.endDate);
    }
  }

  if (Object.keys(dateFilter).length > 0) {
    where.AND = [
      ...(where.AND || []),
      {
        OR: [
          dateFilter,
          { status: { notIn: ["RESOLVIDO", "CANCELADO"] } },
          { technicianId: null }
        ]
      }
    ];
  }

  if (options.query && options.query.trim().length > 0) {
    const q = options.query.trim();
    const isNum = /^\d+$/.test(q);

    where.AND = [
      ...(where.AND || []),
      {
        OR: [
          ...(isNum ? [{ ticketNumber: { equals: parseInt(q, 10) } }] : []),
          { problem: { contains: q, mode: "insensitive" } },
          { description: { contains: q, mode: "insensitive" } },
          { requester: { name: { contains: q, mode: "insensitive" } } },
          { requester: { email: { contains: q, mode: "insensitive" } } },
          { sector: { name: { contains: q, mode: "insensitive" } } },
          { service: { name: { contains: q, mode: "insensitive" } } },
          { technician: { name: { contains: q, mode: "insensitive" } } },
        ]
      }
    ];
  }

  let orderBy: any = { ticketDate: "desc" };
  const direction = options.sortOrder === "asc" ? "asc" : "desc";

  if (options.sortBy === "ticketDate") {
    orderBy = { ticketDate: direction };
  } else if (options.sortBy === "totalTimeMinutes") {
    orderBy = { totalTimeMinutes: direction };
  } else if (options.sortBy === "requester") {
    orderBy = { requester: { name: direction } };
  } else if (options.sortBy === "service") {
    orderBy = { service: { name: direction } };
  } else if (options.sortBy === "ticketNumber") {
    orderBy = { ticketNumber: direction };
  }

  const statusWhere = { ...where };
  delete statusWhere.status;
  // If status logic was pushed to where.AND, we need to filter it out from statusWhere!
  if (statusWhere.AND) {
    statusWhere.AND = statusWhere.AND.filter((condition: any) => !condition.OR || !condition.OR.some((sub: any) => sub.status === "ABERTO"));
    if (statusWhere.AND.length === 0) delete statusWhere.AND;
  }

  const [total, openCount, resolvedCount, waitingCount, inProgressCount, data] = await Promise.all([
    prisma.ticket.count({ where }),
    prisma.ticket.count({
      where: {
        ...statusWhere,
        AND: [
          ...(statusWhere.AND || []),
          { OR: [{ status: "ABERTO" }, { technicianId: null }] }
        ]
      }
    }),
    prisma.ticket.count({ where: { ...statusWhere, status: "RESOLVIDO" } }),
    prisma.ticket.count({ where: { ...statusWhere, status: { in: ["AGUARDANDO_USUARIO", "AGUARDANDO_TERCEIROS"] } } }),
    prisma.ticket.count({ where: { ...statusWhere, status: "EM_ATENDIMENTO" } }),
    prisma.ticket.findMany({
      where,
      orderBy,
      ...(options.slaRisk ? {} : { skip, take: limit }),
      include: {
        requester: { select: { id: true, name: true, email: true, department: true } },
        sector: { select: { id: true, name: true } },
        technician: { select: { id: true, name: true, email: true, avatar: true } },
        service: { select: { id: true, name: true, category: true, slaHours: true } },
        pauses: true,
        _count: { select: { comments: true, history: true } },
      },
    }),
  ]);

  let finalData = data;
  let finalTotal = total;

  if (options.slaRisk) {
    // Otimização: usar query SQL direta para filtrar tickets em risco de SLA
    const riskTicketIds = await prisma.$queryRaw<Array<{id: string}>>
      `SELECT t.id
       FROM tickets t
       LEFT JOIN services s ON t.service_id = s.id
       LEFT JOIN ticket_pauses tp ON t.id = tp.ticket_id
       WHERE t.deleted_at IS NULL
         AND t.status NOT IN ('RESOLVIDO', 'CANCELADO')
         AND (
           COALESCE(s.sla_hours, 24) * 3600 * 1000 +
           COALESCE(
             SUM(
               CASE
                 WHEN tp.end_time IS NOT NULL
                 THEN EXTRACT(EPOCH FROM (tp.end_time - tp.start_time)) * 1000
                 ELSE EXTRACT(EPOCH FROM (NOW() - tp.start_time)) * 1000
               END
             ),
             0
           ) <=
           EXTRACT(EPOCH FROM (NOW() - COALESCE(t.ticket_date, t.created_at))) * 1000 - 2 * 3600 * 1000
         )
       GROUP BY t.id`;

    const riskIds = riskTicketIds.map(r => r.id);
    finalTotal = riskIds.length;
    finalData = data.filter((t: any) => riskIds.includes(t.id)).slice(skip, skip + limit);
  }

  return {
    data: finalData,
    meta: {
      total: finalTotal,
      openCount,
      resolvedCount,
      waitingCount,
      inProgressCount,
      page,
      limit,
      totalPages: Math.ceil(finalTotal / limit),
    },
  };
}
