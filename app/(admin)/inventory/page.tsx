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
import { getActiveShopId } from "@/lib/tenant/active-shop";
import { getTenantContext } from "@/lib/tenant/context";

import { InventorySessionDialog, type InventoryCountRow } from "./inventory-session-dialog";
import { InventorySessionForm } from "./inventory-session-form";

const STATUS_LABELS: Record<string, string> = {
  EN_COURS: "En cours",
  VALIDEE: "Validé",
  ANNULEE: "Annulé",
};

export default async function InventoryPage() {
  const ctx = await getTenantContext();
  if (!hasCapability(ctx.role, "inventory:manage")) {
    redirect("/");
  }

  const shopId = await getActiveShopId(ctx.organizationId, ctx.userId);

  const { sessions, categories, rowsBySession } = await withTenantContext(
    { organizationId: ctx.organizationId, shopId },
    async (tx) => {
      const sessions = await tx.inventorySession.findMany({
        where: { shopId },
        orderBy: { createdAt: "desc" },
        include: { category: true, _count: { select: { counts: true } } },
        take: 30,
      });
      const categories = await tx.category.findMany({ orderBy: { nom: "asc" } });

      // Le catalogue de variantes ne dépend que de la catégorie de la
      // session (ou de rien pour un inventaire complet) — on ne le
      // récupère qu'une fois par catégorie distincte, pas par session.
      const categoryIds = [...new Set(sessions.map((s) => s.categoryId))];
      const variantsByCategoryEntries = await Promise.all(
        categoryIds.map(async (categoryId) => {
          const variants = await tx.productVariant.findMany({
            where: {
              actif: true,
              product: { suiviStock: true, ...(categoryId ? { categoryId } : {}) },
            },
            include: { product: true, stockLevels: { where: { shopId } } },
            orderBy: { product: { designation: "asc" } },
          });
          return [categoryId, variants] as const;
        }),
      );
      const variantsByCategory = new Map(variantsByCategoryEntries);

      const sessionIds = sessions.map((s) => s.id);
      const counts = sessionIds.length
        ? await tx.inventoryCount.findMany({ where: { inventorySessionId: { in: sessionIds } } })
        : [];
      const countsBySession = new Map<string, typeof counts>();
      for (const c of counts) {
        const list = countsBySession.get(c.inventorySessionId) ?? [];
        list.push(c);
        countsBySession.set(c.inventorySessionId, list);
      }

      const rowsBySession = new Map<string, InventoryCountRow[]>();
      for (const session of sessions) {
        const variants = variantsByCategory.get(session.categoryId) ?? [];
        const countByVariant = new Map(
          (countsBySession.get(session.id) ?? []).map((c) => [c.variantId, c]),
        );
        const rows: InventoryCountRow[] = variants.map((v) => {
          const count = countByVariant.get(v.id);
          return {
            variantId: v.id,
            designation: v.product.designation,
            quantiteTheoriqueActuelle: v.stockLevels[0] ? Number(v.stockLevels[0].quantite) : 0,
            existingCount: count
              ? {
                  quantiteTheorique: Number(count.quantiteTheorique),
                  quantiteComptee:
                    count.quantiteComptee !== null ? Number(count.quantiteComptee) : null,
                }
              : null,
          };
        });
        rowsBySession.set(session.id, rows);
      }

      return { sessions, categories, rowsBySession };
    },
  );

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-xl font-semibold text-foreground">Inventaire</h1>
        <p className="text-sm text-muted-foreground">
          La boutique continue de vendre pendant un inventaire — chaque ligne est comparée au
          stock théorique au moment précis où elle est comptée, pas à l&apos;ouverture de la
          session.
        </p>
      </header>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Catégorie</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Lignes comptées</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sessions.map((s) => {
              const rows = rowsBySession.get(s.id) ?? [];
              const countedLines = rows.filter((r) => r.existingCount?.quantiteComptee !== null).length;
              const title =
                s.type === "COMPLET"
                  ? "Inventaire complet"
                  : `Inventaire partiel — ${s.category?.nom}`;
              return (
                <TableRow key={s.id}>
                  <TableCell className="text-foreground">
                    {s.type === "COMPLET" ? "Complet" : "Partiel"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{s.category?.nom ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {STATUS_LABELS[s.statut] ?? s.statut}
                  </TableCell>
                  <TableCell className="num text-right">{s._count.counts}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.createdAt.toLocaleDateString("fr-FR")}
                  </TableCell>
                  <TableCell className="text-right">
                    <InventorySessionDialog
                      sessionId={s.id}
                      title={title}
                      statut={s.statut}
                      countedLines={countedLines}
                      totalLines={rows.length}
                      rows={rows}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
            {sessions.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Aucun inventaire pour l&apos;instant.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <InventorySessionForm categories={categories.map((c) => ({ id: c.id, nom: c.nom }))} />
    </div>
  );
}
