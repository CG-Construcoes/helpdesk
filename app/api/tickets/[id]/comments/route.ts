export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hasPermission } from "@/services/rbac/rbac.service";
import { addTicketComment } from "@/services/ticket/ticket-actions.service";
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

    const comments = await prisma.ticketComment.findMany({
      where: { ticketId: id },
      orderBy: { createdAt: "desc" },
      include: {
        author: { select: { id: true, name: true, email: true, avatar: true, role: true } },
      },
    });

    return NextResponse.json(comments);
  } catch (error: any) {
    console.error("[HelpDesk API] Erro em GET /api/tickets/[id]/comments:", error);
    return NextResponse.json(
      { error: "Erro interno ao listar comentários." },
      { status: 500 }
    );
  }
}

export async function POST(
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
    const { text, isInternal, replyAll, nextStatus, solutionHtml, signatureHtml } = body;

    const content = text || body.content; // backward compatibility

    if (!content || content.trim().length === 0) {
      return NextResponse.json({ error: "O comentário não pode estar vazio." }, { status: 400 });
    }

    const comment = await addTicketComment(id, content, session.id, session.name, isInternal, replyAll, nextStatus, solutionHtml, signatureHtml);
    return NextResponse.json(comment, { status: 201 });
  } catch (error: any) {
    console.error("[HelpDesk API] Erro em POST /api/tickets/[id]/comments:", error);
    return NextResponse.json(
      { error: "Erro interno ao adicionar comentário." },
      { status: 500 }
    );
  }
}
