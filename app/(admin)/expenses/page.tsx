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
import { ViewDetailDialog } from "@/components/ui/view-detail-dialog";
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
    redirect("/dashboard");
  }

  const canApprove = hasCapability(ctx.role, "expenses:approve");
  const organization = await systemPrisma.organization.findUniqueOrThrow({
    where: { id: ctx.organizationId },
  });

  const expenses = await withTenantContext({ organizationId: ctx.organizationId }, (tx) =>
    tx.expense.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { shop: true } }),
  );

  const userIds = [
    ...new Set(
      expenses.flatMap((e) => [e.userId, e.approvedByUserId].filter((id): id is string => !!id)),
    ),
  ];
  const users = userIds.length
    ? await systemPrisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true } })
    : [];
  const emailByUserId = new Map(users.map((u) => [u.id, u.email]));

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Dépenses</h1>
          <p className="text-sm text-muted-foreground">
            Une dépense en espèces s&apos;impute automatiquement sur la session de caisse ouverte
            au moment de la saisie.
          </p>
        </div>
        <Dialog>
          <DialogTrigger render={<Button className="gap-1.5" />}>
            <Plus className="size-4" />
            Nouvelle dépense
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Nouvelle dépense</DialogTitle>
            </DialogHeader>
            <ExpenseForm />
          </DialogContent>
        </Dialog>
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
                  <ViewDetailDialog
                    title={e.categorie}
                    rows={[
                      { label: "Date", value: e.createdAt.toLocaleString("fr-FR") },
                      { label: "Boutique", value: e.shop.nom },
                      { label: "Montant", value: formatMoney(e.montant, organization.devise) },
                      { label: "Mode de paiement", value: e.modePaiement },
                      { label: "Statut", value: STATUS_LABELS[e.statut] ?? e.statut },
                      { label: "Saisie par", value: emailByUserId.get(e.userId) ?? "—" },
                      ...(e.approvedByUserId && emailByUserId.has(e.approvedByUserId)
                        ? [
                            {
                              label: e.statut === "REJETEE" ? "Rejetée par" : "Validée par",
                              value: emailByUserId.get(e.approvedByUserId)!,
                            },
                          ]
                        : []),
                    ]}
                  >
                    {e.justificatifMimeType && (
                      <div className="flex flex-col gap-2">
                        <h3 className="text-sm font-medium text-foreground">Justificatif</h3>
                        {e.justificatifMimeType.startsWith("image/") ? (
                          // eslint-disable-next-line @next/next/no-img-element -- image binaire servie par la route, pas un asset statique optimisable
                          <img
                            src={`/api/expenses/${e.id}/attachment`}
                            alt="Justificatif de dépense"
                            className="max-w-full rounded-xl border border-border"
                          />
                        ) : (
                          <a
                            href={`/api/expenses/${e.id}/attachment`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm text-primary underline-offset-4 hover:underline"
                          >
                            Ouvrir le justificatif
                          </a>
                        )}
                      </div>
                    )}
                  </ViewDetailDialog>
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
    </div>
  );
}
