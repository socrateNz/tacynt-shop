import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";

import { recordAuditLog } from "@/lib/audit";
import { hashPassword } from "@/lib/auth/password";
import { withSystemContext } from "@/lib/db/tenant-context";
import { requestOrigin } from "@/lib/http/request-origin";

// Plage Unicode des diacritiques combinants (U+0300–U+036F), pour retirer
// les accents après normalize("NFD").
const DIACRITICS_REGEX = new RegExp("[\\u0300-\\u036f]", "g");

function slugify(input: string): string {
  return (
    input
      .normalize("NFD")
      .replace(DIACRITICS_REGEX, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 40) || "boutique"
  );
}

export async function POST(request: Request) {
  const form = await request.formData();
  const nom = String(form.get("nom") ?? "").trim();
  const email = String(form.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(form.get("password") ?? "");

  if (!nom || !email || password.length < 8) {
    const url = new URL("/signup", requestOrigin(request));
    url.searchParams.set("error", "invalid");
    return NextResponse.redirect(url, { status: 303 });
  }

  const baseSlug = slugify(nom);
  const hash = await hashPassword(password);

  let organization;
  try {
    organization = await withSystemContext(async (tx) => {
      // Vérification puis insertion (pas de retry après échec dans la même
      // transaction : Postgres abandonne toute la transaction dès la
      // première erreur, un retry interne casserait tout le reste).
      const existing = await tx.organization.findUnique({ where: { slug: baseSlug } });
      const slug = existing ? `${baseSlug}-${randomBytes(2).toString("hex")}` : baseSlug;

      const organization = await tx.organization.create({ data: { nom, slug } });

      // Nécessaire pour que les inserts suivants passent le WITH CHECK des
      // policies RLS (voir prisma/rls-manifest.sql).
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${organization.id}, true)`;

      const shop = await tx.shop.create({
        data: { organizationId: organization.id, nom: `${nom} — Boutique principale` },
      });

      // Plan STARTER = 1 caisse simultanée (section 9.1) : une caisse par
      // défaut suffit, pas d'écran de gestion des postes en Phase 1.
      await tx.register.create({
        data: { organizationId: organization.id, shopId: shop.id, nom: "Caisse 1", code: "C1" },
      });

      const user = await tx.user.create({
        data: {
          organizationId: organization.id,
          email,
          hash,
          role: "PROPRIETAIRE",
        },
      });

      await tx.userShop.create({
        data: { organizationId: organization.id, userId: user.id, shopId: shop.id },
      });

      await recordAuditLog(tx, {
        organizationId: organization.id,
        userId: user.id,
        action: "ORG_CREATED",
        entite: "organization",
        entiteId: organization.id,
      });

      return organization;
    });
  } catch {
    const url = new URL("/signup", requestOrigin(request));
    url.searchParams.set("error", "conflict");
    return NextResponse.redirect(url, { status: 303 });
  }

  const protocol = requestOrigin(request).split("://")[0];
  const rootDomain = process.env.APP_ROOT_DOMAIN ?? "localhost:3000";
  const redirectUrl = `${protocol}://${organization.slug}.${rootDomain}/login`;

  return NextResponse.redirect(redirectUrl, { status: 303 });
}
