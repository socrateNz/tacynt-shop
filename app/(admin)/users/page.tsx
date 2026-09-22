import { Plus } from "lucide-react";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

import { UserForm } from "./user-form";

const ROLE_LABELS: Record<string, string> = {
  PROPRIETAIRE: "Propriétaire",
  GERANT: "Gérant",
  RESPONSABLE_STOCK: "Responsable stock",
  VENDEUR: "Vendeur",
  COMPTABLE: "Comptable",
};

export default async function UsersPage() {
  const ctx = await getTenantContext();
  if (!hasCapability(ctx.role, "users:manage")) {
    redirect("/dashboard");
  }

  const users = await withTenantContext({ organizationId: ctx.organizationId }, (tx) =>
    tx.user.findMany({ orderBy: { createdAt: "asc" } }),
  );

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Utilisateurs</h1>
          <p className="text-sm text-muted-foreground">
            Rôles et accès de l&apos;équipe pour cette organisation.
          </p>
        </div>
        <Dialog>
          <DialogTrigger render={<Button className="gap-1.5" />}>
            <Plus className="size-4" />
            Nouvel utilisateur
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Nouvel utilisateur</DialogTitle>
            </DialogHeader>
            <UserForm />
          </DialogContent>
        </Dialog>
      </header>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Rôle</TableHead>
              <TableHead>Statut</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="text-foreground">{u.nom}</TableCell>
                <TableCell className="text-muted-foreground">{u.email}</TableCell>
                <TableCell className="text-muted-foreground">
                  {ROLE_LABELS[u.role] ?? u.role}
                </TableCell>
                <TableCell>
                  <Badge variant={u.actif ? "success" : "secondary"}>
                    {u.actif ? "Actif" : "Inactif"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
