// Libellés et calculs purs du module Location de véhicules — importable
// depuis un Client Component (aucune dépendance serveur). Une seule source
// pour l'admin, la vitrine web et l'API de l'app mobile.

export const VEHICLE_DRIVER_MODES = [
  { value: "AU_CHOIX", label: "Au choix du client", short: "Avec ou sans chauffeur" },
  { value: "SANS_CHAUFFEUR", label: "Sans chauffeur uniquement", short: "Sans chauffeur" },
  { value: "AVEC_CHAUFFEUR", label: "Avec chauffeur obligatoire", short: "Avec chauffeur" },
] as const;

export type VehicleDriverModeValue = (typeof VEHICLE_DRIVER_MODES)[number]["value"];

export const VEHICLE_DRIVER_MODE_LABELS: Record<string, string> = Object.fromEntries(
  VEHICLE_DRIVER_MODES.map((m) => [m.value, m.short]),
);

export const VEHICLE_BOOKING_STATUS_LABELS: Record<string, string> = {
  DEMANDE: "Demande",
  CONFIRMEE: "Confirmée",
  EN_COURS: "En cours",
  TERMINEE: "Terminée",
  ANNULEE: "Annulée",
};

// Libellés côté client (vitrine, app) : "Demande" seul ne dit pas au client
// qu'il attend une réponse.
export const VEHICLE_BOOKING_CUSTOMER_STATUS_LABELS: Record<string, string> = {
  DEMANDE: "En attente de confirmation",
  CONFIRMEE: "Confirmée",
  EN_COURS: "En cours",
  TERMINEE: "Terminée",
  ANNULEE: "Annulée",
};

export const VEHICLE_BOOKING_STATUS_TONES: Record<
  string,
  "default" | "secondary" | "success" | "warning" | "destructive"
> = {
  DEMANDE: "warning",
  CONFIRMEE: "default",
  EN_COURS: "success",
  TERMINEE: "secondary",
  ANNULEE: "destructive",
};

export const MAX_BOOKING_DAYS = 365;
export const MAX_VEHICLE_TAGS = 12;
export const MAX_TAG_LENGTH = 30;

/** "JETOUR T3 2024" — désignation affichée partout. */
export function vehicleLabel(v: { marque: string; modele: string; annee?: number | null }): string {
  return [v.marque, v.modele, v.annee ?? null].filter(Boolean).join(" ");
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** "2026-11-14" → minuit UTC de ce jour ; null si la date est invalide. */
export function parseDay(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(value)) return null;
  const date = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Date → "2026-11-14" (jour UTC, cohérent avec les colonnes @db.Date). */
export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function todayUtc(): Date {
  return parseDay(new Date().toISOString())!;
}

/**
 * Jours facturés entre le jour de prise et le jour de retour : la
 * différence en jours, au moins 1 (prise et retour le même jour = 1 jour ;
 * du 10 au 12 = 2 jours).
 */
export function billedDays(dateDebut: Date, dateFin: Date): number {
  return Math.max(1, Math.round((dateFin.getTime() - dateDebut.getTime()) / DAY_MS));
}

/** Avec chauffeur ou non, selon le mode du véhicule et le souhait du client. */
export function resolveWithDriver(mode: string, requested: boolean): boolean {
  if (mode === "AVEC_CHAUFFEUR") return true;
  if (mode === "SANS_CHAUFFEUR") return false;
  return requested;
}

/** Total hors caution : (prix/jour + supplément chauffeur éventuel) × jours. */
export function bookingTotal(input: {
  prixJour: number;
  supplementChauffeurJour: number;
  avecChauffeur: boolean;
  nombreJours: number;
}): number {
  const parJour = input.prixJour + (input.avecChauffeur ? input.supplementChauffeurJour : 0);
  return Math.round(parJour * input.nombreJours * 100) / 100;
}

/** Nettoie les étiquettes saisies : espaces, doublons (casse ignorée), plafonds. */
export function normalizeTags(raw: string[]): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const value of raw) {
    const tag = value.trim().replace(/\s+/g, " ").slice(0, MAX_TAG_LENGTH);
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
    if (tags.length >= MAX_VEHICLE_TAGS) break;
  }
  return tags;
}
