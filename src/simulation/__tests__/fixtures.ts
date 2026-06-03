import { vi } from 'vitest';
import Matter from 'matter-js';
import type { TeamConfig, WeaponStats } from '../../models/types';
import type { ParticleController } from '../ParticleController';
import { EffectsController } from '../EffectsController';
import type { AudioEmitter } from '../AudioEmitter';

export const SWORD: WeaponStats = {
  name: 'Test Sword', description: '', range: 1, speed: 5, trigger: 'onCollision',
  color: '#AAAAFF',
  attacks: [{ type: 'melee', cooldown: 1, damage: 10, knockback: 40 }],
};

export const BASE_ABILITY = { id: 'test', name: 'Test', description: '' };

export function makeBody(x = 240, y = 240): Matter.Body {
  const b = Matter.Bodies.circle(x, y, 20);
  Matter.Body.setVelocity(b, { x: 0, y: 0 });
  return b;
}

export function makeTeam(weapon: WeaponStats = SWORD): TeamConfig {
  return {
    fighterId: 'test', name: 'Test',
    ball: { name: 'Ball', radius: 20, mass: 1, maxSpeed: 5, friction: 0, restitution: 0.9, spinSpeed: 1, durability: 100, color: '#FF0000' },
    weapon,
    audioProfile: { hitStyle: 'thunderous', abilityStyle: 'berserk' },
  };
}

export function makeParticles(): ParticleController {
  return { pushFloater: vi.fn(), spawnBurst: vi.fn(), pushTrail: vi.fn() } as unknown as ParticleController;
}

export function makeEffects(): EffectsController {
  const fx = new EffectsController();
  vi.spyOn(fx, 'pushWeaponEffect');
  vi.spyOn(fx, 'applyScreenShake');
  vi.spyOn(fx, 'applyScreenFlash');
  vi.spyOn(fx, 'applyHitFlash');
  vi.spyOn(fx, 'applySlowMotion');
  vi.spyOn(fx, 'applyTierEffects');
  vi.spyOn(fx, 'applyFreeze');
  vi.spyOn(fx, 'extendFreeze');
  return fx;
}

export function makeAudio(): AudioEmitter {
  return {
    emitHit: vi.fn(), emitLaser: vi.fn(), emitAbility: vi.fn(),
    emitAbilityHit: vi.fn(), emitParry: vi.fn(),
  } as unknown as AudioEmitter;
}
