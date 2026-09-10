import { randomUUID } from "node:crypto";
import { rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { systemPrisma } from "@/lib/db/system-client";

// Certbot (HTTP-01, jamais de wildcard — voir deploy/domain-watcher/) tourne
// sur l'hôte, hors du conteneur Docker de l'app : ce répertoire monté est le
// seul canal entre les deux. sync-certs.sh y réagit et relance
// `certbot --expand` avec la liste complète des boutiques à chaque écriture.
// PENDING_DOMAINS_DIR n'est défini qu'en production (docker-compose.prod.yml)
// — absent en dev local, où cette fonction ne fait donc rien.
const PENDING_DOMAINS_DIR = process.env.PENDING_DOMAINS_DIR;

// Best-effort et jamais bloquant : une inscription ne doit jamais échouer
// à cause d'un problème de certificat TLS, seulement les futures visites du
// sous-domaine seraient affectées (fenêtre couverte par sync-certs.sh, pas
// instantanée dans ce cas mais rattrapée dès l'inscription suivante, la
// liste écrite est toujours complète, jamais incrémentale).
export async function requestCertRefresh(): Promise<void> {
  if (!PENDING_DOMAINS_DIR) return;

  try {
    const organizations = await systemPrisma.organization.findMany({
      select: { slug: true },
      orderBy: { slug: "asc" },
    });
    const content = organizations.map((org) => org.slug).join("\n") + "\n";

    // Écriture atomique (fichier temporaire + rename) : sync-certs.sh ne
    // doit jamais lire un fichier à moitié écrit.
    const tmpPath = path.join(PENDING_DOMAINS_DIR, `.refresh-${randomUUID()}.tmp`);
    const finalPath = path.join(PENDING_DOMAINS_DIR, "refresh.request");
    await writeFile(tmpPath, content, "utf8");
    await rename(tmpPath, finalPath);
  } catch (error) {
    console.error("Échec de la demande de rafraîchissement du certificat TLS", error);
  }
}
