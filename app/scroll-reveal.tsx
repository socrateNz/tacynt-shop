"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

// Fondu + léger décalage vertical au défilement — décalage volontairement
// petit (8-16px) pour rester lisible comme un fondu, pas un slide.
//
// Visible par défaut (le rendu serveur et le className de base n'ont AUCUNE
// classe d'opacité) : si le JS échoue, est désactivé, ou qu'un crawler/SEO
// ne l'exécute pas, le contenu reste pleinement visible — jamais caché sans
// filet. Ce n'est qu'après confirmation que l'observateur peut effectivement
// révéler l'élément que useLayoutEffect le masque, de façon synchrone avant
// la peinture du navigateur (donc sans flash visible→caché pour un vrai
// utilisateur). Manipulation directe du DOM plutôt qu'un état React : pas de
// re-render, et ça n'interagit jamais mal avec l'hydratation.
// prefers-reduced-motion est doublé en CSS pur (motion-reduce:) en filet
// supplémentaire.
export function ScrollReveal({
  children,
  delayMs = 0,
  className = "",
}: {
  children: ReactNode;
  delayMs?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;

    node.style.transitionDelay = `${delayMs}ms`;
    node.classList.add("opacity-0", "translate-y-3");

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          node.classList.remove("opacity-0", "translate-y-3");
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [delayMs]);

  return (
    <div ref={ref} className={`motion-reduce:opacity-100! motion-reduce:translate-y-0! transition-all duration-700 ease-out ${className}`}>
      {children}
    </div>
  );
}
