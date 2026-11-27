// Limiteur de débit et nouvelles tentatives, génériques (aucune dépendance à une API).

/** Horloge injectable : la vraie en production, une fausse dans les tests pour ne pas attendre. */
export interface Clock {
  now(): number;
  sleep(ms: number): Promise<void>;
}

export const systemClock: Clock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

export interface RateLimiter {
  /** Attend si besoin pour rester sous la limite, puis réserve une place. */
  acquire(): Promise<void>;
}

/**
 * Fenêtre glissante : au plus `limit` appels sur n'importe quelle période de `windowMs`.
 * Les appels sont servis dans l'ordre d'arrivée (file de promesses).
 */
export function createRateLimiter({
  limit,
  windowMs,
  clock = systemClock,
}: {
  limit: number;
  windowMs: number;
  clock?: Clock;
}): RateLimiter {
  const timestamps: number[] = [];
  let queue: Promise<void> = Promise.resolve();

  async function take(): Promise<void> {
    for (;;) {
      const now = clock.now();
      while (timestamps.length > 0 && (timestamps[0] ?? 0) <= now - windowMs) timestamps.shift();
      if (timestamps.length < limit) {
        timestamps.push(now);
        return;
      }
      // Attendre que le plus ancien appel sorte de la fenêtre.
      await clock.sleep((timestamps[0] ?? now) + windowMs - now);
    }
  }

  return {
    acquire() {
      const turn = queue.then(take);
      // La file continue même si un appel échoue (ce qui ne devrait pas arriver).
      queue = turn.catch(() => undefined);
      return turn;
    },
  };
}

export interface RetryOptions {
  /** Nombre de nouvelles tentatives après le premier essai. */
  retries: number;
  /** Attente avant la 1re nouvelle tentative, doublée ensuite (1 s, 2 s, 4 s...). */
  baseDelayMs: number;
  shouldRetry(error: unknown): boolean;
  /** Délai imposé par l'API (ex. en-tête Retry-After), prioritaire s'il est connu. */
  delayFor?(error: unknown): number | null;
  clock?: Clock;
}

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions): Promise<T> {
  const clock = options.clock ?? systemClock;
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (attempt >= options.retries || !options.shouldRetry(e)) throw e;
      const delay = options.delayFor?.(e) ?? options.baseDelayMs * 2 ** attempt;
      await clock.sleep(delay);
    }
  }
}
