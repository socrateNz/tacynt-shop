import { NewOrganizationForm } from "./new-organization-form";

export default function NewOrganizationPage() {
  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-xl font-semibold text-foreground">Nouvelle organisation</h1>
        <p className="text-sm text-muted-foreground">
          Création d&apos;organisation réservée à l&apos;admin plateforme — plus
          d&apos;inscription en libre-service.
        </p>
      </header>

      <div className="max-w-sm">
        <NewOrganizationForm />
      </div>
    </div>
  );
}
