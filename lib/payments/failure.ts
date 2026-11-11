import type { OnlineOrderPaymentStatus } from "@prisma/client";

import { getPaymentStatus } from "./codees";

// Raisons d'échec d'un paiement Mobile Money, traduites pour le client.
// Codes Codees (failure_code, https://pay.codees-cm.com/docs/) + deux codes
// locaux : ANNULE (session fermée sur la page de paiement) et EXPIRE
// (session de 30 minutes dépassée).
const MESSAGES: Record<string, string> = {
  INSUFFICIENT_FUNDS: "Solde Mobile Money insuffisant. Rechargez votre compte puis réessayez.",
  CUSTOMER_DECLINED: "Le paiement a été refusé ou annulé sur votre téléphone.",
  CONFIRMATION_TIMEOUT: "Le paiement n'a pas été confirmé à temps sur votre téléphone (code PIN). Réessayez.",
  INVALID_ACCOUNT: "Ce numéro n'est pas un compte Mobile Money valide sur ce réseau.",
  LIMIT_EXCEEDED: "Le montant dépasse le plafond de votre compte Mobile Money.",
  REVERSED: "L'opérateur a annulé ce paiement. Vous n'avez pas été débité.",
  PAYMENT_FAILED: "Le paiement a échoué. Réessayez dans quelques instants.",
  PAYMENT_REJECTED: "Le paiement n'a pas pu démarrer. Vérifiez le numéro et l'opérateur (Orange ou MTN), puis réessayez.",
  ANNULE: "Le paiement a été annulé.",
  EXPIRE: "La session de paiement a expiré. Relancez le paiement.",
};

const GENERIQUE = "Le paiement n'a pas abouti. Réessayez.";

export type PaymentFailure = { code: string; message: string };

export function failureMessage(code: string): string {
  return MESSAGES[code] ?? GENERIQUE;
}

// Raison à présenter pour un paiement terminé sans succès (null sinon).
export function paymentFailure(payment: {
  statut: OnlineOrderPaymentStatus;
  codeEchec: string | null;
}): PaymentFailure | null {
  if (payment.statut !== "ECHEC" && payment.statut !== "EXPIRE") return null;
  const code = payment.codeEchec ?? (payment.statut === "EXPIRE" ? "EXPIRE" : "PAYMENT_FAILED");
  return { code, message: MESSAGES[code] ?? GENERIQUE };
}

// Interroge Codees pour la raison d'un échec. Ne lève jamais : sans raison
// connue, on garde le message générique.
export async function fetchCodeesFailure(
  query: { transactionId: string } | { reference: string },
): Promise<{ code: string; message: string | null } | null> {
  try {
    const result = await getPaymentStatus(query);
    if (!result.failure_code) return null;
    return { code: result.failure_code, message: result.failure_message ?? null };
  } catch (error) {
    console.error("Raison d'échec Codees indisponible :", error);
    return null;
  }
}
