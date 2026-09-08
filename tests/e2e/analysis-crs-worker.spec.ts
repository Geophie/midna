import { expect, test } from "@playwright/test";

test("analysis CRS advisory reaches the real browser worker", async ({ page }) => {
  const advisoryErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && message.text().includes("[crs] advisory inspection failed")) {
      advisoryErrors.push(message.text());
    }
  });

  await page.goto(process.env.MIDNA_E2E_URL ?? "/");
  await page.getByRole("tab", { name: "Parameters" }).first().click();
  const analysisCrs = page.getByLabel("Analysis CRS (output)");
  const warning = page.getByText("Geographic analysis CRS", { exact: true });

  await expect(warning).toBeVisible({ timeout: 120_000 });
  await analysisCrs.fill("EPSG:4269");
  await expect(warning).toBeVisible({ timeout: 120_000 });

  await analysisCrs.fill("EPSG:32616");
  await expect(warning).toHaveCount(0, { timeout: 120_000 });
  await analysisCrs.fill("EPSG:3857");
  await expect(warning).toHaveCount(0, { timeout: 120_000 });

  expect(advisoryErrors).toEqual([]);
});
