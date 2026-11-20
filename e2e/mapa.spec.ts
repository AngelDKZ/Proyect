import { expect, test } from "@playwright/test";

/** Recorrido principal: abrir el mapa, buscar un lugar, ver la tarjeta y "¿Puedo construir aquí?". */
test("buscar Chua Bajo → tarjeta → ¿Puedo construir aquí?", async ({ page }) => {
  const errores: string[] = [];
  page.on("pageerror", (e) => errores.push(e.message));
  page.on("console", (m) => m.type() === "error" && errores.push(m.text()));

  await page.goto("/mapa?peligro=deslizamiento");
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  await expect(page.getByRole("status")).toHaveCount(0, { timeout: 60_000 }); // capas cargadas

  await page.getByRole("combobox", { name: "Buscar un lugar" }).fill("chua");
  await page.getByRole("option", { name: /Chua Bajo/ }).click();

  const titulo = page.locator("article h2").first();
  await expect(titulo).toHaveText("Deslizamiento: dentro de un deslizamiento medido", { timeout: 20_000 });
  await expect(page.getByText("¿Cada cuánto pasa?")).toBeVisible();

  await page.getByRole("button", { name: "¿Puedo construir aquí?" }).click();
  await expect(page.getByRole("heading", { name: "No construyas aquí" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Lo que revisamos en este punto" })).toBeVisible();

  expect(errores).toEqual([]);
});

/** El huaico solo muestra hechos: la leyenda no tiene predicción ni "cerca de un río". */
test("leyenda del huaico sin predicción", async ({ page }) => {
  await page.goto("/mapa?peligro=huaico");
  const leyenda = page.locator("details").filter({ hasText: "Leyenda: huaico" });
  await expect(leyenda).toContainText("Ya bajó un huaico aquí");
  await expect(leyenda).not.toContainText("zona de inicio");
  await expect(leyenda).not.toContainText("Cerca de un río");
});

/** Botón Emergencia: números para llamar (funcionan sin internet) y aviso del 911. */
test("pantalla de emergencia", async ({ page }) => {
  const errores: string[] = [];
  page.on("pageerror", (e) => errores.push(e.message));
  await page.goto("/mapa?peligro=huaico");
  await expect(page.getByRole("status")).toHaveCount(0, { timeout: 60_000 });
  await page.getByRole("link", { name: "Emergencia" }).click();
  await expect(page).toHaveURL(/\/emergencia$/);
  for (const n of ["105", "116", "106", "115"]) await expect(page.locator(`a[href="tel:${n}"]`).first()).toBeVisible();
  await expect(page.getByText(/911 todavía no funciona en Huaraz/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Qué hacer ahora: aluvión" })).toBeVisible();

  // Volver al mapa: regresa a donde estaba (mismo peligro).
  await page.getByRole("link", { name: "Volver al mapa" }).click();
  await expect(page).toHaveURL(/\/mapa\?peligro=huaico/);
  await expect(page.locator(".maplibregl-canvas")).toBeVisible();
  await expect(page.getByRole("button", { name: "Huaico", pressed: true })).toBeVisible();
  await page.waitForTimeout(2500); // el mapa nuevo termina de cargar sus capas
  expect(errores).toEqual([]); // antes: "Style is not done loading"
});

test("entrar directo a Emergencia y volver lleva al mapa", async ({ page }) => {
  await page.goto("/emergencia");
  await page.getByRole("link", { name: "Volver al mapa" }).click();
  await expect(page).toHaveURL(/\/mapa$/);
});

/** Desde Emergencia: ruta a pie al lugar seguro, que evita la zona de aluvión. */
test("ruta al lugar seguro desde el cono del Quillcay", async ({ page }) => {
  await page.goto("/mapa?peligro=aluvion&lon=-77.5309&lat=-9.5268&ruta=1");
  await expect(page.getByRole("heading", { name: "Lugar seguro y ruta a pie" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Cómo llegar" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("hasta salir de la zona de peligro")).toBeVisible();
});
