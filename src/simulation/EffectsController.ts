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

  step(): void {
    if (this.slowMotion < 1.0) this.slowMotion = Math.min(1.0, this.slowMotion + SLOW_MOTION_RECOVERY);
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
