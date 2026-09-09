import type { Prisma } from "@prisma/client";

import { shopScope } from "./scope";

export type PersonnelReport = {
  parVendeur: {
    userId: string;
    email: string;
    ca: number;
    tickets: number;
    remises: number;
    annulations: number;
  }[];
};

// "CA par vendeur, remises accordées, annulations" (section 5.7).
export async function getPersonnelReport(
  tx: Prisma.TransactionClient,
  shopId: string | null,
  from: Date,
  to: Date,
): Promise<PersonnelReport> {
  const [validSales, cancelledSales] = await Promise.all([
    tx.sale.findMany({
      where: { ...shopScope(shopId), statut: "VALIDEE", createdAt: { gte: from, lt: to } },
      include: { lines: true },
    }),
    tx.sale.findMany({
      where: { ...shopScope(shopId), statut: "ANNULEE", createdAt: { gte: from, lt: to } },
    }),
  ]);

  const userIds = [...new Set([...validSales, ...cancelledSales].map((s) => s.userId))];
  const users = userIds.length > 0 ? await tx.user.findMany({ where: { id: { in: userIds } } }) : [];
  const emailByUserId = new Map(users.map((u) => [u.id, u.email]));

  const map = new Map<string, { ca: number; tickets: number; remises: number; annulations: number }>();
  function entry(userId: string) {
    if (!map.has(userId)) map.set(userId, { ca: 0, tickets: 0, remises: 0, annulations: 0 });
    return map.get(userId)!;
  }

  for (const sale of validSales) {
    const e = entry(sale.userId);
    e.ca += Number(sale.totalTtc);
    e.tickets += 1;
    e.remises += sale.lines.reduce((sum, l) => sum + Number(l.remise), 0);
  }
  for (const sale of cancelledSales) {
    entry(sale.userId).annulations += 1;
  }

  return {
    parVendeur: [...map.entries()]
      .map(([userId, v]) => ({ userId, email: emailByUserId.get(userId) ?? userId, ...v }))
      .sort((a, b) => b.ca - a.ca),
  };
}
