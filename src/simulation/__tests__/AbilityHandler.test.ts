import { describe, it, expect, vi, beforeEach } from 'vitest';
import Matter from 'matter-js';
import { applyAbility } from '../AbilityHandler';
import { StatusEffectManager } from '../StatusEffectManager';
import type { BallAbility } from '../../models/types';
import type { ParticleController } from '../ParticleController';
import type { EffectsController } from '../EffectsController';
import type { AudioEmitter } from '../AudioEmitter';
import { makeBody, makeTeam, makeParticles, makeEffects, makeAudio, BASE_ABILITY } from './fixtures';


function makeAbility(params: Partial<BallAbility['params']>): BallAbility {
  return {
    ...BASE_ABILITY,
    trigger: 'onHitDealt',
    params: params as BallAbility['params'],
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('applyAbility()', () => {
  let statusMgr: StatusEffectManager;
  let particles: ParticleController;
  let effects: EffectsController;
  let audio: AudioEmitter;
  let body: Matter.Body;

  beforeEach(() => {
    statusMgr = new StatusEffectManager();
    particles = makeParticles();
    effects   = makeEffects();
    audio     = makeAudio();
    body      = makeBody();
  });

  function ctx(ability: BallAbility, team: 'A' | 'B' = 'A') {
    return {
      ability, team, trigger: ability.trigger, body, teamConfig: makeTeam(),
      statusMgr, particles, effects, audio, simTime: 0,
    };
  }

  describe('status effects', () => {
    it('applies primary statusEffect to enemy by default', () => {
      const ability = makeAbility({ statusEffect: 'freeze', statusDuration: 2000, statusMagnitude: 0.5, statusColor: '#00F', statusIcon: 'dot-yellow' });
      applyAbility(ctx(ability, 'A'));
      expect(statusMgr.hasEffect('B', 'freeze')).toBe(true);
      expect(statusMgr.hasEffect('A', 'freeze')).toBe(false);
    });

    it('applies primary statusEffect to self when statusTarget=self', () => {
      const ability = makeAbility({ statusEffect: 'rage', statusTarget: 'self', statusDuration: 2000, statusMagnitude: 0.5, statusColor: '#F00', statusIcon: 'burst' });
      applyAbility(ctx(ability, 'A'));
      expect(statusMgr.hasEffect('A', 'rage')).toBe(true);
      expect(statusMgr.hasEffect('B', 'rage')).toBe(false);
    });

    it('applies second status effect to enemy', () => {
      const ability = makeAbility({
        secondStatusEffect: 'weaken', secondStatusTarget: 'enemy',
        secondStatusDuration: 1500, secondStatusMagnitude: 0.3,
        secondStatusColor: '#888', secondStatusIcon: 'burst',
      });
      applyAbility(ctx(ability, 'A'));
      expect(statusMgr.hasEffect('B', 'weaken')).toBe(true);
    });

    it('applies second status effect to self', () => {
      const ability = makeAbility({
        secondStatusEffect: 'speedBoost', secondStatusTarget: 'self',
        secondStatusDuration: 1500, secondStatusMagnitude: 0.3,
        secondStatusColor: '#0F0', secondStatusIcon: 'lightning',
      });
      applyAbility(ctx(ability, 'B'));
      expect(statusMgr.hasEffect('B', 'speedBoost')).toBe(true);
    });
  });

  describe('screen effects', () => {
    it('calls applyHitFlash on enemy when hitFlash=true', () => {
      const ability = makeAbility({ hitFlash: true, hitFlashTarget: 'enemy', hitFlashColor: '#FFFFFF' });
      applyAbility(ctx(ability, 'A'));
      expect(effects.applyHitFlash).toHaveBeenCalledWith('B', expect.any(Number), expect.any(String), expect.any(Number));
    });

    it('calls applyHitFlash on self when hitFlashTarget=self', () => {
      const ability = makeAbility({ hitFlash: true, hitFlashTarget: 'self', hitFlashColor: '#FF0000' });
      applyAbility(ctx(ability, 'A'));
      expect(effects.applyHitFlash).toHaveBeenCalledWith('A', expect.any(Number), expect.any(String), expect.any(Number));
    });

    it('calls applyScreenShake when hitShakeMagnitude is set', () => {
      const ability = makeAbility({ hitShakeMagnitude: 6 });
      applyAbility(ctx(ability));
      expect(effects.applyScreenShake).toHaveBeenCalledWith(6, expect.any(Number));
    });

    it('calls applySlowMotion when hitSlowMo=true', () => {
      const ability = makeAbility({ hitSlowMo: true });
      applyAbility(ctx(ability));
      expect(effects.applySlowMotion).toHaveBeenCalled();
    });

    it('calls applyScreenFlash when hitScreenFlash=true', () => {
      const ability = makeAbility({ hitScreenFlash: true, hitScreenFlashAlpha: 0.3, hitScreenFlashColor: '#FFFFFF' });
      applyAbility(ctx(ability));
      expect(effects.applyScreenFlash).toHaveBeenCalled();
    });
  });

  describe('trail on trigger', () => {
    it('spawns trail particles when trailOnTrigger=true', () => {
      const ability = makeAbility({
        trailOnTrigger: true, trailColor: '#FF8800', trailAlpha: 0.6,
        trailTtl: 10, trailRadiusFrac: 0.5, trailSpawnChance: 1,
      });
      applyAbility(ctx(ability));
      expect(particles.pushTrail).toHaveBeenCalled();
    });

    it('spawns multiple trail segments when trailCount > 1', () => {
      const ability = makeAbility({
        trailOnTrigger: true, trailColor: '#FF8800', trailAlpha: 0.6,
        trailTtl: 10, trailRadiusFrac: 0.5, trailSpawnChance: 1, trailCount: 3,
      });
      applyAbility(ctx(ability));
      expect((particles.pushTrail as ReturnType<typeof vi.fn>).mock.calls.length).toBe(3);
    });

    it('does not spawn trail when trailSpawnChance=0', () => {
      const ability = makeAbility({
        trailOnTrigger: true, trailColor: '#FF8800', trailAlpha: 0.6,
        trailTtl: 10, trailRadiusFrac: 0.5, trailSpawnChance: 0,
      });
      applyAbility(ctx(ability));
      expect(particles.pushTrail).not.toHaveBeenCalled();
    });
  });

  describe('audio', () => {
    it('emits ability audio for meaningful triggers', () => {
      const ability: BallAbility = { ...BASE_ABILITY, trigger: 'onHitDealt', params: {} as BallAbility['params'] };
      applyAbility(ctx(ability));
      expect(audio.emitAbility).toHaveBeenCalledWith('A', expect.any(String), 'onHitDealt', 0);
    });

    it('does not emit audio for passive trigger', () => {
      const ability: BallAbility = { ...BASE_ABILITY, trigger: 'passive', params: {} as BallAbility['params'] };
      applyAbility({ ...ctx(ability), trigger: 'passive' });
      expect(audio.emitAbility).not.toHaveBeenCalled();
    });
  });
});
