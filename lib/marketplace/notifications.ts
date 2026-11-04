import { marketplacePrisma } from "@/lib/db/marketplace-client";
import { systemPrisma } from "@/lib/db/system-client";

// Notifications push vers l'app mobile Sodu, via le service Expo Push
// (https://docs.expo.dev/push-notifications/sending-notifications/).
// Toutes les fonctions publiques sont "fire and forget" : elles ne lèvent
// JAMAIS (une panne Expo ne doit pas faire échouer la confirmation d'une
// commande par le personnel) et ne concernent que les commandes/demandes
// passées depuis l'app (marketplaceCustomerId renseigné).
const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const CHUNK = 100;

type PushMessage = {
  title: string;
  body: string;
  // Lu par l'app au toucher de la notification (écran à ouvrir).
  data: { url: string; [key: string]: string };
};

type ExpoTicket = { status: "ok" | "error"; details?: { error?: string } };

async function sendToCustomer(customerId: string, message: PushMessage): Promise<void> {
  const tokens = await marketplacePrisma.marketplacePushToken.findMany({
    where: { marketplaceCustomerId: customerId, disabledAt: null },
    select: { token: true },
  });
  if (tokens.length === 0) return;

  const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
  if (process.env.EXPO_ACCESS_TOKEN) headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;

  for (let i = 0; i < tokens.length; i += CHUNK) {
    const batch = tokens.slice(i, i + CHUNK);
    const res = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(
        batch.map((t) => ({ to: t.token, sound: "default", title: message.title, body: message.body, data: message.data })),
      ),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error("Expo Push a refusé l'envoi :", res.status, await res.text().catch(() => ""));
      continue;
    }
    const payload = (await res.json().catch(() => null)) as { data?: ExpoTicket[] } | null;
    // Jeton désinstallé / révoqué : on arrête d'y envoyer (jamais supprimé).
    const dead = (payload?.data ?? [])
      .map((ticket, idx) => (ticket.details?.error === "DeviceNotRegistered" ? batch[idx]?.token : null))
      .filter((t): t is string => Boolean(t));
    if (dead.length > 0) {
      await marketplacePrisma.marketplacePushToken.updateMany({
        where: { token: { in: dead } },
        data: { disabledAt: new Date() },
      });
    }
  }
}

async function safely(label: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (error) {
    console.error(`Notification push Sodu (${label}) non envoyée :`, error);
  }
}

// Lecture cross-organisation par construction (le client Sodu commande
// partout) — systemPrisma, limitée à la commande visée.
async function loadOrder(orderId: string) {
  return systemPrisma.onlineOrder.findUnique({
    where: { id: orderId },
    select: {
      numero: true,
      statut: true,
      modeRetrait: true,
      marketplaceCustomerId: true,
      organization: { select: { nom: true } },
    },
  });
}

export function notifyOrderStatus(orderId: string): Promise<void> {
  return safely("statut commande", async () => {
    const order = await loadOrder(orderId);
    if (!order?.marketplaceCustomerId) return;
    const shop = order.organization.nom;
    const livraison = order.modeRetrait === "LIVRAISON";
    const messages: Partial<Record<typeof order.statut, { title: string; body: string }>> = {
      CONFIRMEE: { title: "Commande confirmée", body: `${shop} a confirmé votre commande ${order.numero}.` },
      PRETE: {
        title: livraison ? "Commande en livraison" : "Commande prête",
        body: livraison
          ? `Votre commande ${order.numero} chez ${shop} est en route.`
          : `Votre commande ${order.numero} est prête à être retirée chez ${shop}.`,
      },
      RECUPEREE: {
        title: livraison ? "Commande livrée" : "Commande récupérée",
        body: `Merci ! Votre commande ${order.numero} chez ${shop} est terminée.`,
      },
      ANNULEE: { title: "Commande annulée", body: `Votre commande ${order.numero} chez ${shop} a été annulée.` },
    };
    const msg = messages[order.statut];
    if (!msg) return;
    await sendToCustomer(order.marketplaceCustomerId, { ...msg, data: { url: "/commandes" } });
  });
}

export function notifyOrderPaid(orderId: string): Promise<void> {
  return safely("paiement commande", async () => {
    const order = await loadOrder(orderId);
    if (!order?.marketplaceCustomerId) return;
    await sendToCustomer(order.marketplaceCustomerId, {
      title: "Paiement reçu",
      body: `Votre paiement pour la commande ${order.numero} chez ${order.organization.nom} est confirmé.`,
      data: { url: "/commandes" },
    });
  });
}

export function notifyRentalRequestStatus(contractId: string): Promise<void> {
  return safely("statut réservation", async () => {
    const contract = await systemPrisma.rentalContract.findUnique({
      where: { id: contractId },
      select: {
        numero: true,
        statut: true,
        marketplaceCustomerId: true,
        organization: { select: { nom: true } },
        rentalUnit: { select: { designation: true } },
      },
    });
    if (!contract?.marketplaceCustomerId) return;
    const unit = contract.rentalUnit.designation;
    const messages: Partial<Record<typeof contract.statut, { title: string; body: string }>> = {
      CONFIRMEE: {
        title: "Réservation acceptée",
        body: `${contract.organization.nom} a accepté votre demande pour « ${unit} ».`,
      },
      ANNULEE: {
        title: "Demande de réservation refusée",
        body: `Votre demande ${contract.numero} pour « ${unit} » n'a pas pu être acceptée.`,
      },
    };
    const msg = messages[contract.statut];
    if (!msg) return;
    await sendToCustomer(contract.marketplaceCustomerId, { ...msg, data: { url: "/reservations" } });
  });
}
