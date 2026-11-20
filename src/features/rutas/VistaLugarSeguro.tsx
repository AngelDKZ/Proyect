"use client";

/** Lugar seguro y ruta a pie (diseño F4·3): a dónde ir, cuánto falta para salir de la zona y cómo llegar. */
import type { Ruta } from "./ruta";
import type { LugarSeguro } from "./server/rutas";

const TIPO: Record<string, string> = {
  zona_seguridad: "Zona de seguridad",
  refugio_temporal: "Refugio temporal",
  centro_acopio: "Centro de acopio",
  atencion_medica: "Atención médica",
  puesto_comando: "Puesto de comando",
  atencion_animal: "Atención de animales",
  gestion_cadaveres: "Gestión de fallecidos",
};
const PARA: Record<string, string> = { aluvion: "ante aluvión", huaico: "ante huaico", inundacion_pluvial: "si tu vivienda se inunda" };

export type EstadoRuta = { cargando: true } | { error: string } | { ruta: Ruta<LugarSeguro>; peligro: string };

export function VistaLugarSeguro({ estado, onVolver }: { estado: EstadoRuta; onVolver: () => void }) {
  return (
    <article aria-live="polite" className="flex flex-col gap-3">
      <div className="flex items-center gap-1">
        <button type="button" onClick={onVolver} aria-label="Volver" className="grid size-11 place-items-center rounded-lg hover:bg-surface focus-visible:outline-2 focus-visible:outline-accent">
          <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <h2 className="text-base font-semibold">Lugar seguro y ruta a pie</h2>
      </div>

      {"cargando" in estado && <p className="rounded-xl border border-line bg-surface p-4 text-sm">Calculando la ruta…</p>}
      {"error" in estado && <p role="alert" className="rounded-xl border border-line bg-surface p-4 text-sm">{estado.error}</p>}
      {"ruta" in estado && <Contenido ruta={estado.ruta} peligro={estado.peligro} />}
    </article>
  );
}

function Contenido({ ruta, peligro }: { ruta: Ruta<LugarSeguro>; peligro: string }) {
  const l = ruta.destino;
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <div className="flex flex-col gap-1.5 p-4">
        <span className="self-start rounded-full bg-[#e8f5e9] px-2.5 py-0.5 text-xs font-semibold text-[#1b5e20]">
          {TIPO[l.tipo] ?? "Lugar seguro"} · {PARA[peligro] ?? ""}
        </span>
        <h3 className="text-xl font-bold">{l.nombre}</h3>
        {l.referencia && l.referencia !== l.nombre && <p className="text-sm text-muted">{l.referencia}</p>}
      </div>

      <dl className="grid grid-cols-3 border-t border-line text-center">
        <div className="border-r border-line px-1 py-3">
          <dt className="sr-only">Distancia</dt>
          <dd className="text-xl font-bold">{ruta.metros} m</dd>
          <dd className="text-xs text-muted">a pie por calles</dd>
        </div>
        <div className="border-r border-line px-1 py-3">
          <dt className="sr-only">Tiempo</dt>
          <dd className="text-xl font-bold">≈ {ruta.minutos} min</dd>
          <dd className="text-xs text-muted">caminando</dd>
        </div>
        <div className="px-1 py-3">
          <dt className="sr-only">Hasta salir de la zona</dt>
          <dd className="text-xl font-bold">{ruta.metrosHastaSalir > 0 ? `${ruta.metrosHastaSalir} m` : "—"}</dd>
          <dd className="text-xs text-muted">{ruta.metrosHastaSalir > 0 ? "hasta salir de la zona de peligro" : "ya estás fuera de la zona"}</dd>
        </div>
      </dl>

      <section className="border-t border-line px-4 py-3" aria-labelledby="como-llegar">
        <h4 id="como-llegar" className="text-[15px] font-semibold">
          Cómo llegar
        </h4>
        <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-[15px] leading-relaxed">
          {ruta.pasos.map((p, i) => (
            <li key={i}>{p.texto}</li>
          ))}
          <li>Llegas a {l.nombre}.</li>
        </ol>
        {peligro === "aluvion" && (
          <p className="mt-2 text-xs text-muted">
            La ruta evita las zonas de peligro y coincide con las flechas oficiales de evacuación (92 % de los tramos revisados).
          </p>
        )}
        <p className="mt-1 text-xs text-muted">Calles de OpenStreetMap; puede haber desvíos por obras.</p>
      </section>

      {l.tipo === "zona_seguridad" && (
        <p className="border-t border-line px-4 py-3 text-sm leading-relaxed">
          Espacio abierto para reunirse después de evacuar. No es un albergue: si necesitas quedarte, ve al refugio temporal más cercano.
        </p>
      )}

      <p className="border-t border-line px-4 py-2 text-xs text-muted">
        Fuente: Mapa de zonas seguras y rutas de evacuación ante aluviones (Municipalidad, INAIGEM, mayo 2025)
        {l.precisionM ? `. Ubicación ± ${l.precisionM} m` : ""}.
      </p>
    </div>
  );
}
