/** Expected score for player A against player B (0–1 probability). */
export function expectedScore(rA: number, rB: number): number {
  return 1 / (1 + Math.pow(10, (rB - rA) / 400));
}

/**
 * Apply one Elo update in-place.
 * scoreA: 1 = A wins, 0 = A loses, 0.5 = draw.
 * Updates are zero-sum: rating gained by A equals rating lost by B.
 */
export function applyElo(
  ratings: number[],
  iA: number,
  iB: number,
  scoreA: number,
  k: number,
): void {
  const ea = expectedScore(ratings[iA], ratings[iB]);
  ratings[iA] += k * (scoreA - ea);
  ratings[iB] += k * ((1 - scoreA) - (1 - ea));
}
