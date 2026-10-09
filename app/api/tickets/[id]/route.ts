export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/services/rbac/rbac.service";
import { getTicketById } from "@/services/ticket/query-tickets.service";
import { updateTicket } from "@/services/ticket/update-ticket.service";
import { deleteTicket } from "@/services/ticket/ticket-actions.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const canRead = await hasPermission(session.id, "chamados.read");
    if (!canRead) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    const { id } = await params;
    const ticket = await getTicketById(id);

    if (!ticket) {
      return NextResponse.json({ error: "Chamado não encontrado" }, { status: 404 });
    }

    if (session.role === "SOLICITANTE" && ticket.requester.email !== session.email) {
      return NextResponse.json({ error: "Acesso negado: Este chamado pertence a outro usuário." }, { status: 403 });
    }

    return NextResponse.json(ticket);
  } catch (error: any) {
    console.error("[HelpDesk API] Erro em GET /api/tickets/[id]:", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao consultar chamado." },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const canUpdate = await hasPermission(session.id, "chamados.update");
    if (!canUpdate) {
      return NextResponse.json({ error: "Acesso negado: permissão 'chamados.update' requerida." }, { status: 403 });
    }

    const { id } = await params;
    
    // Row-level authorization check
    if (session.role === "SOLICITANTE") {
      const ticket = await prisma.ticket.findUnique({
        where: { id },
        include: { requester: true }
      });
      if (!ticket || ticket.requester.email !== session.email) {
        return NextResponse.json({ error: "Acesso negado: Este chamado pertence a outro usuário." }, { status: 403 });
      }
    }

    const body = await request.json();
    const ipAddress = request.headers.get("x-forwarded-for") || undefined;

    const updated = await updateTicket(
      id,
      body,
      session.id,
      session.name,
      ipAddress
    );

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("[HelpDesk API] Erro em PUT /api/tickets/[id]:", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao atualizar chamado." },
      { status: error?.message === "Chamado não encontrado" ? 404 : 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const canDelete = await hasPermission(session.id, "chamados.delete");
    if (!canDelete) {
      return NextResponse.json({ error: "Acesso negado: permissão 'chamados.delete' requerida." }, { status: 403 });
    }

    const { id } = await params;
    
    // Row-level authorization check
    if (session.role === "SOLICITANTE") {
      const ticket = await prisma.ticket.findUnique({
        where: { id },
        include: { requester: true }
      });
      if (!ticket || ticket.requester.email !== session.email) {
        return NextResponse.json({ error: "Acesso negado: Este chamado pertence a outro usuário." }, { status: 403 });
      }
    }

    const ipAddress = request.headers.get("x-forwarded-for") || undefined;

    const deleted = await deleteTicket(id, session.id, ipAddress);
    return NextResponse.json({ message: "Chamado excluído com sucesso", deleted });
  } catch (error: any) {
    console.error("[HelpDesk API] Erro em DELETE /api/tickets/[id]:", error);
    return NextResponse.json(
      { error: error?.message || "Erro ao excluir chamado." },
      { status: error?.message === "Chamado não encontrado" ? 404 : 500 }
    );
  }
}
