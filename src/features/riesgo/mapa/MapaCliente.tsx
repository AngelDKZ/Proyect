"use client";

/** Carga el mapa solo en el navegador (MapLibre usa WebGL y `window`). */
import dynamic from "next/dynamic";

const MapaRiesgo = dynamic(() => import("./MapaRiesgo"), {
  ssr: false,
  loading: () => (
    <p role="status" className="grid h-[62dvh] place-items-center text-sm text-muted lg:h-[calc(100dvh-57px)]">
      Cargando el mapa…
    </p>
  ),
});

export function MapaCliente() {
  return <MapaRiesgo />;
}
