import { ChevronRight } from "lucide-react";
import Link from "next/link";

export type BreadcrumbItem = { label: string; href?: string };

// Partagé entre toutes les pages de détail/tunnel d'achat (produit,
// logement, panier, commande, merci) — jamais sur l'accueil elle-même
// (profondeur 1, un fil d'Ariane n'y apporte rien). "Accueil" est toujours
// le premier maillon, implicite, jamais répété par l'appelant.
export function StorefrontBreadcrumb({ items }: { items: BreadcrumbItem[] }) {
  const all: BreadcrumbItem[] = [{ label: "Accueil", href: "/" }, ...items];

  return (
    <nav aria-label="Fil d'Ariane" className="flex flex-wrap items-center gap-1 text-sm">
      {all.map((item, i) => {
        const isLast = i === all.length - 1;
        return (
          <span key={`${item.label}-${i}`} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />}
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? "font-medium text-foreground" : "text-muted-foreground"}>
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
