import { describe, it, expect, vi, beforeEach } from 'vitest';
import Matter from 'matter-js';
import { DroneController } from '../DroneController';
import type { DroneControllerDeps } from '../DroneController';
import { StatusEffectManager } from '../StatusEffectManager';
import type { WeaponController } from '../WeaponController';
import type { AttackConfig, BallAbility, WeaponStats } from '../../models/types';
import { makeBody, makeTeam, makeParticles, makeEffects, makeAudio, SWORD } from './fixtures';

// ── Weapon used in all tests ──────────────────────────────────────────────────

const SUMMON_ATTACK: AttackConfig = {
  type: 'summon',
  cooldown: 2.5,
  damage: 0,
  knockback: 0,
  summonHp: 15,
  summonRadius: 10,
  summonSpeed: 5,
  summonMaxCount: 3,
  summonNormalColor: '#3FB68B',
  summonContactDamage: 4,
  summonContactCooldownMs: 600,
  summonChargedColor: '#D4FF88',
  summonChargedDamage: 10,
};

const SUMMON_WEAPON: WeaponStats = {
  name: 'Test Summon', description: '', range: 1, speed: 5, trigger: 'onTimer',
  attacks: [SUMMON_ATTACK],
};

// ── Fixture builder ───────────────────────────────────────────────────────────

function makeDeps(weaponOverride: WeaponStats = SUMMON_WEAPON): DroneControllerDeps {
  const bodyA = makeBody(110, 240);
  const bodyB = makeBody(370, 240);
  const engine = Matter.Engine.create();
  Matter.Composite.add(engine.world, [bodyA, bodyB]);
  const fakeWeapons = { orbitAngleA: 0, orbitAngleB: Math.PI, bullets: [] } as unknown as WeaponController;

  return {
    teamA: makeTeam(weaponOverride),
    teamB: makeTeam(weaponOverride),
    bodyA,
    bodyB,
    engine,
    hp: { A: 100, B: 100 },
    maxHp: { A: 100, B: 100 },
    damageDealt: { A: 0, B: 0 },
    effects: makeEffects(),
    particles: makeParticles(),
    audio: makeAudio(),
    statusMgr: new StatusEffectManager(),
    weapons: fakeWeapons,
    recordGameEvent: vi.fn(),
    recordAbilityProc: vi.fn(),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('DroneController', () => {
  describe('spawnUnit', () => {
    it('adds a drone to the drones array', () => {
      const deps = makeDeps();
      const ctrl = new DroneController(deps);
      ctrl.spawnUnit('A', deps.bodyA, 0);
      expect(ctrl.drones).toHaveLength(1);
    });

    it('spawns drone with state: normal', () => {
      const deps = makeDeps();
      const ctrl = new DroneController(deps);
      ctrl.spawnUnit('A', deps.bodyA, 0);
      expect(ctrl.drones[0].state).toBe('normal');
    });

    it('respects summonMaxCount — 4th spawn is ignored when maxCount=3', () => {
      const deps = makeDeps();
      const ctrl = new DroneController(deps);
      ctrl.spawnUnit('A', deps.bodyA, 0);
      ctrl.spawnUnit('A', deps.bodyA, 0);
      ctrl.spawnUnit('A', deps.bodyA, 0);
      ctrl.spawnUnit('A', deps.bodyA, 0); // should be ignored
      expect(ctrl.drones).toHaveLength(3);
    });

    it('drone has charged config when charged fields are set in weapon', () => {
      const deps = makeDeps(); // SUMMON_ATTACK has summonChargedColor + summonChargedDamage
      const ctrl = new DroneController(deps);
      ctrl.spawnUnit('A', deps.bodyA, 0);
      expect(ctrl.drones[0].charged).toBeDefined();
    });

    it('drone charged is undefined when no charged fields are set in weapon', () => {
      const attackWithoutCharged: AttackConfig = {
        type: 'summon',
        cooldown: 2.5,
        damage: 0,
        knockback: 0,
        summonHp: 15,
        summonRadius: 10,
        summonSpeed: 5,
        summonMaxCount: 3,
      };
      const weaponWithoutCharged: WeaponStats = {
        ...SUMMON_WEAPON,
        attacks: [attackWithoutCharged],
      };
      const deps = makeDeps(weaponWithoutCharged);
      const ctrl = new DroneController(deps);
      ctrl.spawnUnit('A', deps.bodyA, 0);
      expect(ctrl.drones[0].charged).toBeUndefined();
    });
  });

  describe('handleCollision — charged state', () => {
    it('deals chargedDamage to enemy when charged drone collides with enemy ball', () => {
      const deps = makeDeps();
      const ctrl = new DroneController(deps);
      ctrl.spawnUnit('A', deps.bodyA, 0);
      ctrl.drones[0].state = 'charged';
      const drone = ctrl.drones[0];
      ctrl.handleCollision(drone.body, deps.bodyB, 0);
      expect(deps.hp.B).toBe(90); // 100 - 10 (summonChargedDamage)
    });

    it('removes drone from drones array after charged hit', () => {
      const deps = makeDeps();
      const ctrl = new DroneController(deps);
      ctrl.spawnUnit('A', deps.bodyA, 0);
      ctrl.drones[0].state = 'charged';
      const drone = ctrl.drones[0];
      ctrl.handleCollision(drone.body, deps.bodyB, 0);
      expect(ctrl.drones).toHaveLength(0);
    });

    it('records hit game event via recordGameEvent when dmg > 0', () => {
      const deps = makeDeps();
      const ctrl = new DroneController(deps);
      ctrl.spawnUnit('A', deps.bodyA, 0);
      ctrl.drones[0].state = 'charged';
      const drone = ctrl.drones[0];
      ctrl.handleCollision(drone.body, deps.bodyB, 0);
      expect(deps.recordGameEvent).toHaveBeenCalledWith('hit', 'A');
    });

    it('does NOT record hit event when enemy hp is already 0', () => {
      const deps = makeDeps();
      deps.hp.B = 0;
      const ctrl = new DroneController(deps);
      ctrl.spawnUnit('A', deps.bodyA, 0);
      ctrl.drones[0].state = 'charged';
      const drone = ctrl.drones[0];
      ctrl.handleCollision(drone.body, deps.bodyB, 0);
      expect(deps.recordGameEvent).not.toHaveBeenCalledWith('hit', 'A');
    });

    it('removes drone when it hits a non-enemy body (wall hit)', () => {
      const deps = makeDeps();
      const wallBody = makeBody(0, 0); // not deps.bodyB — a separate body
      const ctrl = new DroneController(deps);
      ctrl.spawnUnit('A', deps.bodyA, 0);
      ctrl.drones[0].state = 'charged';
      const drone = ctrl.drones[0];
      ctrl.handleCollision(drone.body, wallBody, 0);
      expect(ctrl.drones).toHaveLength(0);
    });
  });

  describe('handleCollision — normal state', () => {
    it('deals contactDamage to enemy on contact with enemy ball', () => {
      const deps = makeDeps();
      const ctrl = new DroneController(deps);
      ctrl.spawnUnit('A', deps.bodyA, 0);
      const drone = ctrl.drones[0];
      ctrl.handleCollision(drone.body, deps.bodyB, 0);
      expect(deps.hp.B).toBe(96); // 100 - 4 (summonContactDamage)
    });

    it('respects contactCooldownMs — second hit at simTime=100ms is ignored (cooldown=600ms)', () => {
      const deps = makeDeps();
      const ctrl = new DroneController(deps);
      ctrl.spawnUnit('A', deps.bodyA, 0);
      const drone = ctrl.drones[0];
      ctrl.handleCollision(drone.body, deps.bodyB, 0);   // first hit at t=0
      ctrl.handleCollision(drone.body, deps.bodyB, 100); // within 600ms cooldown → ignored
      expect(deps.hp.B).toBe(96); // only one hit
    });

    it('does NOT remove drone on normal contact — drone stays alive', () => {
      const deps = makeDeps();
      const ctrl = new DroneController(deps);
      ctrl.spawnUnit('A', deps.bodyA, 0);
      const drone = ctrl.drones[0];
      ctrl.handleCollision(drone.body, deps.bodyB, 0);
      expect(ctrl.drones).toHaveLength(1);
    });
  });

  describe('dash-through ability', () => {
    const DASH_ABILITY: BallAbility = {
      id: 'dash', name: 'Dash', description: '',
      trigger: 'onTimer',
      params: {
        intervalMs: 100,
        dashThroughEnemy: true,
        dashDamage: 12,
        dashStartHold: 1,
        dashMoveFrames: 2,
        dashTotalFrames: 10,
      },
    };

    function makeDashDeps(): DroneControllerDeps {
      const deps = makeDeps();
      const dashTeam = { ...deps.teamA, ball: { ...deps.teamA.ball, ability: DASH_ABILITY } };
      deps.teamA = dashTeam;
      return deps;
    }

    it('calls applyFreeze when ability fires', () => {
      const deps = makeDashDeps();
      const ctrl = new DroneController(deps);
      ctrl.tick(101, 100, false); // timer 0→101, fires (intervalMs=100), timer→1
      expect(deps.effects.applyFreeze).toHaveBeenCalled();
    });

    it('deals dashDamage to enemy at the correct midpoint frame', () => {
      const deps = makeDashDeps();
      const ctrl = new DroneController(deps);
      // Tick 1: ability fires, frame→1 (startHold), no damage yet
      ctrl.tick(101, 100, false);
      expect(deps.hp.B).toBe(100);
      // Tick 2: frame→2, mf=1=ceil(moveFrames/2), impact fires
      ctrl.tick(0, 116, false);
      expect(deps.hp.B).toBe(88); // 100 - 12
    });

    it('calls emitAbilityHit at the impact frame', () => {
      const deps = makeDashDeps();
      const ctrl = new DroneController(deps);
      ctrl.tick(101, 100, false);
      ctrl.tick(0, 116, false); // impact frame
      expect(deps.audio.emitAbilityHit).toHaveBeenCalledOnce();
    });

    it('calls extendFreeze on frames after ability fires (keeping freeze alive)', () => {
      const deps = makeDashDeps();
      const ctrl = new DroneController(deps);
      ctrl.tick(101, 100, false); // fires ability
      ctrl.tick(0, 116, false);   // second tick — extendFreeze must be called
      expect(deps.effects.extendFreeze).toHaveBeenCalled();
    });

    it('does not deal damage a second time on subsequent ticks', () => {
      const deps = makeDashDeps();
      const ctrl = new DroneController(deps);
      ctrl.tick(101, 100, false); // fires
      ctrl.tick(0, 116, false);   // impact (hp=88)
      ctrl.tick(0, 132, false);   // past impact
      ctrl.tick(0, 148, false);
      expect(deps.hp.B).toBe(88); // no further damage
    });

    it('reads dashDamage and dashTotalFrames from ability params, not hardcoded constants', () => {
      const deps = makeDashDeps();
      // Override with custom values
      const customAbility: BallAbility = {
        ...DASH_ABILITY,
        params: { ...DASH_ABILITY.params, dashDamage: 7, dashTotalFrames: 3 },
      };
      deps.teamA = { ...deps.teamA, ball: { ...deps.teamA.ball, ability: customAbility } };
      const ctrl = new DroneController(deps);
      ctrl.tick(101, 100, false); // fires
      ctrl.tick(0, 116, false);   // impact
      expect(deps.hp.B).toBe(93); // 100 - 7
    });
  });

  describe('status effects', () => {
    it('summonChargedStatusEffect freeze → statusMgr.hasEffect(B, freeze) is true after charged hit', () => {
      const attackWithChargedFreeze: AttackConfig = {
        ...SUMMON_ATTACK,
        summonChargedStatusEffect: 'freeze',
        summonChargedStatusDuration: 2000,
        summonChargedStatusMagnitude: 0.5,
        summonChargedStatusColor: '#00F',
      };
      const weapon: WeaponStats = { ...SUMMON_WEAPON, attacks: [attackWithChargedFreeze] };
      const deps = makeDeps(weapon);
      const ctrl = new DroneController(deps);
      ctrl.spawnUnit('A', deps.bodyA, 0);
      ctrl.drones[0].state = 'charged';
      const drone = ctrl.drones[0];
      ctrl.handleCollision(drone.body, deps.bodyB, 0);
      expect(deps.statusMgr.hasEffect('B', 'freeze')).toBe(true);
    });

    it('summonContactStatusEffect weaken → statusMgr.hasEffect(B, weaken) is true after normal hit', () => {
      const attackWithContactWeaken: AttackConfig = {
        ...SUMMON_ATTACK,
        summonContactStatusEffect: 'weaken',
        summonContactStatusDuration: 2000,
        summonContactStatusMagnitude: 0.3,
        summonContactStatusColor: '#F80',
      };
      const weapon: WeaponStats = { ...SUMMON_WEAPON, attacks: [attackWithContactWeaken] };
      const deps = makeDeps(weapon);
      const ctrl = new DroneController(deps);
      ctrl.spawnUnit('A', deps.bodyA, 0);
      const drone = ctrl.drones[0];
      ctrl.handleCollision(drone.body, deps.bodyB, 0);
      expect(deps.statusMgr.hasEffect('B', 'weaken')).toBe(true);
    });
  });
});
