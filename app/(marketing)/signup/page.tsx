import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ERROR_MESSAGES: Record<string, string> = {
  invalid: "Nom de boutique, email et mot de passe (8 caractères minimum) sont requis.",
  conflict: "Impossible de créer la boutique, réessayez.",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex flex-1 items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8">
        <h1 className="text-xl font-semibold text-foreground">Créer votre boutique</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Quelques minutes suffisent pour encaisser dès aujourd&apos;hui.
        </p>

        {error && (
          <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {ERROR_MESSAGES[error] ?? "Une erreur est survenue, réessayez."}
          </p>
        )}

        <form action="/api/auth/signup" method="POST" className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nom">Nom de la boutique</Label>
            <Input id="nom" name="nom" required placeholder="Épicerie du Marché" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required placeholder="vous@boutique.com" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Mot de passe</Label>
            <Input id="password" name="password" type="password" required minLength={8} />
          </div>
          <Button type="submit" className="mt-2">
            Créer ma boutique
          </Button>
        </form>
      </div>
    </div>
  );
}
