import { NextResponse } from "next/server";

import { systemPrisma } from "@/lib/db/system-client";

// Public (aucune session requise) : consultée depuis l'admin ET la vitrine
// location — même raisonnement que /api/products/[productId]/images/[imageId]
// (imageId est un UUID aléatoire, la photo d'un logement n'a rien de
// confidentiel puisqu'elle doit être visible sur la vitrine).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ unitId: string; imageId: string }> },
) {
  const { imageId } = await params;

  const image = await systemPrisma.rentalUnitImage.findUnique({ where: { id: imageId } });

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
