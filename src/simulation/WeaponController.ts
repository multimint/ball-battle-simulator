import Matter from 'matter-js';
import type { TeamConfig, WeaponStats, AttackConfig } from '../models/types';
import type { Bullet } from '../models/GameState';
import type { StatusEffectManager } from './StatusEffectManager';
import { getWeaponHitboxRadius, getOrbitPosition } from '../rendering/drawOrbitWeapon';
import {
  WEAPON_HIT_COOLDOWN_MIN, WEAPON_ORBIT_SPEED_SCALE, HITSCAN_PREFIRE_MS, BERSERK_ORBIT_SPEED_MULT,
  WEAPON_SPEED_TRIGGER_FRAC, WEAPON_EDGE_THRESHOLD_PX, LOW_HP_THRESHOLD, ARENA_SIZE, WALL_THICKNESS,
} from '../constants/gameConstants';
import { isAbilityBerserk } from '../utils/ability';
import type { TriggerType } from '../models/types';

const { Body } = Matter;

interface TeamWeaponState {
  orbitAngle: number;
  lastHitTimes: number[];
  burstCounts: number[];
  lastBulletTimes: number[];
  charge: number;
  rangeMult: number;
}

const ORBIT_DIR: Record<'A' | 'B', 1 | -1> = { A: 1, B: -1 };

export function shouldWeaponFire(
  trigger: TriggerType,
  attacker: Matter.Body,
  hpFrac: number,
  effectiveMaxSpeed: number,
): boolean {
  switch (trigger) {
    case 'none':    return false;
    case 'onLowHP': return hpFrac <= LOW_HP_THRESHOLD;
    case 'onSpeed': {
      const speed = Math.hypot(attacker.velocity.x, attacker.velocity.y);
      return speed >= effectiveMaxSpeed * WEAPON_SPEED_TRIGGER_FRAC;
    }
    case 'onEdge': {
      const { x, y } = attacker.position;
      return x < WEAPON_EDGE_THRESHOLD_PX
          || x > ARENA_SIZE - WEAPON_EDGE_THRESHOLD_PX
          || y < WEAPON_EDGE_THRESHOLD_PX
          || y > ARENA_SIZE - WEAPON_EDGE_THRESHOLD_PX;
    }
    default: return true; // onCollision, onTimer — gated by existing attack logic
  }
}

function orbitSpeed(weapon: WeaponStats): number {
  return Math.max(1.8, weapon.speed) * WEAPON_ORBIT_SPEED_SCALE;
}

export class WeaponController {
  private state: Record<'A' | 'B', TeamWeaponState>;

  bullets: Bullet[] = [];

  get orbitAngleA() { return this.state.A.orbitAngle; }
  get orbitAngleB() { return this.state.B.orbitAngle; }
  get chargeA()     { return this.state.A.charge; }
  get chargeB()     { return this.state.B.charge; }
  get rangeMultA()  { return this.state.A.rangeMult; }
  get rangeMultB()  { return this.state.B.rangeMult; }

  constructor(teamA: TeamConfig, teamB: TeamConfig) {
    const initLastHit = (attacks: typeof teamA.weapon.attacks) =>
      attacks.map((a) => (a.type === 'projectile' && !a.aimAtEnemy ? -1_000_000 : 0));

    this.state = {
      A: {
        orbitAngle: Math.PI * 0.25,
        lastHitTimes:    initLastHit(teamA.weapon.attacks),
        burstCounts:     new Array(teamA.weapon.attacks.length).fill(0),
        lastBulletTimes: new Array(teamA.weapon.attacks.length).fill(0),
        charge: 100, rangeMult: 1,
      },
      B: {
        orbitAngle: Math.PI * 1.25,
        lastHitTimes:    initLastHit(teamB.weapon.attacks),
        burstCounts:     new Array(teamB.weapon.attacks.length).fill(0),
        lastBulletTimes: new Array(teamB.weapon.attacks.length).fill(0),
        charge: 100, rangeMult: 1,
      },
    };
  }

  getRangeMult(team: 'A' | 'B', teamA: TeamConfig, teamB: TeamConfig, statusMgr: StatusEffectManager): number {
    const ability = team === 'A' ? teamA.ball.ability : teamB.ball.ability;
    if (!ability) return 1;
    const rangePerStack = ability.params.rangePerStack ?? 0;
    if (rangePerStack === 0) return 1;
    const effectType = ability.params.statusEffect;
    if (!effectType) return 1;
    const stacks = statusMgr.getEffects(team).find((e) => e.type === effectType)?.stacks ?? 0;
    return 1 + stacks * rangePerStack;
  }

  updateOrbit(
    delta: number,
    simTime: number,
    teamA: TeamConfig,
    teamB: TeamConfig,
    bodyA: Matter.Body,
    bodyB: Matter.Body,
    hp: { A: number; B: number },
    maxHp: { A: number; B: number },
    statusMgr: StatusEffectManager,
  ): { hitboxA: number; hitboxB: number } {
    const dt = delta / 1000;
    const pairs = [
      { team: 'A' as const, config: teamA, body: bodyA, enemy: bodyB },
      { team: 'B' as const, config: teamB, body: bodyB, enemy: bodyA },
    ];

    for (const { team, config, body, enemy } of pairs) {
      const ts = this.state[team];
      const anyAim = config.weapon.attacks.some(a => a.aimAtEnemy);
      if (anyAim) {
        ts.orbitAngle = Math.atan2(enemy.position.y - body.position.y, enemy.position.x - body.position.x);
      } else {
        const berserk  = isAbilityBerserk(config.ball.ability, hp[team] / maxHp[team]);
        const speedMult = statusMgr.getSpeedMultiplier(team);
        ts.orbitAngle += ORBIT_DIR[team] * orbitSpeed(config.weapon) * (berserk ? BERSERK_ORBIT_SPEED_MULT : 1) * speedMult * dt;
      }
      ts.rangeMult = this.getRangeMult(team, teamA, teamB, statusMgr);

      // Charge tracking for aimed (laser/cannon) weapons, or orbit-direction projectiles
      const laser = config.weapon.attacks.filter(a => a.aimAtEnemy).sort((a, b) => b.cooldown - a.cooldown)[0];
      if (laser) {
        const idx = config.weapon.attacks.indexOf(laser);
        const cd = Math.max(WEAPON_HIT_COOLDOWN_MIN, laser.cooldown * 1000);
        ts.charge = Math.min(100, ((simTime - ts.lastHitTimes[idx]) / (cd + (laser.hitscan ? HITSCAN_PREFIRE_MS : 0))) * 100);
      } else {
        const orbitProj = config.weapon.attacks.find(a => a.type === 'projectile' && !a.aimAtEnemy);
        if (orbitProj) {
          const idx = config.weapon.attacks.indexOf(orbitProj);
          const cd = Math.max(WEAPON_HIT_COOLDOWN_MIN, orbitProj.cooldown * 1000);
          ts.charge = Math.min(100, ((simTime - ts.lastHitTimes[idx]) / cd) * 100);
        }
      }
    }

    return {
      hitboxA: getWeaponHitboxRadius(teamA.weapon, this.state.A.rangeMult),
      hitboxB: getWeaponHitboxRadius(teamB.weapon, this.state.B.rangeMult),
    };
  }

  processAttacks(
    team: 'A' | 'B',
    simTime: number,
    weapon: WeaponStats,
    attacker: Matter.Body,
    defender: Matter.Body,
    defenderRadius: number,
    hitboxR: number,
    ballRadius: number,
    hpFrac: number,
    effectiveMaxSpeed: number,
    onHit: (weapon: WeaponStats, attack: AttackConfig, attacker: Matter.Body, defender: Matter.Body, team: 'A' | 'B') => void,
    onBulletFire: (weapon: WeaponStats, attack: AttackConfig, hitboxR: number, bulletIdx: number, team: 'A' | 'B') => void,
  ): void {
    if (!shouldWeaponFire(weapon.trigger, attacker, hpFrac, effectiveMaxSpeed)) return;
    const ts = this.state[team];

    for (let i = 0; i < weapon.attacks.length; i++) {
      const attack = weapon.attacks[i];
      const cd = Math.max(WEAPON_HIT_COOLDOWN_MIN, attack.cooldown * 1000);

      if (attack.aimAtEnemy) {
        if (attack.hitscan) {
          if (simTime - ts.lastHitTimes[i] >= cd + HITSCAN_PREFIRE_MS) {
            ts.lastHitTimes[i] = simTime - HITSCAN_PREFIRE_MS;
            onHit(weapon, attack, attacker, defender, team);
          }
        } else if (attack.bulletInterval) {
          if (ts.burstCounts[i] === 0 && simTime - ts.lastHitTimes[i] >= cd) {
            ts.lastHitTimes[i] = simTime;
            ts.burstCounts[i]  = attack.bulletCount ?? 1;
            ts.lastBulletTimes[i] = simTime - cd;
          }
          if (ts.burstCounts[i] > 0 && simTime - ts.lastBulletTimes[i] >= attack.bulletInterval * 1000) {
            ts.lastBulletTimes[i] = simTime;
            const bulletIdx = (attack.bulletCount ?? 1) - ts.burstCounts[i];
            onBulletFire(weapon, attack, hitboxR, bulletIdx, team);
            ts.burstCounts[i]--;
          }
        } else {
          if (simTime - ts.lastHitTimes[i] >= cd) {
            ts.lastHitTimes[i] = simTime;
            const count = attack.bulletCount ?? 1;
            for (let j = 0; j < count; j++) {
              onBulletFire(weapon, attack, hitboxR, j, team);
            }
          }
        }
      } else if (attack.type === 'projectile') {
        // Orbit-direction projectile: fires on cooldown in the weapon's current orbit angle.
        if (simTime - ts.lastHitTimes[i] >= cd) {
          ts.lastHitTimes[i] = simTime;
          const count = attack.bulletCount ?? 1;
          for (let j = 0; j < count; j++) {
            onBulletFire(weapon, attack, hitboxR, j, team);
          }
        }
      } else if (attack.type === 'summon') {
        // Summon fires on pure cooldown — no proximity check needed.
        if (simTime - ts.lastHitTimes[i] >= cd) {
          ts.lastHitTimes[i] = simTime;
          onHit(weapon, attack, attacker, defender, team);
        }
      } else {
        const baseHitboxR = getWeaponHitboxRadius(weapon);
        const pos = getOrbitPosition(attacker.position.x, attacker.position.y, ballRadius, ts.orbitAngle, baseHitboxR);
        const reachR  = hitboxR * (weapon.hitReachMult ?? 1);
        const tipX    = pos.x + Math.cos(ts.orbitAngle) * reachR;
        const tipY    = pos.y + Math.sin(ts.orbitAngle) * reachR;
        const ex      = defender.position.x;
        const ey      = defender.position.y;
        const t       = reachR > 0 ? Math.max(0, Math.min(1,
          ((ex - pos.x) * (tipX - pos.x) + (ey - pos.y) * (tipY - pos.y)) / (reachR * reachR),
        )) : 0;
        const capsuleDist = Math.hypot(ex - (pos.x + t * (tipX - pos.x)),
                                       ey - (pos.y + t * (tipY - pos.y)));
        if (capsuleDist < baseHitboxR * 0.6 + defenderRadius && simTime - ts.lastHitTimes[i] >= cd) {
          ts.lastHitTimes[i] = simTime;
          onHit(weapon, attack, attacker, defender, team);
        }
      }
    }
  }

  spawnBullet(
    team: 'A' | 'B',
    weapon: WeaponStats,
    attack: AttackConfig,
    hitboxR: number,
    bulletIdx: number,
    body: Matter.Body,
    opponent: Matter.Body,
    ballRadius: number,
  ): void {
    const orbitAngle = this.state[team].orbitAngle;
    const start = getOrbitPosition(body.position.x, body.position.y, ballRadius, orbitAngle, hitboxR);
    const dx = opponent.position.x - start.x;
    const dy = opponent.position.y - start.y;
    const dist = Math.hypot(dx, dy);
    const baseAngle = attack.aimAtEnemy
      ? (dist > 0 ? Math.atan2(dy, dx) : orbitAngle)
      : orbitAngle;
    const speed = (attack.bulletSpeed ?? 2.0) * (2 / 3);
    const count = attack.bulletCount ?? 1;
    const spread = attack.bulletSpread ?? 0.40;
    const halfSpread = ((count - 1) * spread) / 2;
    const shotAngle = baseAngle - halfSpread + bulletIdx * spread;

    this.bullets.push({
      x: start.x,
      y: start.y,
      vx: Math.cos(shotAngle) * speed,
      vy: Math.sin(shotAngle) * speed,
      owner: team,
      radius: 5,
      color: weapon.color ?? '#4488CC',
      ttl: attack.bulletTtl ?? 2000,
      attack,
      spriteKey: weapon.projectileIcon,
      bouncesLeft: attack.maxBounces,
    });
  }

  updateBullets(
    scaledDelta: number,
    hp: { A: number; B: number },
    teamA: TeamConfig,
    teamB: TeamConfig,
    bodyA: Matter.Body,
    bodyB: Matter.Body,
    onHit: (weapon: WeaponStats, attack: AttackConfig, attacker: Matter.Body, defender: Matter.Body, team: 'A' | 'B') => void,
    onBulletRemove?: (b: Bullet) => void,
    onBulletParry?: (b: Bullet, px: number, py: number, parryingTeam: 'A' | 'B') => void,
  ): void {
    const teams = {
      A: { body: bodyA, enemyBody: bodyB, enemyBall: teamB.ball, weapon: teamA.weapon, enemyWeapon: teamB.weapon },
      B: { body: bodyB, enemyBody: bodyA, enemyBall: teamA.ball, weapon: teamB.weapon, enemyWeapon: teamA.weapon },
    };
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x  += b.vx * scaledDelta;
      b.y  += b.vy * scaledDelta;
      b.ttl -= scaledDelta;
      if (b.ttl <= 0) { onBulletRemove?.(b); this.bullets.splice(i, 1); continue; }

      if (b.bouncesLeft !== undefined) {
        // Wall reflections never consume bouncesLeft — only enemy contacts do.
        // TTL governs how long the shuriken flies; bouncesLeft tracks enemy hits.
        const minB = WALL_THICKNESS + b.radius;
        const maxB = ARENA_SIZE - WALL_THICKNESS - b.radius;
        if (b.x < minB) { b.x = minB; b.vx = Math.abs(b.vx); }
        else if (b.x > maxB) { b.x = maxB; b.vx = -Math.abs(b.vx); }
        if (b.y < minB) { b.y = minB; b.vy = Math.abs(b.vy); }
        else if (b.y > maxB) { b.y = maxB; b.vy = -Math.abs(b.vy); }
      }

      const { body, enemyBody, enemyBall, weapon, enemyWeapon } = teams[b.owner];
      const enemyTeam: 'A' | 'B' = b.owner === 'A' ? 'B' : 'A';

      // ── Weapon parry check (bouncing bullets only) ─────────────────────────
      if (b.bouncesLeft !== undefined && b.bouncesLeft > 0 && hp.A > 0 && hp.B > 0) {
        const eOrbit  = this.state[enemyTeam].orbitAngle;
        const eHitboxR = getWeaponHitboxRadius(enemyWeapon);
        const wCenter = getOrbitPosition(
          enemyBody.position.x, enemyBody.position.y,
          enemyBall.radius, eOrbit, eHitboxR,
        );
        const wpDx   = wCenter.x - b.x;
        const wpDy   = wCenter.y - b.y;
        const wpDist = Math.hypot(wpDx, wpDy);
        // Only parry if bullet is approaching the weapon (dot product > 0)
        const approaching = b.vx * wpDx + b.vy * wpDy > 0;
        if (approaching && wpDist < eHitboxR * 0.6 + b.radius) {
          // Reflect off weapon face (radial normal from ball to weapon tip)
          const nx = Math.cos(eOrbit);
          const ny = Math.sin(eOrbit);
          const dot = b.vx * nx + b.vy * ny;
          b.vx -= 2 * dot * nx;
          b.vy -= 2 * dot * ny;
          // Add weapon-spin kick: tangential velocity of the orbiting weapon
          const spinDir = ORBIT_DIR[enemyTeam];
          const tx = -Math.sin(eOrbit) * spinDir;
          const ty =  Math.cos(eOrbit) * spinDir;
          const bSpeed = Math.hypot(b.vx, b.vy);
          b.vx += tx * bSpeed * 0.45;
          b.vy += ty * bSpeed * 0.45;
          // Re-normalise to keep bullet speed consistent
          const newSpeed = Math.hypot(b.vx, b.vy);
          if (newSpeed > 0.01) { b.vx = (b.vx / newSpeed) * bSpeed; b.vy = (b.vy / newSpeed) * bSpeed; }
          // Push bullet outside weapon zone (fall back to orbit direction if bullet is at dead-center)
          const safe  = eHitboxR * 0.6 + b.radius + 3;
          const pushNx = wpDist > 0.01 ? wpDx / wpDist : Math.cos(eOrbit);
          const pushNy = wpDist > 0.01 ? wpDy / wpDist : Math.sin(eOrbit);
          b.x = wCenter.x - pushNx * safe;
          b.y = wCenter.y - pushNy * safe;
          // Count as a bounce
          if (--b.bouncesLeft <= 0) { onBulletRemove?.(b); this.bullets.splice(i, 1); continue; }
          onBulletParry?.(b, wCenter.x, wCenter.y, enemyTeam);
          continue;
        }
      }

      // ── Enemy ball hit check ────────────────────────────────────────────────
      const eDx = enemyBody.position.x - b.x;
      const eDy = enemyBody.position.y - b.y;
      const dist = Math.hypot(eDx, eDy);
      if (dist < enemyBall.radius + b.radius && hp.A > 0 && hp.B > 0) {
        onHit(weapon, b.attack, body, enemyBody, b.owner);

        if (b.bouncesLeft !== undefined && b.bouncesLeft > 0) {
          // Bounce off enemy ball — reflect velocity, push outside enemy radius
          const nx = dist > 0 ? eDx / dist : 1;
          const ny = dist > 0 ? eDy / dist : 0;
          const dot = b.vx * nx + b.vy * ny;
          b.vx -= 2 * dot * nx;
          b.vy -= 2 * dot * ny;
          const clearance = enemyBall.radius + b.radius + 3;
          b.x = enemyBody.position.x - nx * clearance;
          b.y = enemyBody.position.y - ny * clearance;
          if (--b.bouncesLeft <= 0) { onBulletRemove?.(b); this.bullets.splice(i, 1); }
        } else {
          onBulletRemove?.(b);
          this.bullets.splice(i, 1);
        }
      }
    }
  }
}
