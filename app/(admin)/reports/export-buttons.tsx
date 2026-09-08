"use client";

import { Button } from "@/components/ui/button";

export type ExportColumn = { key: string; label: string };

function toCell(value: unknown): string | number {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return value;
  return String(value);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function csvEscape(value: string | number): string {
  const s = String(value);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function ExportButtons({
  rows,
  columns,
  filename,
}: {
  rows: Record<string, unknown>[];
  columns: ExportColumn[];
  filename: string;
}) {
  function exportCsv() {
    const header = columns.map((c) => csvEscape(c.label)).join(";");
    const lines = rows.map((row) =>
      columns.map((c) => csvEscape(toCell(row[c.key]))).join(";"),
    );
    const csv = [header, ...lines].join("\n");
    // BOM UTF-8 explicite : Excel ouvre sinon les accents comme du latin-1.
    downloadBlob(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }), `${filename}.csv`);
  }

  async function exportExcel() {
    const XLSX = await import("xlsx");
    const data = rows.map((row) => {
      const record: Record<string, string | number> = {};
      for (const c of columns) record[c.label] = toCell(row[c.key]);
      return record;
    });
    const sheet = XLSX.utils.json_to_sheet(data, { header: columns.map((c) => c.label) });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Rapport");
    const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
    downloadBlob(
      new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
      `${filename}.xlsx`,
    );
  }

  return (
    <div className="no-print flex gap-2">
      <Button type="button" variant="outline" size="sm" onClick={exportCsv}>
        Export CSV
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={exportExcel}>
        Export Excel
      </Button>
      <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
        Export PDF
      </Button>
    </div>
  );
}
