import { NextResponse } from "next/server";

import { systemPrisma } from "@/lib/db/system-client";

// Public (aucune session) : photo affichée dans l'admin, sur la vitrine et
// dans l'app mobile — même raisonnement que les photos de logements
// (imageId est un UUID aléatoire, rien de confidentiel).
export async function GET(_request: Request, { params }: { params: Promise<{ vehicleId: string; imageId: string }> }) {
  const { vehicleId, imageId } = await params;

  const image = await systemPrisma.vehicleImage.findUnique({ where: { id: imageId } });
  if (!image?.imageData || image.vehicleId !== vehicleId) {
    return NextResponse.json({ error: "Image introuvable." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(image.imageData), {
    headers: {
      "Content-Type": image.imageMimeType ?? "application/octet-stream",
      "Cache-Control": "public, max-age=300",
    },
  });
}
