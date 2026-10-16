import { getMailTransporter } from "./client";

export type MailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export async function sendMail(input: MailInput): Promise<void> {
  const from = process.env.EMAIL_FROM;
  if (!from) {
    throw new Error("EMAIL_FROM manquant — configuration incomplète.");
  }

  await getMailTransporter().sendMail({
    from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });
}
