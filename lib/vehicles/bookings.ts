import type { Prisma } from "@prisma/client";

import { billedDays, bookingTotal, dayKey, MAX_BOOKING_DAYS, resolveWithDriver, todayUtc } from "./types";

// Une réservation n'occupe un exemplaire qu'une fois acceptée : plusieurs
// demandes (DEMANDE) peuvent coexister sur les mêmes dates, même règle que
// les logements (lib/rentals/contracts.ts).
export const OCCUPYING_BOOKING_STATUSES = ["CONFIRMEE", "EN_COURS"] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

type Range = { dateDebut: Date; dateFin: Date };

/**
 * Plus grand nombre d'exemplaires occupés le même jour sur [dateDebut,
 * dateFin] (jours de prise et de retour inclus). Calcul exact jour par
 * jour : deux réservations qui chevauchent la période demandée sans se
 * chevaucher entre elles n'occupent qu'UN exemplaire à la fois.
 */
export function maxConcurrent(bookings: Range[], range: Range): number {
  let max = 0;
  for (let t = range.dateDebut.getTime(); t <= range.dateFin.getTime(); t += DAY_MS) {
    let count = 0;
    for (const b of bookings) {
      if (b.dateDebut.getTime() <= t && b.dateFin.getTime() >= t) count++;
    }
    if (count > max) max = count;
  }
  return max;
}

/** Exemplaires encore libres sur toute la période (0 = complet). */
export async function availableUnits(
  tx: Prisma.TransactionClient,
  vehicle: { id: string; quantite: number },
  range: Range,
  exceptBookingId?: string,
): Promise<number> {
  const overlapping = await tx.vehicleBooking.findMany({
    where: {
      vehicleId: vehicle.id,
      statut: { in: [...OCCUPYING_BOOKING_STATUSES] },
      dateDebut: { lte: range.dateFin },
      dateFin: { gte: range.dateDebut },
      ...(exceptBookingId ? { id: { not: exceptBookingId } } : {}),
    },
    select: { dateDebut: true, dateFin: true },
  });
  return Math.max(0, vehicle.quantite - maxConcurrent(overlapping, range));
}

/**
 * Exemplaires libres AUJOURD'HUI pour une liste de véhicules, en une seule
 * requête (catalogue admin, vitrine, app).
 */
export async function availableTodayByVehicle(
  db: Pick<Prisma.TransactionClient, "vehicleBooking">,
  vehicles: { id: string; quantite: number }[],
): Promise<Map<string, number>> {
  const today = todayUtc();
  const result = new Map<string, number>();
  if (vehicles.length === 0) return result;
  const busy = await db.vehicleBooking.groupBy({
    by: ["vehicleId"],
    where: {
      vehicleId: { in: vehicles.map((v) => v.id) },
      statut: { in: [...OCCUPYING_BOOKING_STATUSES] },
      dateDebut: { lte: today },
      dateFin: { gte: today },
    },
    _count: { _all: true },
  });
  const busyById = new Map(busy.map((b) => [b.vehicleId, b._count._all]));
  for (const v of vehicles) result.set(v.id, Math.max(0, v.quantite - (busyById.get(v.id) ?? 0)));
  return result;
}

export class BookingError extends Error {
  constructor(
    readonly code:
      | "VEHICULE_INTROUVABLE"
      | "DATES_INVALIDES"
      | "DATE_PASSEE"
      | "DUREE_TROP_LONGUE"
      | "INDISPONIBLE",
  ) {
    super(code);
    this.name = "BookingError";
  }
}

export const BOOKING_ERROR_MESSAGES: Record<BookingError["code"], string> = {
  VEHICULE_INTROUVABLE: "Ce véhicule n'est plus proposé à la location.",
  DATES_INVALIDES: "La date de retour doit être le jour de prise ou après.",
  DATE_PASSEE: "La date de prise ne peut pas être dans le passé.",
  DUREE_TROP_LONGUE: `La location ne peut pas dépasser ${MAX_BOOKING_DAYS} jours.`,
  INDISPONIBLE: "Ce véhicule n'est plus disponible sur ces dates. Essayez d'autres dates.",
};

/**
 * Valide une réservation et calcule ses montants à partir des données
 * SERVEUR (véhicule + supplément chauffeur de la boutique) — jamais d'un
 * prix transmis par le client. Lève BookingError.
 */
export async function prepareBooking(
  tx: Prisma.TransactionClient,
  input: {
    shopId: string;
    vehicleId: string;
    dateDebut: Date;
    dateFin: Date;
    avecChauffeur: boolean;
    // Saisie par le personnel : une location déjà commencée peut être
    // enregistrée après coup.
    allowPast?: boolean;
  },
) {
  if (input.dateFin.getTime() < input.dateDebut.getTime()) throw new BookingError("DATES_INVALIDES");
  if (!input.allowPast && dayKey(input.dateDebut) < dayKey(todayUtc())) throw new BookingError("DATE_PASSEE");
  const nombreJours = billedDays(input.dateDebut, input.dateFin);
  if (nombreJours > MAX_BOOKING_DAYS) throw new BookingError("DUREE_TROP_LONGUE");

  const vehicle = await tx.vehicle.findFirst({ where: { id: input.vehicleId, shopId: input.shopId, actif: true } });
  if (!vehicle) throw new BookingError("VEHICULE_INTROUVABLE");

  if ((await availableUnits(tx, vehicle, input)) < 1) throw new BookingError("INDISPONIBLE");

  const shop = await tx.shop.findUniqueOrThrow({
    where: { id: input.shopId },
    select: { supplementChauffeurJour: true },
  });
  const avecChauffeur = resolveWithDriver(vehicle.chauffeurMode, input.avecChauffeur);
  const prixJour = Number(vehicle.prixJour);
  const supplementChauffeurJour = avecChauffeur ? Number(shop.supplementChauffeurJour) : 0;

  return {
    vehicle,
    nombreJours,
    avecChauffeur,
    prixJour,
    supplementChauffeurJour,
    caution: vehicle.caution === null ? null : Number(vehicle.caution),
    total: bookingTotal({ prixJour, supplementChauffeurJour, avecChauffeur, nombreJours }),
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002"
  );
}

// Numéro séquentiel par boutique ("VEH-00001"), retry sur collision
// rarissime — même patron que createRentalContractWithNumero.
export async function createVehicleBookingWithNumero(
  tx: Prisma.TransactionClient,
  shopId: string,
  data: Omit<Prisma.VehicleBookingUncheckedCreateInput, "numero">,
) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const count = await tx.vehicleBooking.count({ where: { shopId } });
    const numero = `VEH-${String(count + 1 + attempt).padStart(5, "0")}`;
    try {
      return await tx.vehicleBooking.create({ data: { ...data, numero } });
    } catch (error) {
      if (!isUniqueViolation(error) || attempt === 4) throw error;
    }
  }
  throw new Error("NUMERO_INDISPONIBLE");
}
