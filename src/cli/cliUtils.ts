/// <reference types="node" />
import type { FighterPreset } from '../models/types';
import type { TeamConfig } from '../models/types';

/** Parse --runs N from argv, exit with an error if invalid. */
export function parseRuns(args: string[], defaultN: number): number {
  const idx  = args.indexOf('--runs');
  const runs = idx !== -1 && args[idx + 1] ? parseInt(args[idx + 1], 10) : defaultN;
  if (isNaN(runs) || runs < 1) {
    console.error('--runs must be a positive integer');
    process.exit(1);
  }
  return runs;
}

/** Map a FighterPreset to the TeamConfig shape HeadlessSimulator accepts. */
export function presetToTeam(p: FighterPreset): TeamConfig {
  return {
    fighterId:    p.id,
    name:         p.name,
    ball:         p.ball,
    weapon:       p.weapon,
    audioProfile: p.audioProfile,
  };
}

/**
 * Find the shortest prefix length that makes all names unique.
 * Used to build unambiguous matrix column headers.
 */
export function uniqueAbbreviations(names: string[]): string[] {
  const maxLen = Math.max(...names.map(n => n.length));
  for (let len = 4; len <= maxLen; len++) {
    const abbrs = names.map(n => n.slice(0, len));
    if (new Set(abbrs).size === abbrs.length) return abbrs;
  }
  return names; // all names are unique in full — use as-is
}
