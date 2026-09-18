import { notFound } from "next/navigation";

import { getStorefrontOrganization } from "@/lib/storefront/context";

import { CartView } from "../cart-view";

export default async function PanierPage() {
  const organization = await getStorefrontOrganization();
  if (!organization) {
    notFound();
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold text-foreground">Panier</h1>
      </header>
      <CartView devise={organization.devise} />
    </div>
  );
}
