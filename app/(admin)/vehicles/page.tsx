import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays } from "lucide-react";

import { Page, PageHeader } from "@/components/admin/page";
import { buttonVariants } from "@/components/ui/button";
import { systemPrisma } from "@/lib/db/system-client";
import { withTenantContext } from "@/lib/db/tenant-context";
import { formatMoney } from "@/lib/money";
import { hasCapability } from "@/lib/permissions";
import { getActiveShopId } from "@/lib/tenant/active-shop";
import { getTenantContext } from "@/lib/tenant/context";
import { organizationHasModule } from "@/lib/tenant/modules";
import { availableTodayByVehicle } from "@/lib/vehicles/bookings";

import { VehiclesHeaderActions, VehiclesTable, type VehicleRow } from "./vehicles-table";

export default async function VehiclesPage() {
  const ctx = await getTenantContext();
  const organization = await systemPrisma.organization.findUniqueOrThrow({ where: { id: ctx.organizationId } });

  // Deux axes distincts : la capacité du rôle ET le module payé.
  if (
    !hasCapability(ctx.role, "vehicles:manage") ||
    !organizationHasModule(organization.enabledModules, "location_vehicules")
  ) {
    redirect("/dashboard");
  }

  const shopId = await getActiveShopId(ctx.organizationId, ctx.userId);
  const devise = organization.devise;

  const { vehicles, disponibles, shop } = await withTenantContext(
    { organizationId: ctx.organizationId, shopId },
    async (tx) => {
      const vehicles = await tx.vehicle.findMany({
        where: { shopId },
        orderBy: [{ marque: "asc" }, { modele: "asc" }, { annee: "desc" }],
        // Jamais image_data ici : seulement les id, pour construire les URLs.
        include: { images: { select: { id: true }, orderBy: { position: "asc" } } },
      });
      const disponibles = await availableTodayByVehicle(tx, vehicles);
      const shop = await tx.shop.findUniqueOrThrow({
        where: { id: shopId },
        select: { supplementChauffeurJour: true },
      });
      return { vehicles, disponibles, shop };
    },
  );

  const rows: VehicleRow[] = vehicles.map((v) => ({
    id: v.id,
    marque: v.marque,
    modele: v.modele,
    annee: v.annee,
    description: v.description,
    tags: v.tags,
    prixJour: Number(v.prixJour),
    prixJourLabel: formatMoney(v.prixJour, devise),
    afficherPrix: v.afficherPrix,
    chauffeurMode: v.chauffeurMode,
    caution: v.caution === null ? null : Number(v.caution),
    cautionLabel: v.caution === null ? null : formatMoney(v.caution, devise),
    afficherCaution: v.afficherCaution,
    quantite: v.quantite,
    actif: v.actif,
    imageIds: v.images.map((img) => img.id),
    disponibles: disponibles.get(v.id) ?? 0,
  }));

  // Étiquettes déjà utilisées, proposées à la saisie (les plus fréquentes d'abord).
  const tagCounts = new Map<string, number>();
  for (const v of vehicles) for (const t of v.tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  const tagSuggestions = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).map(([tag]) => tag);

  const supplement = Number(shop.supplementChauffeurJour);

  return (
    <Page>
      <PageHeader
        title="Véhicules"
        description="Une fiche par modèle, avec son nombre d'exemplaires. Tarif à la journée, avec ou sans chauffeur."
        actions={
          <>
            <Link href="/vehicles/bookings" className={buttonVariants({ variant: "outline" })}>
              <CalendarDays />
              Réservations
            </Link>
            <VehiclesHeaderActions
              devise={devise}
              tagSuggestions={tagSuggestions}
              supplementChauffeurJour={supplement}
              supplementLabel={formatMoney(supplement, devise)}
            />
          </>
        }
      />

      <VehiclesTable vehicles={rows} devise={devise} tagSuggestions={tagSuggestions} />
    </Page>
  );
}
