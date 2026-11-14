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

export function notifyVehicleBookingStatus(bookingId: string): Promise<void> {
  return safely("statut réservation véhicule", async () => {
    const booking = await systemPrisma.vehicleBooking.findUnique({
      where: { id: bookingId },
      select: {
        numero: true,
        statut: true,
        marketplaceCustomerId: true,
        organization: { select: { nom: true } },
        vehicle: { select: { marque: true, modele: true } },
      },
    });
    if (!booking?.marketplaceCustomerId) return;
    const vehicule = `${booking.vehicle.marque} ${booking.vehicle.modele}`;
    const messages: Partial<Record<typeof booking.statut, { title: string; body: string }>> = {
      CONFIRMEE: {
        title: "Réservation acceptée",
        body: `${booking.organization.nom} a accepté votre réservation ${booking.numero} (${vehicule}).`,
      },
      ANNULEE: {
        title: "Réservation annulée",
        body: `Votre réservation ${booking.numero} (${vehicule}) n'a pas pu être maintenue.`,
      },
      TERMINEE: {
        title: "Location terminée",
        body: `Merci ! Le retour du véhicule (${vehicule}) est enregistré.`,
      },
    };
    const msg = messages[booking.statut];
    if (!msg) return;
    await sendToCustomer(booking.marketplaceCustomerId, { ...msg, data: { url: "/reservations" } });
  });
}

// ---------------------------------------------------------------------------
// Blanchisserie — mêmes règles : client Sodu uniquement, jamais bloquant.
// Les commandes de blanchisserie apparaissent dans "Mes commandes" de l'app.
// ---------------------------------------------------------------------------

async function loadLaundryOrder(orderId: string) {
  return systemPrisma.laundryOrder.findUnique({
    where: { id: orderId },
    select: {
      numero: true,
      statut: true,
      modeAller: true,
      modeRetour: true,
      regularisation: true,
      marketplaceCustomerId: true,
      organization: { select: { nom: true, devise: true } },
    },
  });
}

function formatAmount(amount: number, devise: string): string {
  const grouped = String(Math.round(Math.abs(amount))).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${grouped} ${devise === "XAF" || devise === "XOF" ? "FCFA" : devise}`;
}

export function notifyLaundryStatus(orderId: string): Promise<void> {
  return safely("statut blanchisserie", async () => {
    const order = await loadLaundryOrder(orderId);
    if (!order?.marketplaceCustomerId) return;
    const shop = order.organization.nom;
    const n = order.numero;
    const messages: Partial<Record<typeof order.statut, { title: string; body: string }>> = {
      CONFIRMEE: {
        title: "Commande de blanchisserie confirmée",
        body:
          order.modeAller === "COLLECTE_DOMICILE"
            ? `${shop} a confirmé votre commande ${n} et vous contactera pour la collecte.`
            : `${shop} a confirmé votre commande ${n}. Vous pouvez déposer votre linge.`,
      },
      COLLECTEE: { title: "Linge reçu", body: `${shop} a bien reçu votre linge (commande ${n}).` },
      EN_LAVAGE: { title: "Linge en lavage", body: `Votre linge (commande ${n}) est en cours de lavage.` },
      PRETE: {
        title: "Linge prêt",
        body:
          order.modeRetour === "LIVRAISON"
            ? `Votre linge (commande ${n}) est prêt : ${shop} vous contacte pour la livraison.`
            : `Votre linge (commande ${n}) est prêt à être récupéré chez ${shop}.`,
      },
      TERMINEE: { title: "Commande terminée", body: `Merci ! Votre commande de blanchisserie ${n} chez ${shop} est terminée.` },
      ANNULEE: { title: "Commande annulée", body: `Votre commande de blanchisserie ${n} chez ${shop} a été annulée.` },
    };
    const msg = messages[order.statut];
    if (!msg) return;
    await sendToCustomer(order.marketplaceCustomerId, { ...msg, data: { url: "/commandes" } });
  });
}

// Recomptage qui change le montant : le client est prévenu de la
// régularisation à faire au retour.
export function notifyLaundryRecount(orderId: string): Promise<void> {
  return safely("recomptage blanchisserie", async () => {
    const order = await loadLaundryOrder(orderId);
    if (!order?.marketplaceCustomerId || order.regularisation === null) return;
    const regul = Number(order.regularisation);
    if (regul === 0) return;
    const montant = formatAmount(regul, order.organization.devise);
    await sendToCustomer(order.marketplaceCustomerId, {
      title: "Recomptage de votre linge",
      body:
        regul > 0
          ? `Le nombre de pièces reçues diffère de votre commande ${order.numero} : ${montant} restent à régler au retour.`
          : `Le nombre de pièces reçues diffère de votre commande ${order.numero} : ${montant} vous seront rendus au retour.`,
      data: { url: "/commandes" },
    });
  });
}

export function notifyLaundryPaid(orderId: string): Promise<void> {
  return safely("paiement blanchisserie", async () => {
    const order = await loadLaundryOrder(orderId);
    if (!order?.marketplaceCustomerId) return;
    await sendToCustomer(order.marketplaceCustomerId, {
      title: "Paiement reçu",
      body: `Votre paiement pour la commande de blanchisserie ${order.numero} chez ${order.organization.nom} est confirmé.`,
      data: { url: "/commandes" },
    });
  });
}
