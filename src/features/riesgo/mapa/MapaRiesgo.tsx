"use client";

/**
 * Mapa interactivo de peligros (MapLibre + OpenFreeMap).
 * Se carga solo en el navegador (ver MapaCliente.tsx): MapLibre necesita WebGL y `window`.
 */
import {
  GeolocateControl,
  Map as MLMap,
  Marker,
  NavigationControl,
  ScaleControl,
  type ExpressionSpecification,
  type GeoJSONSource,
  type MapMouseEvent,
  getVersion,
  setWorkerUrl,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { esPeligro, INFO_PELIGRO, PELIGROS, type Peligro } from "../peligros";
import type { ResultadoConsulta } from "../server/consulta";
import { CENTRO_HUARAZ, colorManzanas, colorSusceptibilidad, ESTILO_BASE, leyenda, LIMITES_PILOTO, metrosAPixeles } from "./capas";
import { BuscadorLugares } from "@/features/lugares/BuscadorLugares";
import { TarjetaResultado } from "./TarjetaResultado";
import { VistaConstruccion } from "./VistaConstruccion";

// El worker se sirve desde public/ (ver scripts/build/copiar-worker-maplibre.mjs).
setWorkerUrl(`/vendor/maplibre-gl-worker.mjs?v=${getVersion()}`);

type FC = GeoJSON.FeatureCollection;
const VACIO: FC = { type: "FeatureCollection", features: [] };

async function pedirJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const r = await fetch(url, { signal });
  if (!r.ok) {
    const cuerpo = (await r.json().catch(() => null)) as { error?: string } | null;
    throw Object.assign(new Error(cuerpo?.error ?? `Error ${r.status}`), { estado: r.status });
  }
  return r.json() as Promise<T>;
}

/** Flecha de evacuación dibujada en un canvas (apunta al norte; se rota con el rumbo). */
function imagenFlecha(): ImageData {
  const c = document.createElement("canvas");
  c.width = c.height = 40;
  const g = c.getContext("2d")!;
  g.translate(20, 20);
  g.lineJoin = "round";
  g.beginPath();
  g.moveTo(0, -15);
  g.lineTo(10, -2);
  g.lineTo(4, -2);
  g.lineTo(4, 14);
  g.lineTo(-4, 14);
  g.lineTo(-4, -2);
  g.lineTo(-10, -2);
  g.closePath();
  g.lineWidth = 5;
  g.strokeStyle = "#fff";
  g.stroke();
  g.fillStyle = "#10307a";
  g.fill();
  return g.getImageData(0, 0, 40, 40);
}

function agregarCapas(map: MLMap, peligro: Peligro) {
  // Debajo de las etiquetas del mapa base, para que los nombres de calles se sigan leyendo.
  const antes = map.getStyle().layers.find((l) => l.type === "symbol")?.id;
  for (const id of ["suscep", "manzanas", "elementos", "zonas", "flechas"]) map.addSource(id, { type: "geojson", data: VACIO });

  map.addLayer(
    { id: "suscep", type: "fill", source: "suscep", layout: { visibility: "none" }, paint: { "fill-color": colorSusceptibilidad() as never, "fill-opacity": 0.3 } },
    antes,
  );
  map.addLayer({ id: "manzanas", type: "fill", source: "manzanas", paint: { "fill-color": colorManzanas(peligro) as never, "fill-opacity": 0.6 } }, antes);
  map.addLayer({ id: "manzanas-borde", type: "line", source: "manzanas", paint: { "line-color": "#ffffff", "line-width": 0.8, "line-opacity": 0.9 } }, antes);

  const poligono = ["==", ["geometry-type"], "Polygon"] as never;
  const linea = ["==", ["geometry-type"], "LineString"] as never;
  const punto = ["==", ["geometry-type"], "Point"] as never;
  map.addLayer({ id: "elem-area", type: "fill", source: "elementos", filter: poligono, paint: { "fill-color": ["get", "color"], "fill-opacity": 0.45 } }, antes);
  map.addLayer({ id: "elem-borde", type: "line", source: "elementos", filter: poligono, paint: { "line-color": ["get", "color"], "line-width": 1.2 } }, antes);
  map.addLayer(
    {
      id: "elem-linea",
      type: "line",
      source: "elementos",
      filter: linea,
      layout: { "line-cap": "round" },
      paint: {
        "line-color": ["get", "color"],
        "line-opacity": 0.55,
        "line-width": metrosAPixeles(["*", 2, ["coalesce", ["get", "radio_m"], 10]], 3) as never,
      },
    },
    antes,
  );
  // Los puntos se dibujan con su radio aproximado: la ubicación no es exacta.
  map.addLayer(
    {
      id: "elem-radio",
      type: "circle",
      source: "elementos",
      filter: punto,
      paint: {
        "circle-color": ["get", "color"],
        "circle-opacity": 0.3,
        "circle-stroke-color": ["get", "color"],
        "circle-stroke-width": 1.2,
        // Sin radio (ubicación aproximada de barrio o caserío): solo un punto, sin pintar un área.
        "circle-radius": metrosAPixeles(["coalesce", ["get", "radio_m"], 0], 4) as never,
      },
    },
    antes,
  );
  map.addLayer(
    { id: "elem-punto", type: "circle", source: "elementos", filter: punto, paint: { "circle-radius": 3.5, "circle-color": ["get", "color"], "circle-stroke-color": "#fff", "circle-stroke-width": 1.2 } },
    antes,
  );

  map.addImage("flecha", imagenFlecha(), { pixelRatio: 2 });
  map.addLayer({
    id: "flechas",
    type: "symbol",
    source: "flechas",
    layout: {
      visibility: "none",
      "icon-image": "flecha",
      "icon-rotate": ["get", "rumbo"],
      "icon-rotation-alignment": "map",
      "icon-allow-overlap": true,
      "icon-size": ["interpolate", ["linear"], ["zoom"], 14, 0.6, 17, 1.2],
    },
  });
  map.addLayer({
    id: "zonas",
    type: "circle",
    source: "zonas",
    layout: { visibility: "none" },
    paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 12, 4, 17, 9], "circle-color": "#2e7d32", "circle-stroke-color": "#fff", "circle-stroke-width": 2 },
  });
  map.addLayer({
    id: "zonas-nombre",
    type: "symbol",
    source: "zonas",
    minzoom: 15,
    layout: { visibility: "none", "text-field": ["coalesce", ["get", "nombre"], ["get", "referencia"]], "text-font": ["Noto Sans Regular"], "text-size": 12, "text-offset": [0, 1.2], "text-anchor": "top", "text-max-width": 10 },
    paint: { "text-color": "#1b5e20", "text-halo-color": "#fff", "text-halo-width": 1.5 },
  });
}

/** Qué significan los puntos verdes en cada peligro (mapa oficial de evacuación, mayo 2025). */
const LEYENDA_SEGUROS: Partial<Record<Peligro, string>> = {
  aluvion: "Zona de seguridad, refugio u otro punto del plan ante aluvión",
  huaico: "Zona de seguridad o refugio temporal, fuera de zonas de huaico",
  inundacion_pluvial: "Refugio temporal, fuera de zonas que se inundan",
};

function visible(map: MLMap, ids: string[], si: boolean) {
  for (const id of ids) map.setLayoutProperty(id, "visibility", si ? "visible" : "none");
}

/** Peligro pedido en la URL (?peligro=aluvion); este componente solo corre en el navegador. */
function peligroDeLaUrl(): Peligro {
  const p = new URLSearchParams(window.location.search).get("peligro");
  return p && esPeligro(p) ? p : "inundacion_pluvial";
}

export default function MapaRiesgo() {
  const contenedor = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLElement>(null);
  const mapa = useRef<MLMap | null>(null);
  const marcador = useRef<Marker | null>(null);
  const cache = useRef(new Map<string, Promise<unknown>>());
  const consultaEnCurso = useRef<AbortController | null>(null);
  const geolocalizar = useRef<GeolocateControl | null>(null);
  const chips = useRef<HTMLUListElement>(null);

  const [listo, setListo] = useState(false);
  const [peligro, setPeligro] = useState<Peligro>(peligroDeLaUrl);
  const [cargandoCapa, setCargandoCapa] = useState(false);
  const [resultado, setResultado] = useState<ResultadoConsulta | null>(null);
  const [consultando, setConsultando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [vista, setVista] = useState<"resultado" | "construir">("resultado");

  /** Descarga una vez y reutiliza (los datos solo cambian al recargar la base). */
  const datos = useCallback(<T,>(url: string): Promise<T> => {
    let p = cache.current.get(url);
    if (!p) {
      p = pedirJson<T>(url);
      p.catch(() => cache.current.delete(url));
      cache.current.set(url, p);
    }
    return p as Promise<T>;
  }, []);

  const consultar = useCallback(async (lngLat: { lng: number; lat: number }) => {
    const map = mapa.current;
    if (!map) return;
    marcador.current ??= new Marker({ color: "#111827" });
    marcador.current.setLngLat(lngLat).addTo(map);
    consultaEnCurso.current?.abort();
    const ctrl = new AbortController();
    consultaEnCurso.current = ctrl;
    setConsultando(true);
    setAviso(null);
    try {
      const r = await pedirJson<ResultadoConsulta>(`/api/v1/consulta?lon=${lngLat.lng.toFixed(6)}&lat=${lngLat.lat.toFixed(6)}`, ctrl.signal);
      setResultado(r);
      setVista("resultado");
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setResultado(null);
      setAviso(
        (e as { estado?: number }).estado === 422
          ? "Ese punto está fuera del área piloto (Huaraz e Independencia)."
          : "No se pudo consultar ese punto. Revisa tu conexión e inténtalo de nuevo.",
      );
    } finally {
      if (consultaEnCurso.current === ctrl) setConsultando(false);
    }
  }, []);

  // Crear el mapa una sola vez.
  useEffect(() => {
    if (!contenedor.current) return;
    const map = new MLMap({
      container: contenedor.current,
      style: ESTILO_BASE,
      center: CENTRO_HUARAZ,
      zoom: 14,
      minZoom: 11,
      maxBounds: LIMITES_PILOTO,
      attributionControl: { compact: true },
    });
    mapa.current = map;
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    const geo = new GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: false });
    map.addControl(geo, "top-right");
    geolocalizar.current = geo;
    map.addControl(new ScaleControl({ unit: "metric" }), "bottom-left");
    geo.on("geolocate", (pos) => consultar({ lng: pos.coords.longitude, lat: pos.coords.latitude }));
    map.on("click", (e: MapMouseEvent) => consultar(e.lngLat));
    map.on("load", () => {
      agregarCapas(map, peligroDeLaUrl());
      setListo(true);
    });
    return () => {
      map.remove();
      mapa.current = null;
      marcador.current = null;
    };
  }, [consultar]);

  // Cambiar de peligro: capas, colores y URL.
  useEffect(() => {
    const map = mapa.current;
    if (!listo || !map) return;
    let vigente = true;
    window.history.replaceState(null, "", `?peligro=${peligro}`);
    map.setPaintProperty("manzanas", "fill-color", colorManzanas(peligro) as ExpressionSpecification);
    visible(map, ["suscep"], peligro === "deslizamiento");
    const conZonas = peligro === "aluvion" || peligro === "huaico" || peligro === "inundacion_pluvial";
    visible(map, ["zonas", "zonas-nombre"], conZonas);
    visible(map, ["flechas"], peligro === "aluvion");
    setCargandoCapa(true);
    const pedidos: Promise<unknown>[] = [
      datos<FC>(`/api/v1/peligros/${peligro}/manzanas`).then((d) => {
        if (vigente) (map.getSource("manzanas") as GeoJSONSource).setData(d);
      }),
      datos<FC>(`/api/v1/peligros/${peligro}/elementos`).then((d) => {
        if (vigente) (map.getSource("elementos") as GeoJSONSource).setData(d);
      }),
    ];
    if (peligro === "deslizamiento") pedidos.push(datos<FC>("/api/v1/susceptibilidad").then((d) => {
        (map.getSource("suscep") as GeoJSONSource).setData(d);
      }));
    if (conZonas)
      pedidos.push(
        datos<{ zonas: FC; flechas: FC }>(`/api/v1/evacuacion?peligro=${peligro}`).then((d) => {
          if (!vigente) return;
          (map.getSource("zonas") as GeoJSONSource).setData(d.zonas);
          (map.getSource("flechas") as GeoJSONSource).setData(d.flechas);
        }),
      );
    Promise.all(pedidos)
      .catch(() => vigente && setAviso("No se pudieron cargar las capas del mapa. Recarga la página."))
      .finally(() => vigente && setCargandoCapa(false));
    return () => {
      vigente = false;
    };
  }, [peligro, listo, datos]);

  // En móvil los botones de peligro se deslizan: el elegido siempre a la vista.
  useEffect(() => {
    const b = chips.current?.querySelector<HTMLElement>('[aria-pressed="true"]');
    const nav = b?.closest("nav");
    if (b && nav) nav.scrollTo({ left: b.offsetLeft - nav.clientWidth / 2 + b.offsetWidth / 2, behavior: "smooth" });
  }, [peligro]);

  // En móvil el resultado queda debajo del mapa: se desplaza la vista hasta él.
  useEffect(() => {
    if (resultado && !window.matchMedia("(min-width: 1024px)").matches) panel.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [resultado, vista]);

  const cerrar = () => {
    setResultado(null);
    marcador.current?.remove();
  };
  const volverAlMapa = () => window.scrollTo({ top: 0, behavior: "smooth" });
  const usarUbicacion = () => {
    if (!geolocalizar.current?.trigger()) setAviso("Tu navegador no permite usar la ubicación. Toca el punto en el mapa.");
  };
  const irALugar = (l: { coordenadas: [number, number] }) => {
    const [lng, lat] = l.coordenadas;
    mapa.current?.flyTo({ center: [lng, lat], zoom: 17 });
    consultar({ lng, lat });
  };
  const info = INFO_PELIGRO[peligro];

  return (
    <div className="grid lg:h-[calc(100dvh-57px)] lg:grid-cols-[1fr_400px]">
      <div className="relative h-[64dvh] min-h-96 lg:h-full">
        <div ref={contenedor} className="h-full w-full" role="region" aria-label={`Mapa de ${info.nombre.toLowerCase()} en Huaraz`} />

        <div className="pointer-events-none absolute inset-x-3 top-3 flex flex-col gap-2 pr-12 lg:max-w-md">
          <div className="pointer-events-auto">
            <BuscadorLugares onElegir={irALugar} onUbicacion={usarUbicacion} />
          </div>
          <nav aria-label="Elegir peligro" className="pointer-events-auto -mx-3 overflow-x-auto px-3 pb-1">
            <ul ref={chips} className="flex w-max gap-1.5 lg:w-auto lg:flex-wrap">
              {PELIGROS.map((p) => (
                <li key={p}>
                  <button
                    type="button"
                    aria-pressed={p === peligro}
                    onClick={() => setPeligro(p)}
                    className="h-9 rounded-full border border-line bg-surface px-3.5 text-sm shadow-sm aria-pressed:border-accent aria-pressed:bg-accent aria-pressed:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    {INFO_PELIGRO[p].corto}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {(cargandoCapa || consultando) && (
          <p role="status" className="absolute bottom-8 left-1/2 -translate-x-1/2 rounded-full bg-surface/95 px-3 py-1 text-xs shadow">
            {consultando ? "Consultando el punto…" : "Cargando capa…"}
          </p>
        )}
      </div>

      <aside ref={panel} className="flex scroll-mt-2 flex-col gap-3 border-line p-3 lg:overflow-y-auto lg:border-l lg:p-4">
        {resultado && (
          <button
            type="button"
            onClick={volverAlMapa}
            className="flex min-h-11 items-center gap-1.5 self-start rounded-full border border-line bg-surface px-4 text-sm font-semibold shadow-sm lg:hidden"
          >
            <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 15l6-6 6 6" />
            </svg>
            Volver al mapa
          </button>
        )}

        {aviso && (
          <p role="alert" className="rounded-lg border border-line bg-surface p-3 text-sm">
            {aviso}
          </p>
        )}

        {resultado && vista === "construir" ? (
          <VistaConstruccion resultado={resultado} onVolver={() => setVista("resultado")} />
        ) : resultado ? (
          <TarjetaResultado resultado={resultado} peligro={peligro} onElegirPeligro={setPeligro} onCerrar={cerrar} onConstruir={() => setVista("construir")} />
        ) : (
          <section className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4">
            <h2 className="text-lg font-semibold">¿Qué peligros hay donde vives?</h2>
            <p className="text-sm text-muted">Toca tu cuadra en el mapa, busca un lugar o usa tu ubicación.</p>
            <button
              type="button"
              onClick={usarUbicacion}
              className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-accent font-semibold text-white hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
              </svg>
              Usar mi ubicación
            </button>
            <p className="text-xs text-muted">{info.descripcion}</p>
          </section>
        )}

        <details open={!resultado} className="rounded-xl border border-line bg-surface p-3 text-sm">
          <summary className="cursor-pointer font-medium">Leyenda: {info.nombre.toLowerCase()}</summary>
          <ul className="mt-2 space-y-1">
            {leyenda(peligro).map((f) => (
              <li key={f.nivel} className="flex items-center gap-2">
                <span aria-hidden className="size-3.5 shrink-0 rounded-sm border border-black/15" style={{ backgroundColor: f.color }} />
                {f.texto}
              </li>
            ))}
            {LEYENDA_SEGUROS[peligro] && (
              <li className="flex items-center gap-2">
                <span aria-hidden className="size-3.5 shrink-0 rounded-full border-2 border-white bg-[#2e7d32] shadow" />
                {LEYENDA_SEGUROS[peligro]}
              </li>
            )}
            {peligro === "aluvion" && (
              <li className="flex items-center gap-2">
                <span aria-hidden className="w-3.5 shrink-0 text-center font-bold text-[#10307a]">↑</span>
                Dirección de evacuación
              </li>
            )}
            {peligro === "huaico" && (
              <li className="text-xs text-muted">
                Solo hechos, sin predicción. Rojo: huaicos que ya ocurrieron (INGEMMET, INDECI, INAIGEM, prensa). Azul fuerte: zonas críticas por huaico del
                INGEMMET y el camino por el que bajaría el lodo desde cada huaico documentado, siguiendo el relieve hasta el río
                Santa. Los huaicos con ubicación aproximada (barrio o caserío) se muestran solo como un punto, sin área roja.
              </li>
            )}
          </ul>
          <p className="mt-2 text-xs text-muted">
            Las manzanas se colorean con el nivel más alto que las toca. Los círculos indican una ubicación aproximada.
          </p>
        </details>
      </aside>
    </div>
  );
}
