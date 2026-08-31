import type { ReactNode } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { systemPrisma } from "@/lib/db/system-client";
import { getTenantContext } from "@/lib/tenant/context";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const ctx = await getTenantContext();
  const organization = await systemPrisma.organization.findUnique({
    where: { id: ctx.organizationId },
  });

  return (
    <div className="flex flex-1 flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-6">
          <span className="text-sm font-semibold text-foreground">{organization?.nom}</span>
          <nav className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground">
              Accueil
            </Link>
            <Link href="/catalog/categories" className="hover:text-foreground">
              Catégories
            </Link>
            <Link href="/catalog/products" className="hover:text-foreground">
              Produits
            </Link>
            <Link href="/stock/movements" className="hover:text-foreground">
              Stock
            </Link>
            <Link href="/caisse" className="hover:text-foreground">
              Caisse
            </Link>
            <Link href="/sales" className="hover:text-foreground">
              Ventes
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
      <main className="flex flex-1 flex-col px-6 py-10">
        <div className="mx-auto w-full max-w-4xl">{children}</div>
      </main>
    </div>
  );
}
