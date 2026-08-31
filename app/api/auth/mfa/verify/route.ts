import { NextResponse, type NextRequest } from "next/server";

import { finishLogin } from "@/lib/auth/finish-login";
import { MFA_PENDING_COOKIE_NAME, verifyTotp } from "@/lib/auth/mfa";
import { systemPrisma } from "@/lib/db/system-client";
import { requestOrigin } from "@/lib/http/request-origin";
import { extractSlugFromHost } from "@/lib/tenant/resolve";

export async function POST(request: NextRequest) {
  const pendingUserId = request.cookies.get(MFA_PENDING_COOKIE_NAME)?.value;
  if (!pendingUserId) {
    return NextResponse.redirect(new URL("/login", requestOrigin(request)), { status: 303 });
  }

  const host = request.headers.get("host") ?? "";
  const slug = extractSlugFromHost(host);
  const form = await request.formData();
  const token = String(form.get("token") ?? "").trim();

  const user = await systemPrisma.user.findUnique({ where: { id: pendingUserId } });
  const organization = slug ? await systemPrisma.organization.findUnique({ where: { slug } }) : null;

  // La session en attente doit correspondre à l'organisation du sous-domaine
  // visité — même logique anti-réutilisation cross-tenant que proxy.ts.
  if (!user || !organization || user.organizationId !== organization.id || !user.mfaSecret) {
    const url = new URL("/login", requestOrigin(request));
    url.searchParams.set("error", "invalid");
    return NextResponse.redirect(url, { status: 303 });
  }

  if (!verifyTotp(user.mfaSecret, token)) {
    const url = new URL("/login/mfa", requestOrigin(request));
    url.searchParams.set("error", "invalid");
    return NextResponse.redirect(url, { status: 303 });
  }

  const response = await finishLogin(request, {
    userId: user.id,
    organizationId: organization.id,
  });
  response.cookies.delete(MFA_PENDING_COOKIE_NAME);
  return response;
}
