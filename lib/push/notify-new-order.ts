import webpush from "web-push";

import { withTenantContext } from "@/lib/db/tenant-context";
import { hasCapability } from "@/lib/permissions";

let vapidConfigured = false;

function ensureVapidConfigured(): boolean {
  if (vapidConfigured) return true;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

// Déclenché après coup (jamais depuis l'intérieur de la transaction qui crée
// la commande, jamais attendu par l'appelant — voir app/api/storefront/
// orders/route.ts) : une panne du service de push ne doit jamais faire
// échouer la création d'une commande vitrine, route publique non
// authentifiée. Chaque erreur est capturée ici, jamais propagée.
export async function notifyNewOnlineOrder(params: {
  organizationId: string;
  shopId: string;
  numero: string;
  nomClient: string;
  totalTtcLabel: string;
}): Promise<void> {
  try {
    if (!ensureVapidConfigured()) return;

    await withTenantContext({ organizationId: params.organizationId }, async (tx) => {
      const assignments = await tx.userShop.findMany({
        where: { shopId: params.shopId },
        include: { user: true },
      });
      const eligibleUserIds = [
        ...new Set(
          assignments
            .filter((a) => hasCapability(a.user.role, "ecommerce:manage"))
            .map((a) => a.userId),
        ),
      ];
      if (eligibleUserIds.length === 0) return;

      const subscriptions = await tx.pushSubscription.findMany({
        where: { userId: { in: eligibleUserIds }, actif: true },
      });

      const payload = JSON.stringify({
        title: "Nouvelle commande",
        body: `${params.numero} — ${params.nomClient} — ${params.totalTtcLabel}`,
        url: "/online-orders",
      });

      await Promise.all(
        subscriptions.map(async (sub) => {
          try {
            await webpush.sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              payload,
            );
          } catch (error) {
            // 404/410 : abonnement expiré côté navigateur — désactivé,
            // jamais supprimé (règle du projet, voir rls-manifest.sql).
            const statusCode = (error as { statusCode?: number }).statusCode;
            if (statusCode === 404 || statusCode === 410) {
              await tx.pushSubscription.update({
                where: { id: sub.id },
                data: { actif: false },
              });
            }
          }
        }),
      );
    });
  } catch {
    // Jamais bloquant pour la commande qui a déclenché cet envoi.
  }
}
