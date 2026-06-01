import Matter from 'matter-js';
import type { TeamConfig, WeaponStats, AttackConfig } from '../models/types';
import type { Bullet } from '../models/GameState';
import type { StatusEffectManager } from './StatusEffectManager';
import { getWeaponHitboxRadius, getOrbitPosition } from '../rendering/drawOrbitWeapon';
import {
  WEAPON_HIT_COOLDOWN_MIN, WEAPON_ORBIT_SPEED_SCALE, HITSCAN_PREFIRE_MS, BERSERK_ORBIT_SPEED_MULT,
  WEAPON_SPEED_TRIGGER_FRAC, WEAPON_EDGE_THRESHOLD_PX, LOW_HP_THRESHOLD, ARENA_SIZE,
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
    this.state = {
      A: {
        orbitAngle: Math.PI * 0.25,
        lastHitTimes:    new Array(teamA.weapon.attacks.length).fill(0),
        burstCounts:     new Array(teamA.weapon.attacks.length).fill(0),
        lastBulletTimes: new Array(teamA.weapon.attacks.length).fill(0),
        charge: 0, rangeMult: 1,
      },
      B: {
        orbitAngle: Math.PI * 1.25,
        lastHitTimes:    new Array(teamB.weapon.attacks.length).fill(0),
        burstCounts:     new Array(teamB.weapon.attacks.length).fill(0),
        lastBulletTimes: new Array(teamB.weapon.attacks.length).fill(0),
        charge: 0, rangeMult: 1,
      },
    };
  }

  getRangeMult(team: 'A' | 'B', teamA: TeamConfig, teamB: TeamConfig, statusMgr: StatusEffectManager): number {
    const ability = team === 'A' ? teamA.ball.ability : teamB.ball.ability;
    if (ability?.trigger !== 'onHitDealt') return 1;
    const rangePerStack = ability.params.rangePerStack ?? 0;
    if (rangePerStack === 0) return 1;
    const stacks = statusMgr.getEffects(team).find((e) => e.type === 'speedBoost')?.stacks ?? 0;
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

      // Charge tracking for aimed (laser/cannon) weapons
      const laser = config.weapon.attacks.filter(a => a.aimAtEnemy).sort((a, b) => b.cooldown - a.cooldown)[0];
      if (laser) {
        const idx = config.weapon.attacks.indexOf(laser);
        const cd = Math.max(WEAPON_HIT_COOLDOWN_MIN, laser.cooldown * 1000);
        ts.charge = Math.min(100, ((simTime - ts.lastHitTimes[idx]) / (cd + (laser.hitscan ? HITSCAN_PREFIRE_MS : 0))) * 100);
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
    const baseAngle = dist > 0 ? Math.atan2(dy, dx) : 0;
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
      ttl: 2000,
      attack,
      spriteKey: weapon.projectileIcon,
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
  ): void {
    const teams = { A: { body: bodyA, enemyBody: bodyB, enemyBall: teamB.ball, weapon: teamA.weapon },
                    B: { body: bodyB, enemyBody: bodyA, enemyBall: teamA.ball, weapon: teamB.weapon } };
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x  += b.vx * scaledDelta;
      b.y  += b.vy * scaledDelta;
      b.ttl -= scaledDelta;
      if (b.ttl <= 0) { this.bullets.splice(i, 1); continue; }
      const { body, enemyBody, enemyBall, weapon } = teams[b.owner];
      const dist = Math.hypot(enemyBody.position.x - b.x, enemyBody.position.y - b.y);
      if (dist < enemyBall.radius + b.radius && hp.A > 0 && hp.B > 0) {
        onHit(weapon, b.attack, body, enemyBody, b.owner);
        this.bullets.splice(i, 1);
      }
    }
  }
}
