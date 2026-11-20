"use client";

/**
 * Volver al mapa desde la pantalla de emergencia: al mapa con el último peligro elegido en esta pestaña.
 * (El mapa también recuerda dónde estabas mirando: ver MapaRiesgo.)
 */
import Link from "next/link";
import { useEffect, useState } from "react";

export function BotonVolver() {
  const [href, setHref] = useState("/mapa");
  useEffect(() => {
    try {
      const p = sessionStorage.getItem("peligro");
      // Se lee después de montar para no desajustar el HTML del servidor.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (p) setHref(`/mapa?peligro=${encodeURIComponent(p)}`);
    } catch {
      /* almacenamiento bloqueado: se vuelve al mapa sin peligro */
    }
  }, []);
  return (
    <Link
      href={href}
      className="flex min-h-11 items-center gap-1.5 rounded-full px-3 text-[15px] font-semibold text-white hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-white"
    >
      <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 5l-7 7 7 7" />
      </svg>
      Volver al mapa
    </Link>
  );
}
