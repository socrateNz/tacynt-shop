// Vérifie que les variables d'environnement attendues sont renseignées,
// SANS jamais afficher leurs valeurs (seulement présentes / manquantes /
// encore au placeholder).
//
// En local :      node --env-file=.env scripts/check-env.mjs
// En production : sudo docker exec tacynt-shop-app-prod node -e "$(cat scripts/check-env.mjs)"
//                 (depuis /home/etarcosdev/apps/tacynt-shop — contrôle ce que
//                 le conteneur de l'app voit réellement)
//
// Code de sortie 1 si une variable obligatoire manque.

const REQUIRED = [
  ["DATABASE_URL", "Base de données (rôle propriétaire)"],
  ["RUNTIME_DATABASE_URL", "Base de données (rôle applicatif)"],
  ["APP_ROOT_DOMAIN", "Domaine racine"],
  ["CODEES_API_KEY", "Mobile Money (Codees)"],
  ["CODEES_SECRET_KEY", "Mobile Money (Codees)"],
  ["SMTP_HOST", "Emails (codes de validation, confirmations)"],
  ["SMTP_PORT", "Emails"],
  ["SMTP_USER", "Emails"],
  ["SMTP_PASSWORD", "Emails"],
  ["EMAIL_FROM", "Emails"],
  ["VAPID_PUBLIC_KEY", "Notifications web du personnel"],
  ["VAPID_PRIVATE_KEY", "Notifications web du personnel"],
  ["VAPID_SUBJECT", "Notifications web du personnel"],
];

const OPTIONAL = [
  ["STRIPE_SECRET_KEY", "Carte bancaire — inutile tant que CARTE_ACTIVE = false"],
  ["STRIPE_WEBHOOK_SECRET", "Carte bancaire — inutile tant que CARTE_ACTIVE = false"],
  ["EXPO_ACCESS_TOKEN", "Push Sodu — requis seulement avec la sécurité push renforcée Expo"],
];

const PLACEHOLDERS = new Set(["", "CHANGE_ME", "changeme", "xxx", "TODO"]);

function state(name) {
  const value = process.env[name];
  if (value === undefined) return "absente";
  if (PLACEHOLDERS.has(value.trim())) return value.trim() === "" ? "vide" : "placeholder";
  return "ok";
}

let missing = 0;
const pad = Math.max(...[...REQUIRED, ...OPTIONAL].map(([n]) => n.length)) + 2;

console.log("\nObligatoires");
for (const [name, label] of REQUIRED) {
  const s = state(name);
  if (s !== "ok") missing++;
  console.log(`  ${s === "ok" ? "✔" : "✘"} ${name.padEnd(pad)}${s === "ok" ? "" : `(${s}) `}— ${label}`);
}

console.log("\nFacultatives");
for (const [name, label] of OPTIONAL) {
  const s = state(name);
  console.log(`  ${s === "ok" ? "✔" : "·"} ${name.padEnd(pad)}${s === "ok" ? "" : `(${s}) `}— ${label}`);
}

console.log(
  missing === 0
    ? "\nToutes les variables obligatoires sont renseignées.\n"
    : `\n${missing} variable(s) obligatoire(s) à compléter.\n`,
);
process.exit(missing === 0 ? 0 : 1);
