import { Plus } from "lucide-react";

import { Page, PageHeader, TablePanel } from "@/components/admin/page";
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
import { platformPrisma } from "@/lib/db/platform-client";
import { getPlatformAdminContext } from "@/lib/platform/context";

import { NewAdminForm } from "./admin-forms";
import { togglePlatformAdminActive } from "./actions";

export default async function PlatformAdminsPage() {
  const ctx = await getPlatformAdminContext();
  const admins = await platformPrisma.platformAdmin.findMany({
    orderBy: { createdAt: "asc" },
  });

  return (
    <Page>
      <PageHeader
        title="Comptes admin plateforme"
        description={<>{admins.length} compte{admins.length > 1 ? "s" : ""} — chacun a un accès complet à l&apos;espace plateforme (toutes les organisations), pas de rôle restreint.</>}
        actions={
          <>
            <Dialog>
              <DialogTrigger render={<Button />}>
                <Plus />
                Nouveau compte admin
              </DialogTrigger>
              <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                  <DialogTitle>Nouveau compte admin</DialogTitle>
                </DialogHeader>
                <NewAdminForm />
              </DialogContent>
            </Dialog>
          </>
        }
      />

      <TablePanel>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Créé le</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {admins.map((admin) => (
              <TableRow key={admin.id}>
                <TableCell className="text-foreground">{admin.email}</TableCell>
                <TableCell className="text-muted-foreground">
                  {admin.createdAt.toLocaleDateString("fr-FR")}
                </TableCell>
                <TableCell
                  className={admin.actif ? "text-success" : "text-muted-foreground"}
                >
                  {admin.actif ? "Actif" : "Désactivé"}
                </TableCell>
                <TableCell className="text-right">
                  {admin.id === ctx.platformAdminId ? (
                    <span className="text-xs text-muted-foreground">Vous</span>
                  ) : (
                    <form action={togglePlatformAdminActive}>
                      <input type="hidden" name="id" value={admin.id} />
                      <input type="hidden" name="actif" value={String(!admin.actif)} />
                      <Button type="submit" variant="ghost" size="sm">
                        {admin.actif ? "Désactiver" : "Réactiver"}
                      </Button>
                    </form>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {admins.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Aucun compte admin pour l&apos;instant.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TablePanel>
    </Page>
  );
}
