"use server";

import { revalidatePath } from "next/cache";

import { recordAuditLog } from "@/lib/audit";
import { recordCustomerLedgerEntry } from "@/lib/customers/ledger";
import { systemPrisma } from "@/lib/db/system-client";
import { withTenantContext } from "@/lib/db/tenant-context";
import { getLoyaltyBalance, recordLoyaltyEntry } from "@/lib/loyalty/ledger";
import { assertCapability } from "@/lib/permissions-server";
import { getTenantContext } from "@/lib/tenant/context";
import { parseOrgSettings } from "@/lib/tenant/settings";

export type PaymentFormState = { error: string | null };

export async function recordPayment(
  _prevState: PaymentFormState,
  formData: FormData,
): Promise<PaymentFormState> {
  const ctx = await getTenantContext();
  await assertCapability(ctx.role, "customers:manage");

  const customerId = String(formData.get("customerId") ?? "");
  const montant = Number(formData.get("montant") ?? NaN);
  const motif = String(formData.get("motif") ?? "").trim() || null;

  if (!customerId || !Number.isFinite(montant) || montant <= 0) {
    return { error: "Montant (positif) requis." };
  }

  await withTenantContext({ organizationId: ctx.organizationId }, async (tx) => {
    // Un paiement réduit la dette : montant négatif dans le journal signé.
    const entry = await recordCustomerLedgerEntry(tx, {
      organizationId: ctx.organizationId,
      customerId,
      type: "PAIEMENT",
      montant: -montant,
      userId: ctx.userId,
      motif,
    });

    await recordAuditLog(tx, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "CUSTOMER_PAYMENT_RECORDED",
      entite: "customer_ledger",
      entiteId: entry.id,
      apres: { customerId, montant },
    });
  });

  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/customers");
  return { error: null };
}

export type LoyaltyConversionState = { error: string | null };

// Conversion en crédit client (section 5.4, Phase 3 M21) : contrairement aux
// écritures issues d'une vente hors ligne déjà encaissée, cette action est
// une décision admin prise en direct — refuser un solde de points
// insuffisant est légitime ici, ce n'est pas annuler quelque chose qui a
// déjà eu lieu.
export async function convertLoyaltyPoints(
  _prevState: LoyaltyConversionState,
  formData: FormData,
): Promise<LoyaltyConversionState> {
  const ctx = await getTenantContext();
  await assertCapability(ctx.role, "customers:manage");

  const customerId = String(formData.get("customerId") ?? "");
  const points = Number(formData.get("points") ?? NaN);

  if (!customerId || !Number.isInteger(points) || points <= 0) {
    return { error: "Nombre de points (entier positif) requis." };
  }

  const organization = await systemPrisma.organization.findUniqueOrThrow({
    where: { id: ctx.organizationId },
  });
  const pointValue = parseOrgSettings(organization.settings).loyaltyPointValue ?? 0;
  if (pointValue <= 0) {
    return { error: "La conversion de points n'est pas activée pour cette organisation." };
  }

  try {
    await withTenantContext({ organizationId: ctx.organizationId }, async (tx) => {
      const balance = await getLoyaltyBalance(tx, customerId);
      if (points > balance) {
        throw new Error("INSUFFICIENT_POINTS");
      }

      const montant = points * pointValue;

      const loyaltyEntry = await recordLoyaltyEntry(tx, {
        organizationId: ctx.organizationId,
        customerId,
        type: "CONVERTI",
        points: -points,
        documentType: "loyalty_conversion",
      });

      // Négatif : la conversion crédite le client, comme un paiement.
      await recordCustomerLedgerEntry(tx, {
        organizationId: ctx.organizationId,
        customerId,
        type: "AJUSTEMENT",
        montant: -montant,
        documentType: "loyalty_conversion",
        documentId: loyaltyEntry.id,
        userId: ctx.userId,
        motif: `Conversion de ${points} points en crédit`,
      });

      await recordAuditLog(tx, {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        action: "LOYALTY_POINTS_CONVERTED",
        entite: "loyalty_ledger",
        entiteId: loyaltyEntry.id,
        apres: { customerId, points, montant },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_POINTS") {
      return { error: "Solde de points insuffisant." };
    }
    throw error;
  }

  revalidatePath(`/customers/${customerId}`);
  return { error: null };
}

export type CustomerUpdateState = { error: string | null };

export async function updateCustomer(
  _prevState: CustomerUpdateState,
  formData: FormData,
): Promise<CustomerUpdateState> {
  const ctx = await getTenantContext();
  await assertCapability(ctx.role, "customers:manage");

  const customerId = String(formData.get("customerId") ?? "");
  const categorieTarif = String(formData.get("categorieTarif") ?? "").trim();
  const plafondCredit = Number(formData.get("plafondCredit") ?? NaN);
  const actif = formData.get("actif") === "on";

  if (!customerId || !Number.isFinite(plafondCredit) || plafondCredit < 0) {
    return { error: "Plafond de crédit (valide) requis." };
  }

  await withTenantContext({ organizationId: ctx.organizationId }, async (tx) => {
    await tx.customer.update({
      where: { id: customerId },
      data: { categorieTarif, plafondCredit, actif },
    });

    await recordAuditLog(tx, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "CUSTOMER_UPDATED",
      entite: "customer",
      entiteId: customerId,
      apres: { categorieTarif, plafondCredit, actif },
    });
  });

  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/customers");
  return { error: null };
}
