import { redirect } from "next/navigation";

import { hasCapability } from "@/lib/permissions";
import { getTenantContext } from "@/lib/tenant/context";

import { ImportClient } from "./import-client";

export default async function ImportPage() {
  const ctx = await getTenantContext();
  if (!hasCapability(ctx.role, "catalog:import")) {
    redirect("/");
  }

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-xl font-semibold text-foreground">Import catalogue</h1>
        <p className="text-sm text-muted-foreground">
          Import en deux temps : analyse du fichier puis confirmation. Rien n&apos;est écrit en
          base tant que l&apos;import n&apos;est pas confirmé.
        </p>
      </header>

      <ImportClient />
    </div>
  );
}
