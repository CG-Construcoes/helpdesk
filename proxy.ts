import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

if (!process.env.JWT_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("CRITICAL SECURITY ERROR: JWT_SECRET environment variable is not set in production.");
}

const SECRET_KEY = new TextEncoder().encode(
  process.env.JWT_SECRET || "helpdesk_pro_secret_key_cg_construcoes_2026_super_secure"
);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Ignorar rotas públicas, estáticos, ícones e APIs do sistema
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get("helpdesk_session")?.value;
  let isValidSession = false;

  if (token) {
    try {
      await jwtVerify(token, SECRET_KEY);
      isValidSession = true;
    } catch (e) {
      isValidSession = false;
    }
  }

  // Se o usuário está autenticado e tenta acessar o login ou a raiz (/), redireciona para o dashboard
  if (isValidSession && (pathname === "/login" || pathname === "/")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Se o usuário não está autenticado e tenta acessar qualquer página que não seja login ou recuperação de senha, redireciona
  const isPublicRoute = pathname === "/login" || pathname === "/forgot-password" || pathname === "/reset-password";
  if (!isValidSession && !isPublicRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
