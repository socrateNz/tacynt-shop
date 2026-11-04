export type OrderConfirmationInput = {
  numero: string;
  totalTtcLabel: string;
  shopNom: string;
};

export type NewOnlineOrderInput = {
  numero: string;
  nomClient: string;
  totalTtcLabel: string;
  shopNom: string;
};

export function newOnlineOrderEmail(order: NewOnlineOrderInput): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Nouvelle commande ${order.numero} — ${order.shopNom}`;
  const text = [
    `Nouvelle commande en ligne : ${order.numero} (${order.shopNom}).`,
    `Client : ${order.nomClient}.`,
    `Montant : ${order.totalTtcLabel}.`,
  ].join("\n");
  const html = `
    <p>Nouvelle commande en ligne : <strong>${order.numero}</strong> (${order.shopNom}).</p>
    <p>Client : <strong>${order.nomClient}</strong>.</p>
    <p>Montant : <strong>${order.totalTtcLabel}</strong>.</p>
  `.trim();

  return { subject, html, text };
}

export function orderConfirmationEmail(order: OrderConfirmationInput): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Paiement reçu — commande ${order.numero}`;
  const text = [
    `Votre paiement pour la commande ${order.numero} (${order.shopNom}) a bien été reçu.`,
    `Montant : ${order.totalTtcLabel}.`,
    `Votre commande est confirmée, vous serez contacté(e) pour la suite.`,
  ].join("\n");
  const html = `
    <p>Votre paiement pour la commande <strong>${order.numero}</strong> (${order.shopNom}) a bien été reçu.</p>
    <p>Montant : <strong>${order.totalTtcLabel}</strong>.</p>
    <p>Votre commande est confirmée, vous serez contacté(e) pour la suite.</p>
  `.trim();

  return { subject, html, text };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type MarketplaceVerificationInput = {
  nom: string;
  code: string;
  validiteMinutes: number;
};

// Code de validation d'inscription de l'app mobile Sodu — le nom vient du
// formulaire d'inscription (saisie libre), donc échappé dans le HTML.
export function marketplaceVerificationEmail(input: MarketplaceVerificationInput): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `${input.code} — votre code de validation Sodu`;
  const text = [
    `Bonjour ${input.nom},`,
    `Votre code de validation Sodu : ${input.code}`,
    `Il est valable ${input.validiteMinutes} minutes.`,
    `Si vous n'avez pas créé de compte Sodu, ignorez cet email.`,
  ].join("\n");
  const html = `
    <p>Bonjour ${escapeHtml(input.nom)},</p>
    <p>Votre code de validation Sodu :</p>
    <p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:16px 0;">${input.code}</p>
    <p>Il est valable ${input.validiteMinutes} minutes.</p>
    <p style="color:#6B7280;">Si vous n'avez pas créé de compte Sodu, ignorez cet email.</p>
  `.trim();

  return { subject, html, text };
}
