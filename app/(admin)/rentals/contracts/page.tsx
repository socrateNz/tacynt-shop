import { redirect } from "next/navigation";

import { Page, PageHeader } from "@/components/admin/page";
import { Badge } from "@/components/ui/badge";
import { systemPrisma } from "@/lib/db/system-client";
import { withTenantContext } from "@/lib/db/tenant-context";
import { formatMoney } from "@/lib/money";
import { hasCapability } from "@/lib/permissions";
import { OCCUPYING_STATUSES } from "@/lib/rentals/contracts";
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
          contracts: { where: { statut: { in: [...OCCUPYING_STATUSES] } }, take: 1 },
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
    telephoneClient: c.telephoneClient,
    statut: c.statut,
    dureeMois: c.dureeMois,
    montantMensuelLabel: formatMoney(c.montantMensuel, organization.devise),
    dateDebutLabel: c.dateDebut.toLocaleDateString("fr-FR"),
  }));

  const availableUnitOptions: AvailableUnit[] = availableUnits.map((u) => ({
    id: u.id,
    designation: u.designation,
    dureeMinMois: u.dureeMinMois,
    montantMensuel: Number(u.montantMensuel),
    commissionMontant: Number(u.commissionMontant),
    montantMensuelLabel: formatMoney(u.montantMensuel, organization.devise),
  }));

  return (
    <Page>
      <PageHeader
        title="Locations"
        description="Contrats de location — demandes, échéanciers et paiements."
        meta={pendingCount > 0 ? <Badge variant="warning">{pendingCount} demande{pendingCount > 1 ? "s" : ""} en attente</Badge> : undefined}
        actions={<NewContractDialog availableUnits={availableUnitOptions} devise={organization.devise} />}
      />

      <ContractsTable contracts={rows} />
    </Page>
  );
}
