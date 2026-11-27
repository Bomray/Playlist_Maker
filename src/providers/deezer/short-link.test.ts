import { describe, expect, it, vi } from "vitest";
import { expandDeezerShortLink, isDeezerShortLink } from "./short-link";

function redirect(location: string, status = 302) {
  return new Response(null, { status, headers: { location } });
}

function fetchSequence(...responses: Response[]) {
  const fn = vi.fn<typeof fetch>();
  for (const r of responses) fn.mockResolvedValueOnce(r);
  return fn;
}

describe("isDeezerShortLink", () => {
  it.each([
    "https://link.deezer.com/s/30ABCdef",
    "link.deezer.com/s/30ABCdef",
    "https://deezer.page.link/xyz",
  ])("reconnaît %s", (url) => expect(isDeezerShortLink(url)).toBe(true));

  it.each([
    "https://www.deezer.com/playlist/1",
    "https://link.deezer.com.evil.com/s/1",
    "pas un lien",
  ])("rejette %s", (url) => expect(isDeezerShortLink(url)).toBe(false));
});

describe("expandDeezerShortLink", () => {
  it("renvoie null sans requête pour un lien qui n'est pas un lien court", async () => {
    const fetchImpl = fetchSequence();
    expect(await expandDeezerShortLink("https://www.deezer.com/playlist/1", fetchImpl)).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("suit la redirection sans la laisser faire au navigateur", async () => {
    const fetchImpl = fetchSequence(
      redirect("https://www.deezer.com/fr/playlist/16006480463?host=0&utm_campaign=share"),
    );
    const url = await expandDeezerShortLink("https://link.deezer.com/s/30ABCdef", fetchImpl);
    expect(url).toBe("https://www.deezer.com/fr/playlist/16006480463?host=0&utm_campaign=share");
    const [, init] = fetchImpl.mock.calls[0]!;
    expect(init).toMatchObject({ redirect: "manual" });
  });

  it("suit plusieurs sauts entre hôtes de liens courts", async () => {
    const fetchImpl = fetchSequence(
      redirect("https://deezer.page.link/abc"),
      redirect("https://www.deezer.com/playlist/42"),
    );
    expect(await expandDeezerShortLink("link.deezer.com/s/x", fetchImpl)).toBe(
      "https://www.deezer.com/playlist/42",
    );
  });

  it("refuse une redirection vers un autre hôte", async () => {
    const fetchImpl = fetchSequence(redirect("https://evil.example/playlist/42"));
    await expect(
      expandDeezerShortLink("https://link.deezer.com/s/x", fetchImpl),
    ).rejects.toMatchObject({
      kind: "not_found",
      provider: "deezer",
    });
  });

  it("lien inconnu : Deezer redirige vers /deezer-links-404", async () => {
    const fetchImpl = fetchSequence(redirect("https://www.deezer.com/deezer-links-404"));
    await expect(
      expandDeezerShortLink("https://link.deezer.com/s/x", fetchImpl),
    ).rejects.toMatchObject({
      kind: "not_found",
    });
  });

  it("s'arrête après trop de redirections", async () => {
    const loop = () => redirect("https://link.deezer.com/s/boucle");
    const fetchImpl = fetchSequence(loop(), loop(), loop(), loop());
    await expect(
      expandDeezerShortLink("https://link.deezer.com/s/x", fetchImpl),
    ).rejects.toMatchObject({
      kind: "not_found",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("erreur réseau typée", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("fetch failed"));
    await expect(
      expandDeezerShortLink("https://link.deezer.com/s/x", fetchImpl),
    ).rejects.toMatchObject({
      kind: "network",
    });
  });
});
