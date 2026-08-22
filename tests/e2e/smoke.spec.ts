import path from "node:path";
import { expect, test } from "@playwright/test";

const fixture = path.join(process.cwd(), "tests", "e2e", "fixtures", "crimes.csv");

test("upload CSV, run analysis in a real browser Worker, get ranked results", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("pageerror", (err) => consoleErrors.push(String(err)));

  await page.goto("/");

  await page.setInputFiles('input[type="file"]', fixture);
  await expect(page.getByText(/crimes\.csv caricato/)).toBeVisible();

  await page.getByRole("tab", { name: "Parametri" }).click();
  await page.getByLabel("Celle X").fill("20");
  await page.getByLabel("Celle Y").fill("20");

  await page.getByRole("button", { name: "Esegui analisi" }).click();

  await expect(page.getByText(/reati usati.*griglia di \d+ celle/)).toBeVisible({
    timeout: 120_000,
  });

  await expect(page.locator("table tbody tr").first()).toBeVisible();
  const rowCount = await page.locator("table tbody tr").count();
  expect(rowCount).toBeGreaterThan(0);

  expect(consoleErrors).toEqual([]);
});
