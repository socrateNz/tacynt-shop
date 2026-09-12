import type { CSSProperties, ReactNode } from "react";

import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarNav, type NavGroup, type NavLink } from "@/components/ui/sidebar-nav";
import { systemPrisma } from "@/lib/db/system-client";
import { withTenantContext } from "@/lib/db/tenant-context";
import { getActiveShopId } from "@/lib/tenant/active-shop";
import { getTenantContext } from "@/lib/tenant/context";
import { parseOrgSettings } from "@/lib/tenant/settings";

import { ShopSwitcher } from "./shops/shop-switcher";

const TOP_LINKS: NavLink[] = [{ href: "/", label: "Accueil", icon: "Home" }];

// Même 17 liens que l'ancienne nav horizontale, simplement regroupés pour la
// lisibilité en sidebar verticale — aucune route ajoutée, retirée ou renommée.
// icon: clé (string), jamais la référence du composant — voir le commentaire
// dans components/ui/sidebar-nav.tsx (ce fichier est un Server Component,
// une icône lucide ne peut pas traverser la frontière vers le Client
// Component SidebarNav).
const GROUPS: NavGroup[] = [
  {
    label: "Ventes",
    links: [
      { href: "/caisse", label: "Caisse", icon: "ShoppingCart" },
      { href: "/sales", label: "Ventes", icon: "ReceiptText" },
      { href: "/online-orders", label: "Commandes en ligne", icon: "ShoppingBag" },
    ],
  },
  {
    label: "Catalogue",
    links: [
      { href: "/catalog/products", label: "Produits", icon: "Package" },
      { href: "/catalog/categories", label: "Catégories", icon: "Tags" },
      { href: "/catalog/import", label: "Import", icon: "FileUp" },
    ],
  },
  {
    label: "Stock",
    links: [
      { href: "/stock/movements", label: "Mouvements", icon: "Boxes" },
      { href: "/transfers", label: "Transferts", icon: "ArrowLeftRight" },
      { href: "/inventory", label: "Inventaire", icon: "ClipboardList" },
    ],
  },
  {
    label: "Partenaires",
    links: [
      { href: "/customers", label: "Clients", icon: "Users" },
      { href: "/suppliers", label: "Fournisseurs", icon: "Truck" },
    ],
  },
  {
    label: "Pilotage",
    links: [
      { href: "/expenses", label: "Dépenses", icon: "Receipt" },
      { href: "/reports", label: "Rapports", icon: "BarChart3" },
      { href: "/mobile", label: "Vue propriétaire", icon: "Smartphone" },
    ],
  },
  {
    label: "Organisation",
    links: [
      { href: "/shops", label: "Boutiques", icon: "Store" },
      { href: "/users", label: "Utilisateurs", icon: "UserCog" },
      { href: "/security", label: "Sécurité", icon: "Shield" },
      { href: "/settings", label: "Paramètres", icon: "Settings" },
    ],
  },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const ctx = await getTenantContext();
  const [organization, activeShopId, userShops, user] = await Promise.all([
    systemPrisma.organization.findUnique({ where: { id: ctx.organizationId } }),
    getActiveShopId(ctx.organizationId, ctx.userId),
    withTenantContext({ organizationId: ctx.organizationId }, (tx) =>
      tx.userShop.findMany({
        where: { userId: ctx.userId },
        include: { shop: true },
        orderBy: { shop: { nom: "asc" } },
      }),
    ),
    systemPrisma.user.findUnique({ where: { id: ctx.userId }, select: { email: true } }),
  ]);

  // White label (Phase 4, M27) : hasLogo évite de relire organization_branding
  // ici juste pour décider d'afficher une balise <img> — le fichier lui-même
  // n'est servi que par /api/branding/logo (public, résolu par host).
  const branding = organization ? parseOrgSettings(organization.settings).branding : undefined;
  const brandingStyle = branding?.primaryColor
    ? ({
        "--primary": branding.primaryColor,
        "--sidebar-primary": branding.primaryColor,
        "--sidebar-ring": branding.primaryColor,
        "--ring": branding.primaryColor,
      } as CSSProperties)
    : undefined;

  return (
    <div className="flex min-h-0 flex-1" style={brandingStyle}>
      <SidebarNav topLinks={TOP_LINKS} groups={GROUPS} />
      <div className="flex min-h-0 flex-1 flex-col bg-background">
        <header className="no-print flex shrink-0 items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-4">
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
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" className="gap-2 px-1.5" />}>
              <Avatar size="sm">
                <AvatarFallback>{(user?.email ?? "?").slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="text-sm text-foreground">{user?.email}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{user?.email}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <form action="/api/auth/logout" method="POST">
                <Button
                  type="submit"
                  variant="ghost"
                  className="w-full justify-start px-1.5 font-normal"
                >
                  Se déconnecter
                </Button>
              </form>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        {ctx.organizationStatus === "GRACE_PERIOD" && (
          <div className="no-print shrink-0 border-b border-warning/30 bg-warning/10 px-6 py-2 text-sm text-foreground">
            Abonnement en attente de paiement — période de grâce en cours. La caisse et
            l&apos;administration restent pleinement fonctionnelles.
          </div>
        )}
        {ctx.organizationStatus === "SUSPENDED" && (
          <div className="no-print shrink-0 border-b border-destructive/30 bg-destructive/10 px-6 py-2 text-sm text-foreground">
            Abonnement suspendu (impayé) — les actions d&apos;administration sont bloquées. La
            caisse (vente, encaissement) reste utilisable.
          </div>
        )}
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-10">
          <div className="w-full">{children}</div>
        </main>
      </div>
    </div>
  );
}
