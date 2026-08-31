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
    redirect("/");
  }

  const shopId = await getActiveShopId(ctx.organizationId, ctx.userId);
  const [register, organization] = await Promise.all([
    withTenantContext({ organizationId: ctx.organizationId, shopId }, (tx) =>
      tx.register.findFirstOrThrow({ where: { shopId } }),
    ),
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
