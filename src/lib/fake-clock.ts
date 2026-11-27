// Fausse horloge pour les tests : `sleep` avance le temps instantanément et note les attentes.
import type { Clock } from "./rate-limit";

export interface FakeClock extends Clock {
  sleeps: number[];
}

export function createFakeClock(start = 0): FakeClock {
  let t = start;
  const sleeps: number[] = [];
  return {
    sleeps,
    now: () => t,
    sleep: async (ms) => {
      sleeps.push(ms);
      t += ms;
    },
  };
}
