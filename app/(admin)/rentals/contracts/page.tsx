import { redirect } from "next/navigation";

import { systemPrisma } from "@/lib/db/system-client";
import { withTenantContext } from "@/lib/db/tenant-context";
import { formatMoney } from "@/lib/money";
import { hasCapability } from "@/lib/permissions";
import { getAssignedShopIds } from "@/lib/tenant/active-shop";
import { getTenantContext } from "@/lib/tenant/context";
import { organizationHasModule } from "@/lib/tenant/modules";

import { ContractsTable, type ContractRow } from "./contracts-table";
import { NewContractDialog, type AvailableUnit } from "./new-contract-dialog";

export default async function RentalContractsPage() {
  const ctx = await getTenantContext();
  const organization = await systemPrisma.organization.findUniqueOrThrow({
    where: { id: ctx.organizationId },
  });

  if (
    !hasCapability(ctx.role, "location:manage") ||
    !organizationHasModule(organization.enabledModules, "location")
  ) {
    redirect("/dashboard");
  }

  const myShopIds = await getAssignedShopIds(ctx.organizationId, ctx.userId);

  const { contracts, availableUnits } = await withTenantContext(
    { organizationId: ctx.organizationId },
    async (tx) => {
      const contracts = await tx.rentalContract.findMany({
        where: { shopId: { in: myShopIds } },
        orderBy: { createdAt: "desc" },
        include: { rentalUnit: true, shop: true },
        take: 200,
      });

      const units = await tx.rentalUnit.findMany({
        where: { shopId: { in: myShopIds }, actif: true },
        orderBy: { designation: "asc" },
        include: {
          contracts: { where: { statut: { in: ["DEMANDE", "CONFIRMEE", "EN_COURS"] } }, take: 1 },
        },
      });
      const availableUnits = units.filter((u) => u.contracts.length === 0);

      return { contracts, availableUnits };
    },
  );

  const pendingCount = contracts.filter((c) => c.statut === "DEMANDE").length;

  const rows: ContractRow[] = contracts.map((c) => ({
    id: c.id,
    numero: c.numero,
    unitDesignation: c.rentalUnit.designation,
    shopNom: c.shop.nom,
    nomClient: c.nomClient,
    statut: c.statut,
    dureeMois: c.dureeMois,
    montantMensuelLabel: formatMoney(c.montantMensuel, organization.devise),
    dateDebutLabel: c.dateDebut.toLocaleDateString("fr-FR"),
  }));

  const availableUnitOptions: AvailableUnit[] = availableUnits.map((u) => ({
    id: u.id,
    designation: u.designation,
    dureeMinMois: u.dureeMinMois,
    montantMensuelLabel: formatMoney(u.montantMensuel, organization.devise),
  }));

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Locations</h1>
          <p className="text-sm text-muted-foreground">
            Contrats de location — demandes, échéanciers et paiements.
          </p>
        </div>
        <NewContractDialog availableUnits={availableUnitOptions} />
      </header>

      {pendingCount > 0 && (
        <div className="rounded-xl border border-warning/30 bg-warning/10 p-4">
          <p className="text-sm font-medium text-foreground">
            Demandes en attente ({pendingCount})
          </p>
        </div>
      )}

      <ContractsTable contracts={rows} />
    </div>
  );
}
