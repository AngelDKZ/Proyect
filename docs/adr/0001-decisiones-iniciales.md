# ADR 0001 – Decisiones iniciales de arquitectura

- **Fecha:** 19-11-2026
- **Estado:** aprobadas por el responsable del proyecto

| # | Decisión | Alternativa descartada | Motivo |
|---|---|---|---|
| 1 | **PostgreSQL + PostGIS** | PostgreSQL sin extensión espacial | El proyecto es geoespacial: consultas de "qué peligro hay en este punto", distancias, cobertura de datasets. |
| 2 | **Drizzle ORM** | Prisma | Prisma 7 no soporta columnas PostGIS de forma estable (`Unsupported("geometry")`). En Drizzle se definió una columna propia (`src/lib/db/geometry.ts`) que escribe GeoJSON con `ST_GeomFromGeoJSON` y lee EWKB → GeoJSON. Las consultas espaciales complejas se escriben en SQL. |
| 3 | **MapLibre GL + OpenFreeMap** (luego PMTiles propio) | Leaflet + teselas de openstreetmap.org | La política de uso de las teselas de OSM prohíbe la descarga masiva (incompatible con el modo sin conexión) y no admite tráfico de producción. MapLibre usa teselas vectoriales y rinde mejor con muchas geometrías. |
| 4 | **Stack de costo $0** | Servicios de pago | Proyecto académico. Neon (región AWS; las regiones Azure borran proyectos gratuitos inactivos), Vercel Hobby (uso no comercial), Cloudflare R2, Better Auth (sin costo por usuario). |
| 5 | **Piloto: Huaraz e Independencia** | Lurigancho-Chosica | Es el único lugar con zonas seguras y rutas de evacuación oficiales y recientes (mapa INAIGEM / Municipalidad, mayo 2025). Chosica queda para una expansión futura. |
| 6 | **Nunca decir "seguro"** | Semáforo verde | Que no haya datos no significa que no haya peligro. Cada consulta distingue "evaluado sin peligro identificado" de "sin información". |
| 7 | **Datos por manzana (INEI)** | Solo zonas sueltas | Las 1007 manzanas del INEI permiten mostrar toda la ciudad y marcar explícitamente "sin información". |
| 8 | **Imagen `imresamu/postgis` en desarrollo** | `postgis/postgis` | La imagen oficial solo existe para amd64. En Mac con Apple Silicon correría emulada. En CI (amd64) se usa la oficial. |
| 9 | **`.npmrc` con `legacy-peer-deps=true`** | Resolución estricta de peers | npm 10.9 falla (`edgesOut`) al resolver la cadena opcional `vite → @vitejs/devtools → vitest@*`. Todas las dependencias necesarias están declaradas de forma explícita. |

## Riesgos aceptados

- **4 vulnerabilidades moderadas en `drizzle-kit`** (vía `@esbuild-kit` → `esbuild`):
  - Afectan solo a herramientas de desarrollo, no a la app publicada.
  - La "solución" de npm es bajar a drizzle-kit 0.18, con cambios incompatibles.
  - **Acción:** revisar cuando salga drizzle-kit 1.0 estable.
