import { NextResponse } from "next/server";

import { recordAuditLog } from "@/lib/audit";
import { systemPrisma } from "@/lib/db/system-client";
import { requestOrigin } from "@/lib/http/request-origin";

import { createSession, SESSION_COOKIE_NAME } from "./session";

// Partagé entre la connexion directe (pas de MFA) et /api/auth/mfa/verify
// (après validation du code) : crée la session réelle, journalise, pose le
// cookie, redirige vers l'accueil.
export async function finishLogin(
  request: Request,
  params: { userId: string; organizationId: string },
): Promise<NextResponse> {
  const ip = request.headers.get("x-forwarded-for");
  const { token, expiresAt } = await createSession({
    userId: params.userId,
    organizationId: params.organizationId,
    ip,
    userAgent: request.headers.get("user-agent"),
  });

  // "Toute action sensible est tracée de façon inaltérable : connexion..."
  // (section 5.8).
  await recordAuditLog(systemPrisma, {
    organizationId: params.organizationId,
    userId: params.userId,
    action: "LOGIN",
    entite: "user",
    entiteId: params.userId,
    ip,
  });

  const response = NextResponse.redirect(new URL("/", requestOrigin(request)), { status: 303 });
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    // http en local (pas de TLS) : un cookie secure ne partirait jamais.
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });
  return response;
}
