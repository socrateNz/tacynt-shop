import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tacynt Shop",
    short_name: "Tacynt Shop",
    description: "SaaS de gestion de boutique — encaisse même hors ligne.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f7fb",
    theme_color: "#6d4aff",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
