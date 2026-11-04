import { NextResponse } from "next/server";

import { getMarketplaceCustomer, toPublicCustomer, unauthorized } from "@/lib/marketplace/auth";

export async function GET(request: Request) {
  const customer = await getMarketplaceCustomer(request);
  if (!customer) return unauthorized();
  return NextResponse.json({ customer: toPublicCustomer(customer) });
}
