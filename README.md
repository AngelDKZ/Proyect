# Mapa de Riesgo Comunitario – Huaraz

Aplicación web académica, sin fines de lucro, para que la población consulte los peligros de su zona: aluvión, inundación por lluvias, huaicos y deslizamientos. También muestra las zonas seguras y las rutas de evacuación. Toda la información viene de fuentes oficiales citadas, con su fecha.

- **Piloto:** distritos de Huaraz e Independencia (Áncash).
- **Requisitos y reglas del proyecto:** [CLAUDE.md](CLAUDE.md)
- **Fuentes de datos:** [docs/fuentes-de-datos.md](docs/fuentes-de-datos.md)
- **Decisiones de arquitectura:** [docs/adr/](docs/adr/)

## Requisitos

- Node.js 22 o superior
- Docker (en Mac: Colima o Docker Desktop) y `docker-compose`

## Puesta en marcha

```bash
cp .env.example .env      # variables de entorno locales
npm install               # dependencias (usa .npmrc del proyecto)
npm run db:up             # PostgreSQL 17 + PostGIS 3.5 en el puerto 5433
npm run db:migrate        # crea las tablas
npm run datos:todo        # carga los datos de Huaraz (se puede repetir)
npm run dev               # http://localhost:3000 → /mapa
```

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` / `npm start` | Compilación y servidor de producción |
| `npm run lint` | ESLint |
| `npm run typecheck` | Genera los tipos de rutas de Next.js y verifica TypeScript |
| `npm run test` | Pruebas (Vitest). Las de integración usan la base local si `DATABASE_URL` está definida; las de datos (mapa = tarjeta, caminos conectados, sin repetidos) se omiten si la base está vacía |
| `npm run check` | Lint + tipos + pruebas |
| `npm run test:e2e` | Pruebas en un navegador real (Playwright, con el Chrome instalado): buscar un lugar, tarjeta, «¿Puedo construir aquí?» y leyenda del huaico, en escritorio y celular. Requiere los datos cargados |
| `npm run db:up` / `db:down` | Levanta o detiene la base de datos local |
| `npm run db:generate` | Genera una migración a partir de `src/lib/db/schema.ts` |
| `npm run db:migrate` | Aplica las migraciones |
| `npm run db:studio` | Explorador visual de la base (Drizzle Studio) |
| `npm run db:cargar` | Vacía y vuelve a cargar los datos de Huaraz desde `data/` (repara geometrías inválidas) |
| `npm run datos:todo` | **Regenera todos los datos en el orden correcto:** carga la base, calcula los caminos aguas abajo de los huaicos y vuelve a cargar. Usar este después de cambiar cualquier archivo de `data/` |
| `npm run datos:caminos` | Solo recalcula los caminos aguas abajo (necesita la base cargada) |

`dev` y `build` copian antes el worker de MapLibre a `public/vendor/` (MapLibre 6 lo necesita como archivo aparte; no se versiona).

## Estructura

```
src/app/            páginas y rutas (Next.js 16, App Router)
  mapa/             mapa interactivo de peligros
  api/v1/           API: capas por peligro, susceptibilidad, evacuación y consulta de un punto
src/features/riesgo/
  peligros.ts       peligros, niveles (-1 evaluado · 0 sin información · 1..4) y colores
  veredicto.ts      regla del veredicto (función pura, con pruebas)
  server/           consultas PostGIS y servicio de consulta de un punto
  construccion.ts   «¿Puedo construir aquí?» (función pura, con pruebas)
  frecuencia.ts     «¿Cada cuánto pasa?»
  mapa/             componentes del mapa (MapLibre), tarjeta de resultado y vista para construir
src/features/lugares/  buscador de barrios, calles y lugares
src/lib/env.ts      variables de entorno validadas con Zod
src/lib/db/         esquema (Drizzle), cliente y columnas PostGIS
drizzle/            migraciones SQL
scripts/db/         carga de datos a la base
scripts/etl/        digitalización e importación de datos (Python)
data/raw/           datos fuente descargados
data/processed/     capas procesadas (GeoJSON)
tools/visor-revision/  visor HTML para revisar los datos (no es la app)
docs/               fuentes de datos y decisiones (ADR)
```
