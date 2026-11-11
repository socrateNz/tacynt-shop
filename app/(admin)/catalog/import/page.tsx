import { redirect } from "next/navigation";

import { Page, PageHeader } from "@/components/admin/page";
import { hasCapability } from "@/lib/permissions";
import { getTenantContext } from "@/lib/tenant/context";

import { ImportClient } from "./import-client";

export default async function ImportPage() {
  const ctx = await getTenantContext();
  if (!hasCapability(ctx.role, "catalog:import")) {
    redirect("/dashboard");
  }

  return (
    <Page>
      <PageHeader
        title="Importer un catalogue"
        back={{ href: "/catalog/products", label: "Produits" }}
        description={<>Import en deux temps : analyse du fichier puis confirmation. Rien n&apos;est écrit en base tant que l&apos;import n&apos;est pas confirmé.</>}
      />

      <ImportClient />
    </Page>
  );
}
