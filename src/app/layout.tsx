import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OSP Logbook | OLOS",
  description: "Diário de Bordo Operacional para Locator e ADA",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
