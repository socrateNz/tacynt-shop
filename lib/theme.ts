export const THEME_STORAGE_KEY = "tacynt-theme";

export type Theme = "light" | "dark";

// Préférence de l'utilisateur. "system" (défaut, rien d'enregistré) = suit
// le thème de la machine, y compris quand il change pendant la session.
export type ThemePreference = "system" | Theme;

export const THEME_CHANGE_EVENT = "tacynt-theme-change";

// Injecté avant hydratation dans app/layout.tsx : pose la classe light/dark
// sur <html> sans flash, sans passer par un état React.
export const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem("${THEME_STORAGE_KEY}");
    var theme = stored === "light" || stored === "dark"
      ? stored
      : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.classList.add(theme);
  } catch (e) {}
})();
`;

export function readThemePreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

function systemTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

// Applique la préférence actuelle sur <html> (classe light/dark).
export function applyThemePreference(preference: ThemePreference = readThemePreference()): void {
  const theme = preference === "system" ? systemTheme() : preference;
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);
}

// Enregistre la préférence ("system" = plus rien d'enregistré), l'applique
// et prévient les composants abonnés (bouton de thème).
export function setThemePreference(preference: ThemePreference): void {
  try {
    if (preference === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Stockage indisponible (navigation privée stricte) : appliqué pour la
    // page en cours seulement.
  }
  applyThemePreference(preference);
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}
