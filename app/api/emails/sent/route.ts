import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam, 10) : 50;

    const emails = await prisma.sentEmail.findMany({
      take: limit,
      orderBy: { sentAt: "desc" },
      include: {
        ticket: {
          select: { ticketNumber: true, problem: true }
        }
      }
    });

    return NextResponse.json(emails, { status: 200 });
  } catch (error) {
    console.error("[SentEmails GET] Erro:", error);
    return NextResponse.json({ error: "Erro ao buscar e-mails enviados" }, { status: 500 });
  }
}
