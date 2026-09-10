"use server";

import { revalidatePath } from "next/cache";

import { recordAuditLog } from "@/lib/audit";
import { withTenantContext } from "@/lib/db/tenant-context";
import { assertCapability } from "@/lib/permissions-server";
import { recordSupplierLedgerEntry } from "@/lib/suppliers/ledger";
import { getTenantContext } from "@/lib/tenant/context";

export type SupplierPaymentState = { error: string | null };

export async function recordSupplierPayment(
  _prevState: SupplierPaymentState,
  formData: FormData,
): Promise<SupplierPaymentState> {
  const ctx = await getTenantContext();
  await assertCapability(ctx.role, "purchasing:manage");

  const supplierId = String(formData.get("supplierId") ?? "");
  const montant = Number(formData.get("montant") ?? NaN);
  const motif = String(formData.get("motif") ?? "").trim() || null;

  if (!supplierId || !Number.isFinite(montant) || montant <= 0) {
    return { error: "Montant (positif) requis." };
  }

  await withTenantContext({ organizationId: ctx.organizationId }, async (tx) => {
    // Un paiement réduit la dette : montant négatif dans le journal signé.
    const entry = await recordSupplierLedgerEntry(tx, {
      organizationId: ctx.organizationId,
      supplierId,
      type: "PAIEMENT",
      montant: -montant,
      userId: ctx.userId,
      motif,
    });

    await recordAuditLog(tx, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "SUPPLIER_PAYMENT_RECORDED",
      entite: "supplier_ledger",
      entiteId: entry.id,
      apres: { supplierId, montant },
    });
  });

  revalidatePath(`/suppliers/${supplierId}`);
  revalidatePath("/suppliers");
  return { error: null };
}

export type SupplierUpdateState = { error: string | null };

export async function updateSupplier(
  _prevState: SupplierUpdateState,
  formData: FormData,
): Promise<SupplierUpdateState> {
  const ctx = await getTenantContext();
  await assertCapability(ctx.role, "suppliers:manage");

  const supplierId = String(formData.get("supplierId") ?? "");
  const delaiRaw = String(formData.get("delaiLivraisonJours") ?? "").trim();
  const delaiLivraisonJours = delaiRaw ? Number(delaiRaw) : null;
  const actif = formData.get("actif") === "on";

  if (!supplierId) return { error: "Fournisseur introuvable." };
  if (delaiLivraisonJours !== null && (!Number.isFinite(delaiLivraisonJours) || delaiLivraisonJours < 0)) {
    return { error: "Délai de livraison invalide." };
  }

  await withTenantContext({ organizationId: ctx.organizationId }, async (tx) => {
    await tx.supplier.update({
      where: { id: supplierId },
      data: { delaiLivraisonJours, actif },
    });

    await recordAuditLog(tx, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "SUPPLIER_UPDATED",
      entite: "supplier",
      entiteId: supplierId,
      apres: { delaiLivraisonJours, actif },
    });
  });

  revalidatePath(`/suppliers/${supplierId}`);
  revalidatePath("/suppliers");
  return { error: null };
}

export type SupplierProductState = { error: string | null };

export async function addSupplierProduct(
  _prevState: SupplierProductState,
  formData: FormData,
): Promise<SupplierProductState> {
  const ctx = await getTenantContext();
  await assertCapability(ctx.role, "suppliers:manage");

  const supplierId = String(formData.get("supplierId") ?? "");
  const variantId = String(formData.get("variantId") ?? "");
  const prixAchatDernier = Number(formData.get("prixAchatDernier") ?? NaN);
  const estPrefere = formData.get("estPrefere") === "on";

  if (!supplierId || !variantId || !Number.isFinite(prixAchatDernier) || prixAchatDernier < 0) {
    return { error: "Produit et prix d'achat (valide) requis." };
  }

  await withTenantContext({ organizationId: ctx.organizationId }, async (tx) => {
    await tx.supplierProduct.upsert({
      where: { supplierId_variantId: { supplierId, variantId } },
      create: { organizationId: ctx.organizationId, supplierId, variantId, prixAchatDernier, estPrefere },
      update: { prixAchatDernier, estPrefere },
    });

    await recordAuditLog(tx, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "SUPPLIER_PRODUCT_LINKED",
      entite: "supplier_product",
      entiteId: supplierId,
      apres: { variantId, prixAchatDernier, estPrefere },
    });
  });

  revalidatePath(`/suppliers/${supplierId}`);
  return { error: null };
}
