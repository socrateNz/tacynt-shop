"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  BarChart3,
  Boxes,
  ClipboardList,
  FileUp,
  Home,
  Package,
  Receipt,
  ReceiptText,
  Settings,
  Shield,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Store,
  Tags,
  Truck,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

type NavLink = { href: string; label: string; icon: LucideIcon };
type NavGroup = { label: string; links: NavLink[] };

const TOP_LINK: NavLink = { href: "/", label: "Accueil", icon: Home };

// Même 17 liens que l'ancienne nav horizontale (app/(admin)/layout.tsx),
// simplement regroupés pour la lisibilité en sidebar verticale — aucune
// route ajoutée, retirée ou renommée.
const GROUPS: NavGroup[] = [
  {
    label: "Ventes",
    links: [
      { href: "/caisse", label: "Caisse", icon: ShoppingCart },
      { href: "/sales", label: "Ventes", icon: ReceiptText },
      { href: "/online-orders", label: "Commandes en ligne", icon: ShoppingBag },
    ],
  },
  {
    label: "Catalogue",
    links: [
      { href: "/catalog/products", label: "Produits", icon: Package },
      { href: "/catalog/categories", label: "Catégories", icon: Tags },
      { href: "/catalog/import", label: "Import", icon: FileUp },
    ],
  },
  {
    label: "Stock",
    links: [
      { href: "/stock/movements", label: "Mouvements", icon: Boxes },
      { href: "/transfers", label: "Transferts", icon: ArrowLeftRight },
      { href: "/inventory", label: "Inventaire", icon: ClipboardList },
    ],
  },
  {
    label: "Partenaires",
    links: [
      { href: "/customers", label: "Clients", icon: Users },
      { href: "/suppliers", label: "Fournisseurs", icon: Truck },
    ],
  },
  {
    label: "Pilotage",
    links: [
      { href: "/expenses", label: "Dépenses", icon: Receipt },
      { href: "/reports", label: "Rapports", icon: BarChart3 },
      { href: "/mobile", label: "Vue propriétaire", icon: Smartphone },
    ],
  },
  {
    label: "Organisation",
    links: [
      { href: "/shops", label: "Boutiques", icon: Store },
      { href: "/users", label: "Utilisateurs", icon: UserCog },
      { href: "/security", label: "Sécurité", icon: Shield },
      { href: "/settings", label: "Paramètres", icon: Settings },
    ],
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavItem({ link, pathname }: { link: NavLink; pathname: string }) {
  const active = isActive(pathname, link.href);
  const Icon = link.icon;
  return (
    <Link
      href={link.href}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-sidebar-primary text-sidebar-primary-foreground"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" />
      {link.label}
    </Link>
  );
}

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <aside className="no-print flex min-h-0 w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex shrink-0 items-center gap-2 px-5 py-4">
        <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Package className="size-3.5" />
        </span>
        <span className="text-sm font-semibold text-sidebar-foreground">Tacynt Shop</span>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-3 pb-4">
        <NavItem link={TOP_LINK} pathname={pathname} />
        {GROUPS.map((group) => (
          <div key={group.label} className="flex flex-col gap-1">
            <span className="px-3 text-xs font-medium tracking-wide text-subtle-foreground uppercase">
              {group.label}
            </span>
            {group.links.map((link) => (
              <NavItem key={link.href} link={link} pathname={pathname} />
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}
