import { notFound } from "next/navigation";

import { getStorefrontOrganization } from "@/lib/storefront/context";

import { CheckoutForm } from "../checkout-form";

export default async function CommandePage() {
  const organization = await getStorefrontOrganization();
  if (!organization) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-xl font-semibold text-foreground">Passer la commande</h1>
      </header>
      <CheckoutForm devise={organization.devise} />
    </div>
  );
}
