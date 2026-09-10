"use server";

import { revalidatePath } from "next/cache";

import type { PaymentMode } from "@prisma/client";

import { recordAuditLog } from "@/lib/audit";
import { withTenantContext } from "@/lib/db/tenant-context";
import { assertCapability } from "@/lib/permissions-server";
import { PROFILES } from "@/lib/tenant/profile";
import { getTenantContext } from "@/lib/tenant/context";
import { organizationHasModule } from "@/lib/tenant/modules";
import { parseOrgSettings } from "@/lib/tenant/settings";

const PAYMENT_MODES: PaymentMode[] = [
  "ESPECES",
  "MOBILE_MONEY",
  "CARTE",
  "VIREMENT",
  "ARDOISE",
  "BON_ACHAT",
];

export type SettingsFormState = { error: string | null };

export async function updateProfilMetier(
  _prevState: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const ctx = await getTenantContext();
  await assertCapability(ctx.role, "shops:manage");

  const profilMetier = String(formData.get("profilMetier") ?? "");
  if (!PROFILES.some((p) => p.value === profilMetier)) {
    return { error: "Profil métier invalide." };
  }

  await withTenantContext({ organizationId: ctx.organizationId }, async (tx) => {
    await tx.organization.update({
      where: { id: ctx.organizationId },
      data: { profilMetier },
    });

    await recordAuditLog(tx, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "PROFIL_METIER_UPDATED",
      entite: "organization",
      entiteId: ctx.organizationId,
      apres: { profilMetier },
    });
  });

  revalidatePath("/settings");
  return { error: null };
}

export type UpdateAccountingMappingState = { error: string | null };

// Connecteur comptable (Phase 4, M28) : point de départ éditable, jamais
// une garantie de conformité — deux axes de contrôle distincts (décision
// #2), la capacité ET le module, ni l'un ni l'autre seul ne suffit.
export async function updateAccountingMapping(
  _prevState: UpdateAccountingMappingState,
  formData: FormData,
): Promise<UpdateAccountingMappingState> {
  const ctx = await getTenantContext();
  await assertCapability(ctx.role, "accounting:manage");

  const ventesCompte = String(formData.get("ventesCompte") ?? "").trim();
  const tvaCompte = String(formData.get("tvaCompte") ?? "").trim();
  const chargesCompteParDefaut = String(formData.get("chargesCompteParDefaut") ?? "").trim();
  const paiementComptes: Record<string, string> = {};
  for (const mode of PAYMENT_MODES) {
    const value = String(formData.get(`paiement_${mode}`) ?? "").trim();
    if (value) paiementComptes[mode] = value;
  }

  if (!ventesCompte || !tvaCompte || !chargesCompteParDefaut) {
    return { error: "Compte de ventes, de TVA et de charges par défaut sont requis." };
  }

  await withTenantContext({ organizationId: ctx.organizationId }, async (tx) => {
    const organization = await tx.organization.findUniqueOrThrow({
      where: { id: ctx.organizationId },
    });

    if (!organizationHasModule(organization.enabledModules, "accounting_connectors")) {
      throw new Error("Le module Connecteurs comptables n'est pas activé pour cette organisation.");
    }

    const settings = parseOrgSettings(organization.settings);

    await tx.organization.update({
      where: { id: ctx.organizationId },
      data: {
        settings: {
          ...settings,
          accountingMapping: { ventesCompte, tvaCompte, chargesCompteParDefaut, paiementComptes },
        },
      },
    });

    await recordAuditLog(tx, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "ACCOUNTING_MAPPING_UPDATED",
      entite: "organization",
      entiteId: ctx.organizationId,
      apres: { ventesCompte, tvaCompte, chargesCompteParDefaut, paiementComptes },
    });
  });

  revalidatePath("/settings");
  return { error: null };
}
