// Plage Unicode des diacritiques combinants (U+0300–U+036F), pour retirer
// les accents après normalize("NFD").
const DIACRITICS_REGEX = new RegExp("[\\u0300-\\u036f]", "g");

export function slugify(input: string): string {
  return (
    input
      .normalize("NFD")
      .replace(DIACRITICS_REGEX, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 40) || "boutique"
  );
}
