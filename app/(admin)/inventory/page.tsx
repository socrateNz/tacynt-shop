import { Eye } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
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

  const [sessions, categories] = await withTenantContext(
    { organizationId: ctx.organizationId, shopId },
    async (tx) => {
      const sessions = await tx.inventorySession.findMany({
        where: { shopId },
        orderBy: { createdAt: "desc" },
        include: { category: true, _count: { select: { counts: true } } },
        take: 30,
      });
      const categories = await tx.category.findMany({ orderBy: { nom: "asc" } });
      return [sessions, categories] as const;
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
            {sessions.map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <Link
                    href={`/inventory/${s.id}`}
                    className="text-foreground underline-offset-4 hover:underline"
                  >
                    {s.type === "COMPLET" ? "Complet" : "Partiel"}
                  </Link>
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
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    nativeButton={false}
                    render={<Link href={`/inventory/${s.id}`} />}
                  >
                    <Eye className="size-3.5" />
                    <span className="sr-only">Voir</span>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
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
