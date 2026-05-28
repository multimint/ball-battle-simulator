import { useRef } from 'react';
import Matter from 'matter-js';
import type { BallStats, WeaponStats } from '../models/types';
import type { WeaponEffect } from '../models/GameState';
import { gameBus } from '../models/EventBus';
import { applyKnockback, directionBetween } from '../utils/physics';
import { getWeaponHitboxRadius, getOrbitPosition } from '../rendering/drawOrbitWeapon';
import { createWeaponEffect } from '../rendering/drawWeaponEffect';
import {
  WEAPON_ORBIT_SPEED_SCALE,
  WEAPON_HIT_COOLDOWN_MIN,
} from '../constants/gameConstants';

export interface WeaponSystem {
  weaponEffects: React.MutableRefObject<WeaponEffect[]>;
  orbitAngleA: React.MutableRefObject<number>;
  orbitAngleB: React.MutableRefObject<number>;
  updateOrbit: (
    delta: number,
    now: number,
    bA: Matter.Body,
    bB: Matter.Body,
    ballA: BallStats,
    ballB: BallStats,
    weaponA: WeaponStats,
    weaponB: WeaponStats,
    hpA: number,
    hpB: number
  ) => void;
}

export function useWeaponSystem(): WeaponSystem {
  const weaponEffects = useRef<WeaponEffect[]>([]);

  // Orbit angles (radians): A goes clockwise, B counter-clockwise for visual variety
  const orbitAngleA = useRef<number>(Math.PI * 0.25);   // start offset
  const orbitAngleB = useRef<number>(Math.PI * 1.25);   // opposite side

  // Cooldowns: track last time each weapon's orbit actually struck the opponent
  const lastHitA = useRef<number>(0);
  const lastHitB = useRef<number>(0);

  /** Minimum orbit angular speed (rad/s) — ensures even speed-0 weapons visually spin. */
  function orbitSpeed(weapon: WeaponStats): number {
    return Math.max(1.8, weapon.speed) * WEAPON_ORBIT_SPEED_SCALE;
  }

  /** Apply the on-hit effect for the given weapon, called when orbit hit is detected. */
  function applyHitEffect(
    weapon: WeaponStats,
    attacker: Matter.Body,
    defender: Matter.Body,
    attackerTeam: 'A' | 'B'
  ): void {
    const targetTeam = attackerTeam === 'A' ? 'B' : 'A';
    const dir = directionBetween(attacker, defender);
    const hitAngle = Math.atan2(dir.y, dir.x);

    switch (weapon.category) {
      case 'melee': {
        let kbMult = 1.0;
        let dmgMult = 1.0;
        let heavyShake = 0;

        if (weapon.name === 'Heavy Hammer') { kbMult = 1.6; dmgMult = 1.2; heavyShake = 6; }
        else if (weapon.name === 'Long Spear') { kbMult = 0.9; }
        else if (weapon.name === 'Chain Flail') { kbMult = 0.7; dmgMult = 0.8; }
        // Swift Sword: defaults (fast orbit compensates)

        applyKnockback(defender, dir.x, dir.y, weapon.knockback * kbMult);
        gameBus.emit('damage', {
          team: targetTeam,
          amount: weapon.damage * dmgMult,
          x: defender.position.x,
          y: defender.position.y,
        });
        gameBus.emit('particleBurst', {
          x: defender.position.x,
          y: defender.position.y,
          color: weapon.color ?? '#CC6633',
          count: 8,
        });
        if (heavyShake > 0) gameBus.emit('heavyHit', { magnitude: heavyShake });

        const effectType =
          weapon.name === 'Heavy Hammer' ? 'hammer'
          : weapon.name === 'Long Spear' ? 'spear'
          : weapon.name === 'Chain Flail' ? 'flail'
          : 'sword';
        weaponEffects.current.push(
          createWeaponEffect(effectType, attacker.position.x, attacker.position.y,
            hitAngle, weapon.color ?? '#CC6633', 12)
        );
        break;
      }

      case 'shield': {
        // Shield deflects the opponent away from the attacker; no significant damage
        applyKnockback(defender, dir.x, dir.y, weapon.knockback * 1.8);
        // Tiny chip damage on shield contact
        if (weapon.damage > 0) {
          gameBus.emit('damage', {
            team: targetTeam,
            amount: Math.max(1, Math.round(weapon.damage * 0.2)),
            x: defender.position.x,
            y: defender.position.y,
          });
        }
        weaponEffects.current.push(
          createWeaponEffect('shield', attacker.position.x, attacker.position.y,
            hitAngle, weapon.color ?? '#AAAAFF', 18,
            { radius: (attacker.circleRadius ?? 25) + 14 })
        );
        gameBus.emit('particleBurst', {
          x: attacker.position.x,
          y: attacker.position.y,
          color: weapon.color ?? '#AAAAFF',
          count: 6,
        });
        break;
      }

      case 'projectile': {
        let dmgMult = 1.0;
        let kbMult = 1.0;

        if (weapon.name === 'Grenade Bomb') {
          dmgMult = 1.3; kbMult = 1.2;
          weaponEffects.current.push(
            createWeaponEffect('explosion', defender.position.x, defender.position.y,
              0, weapon.color ?? '#44AA44', 20, { radius: 70 })
          );
          gameBus.emit('heavyHit', { magnitude: 5 });
        } else if (weapon.name === 'Power Cannon') {
          dmgMult = 1.1; kbMult = 1.5;
          gameBus.emit('heavyHit', { magnitude: 4 });
        } else if (weapon.name === 'Energy Laser') {
          // Laser: create beam effect from attacker to defender
          weaponEffects.current.push(
            createWeaponEffect('laser', attacker.position.x, attacker.position.y,
              hitAngle, weapon.color ?? '#44AAFF', 10,
              { x2: defender.position.x, y2: defender.position.y })
          );
        }

        applyKnockback(defender, dir.x, dir.y, weapon.knockback * kbMult);
        gameBus.emit('damage', {
          team: targetTeam,
          amount: weapon.damage * dmgMult,
          x: defender.position.x,
          y: defender.position.y,
        });
        gameBus.emit('particleBurst', {
          x: defender.position.x,
          y: defender.position.y,
          color: weapon.color ?? '#FFF',
          count: 10,
        });
        break;
      }

      case 'aoe': {
        // Shockwave: big radial blast on contact
        applyKnockback(defender, dir.x, dir.y, weapon.knockback * 1.5);
        gameBus.emit('damage', {
          team: targetTeam,
          amount: weapon.damage,
          x: defender.position.x,
          y: defender.position.y,
        });
        weaponEffects.current.push(
          createWeaponEffect('shockwave', attacker.position.x, attacker.position.y,
            0, weapon.color ?? '#FF44FF', 25, { radius: weapon.range * 30 })
        );
        gameBus.emit('heavyHit', { magnitude: 5 });
        gameBus.emit('particleBurst', {
          x: attacker.position.x,
          y: attacker.position.y,
          color: weapon.color ?? '#FF44FF',
          count: 15,
        });
        break;
      }

      case 'utility': {
        if (weapon.name === 'Magnet Beam') {
          // Pull the defender toward the attacker
          const pullDir = directionBetween(defender, attacker);
          applyKnockback(defender, pullDir.x, pullDir.y, 80);
          if (weapon.damage > 0) {
            gameBus.emit('damage', {
              team: targetTeam,
              amount: weapon.damage,
              x: defender.position.x,
              y: defender.position.y,
            });
          }
          gameBus.emit('particleBurst', {
            x: (attacker.position.x + defender.position.x) / 2,
            y: (attacker.position.y + defender.position.y) / 2,
            color: weapon.color ?? '#44FFAA',
            count: 6,
          });
        } else if (weapon.name === 'Repulsor') {
          // Push opponent away strongly; mild self-recoil
          applyKnockback(defender, dir.x, dir.y, weapon.knockback * 1.3);
          applyKnockback(attacker, -dir.x, -dir.y, weapon.knockback * 0.4);
          gameBus.emit('damage', {
            team: targetTeam,
            amount: weapon.damage,
            x: defender.position.x,
            y: defender.position.y,
          });
          weaponEffects.current.push(
            createWeaponEffect('explosion', attacker.position.x, attacker.position.y,
              0, weapon.color ?? '#FFFF44', 18, { radius: 55 })
          );
          gameBus.emit('heavyHit', { magnitude: 4 });
        }
        break;
      }
    }
  }

  function updateOrbit(
    delta: number,
    now: number,
    bA: Matter.Body,
    bB: Matter.Body,
    ballA: BallStats,
    ballB: BallStats,
    weaponA: WeaponStats,
    weaponB: WeaponStats,
    hpA: number,
    hpB: number
  ): void {
    // dt in seconds for angular math
    const dt = delta / 1000;

    // ── Advance orbit angles ───────────────────────────────────────────────
    orbitAngleA.current += orbitSpeed(weaponA) * dt;   // clockwise
    orbitAngleB.current -= orbitSpeed(weaponB) * dt;   // counter-clockwise

    // ── Compute weapon world positions ─────────────────────────────────────
    const hitboxA = getWeaponHitboxRadius(weaponA);
    const hitboxB = getWeaponHitboxRadius(weaponB);

    const posA = getOrbitPosition(bA.position.x, bA.position.y, ballA.radius, orbitAngleA.current, hitboxA);
    const posB = getOrbitPosition(bB.position.x, bB.position.y, ballB.radius, orbitAngleB.current, hitboxB);

    // ── Hit detection: weapon A vs ball B ──────────────────────────────────
    if (hpA > 0 && hpB > 0) {
      const distAtoB = Math.hypot(posA.x - bB.position.x, posA.y - bB.position.y);
      const hitThreshAB = hitboxA + ballB.radius;
      if (distAtoB < hitThreshAB) {
        const cooldown = Math.max(WEAPON_HIT_COOLDOWN_MIN, weaponA.cooldown * 1000);
        if (now - lastHitA.current >= cooldown) {
          lastHitA.current = now;
          applyHitEffect(weaponA, bA, bB, 'A');
        }
      }
    }

    // ── Hit detection: weapon B vs ball A ──────────────────────────────────
    if (hpA > 0 && hpB > 0) {
      const distBtoA = Math.hypot(posB.x - bA.position.x, posB.y - bA.position.y);
      const hitThreshBA = hitboxB + ballA.radius;
      if (distBtoA < hitThreshBA) {
        const cooldown = Math.max(WEAPON_HIT_COOLDOWN_MIN, weaponB.cooldown * 1000);
        if (now - lastHitB.current >= cooldown) {
          lastHitB.current = now;
          applyHitEffect(weaponB, bB, bA, 'B');
        }
      }
    }

    // ── Age and cull weapon visual effects ─────────────────────────────────
    for (const e of weaponEffects.current) e.progress += 1;
    weaponEffects.current = weaponEffects.current.filter((e) => e.progress < e.maxProgress);
  }

  return { weaponEffects, orbitAngleA, orbitAngleB, updateOrbit };
}
