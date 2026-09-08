import { NextResponse } from "next/server";
import type { PaymentMode } from "@prisma/client";

import { recordAuditLog } from "@/lib/audit";
import { withTenantContext } from "@/lib/db/tenant-context";
import { systemPrisma } from "@/lib/db/system-client";
import { assertCapability, hasCapability } from "@/lib/permissions";
import { getActiveShopId } from "@/lib/tenant/active-shop";
import { getTenantContext } from "@/lib/tenant/context";
import { parseOrgSettings } from "@/lib/tenant/settings";

const PAYMENT_MODES = new Set(["ESPECES", "MOBILE_MONEY", "CARTE", "VIREMENT", "ARDOISE", "BON_ACHAT"]);
const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

// Route Handler plutôt que Server Action : un justificatif photo dépasse
// facilement le plafond de 1 Mo des Server Actions (même raison que
// l'import catalogue, section M12).
export async function POST(request: Request) {
  const ctx = await getTenantContext();
  assertCapability(ctx.role, "expenses:manage");

  const formData = await request.formData();
  const categorie = String(formData.get("categorie") ?? "").trim();
  const montant = Number(formData.get("montant") ?? NaN);
  const modePaiement = String(formData.get("modePaiement") ?? "");
  const file = formData.get("justificatif");

  if (!categorie || !Number.isFinite(montant) || montant <= 0 || !PAYMENT_MODES.has(modePaiement)) {
    return NextResponse.json(
      { error: "Catégorie, montant (positif) et mode de paiement (valide) sont requis." },
      { status: 400 },
    );
  }

  let justificatifData: Uint8Array<ArrayBuffer> | null = null;
  let justificatifMimeType: string | null = null;
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_ATTACHMENT_BYTES) {
      return NextResponse.json({ error: "Justificatif trop volumineux (5 Mo max)." }, { status: 400 });
    }
    justificatifData = new Uint8Array(await file.arrayBuffer());
    justificatifMimeType = file.type || "application/octet-stream";
  }

  const shopId = await getActiveShopId(ctx.organizationId, ctx.userId);
  const organization = await systemPrisma.organization.findUniqueOrThrow({
    where: { id: ctx.organizationId },
  });
  const threshold = parseOrgSettings(organization.settings).expenseApprovalThreshold ?? 0;

  const expense = await withTenantContext(
    { organizationId: ctx.organizationId, shopId },
    async (tx) => {
      // Une dépense en espèces s'impute sur la session de caisse ouverte au
      // moment de la saisie (pour compter dans le rapprochement à la
      // fermeture) ; sans session ouverte, elle reste simplement hors
      // rapprochement — cohérent, l'argent n'est pas sorti d'un tiroir fermé.
      let cashSessionId: string | null = null;
      if (modePaiement === "ESPECES") {
        const openSession = await tx.cashSession.findFirst({
          where: { shopId, closedAt: null },
          orderBy: { openedAt: "desc" },
        });
        cashSessionId = openSession?.id ?? null;
      }

      const autoApproved = hasCapability(ctx.role, "expenses:approve") || montant <= threshold;

      const expense = await tx.expense.create({
        data: {
          organizationId: ctx.organizationId,
          shopId,
          categorie,
          montant,
          modePaiement: modePaiement as PaymentMode,
          cashSessionId,
          statut: autoApproved ? "VALIDEE" : "EN_ATTENTE",
          justificatifData,
          justificatifMimeType,
          userId: ctx.userId,
          approvedByUserId: autoApproved ? ctx.userId : null,
          approvedAt: autoApproved ? new Date() : null,
        },
      });

      await recordAuditLog(tx, {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        action: "EXPENSE_CREATED",
        entite: "expense",
        entiteId: expense.id,
        apres: { categorie, montant, modePaiement, statut: expense.statut },
      });

      return expense;
    },
  );

  return NextResponse.json({ id: expense.id, statut: expense.statut });
}
