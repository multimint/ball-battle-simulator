import type { BallStats, WeaponStats, BallAbility, StatusEffect } from '../models/types';
import type { Particle, WeaponEffect, FloatingDamage, ScreenShake, ScreenFlash, HitFlash, TrailSegment, Bullet } from '../models/GameState';
import type { Ctx2D } from './ctx';
import { drawBackground, drawArenaWalls } from './drawBackground';
import { drawBall } from './drawBall';
import { drawParticles } from './drawParticles';
import { drawFloaters } from './drawFloaters';
import { drawWeaponEffects } from './drawWeaponEffect';
import { drawOrbitWeapon } from './drawOrbitWeapon';
import { drawBullets } from './drawBullets';
import { ARENA_SIZE } from '../constants/gameConstants';

export interface BallRenderPos {
  x: number;
  y: number;
  angle: number;
}

export interface RenderState {
  ballAPos: BallRenderPos;
  ballBPos: BallRenderPos;
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
  screenFlash: ScreenFlash;
  hitFlashA: HitFlash;
  hitFlashB: HitFlash;
  colorA: string;
  colorB: string;
  trailSegments?: TrailSegment[];
  bullets?: Bullet[];
  abilityA?: BallAbility;
  abilityB?: BallAbility;
  effectsA?: StatusEffect[];
  effectsB?: StatusEffect[];
  rangeMultA?: number;
  rangeMultB?: number;
}

export class Renderer {
  private ctx: Ctx2D;
  private staticBg: OffscreenCanvas | null;

  constructor(ctx: Ctx2D, staticBg?: OffscreenCanvas) {
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
      ctx.drawImage(this.staticBg, 0, 0);
    } else {
      drawBackground(ctx);
      drawArenaWalls(ctx, state.colorA, state.colorB);
    }

    // 2. Ability trail segments (drawn under shields and balls)
    for (const seg of state.trailSegments ?? []) {
      ctx.globalAlpha = Math.max(0, seg.alpha);
      ctx.fillStyle = seg.color;
      ctx.beginPath();
      ctx.arc(seg.x, seg.y, seg.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 3. Shield-type weapon effects (drawn behind balls so ball sits in front of shield)
    drawWeaponEffects(ctx, state.weaponEffects.filter((e) => e.type === 'shield'));

    // 4. Balls
    drawBall(
      ctx,
      state.ballAPos.x,
      state.ballAPos.y,
      state.ballAPos.angle,
      state.ballA,
      state.hpA,
      state.maxHpA,
      'A',
      state.effectsA,
      state.ballA.ability,
      state.hitFlashA,
    );
    drawBall(
      ctx,
      state.ballBPos.x,
      state.ballBPos.y,
      state.ballBPos.angle,
      state.ballB,
      state.hpB,
      state.maxHpB,
      'B',
      state.effectsB,
      state.ballB.ability,
      state.hitFlashB,
    );

    // 5. Orbiting weapons (drawn on top of balls, inside the shake transform)
    drawOrbitWeapon(
      ctx,
      state.ballAPos.x,
      state.ballAPos.y,
      state.ballA.radius,
      state.orbitAngleA,
      state.weaponA,
      'A',
      state.rangeMultA ?? 1,
    );
    drawOrbitWeapon(
      ctx,
      state.ballBPos.x,
      state.ballBPos.y,
      state.ballB.radius,
      state.orbitAngleB,
      state.weaponB,
      'B',
      state.rangeMultB ?? 1,
    );

    // 6. Traveling bullets (drawn over weapons, under hit effects)
    drawBullets(ctx, state.bullets ?? []);

    // 7. Remaining weapon effects (explosions, lasers, sword flashes, etc.)
    drawWeaponEffects(ctx, state.weaponEffects.filter((e) => e.type !== 'shield'));

    // 8. Particles
    drawParticles(ctx, state.particles);

    ctx.restore(); // end shake transform

    // 8. Screen flash overlay (outside shake, full-canvas color burst)
    if (state.screenFlash.ttl > 0 && state.screenFlash.alpha > 0.01) {
      ctx.save();
      ctx.globalAlpha = state.screenFlash.alpha;
      ctx.fillStyle = state.screenFlash.color;
      ctx.fillRect(0, 0, ARENA_SIZE, ARENA_SIZE);
      ctx.restore();
    }

    // 9. Floating damage numbers (outside shake so they stay legible)
    drawFloaters(ctx, state.floaters);
  }

  clear(): void {
    this.ctx.clearRect(0, 0, ARENA_SIZE, ARENA_SIZE);
  }
}
