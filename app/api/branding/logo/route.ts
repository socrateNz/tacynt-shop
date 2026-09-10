import { NextResponse } from "next/server";

import { recordAuditLog } from "@/lib/audit";
import { systemPrisma } from "@/lib/db/system-client";
import { withTenantContext } from "@/lib/db/tenant-context";
import { assertCapability } from "@/lib/permissions";
import { organizationCanUseWhiteLabel } from "@/lib/tenant/entitlements";
import {
  extractSlugFromHost,
  resolveOrganizationByCustomDomain,
  resolveOrganizationBySlug,
} from "@/lib/tenant/resolve";
import { getTenantContext } from "@/lib/tenant/context";
import { parseOrgSettings } from "@/lib/tenant/settings";

const MAX_LOGO_BYTES = 2 * 1024 * 1024;

// Public (aucune session requise) : consulté depuis l'admin ET la vitrine
// e-commerce (M29) — même résolution par host que login/page.tsx et
// proxy.ts, jamais via getTenantContext() qui exige une session.
export async function GET(request: Request) {
  const host = request.headers.get("host") ?? "";
  const slug = extractSlugFromHost(host);
  const organization = slug
    ? await resolveOrganizationBySlug(slug)
    : await resolveOrganizationByCustomDomain(host);

  if (!organization) {
    return NextResponse.json({ error: "Organisation introuvable." }, { status: 404 });
  }

  const branding = await systemPrisma.organizationBranding.findUnique({
    where: { organizationId: organization.id },
  });

  if (!branding?.logoData) {
    return NextResponse.json({ error: "Logo introuvable." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(branding.logoData), {
    headers: {
      "Content-Type": branding.logoMimeType ?? "application/octet-stream",
      "Cache-Control": "public, max-age=300",
    },
  });
}

// Route Handler plutôt que Server Action : un logo peut dépasser le plafond
// de 1 Mo des Server Actions (même raison que le justificatif de dépense,
// section M15, et l'import catalogue, section M12).
export async function POST(request: Request) {
  const ctx = await getTenantContext();
  await assertCapability(ctx.role, "white_label:manage");

  const organization = await systemPrisma.organization.findUniqueOrThrow({
    where: { id: ctx.organizationId },
  });
  if (!organizationCanUseWhiteLabel(organization.plan)) {
    return NextResponse.json(
      { error: "Le white label est réservé au plan ENTERPRISE." },
      { status: 403 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("logo");

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Fichier logo manquant." }, { status: 400 });
  }
  if (file.size > MAX_LOGO_BYTES) {
    return NextResponse.json({ error: "Logo trop volumineux (2 Mo max)." }, { status: 400 });
  }

  const logoData = new Uint8Array(await file.arrayBuffer());
  const logoMimeType = file.type || "application/octet-stream";

  await withTenantContext({ organizationId: ctx.organizationId }, async (tx) => {
    await tx.organizationBranding.upsert({
      where: { organizationId: ctx.organizationId },
      create: { organizationId: ctx.organizationId, logoData, logoMimeType },
      update: { logoData, logoMimeType },
    });

    const settings = parseOrgSettings(organization.settings);
    await tx.organization.update({
      where: { id: ctx.organizationId },
      data: { settings: { ...settings, branding: { ...settings.branding, hasLogo: true } } },
    });

    await recordAuditLog(tx, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "WHITE_LABEL_LOGO_UPLOADED",
      entite: "organization",
      entiteId: ctx.organizationId,
      apres: { logoMimeType },
    });
  });

  return NextResponse.json({ ok: true });
}
