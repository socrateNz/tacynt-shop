// Libellés français du type de logement — une seule source (admin, vitrine,
// filtres) plutôt que la même liste recopiée à chaque endroit qui en a
// besoin, pour ne jamais risquer qu'un type ajouté plus tard n'oublie l'un
// des points d'usage.
export const RENTAL_UNIT_TYPES: { value: string; label: string }[] = [
  { value: "CHAMBRE", label: "Chambre" },
  { value: "STUDIO", label: "Studio" },
  { value: "APPARTEMENT", label: "Appartement" },
  { value: "VILLA", label: "Villa" },
  { value: "AUTRE", label: "Autre" },
];

export const RENTAL_UNIT_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  RENTAL_UNIT_TYPES.map((t) => [t.value, t.label]),
);
