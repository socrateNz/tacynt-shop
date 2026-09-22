import type { CSSProperties, ReactNode } from "react";

import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MobileNav, SidebarNav, type NavGroup, type NavLink } from "@/components/ui/sidebar-nav";
import { systemPrisma } from "@/lib/db/system-client";
import { withTenantContext } from "@/lib/db/tenant-context";
import { hasCapability, type Capability, type Role } from "@/lib/permissions";
import { getActiveShopId } from "@/lib/tenant/active-shop";
import { getTenantContext } from "@/lib/tenant/context";
import { organizationHasModule } from "@/lib/tenant/modules";
import { parseOrgSettings } from "@/lib/tenant/settings";

import { ShopSwitcher } from "./shops/shop-switcher";

const TOP_LINKS: NavLink[] = [
  { href: "/dashboard", label: "Accueil", icon: "LayoutDashboard" },
];

// Même 17 liens que l'ancienne nav horizontale, simplement regroupés pour la
// lisibilité en sidebar verticale — aucune route ajoutée, retirée ou renommée.
// icon: clé (string), jamais la référence du composant — voir le commentaire
// dans components/ui/sidebar-nav.tsx (ce fichier est un Server Component,
// une icône lucide ne peut pas traverser la frontière vers le Client
// Component SidebarNav). Fonction plutôt que const : le badge de commandes
// en attente dépend d'une requête (voir AdminLayout), pas connu au chargement
// du module.
//
// Chaque lien porte `show`, calqué sur la garde de sa propre page (le
// redirect("/dashboard") en tête de page.tsx) : un lien affiché mais
// inaccessible renverrait l'utilisateur sur l'accueil au clic. La garde de la
// page reste la vraie barrière de sécurité, `show` ne fait que masquer.
type GatedLink = NavLink & { show: boolean };
type GatedGroup = { label: string; links: GatedLink[] };

function buildGroups({
  role,
  ecommerceEnabled,
  onlineOrders,
}: {
  role: Role;
  ecommerceEnabled: boolean;
  onlineOrders: number;
}): NavGroup[] {
  const can = (capability: Capability) => hasCapability(role, capability);

  const groups: GatedGroup[] = [
    {
      label: "Ventes",
      links: [
        { href: "/caisse", label: "Caisse", icon: "ShoppingCart", show: can("pos:sell") },
        {
          href: "/sales",
          label: "Ventes",
          icon: "ReceiptText",
          show: can("reports:read") || can("pos:cancel_ticket"),
        },
        {
          href: "/online-orders",
          label: "Commandes en ligne",
          icon: "ShoppingBag",
          badge: onlineOrders,
          // Deux axes distincts : la capacité du rôle ET le module payé.
          show: can("ecommerce:manage") && ecommerceEnabled,
        },
      ],
    },
    {
      label: "Catalogue",
      links: [
        { href: "/catalog/products", label: "Produits", icon: "Package", show: can("catalog:read") },
        { href: "/catalog/categories", label: "Catégories", icon: "Tags", show: can("catalog:read") },
        { href: "/catalog/import", label: "Import", icon: "FileUp", show: can("catalog:import") },
      ],
    },
    {
      label: "Stock",
      links: [
        { href: "/stock/movements", label: "Mouvements", icon: "Boxes", show: can("stock:read") },
        {
          href: "/transfers",
          label: "Transferts",
          icon: "ArrowLeftRight",
          show: can("transfers:manage"),
        },
        {
          href: "/inventory",
          label: "Inventaire",
          icon: "ClipboardList",
          show: can("inventory:manage"),
        },
      ],
    },
    {
      label: "Partenaires",
      links: [
        { href: "/customers", label: "Clients", icon: "Users", show: can("customers:manage") },
        { href: "/suppliers", label: "Fournisseurs", icon: "Truck", show: can("suppliers:manage") },
      ],
    },
    {
      label: "Pilotage",
      links: [
        { href: "/expenses", label: "Dépenses", icon: "Receipt", show: can("expenses:manage") },
        { href: "/reports", label: "Rapports", icon: "BarChart3", show: can("reports:read") },
        {
          href: "/mobile",
          label: "Vue propriétaire",
          icon: "Smartphone",
          show: can("reports:read"),
        },
      ],
    },
    {
      label: "Organisation",
      links: [
        { href: "/shops", label: "Boutiques", icon: "Store", show: can("shops:manage") },
        { href: "/users", label: "Utilisateurs", icon: "UserCog", show: can("users:manage") },
        // Pas de garde de capacité sur cette page : chacun gère son propre MFA.
        { href: "/security", label: "Sécurité", icon: "Shield", show: true },
        {
          href: "/settings",
          label: "Paramètres",
          icon: "Settings",
          show: can("shops:manage") || can("accounting:manage"),
        },
      ],
    },
  ];

  // Un groupe entier sans lien visible (ex. "Partenaires" pour un Vendeur)
  // disparaît, sinon son titre resterait affiché au-dessus de rien.
  return groups
    .map((group) => ({
      label: group.label,
      links: group.links
        .filter((link) => link.show)
        .map(({ href, label, icon, badge }) => ({ href, label, icon, badge })),
    }))
    .filter((group) => group.links.length > 0);
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const ctx = await getTenantContext();
  const canManageOnlineOrders = hasCapability(ctx.role, "ecommerce:manage");
  const [organization, activeShopId, userShops, user, pendingOnlineOrders] = await Promise.all([
    systemPrisma.organization.findUnique({ where: { id: ctx.organizationId } }),
    getActiveShopId(ctx.organizationId, ctx.userId),
    withTenantContext({ organizationId: ctx.organizationId }, (tx) =>
      tx.userShop.findMany({
        where: { userId: ctx.userId },
        include: { shop: true },
        orderBy: { shop: { nom: "asc" } },
      }),
    ),
    systemPrisma.user.findUnique({ where: { id: ctx.userId }, select: { nom: true, email: true } }),
    // Même définition de "à traiter" que app/(admin)/online-orders/page.tsx
    // (EN_ATTENTE + CONFIRMEE) — inutile pour un rôle sans ecommerce:manage,
    // qui serait de toute façon redirigé en cliquant le lien.
    canManageOnlineOrders
      ? withTenantContext({ organizationId: ctx.organizationId }, (tx) =>
          tx.onlineOrder.count({ where: { statut: { in: ["EN_ATTENTE", "CONFIRMEE"] } } }),
        )
      : Promise.resolve(0),
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

  const navGroups = buildGroups({
    role: ctx.role,
    ecommerceEnabled: organizationHasModule(organization?.enabledModules, "ecommerce"),
    onlineOrders: pendingOnlineOrders,
  });

  return (
    <div className="flex h-dvh min-h-0" style={brandingStyle}>
      <SidebarNav topLinks={TOP_LINKS} groups={navGroups} />
      {/* min-w-0 : sans lui, un flex-item row ne descend jamais sous la largeur
          min-content de son contenu, et un tableau large élargirait toute la
          page au lieu de défiler dans son propre conteneur. */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
        <header className="no-print flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3 lg:px-6 lg:py-4">
          <div className="flex min-w-0 items-center gap-2 lg:gap-4">
            <MobileNav topLinks={TOP_LINKS} groups={navGroups} />
            {branding?.hasLogo ? (
              // eslint-disable-next-line @next/next/no-img-element -- logo servi dynamiquement par organisation, pas un asset statique optimisable par next/image
              <img src="/api/branding/logo" alt={organization?.nom ?? ""} className="h-6 w-auto shrink-0" />
            ) : (
              <span className="truncate text-sm font-semibold text-foreground">{organization?.nom}</span>
            )}
            <ShopSwitcher
              shops={userShops.map((us: { shop: { id: string; nom: string; }; }) => ({ id: us.shop.id, nom: us.shop.nom }))}
              activeShopId={activeShopId}
              canSwitch={hasCapability(ctx.role, "shops:manage")}
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" className="shrink-0 gap-2 px-1.5" />}>
              <Avatar size="sm">
                <AvatarFallback>{(user?.nom ?? user?.email ?? "?").slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="hidden text-sm text-foreground sm:inline">{user?.nom ?? user?.email}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-auto min-w-48 max-w-[calc(100vw-2rem)]">
              <DropdownMenuGroup>
                <DropdownMenuLabel>
                  <span className="block text-foreground">{user?.nom ?? user?.email}</span>
                  <span className="block text-xs font-normal text-muted-foreground">{user?.email}</span>
                </DropdownMenuLabel>
              </DropdownMenuGroup>
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
          <div className="no-print shrink-0 border-b border-warning/30 bg-warning/10 px-4 py-2 lg:px-6 text-sm text-foreground">
            Abonnement en attente de paiement — période de grâce en cours. La caisse et
            l&apos;administration restent pleinement fonctionnelles.
          </div>
        )}
        {ctx.organizationStatus === "SUSPENDED" && (
          <div className="no-print shrink-0 border-b border-destructive/30 bg-destructive/10 px-4 py-2 lg:px-6 text-sm text-foreground">
            Abonnement suspendu (impayé) — les actions d&apos;administration sont bloquées. La
            caisse (vente, encaissement) reste utilisable.
          </div>
        )}
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-6 md:px-6 lg:py-10">
          <div className="w-full">{children}</div>
        </main>
      </div>
    </div>
  );
}
