"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ImportRow = {
  ligne: number;
  reference: string;
  designation: string;
  categorie: string | null;
  codeBarres: string | null;
  prixAchat: number;
  prixVente: number;
  quantiteInitiale: number;
  errors: string[];
};

type PreviewResult = {
  batchId: string;
  rows: ImportRow[];
  validCount: number;
  errorCount: number;
};

type CommitResult = {
  created: number;
  skipped: { ligne: number; reference: string; motif: string }[];
};

export function ImportClient() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);

  async function handleAnalyze() {
    if (!file) return;
    setError(null);
    setCommitResult(null);
    setIsAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/catalog/import/preview", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Échec de l'analyse du fichier.");
        setPreview(null);
        return;
      }
      setPreview(data as PreviewResult);
    } catch {
      setError("Échec de l'analyse du fichier.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleCommit() {
    if (!preview) return;
    setError(null);
    setIsCommitting(true);
    try {
      const res = await fetch(`/api/catalog/import/${preview.batchId}/commit`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Échec de la validation de l'import.");
        return;
      }
      setCommitResult(data as CommitResult);
    } catch {
      setError("Échec de la validation de l'import.");
    } finally {
      setIsCommitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6">
        <h2 className="text-sm font-medium text-foreground">Fichier catalogue</h2>
        <p className="text-sm text-muted-foreground">
          Colonnes attendues : reference, designation, categorie (optionnel), codeBarres
          (optionnel), prixAchat, prixVente, quantiteInitiale (optionnel), unite (optionnel),
          tauxTaxe (optionnel), suiviStock (oui/non, optionnel).
        </p>
        <input
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setPreview(null);
            setCommitResult(null);
            setError(null);
          }}
          className="text-sm text-foreground"
        />
        <Button
          type="button"
          className="self-start"
          disabled={!file || isAnalyzing}
          onClick={handleAnalyze}
        >
          {isAnalyzing ? "Analyse..." : "Analyser le fichier"}
        </Button>
      </div>

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {preview && !commitResult && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            {preview.validCount} ligne{preview.validCount > 1 ? "s" : ""} valide
            {preview.validCount > 1 ? "s" : ""}
            {preview.errorCount > 0 &&
              `, ${preview.errorCount} ligne${preview.errorCount > 1 ? "s" : ""} en erreur (ignorée${preview.errorCount > 1 ? "s" : ""} à l'import).`}
          </p>

          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ligne</TableHead>
                  <TableHead>Référence</TableHead>
                  <TableHead>Désignation</TableHead>
                  <TableHead className="text-right">Prix vente</TableHead>
                  <TableHead>Erreurs</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.rows.map((row) => (
                  <TableRow key={row.ligne} className={row.errors.length > 0 ? "bg-destructive/5" : ""}>
                    <TableCell className="num text-muted-foreground">{row.ligne}</TableCell>
                    <TableCell className="text-foreground">{row.reference}</TableCell>
                    <TableCell className="text-foreground">{row.designation}</TableCell>
                    <TableCell className="num text-right">{row.prixVente}</TableCell>
                    <TableCell className="text-sm text-destructive">
                      {row.errors.join(" ")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <Button
            type="button"
            className="self-start"
            disabled={preview.validCount === 0 || isCommitting}
            onClick={handleCommit}
          >
            {isCommitting ? "Import..." : `Confirmer l'import (${preview.validCount})`}
          </Button>
        </div>
      )}

      {commitResult && (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-6">
          <p className="text-sm text-foreground">
            {commitResult.created} produit{commitResult.created > 1 ? "s" : ""} créé
            {commitResult.created > 1 ? "s" : ""}.
          </p>
          {commitResult.skipped.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-sm text-muted-foreground">Lignes ignorées :</p>
              <ul className="list-inside list-disc text-sm text-muted-foreground">
                {commitResult.skipped.map((s) => (
                  <li key={s.ligne}>
                    Ligne {s.ligne} ({s.reference || "—"}) : {s.motif}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
