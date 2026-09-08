import path from "node:path";
import { expect, test } from "@playwright/test";

const fixture = path.join(process.cwd(), "tests", "e2e", "fixtures", "crimes.csv");

test("clicking Stop mid-run cancels cleanly, without surfacing an error", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("pageerror", (err) => consoleErrors.push(String(err)));

  await page.goto("/");
  await page.setInputFiles('input[type="file"]', fixture);
  await expect(page.getByText(/crimes\.csv loaded/)).toBeVisible();

  // Large grid so the run stays in progress long enough for Stop to land.
  await page.getByRole("tab", { name: "Parameters" }).click();
  await page.getByLabel("Cells X").fill("200");
  await page.getByLabel("Cells Y").fill("200");

  await page.getByRole("button", { name: "Run analysis" }).click();
  await page.getByRole("button", { name: "Stop" }).click();

  // Regression guard: Run must stay disabled while "cancelling" — otherwise a
  // second run can start before the first fully stops and reset the shared
  // cancelRequested flag out from under it.
  await expect(page.getByRole("button", { name: "Run analysis" })).toBeDisabled();

  await expect(page.getByText("Analysis stopped by user.")).toBeVisible({
    timeout: 60_000,
  });

  await expect(page.getByText(/^Error:/)).not.toBeVisible();
  await expect(page.locator("table")).not.toBeVisible();
  expect(consoleErrors).toEqual([]);
});
