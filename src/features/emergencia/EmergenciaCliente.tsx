"use client";

/**
 * Pantalla de emergencia (diseño F4·2). Pensada para alguien con miedo y apurado:
 * 1) llamar (funciona sin internet), 2) ir al lugar seguro más cercano, 3) qué hacer ahora,
 * 4) teléfonos de Huaraz, 5) enviar mi ubicación a un familiar (la app no guarda nada).
 */
import Link from "next/link";
import { useState } from "react";

export type Telefono = { numero: string; nombre: string; descripcion: string; confianza: "alta" | "media" };

const LLAMAR = [
  { numero: "105", nombre: "Policía" },
  { numero: "116", nombre: "Bomberos" },
  { numero: "106", nombre: "Ambulancia (SAMU)" },
  { numero: "115", nombre: "Defensa Civil" },
];

const PELIGROS = [
  { id: "aluvion", nombre: "Aluvión" },
  { id: "huaico", nombre: "Huaico" },
  { id: "inundacion_pluvial", nombre: "Inundación" },
] as const;
type PeligroEmergencia = (typeof PELIGROS)[number]["id"];

const QUE_HACER: Record<PeligroEmergencia, string[]> = {
  aluvion: [
    "Si suena la alerta, sal de inmediato. No esperes a ver el río ni recojas cosas.",
    "Camina hacia los costados del cauce y a lo alto, nunca río abajo.",
    "Ve al lugar seguro y quédate hasta que las autoridades avisen que pasó el peligro.",
  ],
  huaico: [
    "Aléjate del cauce de la quebrada y de sus orillas.",
    "No cruces cuando baje agua con lodo, ni a pie ni en vehículo.",
    "Sube a una zona alta, lejos de la quebrada, y avisa al 115 o al serenazgo.",
  ],
  inundacion_pluvial: [
    "Si el agua entra a tu casa, corta la luz y sube a un piso alto.",
    "No camines por calles inundadas: puede haber buzones abiertos o cables.",
    "Si tu vivienda se inunda, ve al refugio temporal más cercano.",
  ],
};

type Destino = { nombre: string; metros: number; minutos: number; lon: number; lat: number };

function telHref(n: string) {
  return `tel:${n.replace(/[^\d]/g, "")}`;
}

function ubicacion(): Promise<GeolocationPosition> {
  return new Promise((ok, mal) => {
    if (!navigator.geolocation) return mal(new Error("sin geolocalización"));
    navigator.geolocation.getCurrentPosition(ok, mal, { enableHighAccuracy: true, timeout: 15_000 });
  });
}

export function EmergenciaCliente({ locales, porConfirmar, nota911 }: { locales: Telefono[]; porConfirmar: Telefono[]; nota911: string }) {
  const [peligro, setPeligro] = useState<PeligroEmergencia>("aluvion");
  const [destino, setDestino] = useState<Destino | null>(null);
  const [estado, setEstado] = useState<"" | "buscando" | "error">("");
  const [aviso, setAviso] = useState("");

  async function buscarLugar(p: PeligroEmergencia) {
    setEstado("buscando");
    setDestino(null);
    try {
      const pos = await ubicacion();
      const { longitude: lon, latitude: lat } = pos.coords;
      const r = await fetch(`/api/v1/ruta?lon=${lon.toFixed(6)}&lat=${lat.toFixed(6)}&peligro=${p}`);
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? "sin ruta");
      const d = await r.json();
      setDestino({ nombre: d.destino.nombre, metros: d.metros, minutos: d.minutos, lon, lat });
      setEstado("");
    } catch (e) {
      setEstado("error");
      setAviso(
        (e as GeolocationPositionError)?.code === 1
          ? "Permite el acceso a tu ubicación para buscar el lugar seguro más cercano."
          : (e as Error).message === "sin ruta" || !(e as Error).message
            ? "No pudimos calcular la ruta desde tu ubicación. Si estás fuera de Huaraz o Independencia, usa el mapa."
            : (e as Error).message,
      );
    }
  }

  async function enviarUbicacion() {
    try {
      const pos = await ubicacion();
      const { latitude: lat, longitude: lon } = pos.coords;
      const url = `https://www.openstreetmap.org/?mlat=${lat.toFixed(6)}&mlon=${lon.toFixed(6)}#map=18/${lat.toFixed(6)}/${lon.toFixed(6)}`;
      const texto = "Estoy aquí y necesito ayuda:";
      if (navigator.share) await navigator.share({ title: "Mi ubicación", text: texto, url });
      else window.open(`https://wa.me/?text=${encodeURIComponent(`${texto} ${url}`)}`, "_blank", "noopener");
    } catch (e) {
      if ((e as DOMException)?.name === "AbortError") return; // el usuario canceló
      setAviso("No se pudo obtener tu ubicación. Revisa que el GPS esté activado.");
    }
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4 px-3 py-4">
      <section aria-labelledby="llamar">
        <h2 id="llamar" className="mb-2 text-[15px] font-semibold">
          Llama ahora
        </h2>
        <div className="grid grid-cols-2 gap-2.5">
          {LLAMAR.map((t) => (
            <a key={t.numero} href={telHref(t.numero)} className="flex flex-col gap-0.5 rounded-2xl border-2 border-[#c62828] bg-surface p-4 hover:bg-red-50 dark:hover:bg-red-950/30">
              <span className="text-3xl font-extrabold text-[#c62828]">{t.numero}</span>
              <span className="text-sm font-semibold">{t.nombre}</span>
            </a>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">Las llamadas funcionan aunque no tengas internet. {nota911}</p>
      </section>

      <section className="flex flex-col gap-2 rounded-2xl border-2 border-[#2e7d32] bg-surface p-4" aria-labelledby="ir">
        <h2 id="ir" className="text-[15px] font-semibold text-[#1b5e20] dark:text-green-300">
          Ir al lugar seguro más cercano
        </h2>
        <div className="flex gap-1.5" role="group" aria-label="Peligro">
          {PELIGROS.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={peligro === p.id}
              onClick={() => {
                setPeligro(p.id);
                if (destino || estado) buscarLugar(p.id);
              }}
              className="h-9 rounded-full border border-line px-3 text-sm aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-white"
            >
              {p.nombre}
            </button>
          ))}
        </div>
        {destino ? (
          <>
            <p className="text-[15px] font-semibold">{destino.nombre}</p>
            <p className="text-sm text-muted">
              {destino.metros} m a pie · ≈ {destino.minutos} min · desde tu ubicación
            </p>
            <Link
              href={`/mapa?peligro=${peligro}&lon=${destino.lon.toFixed(6)}&lat=${destino.lat.toFixed(6)}&ruta=1`}
              className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#2e7d32] font-semibold text-white hover:opacity-90"
            >
              Ver ruta a pie
            </Link>
          </>
        ) : (
          <button
            type="button"
            onClick={() => buscarLugar(peligro)}
            disabled={estado === "buscando"}
            className="flex min-h-12 items-center justify-center rounded-xl bg-[#2e7d32] font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {estado === "buscando" ? "Buscando…" : "Usar mi ubicación"}
          </button>
        )}
        {estado === "error" && (
          <p role="alert" className="text-sm">
            {aviso}
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-surface p-4" aria-labelledby="ahora">
        <h2 id="ahora" className="mb-2 text-[15px] font-semibold">
          Qué hacer ahora: {PELIGROS.find((p) => p.id === peligro)!.nombre.toLowerCase()}
        </h2>
        <ol className="list-decimal space-y-1 pl-5 text-[15px] leading-relaxed">
          {QUE_HACER[peligro].map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ol>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-4" aria-labelledby="locales">
        <h2 id="locales" className="text-[15px] font-semibold">
          Teléfonos de Huaraz e Independencia
        </h2>
        <ul className="mt-1 divide-y divide-line/60 text-[15px]">
          {locales.map((t) => (
            <li key={t.numero} className="flex items-center justify-between gap-3 py-2.5">
              <span className="min-w-0">{t.nombre}</span>
              <a href={telHref(t.numero)} className="shrink-0 font-semibold text-accent underline">
                {t.numero}
              </a>
            </li>
          ))}
        </ul>
        {porConfirmar.length > 0 && (
          <details className="mt-2">
            <summary className="cursor-pointer text-sm text-accent">Otros números (una sola fuente o fuentes que no coinciden)</summary>
            <ul className="mt-1 divide-y divide-line/60 text-sm">
              {porConfirmar.map((t) => (
                <li key={t.numero} className="py-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0">{t.nombre}</span>
                    <a href={telHref(t.numero)} className="shrink-0 font-semibold text-accent underline">
                      {t.numero}
                    </a>
                  </div>
                  <p className="text-xs text-muted">{t.descripcion}</p>
                </li>
              ))}
            </ul>
          </details>
        )}
        <p className="mt-2 text-xs text-muted">Verificados en páginas oficiales (gob.pe) el 20-11-2026. Ante la duda, llama a los números nacionales.</p>
      </section>

      <section className="rounded-2xl border border-dashed border-[#7aa7d6] bg-[#eef4fb] p-4 dark:bg-sky-950/30" aria-labelledby="compartir">
        <h2 id="compartir" className="mb-2 text-sm font-semibold">
          Avisar a un familiar
        </h2>
        <button type="button" onClick={enviarUbicacion} className="min-h-11 w-full rounded-lg border border-accent bg-surface font-semibold text-accent">
          Enviar mi ubicación
        </button>
        <p className="mt-1.5 text-xs">Abre WhatsApp, SMS u otra app con un enlace a tu ubicación. La app no guarda nada.</p>
        {aviso && estado !== "error" && (
          <p role="alert" className="mt-1 text-sm">
            {aviso}
          </p>
        )}
      </section>
    </div>
  );
}
