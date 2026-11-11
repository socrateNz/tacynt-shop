import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

// Briques de mise en page communes à toutes les pages de l'administration :
// une page = PageHeader (titre + action principale à droite), puis une
// Toolbar (recherche/filtres) et un TablePanel, ou des Section. Même
// structure partout, pour qu'on trouve toujours les actions au même endroit.

/** Conteneur d'une page : espacement vertical régulier entre les blocs. */
export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex w-full flex-col gap-6", className)}>{children}</div>;
}

/**
 * Titre, description et actions de la page. L'action principale (créer,
 * enregistrer…) se place en dernier dans `actions` : elle se retrouve tout à
 * droite, à côté du titre. Sur mobile, les actions passent sous le titre.
 */
export function PageHeader({
  title,
  description,
  actions,
  back,
  meta,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** Lien de retour vers la liste parente (pages de détail). */
  back?: { href: string; label: string };
  /** Badges de statut affichés à côté du titre. */
  meta?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3">
      {back && (
        <Link
          href={back.href}
          className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{title}</h1>
            {meta}
          </div>
          {description ? <p className="max-w-2xl text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="no-print flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

/** Barre de recherche et de filtres d'une liste, au-dessus du tableau. */
export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "no-print flex flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-card sm:flex-row sm:flex-wrap sm:items-center",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Cadre d'un tableau (bordure, fond, défilement horizontal interne). */
export function TablePanel({ children, footer, className }: { children: ReactNode; footer?: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-xl border border-border bg-card shadow-card", className)}>
      {children}
      {footer ? (
        <div className="flex flex-col gap-3 border-t border-border px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

/** Bloc de contenu titré (fiche, formulaire, paramètres). */
export function Section({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("rounded-xl border border-border bg-card shadow-card", className)}>
      {(title || actions) && (
        <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="min-w-0 space-y-0.5">
            {title ? <h2 className="text-base font-semibold text-foreground">{title}</h2> : null}
            {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
          </div>
          {actions ? <div className="no-print flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      )}
      <div className={cn("p-4 sm:p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

/** Liste vide : explique la situation et propose l'action qui la débloque. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 px-6 py-12 text-center", className)}>
      {Icon ? (
        <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Icon className="size-5" aria-hidden />
        </span>
      ) : null}
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description ? <p className="max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

/** Indicateur chiffré (tableaux de bord, rapports). */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "default",
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  tone?: "default" | "success" | "warning" | "destructive";
  className?: string;
}) {
  const toneClass = {
    default: "text-foreground",
    success: "text-success",
    warning: "text-warning",
    destructive: "text-destructive",
  }[tone];
  return (
    <div className={cn("flex flex-col gap-1.5 rounded-xl border border-border bg-card p-4 shadow-card", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        {Icon ? <Icon className="size-4 text-subtle-foreground" aria-hidden /> : null}
      </div>
      <span className={cn("num text-2xl font-semibold tracking-tight", toneClass)}>{value}</span>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  );
}

/** Grille d'indicateurs. */
export function StatGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-2 gap-3 lg:grid-cols-4", className)}>{children}</div>;
}

/** Paire libellé / valeur d'une fiche de détail. */
export function DetailList({ items, className }: { items: { label: ReactNode; value: ReactNode }[]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2", className)}>
      {items.map((item, i) => (
        <div key={i} className="flex min-w-0 flex-col gap-0.5">
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
          <dd className="min-w-0 text-sm break-words text-foreground">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
