import { Plus } from "lucide-react";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

import { toggleShopActive, toggleShopTaxMode } from "./actions";
import { DeleteShopDialog } from "./delete-shop-dialog";
import { ShopForm } from "./shop-form";
import { ShopUsersDialog } from "./shop-users-dialog";

export default async function ShopsPage() {
  const ctx = await getTenantContext();
  if (!hasCapability(ctx.role, "shops:manage")) {
    redirect("/dashboard");
  }
  const canDelete = hasCapability(ctx.role, "shops:delete");

  const { shops, users, assignedByShop } = await withTenantContext(
    { organizationId: ctx.organizationId },
    async (tx) => {
      const shops = await tx.shop.findMany({ orderBy: { nom: "asc" } });
      const users = await tx.user.findMany({ orderBy: { email: "asc" } });
      const assignments = await tx.userShop.findMany();
      const assignedByShop = new Map<string, Set<string>>();
      for (const a of assignments) {
        const set = assignedByShop.get(a.shopId) ?? new Set<string>();
        set.add(a.userId);
        assignedByShop.set(a.shopId, set);
      }
      return { shops, users, assignedByShop };
    },
  );

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Boutiques</h1>
          <p className="text-sm text-muted-foreground">
            Le catalogue est mutualisé au niveau de l&apos;organisation, le stock et les prix sont
            par boutique.
          </p>
        </div>
        <Dialog>
          <DialogTrigger render={<Button className="gap-1.5" />}>
            <Plus className="size-4" />
            Nouvelle boutique
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Nouvelle boutique</DialogTitle>
            </DialogHeader>
            <ShopForm />
          </DialogContent>
        </Dialog>
      </header>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Adresse</TableHead>
              <TableHead>Téléphone</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Taxe</TableHead>
              <TableHead />
              <TableHead className="text-right">Action</TableHead>
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
                <TableCell>
                  <form action={toggleShopTaxMode} className="flex items-center gap-2">
                    <input type="hidden" name="shopId" value={s.id} />
                    <Badge variant={s.taxeRetenueSource ? "secondary" : "success"}>
                      {s.taxeRetenueSource ? "Retenue à la source" : "Incluse dans le prix"}
                    </Badge>
                    <Button type="submit" variant="ghost" size="sm">
                      Changer
                    </Button>
                  </form>
                </TableCell>
                <TableCell className="flex justify-end gap-2">
                  <form action={toggleShopActive}>
                    <input type="hidden" name="shopId" value={s.id} />
                    <Button type="submit" variant="ghost" size="sm">
                      {s.actif ? "Désactiver" : "Activer"}
                    </Button>
                  </form>
                </TableCell>
                <TableCell className="flex justify-end gap-1 text-right">
                  <ShopUsersDialog
                    shopId={s.id}
                    shopNom={s.nom}
                    users={users.map((u) => ({
                      id: u.id,
                      nom: u.nom,
                      email: u.email,
                      role: u.role,
                      assigned: assignedByShop.get(s.id)?.has(u.id) ?? false,
                    }))}
                  />
                  {canDelete && <DeleteShopDialog shopId={s.id} shopNom={s.nom} />}
                </TableCell>
              </TableRow>
            ))}
            {shops.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Aucune boutique pour l&apos;instant.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
