import type { Metadata } from "next";
import { MapaCliente } from "@/features/riesgo/mapa/MapaCliente";

export const metadata: Metadata = {
  title: "Mapa de peligros",
  description: "Toca tu cuadra en Huaraz para ver si hay peligro de aluvión, inundación, huaico o deslizamiento, y qué hacer.",
};

/** Página estática: el peligro elegido (?peligro=) lo lee el mapa en el navegador. */
export default function PaginaMapa() {
  return (
    <>
      <h1 className="sr-only">Mapa de peligros de Huaraz</h1>
      <MapaCliente />
    </>
  );
}
