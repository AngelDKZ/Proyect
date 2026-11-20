"use client";

/** "¿Puedo construir aquí?": respuesta grande, lo revisado, cada cuánto pasa, qué hacer y fuentes. */
import type { EstadoConstruccion } from "../construccion";
import { INFO_PELIGRO, PELIGROS } from "../peligros";
import type { ResultadoConsulta } from "../server/consulta";

const ESTILO: Record<EstadoConstruccion, { caja: string; titulo: string; icono: React.ReactNode }> = {
  no_construir: {
    caja: "border-[#b71c1c] bg-[#fdecea] text-[#3b0a0a] dark:bg-red-950/50 dark:text-red-50",
    titulo: "text-[#7f0000] dark:text-red-200",
    icono: (
      <svg aria-hidden width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        <circle cx="12" cy="12" r="9.5" />
        <path d="M6 6l12 12" />
      </svg>
    ),
  },
  estudio: {
    caja: "border-[#b45309] bg-[#fff4e5] text-[#3d2200] dark:bg-amber-950/50 dark:text-amber-50",
    titulo: "text-[#7a3b00] dark:text-amber-200",
    icono: (
      <svg aria-hidden width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3 2 20h20L12 3z" />
        <path d="M12 10v4M12 17v.5" />
      </svg>
    ),
  },
  sin_peligros: {
    caja: "border-[#9aa4b1] bg-surface text-foreground",
    titulo: "text-foreground",
    icono: (
      <svg aria-hidden width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        <circle cx="12" cy="12" r="9.5" />
        <path d="M12 11v6M12 7.5v.5" />
      </svg>
    ),
  },
};

export function VistaConstruccion({ resultado, onVolver }: { resultado: ResultadoConsulta; onVolver: () => void }) {
  const c = resultado.construccion;
  const e = ESTILO[c.estado];
  // Frecuencia del peligro principal del lugar (el de mayor nivel), si hay alguno.
  const principal = PELIGROS.map((p) => resultado.veredictos[p])
    .filter((v) => v.nivel >= 1)
    .sort((a, b) => b.nivel - a.nivel)[0];
  const fuentes = PELIGROS.flatMap((p) => resultado.veredictos[p].detalle.filter((d) => d.dentro));

  return (
    <article aria-live="polite" className="flex flex-col gap-3">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onVolver}
          aria-label="Volver al resultado"
          className="grid size-11 place-items-center rounded-lg hover:bg-surface focus-visible:outline-2 focus-visible:outline-accent"
        >
          <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <h2 className="text-base font-semibold">¿Puedo construir aquí?</h2>
      </div>

      <section className={`flex flex-col gap-2 rounded-2xl border-2 p-4 ${e.caja}`}>
        <div className={`flex items-center gap-2.5 ${e.titulo}`}>
          {e.icono}
          <h3 className="text-xl font-bold">{c.titulo}</h3>
        </div>
        <p className="text-[15px] leading-relaxed">{c.razon}</p>
      </section>

      <section className="rounded-2xl border border-line bg-surface px-4 py-3" aria-labelledby="revisado">
        <h3 id="revisado" className="text-[15px] font-semibold">
          Lo que revisamos en este punto
        </h3>
        <ul className="mt-1 divide-y divide-line/60">
          {c.revisado.map((r) => (
            <li key={r.tema} className="flex gap-2.5 py-2.5 text-[15px]">
              <span aria-hidden className="mt-1.5 size-3 shrink-0 rounded-full border border-black/15" style={{ backgroundColor: r.color }} />
              <span className="flex flex-col">
                <strong className="font-semibold">{r.tema}</strong>
                <span>{r.texto}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {principal && (
        <section className="flex gap-2.5 rounded-2xl border border-line bg-surface px-4 py-3" aria-labelledby="frecuencia-c">
          <IconoCalendario />
          <div>
            <h3 id="frecuencia-c" className="text-sm font-semibold">
              ¿Cada cuánto pasa? ({INFO_PELIGRO[principal.peligro].corto.toLowerCase()})
            </h3>
            <p className="mt-0.5 text-sm leading-relaxed">{resultado.frecuencia[principal.peligro].texto}</p>
            {resultado.frecuencia[principal.peligro].nota && <p className="mt-0.5 text-xs text-muted">{resultado.frecuencia[principal.peligro].nota}</p>}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-line bg-surface px-4 py-3" aria-labelledby="hacer-c">
        <h3 id="hacer-c" className="text-[15px] font-semibold">
          Qué hacer
        </h3>
        <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[15px] leading-relaxed">
          {c.acciones.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      </section>

      <aside className="rounded-2xl border border-[#c7d9ee] bg-[#eef4fb] px-4 py-3 text-[13px] leading-relaxed text-[#1b2a3a] dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-50">
        <strong className="font-semibold">Ten en cuenta:</strong> esta app solo muestra peligros naturales, no si el terreno tiene dueño. En zonas de
        riesgo muy alto no mitigable el Estado no da licencia ni servicios y puede reubicar a las familias (Ley 29869).
      </aside>

      <details className="rounded-2xl border border-line bg-surface px-4 py-3">
        <summary className="cursor-pointer text-[15px] font-medium text-accent">Ver fuentes y fechas</summary>
        <ul className="mt-2 space-y-2 text-sm">
          {fuentes.length === 0 && <li className="text-muted">Ninguna fuente tiene registros en este punto exacto.</li>}
          {fuentes.map((d, i) => (
            <li key={i}>
              <p>{d.texto}</p>
              <p className="text-xs text-muted">
                {d.fuente}
                {d.fecha ? ` · ${d.fecha}` : ""}
              </p>
            </li>
          ))}
          <li className="text-xs text-muted">Pendiente: modelo de elevación Copernicus GLO-30 (30 m), clases del INGEMMET. Ríos y quebradas: OpenStreetMap.</li>
        </ul>
      </details>
    </article>
  );
}

export function IconoCalendario() {
  return (
    <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="mt-0.5 shrink-0 text-muted">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}
