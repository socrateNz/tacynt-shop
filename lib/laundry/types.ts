import type { LaundryOrderStatus, LaundryPickupMode, LaundryReturnMode } from "@prisma/client";

export const LAUNDRY_STATUS_LABELS: Record<LaundryOrderStatus, string> = {
  EN_ATTENTE: "En attente",
  CONFIRMEE: "Confirmée",
  COLLECTEE: "Linge reçu",
  EN_LAVAGE: "En lavage",
  PRETE: "Prête",
  TERMINEE: "Terminée",
  ANNULEE: "Annulée",
};

export const LAUNDRY_STATUS_VARIANTS: Record<LaundryOrderStatus, "secondary" | "success" | "destructive"> = {
  EN_ATTENTE: "secondary",
  CONFIRMEE: "success",
  COLLECTEE: "success",
  EN_LAVAGE: "success",
  PRETE: "success",
  TERMINEE: "secondary",
  ANNULEE: "destructive",
};

export const PICKUP_LABELS: Record<LaundryPickupMode, string> = {
  COLLECTE_DOMICILE: "Collecte à domicile",
  DEPOT_BOUTIQUE: "Dépôt en boutique",
};

export const RETURN_LABELS: Record<LaundryReturnMode, string> = {
  LIVRAISON: "Livraison à domicile",
  RETRAIT_BOUTIQUE: "Retrait en boutique",
};

// Cycle de vie, dans l'ordre. Chaque étape ne mène qu'à la suivante ;
// l'annulation est possible tant que le linge n'est pas prêt.
export const LAUNDRY_FLOW: LaundryOrderStatus[] = ["EN_ATTENTE", "CONFIRMEE", "COLLECTEE", "EN_LAVAGE", "PRETE", "TERMINEE"];

export function nextLaundryStatus(statut: LaundryOrderStatus): LaundryOrderStatus | null {
  const i = LAUNDRY_FLOW.indexOf(statut);
  return i >= 0 && i < LAUNDRY_FLOW.length - 1 ? LAUNDRY_FLOW[i + 1]! : null;
}

export function laundryCancellable(statut: LaundryOrderStatus): boolean {
  return statut === "EN_ATTENTE" || statut === "CONFIRMEE" || statut === "COLLECTEE";
}

// Libellé du bouton qui fait passer à l'étape suivante (tableau de bord).
export function nextStepLabel(statut: LaundryOrderStatus, modeAller: LaundryPickupMode, modeRetour: LaundryReturnMode) {
  switch (nextLaundryStatus(statut)) {
    case "CONFIRMEE":
      return "Confirmer la commande";
    case "COLLECTEE":
      return modeAller === "COLLECTE_DOMICILE" ? "Linge collecté" : "Linge déposé";
    case "EN_LAVAGE":
      return "Mettre en lavage";
    case "PRETE":
      return "Linge prêt";
    case "TERMINEE":
      return modeRetour === "LIVRAISON" ? "Linge livré" : "Linge récupéré";
    default:
      return null;
  }
}
