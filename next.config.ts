import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sortie autonome (Dockerfile) : ne copie que les fichiers/dépendances
  // réellement nécessaires à l'exécution dans .next/standalone, une image
  // Docker bien plus légère qu'avec node_modules complet.
  output: "standalone",
};

export default nextConfig;
