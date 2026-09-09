import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { withTenantContext } from "@/lib/db/tenant-context";
import { hasCapability } from "@/lib/permissions";
import { getTenantContext } from "@/lib/tenant/context";

import { assignUserToShop, unassignUserFromShop } from "./actions";

export default async function ShopUsersPage({
  params,
}: {
  params: Promise<{ shopId: string }>;
}) {
  const ctx = await getTenantContext();
  if (!hasCapability(ctx.role, "shops:manage")) {
    redirect("/");
  }

  const { shopId } = await params;

  const { shop, users, assignedUserIds } = await withTenantContext(
    { organizationId: ctx.organizationId },
    async (tx) => {
      const shop = await tx.shop.findUniqueOrThrow({ where: { id: shopId } });
      const users = await tx.user.findMany({ orderBy: { email: "asc" } });
      const assignments = await tx.userShop.findMany({ where: { shopId } });
      return { shop, users, assignedUserIds: new Set(assignments.map((a) => a.userId)) };
    },
  );

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-xl font-semibold text-foreground">
          Utilisateurs — {shop.nom}
        </h1>
        <Link href="/shops" className="text-sm text-primary underline-offset-4 hover:underline">
          ← Retour aux boutiques
        </Link>
      </header>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Rôle</TableHead>
              <TableHead>Affecté</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => {
              const assigned = assignedUserIds.has(u.id);
              return (
                <TableRow key={u.id}>
                  <TableCell className="text-foreground">{u.email}</TableCell>
                  <TableCell className="text-muted-foreground">{u.role}</TableCell>
                  <TableCell>
                    <Badge variant={assigned ? "success" : "secondary"}>
                      {assigned ? "Oui" : "Non"}
                    </Badge>
                  </TableCell>
                  <TableCell className="flex justify-end">
                    <form action={assigned ? unassignUserFromShop : assignUserToShop}>
                      <input type="hidden" name="shopId" value={shopId} />
                      <input type="hidden" name="userId" value={u.id} />
                      <Button type="submit" variant="outline" size="sm">
                        {assigned ? "Retirer" : "Affecter"}
                      </Button>
                    </form>
                  </TableCell>
                </TableRow>
              );
            })}
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Aucun utilisateur dans cette organisation.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
