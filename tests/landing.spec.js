import { test, expect } from "@playwright/test";

test("loads front page successfully", async ({ page }) => {
  const errors = [];

  page.on("pageerror", (error) => {
    errors.push(error.message);
  });

  // Abort external requests (fonts, prism) that are non-essential
  await page.route(
    (url) => !url.hostname.includes("localhost"),
    (route) => route.abort(),
  );

  await page.goto("./", { waitUntil: "domcontentloaded" });

  // Wait for the landing page h1 to appear (rendered by JavaScript).
  // Match on "Pathway" alone — the full title comes from the synthetic
  // standard.yaml and varies with each LLM regeneration of the prose
  // cache (e.g. "BioNova Engineering Excellence Pathway").
  await expect(page.locator("h1")).toContainText("Pathway");

  // Check no JS errors occurred
  expect(errors).toEqual([]);
});
