import { Page, PageHeader, TablePanel } from "@/components/admin/page";
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
import { platformPrisma } from "@/lib/db/platform-client";

import { markContactRequestHandled } from "./actions";

export default async function ContactRequestsPage() {
  const requests = await platformPrisma.contactRequest.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <Page>
      <PageHeader
        title="Demandes de contact"
        description={<>{requests.length} demande{requests.length > 1 ? "s" : ""} reçue{requests.length > 1 ? "s" : ""} depuis la page d&apos;accueil publique.</>}
      />

      <TablePanel>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reçue le</TableHead>
              <TableHead>Nom</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Message</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="text-muted-foreground">
                  {r.createdAt.toLocaleString("fr-FR")}
                </TableCell>
                <TableCell className="text-foreground">{r.nom}</TableCell>
                <TableCell className="text-muted-foreground">
                  <a href={`mailto:${r.email}`} className="text-primary underline-offset-4 hover:underline">
                    {r.email}
                  </a>
                </TableCell>
                <TableCell className="max-w-sm text-muted-foreground">{r.message}</TableCell>
                <TableCell>
                  <Badge variant={r.traite ? "secondary" : "success"}>
                    {r.traite ? "Traitée" : "Nouvelle"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <form action={markContactRequestHandled}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="traite" value={(!r.traite).toString()} />
                    <Button type="submit" variant="ghost" size="sm">
                      {r.traite ? "Marquer nouvelle" : "Marquer traitée"}
                    </Button>
                  </form>
                </TableCell>
              </TableRow>
            ))}
            {requests.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Aucune demande pour l&apos;instant.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TablePanel>
    </Page>
  );
}
