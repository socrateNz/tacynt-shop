import type { Organization } from "@prisma/client";

import { paymentOptions, type PaymentOptions } from "@/lib/payments/methods";
import { formatUnite } from "@/lib/tenant/units";
import { systemPrisma } from "@/lib/db/system-client";
import { OCCUPYING_STATUSES } from "@/lib/rentals/contracts";
import { formatLocalityLabel } from "@/lib/rentals/types";
import { organizationHasModule } from "@/lib/tenant/modules";
import { parseOrgSettings } from "@/lib/tenant/settings";

// Même défaut que lib/tenant/resolve.ts / app/platform/(authenticated)/page.tsx
// (ROOT_DOMAIN) — http en local (localhost n'a pas de certificat), https
// partout ailleurs.
const ROOT_DOMAIN = process.env.APP_ROOT_DOMAIN ?? "localhost:3000";
const PROTOCOL = ROOT_DOMAIN.startsWith("localhost") ? "http" : "https";

function storefrontUrl(slug: string, path: string): string {
  return `${PROTOCOL}://${slug}.${ROOT_DOMAIN}${path}`;
}

const MARKETPLACE_TAKE_DEFAULT = 24;
const MARKETPLACE_TAKE_MAX = 100;

function clampTake(take: number | undefined): number {
  if (!take || !Number.isFinite(take) || take <= 0) return MARKETPLACE_TAKE_DEFAULT;
  return Math.min(take, MARKETPLACE_TAKE_MAX);
}

export type MarketplacePage = { skip?: number; take?: number };

// Filtres facultatifs de l'app mobile : boutique précise (page boutique) et
// recherche texte insensible à la casse (barre de recherche). Toujours
// appliqués EN PLUS du filtre opt-in marketplace, jamais à sa place.
export type MarketplaceFilters = MarketplacePage & {
  organizationId?: string;
  q?: string;
  // Fiche détail : toutes les variantes d'un produit / un logement précis.
  productId?: string;
  unitId?: string;
};

export type MarketplaceOrganization = {
  id: string;
  nom: string;
  slug: string;
  devise: string;
  ecommerceEnabled: boolean;
  locationEnabled: boolean;
  logoUrl: string | null;
  storefrontUrl: string;
  // Coordonnées de la boutique vitrine (même boutique que celle dont le
  // catalogue est exposé) — null si non renseignées, jamais inventées.
  adresse: string | null;
  telephone: string | null;
  pays: string;
  // Moyens de paiement de la boutique vitrine (lib/payments/methods.ts) —
  // l'app n'affiche que ceux-là au moment de commander.
  paymentOptions: PaymentOptions;
  // Zones de livraison actives de la boutique vitrine : seuls lieux de
  // livraison possibles. Vide = pas de livraison via l'app (retrait seul).
  deliveryZones: { id: string; nom: string }[];
  // Panier minimum (articles TTC) pour être livré ; null = aucun.
  montantMinimumLivraison: number | null;
};

// API publique cross-organisation (app mobile marketplace, projet séparé) —
// systemPrisma directement, jamais withTenantContext : le but même de cette
// couche est de lire à travers plusieurs organisations à la fois, ce que
// withTenantContext interdit par construction (app.tenant_id = UNE
// organisation). Même précédent que resolveStorefrontShopId
// (lib/storefront/context.ts), qui interroge déjà systemPrisma hors RLS
// pour une résolution anonyme. Visibilité strictement opt-in : seules les
// organisations ayant explicitement activé le module "marketplace"
// (lib/tenant/modules.ts, activé par l'admin plateforme) apparaissent ici.
async function findMarketplaceOrganizations() {
  const organizations = await systemPrisma.organization.findMany({
    where: { statut: "ACTIVE" },
    orderBy: { nom: "asc" },
  });
  return organizations.filter((o) => organizationHasModule(o.enabledModules, "marketplace"));
}

// Résolution par id pour les routes d'écriture de l'app mobile (commande,
// demande de réservation) : l'organisation doit être active, avoir opté in
// au marketplace ET avoir le module métier concerné — sinon null, même
// contrat que resolveStorefrontOrganization.
export async function resolveMarketplaceOrganization(
  organizationId: string,
  moduleKey: "ecommerce" | "location",
): Promise<Organization | null> {
  if (!UUID_RE.test(organizationId)) return null;
  const organization = await systemPrisma.organization.findUnique({ where: { id: organizationId } });
  if (
    !organization ||
    organization.statut !== "ACTIVE" ||
    !organizationHasModule(organization.enabledModules, "marketplace") ||
    !organizationHasModule(organization.enabledModules, moduleKey)
  ) {
    return null;
  }
  return organization;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getMarketplaceOrganizations(): Promise<MarketplaceOrganization[]> {
  const organizations = await findMarketplaceOrganizations();
  const shops = await resolveMarketplaceShops();
  const shopByOrgId = new Map(shops.map((s) => [s.organizationId, s]));

  return organizations.map((o) => {
    const branding = parseOrgSettings(o.settings).branding;
    const shop = shopByOrgId.get(o.id);
    return {
      id: o.id,
      nom: o.nom,
      slug: o.slug,
      devise: o.devise,
      ecommerceEnabled: organizationHasModule(o.enabledModules, "ecommerce"),
      locationEnabled: organizationHasModule(o.enabledModules, "location"),
      logoUrl: branding?.hasLogo ? `/api/marketplace/organizations/${o.id}/logo` : null,
      storefrontUrl: storefrontUrl(o.slug, "/"),
      adresse: shop?.adresse ?? null,
      telephone: shop?.telephone ?? null,
      pays: o.pays,
      paymentOptions: shop?.paymentOptions ?? { online: [], reception: true },
      deliveryZones: shop?.deliveryZones ?? [],
      montantMinimumLivraison: shop?.montantMinimumLivraison ?? null,
    };
  });
}

type ShopResolution = {
  shopId: string;
  organizationId: string;
  organizationNom: string;
  organizationSlug: string;
  devise: string;
  ecommerceEnabled: boolean;
  locationEnabled: boolean;
  adresse: string | null;
  telephone: string | null;
  paymentOptions: PaymentOptions;
  deliveryZones: { id: string; nom: string }[];
  montantMinimumLivraison: number | null;
};

// Une seule boutique "vitrine" par organisation marketplace — même défaut
// que resolveStorefrontShopId pour le catalogue web (première boutique
// active, triée par nom) quand aucune ?shop= n'est précisée. Une
// organisation multi-boutiques n'a qu'une seule entrée dans le marketplace
// pour l'instant, pas une par boutique.
async function resolveMarketplaceShops(): Promise<ShopResolution[]> {
  const organizations = await findMarketplaceOrganizations();
  if (organizations.length === 0) return [];

  const shops = await systemPrisma.shop.findMany({
    where: { organizationId: { in: organizations.map((o) => o.id) }, actif: true },
    orderBy: [{ organizationId: "asc" }, { nom: "asc" }],
  });

  const orgById = new Map(organizations.map((o) => [o.id, o]));
  const zones = await systemPrisma.deliveryZone.findMany({
    where: { shopId: { in: shops.map((s) => s.id) }, actif: true },
    select: { id: true, nom: true, shopId: true },
    orderBy: { nom: "asc" },
  });
  const resolved = new Map<string, ShopResolution>();
  for (const shop of shops) {
    if (resolved.has(shop.organizationId)) continue;
    const org = orgById.get(shop.organizationId);
    if (!org) continue;
    resolved.set(shop.organizationId, {
      shopId: shop.id,
      organizationId: org.id,
      organizationNom: org.nom,
      organizationSlug: org.slug,
      devise: org.devise,
      ecommerceEnabled: organizationHasModule(org.enabledModules, "ecommerce"),
      locationEnabled: organizationHasModule(org.enabledModules, "location"),
      adresse: shop.adresse,
      telephone: shop.telephone,
      paymentOptions: paymentOptions(org, shop),
      deliveryZones: zones.filter((z) => z.shopId === shop.id).map((z) => ({ id: z.id, nom: z.nom })),
      montantMinimumLivraison: shop.montantMinimumLivraison === null ? null : Number(shop.montantMinimumLivraison),
    });
  }
  return [...resolved.values()];
}

export type MarketplaceProduct = {
  variantId: string;
  productId: string;
  designation: string;
  description: string | null;
  categoryName: string | null;
  attributs: Record<string, string>;
  unite: string;
  prixVente: number;
  devise: string;
  available: boolean;
  stockQuantite: number | null;
  coverImageId: string | null;
  organizationId: string;
  organizationNom: string;
  shopId: string;
  // Pont vers la vitrine web déjà fonctionnelle de cette organisation —
  // utilisable tant que l'app mobile ne réimplémente pas son propre tunnel
  // d'achat (panier mono-organisation, décision verrouillée avec
  // l'utilisateur).
  storefrontUrl: string;
};

// Lecture seule, même règle que le catalogue web (lib/storefront/catalog.ts) :
// le prix affiché ici n'est jamais ce qu'une commande accepte, le serveur
// revalide toujours au moment d'acheter.
export async function getMarketplaceProducts({
  skip = 0,
  take,
  organizationId,
  q,
  productId,
}: MarketplaceFilters = {}): Promise<MarketplaceProduct[]> {
  if (productId && !UUID_RE.test(productId)) return [];
  const shops = (await resolveMarketplaceShops()).filter(
    (s) => s.ecommerceEnabled && (!organizationId || s.organizationId === organizationId),
  );
  if (shops.length === 0) return [];

  const shopByOrgId = new Map(shops.map((s) => [s.organizationId, s]));
  const shopIds = shops.map((s) => s.shopId);

  const variants = await systemPrisma.productVariant.findMany({
    where: {
      actif: true,
      product: {
        actif: true,
        organizationId: { in: [...shopByOrgId.keys()] },
        ...(q ? { designation: { contains: q, mode: "insensitive" as const } } : {}),
        ...(productId ? { id: productId } : {}),
      },
    },
    include: {
      product: {
        include: {
          images: { select: { id: true }, orderBy: { position: "asc" }, take: 1 },
          category: true,
        },
      },
      shopPrices: { where: { shopId: { in: shopIds } } },
      stockLevels: { where: { shopId: { in: shopIds } } },
    },
    orderBy: { product: { designation: "asc" } },
    skip,
    take: clampTake(take),
  });

  return variants.flatMap((v) => {
    const shop = shopByOrgId.get(v.product.organizationId);
    if (!shop || v.shopPrices.length === 0) return [];

    const price = v.shopPrices[0];
    const stock = v.stockLevels[0];
    const stockQuantite = v.product.suiviStock ? Number(stock?.quantite ?? 0) : null;
    const available = stockQuantite === null || stockQuantite > 0;

    return [
      {
        variantId: v.id,
        productId: v.productId,
        designation: v.product.designation,
        description: v.product.description,
        categoryName: v.product.category?.nom ?? null,
        attributs: v.attributs as Record<string, string>,
        unite: formatUnite(Number(v.uniteQuantite), v.unite),
        prixVente: Number(price.prixVente),
        devise: shop.devise,
        available,
        stockQuantite,
        coverImageId: v.product.images[0]?.id ?? null,
        organizationId: shop.organizationId,
        organizationNom: shop.organizationNom,
        shopId: shop.shopId,
        storefrontUrl: storefrontUrl(shop.organizationSlug, `/produit/${v.id}?shop=${shop.shopId}`),
      },
    ];
  });
}

export type MarketplaceRentalUnit = {
  id: string;
  type: string;
  designation: string;
  montantMensuel: number;
  dureeMinMois: number;
  devise: string;
  imageIds: string[];
  localityLabel: string | null;
  surfaceM2: number | null;
  nombrePieces: number | null;
  equipements: string[];
  // Contrat confirmé ou en cours : toujours listé (décision utilisateur),
  // marqué "Occupée" dans l'app, jamais réservable.
  occupe: boolean;
  organizationId: string;
  organizationNom: string;
  shopId: string;
  storefrontUrl: string;
};

export async function getMarketplaceRentalUnits({
  skip = 0,
  take,
  organizationId,
  q,
  unitId,
}: MarketplaceFilters = {}): Promise<MarketplaceRentalUnit[]> {
  if (unitId && !UUID_RE.test(unitId)) return [];
  const shops = (await resolveMarketplaceShops()).filter(
    (s) => s.locationEnabled && (!organizationId || s.organizationId === organizationId),
  );
  if (shops.length === 0) return [];

  const shopById = new Map(shops.map((s) => [s.shopId, s]));

  const units = await systemPrisma.rentalUnit.findMany({
    where: {
      shopId: { in: [...shopById.keys()] },
      actif: true,
      ...(q ? { designation: { contains: q, mode: "insensitive" as const } } : {}),
      ...(unitId ? { id: unitId } : {}),
    },
    include: {
      images: { select: { id: true }, orderBy: { position: "asc" }, take: 5 },
      contracts: { where: { statut: { in: [...OCCUPYING_STATUSES] } }, take: 1 },
      locality: { include: { parent: true } },
    },
    orderBy: { designation: "asc" },
    skip,
    take: clampTake(take),
  });

  // Occupés conservés, toujours après les disponibles.
  return units
    .flatMap((u) => {
      const shop = shopById.get(u.shopId);
      if (!shop) return [];

      return [
        {
          id: u.id,
          type: u.type,
          designation: u.designation,
          montantMensuel: Number(u.montantMensuel),
          dureeMinMois: u.dureeMinMois,
          devise: shop.devise,
          imageIds: u.images.map((img) => img.id),
          localityLabel: formatLocalityLabel(u.locality),
          surfaceM2: u.surfaceM2,
          nombrePieces: u.nombrePieces,
          equipements: u.equipements,
          occupe: u.contracts.length > 0,
          organizationId: shop.organizationId,
          organizationNom: shop.organizationNom,
          shopId: shop.shopId,
          storefrontUrl: storefrontUrl(shop.organizationSlug, `/locations/${u.id}?shop=${shop.shopId}`),
        },
      ];
    });
}
