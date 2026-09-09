import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "Identifiants incorrects.",
};

export default async function PlatformLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex flex-1 items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8">
        <h1 className="text-xl font-semibold text-foreground">Espace admin plateforme</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Réservé aux opérateurs Tacynt — distinct des comptes organisation.
        </p>

        {error && (
          <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {ERROR_MESSAGES[error] ?? "Une erreur est survenue, réessayez."}
          </p>
        )}

        <form
          action="/api/platform/auth/login"
          method="POST"
          className="mt-6 flex flex-col gap-4"
        >
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
