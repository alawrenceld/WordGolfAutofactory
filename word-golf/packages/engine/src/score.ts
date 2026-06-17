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
