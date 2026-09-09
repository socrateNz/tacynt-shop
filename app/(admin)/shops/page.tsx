import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
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
import { getTenantContext } from "@/lib/tenant/context";

import { toggleShopActive } from "./actions";
import { ShopForm } from "./shop-form";

export default async function ShopsPage() {
  const ctx = await getTenantContext();
  if (!hasCapability(ctx.role, "shops:manage")) {
    redirect("/");
  }

  const shops = await withTenantContext({ organizationId: ctx.organizationId }, (tx) =>
    tx.shop.findMany({ orderBy: { nom: "asc" } }),
  );

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-xl font-semibold text-foreground">Boutiques</h1>
        <p className="text-sm text-muted-foreground">
          Le catalogue est mutualisé au niveau de l&apos;organisation, le stock et les prix sont
          par boutique.
        </p>
      </header>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Adresse</TableHead>
              <TableHead>Téléphone</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {shops.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="text-foreground">{s.nom}</TableCell>
                <TableCell className="text-muted-foreground">{s.adresse ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{s.telephone ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={s.actif ? "success" : "secondary"}>
                    {s.actif ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="flex justify-end gap-2">
                  <Link href={`/shops/${s.id}/users`}>
                    <Button type="button" variant="outline" size="sm">
                      Utilisateurs
                    </Button>
                  </Link>
                  <form action={toggleShopActive}>
                    <input type="hidden" name="shopId" value={s.id} />
                    <Button type="submit" variant="ghost" size="sm">
                      {s.actif ? "Désactiver" : "Activer"}
                    </Button>
                  </form>
                </TableCell>
              </TableRow>
            ))}
            {shops.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  Aucune boutique pour l&apos;instant.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <ShopForm />
    </div>
  );
}
