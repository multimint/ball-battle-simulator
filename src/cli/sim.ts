/* eslint-disable no-console */
/// <reference types="node" />
import { FIGHTER_PRESETS } from '../balls';
import { HeadlessSimulator, type FightResult } from './HeadlessSimulator';
import { randomVelocity } from '../utils/physics';
import { parseRuns, presetToTeam } from './cliUtils';
import { FUN_COMPONENT_KEYS, type FunComponents } from '../utils/funScore';

// ── Arg parsing ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const showLog = args.includes('--log');

if (args.includes('--list') || args.includes('-l')) {
  console.log('\nAvailable balls:\n');
  for (const p of FIGHTER_PRESETS) {
    console.log(`  ${p.id.padEnd(20)}  ${p.name}`);
  }
  console.log();
  process.exit(0);
}
const runs = parseRuns(args, 100);

const positional: string[] = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--runs') {
    i++;
    continue;
  }
  if (!args[i].startsWith('-')) positional.push(args[i]);
}
const [ballAId, ballBId] = positional;

if (!ballAId || !ballBId) {
  console.error('Usage: npm run sim -- <ballA-id> <ballB-id> [--runs N] [--log]');
  console.error('Ball IDs:', FIGHTER_PRESETS.map((p) => p.id).join(', '));
  process.exit(1);
}

const presetA = FIGHTER_PRESETS.find((p) => p.id === ballAId);
const presetB = FIGHTER_PRESETS.find((p) => p.id === ballBId);

if (!presetA || !presetB) {
  const missing = [!presetA && ballAId, !presetB && ballBId]
    .filter(Boolean)
    .join(', ');
  console.error(`Unknown ball ID(s): ${missing}`);
  console.error('Ball IDs:', FIGHTER_PRESETS.map((p) => p.id).join(', '));
  process.exit(1);
}

const teamA = presetToTeam(presetA);
const teamB = presetToTeam(presetB);

// ── Simulation loop ────────────────────────────────────────────────────────────

console.log(`\nRunning ${runs} fights: ${presetA.name} vs ${presetB.name} ...`);

let winsA = 0,
  winsB = 0,
  draws = 0;
let hpSumWinA = 0,
  hpSumWinB = 0;
let totalTurns = 0,
  totalTimeMs = 0,
  totalTimeMsSq = 0,
  totalFunScore = 0,
  totalFunScoreSq = 0;

// Per-component sum and sum-of-squares (values scaled to 0–100).
const compSum: Record<keyof FunComponents, number> =
  { closeness: 0, dmgSymmetry: 0, duration: 0, momentum: 0, hook: 0, comeback: 0 };
const compSumSq: Record<keyof FunComponents, number> = { ...compSum };

let firstFight: FightResult | null = null;

const wallStart = Date.now();

for (let i = 0; i < runs; i++) {
  const vels = {
    velA: randomVelocity(presetA.ball.maxSpeed, 0),
    velB: randomVelocity(presetB.ball.maxSpeed, Math.PI),
  };
  const result = new HeadlessSimulator(teamA, teamB, vels).run();
  if (i === 0) firstFight = result;

  if (result.winner === 'A') {
    winsA++;
    hpSumWinA += result.hpA;
  } else if (result.winner === 'B') {
    winsB++;
    hpSumWinB += result.hpB;
  } else draws++;

  totalTurns += result.turnsElapsed;
  totalTimeMs += result.simTimeMs;
  totalTimeMsSq += result.simTimeMs * result.simTimeMs;
  totalFunScore += result.funScore;
  totalFunScoreSq += result.funScore * result.funScore;
  for (const k of FUN_COMPONENT_KEYS) {
    const v = result.funComponents[k] * 100;
    compSum[k] += v;
    compSumSq[k] += v * v;
  }
}

const wallMs = Date.now() - wallStart;

/** Population standard deviation from running sum and sum-of-squares. */
const stdev = (sum: number, sumSq: number, n: number): number =>
  Math.sqrt(Math.max(0, sumSq / n - (sum / n) ** 2));
/** Standard error of a proportion (the ± noise on a measured win rate), in %. */
const propStdErrPct = (wins: number, n: number): number => {
  const p = wins / n;
  return Math.sqrt((p * (1 - p)) / n) * 100;
};

const avgTurns = (totalTurns / runs).toFixed(0);
const avgSimSec = (totalTimeMs / runs / 1000).toFixed(1);
const sdSimSec = (stdev(totalTimeMs, totalTimeMsSq, runs) / 1000).toFixed(1);
const sdFun = Math.round(stdev(totalFunScore, totalFunScoreSq, runs));
const seA = Math.round(propStdErrPct(winsA, runs));
const seB = Math.round(propStdErrPct(winsB, runs));
const avgHpA = winsA > 0 ? (hpSumWinA / winsA).toFixed(1) : '—';
const avgHpB = winsB > 0 ? (hpSumWinB / winsB).toFixed(1) : '—';
const pctA = Math.round((winsA / runs) * 100);
const pctB = Math.round((winsB / runs) * 100);
const pctD = Math.round((draws / runs) * 100);
const avgFun = Math.round(totalFunScore / runs);

// ── Output ─────────────────────────────────────────────────────────────────────

const nameA = presetA.name;
const nameB = presetB.name;
const col = Math.max(nameA.length, nameB.length, 10);
const line = '─'.repeat(col + 44);

console.log(`\n${nameA} vs ${nameB}  (${runs} runs)`);
console.log(line);
console.log(
  `  ${nameA.padEnd(col)}  wins: ${String(winsA).padStart(4)} (${String(pctA).padStart(3)}% ±${seA}%)   avg HP left when winning: ${avgHpA}`,
);
console.log(
  `  ${nameB.padEnd(col)}  wins: ${String(winsB).padStart(4)} (${String(pctB).padStart(3)}% ±${seB}%)   avg HP left when winning: ${avgHpB}`,
);
console.log(
  `  ${'Draw'.padEnd(col)}        ${String(draws).padStart(4)} (${String(pctD).padStart(3)}%)`,
);
console.log(
  `  Avg fight: ${avgSimSec}s ±${sdSimSec}s  (${avgTurns} ball collisions)`,
);
console.log(`  Avg fun score: ${avgFun}/100 ±${sdFun}`);

// Per-component breakdown (each averaged over all runs, with ± std dev) — shows
// which factor drives or drags the fun score when tuning.
const compLabel: Record<keyof FunComponents, string> = {
  closeness: 'closeness',
  dmgSymmetry: 'damage symmetry',
  duration: 'duration',
  momentum: 'momentum',
  hook: 'opening hook',
  comeback: 'comeback',
};
for (const k of FUN_COMPONENT_KEYS) {
  const mean = Math.round(compSum[k] / runs);
  const sd = Math.round(stdev(compSum[k], compSumSq[k], runs));
  console.log(`    ${compLabel[k].padEnd(16)} ${String(mean).padStart(3)} ±${sd}`);
}

console.log(line);
console.log(
  `  Completed ${runs} fights in ${wallMs}ms  (${(wallMs / runs).toFixed(1)}ms per fight)\n`,
);

// ── Full fight log (--log) ───────────────────────────────────────────────────────

if (showLog && firstFight) {
  const teamName = (t: 'A' | 'B') => (t === 'A' ? nameA : nameB);
  console.log(`Fight #1 event log  (${firstFight.gameEvents.length} actions)`);
  console.log(line);
  for (const e of firstFight.gameEvents) {
    const t = `${(e.timeMs / 1000).toFixed(1)}s`.padStart(6);
    console.log(`  ${t}  ${teamName(e.team).padEnd(col)}  ${e.type}`);
  }
  const fc = firstFight.funComponents;
  const fcStr = FUN_COMPONENT_KEYS.map((k) => `${k} ${Math.round(fc[k] * 100)}`).join('  ');
  console.log(line);
  console.log(
    `  Result: ${firstFight.winner === 'draw' ? 'draw' : `${teamName(firstFight.winner as 'A' | 'B')} wins`}` +
      `  (${(firstFight.simTimeMs / 1000).toFixed(1)}s, A ${firstFight.hpA} HP / B ${firstFight.hpB} HP)`,
  );
  console.log(`  Fun score: ${firstFight.funScore}/100   [${fcStr}]\n`);
}
