"use server";

import { revalidatePath } from "next/cache";
import type { OrganizationPlan, OrganizationStatus } from "@prisma/client";

import { recordAuditLog } from "@/lib/audit";
import { hashPassword } from "@/lib/auth/password";
import { withSystemTenantContext } from "@/lib/db/tenant-context";
import { platformPrisma } from "@/lib/db/platform-client";
import { systemPrisma } from "@/lib/db/system-client";
import { getPlatformAdminContext } from "@/lib/platform/context";
import { MODULE_CATALOG, type ModuleKey } from "@/lib/tenant/modules";

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

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

  revalidatePath("/platform");
  return { error: null };
}

export type UpdateModulesState = { error: string | null };

const VALID_MODULE_KEYS = MODULE_CATALOG.map((m) => m.key);

// Marketplace de modules (Phase 4, M26) : activation exclusivement
// platform-admin, aucune bascule self-service côté organisation (décision
// verrouillée) — même mécanique que updateOrganizationPlanStatus ci-dessus.
export async function updateOrganizationModules(
  _prevState: UpdateModulesState,
  formData: FormData,
): Promise<UpdateModulesState> {
  const ctx = await getPlatformAdminContext();

  const organizationId = String(formData.get("organizationId") ?? "");
  const enabledModules = formData
    .getAll("modules")
    .map((v) => String(v))
    .filter((key): key is ModuleKey => (VALID_MODULE_KEYS as string[]).includes(key));

  if (!organizationId) {
    return { error: "Organisation requise." };
  }

  const admin = await platformPrisma.platformAdmin.findUniqueOrThrow({
    where: { id: ctx.platformAdminId },
  });

  await withSystemTenantContext(organizationId, async (tx) => {
    const before = await tx.organization.findUniqueOrThrow({ where: { id: organizationId } });

    await tx.organization.update({
      where: { id: organizationId },
      data: { enabledModules },
    });

    await recordAuditLog(tx, {
      organizationId,
      userId: null,
      action: "PLATFORM_MODULES_UPDATED",
      entite: "organization",
      entiteId: organizationId,
      avant: { enabledModules: before.enabledModules },
      apres: { enabledModules, platformAdminEmail: admin.email },
    });
  });

  revalidatePath("/platform");
  return { error: null };
}

export type UpdateOwnerCredentialsState = { error: string | null };

// Récupération d'accès (section 9) : le Propriétaire est le rôle fondateur
// unique de l'organisation (attribué à la création, app/platform/(authenticated)/new/actions.ts)
// — c'est systématiquement lui qu'un client a perdu quand il "a oublié ses
// identifiants". Changer le mot de passe efface aussi le verrouillage par
// tentatives échouées (failedAttempts/lockedUntil, lib/auth/session.ts) :
// un compte qu'on vient de recréditer ne doit pas rester bloqué par
// l'ancien mot de passe qu'on abandonne.
export async function updateOrganizationOwnerCredentials(
  _prevState: UpdateOwnerCredentialsState,
  formData: FormData,
): Promise<UpdateOwnerCredentialsState> {
  const ctx = await getPlatformAdminContext();

  const organizationId = String(formData.get("organizationId") ?? "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!organizationId || !email) {
    return { error: "Organisation et email sont requis." };
  }
  if (password && password.length < 8) {
    return { error: "Le mot de passe doit faire au moins 8 caractères (ou laissez-le vide)." };
  }

  const admin = await platformPrisma.platformAdmin.findUniqueOrThrow({
    where: { id: ctx.platformAdminId },
  });

  try {
    await withSystemTenantContext(organizationId, async (tx) => {
      const owner = await tx.user.findFirst({
        where: { organizationId, role: "PROPRIETAIRE" },
      });
      if (!owner) {
        throw new Error("NO_OWNER");
      }

      await tx.user.update({
        where: { id: owner.id },
        data: {
          email,
          failedAttempts: 0,
          lockedUntil: null,
          ...(password ? { hash: await hashPassword(password) } : {}),
        },
      });

      await recordAuditLog(tx, {
        organizationId,
        userId: null,
        action: "PLATFORM_OWNER_CREDENTIALS_UPDATED",
        entite: "user",
        entiteId: owner.id,
        avant: { email: owner.email },
        // Jamais le mot de passe en clair ni son hash — seulement le fait
        // qu'il a été changé.
        apres: { email, passwordChanged: password.length > 0, platformAdminEmail: admin.email },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "NO_OWNER") {
      return { error: "Aucun compte Propriétaire trouvé pour cette organisation." };
    }
    if (isUniqueViolation(error)) {
      return { error: "Cet email est déjà utilisé par un autre compte de cette organisation." };
    }
    throw error;
  }

  revalidatePath("/platform");
  return { error: null };
}

export type DeleteOrganizationState = { error: string | null };

// Suppression totale (irréversible) : chaque table métier a organization_id
// en FK RESTRICT vers organizations (aucun onDelete: Cascade dans le schéma
// — décision délibérée, RESTRICT reste le garde-fou par défaut contre toute
// AUTRE suppression accidentelle ailleurs dans le code). Cette action est
// donc la SEULE voie de suppression : elle vide chaque table dépendante
// dans l'ordre exact de leurs dépendances (les tables "feuilles" d'abord),
// dans une unique transaction système (systemPrisma, contourne RLS) — si un
// ordre est faux quelque part, Postgres refuse avec une violation de FK et
// la transaction entière s'annule, jamais de suppression partielle.
export async function deleteOrganization(
  _prevState: DeleteOrganizationState,
  formData: FormData,
): Promise<DeleteOrganizationState> {
  const ctx = await getPlatformAdminContext();

  const organizationId = String(formData.get("organizationId") ?? "");
  const confirmSlug = String(formData.get("confirmSlug") ?? "").trim();

  if (!organizationId) {
    return { error: "Organisation requise." };
  }

  const organization = await systemPrisma.organization.findUnique({
    where: { id: organizationId },
  });
  if (!organization) {
    return { error: "Organisation introuvable." };
  }
  // Revalidé côté serveur (jamais fait confiance à la seule désactivation
  // du bouton côté client) : le texte tapé doit correspondre exactement au
  // slug de l'organisation qu'on s'apprête à effacer.
  if (confirmSlug !== organization.slug) {
    return { error: "Le texte de confirmation ne correspond pas au sous-domaine de la boutique." };
  }

  const admin = await platformPrisma.platformAdmin.findUniqueOrThrow({
    where: { id: ctx.platformAdminId },
  });

  await systemPrisma.$transaction(async (tx) => {
    const where = { organizationId };

    // 1) Tables sans aucune autre table métier qui les référence.
    await tx.organizationBranding.deleteMany({ where });
    await tx.platformPayment.deleteMany({ where });
    await tx.userShop.deleteMany({ where });
    await tx.session.deleteMany({ where });
    await tx.productImage.deleteMany({ where });
    await tx.shopPrice.deleteMany({ where });
    await tx.stockLevel.deleteMany({ where });
    await tx.stockMovement.deleteMany({ where });
    await tx.payment.deleteMany({ where });
    await tx.onlineOrderLine.deleteMany({ where });
    await tx.stockAlert.deleteMany({ where });
    await tx.importBatch.deleteMany({ where });
    await tx.customerLedger.deleteMany({ where });
    await tx.loyaltyLedger.deleteMany({ where });
    await tx.customerCategoryPrice.deleteMany({ where });
    await tx.supplierProduct.deleteMany({ where });
    await tx.purchaseOrderLine.deleteMany({ where });
    await tx.goodsReceiptLine.deleteMany({ where });
    await tx.supplierLedger.deleteMany({ where });
    await tx.expense.deleteMany({ where });
    await tx.cashMovement.deleteMany({ where });
    await tx.inventoryCount.deleteMany({ where });
    await tx.stockTransferLine.deleteMany({ where });
    await tx.serialNumber.deleteMany({ where });
    await tx.auditLog.deleteMany({ where });

    // 2) Devenues sans dépendant après (1).
    await tx.user.deleteMany({ where });
    await tx.saleLine.deleteMany({ where });
    await tx.goodsReceipt.deleteMany({ where });
    await tx.inventorySession.deleteMany({ where });
    await tx.stockTransfer.deleteMany({ where });
    await tx.onlineOrder.deleteMany({ where });
    await tx.lot.deleteMany({ where });

    // 3) Devenues sans dépendant après (2).
    await tx.sale.deleteMany({ where });
    await tx.purchaseOrder.deleteMany({ where });
    await tx.productVariant.deleteMany({ where });

    // 4) Devenues sans dépendant après (3).
    await tx.product.deleteMany({ where });
    await tx.cashSession.deleteMany({ where });
    await tx.supplier.deleteMany({ where });
    await tx.customer.deleteMany({ where });

    // 5) Devenues sans dépendant après (4).
    await tx.category.deleteMany({ where });
    await tx.register.deleteMany({ where });

    // 6) Shop ne dépend plus que de (5).
    await tx.shop.deleteMany({ where });

    // 7) Plus rien ne référence l'organisation elle-même.
    await tx.organization.delete({ where: { id: organizationId } });
  });

  // Aucun journal d'audit possible ici : audit_logs lui-même vient d'être
  // vidé et organization_id y est une FK obligatoire — rien à rattacher
  // une fois l'organisation effacée. Trace minimale côté serveur pour
  // l'opérabilité (recherche dans les logs applicatifs en cas de besoin).
  console.log(
    `[platform] Organisation supprimée : ${organization.slug} (${organizationId}) par ${admin.email}`,
  );

  revalidatePath("/platform");
  return { error: null };
}
