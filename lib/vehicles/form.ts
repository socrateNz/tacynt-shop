import type { VehicleDriverMode } from "@prisma/client";

import { normalizeTags, VEHICLE_DRIVER_MODES } from "./types";

export const MAX_VEHICLE_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_VEHICLE_IMAGES = 5;

const DRIVER_MODES = new Set<string>(VEHICLE_DRIVER_MODES.map((m) => m.value));

export type VehicleFormValues = {
  marque: string;
  modele: string;
  annee: number | null;
  description: string | null;
  tags: string[];
  prixJour: number;
  afficherPrix: boolean;
  chauffeurMode: VehicleDriverMode;
  caution: number | null;
  afficherCaution: boolean;
  quantite: number;
};

/**
 * Lecture + validation du formulaire véhicule (création et modification).
 * Retourne soit les valeurs prêtes à écrire, soit un message d'erreur en
 * français affichable tel quel.
 */
export function parseVehicleForm(formData: FormData): { values: VehicleFormValues } | { error: string } {
  const marque = String(formData.get("marque") ?? "").trim();
  const modele = String(formData.get("modele") ?? "").trim();
  const anneeRaw = String(formData.get("annee") ?? "").trim();
  const annee = anneeRaw === "" ? null : Math.trunc(Number(anneeRaw));
  const description = String(formData.get("description") ?? "").trim() || null;
  const tags = normalizeTags(formData.getAll("tags").map(String));
  const prixJour = Number(formData.get("prixJour") ?? 0);
  const chauffeurMode = String(formData.get("chauffeurMode") ?? "");
  const cautionRaw = String(formData.get("caution") ?? "").trim();
  const caution = cautionRaw === "" ? null : Number(cautionRaw);
  const quantite = Math.trunc(Number(formData.get("quantite") ?? 1));

  if (!marque || !modele) return { error: "La marque et le modèle sont requis." };
  const maxYear = new Date().getFullYear() + 1;
  if (annee !== null && (!Number.isFinite(annee) || annee < 1950 || annee > maxYear)) {
    return { error: `Année invalide (entre 1950 et ${maxYear}).` };
  }
  if (!Number.isFinite(prixJour) || prixJour <= 0) return { error: "Prix par jour invalide." };
  if (!DRIVER_MODES.has(chauffeurMode)) return { error: "Choisissez une option pour le chauffeur." };
  if (caution !== null && (!Number.isFinite(caution) || caution < 0)) return { error: "Caution invalide." };
  if (!Number.isFinite(quantite) || quantite < 1 || quantite > 999) {
    return { error: "Nombre d'exemplaires invalide (au moins 1)." };
  }

  return {
    values: {
      marque,
      modele,
      annee,
      description,
      tags,
      prixJour,
      afficherPrix: formData.get("afficherPrix") === "on",
      chauffeurMode: chauffeurMode as VehicleDriverMode,
      // 0 = pas de caution.
      caution: caution === null || caution === 0 ? null : caution,
      afficherCaution: formData.get("afficherCaution") === "on",
      quantite,
    },
  };
}

/** Photos jointes au formulaire, converties pour l'écriture en base. */
export async function readVehicleImages(
  formData: FormData,
): Promise<{ payloads: { imageData: Uint8Array<ArrayBuffer>; imageMimeType: string }[] } | { error: string }> {
  const images = formData.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  for (const img of images) {
    if (img.size > MAX_VEHICLE_IMAGE_BYTES) return { error: "Image trop volumineuse (5 Mo max)." };
    if (img.type && !img.type.startsWith("image/")) return { error: "Seules les images sont acceptées." };
  }
  const payloads = await Promise.all(
    images.map(async (img) => ({
      imageData: new Uint8Array(await img.arrayBuffer()),
      imageMimeType: img.type || "application/octet-stream",
    })),
  );
  return { payloads };
}
