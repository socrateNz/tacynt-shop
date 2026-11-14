"use client";

import { useState, type KeyboardEvent } from "react";
import { Plus, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { MAX_TAG_LENGTH, MAX_VEHICLE_TAGS, normalizeTags } from "@/lib/vehicles/types";

/**
 * Saisie libre d'étiquettes ("Climatisé", "7 places"…). Entrée ou virgule
 * valide une étiquette ; celles déjà utilisées sur d'autres véhicules sont
 * proposées en un clic pour éviter les doublons d'orthographe. Soumis sous
 * forme de champs cachés `tags`.
 */
export function TagInput({
  id,
  defaultValue = [],
  suggestions = [],
}: {
  id: string;
  defaultValue?: string[];
  suggestions?: string[];
}) {
  const [tags, setTags] = useState<string[]>(defaultValue);
  const [draft, setDraft] = useState("");

  const full = tags.length >= MAX_VEHICLE_TAGS;
  const used = new Set(tags.map((t) => t.toLowerCase()));
  const available = suggestions.filter((s) => !used.has(s.toLowerCase()));

  function add(raw: string) {
    setTags((prev) => normalizeTags([...prev, ...raw.split(",")]));
    setDraft("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      // Entrée ne doit pas soumettre le formulaire du véhicule.
      e.preventDefault();
      if (draft.trim()) add(draft);
    } else if (e.key === "Backspace" && !draft && tags.length > 0) {
      setTags((prev) => prev.slice(0, -1));
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {tags.map((tag) => (
        <input key={tag} type="hidden" name="tags" value={tag} />
      ))}

      {tags.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <li
              key={tag}
              className="flex items-center gap-1 rounded-md bg-primary/10 py-0.5 pr-1 pl-2 text-xs font-medium text-primary"
            >
              {tag}
              <button
                type="button"
                onClick={() => setTags((prev) => prev.filter((t) => t !== tag))}
                className="flex size-4 items-center justify-center rounded hover:bg-primary/20"
                aria-label={`Retirer ${tag}`}
              >
                <X className="size-3" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => draft.trim() && add(draft)}
        maxLength={MAX_TAG_LENGTH}
        disabled={full}
        placeholder={full ? `${MAX_VEHICLE_TAGS} étiquettes maximum` : "Ex. Climatisé, puis Entrée"}
      />

      {available.length > 0 && !full && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Déjà utilisées :</span>
          {available.slice(0, 12).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => add(s)}
              className="flex items-center gap-0.5 rounded-md border border-border px-1.5 py-0.5 text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground"
            >
              <Plus className="size-3" aria-hidden />
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
