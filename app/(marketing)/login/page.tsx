import { headers } from "next/headers";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { extractSlugFromHost, resolveOrganizationBySlug } from "@/lib/tenant/resolve";

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "Identifiants incorrects.",
  locked: "Compte verrouillé suite à plusieurs échecs de connexion. Réessayez plus tard.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ error }, h] = await Promise.all([searchParams, headers()]);
  const slug = extractSlugFromHost(h.get("host") ?? "");
  const organization = slug ? await resolveOrganizationBySlug(slug) : null;

  return (
    <div className="flex flex-1 items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8">
        <h1 className="text-xl font-semibold text-foreground">
          {organization?.nom ?? "Boutique introuvable"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Connexion à votre espace.</p>

        {error && (
          <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {ERROR_MESSAGES[error] ?? "Une erreur est survenue, réessayez."}
          </p>
        )}

        <form action="/api/auth/login" method="POST" className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required autoFocus />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Mot de passe</Label>
            <Input id="password" name="password" type="password" required />
          </div>
          <Button type="submit" className="mt-2">
            Se connecter
          </Button>
        </form>
      </div>
    </div>
  );
}
