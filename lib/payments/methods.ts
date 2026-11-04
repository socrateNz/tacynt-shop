import type { PaymentProvider } from "@prisma/client";

import { stripeConfigured } from "./stripe";

// Seule source de vérité des moyens de paiement proposés pour une boutique,
// partagée par la vitrine web, l'app mobile Sodu et l'admin :
// - paiement en ligne inactif → paiement à la réception uniquement ;
// - organisation au Cameroun (et en XAF, seule devise Codees) → Mobile
//   Money (Codees) ;
// - ailleurs → aucun paiement en ligne : paiement à la réception
//   (hors ligne) uniquement ;
// - paiement à la réception : au choix de l'organisation
//   (Shop.paiementReceptionActif), mais toujours disponible s'il ne reste
//   aucun moyen en ligne utilisable — une boutique ne doit jamais se
//   retrouver sans aucun moyen de payer.
export type PaymentOptions = {
  online: PaymentProvider[];
  reception: boolean;
};

type OrgLike = { pays: string; devise: string };
type ShopLike = { paiementEnLigneActif: boolean; paiementReceptionActif: boolean };

// Paiement par carte (Stripe) : DÉSACTIVÉ par décision (2026-11-05) — un
// compte Stripe n'est pas ouvrable pour une entreprise camerounaise. Tout le
// code Stripe reste en place (lib/payments/stripe.ts, webhook) : passer ce
// drapeau à true (et renseigner STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET)
// suffira à proposer la carte, au Cameroun comme ailleurs. Une clé Stripe
// renseignée par erreur ne l'active jamais tant que ce drapeau est faux.
export const CARTE_ACTIVE = false;

export function codeesEligible(org: OrgLike): boolean {
  return org.pays === "CM" && org.devise === "XAF";
}

// Moyens en ligne qu'une organisation POURRAIT proposer si elle activait le
// paiement en ligne (utile à l'admin pour savoir si l'activation a un sens).
export function availableOnlineProviders(org: OrgLike): PaymentProvider[] {
  const providers: PaymentProvider[] = [];
  if (codeesEligible(org)) providers.push("CODEES");
  if (CARTE_ACTIVE && stripeConfigured()) providers.push("STRIPE");
  return providers;
}

export function paymentOptions(org: OrgLike, shop: ShopLike): PaymentOptions {
  const online = shop.paiementEnLigneActif ? availableOnlineProviders(org) : [];
  return { online, reception: online.length === 0 || shop.paiementReceptionActif };
}

export const PROVIDER_LABEL: Record<PaymentProvider, string> = {
  CODEES: "Mobile Money (Orange Money / MTN MoMo)",
  STRIPE: "Carte bancaire",
};
