import type { ReactNode } from "react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { platformPrisma } from "@/lib/db/platform-client";
import { getPlatformAdminContext } from "@/lib/platform/context";

// Route group séparé de (admin) : aucun chrome tenant (pas de boutique
// active, pas de rôle organisation) — un admin plateforme n'est rattaché à
// aucune organisation.
export default async function PlatformLayout({ children }: { children: ReactNode }) {
  const ctx = await getPlatformAdminContext();
  const [admin, pendingRequests] = await Promise.all([
    platformPrisma.platformAdmin.findUnique({ where: { id: ctx.platformAdminId } }),
    platformPrisma.contactRequest.count({ where: { traite: false } }),
  ]);

  return (
    <div className="flex flex-1 flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-6">
          <span className="text-sm font-semibold text-foreground">Espace admin plateforme</span>
          <nav className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link href="/platform" className="hover:text-foreground">
              Organisations
            </Link>
            <Link href="/platform/requests" className="flex items-center gap-1.5 hover:text-foreground">
              Demandes
              {pendingRequests > 0 && <Badge variant="secondary">{pendingRequests}</Badge>}
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">{admin?.email}</span>
          <form action="/api/platform/auth/logout" method="POST">
            <Button type="submit" variant="outline" size="sm">
              Se déconnecter
            </Button>
          </form>
        </div>
      </header>
      <main className="flex flex-1 flex-col px-6 py-10">
        <div className="mx-auto w-full max-w-4xl">{children}</div>
      </main>
    </div>
  );
}
