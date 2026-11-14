import type { Prisma, Vehicle } from "@prisma/client";

import { availableTodayByVehicle } from "@/lib/vehicles/bookings";

// Vue publique d'un véhicule (vitrine web + app mobile). Les montants que
// l'administrateur a choisi de masquer ne quittent JAMAIS le serveur : null
// ici, pas un champ caché côté client.
export type PublicVehicle = {
  id: string;
  marque: string;
  modele: string;
  annee: number | null;
  description: string | null;
  tags: string[];
  // null = "Prix sur demande" (afficherPrix décoché).
  prixJour: number | null;
  chauffeurMode: string;
  // Supplément par jour si le client prend un chauffeur ; null quand le
  // prix est masqué (le supplément permettrait sinon de le deviner en
  // partie) ou quand le véhicule se loue sans chauffeur.
  supplementChauffeurJour: number | null;
  // null = pas de caution, ou caution masquée.
  caution: number | null;
  imageIds: string[];
  quantite: number;
  // Exemplaires libres aujourd'hui (0 = tous loués aujourd'hui, mais le
  // véhicule reste réservable à d'autres dates).
  disponibles: number;
};

export function toPublicVehicle(
  vehicle: Vehicle & { images: { id: string }[] },
  supplementChauffeurJour: number,
  disponibles: number,
): PublicVehicle {
  return {
    id: vehicle.id,
    marque: vehicle.marque,
    modele: vehicle.modele,
    annee: vehicle.annee,
    description: vehicle.description,
    tags: vehicle.tags,
    prixJour: vehicle.afficherPrix ? Number(vehicle.prixJour) : null,
    chauffeurMode: vehicle.chauffeurMode,
    supplementChauffeurJour:
      vehicle.afficherPrix && vehicle.chauffeurMode !== "SANS_CHAUFFEUR" ? supplementChauffeurJour : null,
    caution: vehicle.afficherCaution && vehicle.caution !== null ? Number(vehicle.caution) : null,
    imageIds: vehicle.images.map((img) => img.id),
    quantite: vehicle.quantite,
    disponibles,
  };
}

// Lecture seule : rien de ce qui est affiché ici n'est repris tel quel à la
// réservation — le serveur relit toujours le véhicule
// (lib/vehicles/bookings.ts, prepareBooking).
export async function getStorefrontVehicles(tx: Prisma.TransactionClient, shopId: string): Promise<PublicVehicle[]> {
  const [vehicles, shop] = await Promise.all([
    tx.vehicle.findMany({
      where: { shopId, actif: true },
      include: { images: { select: { id: true }, orderBy: { position: "asc" }, take: 5 } },
      orderBy: [{ marque: "asc" }, { modele: "asc" }, { annee: "desc" }],
    }),
    tx.shop.findUniqueOrThrow({ where: { id: shopId }, select: { supplementChauffeurJour: true } }),
  ]);
  const disponibles = await availableTodayByVehicle(tx, vehicles);
  const supplement = Number(shop.supplementChauffeurJour);
  return vehicles.map((v) => toPublicVehicle(v, supplement, disponibles.get(v.id) ?? 0));
}

export async function getStorefrontVehicleDetail(
  tx: Prisma.TransactionClient,
  shopId: string,
  vehicleId: string,
): Promise<PublicVehicle | null> {
  const vehicle = await tx.vehicle.findFirst({
    where: { id: vehicleId, shopId, actif: true },
    include: { images: { select: { id: true }, orderBy: { position: "asc" } } },
  });
  if (!vehicle) return null;
  const [shop, disponibles] = await Promise.all([
    tx.shop.findUniqueOrThrow({ where: { id: shopId }, select: { supplementChauffeurJour: true } }),
    availableTodayByVehicle(tx, [vehicle]),
  ]);
  return toPublicVehicle(vehicle, Number(shop.supplementChauffeurJour), disponibles.get(vehicle.id) ?? 0);
}
