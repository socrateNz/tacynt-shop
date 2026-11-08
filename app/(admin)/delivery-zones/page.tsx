import { Plus } from "lucide-react";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { systemPrisma } from "@/lib/db/system-client";
import { withTenantContext } from "@/lib/db/tenant-context";
import { formatMoney } from "@/lib/money";
import { hasCapability } from "@/lib/permissions";
import { getTenantContext } from "@/lib/tenant/context";
import { organizationHasModule } from "@/lib/tenant/modules";

import { createDeliveryZone, toggleDeliveryZone, updateZoneFrais } from "./actions";
import { DeliverySettingsDialog, type ShopDeliverySettings } from "./delivery-settings-dialog";

const toNumber = (v: { toString(): string } | null) => (v === null ? null : Number(v));

// Zones de livraison par boutique (chacune avec son prix) : ce sont les
// SEULS lieux qu'un client peut choisir pour être livré (app Sodu et
// vitrine web), complétés d'un lieu-dit libre. Les réglages généraux
// (activation, panier minimum, livraison gratuite) sont dans le dialogue
// "Paramètres de livraison".
export default async function DeliveryZonesPage() {
  const ctx = await getTenantContext();
  const organization = await systemPrisma.organization.findUniqueOrThrow({
    where: { id: ctx.organizationId },
  });

  if (!hasCapability(ctx.role, "ecommerce:manage") || !organizationHasModule(organization.enabledModules, "ecommerce")) {
    redirect("/dashboard");
  }

  const [shops, zones] = await withTenantContext({ organizationId: ctx.organizationId }, (tx) =>
    Promise.all([
      tx.shop.findMany({ where: { actif: true }, orderBy: { nom: "asc" } }),
      tx.deliveryZone.findMany({ orderBy: [{ actif: "desc" }, { nom: "asc" }] }),
    ]),
  );

  const devise = organization.devise;
  const settings: ShopDeliverySettings[] = shops.map((s) => ({
    id: s.id,
    nom: s.nom,
    livraisonActive: s.livraisonActive,
    montantMinimumLivraison: toNumber(s.montantMinimumLivraison),
    livraisonGratuiteActive: s.livraisonGratuiteActive,
    montantLivraisonGratuite: toNumber(s.montantLivraisonGratuite),
  }));

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Zones de livraison</h1>
          <p className="text-sm text-muted-foreground">
            Les quartiers ou secteurs que chaque boutique livre, avec leur prix. Le client choisit obligatoirement
            l&apos;une de ces zones et précise un lieu-dit.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DeliverySettingsDialog shops={settings} devise={devise} />
          <Dialog>
            <DialogTrigger render={<Button className="gap-1.5" disabled={shops.length === 0} />}>
              <Plus className="size-4" />
              Nouvelle zone
            </DialogTrigger>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Nouvelle zone de livraison</DialogTitle>
              </DialogHeader>
              <form action={createDeliveryZone} className="flex flex-col gap-4">
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
                  <Label htmlFor="nom">Nom de la zone</Label>
                  <Input id="nom" name="nom" required maxLength={120} placeholder="Bonamoussadi" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="frais">Prix de la livraison ({devise})</Label>
                  <Input id="frais" name="frais" type="number" min={0} step="1" inputMode="decimal" placeholder="0" />
                  <p className="text-xs text-muted-foreground">Laissez vide ou 0 pour une livraison gratuite.</p>
                </div>
                <Button type="submit" className="self-start">
                  Ajouter
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      {shops.map((shop) => {
        const shopZones = zones.filter((z) => z.shopId === shop.id);
        const activeCount = shopZones.filter((z) => z.actif).length;
        const minimum = toNumber(shop.montantMinimumLivraison);
        const seuilGratuite = shop.livraisonGratuiteActive ? toNumber(shop.montantLivraisonGratuite) : null;
        return (
          <section key={shop.id} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-medium text-foreground">{shop.nom}</h2>
              {!shop.livraisonActive ? (
                <Badge variant="destructive">Livraison désactivée</Badge>
              ) : (
                <Badge variant={activeCount > 0 ? "success" : "secondary"}>
                  {activeCount > 0
                    ? `${activeCount} zone${activeCount > 1 ? "s" : ""} active${activeCount > 1 ? "s" : ""}`
                    : "Retrait uniquement"}
                </Badge>
              )}
              {shop.livraisonActive && minimum !== null && (
                <Badge variant="secondary">Livraison dès {formatMoney(minimum, devise)}</Badge>
              )}
              {shop.livraisonActive && seuilGratuite !== null && (
                <Badge variant="success">Gratuite dès {formatMoney(seuilGratuite, devise)}</Badge>
              )}
            </div>
            <div className="rounded-xl border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Zone</TableHead>
                    <TableHead>Prix de la livraison</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shopZones.map((z) => (
                    <TableRow key={z.id}>
                      <TableCell className={z.actif ? "text-foreground" : "text-muted-foreground"}>{z.nom}</TableCell>
                      <TableCell>
                        <form action={updateZoneFrais} className="flex items-center gap-1.5">
                          <input type="hidden" name="zoneId" value={z.id} />
                          <Input
                            name="frais"
                            type="number"
                            min={0}
                            step="1"
                            inputMode="decimal"
                            defaultValue={Number(z.frais)}
                            aria-label={`Prix de la livraison — ${z.nom}`}
                            className="h-8 w-28"
                          />
                          <span className="text-xs text-muted-foreground">{devise}</span>
                          <Button type="submit" variant="ghost" size="sm">
                            OK
                          </Button>
                        </form>
                      </TableCell>
                      <TableCell>
                        <Badge variant={z.actif ? "success" : "secondary"}>{z.actif ? "Active" : "Désactivée"}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <form action={toggleDeliveryZone}>
                          <input type="hidden" name="zoneId" value={z.id} />
                          <Button type="submit" variant="ghost" size="sm">
                            {z.actif ? "Désactiver" : "Réactiver"}
                          </Button>
                        </form>
                      </TableCell>
                    </TableRow>
                  ))}
                  {shopZones.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        Aucune zone pour cette boutique.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
