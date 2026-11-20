import { defineConfig } from "@playwright/test";

/**
 * Pruebas en un navegador real (mapa MapLibre incluido).
 * Requiere la base cargada (npm run datos:todo). Localmente usa el Chrome instalado;
 * en CI se puede usar Chromium de Playwright con PW_CHROMIUM=1 (npx playwright install chromium).
 */
export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3200",
    channel: process.env.PW_CHROMIUM ? undefined : "chrome",
    // MapLibre necesita WebGL: en modo sin ventana se usa el renderizador por software.
    launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] },
  },
  projects: [
    { name: "escritorio", use: { viewport: { width: 1280, height: 860 } } },
    { name: "celular", use: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: {
    command: "npm run dev -- -p 3200",
    url: "http://localhost:3200/mapa",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
