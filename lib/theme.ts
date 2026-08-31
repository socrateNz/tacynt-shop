export const THEME_STORAGE_KEY = "tacynt-theme";

export type Theme = "light" | "dark";

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
