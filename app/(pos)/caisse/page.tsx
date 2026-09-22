import { redirect } from "next/navigation";

import { systemPrisma } from "@/lib/db/system-client";
import { withTenantContext } from "@/lib/db/tenant-context";
import { hasCapability } from "@/lib/permissions";
import { getActiveShopId } from "@/lib/tenant/active-shop";
import { getTenantContext } from "@/lib/tenant/context";
import { parseOrgSettings } from "@/lib/tenant/settings";

import { PosClient } from "./pos-client";

export default async function CaissePage() {
  const ctx = await getTenantContext();
  if (!hasCapability(ctx.role, "pos:sell")) {
    redirect("/dashboard");
  }

  const shopId = await getActiveShopId(ctx.organizationId, ctx.userId);
  const [register, organization] = await Promise.all([
    withTenantContext({ organizationId: ctx.organizationId, shopId }, async (tx) => {
      // Une boutique créée depuis /shops (par opposition à celle de
      // l'inscription) n'a longtemps eu aucun poste de caisse — cette page
      // levait alors une erreur non rattrapée (bug réel constaté en
      // production : GET /caisse 500). createShop en crée un désormais pour
      // toute NOUVELLE boutique (app/(admin)/shops/actions.ts) ; ceci
      // rattrape les boutiques déjà créées avant ce correctif, sans
      // intervention manuelle en base.
      const existing = await tx.register.findFirst({ where: { shopId } });
      if (existing) return existing;
      try {
        return await tx.register.create({
          data: { organizationId: ctx.organizationId, shopId, nom: "Caisse 1", code: "C1" },
        });
      } catch (error) {
        // Deux premières visites simultanées sur la même boutique jamais
        // encore équipée : la seconde perd la course sur la contrainte
        // unique (shop_id, code) — pas une vraie erreur, l'autre a déjà créé
        // le même poste par défaut.
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          (error as { code?: string }).code === "P2002"
        ) {
          return tx.register.findFirstOrThrow({ where: { shopId } });
        }
        throw error;
      }
    }),
    systemPrisma.organization.findUniqueOrThrow({ where: { id: ctx.organizationId } }),
  ]);

  const settings = parseOrgSettings(organization.settings);

  return (
    <PosClient
      registerId={register.id}
      registerCode={register.code}
      registerNom={register.nom}
      organizationNom={organization.nom}
      devise={organization.devise}
      role={ctx.role}
      discountCeiling={settings.vendeurDiscountCeiling ?? 0}
    />
  );
}
