import type { Metadata } from "next";
import telefonos from "../../../data/raw/huaraz/telefonos_emergencia.json";
import { BotonVolver } from "@/features/emergencia/BotonVolver";
import { EmergenciaCliente, type Telefono } from "@/features/emergencia/EmergenciaCliente";

export const metadata: Metadata = {
  title: "Emergencia",
  description: "Números de emergencia, lugar seguro más cercano y qué hacer ante aluvión, huaico o inundación en Huaraz.",
};

/** Página estática: los teléfonos verificados se incluyen al compilar (no dependen de la base ni de internet). */
export default function PaginaEmergencia() {
  const locales = telefonos.locales as Telefono[];
  return (
    <>
      <div className="flex items-center justify-between gap-2 bg-[#c62828] py-2 pr-4 pl-1">
        <BotonVolver />
        <h1 className="text-xl font-bold text-white">Emergencia</h1>
      </div>
      <EmergenciaCliente
        locales={locales.filter((t) => t.confianza === "alta")}
        porConfirmar={locales.filter((t) => t.confianza !== "alta")}
        nota911="El 911 todavía no funciona en Huaraz (solo en pruebas en Lima y Callao)."
      />
    </>
  );
}
