import { Plus } from "lucide-react";
import { redirect } from "next/navigation";

import { Page, PageHeader, TablePanel } from "@/components/admin/page";
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
    <Page>
      <PageHeader
        title="Utilisateurs"
        description={<>Rôles et accès de l&apos;équipe pour cette organisation.</>}
        actions={
          <>
            <Dialog>
              <DialogTrigger render={<Button />}>
                <Plus />
                Nouvel utilisateur
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Nouvel utilisateur</DialogTitle>
                </DialogHeader>
                <UserForm />
              </DialogContent>
            </Dialog>
          </>
        }
      />

      <TablePanel>
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
      </TablePanel>
    </Page>
  );
}
