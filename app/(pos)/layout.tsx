import type { ReactNode } from "react";

// Coquille minimale, volontairement sans navigation admin : la caisse est
// l'écran qui décide de l'adoption du produit (section 5.3), elle doit
// rester rapide et sans distraction.
export default function PosLayout({ children }: { children: ReactNode }) {
  return <div className="flex min-h-full flex-1 flex-col bg-background">{children}</div>;
}
