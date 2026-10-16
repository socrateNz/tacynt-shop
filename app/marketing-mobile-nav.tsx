"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const LINKS = [
  { href: "#accueil", label: "Accueil" },
  { href: "#fonctionnalites", label: "Fonctionnalités" },
  { href: "#pourquoi", label: "Pourquoi nous" },
  { href: "#faq", label: "Questions fréquentes" },
  { href: "#contact", label: "Contact" },
];

// Sous md, l'en-tête n'affichait aucune navigation du tout (nav desktop
// cachée via `hidden md:flex`, sans remplacement) — un vrai trou sur mobile,
// corrigé ici avec le même tiroir Base UI que la nav admin.
export function MarketingMobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={<Button variant="ghost" size="icon" className="md:hidden" />}
      >
        <Menu className="size-5" />
        <span className="sr-only">Ouvrir le menu</span>
      </SheetTrigger>
      <SheetContent side="right" className="gap-1 p-4">
        <SheetTitle className="px-2 py-2 text-base">Tacynt Shop</SheetTitle>
        <nav className="mt-2 flex flex-col gap-1">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="rounded-md px-2 py-2.5 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
