import { vi } from 'vitest';
import Matter from 'matter-js';
import type { TeamConfig, WeaponStats } from '../../models/types';
import type { ParticleController } from '../ParticleController';
import type { EffectsController } from '../EffectsController';
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
  return {
    pushWeaponEffect: vi.fn(), applyScreenShake: vi.fn(), applyScreenFlash: vi.fn(),
    applyHitFlash: vi.fn(), applySlowMotion: vi.fn(), applyTierEffects: vi.fn(),
  } as unknown as EffectsController;
}

export function makeAudio(): AudioEmitter {
  return { emitHit: vi.fn(), emitLaser: vi.fn(), emitAbility: vi.fn() } as unknown as AudioEmitter;
}
