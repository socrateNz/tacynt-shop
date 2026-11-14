import { ShieldCheck, UserRound } from "lucide-react";
import { notFound } from "next/navigation";

import { withTenantContext } from "@/lib/db/tenant-context";
import { formatMoney } from "@/lib/money";
import { getStorefrontOrganization, resolveStorefrontShopId } from "@/lib/storefront/context";
import { getStorefrontVehicleDetail } from "@/lib/storefront/vehicles";
import { cn } from "@/lib/utils";
import { VEHICLE_DRIVER_MODE_LABELS, vehicleLabel } from "@/lib/vehicles/types";

import { MediaGallery } from "../../../media-gallery";
import { StorefrontBreadcrumb } from "../../../storefront-breadcrumb";
import { VehicleBookingForm } from "./booking-form";

export default async function VehicleDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ vehicleId: string }>;
  searchParams: Promise<{ shop?: string }>;
}) {
  const organization = await getStorefrontOrganization("location_vehicules");
  if (!organization) notFound();

  const { vehicleId } = await params;
  const { shop: requestedShopId } = await searchParams;
  const shopId = await resolveStorefrontShopId(organization.id, requestedShopId);
  if (!shopId) notFound();

  const vehicle = await withTenantContext({ organizationId: organization.id, shopId }, (tx) =>
    getStorefrontVehicleDetail(tx, shopId, vehicleId),
  );
  if (!vehicle) notFound();

  const label = vehicleLabel(vehicle);
  const devise = organization.devise;
  const libre = vehicle.disponibles > 0;

  return (
    <div className="flex flex-col gap-6">
      <StorefrontBreadcrumb items={[{ label: "Véhicules", href: "/" }, { label }]} />

      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
        <MediaGallery
          imageUrls={vehicle.imageIds.map((id) => `/api/vehicles/${vehicle.id}/images/${id}`)}
          alt={label}
        />

        <div className="flex flex-col gap-4">
          <div>
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-semibold text-white",
                libre ? "bg-success" : "bg-warning",
              )}
            >
              {libre ? "Disponible aujourd'hui" : "Loué aujourd'hui — réservable à d'autres dates"}
            </span>
            <h1 className="mt-2 text-2xl font-semibold text-foreground">{label}</h1>
          </div>

          <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
            {vehicle.prixJour !== null ? (
              <p className="num text-3xl font-bold text-primary">
                {formatMoney(vehicle.prixJour, devise)}
                <span className="text-sm font-normal text-muted-foreground"> / jour</span>
              </p>
            ) : (
              <p className="text-2xl font-bold text-primary">Prix sur demande</p>
            )}
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <UserRound className="size-4 shrink-0 text-primary" aria-hidden />
              {VEHICLE_DRIVER_MODE_LABELS[vehicle.chauffeurMode] ?? vehicle.chauffeurMode}
              {vehicle.supplementChauffeurJour !== null && vehicle.supplementChauffeurJour > 0 && (
                <span>— chauffeur : + {formatMoney(vehicle.supplementChauffeurJour, devise)} / jour</span>
              )}
            </p>
            {vehicle.caution !== null && (
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <ShieldCheck className="size-4 shrink-0 text-primary" aria-hidden />
                Caution à la remise du véhicule : {formatMoney(vehicle.caution, devise)}
              </p>
            )}
          </div>

          {vehicle.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {vehicle.tags.map((t) => (
                <span key={t} className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                  {t}
                </span>
              ))}
            </div>
          )}

          {vehicle.description && <p className="text-sm whitespace-pre-line text-foreground">{vehicle.description}</p>}

          <VehicleBookingForm
            vehicleId={vehicle.id}
            shopId={shopId}
            devise={devise}
            prixJour={vehicle.prixJour}
            chauffeurMode={vehicle.chauffeurMode}
            supplementChauffeurJour={vehicle.supplementChauffeurJour ?? 0}
          />
        </div>
      </div>
    </div>
  );
}
