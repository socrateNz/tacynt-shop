import { Phone } from "lucide-react";

import { cn } from "@/lib/utils";

// Numéro de téléphone cliquable (tel:) — un toucher lance l'appel depuis un
// téléphone, ou l'application d'appel par défaut sur ordinateur. Le numéro
// est affiché tel que saisi, seul le lien est normalisé (espaces retirés).
export function PhoneLink({ telephone, className }: { telephone: string; className?: string }) {
  const href = `tel:${telephone.replace(/[^\d+]/g, "")}`;
  return (
    <a
      href={href}
      className={cn(
        "inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline",
        className,
      )}
    >
      <Phone className="size-3.5 shrink-0" />
      {telephone}
    </a>
  );
}
