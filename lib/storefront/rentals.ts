import type { Prisma } from "@prisma/client";

import { isRentalUnitAvailable, OCCUPYING_STATUSES } from "@/lib/rentals/contracts";

export type StorefrontRentalUnitLocality = { nom: string; villeNom: string | null };

export type StorefrontRentalUnit = {
  id: string;
  type: string;
  designation: string;
  description: string | null;
  montantMensuel: number;
  dureeMinMois: number;
  imageIds: string[];
  locality: StorefrontRentalUnitLocality | null;
  surfaceM2: number | null;
  nombrePieces: number | null;
  equipements: string[];
};

export type StorefrontRentalUnitDetail = StorefrontRentalUnit & {
  commissionMontant: number;
  available: boolean;
};

const LOCALITY_INCLUDE = { locality: { include: { parent: true } } } as const;

function toLocality(
  unit: { locality: { nom: string; parent: { nom: string } | null } | null },
): StorefrontRentalUnitLocality | null {
  if (!unit.locality) return null;
  return { nom: unit.locality.nom, villeNom: unit.locality.parent?.nom ?? null };
}

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
      // take: 5 pour alimenter le mini-carrousel de la carte (app/rental-unit-card.tsx),
      // jamais toutes les images — même limite d'esprit que product-card (1 seule) mais
      // les logements bénéficient d'un vrai carrousel comme sur la fiche détail.
      images: { select: { id: true }, orderBy: { position: "asc" }, take: 5 },
      contracts: { where: { statut: { in: [...OCCUPYING_STATUSES] } }, take: 1 },
      ...LOCALITY_INCLUDE,
    },
    orderBy: { designation: "asc" },
  });

  return units
    .filter((u) => u.contracts.length === 0)
    .map((u) => ({
      id: u.id,
      type: u.type,
      designation: u.designation,
      description: u.description,
      montantMensuel: Number(u.montantMensuel),
      dureeMinMois: u.dureeMinMois,
      imageIds: u.images.map((img) => img.id),
      locality: toLocality(u),
      surfaceM2: u.surfaceM2,
      nombrePieces: u.nombrePieces,
      equipements: u.equipements,
    }));
}

export async function getStorefrontRentalUnitDetail(
  tx: Prisma.TransactionClient,
  shopId: string,
  unitId: string,
): Promise<StorefrontRentalUnitDetail | null> {
  const unit = await tx.rentalUnit.findFirst({
    where: { id: unitId, shopId, actif: true },
    include: { images: { select: { id: true }, orderBy: { position: "asc" } }, ...LOCALITY_INCLUDE },
  });
  if (!unit) return null;

  const available = await isRentalUnitAvailable(tx, unit.id);

  return {
    id: unit.id,
    type: unit.type,
    designation: unit.designation,
    description: unit.description,
    montantMensuel: Number(unit.montantMensuel),
    dureeMinMois: unit.dureeMinMois,
    commissionMontant: Number(unit.commissionMontant),
    imageIds: unit.images.map((img) => img.id),
    locality: toLocality(unit),
    surfaceM2: unit.surfaceM2,
    nombrePieces: unit.nombrePieces,
    equipements: unit.equipements,
    available,
  };
}
