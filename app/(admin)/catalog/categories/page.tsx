import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

import { createCategory } from "./actions";

export default async function CategoriesPage() {
  const ctx = await getTenantContext();
  // Vendeur/Comptable n'ont pas accès au catalogue (tableau des rôles,
  // section 5.8) — proxy.ts ne vérifie que la session, pas les permissions
  // par page, donc la garde doit être ici.
  if (!hasCapability(ctx.role, "catalog:read")) {
    redirect("/");
  }

  const categories = await withTenantContext({ organizationId: ctx.organizationId }, (tx) =>
    tx.category.findMany({ orderBy: { nom: "asc" }, include: { parent: true } }),
  );
  const canWrite = hasCapability(ctx.role, "catalog:write");

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-xl font-semibold text-foreground">Catégories</h1>
        <p className="text-sm text-muted-foreground">Arborescence à 3 niveaux maximum.</p>
      </header>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Catégorie parente</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="text-foreground">{c.nom}</TableCell>
                <TableCell className="text-muted-foreground">{c.parent?.nom ?? "—"}</TableCell>
              </TableRow>
            ))}
            {categories.length === 0 && (
              <TableRow>
                <TableCell colSpan={2} className="text-center text-muted-foreground">
                  Aucune catégorie pour l&apos;instant.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {canWrite && (
        <form
          action={createCategory}
          className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6"
        >
          <h2 className="text-sm font-medium text-foreground">Nouvelle catégorie</h2>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nom">Nom</Label>
            <Input id="nom" name="nom" required placeholder="Boissons" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="parentId">Catégorie parente (optionnel)</Label>
            <select
              id="parentId"
              name="parentId"
              className="h-8 rounded-md border border-border bg-background px-2.5 text-sm"
            >
              <option value="">Aucune</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" className="self-start">
            Ajouter
          </Button>
        </form>
      )}
    </div>
  );
}
