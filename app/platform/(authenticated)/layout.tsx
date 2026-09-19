import type { ReactNode } from "react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MobileNav, SidebarNav, type NavLink } from "@/components/ui/sidebar-nav";
import { platformPrisma } from "@/lib/db/platform-client";
import { getPlatformAdminContext } from "@/lib/platform/context";

// Route group séparé de (admin) : aucun chrome tenant (pas de boutique
// active, pas de rôle organisation) — un admin plateforme n'est rattaché à
// aucune organisation. Même coquille de sidebar que app/(admin)/layout.tsx
// (components/ui/sidebar-nav.tsx) pour rester un espace visuellement
// cohérent, juste avec ses propres liens.
export default async function PlatformLayout({ children }: { children: ReactNode }) {
  const ctx = await getPlatformAdminContext();
  const [admin, pendingRequests] = await Promise.all([
    platformPrisma.platformAdmin.findUnique({ where: { id: ctx.platformAdminId } }),
    platformPrisma.contactRequest.count({ where: { traite: false } }),
  ]);

  const topLinks: NavLink[] = [
    { href: "/platform", label: "Organisations", icon: "Building2" },
    { href: "/platform/new", label: "Nouvelle organisation", icon: "PlusCircle" },
    { href: "/platform/requests", label: "Demandes", icon: "Mail", badge: pendingRequests },
    { href: "/platform/admins", label: "Comptes admin", icon: "UserCog" },
  ];

  return (
    <div className="flex h-dvh min-h-0">
      <SidebarNav brand="Tacynt Shop" topLinks={topLinks} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
        <header className="no-print flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3 lg:px-6 lg:py-4">
          <div className="flex min-w-0 items-center gap-2">
            <MobileNav brand="Tacynt Shop" topLinks={topLinks} />
            <span className="truncate text-sm font-semibold text-foreground">Espace admin plateforme</span>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" className="shrink-0 gap-2 px-1.5" />}>
              <Avatar size="sm">
                <AvatarFallback>{(admin?.email ?? "?").slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="hidden text-sm text-foreground sm:inline">{admin?.email}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-auto min-w-48 max-w-[calc(100vw-2rem)]">
              <DropdownMenuGroup>
                <DropdownMenuLabel>{admin?.email}</DropdownMenuLabel>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <form action="/api/platform/auth/logout" method="POST">
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
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-6 md:px-6 lg:py-10">
          <div className="w-full">{children}</div>
        </main>
      </div>
    </div>
  );
}
