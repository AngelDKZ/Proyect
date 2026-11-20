import type { Metadata, Viewport } from "next";
import { publicEnv } from "@/lib/env";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(publicEnv.NEXT_PUBLIC_SITE_URL),
  title: {
    default: "Mapa de Riesgo Comunitario – Huaraz",
    template: "%s · Mapa de Riesgo Comunitario",
  },
  description:
    "Consulta los peligros de tu zona en Huaraz (aluvión, inundación por lluvias, huaicos, deslizamientos), las zonas seguras y las rutas de evacuación, con fuentes oficiales.",
  applicationName: "Mapa de Riesgo Comunitario",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1419" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <a href="#contenido" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:rounded focus:bg-surface focus:px-3 focus:py-2">
          Saltar al contenido
        </a>
        <header className="border-b border-line bg-surface">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
            <span className="text-base font-semibold tracking-tight">Mapa de Riesgo Comunitario</span>
            <span className="rounded-full border border-line px-2.5 py-0.5 text-xs text-muted">Huaraz · en desarrollo</span>
          </div>
        </header>
        <main id="contenido" className="flex-1">
          {children}
        </main>
        <footer className="border-t border-line bg-surface">
          <p className="mx-auto max-w-5xl px-4 py-4 text-xs text-muted">
            Proyecto académico sin fines de lucro. La información proviene de fuentes oficiales citadas en cada consulta y no
            reemplaza una evaluación técnica. Ante una emergencia, sigue las indicaciones de las autoridades.
          </p>
        </footer>
      </body>
    </html>
  );
}
