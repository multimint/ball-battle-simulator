/* eslint-disable no-console */
/// <reference types="node" />
import { FIGHTER_PRESETS } from '../balls';
import { HeadlessSimulator } from './HeadlessSimulator';
import { randomVelocity } from '../utils/physics';
import { parseRuns, presetToTeam } from './cliUtils';

// ── Arg parsing ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

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
  console.error('Usage: npm run sim -- <ballA-id> <ballB-id> [--runs N]');
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
  totalTimeMs = 0;

const wallStart = Date.now();

for (let i = 0; i < runs; i++) {
  const vels = {
    velA: randomVelocity(presetA.ball.maxSpeed, 0),
    velB: randomVelocity(presetB.ball.maxSpeed, Math.PI),
  };
  const result = new HeadlessSimulator(teamA, teamB, vels).run();

  if (result.winner === 'A') {
    winsA++;
    hpSumWinA += result.hpA;
  } else if (result.winner === 'B') {
    winsB++;
    hpSumWinB += result.hpB;
  } else draws++;

  totalTurns += result.turnsElapsed;
  totalTimeMs += result.simTimeMs;
}

const wallMs = Date.now() - wallStart;
const avgTurns = (totalTurns / runs).toFixed(0);
const avgSimSec = (totalTimeMs / runs / 1000).toFixed(1);
const avgHpA = winsA > 0 ? (hpSumWinA / winsA).toFixed(1) : '—';
const avgHpB = winsB > 0 ? (hpSumWinB / winsB).toFixed(1) : '—';
const pctA = Math.round((winsA / runs) * 100);
const pctB = Math.round((winsB / runs) * 100);
const pctD = Math.round((draws / runs) * 100);

// ── Output ─────────────────────────────────────────────────────────────────────

const nameA = presetA.name;
const nameB = presetB.name;
const col = Math.max(nameA.length, nameB.length, 10);
const line = '─'.repeat(col + 44);

console.log(`\n${nameA} vs ${nameB}  (${runs} runs)`);
console.log(line);
console.log(
  `  ${nameA.padEnd(col)}  wins: ${String(winsA).padStart(4)} (${String(pctA).padStart(3)}%)   avg HP left when winning: ${avgHpA}`,
);
console.log(
  `  ${nameB.padEnd(col)}  wins: ${String(winsB).padStart(4)} (${String(pctB).padStart(3)}%)   avg HP left when winning: ${avgHpB}`,
);
console.log(
  `  ${'Draw'.padEnd(col)}        ${String(draws).padStart(4)} (${String(pctD).padStart(3)}%)`,
);
console.log(`  Avg fight: ${avgSimSec}s  (${avgTurns} ball collisions)`);
console.log(line);
console.log(
  `  Completed ${runs} fights in ${wallMs}ms  (${(wallMs / runs).toFixed(1)}ms per fight)\n`,
);
