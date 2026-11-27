import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seal, unseal } from "@/lib/crypto-box";
import { createTestDb } from "@/lib/db/test-db";
import { findUserById, updateTokens } from "@/lib/db/users";
import { type AccountDeps, completeLogin, getValidAccessToken } from "./account";

const KEY = "cle-de-test-suffisamment-longue-1234567890";
let db: Awaited<ReturnType<typeof createTestDb>>;
let deps: AccountDeps;

beforeEach(async () => {
  db = await createTestDb();
  deps = {
    db,
    encryptionKey: KEY,
    auth: {
      clientId: "client",
      clientSecret: "secret",
      redirectUri: "http://127.0.0.1:3000/callback",
    },
  };
});
afterEach(async () => {
  vi.unstubAllGlobals();
  await db.close();
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

/** Simule Spotify : `/me` et `/api/token`. */
function stubSpotify(
  token: () => Response = () =>
    json({
      access_token: "acc-new",
      token_type: "Bearer",
      expires_in: 3600,
      scope: "s",
      refresh_token: "ref-new",
    }),
) {
  const fetchMock = vi.fn(async (url: string) => {
    if (url === "https://api.spotify.com/v1/me")
      return json({ id: "sp-user", display_name: "Ryan" });
    if (url === "https://accounts.spotify.com/api/token") return token();
    return json({ error: "route absente" }, 500);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const tokens = (expiresAt: number) => ({
  accessToken: "acc-1",
  refreshToken: "ref-1",
  expiresAt,
  scope: "s",
});

describe("completeLogin", () => {
  it("lit le profil et enregistre l'utilisateur avec des tokens chiffrés", async () => {
    stubSpotify();
    const user = await completeLogin(deps, tokens(Date.now() + 3_600_000));
    expect(user).toMatchObject({ spotify_user_id: "sp-user", display_name: "Ryan" });
    expect(user.access_token_enc).not.toContain("acc-1");
    expect(unseal(user.access_token_enc, KEY)).toBe("acc-1");
    expect(unseal(user.refresh_token_enc, KEY)).toBe("ref-1");
  });
});

describe("getValidAccessToken", () => {
  it("token encore valide : pas d'appel à Spotify", async () => {
    const fetchMock = stubSpotify();
    const user = await completeLogin(deps, tokens(Date.now() + 3_600_000));
    fetchMock.mockClear();
    expect(await getValidAccessToken(deps, user.id)).toBe("acc-1");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("token bientôt expiré : rafraîchi et enregistré (nouveau refresh token compris)", async () => {
    stubSpotify();
    const user = await completeLogin(deps, tokens(Date.now() + 10_000));
    expect(await getValidAccessToken(deps, user.id)).toBe("acc-new");
    const saved = await findUserById(db, user.id);
    expect(unseal(saved!.refresh_token_enc, KEY)).toBe("ref-new");
    expect(saved!.token_expires_at.getTime()).toBeGreaterThan(Date.now() + 3_000_000);
  });

  it("respecte une durée de validité minimale demandée", async () => {
    stubSpotify();
    const user = await completeLogin(deps, tokens(Date.now() + 10 * 60_000));
    expect(await getValidAccessToken(deps, user.id)).toBe("acc-1");
    expect(await getValidAccessToken(deps, user.id, 30 * 60_000)).toBe("acc-new");
  });

  it("rafraîchissement concurrent : utilise les tokens enregistrés par l'autre", async () => {
    // Pendant notre rafraîchissement (refusé), un autre processus a enregistré de nouveaux tokens.
    stubSpotify(() => json({ error: "invalid_grant" }, 400));
    const user = await completeLogin(deps, tokens(Date.now() + 10_000));
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockImplementationOnce(async () => {
      await updateTokens(db, user.id, {
        accessTokenEnc: seal("acc-autre", KEY),
        refreshTokenEnc: seal("ref-autre", KEY),
        expiresAt: new Date(Date.now() + 3_600_000),
        scope: "s",
      });
      return json({ error: "invalid_grant" }, 400);
    });
    expect(await getValidAccessToken(deps, user.id)).toBe("acc-autre");
  });

  it("refresh token révoqué : erreur « non connecté »", async () => {
    stubSpotify(() => json({ error: "invalid_grant" }, 400));
    const user = await completeLogin(deps, tokens(Date.now() + 10_000));
    await expect(getValidAccessToken(deps, user.id)).rejects.toMatchObject({
      kind: "unauthorized",
      provider: "spotify",
    });
  });

  it("utilisateur inconnu ou clé changée : « non connecté »", async () => {
    stubSpotify();
    await expect(
      getValidAccessToken(deps, "00000000-0000-4000-8000-000000000000"),
    ).rejects.toMatchObject({ kind: "unauthorized" });
    const user = await completeLogin(deps, tokens(Date.now() + 3_600_000));
    await expect(
      getValidAccessToken(
        { ...deps, encryptionKey: "une-autre-cle-tout-aussi-longue-0987654321" },
        user.id,
      ),
    ).rejects.toMatchObject({
      kind: "unauthorized",
    });
  });

  it("erreur réseau : remontée telle quelle (pas de déconnexion)", async () => {
    stubSpotify();
    const user = await completeLogin(deps, tokens(Date.now() + 10_000));
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError("fetch failed"));
    await expect(getValidAccessToken(deps, user.id)).rejects.toMatchObject({ kind: "network" });
  });
});
