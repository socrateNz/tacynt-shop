import { redirect } from "next/navigation";

import { systemPrisma } from "@/lib/db/system-client";
import { hasCapability } from "@/lib/permissions";
import { getTenantContext } from "@/lib/tenant/context";
import { organizationCanUseWhiteLabel } from "@/lib/tenant/entitlements";
import { MODULE_CATALOG, organizationHasModule } from "@/lib/tenant/modules";
import { resolveAccountingMapping } from "@/lib/reports/accounting-mapping";
import { parseOrgSettings } from "@/lib/tenant/settings";

import { AccountingMappingForm } from "./accounting-mapping-form";
import { ProfilMetierForm } from "./settings-form";
import { WhiteLabelForm } from "./white-label-form";

export default async function SettingsPage() {
  const ctx = await getTenantContext();
  const canManageShop = hasCapability(ctx.role, "shops:manage");
  const canManageAccounting = hasCapability(ctx.role, "accounting:manage");
  if (!canManageShop && !canManageAccounting) {
    redirect("/");
  }

  const organization = await systemPrisma.organization.findUniqueOrThrow({
    where: { id: ctx.organizationId },
  });
  const settings = parseOrgSettings(organization.settings);

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-xl font-semibold text-foreground">Paramètres</h1>
      </header>

      {canManageShop && (
        <>
          <ProfilMetierForm profilMetier={organization.profilMetier} />

          <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-6">
            <h2 className="text-sm font-medium text-foreground">Modules premium</h2>
            <p className="text-sm text-muted-foreground">
              Activés par l&apos;équipe Tacynt après souscription — aucune bascule en
              libre-service depuis cet espace.
            </p>
            <ul className="flex flex-col gap-1.5">
              {MODULE_CATALOG.map((m) => {
                const active = organizationHasModule(organization.enabledModules, m.key);
                return (
                  <li key={m.key} className="flex items-center gap-2 text-sm">
                    <span
                      className={
                        active
                          ? "rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
                          : "rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                      }
                    >
                      {active ? "Activé" : "Inactif"}
                    </span>
                    <span className="text-foreground">{m.label}</span>
                  </li>
                );
              })}
            </ul>
          </section>

          {organizationCanUseWhiteLabel(organization.plan) &&
            hasCapability(ctx.role, "white_label:manage") && (
              <WhiteLabelForm
                customDomain={organization.customDomain}
                customDomainVerified={organization.customDomainVerified}
                primaryColor={settings.branding?.primaryColor ?? null}
                hasLogo={settings.branding?.hasLogo ?? false}
              />
            )}
        </>
      )}

      {canManageAccounting && organizationHasModule(organization.enabledModules, "accounting_connectors") && (
        <AccountingMappingForm mapping={resolveAccountingMapping(settings)} />
      )}
    </div>
  );
}
