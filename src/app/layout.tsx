import type { Metadata } from "next";
import "./globals.css";
import ThemeRestore from "../components/theme-restore";
import { editorialFont } from "../lib/fonts";

export const metadata: Metadata = { title: "Origine Pacotes", description: "Gestão simples de pacotes para barbearias", manifest: "/manifest.webmanifest", appleWebApp: { capable: true, title: "Origine", statusBarStyle: "default" }, icons: { icon: { url: "/icon.png?v=origine-v1", sizes: "32x32", type: "image/png" }, apple: { url: "/icons/origine-apple-180-v1.png", sizes: "180x180", type: "image/png" } } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR" data-theme="light" suppressHydrationWarning><body className={editorialFont.variable}><ThemeRestore />{children}</body></html>;
}
