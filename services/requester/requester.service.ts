import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export interface RequesterSuggestion {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  department?: string | null;
}

export interface RequesterHistorySummary {
  requesterId: string;
  requesterName: string;
  totalTickets: number;
  lastTicketDate: Date | null;
  lastTechnicianName: string | null;
  recentTickets: Array<{
    id: string;
    ticketNumber: number;
    problem: string;
    status: string;
    ticketDate: Date;
    technicianName: string | null;
  }>;
}

export async function suggestRequesters(query: string): Promise<RequesterSuggestion[]> {
  if (!query || query.trim().length === 0) {
    const defaultList = await prisma.requester.findMany({
      where: {
        deletedAt: null,
        isActive: true,
      },
      orderBy: { name: "asc" },
      take: 2000,
    });
    return defaultList;
  }

  const cleanQuery = query.trim();
  const list = await prisma.requester.findMany({
    where: {
      deletedAt: null,
      isActive: true,
      OR: [
        { name: { contains: cleanQuery, mode: "insensitive" } },
        { email: { contains: cleanQuery, mode: "insensitive" } },
      ],
    },
    orderBy: { name: "asc" },
    take: 10,
  });

  return list;
}

export async function getOrCreateRequester(input: {
  id?: string;
  name: string;
  email?: string;
  department?: string;
}): Promise<{ id: string; name: string; email: string }> {
  // Se veio o ID, verifica se existe no banco
  if (input.id) {
    const existingById = await prisma.requester.findUnique({
      where: { id: input.id },
    });
    if (existingById && !existingById.deletedAt) {
      return {
        id: existingById.id,
        name: existingById.name,
        email: existingById.email,
      };
    }
  }

  const cleanName = input.name.trim();

  // Verifica se existe pelo nome exato (insensitive) ou e-mail
  const existing = await prisma.requester.findFirst({
    where: {
      deletedAt: null,
      OR: [
        { name: { equals: cleanName, mode: "insensitive" } },
        ...(input.email ? [{ email: { equals: input.email.trim(), mode: "insensitive" as const } }] : []),
      ],
    },
  });

  if (existing) {
    return {
      id: existing.id,
      name: existing.name,
      email: existing.email,
    };
  }

  // Se não existir, cria automaticamente ("Não exigir cadastro prévio")
  const generatedEmail =
    input.email?.trim() ||
    `${cleanName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "")}@cgconstrucoes.local`;

  const created = await prisma.requester.create({
    data: {
      name: cleanName,
      email: generatedEmail,
      department: input.department || null,
      company: "CG Construções",
      isActive: true,
    },
  });

  return {
    id: created.id,
    name: created.name,
    email: created.email,
  };
}

export async function getRequesterHistory(requesterId: string): Promise<RequesterHistorySummary | null> {
  const requester = await prisma.requester.findUnique({
    where: { id: requesterId },
  });

  if (!requester || requester.deletedAt) {
    return null;
  }

  const tickets = await prisma.ticket.findMany({
    where: {
      requesterId,
      deletedAt: null,
    },
    orderBy: {
      ticketDate: "desc",
    },
    include: {
      technician: {
        select: { name: true },
      },
    },
    take: 1000,
  });

  const totalTickets = await prisma.ticket.count({
    where: {
      requesterId,
      deletedAt: null,
    },
  });

  const lastTicket = tickets[0] || null;
  const lastTicketDate = lastTicket ? lastTicket.ticketDate : null;

  // Busca o último técnico que atendeu esse solicitante
  let lastTechnicianName: string | null = null;
  for (const t of tickets) {
    if (t.technician?.name) {
      lastTechnicianName = t.technician.name;
      break;
    }
  }

  const recentTickets = tickets.map((t) => ({
    id: t.id,
    ticketNumber: t.ticketNumber,
    problem: t.problem,
    status: t.status,
    ticketDate: t.ticketDate,
    technicianName: t.technician?.name || null,
  }));

  return {
    requesterId: requester.id,
    requesterName: requester.name,
    totalTickets,
    lastTicketDate,
    lastTechnicianName,
    recentTickets,
  };
}

export interface RequesterListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export async function getRequestersPaginated(params: RequesterListParams) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 10));
  const skip = (page - 1) * limit;

  const where: Prisma.RequesterWhereInput = {
    deletedAt: null,
  };

  if (params.search && params.search.trim() !== "") {
    const q = params.search.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { department: { contains: q, mode: "insensitive" } },
      { company: { contains: q, mode: "insensitive" } },
    ];
  }

  if (params.status && params.status !== "ALL") {
    where.isActive = params.status === "ACTIVE";
  }

  const orderBy: Prisma.RequesterOrderByWithRelationInput = {};
  const validSortFields = ["name", "email", "company", "department", "isActive", "createdAt"];
  const sortField = validSortFields.includes(params.sortBy || "") ? params.sortBy! : "name";
  orderBy[sortField as keyof Prisma.RequesterOrderByWithRelationInput] = params.sortOrder || "asc";

  const [requesters, total] = await Promise.all([
    prisma.requester.findMany({
      where,
      skip,
      take: limit,
      orderBy,
    }),
    prisma.requester.count({ where }),
  ]);

  return {
    requesters,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function createRequester(data: {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  department?: string;
  isActive?: boolean;
}) {
  const cleanName = data.name.trim();
  const generatedEmail =
    data.email?.trim() ||
    `${cleanName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "")}@cgconstrucoes.local`;

  const created = await prisma.requester.create({
    data: {
      name: cleanName,
      email: generatedEmail,
      phone: data.phone || null,
      company: data.company || "CG Construções",
      department: data.department || null,
      isActive: data.isActive !== undefined ? data.isActive : true,
    },
  });

  return created;
}

export async function updateRequester(
  id: string,
  data: {
    name?: string;
    email?: string;
    phone?: string | null;
    company?: string | null;
    department?: string | null;
    isActive?: boolean;
  }
) {
  const updated = await prisma.requester.update({
    where: { id },
    data: {
      name: data.name,
      email: data.email,
      phone: data.phone,
      company: data.company,
      department: data.department,
      isActive: data.isActive,
    },
  });

  return updated;
}

export async function deleteRequester(id: string) {
  const requester = await prisma.requester.findUnique({ where: { id } });
  if (!requester) throw new Error("Solicitante não encontrado");

  const deleted = await prisma.requester.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      isActive: false,
      email: `${requester.email}.deleted.${Date.now()}`
    },
  });

  return { success: true, id: deleted.id };
}

export async function toggleRequesterStatus(id: string, isActive: boolean) {
  const updated = await prisma.requester.update({
    where: { id },
    data: { isActive },
  });

  return updated;
}

