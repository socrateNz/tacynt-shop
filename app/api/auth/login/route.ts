import { NextResponse } from "next/server";

import { verifyPassword } from "@/lib/auth/password";
import { finishLogin } from "@/lib/auth/finish-login";
import { MFA_PENDING_COOKIE_NAME, MFA_PENDING_DURATION_MS } from "@/lib/auth/mfa";
import { systemPrisma } from "@/lib/db/system-client";
import { requestOrigin } from "@/lib/http/request-origin";
import { extractSlugFromHost } from "@/lib/tenant/resolve";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

function redirectWithError(request: Request, code: string, status = 303) {
  const url = new URL("/login", requestOrigin(request));
  url.searchParams.set("error", code);
  return NextResponse.redirect(url, { status });
}

export async function POST(request: Request) {
  const host = request.headers.get("host") ?? "";
  const slug = extractSlugFromHost(host);
  if (!slug) {
    return NextResponse.json({ error: "Boutique introuvable." }, { status: 404 });
  }

  const organization = await systemPrisma.organization.findUnique({ where: { slug } });
  if (!organization) {
    return NextResponse.json({ error: "Boutique introuvable." }, { status: 404 });
  }

  const form = await request.formData();
  const email = String(form.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(form.get("password") ?? "");

  const user = await systemPrisma.user.findUnique({
    where: { organizationId_email: { organizationId: organization.id, email } },
  });

  if (!user || !user.actif) return redirectWithError(request, "invalid");

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return redirectWithError(request, "locked");
  }

  const validPassword = await verifyPassword(user.hash, password);
  if (!validPassword) {
    const failedAttempts = user.failedAttempts + 1;
    await systemPrisma.user.update({
      where: { id: user.id },
      data: {
        failedAttempts,
        lockedUntil:
          failedAttempts >= MAX_FAILED_ATTEMPTS
            ? new Date(Date.now() + LOCKOUT_DURATION_MS)
            : null,
      },
    });
    return redirectWithError(request, "invalid");
  }

  await systemPrisma.user.update({
    where: { id: user.id },
    data: { failedAttempts: 0, lockedUntil: null },
  });

  if (user.mfaEnabled) {
    const response = NextResponse.redirect(new URL("/login/mfa", requestOrigin(request)), {
      status: 303,
    });
    response.cookies.set(MFA_PENDING_COOKIE_NAME, user.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: MFA_PENDING_DURATION_MS / 1000,
      path: "/",
    });
    return response;
  }

  return finishLogin(request, { userId: user.id, organizationId: organization.id });
}
