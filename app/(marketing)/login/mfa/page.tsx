import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function LoginMfaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex flex-1 items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8">
        <h1 className="text-xl font-semibold text-foreground">Vérification en deux étapes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Entrez le code à 6 chiffres de votre application d&apos;authentification.
        </p>

        {error && (
          <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Code invalide, réessayez.
          </p>
        )}

        <form action="/api/auth/mfa/verify" method="POST" className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="token">Code</Label>
            <Input
              id="token"
              name="token"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              autoFocus
            />
          </div>
          <Button type="submit" className="mt-2">
            Valider
          </Button>
        </form>
      </div>
    </div>
  );
}
