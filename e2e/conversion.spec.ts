import { expect, test } from "@playwright/test";
import { encodeEvent } from "../src/lib/conversion-stream";
import { mockConvert, report, signIn } from "./fixtures/conversion";

test("sans connexion : invitation à se connecter à Spotify", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Se connecter à Spotify" })).toBeVisible();
  await expect(page.getByLabel("Lien de la playlist")).toHaveCount(0);
});

test("lien → récap → validation d'un incertain", async ({ page }) => {
  await signIn(page);
  await mockConvert(
    page,
    [
      encodeEvent({ type: "playlist", name: "French rap", source: "deezer", total: 3 }),
      encodeEvent({ type: "progress", done: 3, total: 3 }),
      encodeEvent({ type: "done", report }),
    ].join(""),
  );
  await page.goto("/");
  await page.getByLabel("Lien de la playlist").fill("https://www.deezer.com/playlist/42");
  await page.getByRole("button", { name: "Convertir vers Spotify" }).click();

  await expect(page.getByRole("heading", { name: "Récapitulatif : « French rap »" })).toBeFocused();
  await expect(page.getByText("1 titre sur 3 sera ajouté.")).toBeVisible();
  await expect(page.getByText("Incertains (1)")).toBeVisible();
  await expect(page.getByText("Introuvables (1)")).toBeVisible();

  await page.getByRole("button", { name: "Valider la proposition pour « Hide »" }).click();
  await expect(page.getByText("2 titres sur 3 seront ajoutés.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Créer la playlist (2 titres)" })).toBeEnabled();

  // Retirer remet le compteur à 1.
  await page.getByRole("button", { name: "Retirer « Hide »" }).click();
  await expect(page.getByText("1 titre sur 3 sera ajouté.")).toBeVisible();
});

test("erreur typée affichée, formulaire conservé", async ({ page }) => {
  await signIn(page);
  await mockConvert(
    page,
    encodeEvent({
      type: "error",
      error: {
        kind: "not_found",
        provider: "deezer",
        message: "Playlist introuvable",
        retryAfterSeconds: null,
      },
    }),
  );
  await page.goto("/");
  await page.getByLabel("Lien de la playlist").fill("https://www.deezer.com/playlist/1");
  await page.getByRole("button", { name: "Convertir vers Spotify" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Introuvable" })).toContainText(
    "Deezer : Playlist introuvable",
  );
  await expect(page.getByLabel("Lien de la playlist")).toBeVisible();
});
