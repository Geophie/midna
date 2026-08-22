import path from "node:path";
import { expect, test } from "@playwright/test";

/**
 * Diagnostic-only spec: isolates the DEM upload step to verify the page
 * stays responsive (no main-thread freeze) while a large real DEM file is
 * being read, using rAF-tick counting the same way the earlier next-dev
 * freeze was measured. Delete once the investigation concludes.
 */

const dem = path.resolve("C:/Users/giaco/Desktop/scriptgiacomo/datsetgio/dem/output_NASADEM.tif");

test("DEM upload does not block the main thread", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/");
  await page.getByRole("tab", { name: "Layers" }).click();
  await page.getByRole("button", { name: "DEM" }).click();

  // Start counting animation frames; a blocked main thread means ticks stop.
  await page.evaluate(() => {
    (window as unknown as { __ticks: number }).__ticks = 0;
    function tick() {
      (window as unknown as { __ticks: number }).__ticks++;
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });

  const before = await page.evaluate(() => (window as unknown as { __ticks: number }).__ticks);

  const uploadStart = Date.now();
  await page.getByLabel("File (GeoTIFF / HGT)").setInputFiles(dem);
  await expect(page.getByText(/output_NASADEM\.tif/)).toBeVisible({ timeout: 60_000 });
  const uploadMs = Date.now() - uploadStart;

  const after = await page.evaluate(() => (window as unknown as { __ticks: number }).__ticks);
  const ticksDuringUpload = after - before;
  const expectedMinTicks = Math.floor((uploadMs / 1000) * 30); // conservative: >=30fps floor

  console.log(`upload took ${uploadMs}ms, rAF ticks during upload: ${ticksDuringUpload} (expected >= ~${expectedMinTicks} if responsive)`);

  // If the main thread were blocked for the whole upload, ticks would be ~0
  // regardless of upload duration. A healthy page keeps ticking throughout.
  expect(ticksDuringUpload).toBeGreaterThan(5);
});
