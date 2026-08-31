import type { Prisma } from "@prisma/client";

type MoneyInput = Prisma.Decimal | number | string;

function toNumber(amount: MoneyInput): number {
  if (typeof amount === "number") return amount;
  if (typeof amount === "string") return Number(amount);
  return amount.toNumber();
}

// Formatage multi-devise (section 8 : "multi-devise, multi-langue, français
// en premier"). XOF (FCFA) n'a pas de sous-unité — Intl le gère seul.
export function formatMoney(
  amount: MoneyInput,
  currency: string,
  locale = "fr-FR",
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    currencyDisplay: "code",
  }).format(toNumber(amount));
}
