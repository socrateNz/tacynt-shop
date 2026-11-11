import { Plus } from "lucide-react";
import { redirect } from "next/navigation";

import { Page, PageHeader, TablePanel } from "@/components/admin/page";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { organizationHasModule } from "@/lib/tenant/modules";
import { systemPrisma } from "@/lib/db/system-client";

import { createRentalLocality } from "./actions";

// Mirroring quasi exact de app/(admin)/catalog/categories/page.tsx : même
// arbre auto-référencé, scope organisation. Limité ici à 2 niveaux (Ville →
// Quartier) : le select "parent" ne liste que les localités qui n'ont
// elles-mêmes pas de parent, jamais un quartier existant.
export default async function RentalLocalitiesPage() {
  const ctx = await getTenantContext();
  const organization = await systemPrisma.organization.findUniqueOrThrow({
    where: { id: ctx.organizationId },
  });

  if (
    !hasCapability(ctx.role, "location:manage") ||
    !organizationHasModule(organization.enabledModules, "location")
  ) {
    redirect("/dashboard");
  }

  const localities = await withTenantContext({ organizationId: ctx.organizationId }, (tx) =>
    tx.rentalLocality.findMany({ orderBy: { nom: "asc" }, include: { parent: true } }),
  );
  const villes = localities.filter((l) => !l.parentId);

  return (
    <Page>
      <PageHeader
        title={<>Villes &amp; quartiers</>}
        description={<>Créez vos villes puis leurs quartiers — ils seront ensuite simplement sélectionnés à la création d&apos;un logement.</>}
        actions={
          <>
            <Dialog>
              <DialogTrigger render={<Button />}>
                <Plus />
                Nouvelle ville / quartier
              </DialogTrigger>
              <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                  <DialogTitle>Nouvelle ville / quartier</DialogTitle>
                </DialogHeader>
                <form action={createRentalLocality} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="nom">Nom</Label>
                    <Input id="nom" name="nom" required placeholder="Cocody" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="parentId">Ville parente (optionnel)</Label>
                    <select
                      id="parentId"
                      name="parentId"
                      className="h-8 rounded-md border border-border bg-background px-2.5 text-sm"
                    >
                      <option value="">Aucune — c&apos;est une ville</option>
                      {villes.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.nom}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground">
                      Laissez vide pour créer une ville, ou choisissez une ville pour créer un
                      quartier qui lui est rattaché.
                    </p>
                  </div>
                  <Button type="submit" className="self-end">
                    Ajouter
                  </Button>
                </form>
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
              <TableHead>Ville parente</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {localities.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="text-foreground">{l.nom}</TableCell>
                <TableCell className="text-muted-foreground">{l.parent?.nom ?? "—"}</TableCell>
              </TableRow>
            ))}
            {localities.length === 0 && (
              <TableRow>
                <TableCell colSpan={2} className="text-center text-muted-foreground">
                  Aucune ville pour l&apos;instant.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TablePanel>
    </Page>
  );
}
