import path from "node:path";
import { expect, test } from "@playwright/test";

const fixture = path.join(process.cwd(), "tests", "e2e", "fixtures", "crimes.csv");

test("outside-AOI distance reaches the real browser worker and output", async ({ page }) => {
  await page.goto(process.env.MIDNA_E2E_URL ?? "/");
  await page.setInputFiles('input[type="file"]', fixture);

  await page.getByRole("switch").nth(1).click();
  await page.getByLabel(/Anchor latitude|Latitudine anchor/).fill("40");
  await page.getByLabel(/Anchor longitude|Longitudine anchor/).fill("-100");

  await page.getByRole("tab", { name: /Parameters|Parametri/ }).click();
  await page.getByLabel(/Cells X|Celle X/).fill("10");
  await page.getByLabel(/Cells Y|Celle Y/).fill("10");
  await page.getByRole("button", { name: /Run analysis|Esegui analisi/ }).click();

  await expect(page.getByText(/Known anchor outside the analysis grid|Anchor point noto fuori dalla griglia analizzata/)).toBeVisible({ timeout: 120_000 });
  await expect(page.getByText(/Distance to nearest grid cell|Distanza dalla cella più vicina/)).toBeVisible();
});
