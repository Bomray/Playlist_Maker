import { afterEach, describe, expect, it, vi } from "vitest";
import { runSpotifyWriteTest } from "./dev-test";

const searchOk = {
  tracks: {
    items: [{ uri: "spotify:track:abc", name: "Titre", artists: [{ name: "Artiste" }] }],
  },
};
const createdOk = {
  id: "pl1",
  name: "Playlist_Maker test",
  public: false,
  external_urls: { spotify: "https://open.spotify.com/playlist/pl1" },
};

function stubResponses(...responses: Response[]) {
  const fn = vi.fn();
  for (const r of responses) fn.mockResolvedValueOnce(r);
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("runSpotifyWriteTest", () => {
  it("enchaîne recherche, création et ajout", async () => {
    const fetchMock = stubResponses(
      new Response(JSON.stringify(searchOk)),
      new Response(JSON.stringify(createdOk), { status: 201 }),
      new Response(JSON.stringify({ snapshot_id: "snap" }), { status: 201 }),
    );
    const steps = await runSpotifyWriteTest("tok");
    expect(steps.map((s) => s.ok)).toEqual([true, true, true]);

    const [, addInit] = fetchMock.mock.calls[2] as [string, RequestInit];
    expect(fetchMock.mock.calls[2]?.[0]).toBe("https://api.spotify.com/v1/playlists/pl1/items");
    expect(JSON.parse(addInit.body as string)).toEqual({ uris: ["spotify:track:abc"] });
  });

  it("s'arrête sur un 403 et garde le corps exact", async () => {
    stubResponses(
      new Response(JSON.stringify(searchOk)),
      new Response('{"error":{"status":403,"message":"Forbidden"}}', { status: 403 }),
    );
    const steps = await runSpotifyWriteTest("tok");
    expect(steps).toHaveLength(2);
    expect(steps[1]).toMatchObject({ ok: false, httpStatus: 403, errorKind: "forbidden" });
    expect(steps[1]?.output).toContain('"message": "Forbidden"');
  });

  it("signale un ISRC introuvable sans créer de playlist", async () => {
    const fetchMock = stubResponses(new Response(JSON.stringify({ tracks: { items: [] } })));
    const steps = await runSpotifyWriteTest("tok");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(steps.at(-1)).toMatchObject({ ok: false, errorKind: "not_found" });
  });
});
