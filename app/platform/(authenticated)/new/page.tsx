import { Page, PageHeader } from "@/components/admin/page";
import { NewOrganizationForm } from "./new-organization-form";

export default function NewOrganizationPage() {
  return (
    <Page>
      <PageHeader
        title="Nouvelle organisation"
        description={<>Création d&apos;organisation réservée à l&apos;admin plateforme — plus d&apos;inscription en libre-service.</>}
      />

      <div className="max-w-sm">
        <NewOrganizationForm rootDomain={process.env.APP_ROOT_DOMAIN ?? "localhost:3000"} />
      </div>
    </Page>
  );
}
