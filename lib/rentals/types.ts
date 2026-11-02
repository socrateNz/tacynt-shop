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

// Liste fixe cochable (pas de texte libre) — même principe qu'un enum
// Prisma plutôt qu'une table de référence, une seule source pour le
// formulaire admin et l'affichage vitrine.
export const RENTAL_UNIT_AMENITIES: { value: string; label: string }[] = [
  { value: "WIFI", label: "Wifi" },
  { value: "PARKING", label: "Parking" },
  { value: "CLIMATISATION", label: "Climatisation" },
  { value: "MEUBLE", label: "Meublé" },
  { value: "CUISINE_EQUIPEE", label: "Cuisine équipée" },
  { value: "SALLE_BAIN_PRIVEE", label: "Salle de bain privée" },
  { value: "SECURITE", label: "Sécurité / gardiennage" },
  { value: "ASCENSEUR", label: "Ascenseur" },
  { value: "BALCON", label: "Balcon / terrasse" },
  { value: "EAU_INCLUSE", label: "Eau incluse" },
  { value: "ELECTRICITE_INCLUSE", label: "Électricité incluse" },
];

export const RENTAL_UNIT_AMENITY_LABELS: Record<string, string> = Object.fromEntries(
  RENTAL_UNIT_AMENITIES.map((a) => [a.value, a.label]),
);

// "Quartier, Ville" si le logement a un quartier rattaché à une ville,
// sinon juste "Ville", sinon null — une seule fonction partagée entre le
// tableau admin et la vitrine plutôt que recopier la même logique.
export function formatLocalityLabel(
  locality: { nom: string; parent?: { nom: string } | null } | null | undefined,
): string | null {
  if (!locality) return null;
  return locality.parent ? `${locality.nom}, ${locality.parent.nom}` : locality.nom;
}
