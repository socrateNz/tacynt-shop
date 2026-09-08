"use client";

import { useEffect } from "react";

// Effet pur (pas de setState) : abonnement à un système externe, exactement
// l'usage prévu pour useEffect.
export function RegisterServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Échec silencieux : l'app fonctionne normalement sans SW, juste
        // sans les bénéfices hors ligne/installation.
      });
    }
  }, []);

  return null;
}
