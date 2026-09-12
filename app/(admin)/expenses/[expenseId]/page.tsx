import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { systemPrisma } from "@/lib/db/system-client";
import { withTenantContext } from "@/lib/db/tenant-context";
import { formatMoney } from "@/lib/money";
import { hasCapability } from "@/lib/permissions";
import { getTenantContext } from "@/lib/tenant/context";

import { approveExpense, rejectExpense } from "../actions";

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

export default async function ExpenseDetailPage({
  params,
}: {
  params: Promise<{ expenseId: string }>;
}) {
  const ctx = await getTenantContext();
  if (!hasCapability(ctx.role, "expenses:manage")) {
    redirect("/");
  }

  const canApprove = hasCapability(ctx.role, "expenses:approve");
  const { expenseId } = await params;
  const organization = await systemPrisma.organization.findUniqueOrThrow({
    where: { id: ctx.organizationId },
  });

  const expense = await withTenantContext({ organizationId: ctx.organizationId }, (tx) =>
    tx.expense.findUniqueOrThrow({ where: { id: expenseId }, include: { shop: true } }),
  );

  const [author, approver] = await Promise.all([
    systemPrisma.user.findUnique({ where: { id: expense.userId } }),
    expense.approvedByUserId
      ? systemPrisma.user.findUnique({ where: { id: expense.approvedByUserId } })
      : null,
  ]);

  const isImage = expense.justificatifMimeType?.startsWith("image/");

  return (
    <div className="flex flex-col gap-8">
      <header>
        <Link href="/expenses" className="text-sm text-primary underline-offset-4 hover:underline">
          ← Retour aux dépenses
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-xl font-semibold text-foreground">{expense.categorie}</h1>
          <Badge variant={STATUS_VARIANT[expense.statut] ?? "secondary"}>
            {STATUS_LABELS[expense.statut] ?? expense.statut}
          </Badge>
        </div>
      </header>

      <div className="max-w-lg rounded-xl border border-border bg-card p-6">
        <dl className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4 text-sm">
            <dt className="text-muted-foreground">Date</dt>
            <dd className="text-foreground">{expense.createdAt.toLocaleString("fr-FR")}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 text-sm">
            <dt className="text-muted-foreground">Boutique</dt>
            <dd className="text-foreground">{expense.shop.nom}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 text-sm">
            <dt className="text-muted-foreground">Montant</dt>
            <dd className="num text-foreground">{formatMoney(expense.montant, organization.devise)}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 text-sm">
            <dt className="text-muted-foreground">Mode de paiement</dt>
            <dd className="text-foreground">{expense.modePaiement}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 text-sm">
            <dt className="text-muted-foreground">Saisie par</dt>
            <dd className="text-foreground">{author?.email ?? "—"}</dd>
          </div>
          {approver && (
            <div className="flex items-center justify-between gap-4 text-sm">
              <dt className="text-muted-foreground">
                {expense.statut === "REJETEE" ? "Rejetée par" : "Validée par"}
              </dt>
              <dd className="text-foreground">{approver.email}</dd>
            </div>
          )}
        </dl>
      </div>

      {expense.justificatifMimeType && (
        <div className="flex flex-col gap-2">
          <h2 className="text-sm font-medium text-foreground">Justificatif</h2>
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element -- image binaire servie par la route, pas un asset statique optimisable
            <img
              src={`/api/expenses/${expense.id}/attachment`}
              alt="Justificatif de dépense"
              className="max-w-sm rounded-xl border border-border"
            />
          ) : (
            <a
              href={`/api/expenses/${expense.id}/attachment`}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-primary underline-offset-4 hover:underline"
            >
              Ouvrir le justificatif
            </a>
          )}
        </div>
      )}

      {canApprove && expense.statut === "EN_ATTENTE" && (
        <div className="flex gap-2">
          <form action={approveExpense}>
            <input type="hidden" name="expenseId" value={expense.id} />
            <Button type="submit" variant="outline">
              Valider
            </Button>
          </form>
          <form action={rejectExpense}>
            <input type="hidden" name="expenseId" value={expense.id} />
            <Button type="submit" variant="ghost">
              Rejeter
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
