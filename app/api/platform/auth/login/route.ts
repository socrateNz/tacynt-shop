import { NextResponse } from "next/server";

import { verifyPassword } from "@/lib/auth/password";
import { createPlatformSession, PLATFORM_SESSION_COOKIE_NAME } from "@/lib/auth/platform-session";
import { platformPrisma } from "@/lib/db/platform-client";
import { requestOrigin } from "@/lib/http/request-origin";

function redirectWithError(request: Request, code: string, status = 303) {
  const url = new URL("/platform/login", requestOrigin(request));
  url.searchParams.set("error", code);
  return NextResponse.redirect(url, { status });
}

// Recherche exclusivement dans platform_admins — un compte organisation
// normal (table users) n'existe pas ici, la connexion échoue toujours pour
// lui (critère de vérification M25).
export async function POST(request: Request) {
  const form = await request.formData();
  const email = String(form.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(form.get("password") ?? "");

  const admin = await platformPrisma.platformAdmin.findUnique({ where: { email } });
  if (!admin || !admin.actif) return redirectWithError(request, "invalid");

  const validPassword = await verifyPassword(admin.hash, password);
  if (!validPassword) return redirectWithError(request, "invalid");

  const ip = request.headers.get("x-forwarded-for");
  const { token, expiresAt } = await createPlatformSession({
    platformAdminId: admin.id,
    ip,
    userAgent: request.headers.get("user-agent"),
  });

  const response = NextResponse.redirect(new URL("/platform", requestOrigin(request)), {
    status: 303,
  });
  response.cookies.set(PLATFORM_SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });
  return response;
}
