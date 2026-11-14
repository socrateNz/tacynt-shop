"use client";

import { useActionState, useMemo, useState } from "react";
import { Car, EyeOff, Pencil, Plus, Search, UserRound } from "lucide-react";

import { EmptyState, TablePanel, Toolbar } from "@/components/admin/page";
import { Pagination, usePagination } from "@/components/admin/pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { VEHICLE_DRIVER_MODE_LABELS, vehicleLabel } from "@/lib/vehicles/types";

import { updateDriverFee, type VehicleActionState } from "./actions";
import { VehicleFormDialog, type VehicleEditValues } from "./vehicle-form-dialog";

export type VehicleRow = VehicleEditValues & {
  prixJourLabel: string;
  cautionLabel: string | null;
  // Exemplaires libres aujourd'hui (réservations confirmées / en cours déduites).
  disponibles: number;
};

type Shared = { devise: string; tagSuggestions: string[] };

const initial: VehicleActionState = { error: null };

/** Actions de l'en-tête : réglage du supplément chauffeur + nouveau véhicule. */
export function VehiclesHeaderActions({
  supplementChauffeurJour,
  supplementLabel,
  ...shared
}: Shared & { supplementChauffeurJour: number; supplementLabel: string }) {
  const [creating, setCreating] = useState(false);
  const [feeOpen, setFeeOpen] = useState(false);

  return (
    <>
      <Button variant="outline" onClick={() => setFeeOpen(true)}>
        <UserRound />
        Supplément chauffeur : {supplementLabel}
      </Button>
      <Button onClick={() => setCreating(true)}>
        <Plus />
        Nouveau véhicule
      </Button>
      <VehicleFormDialog open={creating} onOpenChange={setCreating} {...shared} />
      <Dialog open={feeOpen} onOpenChange={setFeeOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Supplément chauffeur</DialogTitle>
          </DialogHeader>
          {/* key : état d'action neuf à chaque ouverture. */}
          <DriverFeeForm
            key={String(feeOpen)}
            devise={shared.devise}
            current={supplementChauffeurJour}
            onDone={() => setFeeOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function DriverFeeForm({ devise, current, onDone }: { devise: string; current: number; onDone: () => void }) {
  const [state, formAction, isPending] = useActionState(async (prev: VehicleActionState, formData: FormData) => {
    const next = await updateDriverFee(prev, formData);
    if (next.ok) onDone();
    return next;
  }, initial);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Montant ajouté par jour quand le client demande un chauffeur. Il est le même pour tous les véhicules et ne
        change pas les réservations déjà enregistrées.
      </p>
      {state.error && (
        <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="supplementChauffeurJour">Supplément par jour ({devise})</Label>
        <Input
          id="supplementChauffeurJour"
          name="supplementChauffeurJour"
          type="number"
          inputMode="decimal"
          min={0}
          step="1"
          defaultValue={current}
        />
        <p className="text-xs text-muted-foreground">0 = chauffeur sans supplément.</p>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone} disabled={isPending}>
          Annuler
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}

export function VehiclesTable({ vehicles, ...shared }: Shared & { vehicles: VehicleRow[] }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return vehicles.filter((v) => {
      if (status === "active" && !v.actif) return false;
      if (status === "inactive" && v.actif) return false;
      if (!term) return true;
      return (
        vehicleLabel(v).toLowerCase().includes(term) || v.tags.some((t) => t.toLowerCase().includes(term))
      );
    });
  }, [vehicles, search, status]);

  const pagination = usePagination(filtered, 20, [search, status]);

  return (
    <div className="flex flex-col gap-4">
      <Toolbar>
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-subtle-foreground" />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Marque, modèle ou étiquette…"
            aria-label="Rechercher un véhicule"
            className="pl-8"
          />
        </div>
        <Select value={status} onValueChange={(v) => setStatus(String(v))}>
          <SelectTrigger aria-label="Statut" className="sm:ml-auto">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les véhicules</SelectItem>
            <SelectItem value="active">Proposés à la location</SelectItem>
            <SelectItem value="inactive">Retirés</SelectItem>
          </SelectContent>
        </Select>
      </Toolbar>

      <TablePanel footer={<Pagination {...pagination} unit={["véhicule", "véhicules"]} />}>
        {pagination.rows.length === 0 ? (
          vehicles.length === 0 ? (
            <EmptyState
              icon={Car}
              title="Aucun véhicule"
              description="Ajoutez votre premier véhicule avec le bouton « Nouveau véhicule ». Une fiche par modèle suffit : vous indiquez le nombre d'exemplaires."
            />
          ) : (
            <EmptyState
              icon={Search}
              title="Aucun véhicule trouvé"
              description="Aucun véhicule ne correspond à ces critères."
            />
          )
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Véhicule</TableHead>
                <TableHead className="text-right">Prix / jour</TableHead>
                <TableHead className="hidden md:table-cell">Chauffeur</TableHead>
                <TableHead className="hidden lg:table-cell">Caution</TableHead>
                <TableHead>Disponibilité</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagination.rows.map((v) => (
                <VehicleTableRow key={v.id} vehicle={v} {...shared} />
              ))}
            </TableBody>
          </Table>
        )}
      </TablePanel>
    </div>
  );
}

function VehicleTableRow({ vehicle: v, ...shared }: Shared & { vehicle: VehicleRow }) {
  const [editing, setEditing] = useState(false);

  return (
    <TableRow>
      <TableCell>
        <div className="flex min-w-0 items-center gap-3">
          {v.imageIds[0] ? (
            // eslint-disable-next-line @next/next/no-img-element -- image binaire servie par la route, pas un asset statique optimisable
            <img
              src={`/api/vehicles/${v.id}/images/${v.imageIds[0]}`}
              alt=""
              className="h-10 w-14 shrink-0 rounded-md border border-border object-cover"
            />
          ) : (
            <span className="flex h-10 w-14 shrink-0 items-center justify-center rounded-md border border-dashed border-border text-subtle-foreground">
              <Car className="size-4" aria-hidden />
            </span>
          )}
          <div className="flex min-w-0 flex-col gap-0.5">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="truncate text-left font-medium text-foreground hover:text-primary hover:underline"
            >
              {vehicleLabel(v)}
            </button>
            {v.tags.length > 0 && (
              <span className="truncate text-xs text-muted-foreground">{v.tags.join(" · ")}</span>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex flex-col items-end gap-0.5">
          <span className="num">{v.prixJourLabel}</span>
          {!v.afficherPrix && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <EyeOff className="size-3" aria-hidden />
              Masqué sur le site
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className="hidden text-muted-foreground md:table-cell">
        {VEHICLE_DRIVER_MODE_LABELS[v.chauffeurMode] ?? v.chauffeurMode}
      </TableCell>
      <TableCell className="hidden lg:table-cell">
        {v.cautionLabel ? (
          <div className="flex flex-col gap-0.5">
            <span className="num">{v.cautionLabel}</span>
            {!v.afficherCaution && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <EyeOff className="size-3" aria-hidden />
                Masquée
              </span>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        {!v.actif ? (
          <Badge variant="secondary">Retiré</Badge>
        ) : (
          <Badge variant={v.disponibles > 0 ? "success" : "warning"}>
            {v.disponibles} / {v.quantite} libre{v.disponibles > 1 ? "s" : ""} aujourd&apos;hui
          </Badge>
        )}
      </TableCell>
      <TableCell className="text-right">
        <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
          <Pencil className="size-3.5" />
          Modifier
        </Button>
        <VehicleFormDialog open={editing} onOpenChange={setEditing} vehicle={v} {...shared} />
      </TableCell>
    </TableRow>
  );
}
