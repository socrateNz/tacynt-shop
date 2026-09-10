import type { PaymentMode } from "@prisma/client";

import type { OrgSettings } from "@/lib/tenant/settings";

export type AccountingMapping = {
  ventesCompte: string;
  tvaCompte: string;
  paiementComptes: Record<PaymentMode, string>;
  chargesCompteParDefaut: string;
};

// Mapping par défaut inspiré du plan comptable SYSCOHADA (cohérent avec la
// devise par défaut XOF de l'organisation) — un point de départ éditable
// depuis /settings, jamais une garantie de conformité comptable certifiée
// (Phase 4, décision verrouillée #11).
const DEFAULT_PAIEMENT_COMPTES: Record<PaymentMode, string> = {
  ESPECES: "571",
  MOBILE_MONEY: "5715",
  CARTE: "512",
  VIREMENT: "512",
  ARDOISE: "411",
  BON_ACHAT: "419",
};

export const DEFAULT_ACCOUNTING_MAPPING: AccountingMapping = {
  ventesCompte: "707",
  tvaCompte: "4431",
  paiementComptes: DEFAULT_PAIEMENT_COMPTES,
  chargesCompteParDefaut: "6",
};

export function resolveAccountingMapping(settings: OrgSettings): AccountingMapping {
  const override = settings.accountingMapping ?? {};
  return {
    ventesCompte: override.ventesCompte ?? DEFAULT_ACCOUNTING_MAPPING.ventesCompte,
    tvaCompte: override.tvaCompte ?? DEFAULT_ACCOUNTING_MAPPING.tvaCompte,
    paiementComptes: { ...DEFAULT_ACCOUNTING_MAPPING.paiementComptes, ...override.paiementComptes },
    chargesCompteParDefaut:
      override.chargesCompteParDefaut ?? DEFAULT_ACCOUNTING_MAPPING.chargesCompteParDefaut,
  };
}
