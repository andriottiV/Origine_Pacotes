import type { Metadata } from "next";
import "./globals.css";
import ThemeRestore from "../components/theme-restore";
import { editorialFont } from "../lib/fonts";

export const metadata: Metadata = { title: "Origine Pacotes", description: "Gestão simples de pacotes para barbearias" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR" data-theme="light" suppressHydrationWarning><body className={editorialFont.variable}><ThemeRestore />{children}</body></html>;
}
