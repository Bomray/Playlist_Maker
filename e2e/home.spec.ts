import { expect, test } from "@playwright/test";

test("l'accueil affiche les stats sous la marque Wavl", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Wavl, accueil" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Mes stats d'écoute" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Stats", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("l'ancienne adresse /stats mène à l'accueil", async ({ page }) => {
  await page.goto("/stats");
  await expect(page).toHaveURL(/\/$/);
});

test("le bouton de thème passe en sombre puis en clair et s'en souvient", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  const html = page.locator("html");
  await expect(html).not.toHaveClass(/dark/);
  await page.getByRole("button", { name: /Thème du système/ }).click();
  await expect(html).toHaveClass(/dark/);
  await page.reload();
  await expect(html).toHaveClass(/dark/);
  await page.getByRole("button", { name: /Thème sombre/ }).click();
  await expect(html).not.toHaveClass(/dark/);
});
