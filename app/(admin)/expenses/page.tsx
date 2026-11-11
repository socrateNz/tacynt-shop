import { Paperclip, Plus } from "lucide-react";
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
import { ViewDetailDialog } from "@/components/ui/view-detail-dialog";
import { systemPrisma } from "@/lib/db/system-client";
import { withTenantContext } from "@/lib/db/tenant-context";
import { formatMoney } from "@/lib/money";
import { hasCapability } from "@/lib/permissions";
import { getAssignedShopIds } from "@/lib/tenant/active-shop";
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

  // Jamais toutes les dépenses de l'organisation : seulement celles des
  // boutiques auxquelles cet utilisateur est affecté, même pour un rôle qui
  // peut approuver (un Gérant affecté à une seule boutique n'a pas à voir
  // les dépenses d'une autre).
  const myShopIds = await getAssignedShopIds(ctx.organizationId, ctx.userId);
  const expenses = await withTenantContext({ organizationId: ctx.organizationId }, (tx) =>
    tx.expense.findMany({
      where: { shopId: { in: myShopIds } },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { shop: true },
    }),
  );

  const userIds = [
    ...new Set(
      expenses.flatMap((e) => [e.userId, e.approvedByUserId].filter((id): id is string => !!id)),
    ),
  ];
  const users = userIds.length
    ? await systemPrisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, nom: true } })
    : [];
  const nomByUserId = new Map(users.map((u) => [u.id, u.nom]));

  return (
    <Page>
      <PageHeader
        title="Dépenses"
        description={<>Une dépense en espèces s&apos;impute automatiquement sur la session de caisse ouverte au moment de la saisie.</>}
        actions={
          <>
            <Dialog>
              <DialogTrigger render={<Button />}>
                <Plus />
                Nouvelle dépense
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Nouvelle dépense</DialogTitle>
                </DialogHeader>
                <ExpenseForm />
              </DialogContent>
            </Dialog>
          </>
        }
      />

      <TablePanel>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Dépense</TableHead>
              <TableHead className="text-right">Montant</TableHead>
              <TableHead className="hidden md:table-cell">Mode</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="w-12">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.map((e) => (
              <TableRow key={e.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="flex items-center gap-1.5 font-medium text-foreground">
                      {e.categorie}
                      {e.justificatifMimeType && (
                        <Paperclip className="size-3.5 text-muted-foreground" aria-label="Justificatif joint" />
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground">{e.createdAt.toLocaleString("fr-FR")}</span>
                  </div>
                </TableCell>
                <TableCell className="num text-right">
                  {formatMoney(e.montant, organization.devise)}
                </TableCell>
                <TableCell className="hidden text-muted-foreground md:table-cell">{e.modePaiement}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[e.statut] ?? "secondary"}>
                    {STATUS_LABELS[e.statut] ?? e.statut}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1.5">
                  {canApprove && e.statut === "EN_ATTENTE" && (
                    <>
                      <form action={rejectExpense}>
                        <input type="hidden" name="expenseId" value={e.id} />
                        <Button type="submit" size="sm" variant="ghost">
                          Rejeter
                        </Button>
                      </form>
                      <form action={approveExpense}>
                        <input type="hidden" name="expenseId" value={e.id} />
                        <Button type="submit" size="sm" variant="outline">
                          Valider
                        </Button>
                      </form>
                    </>
                  )}
                  <ViewDetailDialog
                    title={e.categorie}
                    rows={[
                      { label: "Date", value: e.createdAt.toLocaleString("fr-FR") },
                      { label: "Boutique", value: e.shop.nom },
                      { label: "Montant", value: formatMoney(e.montant, organization.devise) },
                      { label: "Mode de paiement", value: e.modePaiement },
                      { label: "Statut", value: STATUS_LABELS[e.statut] ?? e.statut },
                      { label: "Saisie par", value: nomByUserId.get(e.userId) ?? "—" },
                      ...(e.approvedByUserId && nomByUserId.has(e.approvedByUserId)
                        ? [
                            {
                              label: e.statut === "REJETEE" ? "Rejetée par" : "Validée par",
                              value: nomByUserId.get(e.approvedByUserId)!,
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
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {expenses.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  Aucune dépense pour l&apos;instant. Saisissez-en une avec « Nouvelle dépense ».
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TablePanel>
    </Page>
  );
}
