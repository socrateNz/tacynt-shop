"use server";

import { randomBytes } from "node:crypto";
import { resolveTxt } from "node:dns/promises";

import { revalidatePath } from "next/cache";

import { recordAuditLog } from "@/lib/audit";
import { withTenantContext } from "@/lib/db/tenant-context";
import { systemPrisma } from "@/lib/db/system-client";
import { assertCapability } from "@/lib/permissions-server";
import { organizationCanUseWhiteLabel } from "@/lib/tenant/entitlements";
import { getTenantContext } from "@/lib/tenant/context";
import { parseOrgSettings } from "@/lib/tenant/settings";

const VERIFICATION_PREFIX = "_tacynt-verify.";
// Format volontairement permissif (labels alphanumériques/tirets séparés
// par des points) : la vraie preuve de propriété vient de la vérification
// DNS, pas de cette regex — inutile de sur-valider ici.
const DOMAIN_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

async function assertWhiteLabelAllowed(organizationId: string, role: Parameters<typeof assertCapability>[0]) {
  await assertCapability(role, "white_label:manage");
  const organization = await systemPrisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
  });
  if (!organizationCanUseWhiteLabel(organization.plan)) {
    throw new Error("Le white label est réservé au plan ENTERPRISE.");
  }
  return organization;
}

export type SetCustomDomainState = { error: string | null };

// Un nouveau domaine repart toujours non vérifié (customDomainVerified reset
// à false) — même en cas de changement d'un domaine déjà vérifié, la preuve
// de propriété doit être refaite pour le NOUVEAU nom, jamais héritée.
export async function setCustomDomain(
  _prevState: SetCustomDomainState,
  formData: FormData,
): Promise<SetCustomDomainState> {
  const ctx = await getTenantContext();
  await assertWhiteLabelAllowed(ctx.organizationId, ctx.role);

  const customDomain = String(formData.get("customDomain") ?? "")
    .trim()
    .toLowerCase();

  if (!customDomain || !DOMAIN_PATTERN.test(customDomain)) {
    return { error: "Domaine invalide (ex. boutique.client.com)." };
  }

  const verificationToken = randomBytes(16).toString("hex");

  try {
    await withTenantContext({ organizationId: ctx.organizationId }, async (tx) => {
      await tx.organization.update({
        where: { id: ctx.organizationId },
        data: {
          customDomain,
          customDomainVerificationToken: verificationToken,
          customDomainVerified: false,
          customDomainVerifiedAt: null,
        },
      });

      await recordAuditLog(tx, {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        action: "WHITE_LABEL_DOMAIN_SET",
        entite: "organization",
        entiteId: ctx.organizationId,
        apres: { customDomain },
      });
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { error: "Ce domaine est déjà utilisé par une autre organisation." };
    }
    throw error;
  }

  revalidatePath("/settings");
  return { error: null };
}

export type VerifyCustomDomainState = { error: string | null; verified?: boolean };

// Challenge TXT (_tacynt-verify.{domaine}) — auto-service, distinct de
// l'activation d'un module (Phase 4, décision verrouillée #8) : une preuve
// de propriété technique, pas une activation commerciale.
// Signature imposée par useActionState — cette action ne prend aucune
// entrée (revérifie le domaine déjà enregistré).
/* eslint-disable @typescript-eslint/no-unused-vars */
export async function verifyCustomDomain(
  _prevState: VerifyCustomDomainState,
  _formData: FormData,
): Promise<VerifyCustomDomainState> {
  /* eslint-enable @typescript-eslint/no-unused-vars */
  const ctx = await getTenantContext();
  const organization = await assertWhiteLabelAllowed(ctx.organizationId, ctx.role);

  if (!organization.customDomain || !organization.customDomainVerificationToken) {
    return { error: "Aucun domaine à vérifier — renseignez-en un d'abord." };
  }

  let verified = false;
  try {
    const records = await resolveTxt(`${VERIFICATION_PREFIX}${organization.customDomain}`);
    verified = records.some((chunks) => chunks.join("").trim() === organization.customDomainVerificationToken);
  } catch {
    verified = false;
  }

  await withTenantContext({ organizationId: ctx.organizationId }, async (tx) => {
    if (verified) {
      await tx.organization.update({
        where: { id: ctx.organizationId },
        data: { customDomainVerified: true, customDomainVerifiedAt: new Date() },
      });
    }

    await recordAuditLog(tx, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: verified ? "WHITE_LABEL_DOMAIN_VERIFIED" : "WHITE_LABEL_DOMAIN_VERIFICATION_FAILED",
      entite: "organization",
      entiteId: ctx.organizationId,
      apres: { customDomain: organization.customDomain },
    });
  });

  revalidatePath("/settings");
  return verified
    ? { error: null, verified: true }
    : { error: "Enregistrement TXT introuvable ou incorrect — la propagation DNS peut prendre du temps.", verified: false };
}

export type SetPrimaryColorState = { error: string | null };

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

export async function setPrimaryColor(
  _prevState: SetPrimaryColorState,
  formData: FormData,
): Promise<SetPrimaryColorState> {
  const ctx = await getTenantContext();
  await assertWhiteLabelAllowed(ctx.organizationId, ctx.role);

  const primaryColor = String(formData.get("primaryColor") ?? "").trim();
  if (!HEX_COLOR_PATTERN.test(primaryColor)) {
    return { error: "Couleur invalide (format hexadécimal, ex. #b8431a)." };
  }

  await withTenantContext({ organizationId: ctx.organizationId }, async (tx) => {
    const organization = await tx.organization.findUniqueOrThrow({
      where: { id: ctx.organizationId },
    });
    const settings = parseOrgSettings(organization.settings);

    await tx.organization.update({
      where: { id: ctx.organizationId },
      data: { settings: { ...settings, branding: { ...settings.branding, primaryColor } } },
    });

    await recordAuditLog(tx, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "WHITE_LABEL_COLOR_UPDATED",
      entite: "organization",
      entiteId: ctx.organizationId,
      apres: { primaryColor },
    });
  });

  revalidatePath("/settings");
  return { error: null };
}
