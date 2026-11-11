import { redirect } from "next/navigation";

import { Hash, Search } from "lucide-react";

import { EmptyState, Page, PageHeader, TablePanel } from "@/components/admin/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { withTenantContext } from "@/lib/db/tenant-context";
import { hasCapability } from "@/lib/permissions";
import { getTenantContext } from "@/lib/tenant/context";

// Recherche par numéro (section 6, Phase 3 M23 — support garantie) : un
// client se présente avec un numéro de série sans forcément savoir dans
// quelle boutique il a été reçu ni vendu, d'où une recherche à l'échelle de
// toute l'organisation (pas de shopId dans withTenantContext ci-dessous —
// même principe que les rapports consolidés de M20).
export default async function SerialNumberSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const ctx = await getTenantContext();
  if (!hasCapability(ctx.role, "stock:read")) {
    redirect("/dashboard");
  }

  const { q } = await searchParams;
  const query = (q ?? "").trim();

  const results = query
    ? await withTenantContext({ organizationId: ctx.organizationId }, async (tx) => {
        return tx.serialNumber.findMany({
          where: { numero: { contains: query, mode: "insensitive" } },
          include: {
            shop: true,
            variant: { include: { product: true } },
            saleLine: { include: { sale: { include: { customer: true } } } },
          },
          orderBy: { receivedAt: "desc" },
          take: 50,
        });
      })
    : [];

  return (
    <Page>
      <PageHeader
        title="Numéros de série"
        back={{ href: "/catalog/products", label: "Produits" }}
        description={<>Recherche dans toutes les boutiques de l&apos;organisation — utile pour le service après-vente et la garantie.</>}
      />

      <form method="get" className="no-print flex flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-card sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-subtle-foreground" />
          <Input
            id="q"
            name="q"
            type="search"
            defaultValue={query}
            placeholder="Numéro de série, ex. SN-000123"
            aria-label="Numéro de série"
            className="pl-8"
          />
        </div>
        <Button type="submit">Rechercher</Button>
      </form>

      {!query && (
        <EmptyState
          icon={Hash}
          title="Recherchez un numéro de série"
          description="Saisissez tout ou partie d'un numéro pour retrouver le produit, la boutique et la vente associée."
        />
      )}

      {query && (
        <TablePanel>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>N° de série</TableHead>
                <TableHead>Produit</TableHead>
                <TableHead>Boutique</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Reçu le</TableHead>
                <TableHead>Vente</TableHead>
                <TableHead>Client</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="text-foreground">{s.numero}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.variant.product.designation}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{s.shop.nom}</TableCell>
                  <TableCell
                    className={s.statut === "VENDU" ? "text-muted-foreground" : "text-foreground"}
                  >
                    {s.statut === "VENDU" ? "Vendu" : "En stock"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.receivedAt.toLocaleDateString("fr-FR")}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.saleLine
                      ? `${s.saleLine.sale.numero} — ${s.saleLine.sale.createdAt.toLocaleDateString("fr-FR")}`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.saleLine?.sale.customer?.nom ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
              {results.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Aucun numéro de série ne correspond à cette recherche.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TablePanel>
      )}
    </Page>
  );
}
