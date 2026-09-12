import { Eye } from "lucide-react";
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
import { systemPrisma } from "@/lib/db/system-client";
import { withTenantContext } from "@/lib/db/tenant-context";
import { formatMoney } from "@/lib/money";
import { hasCapability } from "@/lib/permissions";
import { getTenantContext } from "@/lib/tenant/context";

import { approveExpense, rejectExpense } from "./actions";
import { ExpenseForm } from "./expense-form";

const STATUS_VARIANT: Record<string, "success" | "warning" | "destructive"> = {
  VALIDEE: "success",
  EN_ATTENTE: "warning",
  REJETEE: "destructive",
};

const STATUS_LABELS: Record<string, string> = {
  VALIDEE: "Validée",
  EN_ATTENTE: "En attente",
  REJETEE: "Rejetée",
};

export default async function ExpensesPage() {
  const ctx = await getTenantContext();
  if (!hasCapability(ctx.role, "expenses:manage")) {
    redirect("/");
  }

  const canApprove = hasCapability(ctx.role, "expenses:approve");
  const organization = await systemPrisma.organization.findUniqueOrThrow({
    where: { id: ctx.organizationId },
  });

  const expenses = await withTenantContext({ organizationId: ctx.organizationId }, (tx) =>
    tx.expense.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
  );

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-xl font-semibold text-foreground">Dépenses</h1>
        <p className="text-sm text-muted-foreground">
          Une dépense en espèces s&apos;impute automatiquement sur la session de caisse ouverte au
          moment de la saisie.
        </p>
      </header>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Catégorie</TableHead>
              <TableHead className="text-right">Montant</TableHead>
              <TableHead>Mode</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead>Justificatif</TableHead>
              {canApprove && <TableHead />}
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="text-muted-foreground">
                  {e.createdAt.toLocaleString("fr-FR")}
                </TableCell>
                <TableCell className="text-foreground">{e.categorie}</TableCell>
                <TableCell className="num text-right">
                  {formatMoney(e.montant, organization.devise)}
                </TableCell>
                <TableCell className="text-muted-foreground">{e.modePaiement}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[e.statut] ?? "secondary"}>
                    {STATUS_LABELS[e.statut] ?? e.statut}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {e.justificatifMimeType ? "Oui" : "—"}
                </TableCell>
                {canApprove && (
                  <TableCell className="flex justify-end gap-2">
                    {e.statut === "EN_ATTENTE" && (
                      <>
                        <form action={approveExpense}>
                          <input type="hidden" name="expenseId" value={e.id} />
                          <Button type="submit" size="sm" variant="outline">
                            Valider
                          </Button>
                        </form>
                        <form action={rejectExpense}>
                          <input type="hidden" name="expenseId" value={e.id} />
                          <Button type="submit" size="sm" variant="ghost">
                            Rejeter
                          </Button>
                        </form>
                      </>
                    )}
                  </TableCell>
                )}
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    nativeButton={false}
                    render={<Link href={`/expenses/${e.id}`} />}
                  >
                    <Eye className="size-3.5" />
                    <span className="sr-only">Voir</span>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {expenses.length === 0 && (
              <TableRow>
                <TableCell colSpan={canApprove ? 8 : 7} className="text-center text-muted-foreground">
                  Aucune dépense pour l&apos;instant.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <ExpenseForm />
    </div>
  );
}
