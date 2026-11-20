"use client";

/**
 * Resultado de tocar un punto. Orden fijo (regla de UX del proyecto):
 * 1) veredicto en una línea, 2) "no construyas" si el terreno es el problema, 3) cada cuánto pasa,
 * 4) qué hacer, 5) ¿puedo construir aquí?, 6) "Ver por qué" con fuentes (cerrado), 7) los otros peligros.
 */
import type { ResultadoConsulta } from "../server/consulta";
import { colorNivel, INFO_PELIGRO, PELIGROS, textoNivel, type Peligro } from "../peligros";
import { formatoDistancia } from "../veredicto";
import { IconoCalendario } from "./VistaConstruccion";

type Props = {
  resultado: ResultadoConsulta;
  peligro: Peligro;
  onElegirPeligro: (p: Peligro) => void;
  onCerrar: () => void;
  onConstruir: () => void;
};

export function TarjetaResultado({ resultado, peligro, onElegirPeligro, onCerrar, onConstruir }: Props) {
  const v = resultado.veredictos[peligro];
  const color = colorNivel(peligro, v.nivel);
  const otros = PELIGROS.filter((p) => p !== peligro)
    .map((p) => resultado.veredictos[p])
    .sort((a, b) => b.nivel - a.nivel);

  // Si otro peligro es alto o muy alto y más grave que el elegido, se avisa primero.
  const masGrave = otros[0] && otros[0].nivel >= 3 && otros[0].nivel > v.nivel ? otros[0] : null;

  const noConstruir = resultado.construccion.estado === "no_construir";
  const frec = v.nivel >= 1 ? resultado.frecuencia[peligro] : null;

  return (
    <article aria-live="polite" className="overflow-hidden rounded-xl border border-line bg-surface">
      {masGrave && (
        <button
          type="button"
          onClick={() => onElegirPeligro(masGrave.peligro)}
          className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-white"
          style={{ backgroundColor: colorNivel(masGrave.peligro, masGrave.nivel) }}
        >
          <span className="flex-1">
            Atención: aquí también hay {INFO_PELIGRO[masGrave.peligro].corto.toLowerCase()} ({textoNivel(masGrave.peligro, masGrave.nivel).toLowerCase()})
          </span>
          <span aria-hidden>Ver ›</span>
        </button>
      )}
      <div className="flex items-start gap-3 p-4">
        <span aria-hidden className="mt-1 size-4 shrink-0 rounded-full border border-black/15" style={{ backgroundColor: color }} />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg leading-snug font-semibold">{v.titulo}</h2>
          {v.resumen && <p className="mt-1 text-sm text-muted">{v.resumen}</p>}
        </div>
        <button
          type="button"
          onClick={onCerrar}
          className="-m-1 rounded p-1 text-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-accent"
          aria-label="Cerrar resultado"
        >
          ✕
        </button>
      </div>

      {noConstruir && (
        <section className="border-t border-line bg-red-50 px-4 py-3 text-red-950 dark:bg-red-950/40 dark:text-red-100" aria-labelledby="no-construir">
          <h3 id="no-construir" className="text-sm font-semibold">
            ⛔ No construyas aquí
          </h3>
          <p className="mt-1 text-sm">{resultado.construccion.razon}</p>
        </section>
      )}

      {frec && (
        <section className="mx-4 my-3 flex gap-2.5 rounded-lg bg-background p-3" aria-labelledby="frecuencia">
          <IconoCalendario />
          <div>
            <h3 id="frecuencia" className="text-sm font-semibold">
              ¿Cada cuánto pasa?
            </h3>
            <p className="mt-0.5 text-sm leading-relaxed">{frec.texto}</p>
            {frec.nota && <p className="mt-0.5 text-xs text-muted">{frec.nota}</p>}
          </div>
        </section>
      )}

      {v.acciones.length > 0 && (
        <section className="border-t border-line px-4 py-3" aria-labelledby="que-hacer">
          <h3 id="que-hacer" className="text-sm font-semibold">
            Qué hacer
          </h3>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm">
            {v.acciones.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </section>
      )}

      <div className="border-t border-line px-4 py-3">
        <button
          type="button"
          onClick={onConstruir}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 font-semibold text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
            <path d="M3 11 12 4l9 7v9H3z" />
            <path d="M9 20v-6h6v6" />
          </svg>
          ¿Puedo construir aquí?
        </button>
      </div>

      {v.detalle.length > 0 && (
        <details className="group border-t border-line px-4 py-3">
          <summary className="cursor-pointer text-sm font-medium text-accent">
            Ver por qué ({v.detalle.length} {v.detalle.length === 1 ? "registro" : "registros"})
          </summary>
          <ul className="mt-2 space-y-3">
            {v.detalle.map((d, i) => (
              <li key={i} className="text-sm">
                <p>
                  {!d.dentro && <span className="font-medium">A {formatoDistancia(d.distanciaM)}: </span>}
                  {d.texto}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {d.fuente}
                  {d.fecha ? ` · ${d.fecha}` : ""}
                  {d.confianza !== "alta" ? ` · ubicación ${d.confianza === "media" ? "aproximada" : "tentativa"}` : ""}
                  {d.enlace && (
                    <>
                      {" · "}
                      <a href={d.enlace} target="_blank" rel="noopener noreferrer" className="text-accent underline">
                        ver fuente
                      </a>
                    </>
                  )}
                </p>
              </li>
            ))}
          </ul>
        </details>
      )}

      <section className="border-t border-line px-4 py-3" aria-labelledby="otros">
        <h3 id="otros" className="text-sm font-semibold">
          Otros peligros en este punto
        </h3>
        <ul className="mt-1.5 space-y-0.5">
          {otros.map((o) => (
            <li key={o.peligro}>
              <button
                type="button"
                onClick={() => onElegirPeligro(o.peligro)}
                className="flex w-full items-center gap-2 rounded px-1 py-1 text-left text-sm hover:bg-background focus-visible:outline-2 focus-visible:outline-accent"
              >
                <span aria-hidden className="size-3 shrink-0 rounded-full border border-black/15" style={{ backgroundColor: colorNivel(o.peligro, o.nivel) }} />
                <span className="min-w-0 flex-1">{o.titulo}</span>
                <span aria-hidden className="text-muted">›</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <p className="border-t border-line px-4 py-2 text-xs text-muted">
        {resultado.manzana ? `Manzana ${resultado.manzana.manzana}, zona ${resultado.manzana.zona} (INEI). ` : ""}
        Información orientativa para {INFO_PELIGRO[peligro].nombre.toLowerCase()}; no reemplaza una evaluación técnica.
      </p>
    </article>
  );
}
