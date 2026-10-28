export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendHtmlEmail } from "@/services/email/email.service";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ message: "E-mail não informado." }, { status: 400 });
    }

    const emailNormalized = email.trim().toLowerCase();

    // Medida de segurança: verificar se e-mail existe
    const user = await prisma.user.findUnique({
      where: { email: emailNormalized },
    });

    if (!user || !user.isActive || user.deletedAt) {
      return NextResponse.json(
        { message: "Nenhuma conta ativa foi encontrada com este e-mail." },
        { status: 400 }
      );
    }

    // Gerar token seguro
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 3600000); // 1 hora de validade

    // Salvar token no banco
    await prisma.passwordResetToken.create({
      data: {
        token,
        userId: user.id,
        expiresAt,
      },
    });

    // Enviar e-mail
    // Prioriza APP_URL; senão, usa a origem da própria requisição (respeitando proxy reverso)
    const forwardedHost = request.headers.get("x-forwarded-host");
    const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
    const baseUrl = (
      process.env.APP_URL ||
      (forwardedHost ? `${forwardedProto}://${forwardedHost}` : request.nextUrl.origin)
    ).replace(/\/+$/, "");
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
        <h2 style="color: #0f172a;">Recuperação de Senha</h2>
        <p>Olá <strong>${user.name}</strong>,</p>
        <p>Recebemos uma solicitação para redefinir a senha da sua conta no sistema de chamados da CG Construções.</p>
        <p>Se você não fez essa solicitação, por favor, ignore este e-mail.</p>
        <p>Para redefinir sua senha, clique no botão abaixo:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background-color: #0284c7; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Redefinir Minha Senha</a>
        </div>
        <p>Ou copie e cole o link abaixo no seu navegador:</p>
        <p style="word-break: break-all; color: #0284c7; font-size: 14px;">${resetUrl}</p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 30px 0;" />
        <p style="font-size: 12px; color: #64748b;">
          Este link é válido por 1 hora. Por motivos de segurança, nunca compartilhe este e-mail com ninguém.
        </p>
      </div>
    `;

    await sendHtmlEmail(
      user.email,
      "Recuperação de Senha - CG Construções",
      htmlContent
    );

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error: any) {
    console.error("[POST /api/auth/forgot-password] Erro:", error);
    return NextResponse.json(
      { error: "Erro interno no servidor." },
      { status: 500 }
    );
  }
}
