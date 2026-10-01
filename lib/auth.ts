import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { UserSession } from "@/types/rbac.types";

const SECRET_KEY = new TextEncoder().encode(
  process.env.JWT_SECRET || "helpdesk_pro_secret_key_cg_construcoes_2026_super_secure"
);

const COOKIE_NAME = "helpdesk_session";

import { prisma } from "@/lib/prisma";

export async function signSessionToken(payload: UserSession, timeoutMin: number = 120): Promise<string> {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${timeoutMin}m`)
    .sign(SECRET_KEY);
}

export async function verifySessionToken(token: string): Promise<UserSession | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    return payload as unknown as UserSession;
  } catch (error) {
    return null;
  }
}

export async function setSessionCookie(session: UserSession): Promise<void> {
  const settings = await prisma.settings.findFirst({ select: { sessionTimeoutMin: true } });
  const timeoutMin = settings?.sessionTimeoutMin || 120;
  const timeoutSec = timeoutMin * 60;

  const token = await signSessionToken(session, timeoutMin);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: timeoutSec,
    path: "/",
  });
}

export async function getSession(): Promise<UserSession | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;
    return await verifySessionToken(token);
  } catch (error) {
    return null;
  }
}

export async function removeSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
