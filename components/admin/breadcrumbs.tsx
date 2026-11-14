"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment } from "react";
import { ChevronRight } from "lucide-react";

// Fil d'Ariane déduit de l'URL. `link: false` pour les segments qui ne sont
// qu'un regroupement (pas de page /catalog, /stock…) : affichés sans lien.
const SEGMENTS: Record<string, { label: string; link?: false }> = {
  dashboard: { label: "Accueil" },
  sales: { label: "Ventes" },
  "online-orders": { label: "Commandes en ligne" },
  "delivery-zones": { label: "Zones de livraison" },
  rentals: { label: "Location", link: false },
  units: { label: "Logements" },
  contracts: { label: "Locations" },
  localities: { label: "Villes & quartiers" },
  laundry: { label: "Blanchisserie", link: false },
  vehicles: { label: "Véhicules" },
  bookings: { label: "Réservations" },
  orders: { label: "Commandes" },
  items: { label: "Catalogue" },
  catalog: { label: "Catalogue", link: false },
  products: { label: "Produits" },
  categories: { label: "Catégories" },
  import: { label: "Import" },
  "serial-numbers": { label: "Numéros de série" },
  stock: { label: "Stock", link: false },
  movements: { label: "Mouvements" },
  transfers: { label: "Transferts" },
  inventory: { label: "Inventaire" },
  customers: { label: "Clients" },
  suppliers: { label: "Fournisseurs" },
  expenses: { label: "Dépenses" },
  reports: { label: "Rapports" },
  ventes: { label: "Ventes" },
  marges: { label: "Marges" },
  rotation: { label: "Rotation" },
  tresorerie: { label: "Trésorerie" },
  creances: { label: "Créances" },
  comptabilite: { label: "Comptabilité" },
  personnel: { label: "Personnel" },
  mobile: { label: "Vue propriétaire" },
  shops: { label: "Boutiques" },
  users: { label: "Utilisateurs" },
  security: { label: "Sécurité" },
  settings: { label: "Paramètres" },
  "cash-movements": { label: "Mouvements de caisse" },
  platform: { label: "Organisations" },
  revenue: { label: "Chiffre d'affaires" },
  new: { label: "Nouvelle organisation" },
  requests: { label: "Demandes" },
  admins: { label: "Comptes admin" },
};

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);
  const crumbs = segments.map((segment, index) => {
    const known = SEGMENTS[segment];
    const isLast = index === segments.length - 1;
    const isGroup = known?.link === false;
    return {
      href: `/${segments.slice(0, index + 1).join("/")}`,
      label: known?.label ?? "Détail",
      link: !isLast && !isGroup && !!known,
      isLast,
    };
  });

  return (
    <nav aria-label="Fil d'Ariane" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1.5 text-sm">
        {crumbs.map((crumb, index) => (
          <Fragment key={crumb.href}>
            {index > 0 && (
              <li aria-hidden className="hidden text-subtle-foreground sm:block">
                <ChevronRight className="size-3.5" />
              </li>
            )}
            <li className={crumb.isLast ? "min-w-0" : "hidden sm:block"}>
              {crumb.isLast ? (
                <span aria-current="page" className="block truncate font-medium text-foreground">
                  {crumb.label}
                </span>
              ) : crumb.link ? (
                <Link href={crumb.href} className="text-muted-foreground transition-colors hover:text-foreground">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-muted-foreground">{crumb.label}</span>
              )}
            </li>
          </Fragment>
        ))}
      </ol>
    </nav>
  );
}
