import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OSP Logbook | OLOS",
  description: "Diário de Bordo Operacional para Locator e ADA",
};

const themeBootstrap = `
(function(){
  try {
    var saved = localStorage.getItem("osp_theme");
    var theme = saved === "dark" || saved === "light"
      ? saved
      : (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  } catch (_) {}
})();
`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR" suppressHydrationWarning>
    <head><script dangerouslySetInnerHTML={{__html:themeBootstrap}}/></head>
    <body>{children}</body>
  </html>;
}
