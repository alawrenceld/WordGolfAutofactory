/**
 * Golf-style scoring relative to par.
 *
 * `relativeToPar` is moves - par (negative is better). `scoreLabel` maps the
 * common golf terms; anything beyond double bogey is reported as "+N".
 */
export function relativeToPar(moves: number, par: number): number {
  return moves - par;
}

export function scoreLabel(moves: number, par: number): string {
  const delta = relativeToPar(moves, par);
  switch (delta) {
    case -3:
      return "Albatross";
    case -2:
      return "Eagle";
    case -1:
      return "Birdie";
    case 0:
      return "Par";
    case 1:
      return "Bogey";
    case 2:
      return "Double Bogey";
    default:
      return delta < 0 ? `${delta}` : `+${delta}`;
  }
}

/**
 * A compact, Wordle-style share summary for a solved puzzle. Keeps the daily
 * date so shared scores are comparable, and renders par-relative score as
 * E / +N / -N (golf convention).
 */
export function buildShareText(moves: number, par: number, dateUtc: string): string {
  const delta = relativeToPar(moves, par);
  const relative = delta === 0 ? "E" : delta > 0 ? `+${delta}` : `${delta}`;
  return `Word Golf ${dateUtc}: ${scoreLabel(moves, par)} (${relative}) — ${moves} moves, par ${par}`;
}
