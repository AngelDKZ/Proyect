// Copia el worker de MapLibre 6 a public/: el bundler renombra los módulos y MapLibre no lo encuentra
// por sí solo. Se ejecuta antes de `dev` y `build`, así siempre coincide con la versión instalada.
import { copyFileSync, mkdirSync } from "node:fs";

mkdirSync("public/vendor", { recursive: true });
copyFileSync("node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs", "public/vendor/maplibre-gl-worker.mjs");
console.log("worker de MapLibre copiado a public/vendor/");
