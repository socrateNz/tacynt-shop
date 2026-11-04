import type { PaymentProvider } from "@prisma/client";

import { stripeConfigured } from "./stripe";

// Seule source de vérité des moyens de paiement proposés pour une boutique,
// partagée par la vitrine web, l'app mobile Sodu et l'admin :
// - paiement en ligne inactif → paiement à la réception uniquement ;
// - organisation au Cameroun (et en XAF, seule devise Codees) → Mobile
//   Money (Codees) + carte (Stripe) ;
// - ailleurs → carte (Stripe) uniquement ;
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

export function codeesEligible(org: OrgLike): boolean {
  return org.pays === "CM" && org.devise === "XAF";
}

// Moyens en ligne qu'une organisation POURRAIT proposer si elle activait le
// paiement en ligne (utile à l'admin pour savoir si l'activation a un sens).
export function availableOnlineProviders(org: OrgLike): PaymentProvider[] {
  const providers: PaymentProvider[] = [];
  if (codeesEligible(org)) providers.push("CODEES");
  if (stripeConfigured()) providers.push("STRIPE");
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
