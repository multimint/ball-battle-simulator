import type { BallStats } from '../models/types';

/** Composite power score (higher = stronger). Roughly 0–150 range. */
export function calculatePowerScore(ball: BallStats): number {
  return (
    0.25 * ball.attackPower +
    0.20 * ball.knockbackPower +
    0.25 * ball.durability +
    0.20 * ball.maxSpeed * 10 +
    0.10 * ball.mass * 20
  );
}

/** Chaos / unpredictability rating (0–100). */
export function calculateChaos(ball: BallStats): number {
  const mobility = ball.maxSpeed * 10;
  const spin = ball.spinSpeed * 10;
  return Math.min(100, mobility * 0.3 + spin * 0.2 + 50);
}

/** Human-readable matchup label based on power score delta. */
export function matchupLabel(
  scoreA: number,
  scoreB: number,
  nameA: string,
  nameB: string
): { label: string; emoji: string } {
  const delta = Math.abs(scoreA - scoreB);
  if (delta <= 5) return { label: 'Even Match', emoji: '🟢' };
  const leading = scoreA > scoreB ? nameA : nameB;
  if (delta <= 15) return { label: `Slight Adv: ${leading}`, emoji: '🟡' };
  return { label: `Strong Adv: ${leading}`, emoji: '🔴' };
}
