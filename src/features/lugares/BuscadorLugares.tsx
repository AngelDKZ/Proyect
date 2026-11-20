"use client";

/** Caja de búsqueda de barrios, calles y lugares (busca en la base propia, con autocompletado). */
import { useEffect, useId, useRef, useState } from "react";
import type { Lugar } from "./server/buscar";

const GRUPOS: { titulo: string; tipos: string[] }[] = [
  { titulo: "Barrios y sectores", tipos: ["barrio", "centro_poblado"] },
  { titulo: "Calles y lugares", tipos: ["lugar", "calle"] },
];

export function BuscadorLugares({ onElegir, onUbicacion }: { onElegir: (l: Lugar) => void; onUbicacion: () => void }) {
  const id = useId();
  const [texto, setTexto] = useState("");
  const [lugares, setLugares] = useState<Lugar[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [activo, setActivo] = useState(-1);
  const caja = useRef<HTMLDivElement>(null);

  // Autocompletar con una pausa corta para no consultar en cada tecla.
  useEffect(() => {
    const q = texto.trim();
    if (q.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setBuscando(true);
      try {
        const r = await fetch(`/api/v1/lugares?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const d = (await r.json()) as { lugares?: Lugar[] };
        setLugares(d.lugares ?? []);
        setActivo(-1);
      } catch {
        /* búsqueda cancelada o sin conexión: se mantiene la lista anterior */
      } finally {
        if (!ctrl.signal.aborted) setBuscando(false);
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [texto]);

  // Cerrar al tocar fuera.
  useEffect(() => {
    const fuera = (e: PointerEvent) => {
      if (!caja.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("pointerdown", fuera);
    return () => document.removeEventListener("pointerdown", fuera);
  }, []);

  const elegir = (l: Lugar) => {
    setTexto(l.nombre);
    setAbierto(false);
    onElegir(l);
  };

  const conTexto = texto.trim().length >= 2;
  const visibles = conTexto ? lugares : [];
  const ordenados = GRUPOS.flatMap((g) => visibles.filter((l) => g.tipos.includes(l.tipo)));

  return (
    <div ref={caja} className="relative">
      <label htmlFor={`${id}-q`} className="sr-only">
        Buscar un lugar
      </label>
      <div className="flex h-12 items-center gap-2.5 rounded-xl border border-line bg-surface px-3.5 shadow-md focus-within:border-accent">
        <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-muted">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <input
          id={`${id}-q`}
          type="search"
          role="combobox"
          aria-expanded={abierto && conTexto}
          aria-controls={`${id}-lista`}
          aria-autocomplete="list"
          aria-activedescendant={activo >= 0 ? `${id}-op-${activo}` : undefined}
          autoComplete="off"
          placeholder="Busca tu barrio, calle o sector"
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setAbierto(true);
          }}
          onFocus={() => setAbierto(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActivo((a) => Math.min(a + 1, ordenados.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActivo((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter" && ordenados.length > 0) {
              e.preventDefault();
              elegir(ordenados[Math.max(activo, 0)]);
            } else if (e.key === "Escape") {
              setAbierto(false);
            }
          }}
          className="min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted"
        />
      </div>

      {abierto && conTexto && (
        <div id={`${id}-lista`} role="listbox" aria-label="Lugares encontrados" className="absolute inset-x-0 top-14 z-10 max-h-[60dvh] overflow-y-auto rounded-xl border border-line bg-surface shadow-lg">
          {GRUPOS.map((g) => {
            const items = visibles.filter((l) => g.tipos.includes(l.tipo));
            if (items.length === 0) return null;
            return (
              <div key={g.titulo} role="group" aria-label={g.titulo}>
                <p className="px-4 pt-3 pb-1 text-xs font-semibold tracking-wide text-muted uppercase">{g.titulo}</p>
                {items.map((l) => {
                  const i = ordenados.indexOf(l);
                  return (
                    <div
                      key={`${l.tipo}-${l.nombre}-${l.coordenadas.join()}`}
                      id={`${id}-op-${i}`}
                      role="option"
                      aria-selected={i === activo}
                      tabIndex={-1}
                      onClick={() => elegir(l)}
                      onMouseEnter={() => setActivo(i)}
                      className="flex min-h-14 cursor-pointer flex-col justify-center px-4 py-2 aria-selected:bg-background"
                    >
                      <span className="text-base">{l.nombre}</span>
                      <span className="text-xs text-muted">
                        {l.distrito ?? "Huaraz"} · {l.fuente}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })}
          {!buscando && visibles.length === 0 && <p className="px-4 pt-3 text-sm">No encontramos «{texto.trim()}».</p>}
          <div className="m-3 rounded-lg bg-background p-3 text-sm">
            <p className="font-medium">¿No encuentras tu lugar?</p>
            <p className="mt-1 text-muted">
              Muchas calles nuevas y de los cerros todavía no están en ningún mapa. Busca el barrio más cercano y toca el punto exacto, o usa tu
              ubicación estando en el terreno.
            </p>
            <button
              type="button"
              onClick={() => {
                setAbierto(false);
                onUbicacion();
              }}
              className="mt-2 min-h-11 rounded-lg border border-accent px-3 font-medium text-accent"
            >
              Usar mi ubicación
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
