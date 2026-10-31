import { NextResponse } from "next/server";

import { recordAuditLog } from "@/lib/audit";
import { withTenantContext } from "@/lib/db/tenant-context";
import { createRentalContractWithNumero, isRentalUnitAvailable } from "@/lib/rentals/contracts";
import { resolveStorefrontOrganization, resolveStorefrontShopId } from "@/lib/storefront/context";

// Public (aucune session) : demande de réservation depuis la vitrine
// location, en attente de validation du personnel (statut DEMANDE) — jamais
// une valeur transmise par le client acceptée sans recheck (durée minimale,
// disponibilité, montants), même discipline que /api/storefront/orders.
export async function POST(request: Request) {
  const host = request.headers.get("host") ?? "";
  const organization = await resolveStorefrontOrganization(host, "location");
  if (!organization) {
    return NextResponse.json({ error: "Boutique introuvable." }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as {
    shopId?: string;
    rentalUnitId?: string;
    nomClient?: string;
    telephoneClient?: string;
    dateDebut?: string;
    dureeMois?: number;
  } | null;

  if (!body) {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const shopId = await resolveStorefrontShopId(organization.id, body.shopId ?? null);
  const rentalUnitId = String(body.rentalUnitId ?? "");
  const nomClient = String(body.nomClient ?? "").trim();
  const telephoneClient = String(body.telephoneClient ?? "").trim();
  const dateDebut = body.dateDebut ? new Date(body.dateDebut) : null;
  const dureeMois = Math.trunc(Number(body.dureeMois ?? 0));

  if (
    !shopId ||
    !rentalUnitId ||
    !nomClient ||
    !telephoneClient ||
    !dateDebut ||
    Number.isNaN(dateDebut.getTime()) ||
    !Number.isFinite(dureeMois) ||
    dureeMois < 1
  ) {
    return NextResponse.json(
      { error: "Logement, contact, date de début et durée sont requis." },
      { status: 400 },
    );
  }

  try {
    const contract = await withTenantContext({ organizationId: organization.id, shopId }, async (tx) => {
      const unit = await tx.rentalUnit.findFirst({ where: { id: rentalUnitId, shopId, actif: true } });
      if (!unit) {
        throw new Error("LOGEMENT_INTROUVABLE");
      }
      if (dureeMois < unit.dureeMinMois) {
        throw new Error(`DUREE_INSUFFISANTE:${unit.dureeMinMois}`);
      }
      if (!(await isRentalUnitAvailable(tx, rentalUnitId))) {
        throw new Error("LOGEMENT_INDISPONIBLE");
      }

      // Client léger, recherche souple par téléphone — même principe que
      // /api/storefront/orders, jamais de contrainte unique nouvelle.
      let customer = await tx.customer.findFirst({
        where: { organizationId: organization.id, telephone: telephoneClient },
      });
      if (!customer) {
        customer = await tx.customer.create({
          data: { organizationId: organization.id, nom: nomClient, telephone: telephoneClient },
        });
      }

      const created = await createRentalContractWithNumero(tx, shopId, {
        organizationId: organization.id,
        shopId,
        rentalUnitId,
        customerId: customer.id,
        nomClient,
        telephoneClient,
        statut: "DEMANDE",
        dateDebut,
        dureeMois,
        montantMensuel: unit.montantMensuel,
        commissionMontant: unit.commissionMontant,
      });

      await recordAuditLog(tx, {
        organizationId: organization.id,
        userId: null,
        action: "RENTAL_CONTRACT_REQUESTED",
        entite: "rental_contract",
        entiteId: created.id,
        apres: { numero: created.numero, rentalUnitId, dureeMois },
      });

      return created;
    });

    return NextResponse.json({ id: contract.id, numero: contract.numero });
  } catch (error) {
    if (error instanceof Error && error.message === "LOGEMENT_INTROUVABLE") {
      return NextResponse.json({ error: "Ce logement n'est plus disponible." }, { status: 400 });
    }
    if (error instanceof Error && error.message === "LOGEMENT_INDISPONIBLE") {
      return NextResponse.json({ error: "Ce logement vient d'être réservé par un autre client." }, { status: 400 });
    }
    if (error instanceof Error && error.message.startsWith("DUREE_INSUFFISANTE:")) {
      const [, min] = error.message.split(":");
      return NextResponse.json({ error: `La durée minimale pour ce logement est de ${min} mois.` }, { status: 400 });
    }
    throw error;
  }
}
