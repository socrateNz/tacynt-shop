"use client";

import Link from "next/link";
import { MoreHorizontal, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type RowAction = {
  label: string;
  icon?: LucideIcon;
  /** Lien de navigation, ou… */
  href?: string;
  /** …action locale (ouvrir une fenêtre contrôlée par la ligne, etc.). */
  onSelect?: () => void;
  destructive?: boolean;
  disabled?: boolean;
  hidden?: boolean;
};

/**
 * Menu « ⋯ » des actions secondaires d'une ligne de tableau : toujours dans
 * la dernière colonne, toujours le même bouton. Les actions destructives
 * sont regroupées en bas, après un séparateur.
 */
export function RowActions({ actions, label = "Actions" }: { actions: RowAction[]; label?: string }) {
  const visible = actions.filter((a) => !a.hidden);
  if (visible.length === 0) return null;
  const normal = visible.filter((a) => !a.destructive);
  const destructive = visible.filter((a) => a.destructive);

  const renderItem = (action: RowAction) => {
    const Icon = action.icon;
    const content = (
      <>
        {Icon ? <Icon aria-hidden /> : null}
        {action.label}
      </>
    );
    return (
      <DropdownMenuItem
        key={action.label}
        variant={action.destructive ? "destructive" : "default"}
        disabled={action.disabled}
        onClick={action.onSelect}
        render={action.href ? <Link href={action.href} /> : undefined}
      >
        {content}
      </DropdownMenuItem>
    );
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label={label} onClick={(e) => e.stopPropagation()} />}
      >
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        {normal.map(renderItem)}
        {normal.length > 0 && destructive.length > 0 ? <DropdownMenuSeparator /> : null}
        {destructive.map(renderItem)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
