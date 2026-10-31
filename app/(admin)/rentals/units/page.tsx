import { redirect } from "next/navigation";

import { systemPrisma } from "@/lib/db/system-client";
import { withTenantContext } from "@/lib/db/tenant-context";
import { formatMoney } from "@/lib/money";
import { hasCapability } from "@/lib/permissions";
import { getActiveShopId } from "@/lib/tenant/active-shop";
import { getTenantContext } from "@/lib/tenant/context";
import { organizationHasModule } from "@/lib/tenant/modules";

import { UnitsTable, type UnitRow } from "./units-table";

const TYPE_LABELS: Record<string, string> = {
  CHAMBRE: "Chambre",
  STUDIO: "Studio",
  APPARTEMENT: "Appartement",
  VILLA: "Villa",
  AUTRE: "Autre",
};

export default async function RentalUnitsPage() {
  const ctx = await getTenantContext();
  const organization = await systemPrisma.organization.findUniqueOrThrow({
    where: { id: ctx.organizationId },
  });

  // Deux axes distincts (même principe que ecommerce:manage) : la capacité
  // du rôle ET le module Location activé par l'admin plateforme.
  if (
    !hasCapability(ctx.role, "location:manage") ||
    !organizationHasModule(organization.enabledModules, "location")
  ) {
    redirect("/dashboard");
  }

  const shopId = await getActiveShopId(ctx.organizationId, ctx.userId);

  const units = await withTenantContext({ organizationId: ctx.organizationId, shopId }, (tx) =>
    tx.rentalUnit.findMany({
      where: { shopId },
      orderBy: { designation: "asc" },
      include: {
        images: { select: { id: true }, orderBy: { position: "asc" } },
        contracts: { where: { statut: { in: ["DEMANDE", "CONFIRMEE", "EN_COURS"] } }, take: 1 },
      },
    }),
  );

  const rows: UnitRow[] = units.map((u) => ({
    id: u.id,
    typeLabel: TYPE_LABELS[u.type] ?? u.type,
    designation: u.designation,
    description: u.description,
    montantMensuelLabel: formatMoney(u.montantMensuel, organization.devise),
    dureeMinMois: u.dureeMinMois,
    commissionLabel: formatMoney(u.commissionMontant, organization.devise),
    actif: u.actif,
    occupe: u.contracts.length > 0,
    coverImageId: u.images[0]?.id ?? null,
    edit: {
      id: u.id,
      type: u.type,
      designation: u.designation,
      description: u.description,
      montantMensuel: Number(u.montantMensuel),
      dureeMinMois: u.dureeMinMois,
      commissionMontant: Number(u.commissionMontant),
      actif: u.actif,
      images: u.images.map((img) => ({ id: img.id })),
    },
  }));

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold text-foreground">Logements</h1>
        <p className="text-sm text-muted-foreground">
          Chambres, studios, appartements, villas... — loyer, durée minimale et commission par
          logement.
        </p>
      </header>

      <UnitsTable units={rows} />
    </div>
  );
}
