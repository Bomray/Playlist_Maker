import { describe, expect, it, vi } from "vitest";
import { createFakeClock } from "./fake-clock";
import { createRateLimiter, withRetry } from "./rate-limit";

describe("createRateLimiter", () => {
  it("laisse passer `limit` appels sans attendre", async () => {
    const clock = createFakeClock();
    const limiter = createRateLimiter({ limit: 3, windowMs: 1000, clock });
    await Promise.all([limiter.acquire(), limiter.acquire(), limiter.acquire()]);
    expect(clock.sleeps).toEqual([]);
  });

  it("fait attendre l'appel suivant jusqu'à la sortie du plus ancien de la fenêtre", async () => {
    const clock = createFakeClock();
    const limiter = createRateLimiter({ limit: 2, windowMs: 1000, clock });
    await limiter.acquire(); // t = 0
    await clock.sleep(300); // t = 300
    await limiter.acquire();
    clock.sleeps.length = 0;

    await limiter.acquire(); // doit attendre jusqu'à t = 1000
    expect(clock.sleeps).toEqual([700]);
    expect(clock.now()).toBe(1000);
  });

  it("ne dépasse jamais la limite sur une rafale", async () => {
    const clock = createFakeClock();
    const limiter = createRateLimiter({ limit: 5, windowMs: 1000, clock });
    const times: number[] = [];
    await Promise.all(
      Array.from({ length: 12 }, () => limiter.acquire().then(() => times.push(clock.now()))),
    );
    for (const t of times) {
      expect(times.filter((u) => u > t - 1000 && u <= t).length).toBeLessThanOrEqual(5);
    }
    expect(times).toHaveLength(12);
  });
});

describe("withRetry", () => {
  const retryable = new Error("quota");

  it("réessaie avec une attente qui double, puis réussit", async () => {
    const clock = createFakeClock();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(retryable)
      .mockRejectedValueOnce(retryable)
      .mockResolvedValue("ok");
    const result = await withRetry(fn, {
      retries: 3,
      baseDelayMs: 1000,
      shouldRetry: (e) => e === retryable,
      clock,
    });
    expect(result).toBe("ok");
    expect(clock.sleeps).toEqual([1000, 2000]);
  });

  it("abandonne après `retries` nouvelles tentatives", async () => {
    const clock = createFakeClock();
    const fn = vi.fn().mockRejectedValue(retryable);
    await expect(
      withRetry(fn, { retries: 2, baseDelayMs: 10, shouldRetry: () => true, clock }),
    ).rejects.toBe(retryable);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("ne réessaie pas une erreur non concernée", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("autre"));
    await expect(
      withRetry(fn, { retries: 3, baseDelayMs: 10, shouldRetry: () => false }),
    ).rejects.toThrow("autre");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("utilise le délai imposé par l'API s'il existe", async () => {
    const clock = createFakeClock();
    const fn = vi.fn().mockRejectedValueOnce(retryable).mockResolvedValue("ok");
    await withRetry(fn, {
      retries: 1,
      baseDelayMs: 10,
      shouldRetry: () => true,
      delayFor: () => 5000,
      clock,
    });
    expect(clock.sleeps).toEqual([5000]);
  });
});
