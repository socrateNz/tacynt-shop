"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import {
  ArrowLeftRight,
  BarChart3,
  Boxes,
  Building2,
  ClipboardList,
  FileUp,
  Home,
  LayoutDashboard,
  LogOut,
  Mail,
  MapPin,
  Menu,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  PlusCircle,
  Receipt,
  ReceiptText,
  Settings,
  Shield,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Store,
  Tags,
  Truck,
  UserCog,
  Users,
  WashingMachine,
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
  MapPin,
  Menu,
  Package,
  PlusCircle,
  Receipt,
  ReceiptText,
  Settings,
  Shield,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Store,
  Tags,
  Truck,
  UserCog,
  Users,
  WashingMachine,
} satisfies Record<string, LucideIcon>;

export type IconKey = keyof typeof ICONS;
export type NavLink = { href: string; label: string; icon: IconKey; badge?: number };
export type NavGroup = { label: string; links: NavLink[] };

function isActive(pathname: string, href: string): boolean {
  if (href === "/" || href === "/platform") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

// Sidebar réduite à ses icônes (≥ lg) : préférence mémorisée dans le
// navigateur. useSyncExternalStore plutôt qu'un useEffect : pas de rendu en
// cascade, et false côté serveur (rendu initial toujours déplié).
const COLLAPSED_KEY = "tacynt-sidebar-collapsed";
const COLLAPSED_EVENT = "tacynt-sidebar-toggle";

function subscribeCollapsed(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(COLLAPSED_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(COLLAPSED_EVENT, callback);
  };
}

function useCollapsed(): [boolean, () => void] {
  const collapsed = useSyncExternalStore(
    subscribeCollapsed,
    () => window.localStorage.getItem(COLLAPSED_KEY) === "1",
    () => false,
  );
  const toggle = () => {
    window.localStorage.setItem(COLLAPSED_KEY, collapsed ? "0" : "1");
    window.dispatchEvent(new Event(COLLAPSED_EVENT));
  };
  return [collapsed, toggle];
}

function NavItem({
  link,
  pathname,
  collapsed = false,
  onNavigate,
}: {
  link: NavLink;
  pathname: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const active = isActive(pathname, link.href);
  const Icon = ICONS[link.icon];
  return (
    <Link
      href={link.href}
      onClick={onNavigate}
      title={collapsed ? link.label : undefined}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex h-9 items-center gap-2.5 rounded-md text-sm transition-colors",
        collapsed ? "justify-center px-0" : "px-2.5",
        active
          ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
          : "font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
      )}
    >
      <Icon className={cn("size-4 shrink-0", active && "text-primary")} aria-hidden />
      {collapsed ? (
        <>
          <span className="sr-only">{link.label}</span>
          {!!link.badge && <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-primary" aria-hidden />}
        </>
      ) : (
        <>
          <span className="truncate">{link.label}</span>
          {!!link.badge && <Badge className="ml-auto tabular-nums">{link.badge}</Badge>}
        </>
      )}
    </Link>
  );
}

function Brand({ brand, logoSrc, collapsed = false }: { brand: string; logoSrc?: string; collapsed?: boolean }) {
  return (
    <div className={cn("flex h-14 shrink-0 items-center gap-2.5", collapsed ? "justify-center px-2" : "px-4")}>
      {logoSrc ? (
        // eslint-disable-next-line @next/next/no-img-element -- logo servi dynamiquement par organisation, pas un asset statique optimisable par next/image
        <img src={logoSrc} alt="" className="size-8 shrink-0 rounded-md object-contain" />
      ) : (
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Package className="size-4" aria-hidden />
        </span>
      )}
      {!collapsed && <span className="truncate text-sm font-semibold text-sidebar-foreground">{brand}</span>}
    </div>
  );
}

// Liste de liens commune à la sidebar fixe (≥ lg) et au tiroir mobile : une
// seule définition, pour qu'un lien ajouté/masqué le soit aux deux endroits.
function NavList({
  topLinks,
  groups,
  collapsed = false,
  onNavigate,
}: {
  topLinks: NavLink[];
  groups: NavGroup[];
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className={cn("flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pt-1 pb-4", collapsed ? "px-2" : "px-3")}>
      {topLinks.length > 0 && (
        <div className="flex flex-col gap-0.5">
          {topLinks.map((link) => (
            <NavItem key={link.href} link={link} pathname={pathname} collapsed={collapsed} onNavigate={onNavigate} />
          ))}
        </div>
      )}
      {groups.map((group) => (
        <div key={group.label} className="flex flex-col gap-0.5">
          {collapsed ? (
            <span className="mx-2 mb-1 border-t border-sidebar-border" aria-hidden />
          ) : (
            <span className="px-2.5 pb-1 text-[11px] font-medium tracking-wide text-subtle-foreground uppercase">
              {group.label}
            </span>
          )}
          {group.links.map((link) => (
            <NavItem key={link.href} link={link} pathname={pathname} collapsed={collapsed} onNavigate={onNavigate} />
          ))}
        </div>
      ))}
    </nav>
  );
}

type SidebarProps = {
  brand?: string;
  // Logo de l'organisation (white label) à la place de l'icône par défaut.
  logoSrc?: string;
  topLinks?: NavLink[];
  groups?: NavGroup[];
  // URL d'action du formulaire de déconnexion — distincte entre l'admin
  // tenant (/api/auth/logout) et l'admin plateforme (/api/platform/auth/logout),
  // jamais codée en dur ici.
  logoutAction?: string;
};

// Pied de sidebar : déconnexion toujours visible (signalé par un utilisateur
// réel qui ne la trouvait pas dans le menu de l'avatar) + repli de la sidebar.
function SidebarFooter({
  logoutAction,
  collapsed = false,
  onToggle,
}: {
  logoutAction?: string;
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  const itemClass = cn(
    "flex h-9 w-full items-center gap-2.5 rounded-md text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
    collapsed ? "justify-center px-0" : "px-2.5",
  );
  return (
    <div className={cn("flex shrink-0 flex-col gap-0.5 border-t border-sidebar-border py-3", collapsed ? "px-2" : "px-3")}>
      {logoutAction && (
        <form action={logoutAction} method="POST">
          <button type="submit" className={itemClass} title={collapsed ? "Se déconnecter" : undefined}>
            <LogOut className="size-4 shrink-0" aria-hidden />
            {collapsed ? <span className="sr-only">Se déconnecter</span> : "Se déconnecter"}
          </button>
        </form>
      )}
      {onToggle && (
        <button
          type="button"
          onClick={onToggle}
          className={itemClass}
          title={collapsed ? "Déplier le menu" : undefined}
          aria-label={collapsed ? "Déplier le menu" : "Réduire le menu"}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-4 shrink-0" aria-hidden />
          ) : (
            <>
              <PanelLeftClose className="size-4 shrink-0" aria-hidden />
              Réduire le menu
            </>
          )}
        </button>
      )}
    </div>
  );
}

// Coquille de sidebar partagée entre l'admin tenant (app/(admin)/layout.tsx)
// et l'admin plateforme (app/platform/(authenticated)/layout.tsx) ; seuls
// les liens diffèrent (passés par l'appelant).
//
// Fixe uniquement à partir de lg (1024px), réductible à ses icônes : en
// dessous, c'est MobileNav (dans l'en-tête) qui prend le relais.
export function SidebarNav({ brand = "Tacynt Shop", logoSrc, topLinks = [], groups = [], logoutAction }: SidebarProps) {
  const [collapsed, toggle] = useCollapsed();
  return (
    <aside
      className={cn(
        "no-print hidden min-h-0 shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 lg:flex",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <Brand brand={brand} logoSrc={logoSrc} collapsed={collapsed} />
      <NavList topLinks={topLinks} groups={groups} collapsed={collapsed} />
      <SidebarFooter logoutAction={logoutAction} collapsed={collapsed} onToggle={toggle} />
    </aside>
  );
}

// Bouton hamburger + tiroir, visibles sous lg uniquement. Le tiroir se ferme
// au clic sur un lien (onNavigate) plutôt qu'en réagissant à pathname : un
// clic sur le lien de la page courante ne change pas l'URL mais doit quand
// même refermer le menu.
export function MobileNav({ brand = "Tacynt Shop", logoSrc, topLinks = [], groups = [], logoutAction }: SidebarProps) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="ghost" size="icon" className="-ml-1.5 shrink-0 lg:hidden" />}>
        <Menu className="size-5" />
        <span className="sr-only">Ouvrir le menu</span>
      </SheetTrigger>
      <SheetContent>
        <Brand brand={brand} logoSrc={logoSrc} />
        <SheetTitle className="sr-only">Menu de navigation</SheetTitle>
        <NavList topLinks={topLinks} groups={groups} onNavigate={() => setOpen(false)} />
        <SidebarFooter logoutAction={logoutAction} />
      </SheetContent>
    </Sheet>
  );
}
