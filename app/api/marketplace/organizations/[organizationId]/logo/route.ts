import { NextResponse } from "next/server";

import { systemPrisma } from "@/lib/db/system-client";

// Même image que /api/branding/logo, mais adressée par organizationId
// plutôt que résolue par host : l'app mobile marketplace n'est jamais sur
// le sous-domaine d'une organisation précise, elle a besoin de pouvoir
// demander le logo de N'IMPORTE LAQUELLE par id (même raisonnement que
// /api/products/[productId]/images/[imageId], déjà public et adressé par
// id plutôt que par host).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ organizationId: string }> },
) {
  const { organizationId } = await params;

  const branding = await systemPrisma.organizationBranding.findUnique({
    where: { organizationId },
  });

  if (!branding?.logoData) {
    return NextResponse.json({ error: "Logo introuvable." }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(branding.logoData), {
    headers: {
      "Content-Type": branding.logoMimeType ?? "application/octet-stream",
      "Cache-Control": "public, max-age=300",
    },
  });
}
