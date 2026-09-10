import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { systemPrisma } from "@/lib/db/system-client";
import { withTenantContext } from "@/lib/db/tenant-context";
import { getActiveShopId } from "@/lib/tenant/active-shop";
import { getTenantContext } from "@/lib/tenant/context";
import { parseOrgSettings } from "@/lib/tenant/settings";

import { ShopSwitcher } from "./shops/shop-switcher";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const ctx = await getTenantContext();
  const [organization, activeShopId, userShops] = await Promise.all([
    systemPrisma.organization.findUnique({ where: { id: ctx.organizationId } }),
    getActiveShopId(ctx.organizationId, ctx.userId),
    withTenantContext({ organizationId: ctx.organizationId }, (tx) =>
      tx.userShop.findMany({
        where: { userId: ctx.userId },
        include: { shop: true },
        orderBy: { shop: { nom: "asc" } },
      }),
    ),
  ]);

  // White label (Phase 4, M27) : hasLogo évite de relire organization_branding
  // ici juste pour décider d'afficher une balise <img> — le fichier lui-même
  // n'est servi que par /api/branding/logo (public, résolu par host).
  const branding = organization ? parseOrgSettings(organization.settings).branding : undefined;

  return (
    <div
      className="flex flex-1 flex-col bg-background"
      style={branding?.primaryColor ? ({ "--primary": branding.primaryColor } as CSSProperties) : undefined}
    >
      <header className="no-print flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-6">
          {branding?.hasLogo ? (
            // eslint-disable-next-line @next/next/no-img-element -- logo servi dynamiquement par organisation, pas un asset statique optimisable par next/image
            <img src="/api/branding/logo" alt={organization?.nom ?? ""} className="h-6 w-auto" />
          ) : (
            <span className="text-sm font-semibold text-foreground">{organization?.nom}</span>
          )}
          <ShopSwitcher
            shops={userShops.map((us) => ({ id: us.shop.id, nom: us.shop.nom }))}
            activeShopId={activeShopId}
          />
          <nav className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground">
              Accueil
            </Link>
            <Link href="/shops" className="hover:text-foreground">
              Boutiques
            </Link>
            <Link href="/settings" className="hover:text-foreground">
              Paramètres
            </Link>
            <Link href="/transfers" className="hover:text-foreground">
              Transferts
            </Link>
            <Link href="/catalog/categories" className="hover:text-foreground">
              Catégories
            </Link>
            <Link href="/catalog/products" className="hover:text-foreground">
              Produits
            </Link>
            <Link href="/catalog/import" className="hover:text-foreground">
              Import
            </Link>
            <Link href="/stock/movements" className="hover:text-foreground">
              Stock
            </Link>
            <Link href="/customers" className="hover:text-foreground">
              Clients
            </Link>
            <Link href="/suppliers" className="hover:text-foreground">
              Fournisseurs
            </Link>
            <Link href="/expenses" className="hover:text-foreground">
              Dépenses
            </Link>
            <Link href="/inventory" className="hover:text-foreground">
              Inventaire
            </Link>
            <Link href="/caisse" className="hover:text-foreground">
              Caisse
            </Link>
            <Link href="/sales" className="hover:text-foreground">
              Ventes
            </Link>
            <Link href="/online-orders" className="hover:text-foreground">
              Commandes en ligne
            </Link>
            <Link href="/reports" className="hover:text-foreground">
              Rapports
            </Link>
            <Link href="/mobile" className="hover:text-foreground">
              Vue propriétaire
            </Link>
            <Link href="/users" className="hover:text-foreground">
              Utilisateurs
            </Link>
            <Link href="/security" className="hover:text-foreground">
              Sécurité
            </Link>
          </nav>
        </div>
        <form action="/api/auth/logout" method="POST">
          <Button type="submit" variant="outline" size="sm">
            Se déconnecter
          </Button>
        </form>
      </header>
      {ctx.organizationStatus === "GRACE_PERIOD" && (
        <div className="no-print border-b border-warning/30 bg-warning/10 px-6 py-2 text-sm text-foreground">
          Abonnement en attente de paiement — période de grâce en cours. La caisse et
          l&apos;administration restent pleinement fonctionnelles.
        </div>
      )}
      {ctx.organizationStatus === "SUSPENDED" && (
        <div className="no-print border-b border-destructive/30 bg-destructive/10 px-6 py-2 text-sm text-foreground">
          Abonnement suspendu (impayé) — les actions d&apos;administration sont bloquées. La
          caisse (vente, encaissement) reste utilisable.
        </div>
      )}
      <main className="flex flex-1 flex-col px-6 py-10">
        <div className="mx-auto w-full max-w-4xl">{children}</div>
      </main>
    </div>
  );
}
