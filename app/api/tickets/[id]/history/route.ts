export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/services/rbac/rbac.service";
import { prisma } from "@/lib/prisma";

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

    if (session.role === "SOLICITANTE") {
      const ticket = await prisma.ticket.findUnique({
        where: { id },
        include: { requester: true }
      });
      if (!ticket || ticket.requester.email !== session.email) {
        return NextResponse.json({ error: "Acesso negado: Este chamado pertence a outro usuário." }, { status: 403 });
      }
    }

    const history = await prisma.ticketHistory.findMany({
      where: { ticketId: id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(history);
  } catch (error: any) {
    console.error("[HelpDesk API] Erro em GET /api/tickets/[id]/history:", error);
    return NextResponse.json(
      { error: "Erro interno ao listar histórico do chamado." },
      { status: 500 }
    );
  }
}
