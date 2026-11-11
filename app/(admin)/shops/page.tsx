import type { ReactNode } from "react";
import { Plus, Store } from "lucide-react";
import { redirect } from "next/navigation";

import { EmptyState, Page, PageHeader, TablePanel } from "@/components/admin/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { systemPrisma } from "@/lib/db/system-client";
import { withTenantContext } from "@/lib/db/tenant-context";
import { hasCapability } from "@/lib/permissions";
import { getTenantContext } from "@/lib/tenant/context";
import { availableOnlineProviders, PROVIDER_LABEL } from "@/lib/payments/methods";
import { organizationHasModule } from "@/lib/tenant/modules";

import { toggleShopActive, toggleShopOnlinePayment, toggleShopReceptionPayment, toggleShopTaxMode } from "./actions";
import { DeleteShopDialog } from "./delete-shop-dialog";
import { ShopForm } from "./shop-form";
import { ShopUsersDialog } from "./shop-users-dialog";

export default async function ShopsPage() {
  const ctx = await getTenantContext();
  if (!hasCapability(ctx.role, "shops:manage")) {
    redirect("/dashboard");
  }
  const canDelete = hasCapability(ctx.role, "shops:delete");

  const organization = await systemPrisma.organization.findUniqueOrThrow({
    where: { id: ctx.organizationId },
  });
  const ecommerceActif = organizationHasModule(organization.enabledModules, "ecommerce");
  // Cameroun (XAF) : Mobile Money ; ailleurs : paiement hors ligne uniquement.
  const moyensEnLigne = availableOnlineProviders(organization);

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
    <Page>
      <PageHeader
        title="Boutiques"
        description={<>Le catalogue est mutualisé au niveau de l&apos;organisation, le stock et les prix sont par boutique.</>}
        actions={
          <>
            <Dialog>
              <DialogTrigger render={<Button />}>
                <Plus />
                Nouvelle boutique
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Nouvelle boutique</DialogTitle>
                </DialogHeader>
                <ShopForm />
              </DialogContent>
            </Dialog>
          </>
        }
      />

      {shops.length === 0 ? (
        <TablePanel>
          <EmptyState
            icon={Store}
            title="Aucune boutique"
            description="Créez votre première boutique avec le bouton « Nouvelle boutique »."
          />
        </TablePanel>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {shops.map((s) => (
            <section key={s.id} className="flex flex-col rounded-xl border border-border bg-card shadow-card">
              <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-5">
                <div className="min-w-0 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold text-foreground">{s.nom}</h2>
                    <Badge variant={s.actif ? "success" : "secondary"}>{s.actif ? "Active" : "Inactive"}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {[s.adresse, s.telephone].filter(Boolean).join(" · ") || "Adresse et téléphone non renseignés"}
                  </p>
                </div>
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
              </div>

              <dl className="flex flex-1 flex-col divide-y divide-border">
                <SettingRow
                  label="Taxe"
                  value={
                    <Badge variant={s.taxeRetenueSource ? "secondary" : "success"}>
                      {s.taxeRetenueSource ? "Retenue à la source" : "Incluse dans le prix"}
                    </Badge>
                  }
                  action={<ToggleForm action={toggleShopTaxMode} shopId={s.id} label="Changer" />}
                />
                {ecommerceActif &&
                  (!s.paiementEnLigneActif && moyensEnLigne.length === 0 ? (
                    <SettingRow
                      label="Paiement en ligne"
                      value={
                        <span className="text-sm text-muted-foreground">
                          {organization.pays === "CM"
                            ? "Mobile Money indisponible (devise XAF requise)"
                            : "Paiement hors ligne uniquement (hors Cameroun)"}
                        </span>
                      }
                    />
                  ) : (
                    <>
                      <SettingRow
                        label="Paiement en ligne"
                        hint={
                          s.paiementEnLigneActif ? moyensEnLigne.map((m) => PROVIDER_LABEL[m]).join(" · ") : undefined
                        }
                        value={
                          <Badge variant={s.paiementEnLigneActif ? "success" : "secondary"}>
                            {s.paiementEnLigneActif ? "Actif" : "Inactif"}
                          </Badge>
                        }
                        action={
                          <ToggleForm
                            action={toggleShopOnlinePayment}
                            shopId={s.id}
                            label={s.paiementEnLigneActif ? "Désactiver" : "Activer"}
                          />
                        }
                      />
                      {s.paiementEnLigneActif && (
                        <SettingRow
                          label="Paiement à la réception"
                          value={
                            <Badge variant={s.paiementReceptionActif ? "success" : "secondary"}>
                              {s.paiementReceptionActif ? "Autorisé" : "Refusé"}
                            </Badge>
                          }
                          action={
                            <ToggleForm
                              action={toggleShopReceptionPayment}
                              shopId={s.id}
                              label={s.paiementReceptionActif ? "Refuser" : "Autoriser"}
                            />
                          }
                        />
                      )}
                    </>
                  ))}
              </dl>

              <div className="flex flex-wrap items-center justify-end gap-1.5 border-t border-border px-4 py-2.5 sm:px-5">
                {canDelete && <DeleteShopDialog shopId={s.id} shopNom={s.nom} />}
                <ToggleForm
                  action={toggleShopActive}
                  shopId={s.id}
                  label={s.actif ? "Désactiver la boutique" : "Activer la boutique"}
                />
              </div>
            </section>
          ))}
        </div>
      )}
    </Page>
  );
}

// Ligne de réglage d'une boutique : libellé, valeur actuelle, action.
function SettingRow({
  label,
  hint,
  value,
  action,
}: {
  label: string;
  hint?: string;
  value: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-5">
      <dt className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
      </dt>
      <dd className="flex items-center gap-2">
        {value}
        {action}
      </dd>
    </div>
  );
}

function ToggleForm({
  action,
  shopId,
  label,
}: {
  action: (formData: FormData) => void | Promise<void>;
  shopId: string;
  label: string;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="shopId" value={shopId} />
      <Button type="submit" variant="ghost" size="sm">
        {label}
      </Button>
    </form>
  );
}
