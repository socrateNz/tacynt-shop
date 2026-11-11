import type { CodeesNetwork } from "./codees";

// Numéros Mobile Money camerounais : 9 chiffres commençant par 6, envoyés à
// Codees au format international sans "+" (237XXXXXXXXX). Accepte les
// saisies usuelles : "6 77 00 00 00", "+237677000000", "00237…".
export function normalizeCameroonPhone(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("00237")) digits = digits.slice(5);
  else if (digits.startsWith("237") && digits.length === 12) digits = digits.slice(3);
  if (!/^6\d{8}$/.test(digits)) return null;
  return `237${digits}`;
}

// Opérateur probable d'après le préfixe (plans de numérotation MTN et
// Orange Cameroun). Indicatif seulement : le client peut corriger, et
// Codees refuse un opérateur qui ne correspond pas au numéro.
export function guessNetwork(phone237: string): CodeesNetwork | null {
  const local = phone237.slice(3);
  const p2 = Number(local.slice(0, 2));
  const p3 = Number(local.slice(0, 3));
  if (p2 === 67 || (p3 >= 650 && p3 <= 654) || (p3 >= 680 && p3 <= 684)) return "MTN_CM";
  if (p2 === 69 || (p3 >= 655 && p3 <= 659) || (p3 >= 686 && p3 <= 689)) return "ORANGE_CM";
  return null;
}

export function parseNetwork(value: unknown): CodeesNetwork | null {
  return value === "MTN_CM" || value === "ORANGE_CM" ? value : null;
}
