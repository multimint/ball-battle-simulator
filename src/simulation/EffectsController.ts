import type { WeaponEffect, ScreenShake, ScreenFlash, HitFlash } from '../models/GameState';
import { createWeaponEffect } from '../rendering/drawWeaponEffect';
import {
  SLOW_MOTION_FACTOR,
  SLOW_MOTION_RECOVERY,
  SCREEN_SHAKE_TTL,
} from '../constants/gameConstants';

export class EffectsController {
  screenShake: ScreenShake = { magnitude: 0, ttl: 0 };
  screenFlash: ScreenFlash = { alpha: 0, color: '#FFFFFF', ttl: 0 };
  hitFlashA: HitFlash = { alpha: 0, color: '#FFFFFF', ttl: 0 };
  hitFlashB: HitFlash = { alpha: 0, color: '#FFFFFF', ttl: 0 };
  slowMotion = 1.0;
  weaponEffects: WeaponEffect[] = [];
  private freezeFramesRemaining = 0;
  /** Alpha of the full-arena overlay drawn during a casting freeze. */
  castingOverlay = 0;
  castingOverlayColor = '#22CC55';
  castingOverlayPeakAlpha = 0.22;
  private castingOverlayFrame = 0;
  /** Which team is currently casting — used by the renderer for the spotlight. */
  castingTeam: 'A' | 'B' | null = null;

  /** Freeze physics for N frames (weapon-effect animations still play at full speed). */
  applyFreeze(frames: number, color = '#22CC55', peakAlpha = 0.22, team: 'A' | 'B' | null = null): void {
    this.freezeFramesRemaining = Math.max(this.freezeFramesRemaining, frames);
    this.castingOverlayColor = color;
    this.castingOverlayPeakAlpha = peakAlpha;
    this.slowMotion = 0;
    this.castingOverlayFrame = 0;
    this.castingOverlay = peakAlpha;
    if (team !== null) this.castingTeam = team;
  }

  /** Extend an already-running freeze by N frames without resetting the overlay animation. */
  extendFreeze(frames: number): void {
    this.freezeFramesRemaining = Math.max(this.freezeFramesRemaining, frames);
    this.slowMotion = 0;
  }

  step(): void {
    if (this.freezeFramesRemaining > 0) {
      this.freezeFramesRemaining--;
      this.castingOverlayFrame++;
      const p = this.castingOverlayPeakAlpha;
      this.castingOverlay = p * (0.75 + 0.25 * Math.abs(Math.sin(this.castingOverlayFrame * 0.28)));
      this.slowMotion = 0;           // hold frozen
    } else {
      this.castingOverlay = Math.max(0, this.castingOverlay - 0.032);
      if (this.castingOverlay <= 0) this.castingTeam = null;
      if (this.slowMotion < 1.0) {
        this.slowMotion = Math.min(1.0, this.slowMotion + SLOW_MOTION_RECOVERY);
      }
    }
    if (this.screenShake.ttl > 0) this.screenShake.ttl--;
    if (this.screenFlash.ttl > 0) { this.screenFlash.ttl--; this.screenFlash.alpha *= 0.72; }
    if (this.hitFlashA.ttl > 0) { this.hitFlashA.ttl--; this.hitFlashA.alpha *= 0.68; }
    if (this.hitFlashB.ttl > 0) { this.hitFlashB.ttl--; this.hitFlashB.alpha *= 0.68; }
  }

  stepWeaponEffects(): void {
    for (const e of this.weaponEffects) e.progress += 1;
    this.weaponEffects = this.weaponEffects.filter((e) => e.progress < e.maxProgress);
  }

  applyHitFlash(team: 'A' | 'B', alpha: number, color: string, ttl: number): void {
    if (team === 'A') this.hitFlashA = { alpha, color, ttl };
    else             this.hitFlashB = { alpha, color, ttl };
  }

  applyScreenShake(magnitude: number, ttl: number): void {
    this.screenShake = { magnitude, ttl };
  }

  applyScreenFlash(alpha: number, color: string, ttl: number): void {
    this.screenFlash = { alpha, color, ttl };
  }

  applySlowMotion(): void {
    this.slowMotion = SLOW_MOTION_FACTOR;
  }

  applyHitShake(magnitude: number): void {
    const ttl = Math.round(Math.min(SCREEN_SHAKE_TTL, magnitude * 2.5));
    if (magnitude >= 0.5) this.screenShake = { magnitude, ttl };
  }

  applyTierEffects(type: string, defTeam: 'A' | 'B', color: string, dmg: number): void {
    this.applyHitShake(Math.min(8, dmg / 2));
    if (dmg >= 12 || type === 'aoe') this.applySlowMotion();
    const c = color || '#FFFFFF';
    if (type === 'melee') {
      this.applyHitFlash(defTeam, 0.65, c, 5);
    } else if (type === 'projectile') {
      this.applyScreenFlash(0.22, c, 5);
    } else if (type === 'aoe') {
      this.applyScreenFlash(0.40, c, 7);
      this.applyHitFlash(defTeam, 0.75, '#FFFFFF', 6);
    } else if (type === 'shield') {
      this.applyHitFlash(defTeam, 0.50, c, 4);
    }
  }

  pushWeaponEffect(...args: Parameters<typeof createWeaponEffect>): void {
    this.weaponEffects.push(createWeaponEffect(...args));
  }
}
