import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * Onglets de filtre d'une liste (« À traiter », « Toutes »…), sous forme de
 * liens : le filtre vit dans l'URL, la page serveur relit les données.
 */
export function FilterTabs({
  items,
  className,
}: {
  items: { label: string; href: string; active: boolean; count?: number }[];
  className?: string;
}) {
  return (
    <nav
      aria-label="Filtrer la liste"
      className={cn("no-print flex w-fit max-w-full gap-1 overflow-x-auto rounded-lg bg-muted p-1", className)}
    >
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className={cn(
            "flex h-8 shrink-0 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors",
            item.active
              ? "bg-card text-foreground shadow-card"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {item.label}
          {item.count !== undefined && (
            <span
              className={cn(
                "num rounded-sm px-1.5 text-xs",
                item.active ? "bg-primary/10 text-primary" : "bg-background text-muted-foreground",
              )}
            >
              {item.count}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}
