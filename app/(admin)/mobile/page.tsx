import Link from "next/link";
import { redirect } from "next/navigation";

import { systemPrisma } from "@/lib/db/system-client";
import { withTenantContext } from "@/lib/db/tenant-context";
import { formatMoney } from "@/lib/money";
import { hasCapability } from "@/lib/permissions";
import { getCreancesReport } from "@/lib/reports/creances";
import { getDailyReport } from "@/lib/reports/daily";
import { getMargesReport } from "@/lib/reports/marges";
import { parsePeriod } from "@/lib/reports/period";
import { getTresorerieReport } from "@/lib/reports/tresorerie";
import { getVentesReport } from "@/lib/reports/ventes";
import { getActiveShopId } from "@/lib/tenant/active-shop";
import { getTenantContext } from "@/lib/tenant/context";

// "Vue propriétaire" (section 2.2 : le propriétaire n'est pas dans la
// boutique tous les jours, veut savoir depuis son téléphone ce qui a été
// vendu, combien reste en caisse, si son stock diminue anormalement).
// Décision verrouillée avec l'utilisateur : une page dédiée dans cette même
// appli Next.js, gérée par reports:read (pas de rôle codé en dur), pas une
// app native séparée. Réutilise les mêmes agrégations que /reports.
export default async function MobileOwnerViewPage() {
  const ctx = await getTenantContext();
  if (!hasCapability(ctx.role, "reports:read")) {
    redirect("/");
  }

  const shopId = await getActiveShopId(ctx.organizationId, ctx.userId);
  const organization = await systemPrisma.organization.findUniqueOrThrow({
    where: { id: ctx.organizationId },
  });
  const monthPeriod = parsePeriod({});

  const [daily, ventesMois, margesMois, tresorerieMois, creances] = await withTenantContext(
    { organizationId: ctx.organizationId, shopId },
    async (tx) => {
      const daily = await getDailyReport(tx, shopId);
      const ventesMois = await getVentesReport(tx, shopId, monthPeriod.from, monthPeriod.to);
      const margesMois = await getMargesReport(tx, shopId, monthPeriod.from, monthPeriod.to);
      const tresorerieMois = await getTresorerieReport(tx, shopId, monthPeriod.from, monthPeriod.to);
      const creances = await getCreancesReport(tx, ctx.organizationId);
      return [daily, ventesMois, margesMois, tresorerieMois, creances] as const;
    },
  );

  const margeMoisTotal = margesMois.parProduit.reduce((sum, p) => sum + p.marge, 0);

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6 py-4">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground uppercase">{organization.nom}</p>
          <h1 className="text-lg font-semibold text-foreground">Vue propriétaire</h1>
        </div>
        <Link href="/" className="text-xs text-primary underline-offset-4 hover:underline">
          Vue complète
        </Link>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-medium text-muted-foreground uppercase">Aujourd&apos;hui</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Chiffre d&apos;affaires</p>
            <p className="num text-xl font-semibold text-foreground">
              {formatMoney(daily.caDuJour, organization.devise)}
            </p>
            {daily.variationPourcent !== null && (
              <p className={`text-xs ${daily.variationPourcent >= 0 ? "text-success" : "text-destructive"}`}>
                {daily.variationPourcent >= 0 ? "+" : ""}
                {daily.variationPourcent.toFixed(1)}% vs sem. dernière
              </p>
            )}
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Tickets</p>
            <p className="num text-xl font-semibold text-foreground">{daily.nombreTickets}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Espèces en caisse</p>
            <p className="num text-xl font-semibold text-foreground">
              {formatMoney(daily.especesEnCaisse, organization.devise)}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Ruptures actives</p>
            <p
              className={`num text-xl font-semibold ${daily.rupturesActives > 0 ? "text-destructive" : "text-foreground"}`}
            >
              {daily.rupturesActives}
            </p>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-medium text-muted-foreground uppercase">Ce mois-ci</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Chiffre d&apos;affaires</p>
            <p className="num text-xl font-semibold text-foreground">
              {formatMoney(ventesMois.totalCa, organization.devise)}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Marge brute</p>
            <p className="num text-xl font-semibold text-foreground">
              {formatMoney(margeMoisTotal, organization.devise)}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Solde net trésorerie</p>
            <p
              className={`num text-xl font-semibold ${tresorerieMois.soldeNet >= 0 ? "text-success" : "text-destructive"}`}
            >
              {formatMoney(tresorerieMois.soldeNet, organization.devise)}
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Créances clients</p>
            <p className="num text-xl font-semibold text-foreground">
              {formatMoney(creances.totalDu, organization.devise)}
            </p>
          </div>
        </div>
      </section>

      <Link
        href="/reports"
        className="rounded-xl border border-border bg-card p-4 text-center text-sm text-primary underline-offset-4 hover:underline"
      >
        Voir tous les rapports détaillés →
      </Link>
    </div>
  );
}
