import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildAuthorizeUrl,
  buildTokenRequest,
  exchangeCode,
  missingScopes,
  refreshTokens,
} from "./auth";

const base = { clientId: "mon-client", redirectUri: "http://127.0.0.1:3000/callback" };

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("buildAuthorizeUrl", () => {
  it("contient les paramètres PKCE, les scopes et l'URI de redirection", () => {
    const url = new URL(buildAuthorizeUrl(base, { codeChallenge: "chal", state: "st" }));
    expect(url.origin + url.pathname).toBe("https://accounts.spotify.com/authorize");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("mon-client");
    expect(url.searchParams.get("scope")).toBe(
      "playlist-modify-private playlist-read-private user-read-private user-read-recently-played",
    );
    expect(url.searchParams.get("redirect_uri")).toBe("http://127.0.0.1:3000/callback");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBe("chal");
    expect(url.searchParams.get("state")).toBe("st");
  });
});

describe("missingScopes", () => {
  it("liste les scopes absents d'une ancienne session", () => {
    expect(missingScopes("playlist-read-private playlist-modify-private")).toEqual([
      "user-read-private",
      "user-read-recently-played",
    ]);
    expect(
      missingScopes(
        "user-read-private playlist-read-private playlist-modify-private user-read-recently-played",
      ),
    ).toEqual([]);
    expect(missingScopes("")).toHaveLength(4);
  });
});

describe("buildTokenRequest", () => {
  it("avec secret : en-tête Basic, pas de client_id dans le corps", () => {
    const { headers, body } = buildTokenRequest(
      { ...base, clientSecret: "s3cret" },
      { grant_type: "x" },
    );
    expect(headers.Authorization).toBe(
      `Basic ${Buffer.from("mon-client:s3cret").toString("base64")}`,
    );
    expect(body.has("client_id")).toBe(false);
  });

  it("sans secret : pas d'en-tête Authorization, client_id dans le corps", () => {
    const { headers, body } = buildTokenRequest(base, { grant_type: "x" });
    expect(headers.Authorization).toBeUndefined();
    expect(body.get("client_id")).toBe("mon-client");
  });
});

describe("échanges de tokens", () => {
  it("exchangeCode envoie le code et le verifier, et calcule l'expiration", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "at",
          token_type: "Bearer",
          expires_in: 3600,
          scope: "playlist-modify-private",
          refresh_token: "rt",
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const before = Date.now();
    const tokens = await exchangeCode(base, { code: "c0de", codeVerifier: "verif" });

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = init.body as URLSearchParams;
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("code")).toBe("c0de");
    expect(body.get("code_verifier")).toBe("verif");
    expect(body.get("redirect_uri")).toBe(base.redirectUri);
    expect(tokens.accessToken).toBe("at");
    expect(tokens.refreshToken).toBe("rt");
    expect(tokens.expiresAt).toBeGreaterThanOrEqual(before + 3600_000);
  });

  it("refreshTokens garde l'ancien refresh token si Spotify n'en renvoie pas", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ access_token: "at2", token_type: "Bearer", expires_in: 60 }),
          ),
        ),
    );
    const tokens = await refreshTokens(base, "ancien-rt");
    expect(tokens.accessToken).toBe("at2");
    expect(tokens.refreshToken).toBe("ancien-rt");
  });
});
