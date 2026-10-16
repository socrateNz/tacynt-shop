import nodemailer, { type Transporter } from "nodemailer";

const globalForMailer = globalThis as unknown as {
  mailTransporter?: Transporter;
};

// Même patron de cache globalThis que lib/db/system-client.ts — un seul
// transporteur SMTP par processus, pas une connexion par envoi.
export function getMailTransporter(): Transporter {
  if (globalForMailer.mailTransporter) {
    return globalForMailer.mailTransporter;
  }

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  if (!host || !user || !pass) {
    throw new Error("SMTP_HOST / SMTP_USER / SMTP_PASSWORD manquants — configuration incomplète.");
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  if (process.env.NODE_ENV !== "production") {
    globalForMailer.mailTransporter = transporter;
  }

  return transporter;
}
