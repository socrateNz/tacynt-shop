import { ScrollReveal } from "./scroll-reveal";

// Bandeau d'accueil de la racine "/" (M40, "refonte vrai site") — même
// recette que le hero de MarketingHome (halos --primary, ScrollReveal) mais
// contenu strictement factuel : nom de la boutique + un comptage réel
// calculé depuis les données déjà chargées par Home(), jamais un slogan
// inventé (aucune description/argumentaire n'existe sur Organization).
// Respecte le white-label : --primary est déjà surchargé plus haut par
// StorefrontShell, ce composant ne fait qu'en consommer la valeur.
export function StorefrontHero({ nom, subtitle }: { nom: string; subtitle: string }) {
  return (
    <section className="relative mb-8 overflow-hidden rounded-2xl border border-border bg-card px-6 py-10 sm:px-10 sm:py-14">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 -right-16 size-64 rounded-full bg-primary/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-16 -left-16 size-56 rounded-full bg-primary/5 blur-3xl"
      />
      <ScrollReveal className="relative flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Bienvenue chez {nom}
        </h1>
        <p className="text-sm text-muted-foreground sm:text-base">{subtitle}</p>
      </ScrollReveal>
    </section>
  );
}
