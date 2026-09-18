"use client";

import { ShoppingCart } from "lucide-react";
import Link from "next/link";

import { useCart } from "./cart-context";

export function CartHeaderLink() {
  const { count, loaded } = useCart();

  return (
    <Link
      href="/boutique/panier"
      className="ml-auto flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted"
    >
      <ShoppingCart className="size-4" />
      Panier
      {loaded && count > 0 && (
        <span className="num flex size-5 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
          {count}
        </span>
      )}
    </Link>
  );
}
