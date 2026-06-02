import { describe, it, expect } from 'vitest';
import { HeadlessSimulator } from '../HeadlessSimulator';
import { makeTeam } from '../../simulation/__tests__/fixtures';
import { STALEMATE_TIME_MS, PHYSICS_STEP_MS } from '../../constants/gameConstants';

function vels(ax = 5, ay = 1, bx = -5, by = -1) {
  return { velA: { x: ax, y: ay }, velB: { x: bx, y: by } };
}

describe('HeadlessSimulator', () => {
  describe('run() result shape', () => {
    it('returns a winner that is A, B, or draw — never null', () => {
      const result = new HeadlessSimulator(makeTeam(), makeTeam(), vels()).run();
      expect(['A', 'B', 'draw']).toContain(result.winner);
    });

    it('returns non-negative turnsElapsed', () => {
      const result = new HeadlessSimulator(makeTeam(), makeTeam(), vels()).run();
      expect(result.turnsElapsed).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(result.turnsElapsed)).toBe(true);
    });

    it('returns positive simTimeMs bounded by stalemate limit', () => {
      const result = new HeadlessSimulator(makeTeam(), makeTeam(), vels()).run();
      expect(result.simTimeMs).toBeGreaterThan(0);
      expect(result.simTimeMs).toBeLessThanOrEqual(STALEMATE_TIME_MS + PHYSICS_STEP_MS);
    });

    it('returns non-negative damageDealt for both sides', () => {
      const result = new HeadlessSimulator(makeTeam(), makeTeam(), vels()).run();
      expect(result.damageDealt.A).toBeGreaterThanOrEqual(0);
      expect(result.damageDealt.B).toBeGreaterThanOrEqual(0);
    });
  });

  describe('HP invariants', () => {
    it('winner HP never exceeds starting durability', () => {
      const team = makeTeam();
      const result = new HeadlessSimulator(team, makeTeam(), vels()).run();
      expect(result.hpA).toBeLessThanOrEqual(team.ball.durability);
      expect(result.hpB).toBeLessThanOrEqual(team.ball.durability);
    });

    it('winner has >= HP than loser in a decisive fight', () => {
      const result = new HeadlessSimulator(makeTeam(), makeTeam(), vels()).run();
      if (result.winner === 'A') expect(result.hpA).toBeGreaterThanOrEqual(result.hpB);
      if (result.winner === 'B') expect(result.hpB).toBeGreaterThanOrEqual(result.hpA);
    });

    it('loser HP is 0 in a KO (non-stalemate) fight', () => {
      const result = new HeadlessSimulator(makeTeam(), makeTeam(), vels()).run();
      // stalemate ends with both sides having HP > 0; KO ends with exactly one at 0
      const isKO = result.hpA === 0 || result.hpB === 0;
      if (isKO) {
        if (result.winner === 'A') expect(result.hpB).toBe(0);
        if (result.winner === 'B') expect(result.hpA).toBe(0);
      }
    });

    it('winner HP is > 0 in a KO fight', () => {
      const result = new HeadlessSimulator(makeTeam(), makeTeam(), vels()).run();
      const isKO = result.hpA === 0 || result.hpB === 0;
      if (isKO) {
        if (result.winner === 'A') expect(result.hpA).toBeGreaterThan(0);
        if (result.winner === 'B') expect(result.hpB).toBeGreaterThan(0);
      }
    });
  });

  describe('stalemate', () => {
    it('terminates within stalemate limit when balls barely move', () => {
      const result = new HeadlessSimulator(
        makeTeam(), makeTeam(),
        { velA: { x: 0.01, y: 0 }, velB: { x: -0.01, y: 0 } },
      ).run();
      expect(result.winner).not.toBeNull();
      expect(result.simTimeMs).toBeLessThanOrEqual(STALEMATE_TIME_MS + PHYSICS_STEP_MS);
    });
  });

  describe('damage accounting', () => {
    it('total damage dealt equals HP lost', () => {
      const durability = 100;
      const teamA = makeTeam();
      const teamB = makeTeam();
      teamA.ball = { ...teamA.ball, durability };
      teamB.ball = { ...teamB.ball, durability };
      const result = new HeadlessSimulator(teamA, teamB, vels()).run();
      const hpLostA = durability - result.hpA;
      const hpLostB = durability - result.hpB;
      expect(result.damageDealt.A).toBe(hpLostB);
      expect(result.damageDealt.B).toBe(hpLostA);
    });
  });

  describe('multiple independent runs', () => {
    it('each HeadlessSimulator instance is independent — shared presets not mutated', () => {
      const team = makeTeam();
      const durabilityBefore = team.ball.durability;
      new HeadlessSimulator(team, makeTeam(), vels()).run();
      new HeadlessSimulator(team, makeTeam(), vels()).run();
      expect(team.ball.durability).toBe(durabilityBefore);
    });
  });
});
