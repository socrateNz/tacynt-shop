import { notFound } from "next/navigation";

import { getStorefrontOrganization } from "@/lib/storefront/context";

import { StorefrontBreadcrumb } from "../../storefront-breadcrumb";
import { CheckoutForm } from "./checkout-form";

export default async function CommandePage() {
  const organization = await getStorefrontOrganization();
  if (!organization) {
    notFound();
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <StorefrontBreadcrumb items={[{ label: "Panier", href: "/panier" }, { label: "Commande" }]} />
      <header>
        <h1 className="text-xl font-semibold text-foreground">Passer la commande</h1>
      </header>
      <CheckoutForm devise={organization.devise} />
    </div>
  );
}
