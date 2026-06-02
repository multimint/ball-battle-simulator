/* eslint-disable no-console */
/// <reference types="node" />
import { FIGHTER_PRESETS } from '../balls';
import { HeadlessSimulator } from './HeadlessSimulator';
import { randomVelocity } from '../utils/physics';
import { applyElo } from '../utils/elo';
import { parseRuns, presetToTeam, uniqueAbbreviations } from './cliUtils';

const ELO_K     = 32;
const ELO_START = 1000;

// ── Arg parsing ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const runs = parseRuns(args, 500);

const presets = [...FIGHTER_PRESETS];
const N       = presets.length;

if (N < 2) {
  console.error('Need at least 2 balls to rank.');
  process.exit(1);
}

// ── Build matchup pairs ────────────────────────────────────────────────────────

const pairs: [number, number][] = [];
for (let i = 0; i < N; i++) {
  for (let j = i + 1; j < N; j++) {
    pairs.push([i, j]);
  }
}

const totalFights = pairs.length * runs;
console.log(`\nRanking ${N} balls — ${pairs.length} matchups × ${runs} runs = ${totalFights} fights`);

// ── Simulation ────────────────────────────────────────────────────────────────

const ratings = new Array<number>(N).fill(ELO_START);
// wins[i][j] = number of times ball i defeated ball j (draws not counted)
const wins = Array.from({ length: N }, () => new Array<number>(N).fill(0));
const teams = presets.map(presetToTeam);

// ── Progress bar ────────────────────────────────────────────────────────────────

const PROGRESS_BAR_W = 24;
const isTTY = process.stdout.isTTY ?? false;
let lastPctShown = -1;

function renderProgress(done: number, total: number): void {
  const pct = Math.min(100, Math.floor((done / total) * 100));
  if (pct === lastPctShown) return;
  lastPctShown = pct;
  const filled = Math.round((pct / 100) * PROGRESS_BAR_W);
  const bar = '█'.repeat(filled) + '░'.repeat(PROGRESS_BAR_W - filled);
  // On a TTY redraw one line in place; otherwise log a milestone so piped output stays readable.
  if (isTTY) process.stdout.write(`\r  [${bar}] ${String(pct).padStart(3)}%`);
  else if (pct % 25 === 0) console.log(`  [${bar}] ${pct}%`);
}

const wallStart = Date.now();
let fightsDone = 0;

// Interleave fights across all matchups each round — improves Elo convergence.
for (let round = 0; round < runs; round++) {
  for (const [i, j] of pairs) {
    const vels = {
      velA: randomVelocity(presets[i].ball.maxSpeed, 0),
      velB: randomVelocity(presets[j].ball.maxSpeed, Math.PI),
    };
    const result = new HeadlessSimulator(teams[i], teams[j], vels).run();

    let scoreA: number;
    if (result.winner === 'A')      { scoreA = 1;   wins[i][j]++; }
    else if (result.winner === 'B') { scoreA = 0;   wins[j][i]++; }
    else                            { scoreA = 0.5; }

    applyElo(ratings, i, j, scoreA, ELO_K);
    renderProgress(++fightsDone, totalFights);
  }
}
if (isTTY) process.stdout.write('\n');

const wallMs = Date.now() - wallStart;

// ── Rank & output ─────────────────────────────────────────────────────────────

const ranked = presets
  .map((p, i) => ({ preset: p, elo: Math.round(ratings[i]), idx: i }))
  .sort((a, b) => b.elo - a.elo);

const maxElo = ranked[0].elo;
const minElo = ranked[ranked.length - 1].elo;
const nameW  = Math.max(...presets.map(p => p.name.length), 10);
const line   = '─'.repeat(nameW + 38);

console.log(`\nBall Rankings  (${N} balls × ${runs} runs, ${totalFights} fights total)`);
console.log(line);

for (let r = 0; r < ranked.length; r++) {
  const { preset, elo } = ranked[r];
  // Scale bars so minElo → 1 bar, maxElo → 12 bars (proportional between).
  const bars = maxElo === minElo
    ? 6
    : 1 + Math.round(((elo - minElo) / (maxElo - minElo)) * 11);
  console.log(
    `  #${String(r + 1).padEnd(2)} ${preset.name.padEnd(nameW)}  ${String(elo).padStart(4)} Elo   ${'█'.repeat(bars)}`,
  );
}

console.log();

// Head-to-head matrix — decisive win % (draws excluded from denominator so
// each row+column pair always sums to 100%).
const abbrs  = uniqueAbbreviations(ranked.map(({ preset }) => preset.name));
const colW   = Math.max(...abbrs.map(a => a.length), 4);
const indent = ' '.repeat(nameW + 6);
const header = abbrs.map(a => a.padStart(colW)).join('  ');

console.log('Head-to-head decisive win % (draws excluded):');
console.log(`${indent}${header}`);

for (let ri_rank = 0; ri_rank < ranked.length; ri_rank++) {
  const { preset: rowPreset, idx: ri } = ranked[ri_rank];
  const cells = ranked.map(({ idx: ci }) => {
    if (ri === ci) return ' —'.padStart(colW);
    const decisive = wins[ri][ci] + wins[ci][ri];
    const pct = decisive === 0 ? 0 : Math.round((wins[ri][ci] / decisive) * 100);
    return `${pct}%`.padStart(colW);
  });
  console.log(`  ${rowPreset.name.padEnd(nameW)}  ${cells.join('  ')}`);
}

console.log(line);
console.log(`  Completed in ${wallMs}ms  (${(wallMs / totalFights).toFixed(1)}ms per fight)\n`);
