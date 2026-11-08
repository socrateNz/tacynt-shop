"use server";

import { revalidatePath } from "next/cache";

import { recordAuditLog } from "@/lib/audit";
import { systemPrisma } from "@/lib/db/system-client";
import { withTenantContext } from "@/lib/db/tenant-context";
import { nextLaundryStatus, laundryCancellable } from "@/lib/laundry/types";
import { notifyLaundryRecount, notifyLaundryStatus } from "@/lib/marketplace/notifications";
import { assertCapability } from "@/lib/permissions-server";
import { getAssignedShopIds } from "@/lib/tenant/active-shop";
import { getTenantContext } from "@/lib/tenant/context";
import { organizationHasModule } from "@/lib/tenant/modules";

// Deux axes, comme Location/E-commerce : la capacité du rôle ET le module
// activé par l'admin plateforme.
async function assertLaundryAllowed() {
  const ctx = await getTenantContext();
  await assertCapability(ctx.role, "laundry:manage");
  const organization = await systemPrisma.organization.findUniqueOrThrow({ where: { id: ctx.organizationId } });
  if (!organizationHasModule(organization.enabledModules, "blanchisserie")) {
    throw new Error("Le module Blanchisserie n'est pas activé pour cette organisation.");
  }
  return ctx;
}

function parsePrice(value: FormDataEntryValue | null): number | null {
  const raw = String(value ?? "").replace(/\s/g, "").replace(",", ".");
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

// ------------------------------------------------------------- catalogue

export async function createLaundryItem(formData: FormData) {
  const ctx = await assertLaundryAllowed();
  const shopId = String(formData.get("shopId") ?? "");
  const nom = String(formData.get("nom") ?? "").trim().slice(0, 120);
  const categorie = String(formData.get("categorie") ?? "").trim().slice(0, 80) || null;
  const prix = parsePrice(formData.get("prixUnitaire"));
  if (!shopId || !nom || prix === null) throw new Error("Boutique, nom et prix par pièce sont requis.");

  await withTenantContext({ organizationId: ctx.organizationId }, async (tx) => {
    await tx.shop.findUniqueOrThrow({ where: { id: shopId } });
    const item = await tx.laundryItem.create({
      data: { organizationId: ctx.organizationId, shopId, nom, categorie, prixUnitaire: prix },
    });
    await recordAuditLog(tx, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "LAUNDRY_ITEM_CREATED",
      entite: "laundry_item",
      entiteId: item.id,
      apres: { shopId, nom, categorie, prixUnitaire: prix },
    });
  });
  revalidatePath("/laundry/items");
}

export async function updateLaundryItemPrice(formData: FormData) {
  const ctx = await assertLaundryAllowed();
  const itemId = String(formData.get("itemId") ?? "");
  const prix = parsePrice(formData.get("prixUnitaire"));
  if (!itemId || prix === null) return;

  await withTenantContext({ organizationId: ctx.organizationId }, async (tx) => {
    const item = await tx.laundryItem.findUniqueOrThrow({ where: { id: itemId } });
    await tx.laundryItem.update({ where: { id: itemId }, data: { prixUnitaire: prix } });
    await recordAuditLog(tx, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "LAUNDRY_ITEM_PRICE_CHANGED",
      entite: "laundry_item",
      entiteId: itemId,
      avant: { prixUnitaire: Number(item.prixUnitaire) },
      apres: { prixUnitaire: prix },
    });
  });
  revalidatePath("/laundry/items");
}

// Jamais de suppression : un article se désactive (il disparaît du
// catalogue client, les commandes passées gardent leur ligne figée).
export async function toggleLaundryItem(formData: FormData) {
  const ctx = await assertLaundryAllowed();
  const itemId = String(formData.get("itemId") ?? "");
  if (!itemId) return;

  await withTenantContext({ organizationId: ctx.organizationId }, async (tx) => {
    const item = await tx.laundryItem.findUniqueOrThrow({ where: { id: itemId } });
    await tx.laundryItem.update({ where: { id: itemId }, data: { actif: !item.actif } });
    await recordAuditLog(tx, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "LAUNDRY_ITEM_TOGGLED",
      entite: "laundry_item",
      entiteId: itemId,
      avant: { actif: item.actif },
      apres: { actif: !item.actif },
    });
  });
  revalidatePath("/laundry/items");
}

// ------------------------------------------------------------- commandes

const STATUS_TIMESTAMP = {
  CONFIRMEE: "confirmedAt",
  COLLECTEE: "collectedAt",
  PRETE: "readyAt",
  TERMINEE: "completedAt",
} as const;

// Fait passer la commande à l'étape suivante (et uniquement à celle-là).
// Passer en lavage sans avoir recompté vaut recomptage "conforme à la
// déclaration" (aucune régularisation).
export async function advanceLaundryOrder(formData: FormData) {
  const ctx = await assertLaundryAllowed();
  const orderId = String(formData.get("orderId") ?? "");
  if (!orderId) return;
  const myShopIds = await getAssignedShopIds(ctx.organizationId, ctx.userId);

  const changed = await withTenantContext({ organizationId: ctx.organizationId }, async (tx) => {
    const order = await tx.laundryOrder.findUniqueOrThrow({ where: { id: orderId }, include: { lines: true } });
    if (!myShopIds.includes(order.shopId)) return false;
    const next = nextLaundryStatus(order.statut);
    if (!next) return false;

    if (next === "EN_LAVAGE" && !order.recompteAt) {
      for (const line of order.lines) {
        await tx.laundryOrderLine.update({
          where: { id: line.id },
          data: { quantiteRecomptee: line.quantiteDeclaree },
        });
      }
      await tx.laundryOrder.update({
        where: { id: orderId },
        data: { montantRecompte: order.montantDeclare, regularisation: 0, recompteAt: new Date() },
      });
    }

    const stamp = next in STATUS_TIMESTAMP ? STATUS_TIMESTAMP[next as keyof typeof STATUS_TIMESTAMP] : null;
    await tx.laundryOrder.update({
      where: { id: orderId },
      data: { statut: next, ...(stamp ? { [stamp]: new Date() } : {}) },
    });

    await recordAuditLog(tx, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "LAUNDRY_ORDER_STATUS_CHANGED",
      entite: "laundry_order",
      entiteId: orderId,
      avant: { statut: order.statut },
      apres: { statut: next },
    });
    return true;
  });

  // Après le commit, jamais bloquant (client Sodu uniquement).
  if (changed) void notifyLaundryStatus(orderId);

  revalidatePath("/laundry/orders");
  revalidatePath(`/laundry/orders/${orderId}`);
}

export async function cancelLaundryOrder(formData: FormData) {
  const ctx = await assertLaundryAllowed();
  const orderId = String(formData.get("orderId") ?? "");
  if (!orderId) return;
  const myShopIds = await getAssignedShopIds(ctx.organizationId, ctx.userId);

  const cancelled = await withTenantContext({ organizationId: ctx.organizationId }, async (tx) => {
    const order = await tx.laundryOrder.findUniqueOrThrow({ where: { id: orderId } });
    if (!myShopIds.includes(order.shopId) || !laundryCancellable(order.statut)) return false;
    await tx.laundryOrder.update({ where: { id: orderId }, data: { statut: "ANNULEE", cancelledAt: new Date() } });
    await recordAuditLog(tx, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "LAUNDRY_ORDER_CANCELLED",
      entite: "laundry_order",
      entiteId: orderId,
      avant: { statut: order.statut },
    });
    return true;
  });

  if (cancelled) void notifyLaundryStatus(orderId);

  revalidatePath("/laundry/orders");
  revalidatePath(`/laundry/orders/${orderId}`);
}

export type RecountState = { error: string | null; saved?: boolean };

// Recomptage des pièces réellement reçues : quantités par ligne
// (champs "qty_<lineId>"). Calcule le montant recompté et la
// régularisation à faire au retour (positive = le client doit encore,
// négative = à lui rendre). Possible à partir de la réception du linge et
// tant que la commande n'est pas terminée.
export async function recountLaundryOrder(_prev: RecountState, formData: FormData): Promise<RecountState> {
  const ctx = await assertLaundryAllowed();
  const orderId = String(formData.get("orderId") ?? "");
  if (!orderId) return { error: "Commande introuvable." };
  const myShopIds = await getAssignedShopIds(ctx.organizationId, ctx.userId);

  try {
    await withTenantContext({ organizationId: ctx.organizationId }, async (tx) => {
      const order = await tx.laundryOrder.findUniqueOrThrow({ where: { id: orderId }, include: { lines: true } });
      if (!myShopIds.includes(order.shopId)) throw new Error("Vous n'êtes pas affecté à cette boutique.");
      if (!["COLLECTEE", "EN_LAVAGE", "PRETE"].includes(order.statut)) {
        throw new Error("Le recomptage se fait une fois le linge reçu, avant la fin de la commande.");
      }

      let montantRecompte = 0;
      const updates: { id: string; quantite: number }[] = [];
      for (const line of order.lines) {
        const raw = String(formData.get(`qty_${line.id}`) ?? "").trim();
        const quantite = Number(raw);
        if (raw === "" || !Number.isInteger(quantite) || quantite < 0 || quantite > 1000) {
          throw new Error(`Quantité invalide pour « ${line.designation} ».`);
        }
        montantRecompte += Number(line.prixUnitaire) * quantite;
        updates.push({ id: line.id, quantite });
      }

      for (const u of updates) {
        await tx.laundryOrderLine.update({ where: { id: u.id }, data: { quantiteRecomptee: u.quantite } });
      }
      const regularisation = montantRecompte - Number(order.montantDeclare);
      await tx.laundryOrder.update({
        where: { id: orderId },
        data: { montantRecompte, regularisation, recompteAt: new Date() },
      });

      await recordAuditLog(tx, {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        action: "LAUNDRY_ORDER_RECOUNTED",
        entite: "laundry_order",
        entiteId: orderId,
        avant: { montantDeclare: Number(order.montantDeclare) },
        apres: { montantRecompte, regularisation },
      });
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Recomptage impossible." };
  }

  // Prévient le client si le recomptage change le montant (sinon rien).
  void notifyLaundryRecount(orderId);

  revalidatePath("/laundry/orders");
  revalidatePath(`/laundry/orders/${orderId}`);
  return { error: null, saved: true };
}
