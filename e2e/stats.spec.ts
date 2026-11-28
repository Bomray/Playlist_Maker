import { expect, test } from "@playwright/test";
import { strToU8, zipSync } from "fflate";
import { signIn } from "./fixtures/conversion";

// Sur un serveur qui démarre, le worker est compilé à sa première utilisation (plusieurs
// secondes, davantage quand les tests tournent en parallèle) : marge large pour tout le fichier.
test.describe.configure({ timeout: 90_000 });

// Export inventé : 3 écoutes de « Titre A » et 1 de « Titre B » en 2024, 1 en 2025,
// 1 lecture passée (< 30 s) et 1 épisode de podcast.
function entry(ts: string, ms: number, title: string | null, episode: string | null = null) {
  return {
    ts,
    ms_played: ms,
    ip_addr: "203.0.113.7",
    master_metadata_track_name: title,
    master_metadata_album_artist_name: title ? "Artiste test" : null,
    master_metadata_album_album_name: title ? "Album test" : null,
    spotify_track_uri: title ? `spotify:track:${title.replace(/\W/g, "")}` : null,
    episode_name: episode,
    episode_show_name: episode ? "Podcast test" : null,
    skipped: false,
  };
}

const history = [
  entry("2024-03-10T20:00:00Z", 3_600_000, "Titre A"),
  entry("2024-03-11T20:00:00Z", 3_600_000, "Titre A"),
  entry("2024-03-12T20:00:00Z", 3_600_000, "Titre A"),
  entry("2024-04-01T08:00:00Z", 3_600_000, "Titre B"),
  entry("2024-04-01T08:10:00Z", 5_000, "Titre B"),
  entry("2025-01-05T12:00:00Z", 3_600_000, "Titre B"),
  entry("2025-01-06T12:00:00Z", 1_800_000, null, "Épisode 1"),
];

function exportZip(): Buffer {
  const zip = zipSync({
    "Spotify Extended Streaming History/Streaming_History_Audio_2024-2025_0.json": strToU8(
      JSON.stringify(history),
    ),
    "Spotify Extended Streaming History/ReadMeFirst_ExtendedStreamingHistory.pdf": strToU8("%PDF"),
  });
  return Buffer.from(zip);
}

test("export .zip → chiffres clés, tops et filtre par année", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel(/Dépose ton export Spotify/).setInputFiles({
    name: "my_spotify_data.zip",
    mimeType: "application/zip",
    buffer: exportZip(),
  });

  // 5 h d'écoute de musique (5 × 1 h + 5 s), 5 écoutes (la lecture de 5 s ne compte pas).
  const tiles = page.getByRole("region", { name: "Chiffres clés" });
  // Délai long : sur un serveur qui démarre, le worker est compilé à sa première utilisation.
  await expect(tiles).toContainText("300minutes d'écoute", { timeout: 60_000 });
  await expect(tiles).toContainText("5heures");
  await expect(tiles).toContainText("5écoutes");
  await expect(tiles).toContainText("Podcasts");
  await expect(page.getByRole("list").filter({ hasText: "Titre A" }).first()).toContainText(
    "3 écoutes",
  );

  await page.getByRole("button", { name: "2025" }).click();
  await expect(tiles).toContainText("1écoutes");
  await expect(page.getByRole("button", { name: "2025" })).toHaveAttribute("aria-pressed", "true");
});

test("fichier sans historique : message clair", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel(/Dépose ton export Spotify/).setInputFiles({
    name: "autre.zip",
    mimeType: "application/zip",
    buffer: Buffer.from(zipSync({ "Userdata.json": strToU8("{}") })),
  });
  // Filtre : Next.js ajoute sa propre zone role="alert" (annonce des changements de page).
  await expect(page.getByRole("alert").filter({ hasText: "Lecture impossible" })).toContainText(
    "Aucun historique d'écoute trouvé",
    { timeout: 60_000 },
  );
});

test("connecté : enregistrer l'export, le retrouver, puis le supprimer", async ({
  page,
}, testInfo) => {
  // Une seule exécution : desktop et mobile partagent l'utilisateur de test et son historique.
  test.skip(testInfo.project.name !== "desktop", "parcours avec écriture en base : une seule fois");
  await signIn(page);
  // Point de départ propre (le serveur de test peut être réutilisé d'une exécution à l'autre).
  await page.request.delete("/api/stats/history");

  await page.goto("/");
  await expect(page.getByText("Aucun historique enregistré dans ton compte")).toBeVisible({
    timeout: 60_000,
  });

  await page.getByLabel(/Dépose ton export Spotify/).setInputFiles({
    name: "my_spotify_data.zip",
    mimeType: "application/zip",
    buffer: exportZip(),
  });
  const tiles = page.getByRole("region", { name: "Chiffres clés" });
  await expect(tiles).toContainText("5écoutes", { timeout: 60_000 });

  await page.getByRole("button", { name: "Enregistrer dans mon compte" }).click();
  await expect(page.getByText(/7 nouvelles/)).toBeVisible();

  // Rechargement : l'historique vient maintenant du compte, sans redéposer le fichier.
  await page.reload();
  await expect(page.getByText("7 écoutes enregistrées")).toBeVisible({ timeout: 60_000 });
  await expect(tiles).toContainText("5écoutes");

  await page.getByRole("button", { name: "Supprimer mes données d'écoute" }).click();
  await page.getByRole("button", { name: "Oui, tout supprimer" }).click();
  await expect(page.getByText("7 écoutes supprimées de ton compte.")).toBeVisible();
});
