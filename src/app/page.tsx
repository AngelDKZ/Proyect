import Link from "next/link";
import { INFO_PELIGRO, PELIGROS } from "@/features/riesgo/peligros";

export default function Home() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <section aria-labelledby="titulo" className="max-w-2xl">
        <h1 id="titulo" className="text-2xl font-semibold tracking-tight sm:text-3xl">
          ¿Qué peligros hay donde vives?
        </h1>
        <p className="mt-3 text-muted">
          Toca tu cuadra en el mapa de Huaraz y conoce los peligros registrados, qué hacer y hacia dónde evacuar. Toda la
          información indica su fuente y su fecha.
        </p>
        <Link
          href="/mapa"
          className="mt-5 inline-block rounded-lg bg-accent px-5 py-2.5 font-medium text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Abrir el mapa
        </Link>
      </section>

      <section aria-label="Peligros disponibles" className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PELIGROS.map((p) => (
          <Link
            key={p}
            href={`/mapa?peligro=${p}`}
            className="rounded-xl border border-line bg-surface p-4 hover:border-accent focus-visible:outline-2 focus-visible:outline-accent"
          >
            <h2 className="font-medium">{INFO_PELIGRO[p].nombre}</h2>
            <p className="mt-1 text-sm text-muted">{INFO_PELIGRO[p].descripcion}</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
