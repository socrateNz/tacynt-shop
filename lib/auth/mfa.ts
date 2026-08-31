import { Secret, TOTP } from "otpauth";

// Cookie temporaire posé après un mot de passe valide quand mfaEnabled est
// vrai, le temps de saisir le code. Sa valeur (un userId brut, non signé)
// n'ouvre aucune session à elle seule : il faut encore passer le TOTP, dont
// la difficulté de devinette (1 chance sur 1 000 000 par essai) reste la
// vraie barrière — simplification assumée pour la Phase 1.
export const MFA_PENDING_COOKIE_NAME = "ts_mfa_pending";
export const MFA_PENDING_DURATION_MS = 5 * 60 * 1000;

// MFA pour Propriétaire/Gérant (section 8) : disponible et pleinement
// fonctionnelle pour tout utilisateur qui l'active, mais pas forcée à
// l'inscription — un blocage dur à la création du compte contredirait le
// principe "formation nulle" / onboarding en quelques minutes (section 1.3).
export function generateMfaSecret(): string {
  return new Secret({ size: 20 }).base32;
}

export function getOtpAuthUrl(secretBase32: string, email: string, orgName: string): string {
  const totp = new TOTP({
    issuer: `Tacynt Shop — ${orgName}`,
    label: email,
    secret: Secret.fromBase32(secretBase32),
    algorithm: "SHA1",
    digits: 6,
    period: 30,
  });
  return totp.toString();
}

// window: 1 tolère un décalage d'horloge de ±30s de part et d'autre.
export function verifyTotp(secretBase32: string, token: string): boolean {
  const delta = TOTP.validate({
    token,
    secret: Secret.fromBase32(secretBase32),
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    window: 1,
  });
  return delta !== null;
}
