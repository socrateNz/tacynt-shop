import { redirect } from "next/navigation";

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
    redirect("/");
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
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-xl font-semibold text-foreground">Numéros de série</h1>
        <p className="text-sm text-muted-foreground">
          Recherche à l&apos;échelle de l&apos;organisation, toutes boutiques confondues —
          support garantie.
        </p>
      </header>

      <form method="get" className="flex items-end gap-3">
        <div className="flex flex-1 flex-col gap-1.5">
          <label htmlFor="q" className="text-sm text-muted-foreground">
            Numéro de série
          </label>
          <input
            id="q"
            name="q"
            defaultValue={query}
            placeholder="SN-000123"
            className="h-8 rounded-md border border-border bg-background px-2.5 text-sm"
          />
        </div>
        <button
          type="submit"
          className="h-8 rounded-md bg-primary px-4 text-sm text-primary-foreground"
        >
          Rechercher
        </button>
      </form>

      {query && (
        <div className="rounded-xl border border-border bg-card">
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
        </div>
      )}
    </div>
  );
}
