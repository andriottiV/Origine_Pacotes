import type { MetadataRoute } from "next";
export default function manifest(): MetadataRoute.Manifest {
  return { id: "/cliente", name: "Origine Pacotes", short_name: "Origine", description: "Seus pacotes e serviços", start_url: "/cliente", scope: "/", display: "standalone", background_color: "#FAF7F2", theme_color: "#D94F35",
    icons: [{ src: "/icons/push-192.png", sizes: "192x192", type: "image/png" }, { src: "/icons/push-512.png", sizes: "512x512", type: "image/png", purpose: "any" }] };
}
