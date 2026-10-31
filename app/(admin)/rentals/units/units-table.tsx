"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { UnitEditDialog, type UnitEditValues } from "./unit-edit-dialog";
import { UnitForm } from "./unit-form";

export type UnitRow = {
  id: string;
  typeLabel: string;
  designation: string;
  description: string | null;
  montantMensuelLabel: string;
  dureeMinMois: number;
  commissionLabel: string;
  actif: boolean;
  occupe: boolean;
  coverImageId: string | null;
  edit: UnitEditValues;
};

export function UnitsTable({ units }: { units: UnitRow[] }) {
  const [formOpen, setFormOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end">
        <Dialog open={formOpen} onOpenChange={setFormOpen}>
          <Button className="gap-1.5" onClick={() => setFormOpen(true)}>
            <Plus className="size-4" />
            Nouveau logement
          </Button>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Nouveau logement</DialogTitle>
            </DialogHeader>
            <UnitForm onSuccess={() => setFormOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14" />
              <TableHead>Logement</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Loyer / mois</TableHead>
              <TableHead>Durée min.</TableHead>
              <TableHead className="text-right">Commission</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {units.map((u) => (
              <TableRow key={u.id}>
                <TableCell>
                  {u.coverImageId ? (
                    // eslint-disable-next-line @next/next/no-img-element -- image binaire servie par la route, pas un asset statique optimisable
                    <img
                      src={`/api/rentals/units/${u.id}/images/${u.coverImageId}`}
                      alt=""
                      className="size-10 rounded-md border border-border object-cover"
                    />
                  ) : (
                    <div className="size-10 rounded-md border border-dashed border-border" />
                  )}
                </TableCell>
                <TableCell className="text-foreground">{u.designation}</TableCell>
                <TableCell className="text-muted-foreground">{u.typeLabel}</TableCell>
                <TableCell className="num text-right">{u.montantMensuelLabel}</TableCell>
                <TableCell className="text-muted-foreground">{u.dureeMinMois} mois</TableCell>
                <TableCell className="num text-right">{u.commissionLabel}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {!u.actif && <Badge variant="secondary">Inactif</Badge>}
                    {u.actif && u.occupe && <Badge variant="secondary">Occupé</Badge>}
                    {u.actif && !u.occupe && <Badge variant="success">Disponible</Badge>}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <UnitEditDialog unit={u.edit} />
                </TableCell>
              </TableRow>
            ))}
            {units.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  Aucun logement pour l&apos;instant.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
