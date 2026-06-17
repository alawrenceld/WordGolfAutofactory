/**
 * Small, dependency-free deterministic RNG.
 *
 * `mulberry32` produces a well-distributed 32-bit stream from a numeric seed.
 * Determinism is essential: the daily puzzle must be identical for everyone on
 * a given UTC date, so we derive the seed from the date string via `hashSeed`.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a string hash -> 32-bit unsigned int, used to seed the RNG from a date. */
export function hashSeed(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Returns a deterministic RNG seeded from an arbitrary string. */
export function seededRng(seedString: string): () => number {
  return mulberry32(hashSeed(seedString));
}

/** Pick a random element using the provided RNG. */
export function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)];
}
