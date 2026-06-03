import { describe, it, expect, vi } from 'vitest';
import { AbilityAnimationController } from '../AbilityAnimationController';
import type { AnimationDeps } from '../AbilityAnimationController';
import type { OnTimerParams } from '../../models/types';
import { makeBody, makeTeam, makeParticles, makeEffects, makeAudio } from './fixtures';

// ── Fixture ───────────────────────────────────────────────────────────────────

function makeDeps(): AnimationDeps {
  return {
    teamA: makeTeam(),
    teamB: makeTeam(),
    bodyA: makeBody(110, 240),
    bodyB: makeBody(370, 240),
    hp: { A: 100, B: 100 },
    damageDealt: { A: 0, B: 0 },
    effects: makeEffects(),
    particles: makeParticles(),
    audio: makeAudio(),
    recordGameEvent: vi.fn(),
  };
}

const DASH_PARAMS: OnTimerParams = {
  intervalMs: 100,
  dashThroughEnemy: true,
  dashDamage: 12,
  dashStartHold: 1,
  dashMoveFrames: 2,
  dashTotalFrames: 10,
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AbilityAnimationController — dashThrough runner', () => {
  it('calls applyFreeze immediately on trigger', () => {
    const deps = makeDeps();
    const ctrl = new AbilityAnimationController(deps);
    ctrl.trigger('A', DASH_PARAMS);
    expect(deps.effects.applyFreeze).toHaveBeenCalled();
  });

  it('deals dashDamage to enemy at the correct midpoint tick', () => {
    const deps = makeDeps();
    const ctrl = new AbilityAnimationController(deps);
    ctrl.trigger('A', DASH_PARAMS);
    ctrl.tick(100); // frame→1 (startHold), no damage
    expect(deps.hp.B).toBe(100);
    ctrl.tick(116); // frame→2, mf=1=ceil(1)=impact
    expect(deps.hp.B).toBe(88); // 100 - 12
  });

  it('calls emitAbilityHit at the impact tick', () => {
    const deps = makeDeps();
    const ctrl = new AbilityAnimationController(deps);
    ctrl.trigger('A', DASH_PARAMS);
    ctrl.tick(100);
    ctrl.tick(116); // impact
    expect(deps.audio.emitAbilityHit).toHaveBeenCalledOnce();
  });

  it('calls extendFreeze on every tick while active', () => {
    const deps = makeDeps();
    const ctrl = new AbilityAnimationController(deps);
    ctrl.trigger('A', DASH_PARAMS);
    ctrl.tick(100);
    ctrl.tick(116);
    expect(deps.effects.extendFreeze).toHaveBeenCalled();
  });

  it('does not deal damage a second time on later ticks', () => {
    const deps = makeDeps();
    const ctrl = new AbilityAnimationController(deps);
    ctrl.trigger('A', DASH_PARAMS);
    ctrl.tick(100); ctrl.tick(116); // impact
    ctrl.tick(132); ctrl.tick(148);
    expect(deps.hp.B).toBe(88); // no double damage
  });

  it('reads dashDamage from params — not a hardcoded constant', () => {
    const deps = makeDeps();
    const ctrl = new AbilityAnimationController(deps);
    ctrl.trigger('A', { ...DASH_PARAMS, dashDamage: 7 });
    ctrl.tick(100); ctrl.tick(116);
    expect(deps.hp.B).toBe(93); // 100 - 7
  });

  it('reads dashTotalFrames from params', () => {
    const deps = makeDeps();
    const ctrl = new AbilityAnimationController(deps);
    // totalFrames=3: trigger → tick(1) → tick(2) → tick(3/done)
    ctrl.trigger('A', { ...DASH_PARAMS, dashTotalFrames: 3 });
    ctrl.tick(100); ctrl.tick(116); ctrl.tick(132); // frame 3 = isDone
    // extendFreeze must NOT be called on the final tick (isDone)
    const calls = (deps.effects.extendFreeze as ReturnType<typeof vi.fn>).mock.calls.length;
    // It was called on ticks 1 and 2 (isDone=false), not tick 3 (isDone=true)
    expect(calls).toBe(2);
  });

  it('does not activate for params without dashThroughEnemy', () => {
    const deps = makeDeps();
    const ctrl = new AbilityAnimationController(deps);
    ctrl.trigger('A', { intervalMs: 100 }); // no dashThroughEnemy
    ctrl.tick(100); ctrl.tick(116);
    expect(deps.hp.B).toBe(100); // no damage — runner never activated
  });

  it('supports independent animations for team A and team B simultaneously', () => {
    const deps = makeDeps();
    const ctrl = new AbilityAnimationController(deps);
    ctrl.trigger('A', DASH_PARAMS);
    ctrl.trigger('B', { ...DASH_PARAMS, dashDamage: 5 });
    ctrl.tick(100); ctrl.tick(116);
    // A hits B: B hp -= 12; B hits A: A hp -= 5
    expect(deps.hp.B).toBe(88);
    expect(deps.hp.A).toBe(95);
  });
});
