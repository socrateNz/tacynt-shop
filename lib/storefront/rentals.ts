import type { Prisma } from "@prisma/client";

import { isRentalUnitAvailable } from "@/lib/rentals/contracts";

export type StorefrontRentalUnit = {
  id: string;
  type: string;
  designation: string;
  montantMensuel: number;
  dureeMinMois: number;
  coverImageId: string | null;
};

export type StorefrontRentalUnitDetail = StorefrontRentalUnit & {
  description: string | null;
  commissionMontant: number;
  imageIds: string[];
  available: boolean;
};

// Lecture seule : le prix/la commission/la durée minimale affichés ici ne
// sont jamais ce qu'une demande de réservation accepte (même décision
// verrouillée que le catalogue produit, #19) — au moment de la demande
// (POST /api/storefront/rental-requests), le serveur relit toujours
// RentalUnit, jamais une valeur transmise par le client.
export async function getStorefrontRentalUnits(
  tx: Prisma.TransactionClient,
  shopId: string,
): Promise<StorefrontRentalUnit[]> {
  const units = await tx.rentalUnit.findMany({
    where: { shopId, actif: true },
    include: {
      images: { select: { id: true }, orderBy: { position: "asc" }, take: 1 },
      contracts: { where: { statut: { in: ["DEMANDE", "CONFIRMEE", "EN_COURS"] } }, take: 1 },
    },
    orderBy: { designation: "asc" },
  });

  return units
    .filter((u) => u.contracts.length === 0)
    .map((u) => ({
      id: u.id,
      type: u.type,
      designation: u.designation,
      montantMensuel: Number(u.montantMensuel),
      dureeMinMois: u.dureeMinMois,
      coverImageId: u.images[0]?.id ?? null,
    }));
}

export async function getStorefrontRentalUnitDetail(
  tx: Prisma.TransactionClient,
  shopId: string,
  unitId: string,
): Promise<StorefrontRentalUnitDetail | null> {
  const unit = await tx.rentalUnit.findFirst({
    where: { id: unitId, shopId, actif: true },
    include: { images: { select: { id: true }, orderBy: { position: "asc" } } },
  });
  if (!unit) return null;

  const available = await isRentalUnitAvailable(tx, unit.id);
  const imageIds = unit.images.map((img) => img.id);

  return {
    id: unit.id,
    type: unit.type,
    designation: unit.designation,
    description: unit.description,
    montantMensuel: Number(unit.montantMensuel),
    dureeMinMois: unit.dureeMinMois,
    commissionMontant: Number(unit.commissionMontant),
    coverImageId: imageIds[0] ?? null,
    imageIds,
    available,
  };
}
