export type OrderConfirmationInput = {
  numero: string;
  totalTtcLabel: string;
  shopNom: string;
};

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
