import { Plus } from "lucide-react";

import { Page, PageHeader, TablePanel } from "@/components/admin/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { withTenantContext } from "@/lib/db/tenant-context";

import { createLaundryItem, toggleLaundryItem, updateLaundryItemPrice } from "../actions";
import { requireLaundryPage } from "../guard";

// Catalogue de blanchisserie par boutique : un prix par pièce (T-shirt,
// chemise, drap…). C'est ce que le client voit et déclare en commandant.
export default async function LaundryItemsPage() {
  const { ctx, organization } = await requireLaundryPage();
  const devise = organization.devise;

  const [shops, items] = await withTenantContext({ organizationId: ctx.organizationId }, (tx) =>
    Promise.all([
      tx.shop.findMany({ where: { actif: true }, orderBy: { nom: "asc" } }),
      tx.laundryItem.findMany({ orderBy: [{ actif: "desc" }, { categorie: "asc" }, { nom: "asc" }] }),
    ]),
  );

  return (
    <Page>
      <PageHeader
        title="Catalogue blanchisserie"
        description="Les pièces que vous lavez et leur prix à la pièce. Le client déclare ses pièces en commandant ; vous recomptez à la réception du linge."
        actions={
          <>
            <Dialog>
              <DialogTrigger render={<Button disabled={shops.length === 0} />}>
                <Plus />
                Nouvel article
              </DialogTrigger>
              <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                  <DialogTitle>Nouvel article</DialogTitle>
                </DialogHeader>
                <form action={createLaundryItem} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="shopId">Boutique</Label>
                    <select
                      id="shopId"
                      name="shopId"
                      required
                      className="h-8 rounded-md border border-border bg-background px-2.5 text-sm"
                    >
                      {shops.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nom}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="nom">Article</Label>
                    <Input id="nom" name="nom" required maxLength={120} placeholder="T-shirt" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="categorie">Catégorie (facultatif)</Label>
                    <Input id="categorie" name="categorie" maxLength={80} placeholder="Hauts" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="prixUnitaire">Prix par pièce ({devise})</Label>
                    <Input
                      id="prixUnitaire"
                      name="prixUnitaire"
                      type="number"
                      min={0}
                      step="1"
                      inputMode="decimal"
                      required
                      placeholder="500"
                    />
                  </div>
                  <Button type="submit" className="self-end">
                    Ajouter
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      {shops.map((shop) => {
        const shopItems = items.filter((i) => i.shopId === shop.id);
        const activeCount = shopItems.filter((i) => i.actif).length;
        return (
          <section key={shop.id} className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-foreground">{shop.nom}</h2>
              <Badge variant={activeCount > 0 ? "success" : "secondary"}>
                {activeCount} article{activeCount > 1 ? "s" : ""} proposé{activeCount > 1 ? "s" : ""}
              </Badge>
            </div>
            <TablePanel>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Article</TableHead>
                    <TableHead>Catégorie</TableHead>
                    <TableHead>Prix par pièce</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="w-12">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shopItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className={item.actif ? "text-foreground" : "text-muted-foreground"}>
                        {item.nom}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{item.categorie ?? "—"}</TableCell>
                      <TableCell>
                        <form action={updateLaundryItemPrice} className="flex items-center gap-1.5">
                          <input type="hidden" name="itemId" value={item.id} />
                          <Input
                            name="prixUnitaire"
                            type="number"
                            min={0}
                            step="1"
                            inputMode="decimal"
                            defaultValue={Number(item.prixUnitaire)}
                            aria-label={`Prix par pièce — ${item.nom}`}
                            className="h-8 w-28"
                          />
                          <span className="text-xs text-muted-foreground">{devise}</span>
                          <Button type="submit" variant="outline" size="sm">
                            Enregistrer
                          </Button>
                        </form>
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.actif ? "success" : "secondary"}>
                          {item.actif ? "Proposé" : "Désactivé"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <form action={toggleLaundryItem}>
                          <input type="hidden" name="itemId" value={item.id} />
                          <Button type="submit" variant="ghost" size="sm">
                            {item.actif ? "Désactiver" : "Réactiver"}
                          </Button>
                        </form>
                      </TableCell>
                    </TableRow>
                  ))}
                  {shopItems.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        Aucun article pour cette boutique.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TablePanel>
          </section>
        );
      })}
    </Page>
  );
}
