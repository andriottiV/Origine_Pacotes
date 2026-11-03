import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return { id: "/cliente", name: "Origine Pacotes", short_name: "Origine", description: "Seus pacotes e serviços", start_url: "/cliente", scope: "/", display: "standalone", background_color: "#f7f4ee", theme_color: "#c37a65",
    icons: [
      { src: "/icons/origine-192-v1.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/origine-512-v1.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/origine-maskable-192-v1.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/origine-maskable-512-v1.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ] };
}
