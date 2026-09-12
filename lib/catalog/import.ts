import * as XLSX from "xlsx";

export type ImportRow = {
  ligne: number;
  designation: string;
  categorie: string | null;
  codeBarres: string | null;
  prixAchat: number;
  prixVente: number;
  quantiteInitiale: number;
  unite: string;
  tauxTaxe: number;
  suiviStock: boolean;
  errors: string[];
};

type MappedKey = Exclude<keyof ImportRow, "ligne" | "errors">;

const COLUMN_KEYS: Record<string, MappedKey> = {
  designation: "designation",
  categorie: "categorie",
  codebarres: "codeBarres",
  prixachat: "prixAchat",
  prixvente: "prixVente",
  quantiteinitiale: "quantiteInitiale",
  unite: "unite",
  tauxtaxe: "tauxTaxe",
  suivistock: "suiviStock",
};

// NFD décompose "é" en "e" + accent combinant séparé ; [^a-z0-9] exclut cet
// accent (hors plage ASCII) tout comme les espaces/tirets/ponctuation — un
// seul passage suffit, pas besoin de cibler la plage Unicode des accents.
function normalizeHeader(header: string): string {
  return header
    .normalize("NFD")
    .replace(/[^a-z0-9]/gi, "")
    .toLowerCase();
}

function toNumberOrNull(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  return typeof value === "number" ? value : Number(String(value).trim().replace(",", "."));
}

function toBoolean(value: unknown, fallback: boolean): boolean {
  const s = String(value ?? "").trim().toLowerCase();
  if (!s) return fallback;
  return ["oui", "yes", "true", "1", "vrai"].includes(s);
}

// Parse le classeur en lignes typées. Ne valide pas encore les doublons (ils
// dépendent de l'état courant de la base) — voir revalidateRows.
export function parseWorkbook(buffer: Buffer): ImportRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];

  const rawRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    defval: "",
  });

  return rawRows.map((raw, index) => {
    const mapped: Partial<Record<MappedKey, unknown>> = {};
    for (const [header, value] of Object.entries(raw)) {
      const key = COLUMN_KEYS[normalizeHeader(header)];
      if (key) mapped[key] = value;
    }

    return {
      ligne: index + 2, // +1 pour l'en-tête, +1 pour l'index 0-based
      designation: String(mapped.designation ?? "").trim(),
      categorie: String(mapped.categorie ?? "").trim() || null,
      codeBarres: String(mapped.codeBarres ?? "").trim() || null,
      prixAchat: toNumberOrNull(mapped.prixAchat) ?? 0,
      prixVente: toNumberOrNull(mapped.prixVente) ?? NaN,
      quantiteInitiale: toNumberOrNull(mapped.quantiteInitiale) ?? 0,
      unite: String(mapped.unite ?? "").trim() || "piece",
      tauxTaxe: toNumberOrNull(mapped.tauxTaxe) ?? 0,
      suiviStock: toBoolean(mapped.suiviStock, true),
      errors: [],
    };
  });
}

function checkFieldInvariants(row: ImportRow): string[] {
  const errors: string[] = [];
  if (!row.designation) errors.push("Désignation manquante.");
  if (!Number.isFinite(row.prixVente) || row.prixVente <= 0) {
    errors.push("Prix de vente manquant ou invalide.");
  }
  if (!Number.isFinite(row.prixAchat) || row.prixAchat < 0) {
    errors.push("Prix d'achat invalide.");
  }
  if (!Number.isFinite(row.quantiteInitiale) || row.quantiteInitiale < 0) {
    errors.push("Quantité initiale invalide.");
  }
  if (!Number.isFinite(row.tauxTaxe) || row.tauxTaxe < 0 || row.tauxTaxe > 100) {
    errors.push("Taux de taxe invalide (0 à 100).");
  }
  return errors;
}

// Rejoue la validation complète (champs + doublons intra-fichier + doublons
// base) contre l'état courant de la base. Appelée à la fois à la
// prévisualisation et juste avant le commit : entre les deux, un autre
// produit a pu être créé avec le même code-barres — on ne fait jamais
// confiance à un état validé qui peut être devenu obsolète. La référence
// n'est jamais lue dans le fichier — toujours générée à la volée au commit
// (même patron que la création manuelle, lib/catalog/import n'a donc rien à
// valider dessus).
export function revalidateRows(rows: ImportRow[], existingBarcodes: Set<string>): void {
  const seenBarcode = new Map<string, number>();

  for (const row of rows) {
    row.errors = checkFieldInvariants(row);

    const barcodeKey = row.codeBarres?.toLowerCase() ?? null;
    if (barcodeKey) {
      if (existingBarcodes.has(barcodeKey)) {
        row.errors.push("Code-barres déjà utilisé dans le catalogue.");
      } else if (seenBarcode.has(barcodeKey)) {
        row.errors.push(`Code-barres en double avec la ligne ${seenBarcode.get(barcodeKey)}.`);
      } else {
        seenBarcode.set(barcodeKey, row.ligne);
      }
    }
  }
}
