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

// Dialogue de détail générique (liste champ/valeur) — pour les entités dont
// la vue détaillée n'est qu'une lecture de champs, sans formulaire propre
// (voir components/ui/sidebar-nav.tsx pour le même principe de coquille
// partagée, ici appliqué au "Voir" plutôt qu'à la navigation).
export function ViewDetailDialog({
  title,
  rows,
  children,
}: {
  title: string;
  rows: { label: string; value: string }[];
  children?: React.ReactNode;
}) {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
        <Eye className="size-3.5" />
        <span className="sr-only">Voir</span>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <dl className="flex flex-col gap-3">
          {rows.map((r) => (
            <div key={r.label} className="flex items-center justify-between gap-4 text-sm">
              <dt className="text-muted-foreground">{r.label}</dt>
              <dd className="text-right text-foreground">{r.value}</dd>
            </div>
          ))}
        </dl>
        {children}
      </DialogContent>
    </Dialog>
  );
}
