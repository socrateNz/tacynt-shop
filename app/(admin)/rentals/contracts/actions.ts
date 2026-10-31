"use server";

import { revalidatePath } from "next/cache";
import type { RentalPaymentMode } from "@prisma/client";

import { recordAuditLog } from "@/lib/audit";
import { systemPrisma } from "@/lib/db/system-client";
import { withTenantContext } from "@/lib/db/tenant-context";
import { assertCapability } from "@/lib/permissions-server";
import {
  createRentalContractWithNumero,
  generateInstallments,
  isRentalUnitAvailable,
} from "@/lib/rentals/contracts";
import { getActiveShopId, getAssignedShopIds } from "@/lib/tenant/active-shop";
import { getTenantContext } from "@/lib/tenant/context";
import { organizationHasModule } from "@/lib/tenant/modules";

const PAYMENT_MODES: RentalPaymentMode[] = ["ESPECES", "MOBILE_MONEY", "CARTE", "VIREMENT"];

async function assertLocationAllowed(
  organizationId: string,
  role: Parameters<typeof assertCapability>[0],
) {
  await assertCapability(role, "location:manage");
  const organization = await systemPrisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
  });
  if (!organizationHasModule(organization.enabledModules, "location")) {
    throw new Error("Le module Location n'est pas activé pour cette organisation.");
  }
}

// Saisie directe par le personnel : pas besoin de passer par DEMANDE (qui
// n'existe que pour une requête venue de la vitrine, en attente de
// validation) — le contrat est créé déjà CONFIRMEE et son échéancier généré
// immédiatement.
export async function createContractByStaff(formData: FormData) {
  const ctx = await getTenantContext();
  await assertLocationAllowed(ctx.organizationId, ctx.role);

  const rentalUnitId = String(formData.get("rentalUnitId") ?? "");
  const nomClient = String(formData.get("nomClient") ?? "").trim();
  const telephoneClient = String(formData.get("telephoneClient") ?? "").trim();
  const dateDebutRaw = String(formData.get("dateDebut") ?? "");
  const dureeMois = Math.trunc(Number(formData.get("dureeMois") ?? 0));

  if (
    !rentalUnitId ||
    !nomClient ||
    !telephoneClient ||
    !dateDebutRaw ||
    !Number.isFinite(dureeMois) ||
    dureeMois < 1
  ) {
    throw new Error("Logement, client, date de début et durée sont requis.");
  }
  const dateDebut = new Date(dateDebutRaw);
  if (Number.isNaN(dateDebut.getTime())) {
    throw new Error("Date de début invalide.");
  }

  const shopId = await getActiveShopId(ctx.organizationId, ctx.userId);

  await withTenantContext({ organizationId: ctx.organizationId, shopId }, async (tx) => {
    const unit = await tx.rentalUnit.findUniqueOrThrow({ where: { id: rentalUnitId } });
    if (!unit.actif) throw new Error("Ce logement n'est plus actif.");
    // Jamais la durée transmise par le client acceptée sans recheck — même
    // discipline que le prix/stock sur /api/storefront/orders.
    if (dureeMois < unit.dureeMinMois) {
      throw new Error(`La durée minimale pour ce logement est de ${unit.dureeMinMois} mois.`);
    }
    if (!(await isRentalUnitAvailable(tx, rentalUnitId))) {
      throw new Error("Ce logement n'est plus disponible.");
    }

    // Client léger, recherche souple par téléphone — même principe que
    // /api/storefront/orders, jamais de contrainte unique nouvelle.
    let customer = await tx.customer.findFirst({
      where: { organizationId: ctx.organizationId, telephone: telephoneClient },
    });
    if (!customer) {
      customer = await tx.customer.create({
        data: { organizationId: ctx.organizationId, nom: nomClient, telephone: telephoneClient },
      });
    }

    const contract = await createRentalContractWithNumero(tx, shopId, {
      organizationId: ctx.organizationId,
      shopId,
      rentalUnitId,
      customerId: customer.id,
      nomClient,
      telephoneClient,
      statut: "CONFIRMEE",
      dateDebut,
      dureeMois,
      montantMensuel: unit.montantMensuel,
      commissionMontant: unit.commissionMontant,
      confirmedAt: new Date(),
    });

    await generateInstallments(tx, {
      id: contract.id,
      organizationId: ctx.organizationId,
      shopId,
      dateDebut,
      dureeMois,
      montantMensuel: unit.montantMensuel,
    });

    await recordAuditLog(tx, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "RENTAL_CONTRACT_CREATED",
      entite: "rental_contract",
      entiteId: contract.id,
      apres: { numero: contract.numero, dureeMois, rentalUnitId },
    });
  });

  revalidatePath("/rentals/contracts");
}

// Validation d'une demande venue de la vitrine (DEMANDE -> CONFIRMEE) :
// génère l'échéancier à ce moment, jamais avant (une demande non validée ne
// doit rien engager).
export async function confirmContract(formData: FormData) {
  const ctx = await getTenantContext();
  await assertLocationAllowed(ctx.organizationId, ctx.role);

  const contractId = String(formData.get("contractId") ?? "");
  if (!contractId) return;

  const myShopIds = await getAssignedShopIds(ctx.organizationId, ctx.userId);

  await withTenantContext({ organizationId: ctx.organizationId }, async (tx) => {
    const contract = await tx.rentalContract.findUniqueOrThrow({ where: { id: contractId } });
    if (!myShopIds.includes(contract.shopId)) return;
    if (contract.statut !== "DEMANDE") return;

    await tx.rentalContract.update({
      where: { id: contractId },
      data: { statut: "CONFIRMEE", confirmedAt: new Date() },
    });

    await generateInstallments(tx, {
      id: contract.id,
      organizationId: contract.organizationId,
      shopId: contract.shopId,
      dateDebut: contract.dateDebut,
      dureeMois: contract.dureeMois,
      montantMensuel: contract.montantMensuel,
    });

    await recordAuditLog(tx, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "RENTAL_CONTRACT_CONFIRMED",
      entite: "rental_contract",
      entiteId: contractId,
    });
  });

  revalidatePath("/rentals/contracts");
  revalidatePath(`/rentals/contracts/${contractId}`);
}

// Annulable à tout moment avant EN_COURS (avant encaissement de l'acompte) —
// une fois le locataire en place, seule la résiliation (terminateContract)
// s'applique.
export async function cancelContract(formData: FormData) {
  const ctx = await getTenantContext();
  await assertLocationAllowed(ctx.organizationId, ctx.role);

  const contractId = String(formData.get("contractId") ?? "");
  if (!contractId) return;

  const myShopIds = await getAssignedShopIds(ctx.organizationId, ctx.userId);

  await withTenantContext({ organizationId: ctx.organizationId }, async (tx) => {
    const contract = await tx.rentalContract.findUniqueOrThrow({ where: { id: contractId } });
    if (!myShopIds.includes(contract.shopId)) return;
    if (contract.statut === "EN_COURS" || contract.statut === "TERMINEE" || contract.statut === "ANNULEE") {
      return;
    }

    await tx.rentalContract.update({
      where: { id: contractId },
      data: { statut: "ANNULEE", cancelledAt: new Date() },
    });

    await recordAuditLog(tx, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "RENTAL_CONTRACT_CANCELLED",
      entite: "rental_contract",
      entiteId: contractId,
    });
  });

  revalidatePath("/rentals/contracts");
  revalidatePath(`/rentals/contracts/${contractId}`);
}

// Résiliation manuelle (durée écoulée ou départ anticipé du locataire) — le
// logement redevient disponible, jamais une suppression.
export async function terminateContract(formData: FormData) {
  const ctx = await getTenantContext();
  await assertLocationAllowed(ctx.organizationId, ctx.role);

  const contractId = String(formData.get("contractId") ?? "");
  if (!contractId) return;

  const myShopIds = await getAssignedShopIds(ctx.organizationId, ctx.userId);

  await withTenantContext({ organizationId: ctx.organizationId }, async (tx) => {
    const contract = await tx.rentalContract.findUniqueOrThrow({ where: { id: contractId } });
    if (!myShopIds.includes(contract.shopId)) return;
    if (contract.statut !== "EN_COURS") return;

    await tx.rentalContract.update({ where: { id: contractId }, data: { statut: "TERMINEE" } });

    await recordAuditLog(tx, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "RENTAL_CONTRACT_TERMINATED",
      entite: "rental_contract",
      entiteId: contractId,
    });
  });

  revalidatePath("/rentals/contracts");
  revalidatePath(`/rentals/contracts/${contractId}`);
}

// Acompte à la signature (décision verrouillée #2) : 1er mois + commission
// réglés ensemble en une seule visite du client, mais tracés comme deux
// RentalPayment distincts (installmentId NULL = commission) pour garder un
// grand livre précis — voir schema.prisma. Fait basculer le contrat en
// EN_COURS : c'est cet encaissement qui matérialise l'entrée du locataire.
export async function recordDeposit(formData: FormData) {
  const ctx = await getTenantContext();
  await assertLocationAllowed(ctx.organizationId, ctx.role);

  const contractId = String(formData.get("contractId") ?? "");
  const mode = String(formData.get("mode") ?? "") as RentalPaymentMode;
  if (!contractId || !PAYMENT_MODES.includes(mode)) {
    throw new Error("Contrat et mode de paiement requis.");
  }

  const myShopIds = await getAssignedShopIds(ctx.organizationId, ctx.userId);

  await withTenantContext({ organizationId: ctx.organizationId }, async (tx) => {
    const contract = await tx.rentalContract.findUniqueOrThrow({ where: { id: contractId } });
    if (!myShopIds.includes(contract.shopId)) throw new Error("Boutique non autorisée.");
    if (contract.statut !== "CONFIRMEE") {
      throw new Error("L'acompte ne peut être encaissé que sur un contrat confirmé.");
    }

    const firstInstallment = await tx.rentalInstallment.findUniqueOrThrow({
      where: { rentalContractId_moisIndex: { rentalContractId: contractId, moisIndex: 1 } },
    });
    if (firstInstallment.statut === "PAYEE") {
      throw new Error("Le 1er mois est déjà réglé.");
    }

    if (Number(contract.commissionMontant) > 0 && !contract.commissionPayee) {
      await tx.rentalPayment.create({
        data: {
          organizationId: ctx.organizationId,
          shopId: contract.shopId,
          rentalContractId: contractId,
          installmentId: null,
          mode,
          montant: contract.commissionMontant,
          userId: ctx.userId,
        },
      });
    }

    await tx.rentalPayment.create({
      data: {
        organizationId: ctx.organizationId,
        shopId: contract.shopId,
        rentalContractId: contractId,
        installmentId: firstInstallment.id,
        mode,
        montant: firstInstallment.montantDu,
        userId: ctx.userId,
      },
    });

    await tx.rentalInstallment.update({
      where: { id: firstInstallment.id },
      data: { statut: "PAYEE", payeLe: new Date() },
    });

    await tx.rentalContract.update({
      where: { id: contractId },
      data: { commissionPayee: true, statut: "EN_COURS" },
    });

    await recordAuditLog(tx, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "RENTAL_DEPOSIT_RECORDED",
      entite: "rental_contract",
      entiteId: contractId,
      apres: { mode },
    });
  });

  revalidatePath(`/rentals/contracts/${contractId}`);
}

// Paiement d'un mois suivant, un à la fois — le personnel choisit quelle
// échéance DUE il encaisse (voir contract-detail-client.tsx), jamais un
// paiement générique dont la cible serait ambiguë.
export async function recordInstallmentPayment(formData: FormData) {
  const ctx = await getTenantContext();
  await assertLocationAllowed(ctx.organizationId, ctx.role);

  const installmentId = String(formData.get("installmentId") ?? "");
  const mode = String(formData.get("mode") ?? "") as RentalPaymentMode;
  if (!installmentId || !PAYMENT_MODES.includes(mode)) {
    throw new Error("Échéance et mode de paiement requis.");
  }

  const myShopIds = await getAssignedShopIds(ctx.organizationId, ctx.userId);

  let contractId = "";
  await withTenantContext({ organizationId: ctx.organizationId }, async (tx) => {
    const installment = await tx.rentalInstallment.findUniqueOrThrow({
      where: { id: installmentId },
      include: { rentalContract: true },
    });
    contractId = installment.rentalContractId;
    if (!myShopIds.includes(installment.shopId)) throw new Error("Boutique non autorisée.");
    if (installment.rentalContract.statut !== "EN_COURS") {
      throw new Error("Ce contrat n'est pas en cours.");
    }
    if (installment.statut === "PAYEE") {
      throw new Error("Cette échéance est déjà réglée.");
    }

    await tx.rentalPayment.create({
      data: {
        organizationId: ctx.organizationId,
        shopId: installment.shopId,
        rentalContractId: installment.rentalContractId,
        installmentId: installment.id,
        mode,
        montant: installment.montantDu,
        userId: ctx.userId,
      },
    });

    await tx.rentalInstallment.update({
      where: { id: installment.id },
      data: { statut: "PAYEE", payeLe: new Date() },
    });

    await recordAuditLog(tx, {
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: "RENTAL_INSTALLMENT_PAID",
      entite: "rental_installment",
      entiteId: installment.id,
      apres: { mode, moisIndex: installment.moisIndex },
    });
  });

  revalidatePath(`/rentals/contracts/${contractId}`);
}
