import { notFound } from "next/navigation";

import { withTenantContext } from "@/lib/db/tenant-context";
import { getStorefrontOrganization, resolveStorefrontShopId } from "@/lib/storefront/context";
import { getStorefrontRentalUnits } from "@/lib/storefront/rentals";

import { RentalUnitGrid } from "../../rental-unit-grid";

export default async function LocationsPage({
  searchParams,
}: {
  searchParams: Promise<{ shop?: string }>;
}) {
  const organization = await getStorefrontOrganization("location");
  if (!organization) {
    notFound();
  }

  const { shop: requestedShopId } = await searchParams;
  const shopId = await resolveStorefrontShopId(organization.id, requestedShopId);
  if (!shopId) {
    notFound();
  }

  const units = await withTenantContext({ organizationId: organization.id, shopId }, (tx) =>
    getStorefrontRentalUnits(tx, shopId),
  );

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold text-foreground">Logements à louer</h1>
        <p className="text-sm text-muted-foreground">
          {units.length} logement{units.length > 1 ? "s" : ""} disponible{units.length > 1 ? "s" : ""}.
        </p>
      </header>

      <RentalUnitGrid units={units} devise={organization.devise} shopId={shopId} />
    </div>
  );
}
