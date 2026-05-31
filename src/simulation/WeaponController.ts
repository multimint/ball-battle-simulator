import Matter from 'matter-js';
import type { TeamConfig, WeaponStats, AttackConfig } from '../models/types';
import type { Bullet } from '../models/GameState';
import type { StatusEffectManager } from './StatusEffectManager';
import { getWeaponHitboxRadius, getOrbitPosition } from '../rendering/drawOrbitWeapon';
import { WEAPON_HIT_COOLDOWN_MIN, WEAPON_ORBIT_SPEED_SCALE } from '../constants/gameConstants';
import { isAbilityBerserk } from '../utils/ability';

const HITSCAN_PREFIRE_MS = 150;
const BERSERK_ORBIT_SPEED_MULT = 2.5;

const { Body } = Matter;

function orbitSpeed(weapon: WeaponStats): number {
  return Math.max(1.8, weapon.speed) * WEAPON_ORBIT_SPEED_SCALE;
}

export class WeaponController {
  orbitAngleA = Math.PI * 0.25;
  orbitAngleB = Math.PI * 1.25;

  private lastHitTimesA: number[];
  private lastHitTimesB: number[];
  private burstCountsA: number[];
  private burstCountsB: number[];
  private lastBulletTimesA: number[];
  private lastBulletTimesB: number[];

  bullets: Bullet[] = [];
  chargeA = 0;
  chargeB = 0;
  rangeMultA = 1;
  rangeMultB = 1;

  constructor(teamA: TeamConfig, teamB: TeamConfig) {
    const nA = teamA.weapon.attacks.length;
    const nB = teamB.weapon.attacks.length;
    this.lastHitTimesA    = new Array(nA).fill(0);
    this.lastHitTimesB    = new Array(nB).fill(0);
    this.burstCountsA     = new Array(nA).fill(0);
    this.burstCountsB     = new Array(nB).fill(0);
    this.lastBulletTimesA = new Array(nA).fill(0);
    this.lastBulletTimesB = new Array(nB).fill(0);
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

    const anyAimA = teamA.weapon.attacks.some(a => a.aimAtEnemy);
    const anyAimB = teamB.weapon.attacks.some(a => a.aimAtEnemy);

    const berserkA = isAbilityBerserk(teamA.ball.ability, hp.A / maxHp.A);
    const berserkB = isAbilityBerserk(teamB.ball.ability, hp.B / maxHp.B);
    const speedMultA = statusMgr.getSpeedMultiplier('A');
    const speedMultB = statusMgr.getSpeedMultiplier('B');

    if (anyAimA) {
      this.orbitAngleA = Math.atan2(bodyB.position.y - bodyA.position.y, bodyB.position.x - bodyA.position.x);
    } else {
      this.orbitAngleA += orbitSpeed(teamA.weapon) * (berserkA ? BERSERK_ORBIT_SPEED_MULT : 1) * speedMultA * dt;
    }
    if (anyAimB) {
      this.orbitAngleB = Math.atan2(bodyA.position.y - bodyB.position.y, bodyA.position.x - bodyB.position.x);
    } else {
      this.orbitAngleB -= orbitSpeed(teamB.weapon) * (berserkB ? BERSERK_ORBIT_SPEED_MULT : 1) * speedMultB * dt;
    }

    this.rangeMultA = this.getRangeMult('A', teamA, teamB, statusMgr);
    this.rangeMultB = this.getRangeMult('B', teamA, teamB, statusMgr);
    const hitboxA = getWeaponHitboxRadius(teamA.weapon, this.rangeMultA);
    const hitboxB = getWeaponHitboxRadius(teamB.weapon, this.rangeMultB);

    const laserA = teamA.weapon.attacks.filter(a => a.aimAtEnemy).sort((a, b) => b.cooldown - a.cooldown)[0];
    if (laserA) {
      const idx = teamA.weapon.attacks.indexOf(laserA);
      const cd = Math.max(WEAPON_HIT_COOLDOWN_MIN, laserA.cooldown * 1000);
      const effectiveCd = cd + (laserA.hitscan ? HITSCAN_PREFIRE_MS : 0);
      this.chargeA = Math.min(100, ((simTime - this.lastHitTimesA[idx]) / effectiveCd) * 100);
    }
    const laserB = teamB.weapon.attacks.filter(a => a.aimAtEnemy).sort((a, b) => b.cooldown - a.cooldown)[0];
    if (laserB) {
      const idx = teamB.weapon.attacks.indexOf(laserB);
      const cd = Math.max(WEAPON_HIT_COOLDOWN_MIN, laserB.cooldown * 1000);
      const effectiveCd = cd + (laserB.hitscan ? HITSCAN_PREFIRE_MS : 0);
      this.chargeB = Math.min(100, ((simTime - this.lastHitTimesB[idx]) / effectiveCd) * 100);
    }

    return { hitboxA, hitboxB };
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
    onHit: (weapon: WeaponStats, attack: AttackConfig, attacker: Matter.Body, defender: Matter.Body, team: 'A' | 'B') => void,
    onBulletFire: (weapon: WeaponStats, attack: AttackConfig, hitboxR: number, bulletIdx: number, team: 'A' | 'B') => void,
  ): void {
    const hitTimes    = team === 'A' ? this.lastHitTimesA    : this.lastHitTimesB;
    const burstCounts = team === 'A' ? this.burstCountsA     : this.burstCountsB;
    const bulletTimes = team === 'A' ? this.lastBulletTimesA : this.lastBulletTimesB;
    const orbitAngle  = team === 'A' ? this.orbitAngleA      : this.orbitAngleB;

    for (let i = 0; i < weapon.attacks.length; i++) {
      const attack = weapon.attacks[i];
      const cd = Math.max(WEAPON_HIT_COOLDOWN_MIN, attack.cooldown * 1000);

      if (attack.aimAtEnemy) {
        if (attack.hitscan) {
          if (simTime - hitTimes[i] >= cd + HITSCAN_PREFIRE_MS) {
            hitTimes[i] = simTime - HITSCAN_PREFIRE_MS;
            onHit(weapon, attack, attacker, defender, team);
          }
        } else if (attack.bulletInterval) {
          if (burstCounts[i] === 0 && simTime - hitTimes[i] >= cd) {
            hitTimes[i] = simTime;
            burstCounts[i] = attack.bulletCount ?? 1;
            bulletTimes[i] = simTime - cd;
          }
          if (burstCounts[i] > 0 && simTime - bulletTimes[i] >= attack.bulletInterval * 1000) {
            bulletTimes[i] = simTime;
            const bulletIdx = (attack.bulletCount ?? 1) - burstCounts[i];
            onBulletFire(weapon, attack, hitboxR, bulletIdx, team);
            burstCounts[i]--;
          }
        } else {
          if (simTime - hitTimes[i] >= cd) {
            hitTimes[i] = simTime;
            const count = attack.bulletCount ?? 1;
            for (let j = 0; j < count; j++) {
              onBulletFire(weapon, attack, hitboxR, j, team);
            }
          }
        }
      } else {
        const baseHitboxR = getWeaponHitboxRadius(weapon);
        const pos = getOrbitPosition(attacker.position.x, attacker.position.y, ballRadius, orbitAngle, baseHitboxR);
        const reachR  = hitboxR * (weapon.hitReachMult ?? 1);
        const tipX    = pos.x + Math.cos(orbitAngle) * reachR;
        const tipY    = pos.y + Math.sin(orbitAngle) * reachR;
        const ex      = defender.position.x;
        const ey      = defender.position.y;
        const t       = reachR > 0 ? Math.max(0, Math.min(1,
          ((ex - pos.x) * (tipX - pos.x) + (ey - pos.y) * (tipY - pos.y)) / (reachR * reachR),
        )) : 0;
        const capsuleDist = Math.hypot(ex - (pos.x + t * (tipX - pos.x)),
                                       ey - (pos.y + t * (tipY - pos.y)));
        const capsuleR = baseHitboxR * 0.6;
        if (capsuleDist < capsuleR + defenderRadius && simTime - hitTimes[i] >= cd) {
          hitTimes[i] = simTime;
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
    const orbitAngle = team === 'A' ? this.orbitAngleA : this.orbitAngleB;
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
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx * scaledDelta;
      b.y += b.vy * scaledDelta;
      b.ttl -= scaledDelta;
      if (b.ttl <= 0) { this.bullets.splice(i, 1); continue; }

      const attacker  = b.owner === 'A' ? bodyA : bodyB;
      const enemy     = b.owner === 'A' ? bodyB : bodyA;
      const enemyBall = b.owner === 'A' ? teamB.ball : teamA.ball;
      const dist = Math.hypot(enemy.position.x - b.x, enemy.position.y - b.y);
      if (dist < enemyBall.radius + b.radius && hp.A > 0 && hp.B > 0) {
        const weapon = b.owner === 'A' ? teamA.weapon : teamB.weapon;
        onHit(weapon, b.attack, attacker, enemy, b.owner);
        this.bullets.splice(i, 1);
      }
    }
  }
}
