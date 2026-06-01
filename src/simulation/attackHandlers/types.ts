import type Matter from 'matter-js';
import type { WeaponStats, AttackConfig } from '../../models/types';
import type { ParticleController } from '../ParticleController';
import type { EffectsController } from '../EffectsController';

export interface AttackHandlerCtx {
  weapon: WeaponStats;
  attack: AttackConfig;
  attacker: Matter.Body;
  defender: Matter.Body;
  targetTeam: 'A' | 'B';
  dir: { x: number; y: number };
  hitAngle: number;
  damage: (team: 'A' | 'B', amount: number) => number;
  particles: ParticleController;
  effects: EffectsController;
}

export interface AttackHandler {
  resolve(ctx: AttackHandlerCtx): void;
  /** False = suppress hit audio after resolve. Defaults to true. */
  emitsAudio?: boolean;
}
