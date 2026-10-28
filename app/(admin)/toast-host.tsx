"use client";

import type { ReactNode } from "react";

import { ToastProvider, Toaster } from "@/components/ui/toast";
import { toastManager } from "@/lib/toast";

// Monté une seule fois autour de tout l'admin (layout.tsx) — toastManager.add
// peut ensuite être appelé depuis n'importe quel composant client de l'admin,
// pas seulement Commandes en ligne.
export function ToastHost({ children }: { children: ReactNode }) {
  return (
    <ToastProvider toastManager={toastManager}>
      {children}
      <Toaster />
    </ToastProvider>
  );
}
