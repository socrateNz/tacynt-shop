import { NextResponse } from "next/server";

import { withTenantContext } from "@/lib/db/tenant-context";
import { assertCapability } from "@/lib/permissions";
import { getActiveShopId } from "@/lib/tenant/active-shop";
import { getTenantContext } from "@/lib/tenant/context";

const RANGE_SIZE = 100;

// Allocation atomique d'une plage de numéros de ticket au poste de caisse
// (cahier des charges 7.3, point 2) : élimine toute collision de
// numérotation à la resynchronisation entre plusieurs postes.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ registerId: string }> },
) {
  const ctx = await getTenantContext();
  assertCapability(ctx.role, "pos:sell");

  const { registerId } = await params;
  const shopId = await getActiveShopId(ctx.organizationId, ctx.userId);

  try {
    const range = await withTenantContext(
      { organizationId: ctx.organizationId, shopId },
      async (tx) => {
        const rows = await tx.$queryRaw<{ current_allocated_max: bigint }[]>`
          UPDATE registers
          SET current_allocated_max = current_allocated_max + ${RANGE_SIZE}
          WHERE id = ${registerId}::uuid AND shop_id = ${shopId}::uuid
          RETURNING current_allocated_max
        `;

        if (rows.length === 0) {
          throw new Error("REGISTER_NOT_FOUND");
        }

        const newMax = Number(rows[0].current_allocated_max);
        return { rangeStart: newMax - RANGE_SIZE + 1, rangeEnd: newMax };
      },
    );

    return NextResponse.json(range);
  } catch (error) {
    if (error instanceof Error && error.message === "REGISTER_NOT_FOUND") {
      return NextResponse.json({ error: "Poste de caisse introuvable." }, { status: 404 });
    }
    throw error;
  }
}
