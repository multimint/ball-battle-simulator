import Matter from 'matter-js';
import type { BallStats, WeaponStats } from '../models/types';
import type { Particle, WeaponEffect, FloatingDamage, ScreenShake } from '../models/GameState';
import { drawBackground, drawArenaWalls } from './drawBackground';
import { drawBall } from './drawBall';
import { drawParticles } from './drawParticles';
import { drawFloaters } from './drawFloaters';
import { drawWeaponEffects } from './drawWeaponEffect';
import { drawOrbitWeapon } from './drawOrbitWeapon';
import { ARENA_SIZE } from '../constants/gameConstants';

export interface RenderState {
  bodyA: Matter.Body;
  bodyB: Matter.Body;
  ballA: BallStats;
  ballB: BallStats;
  hpA: number;
  hpB: number;
  maxHpA: number;
  maxHpB: number;
  particles: Particle[];
  weaponEffects: WeaponEffect[];
  floaters: FloatingDamage[];
  /** Weapon definitions for orbit drawing */
  weaponA: WeaponStats;
  weaponB: WeaponStats;
  /** Current orbit angles (radians) */
  orbitAngleA: number;
  orbitAngleB: number;
  screenShake: ScreenShake;
  colorA: string;
  colorB: string;
}

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private staticBg: OffscreenCanvas | null;

  constructor(ctx: CanvasRenderingContext2D, staticBg?: OffscreenCanvas) {
    this.ctx = ctx;
    this.staticBg = staticBg ?? null;
  }

  render(state: RenderState): void {
    const { ctx } = this;
    const { screenShake } = state;

    ctx.clearRect(0, 0, ARENA_SIZE, ARENA_SIZE);

    // ── Apply screen shake ─────────────────────────────────────────────
    ctx.save();
    if (screenShake.ttl > 0) {
      const shakeMag = screenShake.magnitude * (screenShake.ttl / 18);
      ctx.translate(
        (Math.random() - 0.5) * shakeMag * 2,
        (Math.random() - 0.5) * shakeMag * 2
      );
    }

    // 1. Background + arena border (pre-rendered if available, otherwise dynamic)
    if (this.staticBg) {
      ctx.drawImage(this.staticBg as unknown as HTMLCanvasElement, 0, 0);
    } else {
      drawBackground(ctx);
      drawArenaWalls(ctx, state.colorA, state.colorB);
    }

    // 2. Shield-type weapon effects (drawn behind balls so ball sits in front of shield)
    drawWeaponEffects(ctx, state.weaponEffects.filter((e) => e.type === 'shield'));

    // 3. Balls
    drawBall(
      ctx,
      state.bodyA.position.x,
      state.bodyA.position.y,
      state.bodyA.angle,
      state.ballA,
      state.hpA,
      state.maxHpA,
      'A'
    );
    drawBall(
      ctx,
      state.bodyB.position.x,
      state.bodyB.position.y,
      state.bodyB.angle,
      state.ballB,
      state.hpB,
      state.maxHpB,
      'B'
    );

    // 4. Orbiting weapons (drawn on top of balls, inside the shake transform)
    drawOrbitWeapon(
      ctx,
      state.bodyA.position.x,
      state.bodyA.position.y,
      state.ballA.radius,
      state.orbitAngleA,
      state.weaponA,
      'A'
    );
    drawOrbitWeapon(
      ctx,
      state.bodyB.position.x,
      state.bodyB.position.y,
      state.ballB.radius,
      state.orbitAngleB,
      state.weaponB,
      'B'
    );

    // 5. Remaining weapon effects (explosions, lasers, sword flashes, etc.)
    drawWeaponEffects(ctx, state.weaponEffects.filter((e) => e.type !== 'shield'));

    // 6. Particles
    drawParticles(ctx, state.particles);

    ctx.restore(); // end shake transform

    // 7. Floating damage numbers (outside shake so they stay legible)
    drawFloaters(ctx, state.floaters);
  }

  clear(): void {
    this.ctx.clearRect(0, 0, ARENA_SIZE, ARENA_SIZE);
  }
}
