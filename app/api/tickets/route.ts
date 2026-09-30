export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/services/rbac/rbac.service";
import { createTicket } from "@/services/ticket/create-ticket.service";
import { getTicketsPaginated } from "@/services/ticket/query-tickets.service";
import { OrigemType, PrioridadeType, StatusType } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const canRead = await hasPermission(session.id, "chamados.read");
    if (!canRead) {
      return NextResponse.json({ error: "Acesso negado: permissão 'chamados.read' requerida." }, { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "10", 10);
    const query = searchParams.get("query") || undefined;
    const status = (searchParams.get("status") as StatusType | "ALL") || "ALL";
    const serviceId = searchParams.get("serviceId") || "ALL";
    const sectorId = searchParams.get("sectorId") || "ALL";
    const technicianId = searchParams.get("technicianId") || "ALL";
    const origin = (searchParams.get("origin") as OrigemType | "ALL") || "ALL";
    const priority = (searchParams.get("priority") as PrioridadeType | "ALL") || "ALL";
    const isArchived = searchParams.get("isArchived") === "true";
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;
    const monthYear = searchParams.get("monthYear") || undefined;
    const sortBy = (searchParams.get("sortBy") as any) || "ticketDate";
    const sortOrder = (searchParams.get("sortOrder") as "asc" | "desc") || "desc";
    const slaRisk = searchParams.get("slaRisk") === "true";

    const result = await getTicketsPaginated({
      page,
      limit,
      query,
      status,
      serviceId,
      sectorId,
      technicianId,
      origin,
      priority,
      isArchived,
      startDate,
      endDate,
      monthYear,
      sortBy,
      sortOrder,
      slaRisk,
      userId: session.id,
      role: session.role,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[HelpDesk API] Erro em GET /api/tickets:", error);
    return NextResponse.json(
      { error: error?.message || "Erro interno ao listar chamados." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const canCreate = await hasPermission(session.id, "chamados.create");
    if (!canCreate) {
      return NextResponse.json({ error: "Acesso negado: permissão 'chamados.create' requerida." }, { status: 403 });
    }

    const body = await request.json();
    const {
      requesterName,
      requesterEmail,
      requesterId,
      sectorId,
      technicianId,
      serviceId,
      problem,
      description,
      status,
      origin,
      priority,
      ticketDate,
      startTime,
      endTime,
      observations,
      sendEmail,
      parentId,
    } = body;

    if (!requesterName || !sectorId || !serviceId || !problem) {
      return NextResponse.json(
        { error: "Solicitante, setor, serviço e problema são obrigatórios." },
        { status: 400 }
      );
    }

    const ipAddress = request.headers.get("x-forwarded-for") || undefined;
    const ticket = await createTicket(
      {
        requesterName,
        requesterEmail,
        requesterId,
        sectorId,
        technicianId,
        serviceId,
        problem,
        description,
        status,
        origin,
        priority,
        ticketDate,
        startTime,
        endTime,
        observations,
        parentId,
      },
      session.id,
      session.name,
      ipAddress,
      sendEmail !== undefined ? sendEmail : true
    );

    return NextResponse.json(ticket, { status: 201 });
  } catch (error: any) {
    console.error("[HelpDesk API] Erro em POST /api/tickets:", error);
    return NextResponse.json(
      { error: error?.message || "Erro interno ao cadastrar chamado." },
      { status: 500 }
    );
  }
}
