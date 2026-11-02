import Link from "next/link";
import { notFound } from "next/navigation";

import { withTenantContext } from "@/lib/db/tenant-context";
import { formatMoney } from "@/lib/money";
import { RENTAL_UNIT_TYPE_LABELS } from "@/lib/rentals/types";
import { getStorefrontOrganization, resolveStorefrontShopId } from "@/lib/storefront/context";
import { getStorefrontRentalUnitDetail } from "@/lib/storefront/rentals";

import { MediaGallery } from "../../../media-gallery";
import { BookingForm } from "./booking-form";

export default async function RentalUnitDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ unitId: string }>;
  searchParams: Promise<{ shop?: string }>;
}) {
  const organization = await getStorefrontOrganization("location");
  if (!organization) {
    notFound();
  }

  const { unitId } = await params;
  const { shop: requestedShopId } = await searchParams;
  const shopId = await resolveStorefrontShopId(organization.id, requestedShopId);
  if (!shopId) {
    notFound();
  }

  const unit = await withTenantContext({ organizationId: organization.id, shopId }, (tx) =>
    getStorefrontRentalUnitDetail(tx, shopId, unitId),
  );
  if (!unit) {
    notFound();
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <Link href="/" className="text-sm text-primary underline-offset-4 hover:underline">
        ← Retour au catalogue
      </Link>

      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
        <MediaGallery
          imageUrls={unit.imageIds.map((id) => `/api/rentals/units/${unit.id}/images/${id}`)}
          alt={unit.designation}
        />

        <div className="flex flex-col gap-4">
          <div>
            <p className="text-sm text-muted-foreground">
              {RENTAL_UNIT_TYPE_LABELS[unit.type] ?? unit.type}
            </p>
            <h1 className="text-xl font-semibold text-foreground">{unit.designation}</h1>
            <p className="num mt-1 text-lg font-semibold text-foreground">
              {formatMoney(unit.montantMensuel, organization.devise)} / mois
            </p>
            <p className="text-sm text-muted-foreground">Durée minimale : {unit.dureeMinMois} mois</p>
            {unit.commissionMontant > 0 && (
              <p className="text-sm text-muted-foreground">
                Commission (à la signature) : {formatMoney(unit.commissionMontant, organization.devise)}
              </p>
            )}
          </div>

          {unit.description && <p className="text-sm text-foreground">{unit.description}</p>}

          {unit.available ? (
            <BookingForm
              unitId={unit.id}
              shopId={shopId}
              dureeMinMois={unit.dureeMinMois}
              montantMensuel={unit.montantMensuel}
              commissionMontant={unit.commissionMontant}
              devise={organization.devise}
            />
          ) : (
            <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
              Ce logement n&apos;est plus disponible pour l&apos;instant.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
