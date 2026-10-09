import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { createAuditLog } from "@/services/audit/audit.service";
import fs from "fs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const session = await require("@/lib/auth").getSession(req);
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    if (session.role === "SOLICITANTE") {
      const ticket = await prisma.ticket.findUnique({
        where: { id },
        include: { requester: true }
      });
      if (!ticket || ticket.requester.email !== session.email) {
        return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
      }
    }

    const attachments = await prisma.ticketAttachment.findMany({
      where: { ticketId: id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(attachments);
  } catch (error: any) {
    console.error("Error fetching attachments:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const session = await require("@/lib/auth").getSession(req);
    if (!session) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    if (session.role === "SOLICITANTE") {
      const ticket = await prisma.ticket.findUnique({
        where: { id },
        include: { requester: true }
      });
      if (!ticket || ticket.requester.email !== session.email) {
        return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
      }
    }
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const uploadedById = formData.get("uploadedById") as string | null;
    const actorName = formData.get("actorName") as string || "Sistema";

    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
    }

    const ticket = await prisma.ticket.findUnique({
      where: { id },
      select: { ticketNumber: true },
    });

    if (!ticket) {
      return NextResponse.json({ error: "Chamado não encontrado." }, { status: 404 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Save to public/uploads
    const uploadDir = path.join(process.cwd(), "public", "uploads", id);
    if (!fs.existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // Gerar um nome único e seguro para o arquivo
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const uniqueFileName = `${Date.now()}-${safeName}`;
    const filePath = path.join(uploadDir, uniqueFileName);

    await writeFile(filePath, buffer);

    const fileUrl = `/uploads/${id}/${uniqueFileName}`;

    const attachment = await prisma.ticketAttachment.create({
      data: {
        ticketId: id,
        fileName: file.name,
        fileUrl,
        fileSize: file.size,
        uploadedById: uploadedById || null,
      },
    });

    // Registra na timeline
    await prisma.ticketHistory.create({
      data: {
        ticketId: id,
        actorId: uploadedById || null,
        actorName,
        eventType: "ATTACHMENT_ADDED",
        description: `Anexou o arquivo ${file.name}.`,
      },
    });

    await createAuditLog({
      userId: uploadedById || undefined,
      action: "ADD_ATTACHMENT",
      entity: "Ticket",
      entityId: id,
      details: `Adicionou anexo ao chamado #${ticket.ticketNumber}`,
    });

    return NextResponse.json(attachment);
  } catch (error: any) {
    console.error("Error uploading attachment:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
