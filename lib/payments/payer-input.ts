import type { MobileMoneyPayer } from "./initiate";
import { guessNetwork, normalizeCameroonPhone, parseNetwork } from "./phone";

// Lit le numéro Mobile Money (et l'opérateur) envoyés par l'app ou le site
// pour un paiement direct. Absent = page de paiement hébergée ; présent mais
// invalide = erreur à renvoyer au client.
export function readMobileMoneyPayer(
  body: { telephone?: unknown; operateur?: unknown } | null,
): { payer?: MobileMoneyPayer; error?: string } {
  const raw = typeof body?.telephone === "string" ? body.telephone.trim() : "";
  if (!raw) return {};
  const telephone = normalizeCameroonPhone(raw);
  if (!telephone) {
    return { error: "Numéro Mobile Money invalide : 9 chiffres commençant par 6 (ex. 6 77 00 00 00)." };
  }
  const operateur = parseNetwork(body?.operateur) ?? guessNetwork(telephone);
  if (!operateur) return { error: "Choisissez l'opérateur de ce numéro : Orange Money ou MTN MoMo." };
  return { payer: { telephone, operateur } };
}
