import Link from "next/link";
import { redirect } from "next/navigation";

import { withTenantContext } from "@/lib/db/tenant-context";
import { systemPrisma } from "@/lib/db/system-client";
import { formatMoney } from "@/lib/money";
import { hasCapability } from "@/lib/permissions";
import { getActiveShopId } from "@/lib/tenant/active-shop";
import { getTenantContext } from "@/lib/tenant/context";
import { profileHasLots, profileHasSerialNumbers } from "@/lib/tenant/profile";

import { ProductsTable, type ProductRow } from "./products-table";

export default async function ProductsPage() {
  const ctx = await getTenantContext();
  if (!hasCapability(ctx.role, "catalog:read")) {
    redirect("/");
  }

  const shopId = await getActiveShopId(ctx.organizationId, ctx.userId);
  const organization = await systemPrisma.organization.findUniqueOrThrow({
    where: { id: ctx.organizationId },
  });

  const now = new Date();

  const { products, categories, lotsByProduct, serialsByProduct } = await withTenantContext(
    { organizationId: ctx.organizationId, shopId },
    async (tx) => {
      const products = await tx.product.findMany({
        orderBy: { designation: "asc" },
        include: {
          category: true,
          variants: { include: { shopPrices: { where: { shopId } } } },
          // Juste l'existence d'une photo, jamais imageData (bytea) ici —
          // c'est exactement pour éviter cet alourdissement que ProductImage
          // est un modèle séparé de Product.
          image: { select: { productId: true } },
        },
      });
      const categories = await tx.category.findMany({ orderBy: { nom: "asc" } });

      const variantToProduct = new Map<string, (typeof products)[number]>();
      for (const p of products) {
        for (const v of p.variants) variantToProduct.set(v.id, p);
      }

      const lotVariantIds = products.filter((p) => p.suiviLots).flatMap((p) => p.variants.map((v) => v.id));
      const lots = lotVariantIds.length
        ? await tx.lot.findMany({
            where: { shopId, variantId: { in: lotVariantIds } },
            include: { variant: true },
            orderBy: [{ datePeremption: "asc" }, { numero: "asc" }],
          })
        : [];
      const lotsByProduct = new Map<string, typeof lots>();
      for (const l of lots) {
        const product = variantToProduct.get(l.variantId);
        if (!product) continue;
        const list = lotsByProduct.get(product.id) ?? [];
        list.push(l);
        lotsByProduct.set(product.id, list);
      }

      const serialVariantIds = products
        .filter((p) => p.suiviSerie)
        .flatMap((p) => p.variants.map((v) => v.id));
      const serials = serialVariantIds.length
        ? await tx.serialNumber.findMany({
            where: { shopId, variantId: { in: serialVariantIds } },
            include: { variant: true, saleLine: { include: { sale: true } } },
            orderBy: [{ statut: "asc" }, { receivedAt: "asc" }],
          })
        : [];
      const serialsByProduct = new Map<string, typeof serials>();
      for (const s of serials) {
        const product = variantToProduct.get(s.variantId);
        if (!product) continue;
        const list = serialsByProduct.get(product.id) ?? [];
        list.push(s);
        serialsByProduct.set(product.id, list);
      }

      return { products, categories, lotsByProduct, serialsByProduct };
    },
  );

  const canWrite = hasCapability(ctx.role, "catalog:write");
  const showLots = profileHasLots(organization.profilMetier);
  const showSerial = profileHasSerialNumbers(organization.profilMetier);

  const rows: ProductRow[] = products.map((p) => {
    const price = p.variants[0]?.shopPrices[0];
    return {
      id: p.id,
      reference: p.reference,
      designation: p.designation,
      categoryName: p.category?.nom ?? null,
      priceLabel: price ? formatMoney(price.prixVente, organization.devise) : "—",
      priceValue: price ? Number(price.prixVente) : 0,
      stockSuivi: p.suiviStock,
      activeVariants: p.variants.filter((v) => v.actif).length,
      hasImage: p.image !== null,
      edit: {
        id: p.id,
        designation: p.designation,
        categoryId: p.categoryId,
        unite: p.unite,
        tauxTaxe: Number(p.tauxTaxe),
        codeBarres: p.variants[0]?.codeBarres ?? null,
        prixVente: price ? Number(price.prixVente) : 0,
        prixPlancher: price?.prixPlancher ? Number(price.prixPlancher) : null,
        seuilAlerte: price?.seuilAlerte ?? null,
        hasImage: p.image !== null,
      },
      variants: p.variants.map((v) => {
        const attrs = v.attributs as Record<string, string>;
        const attrLabel =
          Object.entries(attrs).length > 0
            ? Object.entries(attrs)
                .map(([k, val]) => `${k}: ${val}`)
                .join(", ")
            : "—";
        const shopPrice = v.shopPrices[0];
        return {
          id: v.id,
          attrLabel,
          codeBarres: v.codeBarres,
          priceLabel: shopPrice ? formatMoney(shopPrice.prixVente, organization.devise) : "—",
          actif: v.actif,
        };
      }),
      hasLots: p.suiviLots,
      lots: (lotsByProduct.get(p.id) ?? []).map((l) => {
        const attrs = l.variant.attributs as Record<string, string>;
        const expired = l.datePeremption ? l.datePeremption < now : false;
        return {
          id: l.id,
          attrLabel: Object.values(attrs).join(", "),
          numero: l.numero,
          peremptionLabel: l.datePeremption ? l.datePeremption.toLocaleDateString("fr-FR") : "—",
          expired,
          quantite: l.quantite.toString(),
        };
      }),
      hasSerialNumbers: p.suiviSerie,
      serialNumbers: (serialsByProduct.get(p.id) ?? []).map((s) => {
        const attrs = s.variant.attributs as Record<string, string>;
        return {
          id: s.id,
          attrLabel: Object.values(attrs).join(", "),
          numero: s.numero,
          statutLabel: s.statut === "VENDU" ? "Vendu" : "En stock",
          vendu: s.statut === "VENDU",
          receivedAtLabel: s.receivedAt.toLocaleDateString("fr-FR"),
          saleNumero: s.saleLine ? s.saleLine.sale.numero : null,
        };
      }),
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Produits</h1>
          <p className="text-sm text-muted-foreground">
            Catalogue mutualisé au niveau de l&apos;organisation, prix par boutique.
          </p>
        </div>
        {showSerial && (
          <Link
            href="/catalog/serial-numbers"
            className="text-sm text-primary underline-offset-4 hover:underline"
          >
            Rechercher un numéro de série
          </Link>
        )}
      </header>

      <ProductsTable
        products={rows}
        categories={categories.map((c) => ({ id: c.id, nom: c.nom }))}
        canWrite={canWrite}
        showLots={showLots}
        showSerial={showSerial}
      />
    </div>
  );
}
