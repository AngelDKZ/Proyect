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
