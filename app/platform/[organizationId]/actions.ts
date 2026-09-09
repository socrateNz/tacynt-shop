"use server";

import { revalidatePath } from "next/cache";
import type { OrganizationPlan, OrganizationStatus } from "@prisma/client";

import { recordAuditLog } from "@/lib/audit";
import { withSystemTenantContext } from "@/lib/db/tenant-context";
import { platformPrisma } from "@/lib/db/platform-client";
import { getPlatformAdminContext } from "@/lib/platform/context";

const VALID_PLANS: OrganizationPlan[] = ["STARTER", "BUSINESS", "PRO", "ENTERPRISE"];
const VALID_STATUSES: OrganizationStatus[] = ["ACTIVE", "GRACE_PERIOD", "SUSPENDED"];

export type UpdatePlanStatusState = { error: string | null };

// Section 9 : "c'est l'admin qui gère les abonnements après avoir perçu en
// espèces" — un changement manuel, jamais dérivé d'un paiement électronique
// réel. Effectif immédiatement : assertWithinQuota (lib/quotas.ts) et
// assertCapability (lib/permissions.ts, statut SUSPENDED) lisent le plan/
// statut à chaque requête suivante, aucun cache à invalider ailleurs.
export async function updateOrganizationPlanStatus(
  _prevState: UpdatePlanStatusState,
  formData: FormData,
): Promise<UpdatePlanStatusState> {
  const ctx = await getPlatformAdminContext();

  const organizationId = String(formData.get("organizationId") ?? "");
  const plan = String(formData.get("plan") ?? "") as OrganizationPlan;
  const statut = String(formData.get("statut") ?? "") as OrganizationStatus;

  if (!organizationId || !VALID_PLANS.includes(plan) || !VALID_STATUSES.includes(statut)) {
    return { error: "Organisation, plan et statut valides sont requis." };
  }

  const admin = await platformPrisma.platformAdmin.findUniqueOrThrow({
    where: { id: ctx.platformAdminId },
  });

  await withSystemTenantContext(organizationId, async (tx) => {
    const before = await tx.organization.findUniqueOrThrow({ where: { id: organizationId } });

    await tx.organization.update({
      where: { id: organizationId },
      data: { plan, statut },
    });

    await recordAuditLog(tx, {
      organizationId,
      userId: null,
      action: "PLATFORM_PLAN_STATUS_CHANGED",
      entite: "organization",
      entiteId: organizationId,
      avant: { plan: before.plan, statut: before.statut },
      apres: { plan, statut, platformAdminEmail: admin.email },
    });
  });

  revalidatePath(`/platform/${organizationId}`);
  revalidatePath("/platform");
  return { error: null };
}

export type RecordPaymentState = { error: string | null };

// Constat manuel, pas une transaction réelle (aucun prestataire de paiement
// intégré, décision verrouillée en Phase 3) : trace ce que l'admin a
// constaté avoir reçu, pour quelle période.
export async function recordPlatformPayment(
  _prevState: RecordPaymentState,
  formData: FormData,
): Promise<RecordPaymentState> {
  const ctx = await getPlatformAdminContext();

  const organizationId = String(formData.get("organizationId") ?? "");
  const montant = Number(formData.get("montant") ?? NaN);
  const devise = String(formData.get("devise") ?? "").trim();
  const periodeDebutRaw = String(formData.get("periodeDebut") ?? "");
  const periodeFinRaw = String(formData.get("periodeFin") ?? "");
  const periodeDebut = periodeDebutRaw ? new Date(periodeDebutRaw) : null;
  const periodeFin = periodeFinRaw ? new Date(periodeFinRaw) : null;

  if (
    !organizationId ||
    !Number.isFinite(montant) ||
    montant <= 0 ||
    !devise ||
    !periodeDebut ||
    !periodeFin ||
    periodeFin < periodeDebut
  ) {
    return {
      error: "Montant (positif), devise et période (fin après début) valides sont requis.",
    };
  }

  const admin = await platformPrisma.platformAdmin.findUniqueOrThrow({
    where: { id: ctx.platformAdminId },
  });

  await platformPrisma.platformPayment.create({
    data: {
      organizationId,
      montant,
      devise,
      periodeDebut,
      periodeFin,
      recordedByAdminId: ctx.platformAdminId,
    },
  });

  await withSystemTenantContext(organizationId, async (tx) => {
    await recordAuditLog(tx, {
      organizationId,
      userId: null,
      action: "PLATFORM_PAYMENT_RECORDED",
      entite: "organization",
      entiteId: organizationId,
      apres: { montant, devise, periodeDebut, periodeFin, platformAdminEmail: admin.email },
    });
  });

  revalidatePath(`/platform/${organizationId}`);
  return { error: null };
}
