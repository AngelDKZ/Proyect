import type { Metadata, Viewport } from "next";
import Link from "next/link";
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
          <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4">
            <Link href="/" className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-sm font-semibold tracking-tight sm:text-base">
                Mapa de Riesgo<span className="hidden sm:inline"> Comunitario</span>
              </span>
              <span className="truncate text-xs text-muted">
                Versión de prueba<span className="hidden sm:inline"> · proyecto académico</span>
              </span>
            </Link>
            <Link
              href="/emergencia"
              className="flex min-h-10 items-center gap-1.5 rounded-full bg-[#c62828] px-4 text-[15px] font-bold text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#c62828]"
            >
              <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />
              </svg>
              Emergencia
            </Link>
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
