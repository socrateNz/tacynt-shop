import { NextResponse } from "next/server";

import { getMarketplaceOrganizations } from "@/lib/marketplace/catalog";

// Public, sans auth, servie sur le domaine racine (proxy.ts laisse déjà
// passer sans contexte tenant toute requête dont l'hôte ne résout aucun
// sous-domaine/domaine personnalisé — aucune modification nécessaire
// là-bas). Consommée par l'application mobile marketplace (projet séparé).
export async function GET() {
  const organizations = await getMarketplaceOrganizations();
  return NextResponse.json({ organizations });
}
