import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

import { IMPORT_TEMPLATE_HEADERS } from "@/lib/catalog/import";
import { assertCapability } from "@/lib/permissions-server";
import { getTenantContext } from "@/lib/tenant/context";

const EXAMPLE_ROW = [
  "Savon de Marseille 200 g",
  "Hygiène",
  "",
  800,
  1200,
  50,
  "piece",
  0,
  "oui",
];

export async function GET() {
  const ctx = await getTenantContext();
  await assertCapability(ctx.role, "catalog:import");

  const sheet = XLSX.utils.aoa_to_sheet([[...IMPORT_TEMPLATE_HEADERS], EXAMPLE_ROW]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Catalogue");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="modele-import-catalogue.xlsx"',
    },
  });
}
