import { expect, test } from "@playwright/test";

const GITHUB_URL = "https://github.com/Geophie/midna";

test.use({ viewport: { width: 390, height: 844 } });

test("GitHub header access remains usable on a mobile viewport", async ({ page }) => {
  await page.goto(process.env.MIDNA_E2E_URL ?? "/");

  const github = page.locator(`header a[href="${GITHUB_URL}"]`);
  await expect(github).toBeVisible();
  await expect(github).toHaveAttribute("target", "_blank");
  await expect(github).toHaveAttribute("rel", "noopener noreferrer");
  await expect(page.locator('nav.fixed[role="tablist"]')).toBeVisible();

  const [brandBox, githubBox] = await Promise.all([
    page.getByRole("heading", { name: "MIDNA" }).boundingBox(),
    github.boundingBox(),
  ]);
  expect(brandBox).not.toBeNull();
  expect(githubBox).not.toBeNull();
  if (!brandBox || !githubBox) throw new Error("expected visible mobile header controls");
  expect(githubBox.x).toBeGreaterThanOrEqual(0);
  expect(githubBox.x + githubBox.width).toBeLessThanOrEqual(390);
  expect(githubBox.y).toBeGreaterThanOrEqual(brandBox.y + brandBox.height);
});
