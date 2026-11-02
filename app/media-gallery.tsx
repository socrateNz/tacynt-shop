"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";

// Partagé entre la fiche produit et la fiche logement — mêmes URLs d'image
// déjà résolues par l'appelant (jamais ce composant qui connaît la route
// /api/products/... vs /api/rentals/units/..., il reste agnostique du
// domaine). Survol d'une miniature = aperçu dans la zone principale (pas
// besoin de cliquer pour parcourir) ; clic sur une miniature = sélection
// persistante (utile au tactile, qui n'a pas de survol) ; clic sur l'image
// principale = plein écran.
export function MediaGallery({ imageUrls, alt }: { imageUrls: string[]; alt: string }) {
  const [selected, setSelected] = useState(0);
  const [hovered, setHovered] = useState<number | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const activeIndex = hovered ?? selected;

  useEffect(() => {
    if (!fullscreen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setFullscreen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fullscreen]);

  if (imageUrls.length === 0) {
    return <div className="aspect-square w-full rounded-lg border border-dashed border-border" />;
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setFullscreen(true)}
        className="block w-full cursor-zoom-in"
        aria-label="Afficher en plein écran"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- image binaire servie par la route, pas un asset statique optimisable */}
        <img
          src={imageUrls[activeIndex]}
          alt={alt}
          className="aspect-square w-full rounded-lg border border-border object-cover"
        />
      </button>

      {imageUrls.length > 1 && (
        <div className="flex gap-2">
          {imageUrls.map((url, i) => (
            <button
              key={url}
              type="button"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => setSelected(i)}
              className={`size-16 shrink-0 overflow-hidden rounded-md border ${
                i === activeIndex ? "border-primary" : "border-border"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- image binaire servie par la route, pas un asset statique optimisable */}
              <img src={url} alt="" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {fullscreen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setFullscreen(false)}
        >
          <button
            type="button"
            onClick={() => setFullscreen(false)}
            className="absolute top-4 right-4 flex size-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            aria-label="Fermer"
          >
            <X className="size-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element -- image binaire servie par la route, pas un asset statique optimisable */}
          <img
            src={imageUrls[activeIndex]}
            alt={alt}
            className="max-h-full max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
