"use client";

import { Car, Search, UserRound } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { formatMoney } from "@/lib/money";
import type { PublicVehicle } from "@/lib/storefront/vehicles";
import { cn } from "@/lib/utils";
import { VEHICLE_DRIVER_MODE_LABELS, vehicleLabel } from "@/lib/vehicles/types";

const TAG_PREVIEW_COUNT = 4;

// Catalogue des véhicules à louer (onglet "Véhicules" de la racine, ou
// racine seule si c'est l'unique module vitrine). Recherche texte +
// filtre par étiquette, côté client : le catalogue d'un loueur tient en une
// page.
export function VehicleCatalogueClient({
  vehicles,
  shopId,
  devise,
}: {
  vehicles: PublicVehicle[];
  shopId: string;
  devise: string;
}) {
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState<string | null>(null);

  // Étiquettes les plus fréquentes d'abord.
  const allTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const v of vehicles) for (const t of v.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  }, [vehicles]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return vehicles.filter((v) => {
      if (tag && !v.tags.includes(tag)) return false;
      if (!term) return true;
      return vehicleLabel(v).toLowerCase().includes(term) || v.tags.some((t) => t.toLowerCase().includes(term));
    });
  }, [vehicles, search, tag]);

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="relative min-w-0 sm:max-w-md">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un véhicule…"
          aria-label="Rechercher un véhicule"
          className="pl-8"
        />
      </div>

      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrer par caractéristique">
          <TagChip label="Tous" active={tag === null} onClick={() => setTag(null)} />
          {allTags.map((t) => (
            <TagChip key={t} label={t} active={tag === t} onClick={() => setTag(tag === t ? null : t)} />
          ))}
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        {filtered.length} véhicule{filtered.length > 1 ? "s" : ""}
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        {filtered.map((v) => (
          <VehicleCard key={v.id} vehicle={v} devise={devise} shopId={shopId} />
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground sm:col-span-2 xl:col-span-4">
            Aucun véhicule ne correspond à ces critères.
          </p>
        )}
      </div>
    </div>
  );
}

function TagChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3 py-1 text-sm transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

function VehicleCard({ vehicle, devise, shopId }: { vehicle: PublicVehicle; devise: string; shopId: string }) {
  const href = `/vehicules/${vehicle.id}?shop=${shopId}`;
  const label = vehicleLabel(vehicle);
  const visibleTags = vehicle.tags.slice(0, TAG_PREVIEW_COUNT);
  const extraTags = vehicle.tags.length - visibleTags.length;
  const libre = vehicle.disponibles > 0;

  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-card p-3 transition-colors hover:border-primary/40 sm:p-4">
      <Link href={href} className="relative block">
        {vehicle.imageIds[0] ? (
          // eslint-disable-next-line @next/next/no-img-element -- image binaire servie par la route, pas un asset statique optimisable
          <img
            src={`/api/vehicles/${vehicle.id}/images/${vehicle.imageIds[0]}`}
            alt={label}
            className="aspect-4/3 w-full rounded-lg border border-border object-cover"
          />
        ) : (
          <div className="flex aspect-4/3 w-full items-center justify-center rounded-lg border border-dashed border-border text-muted-foreground">
            <Car className="size-8" aria-hidden />
          </div>
        )}
        <span
          className={cn(
            "absolute top-2 right-2 rounded-full px-2 py-0.5 text-xs font-semibold text-white shadow-sm",
            libre ? "bg-success" : "bg-warning",
          )}
        >
          {libre ? "Disponible" : "Loué aujourd'hui"}
        </span>
      </Link>

      <div className="flex items-start justify-between gap-2">
        <Link href={href} className="min-w-0 text-sm font-medium break-words text-foreground hover:underline">
          {label}
        </Link>
        <div className="shrink-0 text-right">
          {vehicle.prixJour !== null ? (
            <>
              <p className="num text-sm font-bold text-primary">{formatMoney(vehicle.prixJour, devise)}</p>
              <p className="text-xs text-muted-foreground">/ jour</p>
            </>
          ) : (
            <p className="text-sm font-semibold text-primary">Prix sur demande</p>
          )}
        </div>
      </div>

      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <UserRound className="size-3 shrink-0 text-primary" aria-hidden />
        {VEHICLE_DRIVER_MODE_LABELS[vehicle.chauffeurMode] ?? vehicle.chauffeurMode}
      </p>

      {vehicle.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {visibleTags.map((t) => (
            <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {t}
            </span>
          ))}
          {extraTags > 0 && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">+{extraTags}</span>
          )}
        </div>
      )}

      <Link href={href} className="mt-auto pt-1 text-sm font-medium text-primary underline-offset-4 hover:underline">
        Voir et réserver
      </Link>
    </div>
  );
}
