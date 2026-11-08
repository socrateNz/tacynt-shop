"use client";

import { useEffect } from "react";

import { applyThemePreference, readThemePreference, THEME_STORAGE_KEY } from "@/lib/theme";

// Monté une fois dans app/layout.tsx : en mode "Système" (défaut), suit en
// direct le thème de la machine (bascule clair/sombre de l'OS pendant que
// la page est ouverte) ; synchronise aussi les autres onglets ouverts quand
// la préférence change dans l'un d'eux.
export function ThemeSync() {
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = () => {
      if (readThemePreference() === "system") applyThemePreference("system");
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === THEME_STORAGE_KEY || e.key === null) applyThemePreference();
    };
    media.addEventListener("change", onSystemChange);
    window.addEventListener("storage", onStorage);
    return () => {
      media.removeEventListener("change", onSystemChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return null;
}
