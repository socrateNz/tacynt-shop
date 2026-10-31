import type { Prisma } from "@prisma/client";

// Mois calendaires, pas 30 jours fixes — un échéancier doit tomber le même
// jour chaque mois (ex. le 5), et un 31 janvier + 1 mois doit retomber sur
// le dernier jour de février, jamais déborder sur mars (dépassement natif
// de Date.setMonth sur un jour qui n'existe pas dans le mois cible).
export function addMonthsClamped(date: Date, months: number): Date {
  const day = date.getUTCDate();
  const d = new Date(date);
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDayOfTargetMonth = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate();
  d.setUTCDate(Math.min(day, lastDayOfTargetMonth));
  return d;
}

// Un logement n'a qu'un contrat actif à la fois (décision assumée du plan) —
// recalculé à la lecture, jamais un verrou applicatif complexe. DEMANDE est
// inclus : une demande en attente de validation bloque déjà le logement,
// sinon deux clients pourraient demander le même bien en même temps.
export async function isRentalUnitAvailable(
  tx: Prisma.TransactionClient,
  rentalUnitId: string,
): Promise<boolean> {
  const activeContract = await tx.rentalContract.findFirst({
    where: { rentalUnitId, statut: { in: ["DEMANDE", "CONFIRMEE", "EN_COURS"] } },
  });
  return activeContract === null;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

// Numéro séquentiel par boutique, retry sur collision rarissime — même
// patron que online_orders ("WEB-00001"), un volume de contrats de location
// ne justifie pas une infrastructure de pré-allocation comme le ticket-range
// POS.
export async function createRentalContractWithNumero(
  tx: Prisma.TransactionClient,
  shopId: string,
  data: Omit<Prisma.RentalContractUncheckedCreateInput, "numero">,
) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const count = await tx.rentalContract.count({ where: { shopId } });
    const numero = `LOC-${String(count + 1 + attempt).padStart(5, "0")}`;
    try {
      return await tx.rentalContract.create({ data: { ...data, numero } });
    } catch (error) {
      if (!isUniqueViolation(error) || attempt === 4) throw error;
    }
  }
  throw new Error("NUMERO_INDISPONIBLE");
}

// Appelée au passage DEMANDE/direct -> CONFIRMEE : une ligne par mois dû,
// jamais recalculées après coup (voir schema.prisma, RentalInstallment).
export async function generateInstallments(
  tx: Prisma.TransactionClient,
  contract: {
    id: string;
    organizationId: string;
    shopId: string;
    dateDebut: Date;
    dureeMois: number;
    montantMensuel: Prisma.Decimal | number;
  },
): Promise<void> {
  await tx.rentalInstallment.createMany({
    data: Array.from({ length: contract.dureeMois }, (_, i) => ({
      organizationId: contract.organizationId,
      shopId: contract.shopId,
      rentalContractId: contract.id,
      moisIndex: i + 1,
      echeance: addMonthsClamped(contract.dateDebut, i),
      montantDu: contract.montantMensuel,
    })),
  });
}
