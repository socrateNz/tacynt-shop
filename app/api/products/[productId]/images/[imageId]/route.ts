import { NextResponse } from "next/server";

import { systemPrisma } from "@/lib/db/system-client";

// Public (aucune session requise) : consultée depuis l'admin ET la vitrine
// e-commerce, même esprit que /api/branding/logo. imageId est un UUID
// aléatoire — aucune énumération possible, et la photo d'un produit n'a
// rien de confidentiel (elle doit justement être visible sur la boutique
// en ligne), donc pas besoin de résoudre par host comme le logo. productId
// dans le chemin n'est pas utilisé pour la résolution (imageId suffit déjà
// à identifier la ressource) — gardé pour la lisibilité de l'URL, même
// convention que le reste de /api/products/[productId]/*.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ productId: string; imageId: string }> },
) {
  const { imageId } = await params;

  const image = await systemPrisma.productImage.findUnique({ where: { id: imageId } });

  if (!image?.imageData) {
    return NextResponse.json({ error: "Image introuvable." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(image.imageData), {
    headers: {
      "Content-Type": image.imageMimeType ?? "application/octet-stream",
      "Cache-Control": "public, max-age=300",
    },
  });
}
