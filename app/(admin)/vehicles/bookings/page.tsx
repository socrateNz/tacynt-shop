import { redirect } from "next/navigation";
import { CalendarDays } from "lucide-react";

import { FilterTabs } from "@/components/admin/filter-tabs";
import { EmptyState, Page, PageHeader, TablePanel } from "@/components/admin/page";
import { PhoneLink } from "@/components/phone-link";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { systemPrisma } from "@/lib/db/system-client";
import { withTenantContext } from "@/lib/db/tenant-context";
import { formatMoney } from "@/lib/money";
import { hasCapability } from "@/lib/permissions";
import { getActiveShopId } from "@/lib/tenant/active-shop";
import { getTenantContext } from "@/lib/tenant/context";
import { organizationHasModule } from "@/lib/tenant/modules";
import { VEHICLE_BOOKING_STATUS_LABELS, VEHICLE_BOOKING_STATUS_TONES, vehicleLabel } from "@/lib/vehicles/types";

import { BookingDialog, NewBookingDialog, type BookingRow } from "./booking-dialogs";

const FILTERS = {
  demandes: { label: "Demandes", statuts: ["DEMANDE"] },
  actives: { label: "À venir et en cours", statuts: ["CONFIRMEE", "EN_COURS"] },
  historique: { label: "Historique", statuts: ["TERMINEE", "ANNULEE"] },
} as const;
type FilterKey = keyof typeof FILTERS;

const EMPTY: Record<FilterKey, { title: string; description: string }> = {
  demandes: {
    title: "Aucune demande à traiter",
    description: "Les demandes envoyées depuis le site ou l'application apparaîtront ici.",
  },
  actives: {
    title: "Aucune réservation à venir",
    description: "Les réservations acceptées et les locations en cours apparaîtront ici.",
  },
  historique: {
    title: "Aucune réservation passée",
    description: "Les locations terminées et les réservations annulées apparaîtront ici.",
  },
};

// Colonnes @db.Date : minuit UTC — toujours formatées en UTC pour ne jamais
// décaler d'un jour selon le fuseau du serveur.
const day = (date: Date) => date.toLocaleDateString("fr-FR", { timeZone: "UTC" });

export default async function VehicleBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ filtre?: string }>;
}) {
  const ctx = await getTenantContext();
  const organization = await systemPrisma.organization.findUniqueOrThrow({ where: { id: ctx.organizationId } });
  if (
    !hasCapability(ctx.role, "vehicles:manage") ||
    !organizationHasModule(organization.enabledModules, "location_vehicules")
  ) {
    redirect("/dashboard");
  }

  const { filtre } = await searchParams;
  const shopId = await getActiveShopId(ctx.organizationId, ctx.userId);
  const devise = organization.devise;

  const { bookings, pendingCount, vehicles, shop, active } = await withTenantContext(
    { organizationId: ctx.organizationId, shopId },
    async (tx) => {
      const pendingCount = await tx.vehicleBooking.count({ where: { shopId, statut: "DEMANDE" } });
      // Sans filtre explicite : les demandes s'il y en a, sinon les
      // réservations à venir (jamais une page vide par défaut).
      const key: FilterKey =
        filtre && filtre in FILTERS ? (filtre as FilterKey) : pendingCount > 0 ? "demandes" : "actives";
      const bookings = await tx.vehicleBooking.findMany({
        where: { shopId, statut: { in: [...FILTERS[key].statuts] } },
        include: { vehicle: { select: { marque: true, modele: true, annee: true } } },
        // Demandes : la plus ancienne d'abord (à traiter en premier) ;
        // à venir : par date de prise ; historique : la plus récente d'abord.
        orderBy: key === "demandes" ? { createdAt: "asc" } : key === "actives" ? { dateDebut: "asc" } : { createdAt: "desc" },
        take: 200,
      });
      const vehicles = await tx.vehicle.findMany({
        where: { shopId, actif: true },
        orderBy: [{ marque: "asc" }, { modele: "asc" }],
        select: { id: true, marque: true, modele: true, annee: true, prixJour: true, chauffeurMode: true },
      });
      const shop = await tx.shop.findUniqueOrThrow({
        where: { id: shopId },
        select: { supplementChauffeurJour: true },
      });
      return { bookings, pendingCount, vehicles, shop, active: key };
    },
  );

  const rows: BookingRow[] = bookings.map((b) => ({
    id: b.id,
    numero: b.numero,
    statut: b.statut,
    vehicule: vehicleLabel(b.vehicle),
    nomClient: b.nomClient,
    telephoneClient: b.telephoneClient,
    periodeLabel: `du ${day(b.dateDebut)} au ${day(b.dateFin)}`,
    nombreJours: b.nombreJours,
    avecChauffeur: b.avecChauffeur,
    prixJourLabel: formatMoney(b.prixJour, devise),
    supplementLabel:
      b.avecChauffeur && Number(b.supplementChauffeurJour) > 0 ? formatMoney(b.supplementChauffeurJour, devise) : null,
    cautionLabel: b.caution === null ? null : formatMoney(b.caution, devise),
    totalLabel: formatMoney(b.total, devise),
    notes: b.notes,
    createdAtLabel: b.createdAt.toLocaleDateString("fr-FR"),
    origine: b.marketplaceCustomerId ? "application Sodu" : "site web ou saisie en boutique",
  }));

  return (
    <Page>
      <PageHeader
        title="Réservations de véhicules"
        description="Acceptez les demandes, puis enregistrez la remise et le retour de chaque véhicule."
        back={{ href: "/vehicles", label: "Véhicules" }}
        actions={
          <NewBookingDialog
            devise={devise}
            supplementChauffeurJour={Number(shop.supplementChauffeurJour)}
            vehicles={vehicles.map((v) => ({
              id: v.id,
              label: vehicleLabel(v),
              prixJour: Number(v.prixJour),
              chauffeurMode: v.chauffeurMode,
            }))}
          />
        }
      />

      <FilterTabs
        items={(Object.keys(FILTERS) as FilterKey[]).map((key) => ({
          label: FILTERS[key].label,
          href: `/vehicles/bookings?filtre=${key}`,
          active: key === active,
          count: key === "demandes" ? pendingCount : undefined,
        }))}
      />

      <TablePanel>
        {rows.length === 0 ? (
          <EmptyState icon={CalendarDays} {...EMPTY[active]} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Réservation</TableHead>
                <TableHead>Véhicule</TableHead>
                <TableHead className="hidden md:table-cell">Client</TableHead>
                <TableHead className="hidden lg:table-cell">Période</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="num font-medium text-foreground">{b.numero}</span>
                      <span className="text-xs text-muted-foreground">{b.createdAtLabel}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-foreground">{b.vehicule}</span>
                      <span className="text-xs text-muted-foreground">
                        {b.avecChauffeur ? "Avec chauffeur" : "Sans chauffeur"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex flex-col">
                      <span className="text-foreground">{b.nomClient}</span>
                      <PhoneLink telephone={b.telephoneClient} className="text-xs" />
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div className="flex flex-col">
                      <span className="text-foreground">{b.periodeLabel}</span>
                      <span className="text-xs text-muted-foreground">
                        {b.nombreJours} jour{b.nombreJours > 1 ? "s" : ""}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="num text-right">{b.totalLabel}</TableCell>
                  <TableCell>
                    <Badge variant={VEHICLE_BOOKING_STATUS_TONES[b.statut] ?? "secondary"}>
                      {VEHICLE_BOOKING_STATUS_LABELS[b.statut] ?? b.statut}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <BookingDialog booking={b} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </TablePanel>
    </Page>
  );
}
