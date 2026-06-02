import type { WinnerType } from '../models/types';

/** Snapshot interval in ms — must match SimulationCore's HP_SNAPSHOT_INTERVAL_MS. */
export const HP_SNAPSHOT_INTERVAL_MS = 500;

/**
 * A discrete gameplay action, recorded by SimulationCore as the single source of
 * truth for "what happened" (independent of the audio subsystem). Consumed here
 * for analytics such as the opening-hook score.
 */
export type GameEventType = 'hit' | 'fire' | 'ability';
export interface GameEvent {
  timeMs: number;
  type: GameEventType;
  team: 'A' | 'B';
}

export interface FunScoreInput {
  snapshots: { hpA: number; hpB: number }[];
  winner: WinnerType;
  hpA: number;
  hpB: number;
  maxHpA: number;
  maxHpB: number;
  damageA: number;
  damageB: number;
  simTimeMs: number;
  /** Timestamped log of gameplay actions (hits, fires, ability procs). */
  gameEvents: GameEvent[];
}

const DURATION_IDEAL_MIN_S = 30;
const DURATION_IDEAL_MAX_S = 40;
const DURATION_SIGMA_S = 7;

/** Opening "hook" window — action in the first this-many ms grabs attention. */
const OPENING_WINDOW_MS = 5000;
/** tanh divisor: ~4 opening actions → 0.76, ~8 → 0.96. */
const OPENING_ACTION_DIVISOR = 4;

/** The six 0–1 factors that make up the fun score (before averaging). */
export interface FunComponents {
  closeness: number;
  dmgSymmetry: number;
  duration: number;
  momentum: number;
  hook: number;
  comeback: number;
}

/** Keys in display order — shared by the CLI breakdown. */
export const FUN_COMPONENT_KEYS: readonly (keyof FunComponents)[] = [
  'closeness', 'dmgSymmetry', 'duration', 'momentum', 'hook', 'comeback',
];

/** Average the six factors into a single 0–100 score. */
export function funScoreFromComponents(c: FunComponents): number {
  const sum = c.closeness + c.dmgSymmetry + c.duration + c.momentum + c.hook + c.comeback;
  return Math.round((sum / FUN_COMPONENT_KEYS.length) * 100);
}

/**
 * Compute a 0–100 fun score for a single fight. Equal weight on six factors:
 * closeness, damage symmetry, duration, momentum shifts, the opening "hook"
 * (action density in the first OPENING_WINDOW_MS), and comeback (how close the
 * eventual winner came to losing).
 */
export function computeFunScore(i: FunScoreInput): number {
  return funScoreFromComponents(computeFunComponents(i));
}

/** Compute the six fun-score factors individually (for diagnostics/tuning). */
export function computeFunComponents(i: FunScoreInput): FunComponents {
  // 1. Closeness — how little HP the winner had remaining
  let closeness: number;
  const bothAlive = i.hpA > 0 && i.hpB > 0;
  if (i.winner === 'draw') {
    closeness = 1.0;
  } else if (i.winner !== null && bothAlive) {
    // Stalemate: decided on remaining HP with both balls alive → reward symmetry.
    const sum = i.hpA + i.hpB;
    closeness = sum > 0 ? 1 - Math.abs(i.hpA - i.hpB) / sum : 0.5;
  } else if (i.winner === 'A') {
    closeness = i.maxHpA > 0 ? 1 - i.hpA / i.maxHpA : 0.5;
  } else if (i.winner === 'B') {
    closeness = i.maxHpB > 0 ? 1 - i.hpB / i.maxHpB : 0.5;
  } else {
    // winner unresolved (null) — no meaningful closeness signal.
    closeness = 0.5;
  }

  // 2. Damage symmetry — both sides dealt similar amounts
  const maxDmg = Math.max(i.damageA, i.damageB);
  const dmgSymmetry = maxDmg > 0 ? Math.min(i.damageA, i.damageB) / maxDmg : 0;

  // 3. Duration — flat 1.0 across the ideal band, Gaussian falloff outside it
  const durationS = i.simTimeMs / 1000;
  const distOutside =
    durationS < DURATION_IDEAL_MIN_S ? DURATION_IDEAL_MIN_S - durationS
    : durationS > DURATION_IDEAL_MAX_S ? durationS - DURATION_IDEAL_MAX_S
    : 0;
  const duration = Math.exp(-0.5 * (distOutside / DURATION_SIGMA_S) ** 2);

  // 4 & 6. Walk the HP-fraction timeline once. Comparing fractions (hp/maxHp),
  // not absolute HP, is essential: otherwise a high-durability ball always
  // "leads" and lead changes never register for asymmetric matchups.
  let shifts = 0;
  let prevLeader: 'A' | 'B' | null = null;
  let minFracA = 1;
  let minFracB = 1;
  for (const { hpA, hpB } of i.snapshots) {
    const fracA = i.maxHpA > 0 ? hpA / i.maxHpA : 0;
    const fracB = i.maxHpB > 0 ? hpB / i.maxHpB : 0;
    if (fracA < minFracA) minFracA = fracA;
    if (fracB < minFracB) minFracB = fracB;
    if (fracA === fracB) continue;
    const leader: 'A' | 'B' = fracA > fracB ? 'A' : 'B';
    if (prevLeader !== null && leader !== prevLeader) shifts++;
    prevLeader = leader;
  }
  const momentum = Math.tanh(shifts / 2); // 0→0, 1→0.46, 2→0.76, 3→0.91

  // 5. Opening hook — density of action in the first OPENING_WINDOW_MS
  let openingActions = 0;
  for (const e of i.gameEvents) {
    if (e.timeMs < OPENING_WINDOW_MS) openingActions++;
  }
  const hook = Math.tanh(openingActions / OPENING_ACTION_DIVISOR);

  // 6. Comeback — how close the eventual winner came to losing before winning.
  // A winner who cratered to 8% HP and clawed back is far more exciting than
  // one who cruised at 95% the whole fight.
  let comeback: number;
  if (i.winner === 'A')         comeback = 1 - minFracA;
  else if (i.winner === 'B')    comeback = 1 - minFracB;
  else if (i.winner === 'draw') comeback = 1 - Math.min(minFracA, minFracB);
  else                          comeback = 0; // unresolved — no signal

  return { closeness, dmgSymmetry, duration, momentum, hook, comeback };
}
