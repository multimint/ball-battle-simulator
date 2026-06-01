import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processHit } from '../HitProcessor';
import { StatusEffectManager } from '../StatusEffectManager';
import type { WeaponStats, AttackConfig } from '../../models/types';
import { makeBody, makeTeam, makeParticles, makeEffects, makeAudio, SWORD } from './fixtures';

const LASER: WeaponStats = {
  name: 'Test Laser', description: '', range: 5, speed: 10, trigger: 'onTimer',
  color: '#FF4444',
  attacks: [{ type: 'projectile', cooldown: 3, damage: 12, knockback: 50, aimAtEnemy: true }],
};

describe('processHit()', () => {
  let hp: { A: number; B: number };
  let maxHp: { A: number; B: number };
  let damageDealt: { A: number; B: number };
  let statusMgr: StatusEffectManager;
  let attacker: Matter.Body;
  let defender: Matter.Body;

  beforeEach(() => {
    hp         = { A: 100, B: 100 };
    maxHp      = { A: 100, B: 100 };
    damageDealt = { A: 0, B: 0 };
    statusMgr  = new StatusEffectManager();
    attacker   = makeBody(100, 240);
    defender   = makeBody(380, 240);
  });

  function ctx(attack: AttackConfig = SWORD.attacks[0], attackerTeam: 'A' | 'B' = 'A') {
    return {
      weapon: SWORD, attack, attacker, defender, attackerTeam,
      hp, maxHp, damageDealt,
      teamA: makeTeam(), teamB: makeTeam(),
      statusMgr, particles: makeParticles(), effects: makeEffects(), audio: makeAudio(),
      simTime: 0, onAbility: vi.fn(),
    };
  }

  describe('melee attack', () => {
    it('reduces defender HP by attack damage', () => {
      processHit(ctx());
      expect(hp.B).toBe(90);
    });

    it('increments damageDealt for the attacker team', () => {
      processHit(ctx());
      expect(damageDealt.A).toBe(10);
      expect(damageDealt.B).toBe(0);
    });

    it('B attacking A reduces A hp', () => {
      const c = ctx(SWORD.attacks[0], 'B');
      processHit(c);
      expect(hp.A).toBe(90);
      expect(damageDealt.B).toBe(10);
    });

    it('damage is floored to 0 hp (no negative hp)', () => {
      hp.B = 5;
      processHit(ctx());
      expect(hp.B).toBe(0);
    });

    it('applies outgoing damage multiplier from rage', () => {
      statusMgr.apply({ team: 'A', type: 'rage', durationMs: 9999, magnitude: 1.0, stackBehavior: 'refresh', maxStacks: 1, color: '#F00', icon: 'burst' });
      processHit(ctx());
      expect(hp.B).toBe(80); // 10 * (1+1.0) = 20 damage
    });

    it('shield absorbs damage', () => {
      statusMgr.apply({ team: 'B', type: 'shield', durationMs: 9999, magnitude: 6, stackBehavior: 'refresh', maxStacks: 1, color: '#FFF', icon: 'scales' });
      processHit(ctx());
      expect(hp.B).toBe(96); // 10 - 6 absorbed = 4 damage
    });

    it('lifesteal heals attacker', () => {
      hp.A = 80;
      statusMgr.apply({ team: 'A', type: 'lifesteal', durationMs: 9999, magnitude: 0.5, stackBehavior: 'refresh', maxStacks: 1, color: '#F0F', icon: 'burst' });
      processHit(ctx());
      expect(hp.A).toBeGreaterThan(80); // healed by 50% of 10
    });
  });

  describe('speed boost after hit', () => {
    it('applies speedBoost to the defender team', () => {
      processHit(ctx());
      expect(statusMgr.hasEffect('B', 'speedBoost')).toBe(true);
    });

    it('speedBoost is applied to target of attack', () => {
      processHit(ctx(SWORD.attacks[0], 'B'));
      expect(statusMgr.hasEffect('A', 'speedBoost')).toBe(true);
    });
  });

  describe('attack-level status effect', () => {
    it('applies hitStatusEffect to target when damage > 0', () => {
      const attackWithFreeze: AttackConfig = {
        ...SWORD.attacks[0],
        hitStatusEffect: 'freeze', hitStatusDuration: 2000, hitStatusMagnitude: 0.5,
        hitStatusColor: '#00F', hitStatusIcon: 'dot-yellow',
      };
      processHit(ctx(attackWithFreeze));
      expect(statusMgr.hasEffect('B', 'freeze')).toBe(true);
    });

    it('does not apply hitStatusEffect when damage is 0', () => {
      statusMgr.apply({ team: 'B', type: 'shield', durationMs: 9999, magnitude: 999, stackBehavior: 'refresh', maxStacks: 1, color: '#FFF', icon: 'scales' });
      const attackWithFreeze: AttackConfig = {
        ...SWORD.attacks[0], damage: 1,
        hitStatusEffect: 'freeze', hitStatusDuration: 2000, hitStatusMagnitude: 0.5,
        hitStatusColor: '#00F', hitStatusIcon: 'dot-yellow',
      };
      processHit(ctx(attackWithFreeze));
      expect(statusMgr.hasEffect('B', 'freeze')).toBe(false);
    });
  });

  describe('onAbility callback', () => {
    it('fires onHitDealt for attacker and onHitReceived for defender', () => {
      const onAbility = vi.fn();
      const c = { ...ctx(), onAbility };
      processHit(c);
      const triggers = onAbility.mock.calls.map(([, , trigger]) => trigger);
      expect(triggers).toContain('onHitDealt');
      expect(triggers).toContain('onHitReceived');
    });
  });

  describe('projectile attack', () => {
    it('reduces defender HP', () => {
      const laserAttack: AttackConfig = LASER.attacks[0];
      const c = { ...ctx(laserAttack), weapon: LASER };
      processHit(c);
      expect(hp.B).toBe(88);
    });
  });

  describe('shield attack', () => {
    it('does not deal hp damage when attack.damage === 0', () => {
      const shieldAttack: AttackConfig = { type: 'shield', cooldown: 0, damage: 0, knockback: 100 };
      processHit(ctx(shieldAttack));
      expect(hp.B).toBe(100);
    });
  });

  describe('aoe attack', () => {
    it('reduces defender HP', () => {
      const aoeAttack: AttackConfig = { type: 'aoe', cooldown: 5, damage: 6, knockback: 100 };
      processHit(ctx(aoeAttack));
      expect(hp.B).toBe(94);
    });
  });
});
