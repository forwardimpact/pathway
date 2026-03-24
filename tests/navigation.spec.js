import { test, expect } from "@playwright/test";

test("navigation between pages works", async ({ page }) => {
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

  // Navigate via hash to disciplines page
  await page.goto("./#/discipline", { waitUntil: "domcontentloaded" });
  await expect(page.locator("h1")).toContainText("Discipline");

  // Navigate to behaviours
  await page.goto("./#/behaviour", { waitUntil: "domcontentloaded" });
  await expect(page.locator("h1")).toContainText("Behaviour");

  // Return home via nav brand link
  await page.locator("a.nav-brand").click();
  await expect(page.locator("h1")).toContainText("Engineering Pathway");

  // Check no JS errors occurred
  expect(errors).toEqual([]);
});
