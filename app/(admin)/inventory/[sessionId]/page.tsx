import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { withTenantContext } from "@/lib/db/tenant-context";
import { hasCapability } from "@/lib/permissions";
import { getActiveShopId } from "@/lib/tenant/active-shop";
import { getTenantContext } from "@/lib/tenant/context";

import { cancelInventorySession, validateInventorySession } from "./actions";
import { CountRow } from "./count-row";

export default async function InventorySessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const ctx = await getTenantContext();
  if (!hasCapability(ctx.role, "inventory:manage")) {
    redirect("/");
  }

  const { sessionId } = await params;
  const shopId = await getActiveShopId(ctx.organizationId, ctx.userId);

  const { session, rows } = await withTenantContext(
    { organizationId: ctx.organizationId, shopId },
    async (tx) => {
      const session = await tx.inventorySession.findUniqueOrThrow({
        where: { id: sessionId },
        include: { category: true },
      });

      const variants = await tx.productVariant.findMany({
        where: {
          actif: true,
          product: {
            suiviStock: true,
            ...(session.categoryId ? { categoryId: session.categoryId } : {}),
          },
        },
        include: { product: true, stockLevels: { where: { shopId } } },
        orderBy: { product: { designation: "asc" } },
      });

      const counts = await tx.inventoryCount.findMany({ where: { inventorySessionId: sessionId } });
      const countByVariant = new Map(counts.map((c) => [c.variantId, c]));

      const rows = variants.map((v) => {
        const count = countByVariant.get(v.id);
        return {
          variantId: v.id,
          designation: v.product.designation,
          quantiteTheoriqueActuelle: v.stockLevels[0] ? Number(v.stockLevels[0].quantite) : 0,
          existingCount: count
            ? {
                quantiteTheorique: Number(count.quantiteTheorique),
                quantiteComptee: count.quantiteComptee !== null ? Number(count.quantiteComptee) : null,
              }
            : null,
        };
      });

      return { session, rows };
    },
  );

  const countedLines = rows.filter((r) => r.existingCount?.quantiteComptee !== null).length;
  const readOnly = session.statut !== "EN_COURS";

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Inventaire {session.type === "COMPLET" ? "complet" : `partiel — ${session.category?.nom}`}
          </h1>
          <p className="text-sm text-muted-foreground">
            {countedLines} / {rows.length} ligne(s) comptée(s) — statut : {session.statut}
          </p>
        </div>
        <Link href="/inventory" className="text-sm text-primary underline-offset-4 hover:underline">
          ← Retour
        </Link>
      </header>

      {session.statut === "EN_COURS" && (
        <div className="flex gap-2">
          <form action={validateInventorySession}>
            <input type="hidden" name="inventorySessionId" value={session.id} />
            <Button type="submit">Valider l&apos;inventaire</Button>
          </form>
          <form action={cancelInventorySession}>
            <input type="hidden" name="inventorySessionId" value={session.id} />
            <Button type="submit" variant="ghost">
              Annuler
            </Button>
          </form>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produit</TableHead>
              <TableHead className="text-right">Théorique</TableHead>
              <TableHead className="text-right">Compté</TableHead>
              <TableHead className="text-right">Écart</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <CountRow
                key={r.variantId}
                inventorySessionId={session.id}
                variantId={r.variantId}
                designation={r.designation}
                quantiteTheoriqueActuelle={r.quantiteTheoriqueActuelle}
                existingCount={r.existingCount}
                readOnly={readOnly}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
