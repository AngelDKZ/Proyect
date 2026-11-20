"use client";

/** Centros de salud cercanos (diseño F4·4): 106 primero, luego los más cercanos con llamar y cómo llegar. */
import type { CentroSalud } from "./server/rutas";
import { telHref } from "./telefono";

const TIPO: Record<string, string> = {
  hospital: "Hospital",
  centro_salud: "Centro de salud",
  puesto_salud: "Puesto de salud",
  clinica: "Clínica",
  otro: "Establecimiento de salud",
};

export type EstadoSalud = { cargando: true } | { error: string } | { centros: CentroSalud[] };

export function VistaSalud({ estado, onVolver, onRuta }: { estado: EstadoSalud; onVolver: () => void; onRuta: (c: CentroSalud) => void }) {
  return (
    <article aria-live="polite" className="flex flex-col gap-3">
      <div className="flex items-center gap-1">
        <button type="button" onClick={onVolver} aria-label="Volver" className="grid size-11 place-items-center rounded-lg hover:bg-surface focus-visible:outline-2 focus-visible:outline-accent">
          <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <div>
          <h2 className="text-base font-semibold">Centros de salud cercanos</h2>
          <p className="text-xs text-muted">Desde el punto que marcaste</p>
        </div>
      </div>

      <a href="tel:106" className="flex items-center gap-3 rounded-xl bg-[#c62828] p-4 text-white hover:opacity-90">
        <span className="text-3xl font-extrabold">106</span>
        <span className="flex flex-col">
          <strong className="text-[15px]">¿Es grave? Llama a una ambulancia</strong>
          <span className="text-sm opacity-90">SAMU – Ministerio de Salud</span>
        </span>
      </a>

      {"cargando" in estado && <p className="rounded-xl border border-line bg-surface p-4 text-sm">Buscando centros de salud…</p>}
      {"error" in estado && <p role="alert" className="rounded-xl border border-line bg-surface p-4 text-sm">{estado.error}</p>}
      {"centros" in estado && estado.centros.length === 0 && (
        <p className="rounded-xl border border-line bg-surface p-4 text-sm">Todavía no hay centros de salud cargados.</p>
      )}
      {"centros" in estado && (
        <ul className="flex flex-col gap-2.5">
          {estado.centros.map((c) => (
            <li key={c.id} className="flex flex-col gap-1.5 rounded-xl border border-line bg-surface p-4">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-semibold">{c.nombre}</h3>
                <span className="text-sm font-semibold whitespace-nowrap">{c.distanciaM < 1000 ? `${Math.round(c.distanciaM / 10) * 10} m` : `${(c.distanciaM / 1000).toFixed(1)} km`}</span>
              </div>
              <p className="text-[13px] text-muted">
                {[TIPO[c.tipo] ?? c.tipo, c.institucion, c.categoria && `categoría ${c.categoria}`, c.emergencia24h ? "emergencia 24 h" : null, c.horario]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {c.confianza === "baja" && <p className="text-xs text-muted">Ubicación aproximada: el registro no trae coordenadas exactas.</p>}
              {/FFAA|PNP/.test(c.institucion ?? "") && <p className="text-xs text-muted">Atiende principalmente a su personal.</p>}
              {c.enPeligro.length > 0 && (
                <p className="rounded-lg bg-[#fff4e5] px-3 py-2 text-[13px] text-[#3d2200] dark:bg-amber-950/50 dark:text-amber-50">
                  Está en zona de peligro de {c.enPeligro.join(" y ")}: en esa emergencia podría no estar disponible.
                </p>
              )}
              <div className="mt-1 flex gap-2">
                {c.telefono && (
                  <a href={telHref(c.telefono.split(" / ")[0])} className="flex min-h-11 flex-1 items-center justify-center rounded-lg border border-accent font-semibold text-accent">
                    Llamar
                  </a>
                )}
                <button type="button" onClick={() => onRuta(c)} className="flex min-h-11 flex-1 items-center justify-center rounded-lg bg-accent font-semibold text-white hover:opacity-90">
                  Cómo llegar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted">Fuente: Registro Nacional de IPRESS (SUSALUD, datos abiertos) y OpenStreetMap. Distancias en línea recta.</p>
    </article>
  );
}
