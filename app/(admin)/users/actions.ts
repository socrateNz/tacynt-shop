"use server";

import { revalidatePath } from "next/cache";

import { recordAuditLog } from "@/lib/audit";
import { hashPassword } from "@/lib/auth/password";
import { withTenantContext } from "@/lib/db/tenant-context";
import { assertCapability, type Role } from "@/lib/permissions";
import { assertWithinQuota, QuotaExceededError } from "@/lib/quotas";
import { getActiveShopId } from "@/lib/tenant/active-shop";
import { getTenantContext } from "@/lib/tenant/context";

export type UserFormState = { error: string | null };

// Le Propriétaire est un rôle fondateur unique attribué à l'inscription
// (section 5.8) : pas de création d'un second Propriétaire depuis cet écran.
const ASSIGNABLE_ROLES: Role[] = ["GERANT", "RESPONSABLE_STOCK", "VENDEUR", "COMPTABLE"];

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

export async function createUser(
  _prevState: UserFormState,
  formData: FormData,
): Promise<UserFormState> {
  const ctx = await getTenantContext();
  assertCapability(ctx.role, "users:manage");

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "") as Role;

  if (!email || password.length < 8 || !ASSIGNABLE_ROLES.includes(role)) {
    return {
      error: "Email, mot de passe (8 caractères minimum) et rôle valides sont requis.",
    };
  }

  const shopId = await getActiveShopId(ctx.organizationId, ctx.userId);
  const hash = await hashPassword(password);

  try {
    await withTenantContext({ organizationId: ctx.organizationId, shopId }, async (tx) => {
      const organization = await tx.organization.findUniqueOrThrow({
        where: { id: ctx.organizationId },
      });
      await assertWithinQuota(tx, ctx.organizationId, organization.plan, "users");

      const user = await tx.user.create({
        data: { organizationId: ctx.organizationId, email, hash, role },
      });

      await tx.userShop.create({
        data: { organizationId: ctx.organizationId, userId: user.id, shopId },
      });

      await recordAuditLog(tx, {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        action: "USER_CREATED",
        entite: "user",
        entiteId: user.id,
        apres: { email, role },
      });
    });
  } catch (error) {
    if (error instanceof QuotaExceededError) {
      return { error: error.message };
    }
    if (isUniqueViolation(error)) {
      return { error: "Un utilisateur avec cet email existe déjà." };
    }
    throw error;
  }

  revalidatePath("/users");
  return { error: null };
}
