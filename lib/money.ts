import type { Prisma } from "@prisma/client";

type MoneyInput = Prisma.Decimal | number | string;

function toNumber(amount: MoneyInput): number {
  if (typeof amount === "number") return amount;
  if (typeof amount === "string") return Number(amount);
  return amount.toNumber();
}

// Formatage multi-devise (section 8 : "multi-devise, multi-langue, français
// en premier"). XOF (FCFA) n'a pas de sous-unité — Intl le gère seul.
// currencyDisplay "symbol" plutôt que "code" (M39) : affiche le vrai signe
// quand Intl en connaît un pour la locale (€ pour EUR, $US pour USD, F CFA
// pour XOF...) et retombe de lui-même sur le code ISO sinon (GNF, NGN,
// GHS, MAD, CDF n'ont pas de signe distinct en fr-FR) — jamais besoin de
// gérer cette liste à la main, Intl le fait déjà correctement.
export function formatMoney(
  amount: MoneyInput,
  currency: string,
  locale = "fr-FR",
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    currencyDisplay: "symbol",
  }).format(toNumber(amount));
}
