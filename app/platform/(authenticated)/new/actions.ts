"use server";


import { redirect } from "next/navigation";

import { recordAuditLog } from "@/lib/audit";
import { hashPassword } from "@/lib/auth/password";
import { platformPrisma } from "@/lib/db/platform-client";
import { withSystemContext } from "@/lib/db/tenant-context";
import { getPlatformAdminContext } from "@/lib/platform/context";
import { isValidCountry } from "@/lib/tenant/country";
import { isReservedSubdomain } from "@/lib/tenant/resolve";
import { isValidCurrency } from "@/lib/tenant/currency";
import { requestCertRefresh } from "@/lib/tenant/request-cert-refresh";
import { slugify } from "@/lib/tenant/slugify";

export type CreateOrganizationState = { error: string | null };

// Reprend telle quelle la logique de l'ancienne inscription self-service
// (app/api/auth/signup/route.ts, retirée — création d'organisation
// désormais réservée à l'admin plateforme). Même transaction, même patron
// que les autres actions platform-admin ci-dessus (getPlatformAdminContext
// en premier, action d'audit PLATFORM_XXX, platformAdminEmail tracé).
export async function createOrganization(
  _prevState: CreateOrganizationState,
  formData: FormData,
): Promise<CreateOrganizationState> {
  const ctx = await getPlatformAdminContext();

  // Nom affiché aux clients (hero, en-tête) ; le domaine, lui, ne sert qu'à
  // construire le sous-domaine de l'organisation.
  const nom = String(formData.get("nom") ?? "").trim();
  const domaine = String(formData.get("domaine") ?? "").trim();
  const ownerNom = String(formData.get("ownerNom") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const deviseInput = String(formData.get("devise") ?? "XOF");
  const paysInput = String(formData.get("pays") ?? "");

  if (
    !nom ||
    !/[\p{L}\p{N}]/u.test(domaine) ||
    !ownerNom ||
    !email ||
    password.length < 8 ||
    !isValidCurrency(deviseInput) ||
    !isValidCountry(paysInput)
  ) {
    return {
      error:
        "Nom et domaine de la boutique, nom et email du propriétaire, mot de passe (8 caractères minimum), pays et devise sont requis.",
    };
  }
  const devise = deviseInput;
  const pays = paysInput;

  const admin = await platformPrisma.platformAdmin.findUniqueOrThrow({
    where: { id: ctx.platformAdminId },
  });

  const slug = slugify(domaine);
  if (isReservedSubdomain(slug)) {
    return { error: `Le domaine « ${slug} » est réservé, choisissez-en un autre.` };
  }
  const hash = await hashPassword(password);

  try {
    await withSystemContext(async (tx) => {
      // Le domaine est choisi explicitement : jamais de suffixe ajouté en
      // silence, l'adresse réelle doit être celle qui a été saisie.
      const existing = await tx.organization.findUnique({ where: { slug } });
      if (existing) throw new Error("DOMAINE_PRIS");

      const organization = await tx.organization.create({ data: { nom, slug, devise, pays } });

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
        data: { organizationId: organization.id, nom: ownerNom, email, hash, role: "PROPRIETAIRE" },
      });

      await tx.userShop.create({
        data: { organizationId: organization.id, userId: user.id, shopId: shop.id },
      });

      await recordAuditLog(tx, {
        organizationId: organization.id,
        userId: null,
        action: "PLATFORM_ORG_CREATED",
        entite: "organization",
        entiteId: organization.id,
        apres: { nom, slug, devise, pays, ownerNom, ownerEmail: email, platformAdminEmail: admin.email },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "DOMAINE_PRIS") {
      return { error: `Le domaine « ${slug} » est déjà utilisé par une autre organisation.` };
    }
    return { error: "Impossible de créer l'organisation, réessayez." };
  }

  // Nouveau sous-domaine ({slug}.shop.tacynt.com) : le certificat TLS de
  // production (Certbot HTTP-01, pas de wildcard) doit être étendu pour le
  // couvrir — voir lib/tenant/request-cert-refresh.ts et
  // deploy/domain-watcher/. Best-effort, ne bloque jamais la création.
  await requestCertRefresh();

  redirect("/platform");
}
