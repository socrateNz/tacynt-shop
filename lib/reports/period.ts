export type Period = { from: Date; to: Date; fromInput: string; toInput: string };

function toDateInputValue(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Par défaut : mois calendaire en cours. `to` est exclusif (fin de journée
// du jour sélectionné) pour que les bornes de requête restent de simples
// comparaisons >= / < sans arithmétique de fuseau horaire à chaque filtre.
export function parsePeriod(searchParams: {
  from?: string;
  to?: string;
}): Period {
  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const from = searchParams.from ? new Date(`${searchParams.from}T00:00:00`) : defaultFrom;
  const to = searchParams.to
    ? new Date(new Date(`${searchParams.to}T00:00:00`).getTime() + 24 * 60 * 60 * 1000)
    : defaultTo;

  const validFrom = Number.isNaN(from.getTime()) ? defaultFrom : from;
  const validTo = Number.isNaN(to.getTime()) ? defaultTo : to;

  return {
    from: validFrom,
    to: validTo,
    fromInput: toDateInputValue(validFrom),
    toInput: toDateInputValue(new Date(validTo.getTime() - 24 * 60 * 60 * 1000)),
  };
}
