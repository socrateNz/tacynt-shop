"use client";

import { Eye } from "lucide-react";

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

import { ModulesForm, PlanStatusForm, RecordPaymentForm } from "./organization-forms";

export type PlatformPaymentRow = {
  id: string;
  createdAtLabel: string;
  periodeLabel: string;
  montantLabel: string;
  recordedByEmail: string;
};

export function OrganizationDetailDialog({
  organizationId,
  nom,
  slug,
  createdAtLabel,
  plan,
  statut,
  enabledModules,
  devise,
  payments,
}: {
  organizationId: string;
  nom: string;
  slug: string;
  createdAtLabel: string;
  plan: string;
  statut: string;
  enabledModules: string[];
  devise: string;
  payments: PlatformPaymentRow[];
}) {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
        <Eye className="size-3.5" />
        <span className="sr-only">Voir</span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{nom}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {slug} — créée le {createdAtLabel}
        </p>

        <PlanStatusForm organizationId={organizationId} plan={plan} statut={statut} />
        <ModulesForm organizationId={organizationId} enabledModules={enabledModules} />
        <RecordPaymentForm organizationId={organizationId} devise={devise} />

        <section className="flex flex-col gap-4">
          <h3 className="text-sm font-medium text-foreground">Historique des paiements constatés</h3>
          <div className="rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Période couverte</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Constaté par</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-muted-foreground">{p.createdAtLabel}</TableCell>
                    <TableCell className="text-muted-foreground">{p.periodeLabel}</TableCell>
                    <TableCell className="num text-right">{p.montantLabel}</TableCell>
                    <TableCell className="text-muted-foreground">{p.recordedByEmail}</TableCell>
                  </TableRow>
                ))}
                {payments.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Aucun paiement constaté pour l&apos;instant.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      </DialogContent>
    </Dialog>
  );
}
