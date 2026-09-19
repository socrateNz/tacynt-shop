"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeftRight,
  BarChart3,
  Boxes,
  Building2,
  ClipboardList,
  FileUp,
  Home,
  LayoutDashboard,
  Mail,
  Menu,
  Package,
  PlusCircle,
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

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

// Un composant Server (les deux layouts qui utilisent cette sidebar en sont)
// ne peut pas passer une référence de composant React à un Client Component
// — seulement des données sérialisables. D'où cette table : les appelants
// passent une CLÉ (string), jamais l'icône elle-même.
const ICONS = {
  ArrowLeftRight,
  BarChart3,
  Boxes,
  Building2,
  ClipboardList,
  FileUp,
  Home,
  LayoutDashboard,
  Mail,
  Menu,
  Package,
  PlusCircle,
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
} satisfies Record<string, LucideIcon>;

export type IconKey = keyof typeof ICONS;
export type NavLink = { href: string; label: string; icon: IconKey; badge?: number };
export type NavGroup = { label: string; links: NavLink[] };

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavItem({
  link,
  pathname,
  onNavigate,
}: {
  link: NavLink;
  pathname: string;
  onNavigate?: () => void;
}) {
  const active = isActive(pathname, link.href);
  const Icon = ICONS[link.icon];
  return (
    <Link
      href={link.href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-sidebar-primary text-sidebar-primary-foreground"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
      )}
    >
      <Icon className="size-4 shrink-0" />
      {link.label}
      {!!link.badge && (
        <Badge variant={active ? "secondary" : "default"} className="ml-auto">
          {link.badge}
        </Badge>
      )}
    </Link>
  );
}

function Brand({ brand }: { brand: string }) {
  return (
    <>
      <span className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <Package className="size-3.5" />
      </span>
      <span className="text-sm font-semibold text-sidebar-foreground">{brand}</span>
    </>
  );
}

// Liste de liens commune à la sidebar fixe (≥ lg) et au tiroir mobile : une
// seule définition, pour qu'un lien ajouté/masqué le soit aux deux endroits.
function NavList({
  topLinks,
  groups,
  onNavigate,
}: {
  topLinks: NavLink[];
  groups: NavGroup[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-3 pb-4">
      {topLinks.length > 0 && (
        <div className="flex flex-col gap-1">
          {topLinks.map((link) => (
            <NavItem key={link.href} link={link} pathname={pathname} onNavigate={onNavigate} />
          ))}
        </div>
      )}
      {groups.map((group) => (
        <div key={group.label} className="flex flex-col gap-1">
          <span className="px-3 text-xs font-medium tracking-wide text-subtle-foreground uppercase">
            {group.label}
          </span>
          {group.links.map((link) => (
            <NavItem key={link.href} link={link} pathname={pathname} onNavigate={onNavigate} />
          ))}
        </div>
      ))}
    </nav>
  );
}

type SidebarProps = {
  brand?: string;
  topLinks?: NavLink[];
  groups?: NavGroup[];
};

// Coquille de sidebar partagée entre l'admin tenant (app/(admin)/layout.tsx)
// et l'admin plateforme (app/platform/(authenticated)/layout.tsx) — même
// largeur, même confinement de scroll, mêmes règles d'état actif ; seuls les
// liens diffèrent (passés par l'appelant), pour rester deux espaces
// visuellement cohérents sans dupliquer la mécanique de la sidebar.
//
// Fixe uniquement à partir de lg (1024px) : en dessous, 240px de sidebar
// permanente ne laisseraient presque rien au contenu — c'est MobileNav (dans
// l'en-tête) qui prend le relais.
export function SidebarNav({ brand = "Tacynt Shop", topLinks = [], groups = [] }: SidebarProps) {
  return (
    <aside className="no-print hidden min-h-0 w-60 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      <div className="flex shrink-0 items-center gap-2 px-5 py-4">
        <Brand brand={brand} />
      </div>
      <NavList topLinks={topLinks} groups={groups} />
    </aside>
  );
}

// Bouton hamburger + tiroir, visibles sous lg uniquement. Le tiroir se ferme
// au clic sur un lien (onNavigate) plutôt qu'en réagissant à pathname : un
// clic sur le lien de la page courante ne change pas l'URL mais doit quand
// même refermer le menu.
export function MobileNav({ brand = "Tacynt Shop", topLinks = [], groups = [] }: SidebarProps) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="ghost" size="icon" className="shrink-0 lg:hidden" />}>
        <Menu className="size-5" />
        <span className="sr-only">Ouvrir le menu</span>
      </SheetTrigger>
      <SheetContent>
        <div className="flex shrink-0 items-center gap-2 px-5 py-4">
          <Brand brand={brand} />
          <SheetTitle className="sr-only">Menu de navigation</SheetTitle>
        </div>
        <NavList topLinks={topLinks} groups={groups} onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
