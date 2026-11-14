import { systemPrisma } from "@/lib/db/system-client";
import { organizationHasModule } from "@/lib/tenant/modules";

// Deux axes distincts, comme pour les autres modules : la capacité du rôle
// (vérifiée par l'appelant) ET le module payé par l'organisation.
export async function assertVehiclesAllowed(organizationId: string) {
  const organization = await systemPrisma.organization.findUniqueOrThrow({ where: { id: organizationId } });
  if (!organizationHasModule(organization.enabledModules, "location_vehicules")) {
    throw new Error("Le module Location de véhicules n'est pas activé pour cette organisation.");
  }
  return organization;
}
