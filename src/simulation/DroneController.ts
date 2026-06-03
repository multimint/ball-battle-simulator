import Matter from 'matter-js';
import type { TeamConfig, BallAbilityType, OnTimerParams, UnitState, StatusEffectType } from '../models/types';
import type { SpriteKey } from '../sprites/SpriteKey';
import type { StatusEffectManager } from './StatusEffectManager';
import type { ParticleController } from './ParticleController';
import type { EffectsController } from './EffectsController';
import type { AudioEmitter } from './AudioEmitter';
import type { WeaponController } from './WeaponController';
import { applyAbility } from './AbilityHandler';
import { getWeaponHitboxRadius, getOrbitPosition } from '../rendering/drawOrbitWeapon';
import {
  ARENA_SIZE,
  DRONE_CATEGORY,
  BALL_CATEGORY,
} from '../constants/gameConstants';
import type { GameEventType } from '../utils/funScore';

const { Bodies, Composite, Body } = Matter;

// ── Spawned unit ──────────────────────────────────────────────────────────────

/** Status effect a drone applies on contact. */
export interface DroneStatusConfig {
  type: StatusEffectType;
  durationMs: number;
  magnitude: number;
  color: string;
  icon?: SpriteKey;
}

/** Config for the charged state — only present on units that support it. */
export interface ChargedConfig {
  color: string;
  speed: number;
  damage: number;
  status?: DroneStatusConfig;
}

export interface DroneBody {
  body: Matter.Body;
  team: 'A' | 'B';
  hp: number;
  maxHp: number;
  state: UnitState;
  color: string;
  radius: number;
  contactDamage: number;
  contactCooldownMs: number;
  lastContactHitTime: number;
  lastWeaponHitTime: number;
  /** Status effect applied on normal-state contact hit. */
  contactStatus?: DroneStatusConfig;
  /** Undefined = this unit has no charged state and cannot be launched. */
  charged?: ChargedConfig;
}

// ── Dependencies ──────────────────────────────────────────────────────────────

export interface DroneControllerDeps {
  teamA: TeamConfig;
  teamB: TeamConfig;
  bodyA: Matter.Body;
  bodyB: Matter.Body;
  engine: Matter.Engine;
  hp: { A: number; B: number };
  maxHp: { A: number; B: number };
  damageDealt: { A: number; B: number };
  effects: EffectsController;
  particles: ParticleController;
  audio: AudioEmitter;
  statusMgr: StatusEffectManager;
  weapons: WeaponController;
  recordGameEvent: (type: GameEventType, team: 'A' | 'B') => void;
  recordAbilityProc: (team: 'A' | 'B', trigger: BallAbilityType) => void;
  /** Called when an onTimer ability fires so AbilityAnimationController can pick it up. */
  onAnimationTrigger?: (team: 'A' | 'B', params: OnTimerParams) => void;
}

// ── Controller ────────────────────────────────────────────────────────────────

export class DroneController {
  readonly drones: DroneBody[] = [];
  private abilityTimers: { A: number; B: number } = { A: 0, B: 0 };

  private readonly d: DroneControllerDeps;

  constructor(deps: DroneControllerDeps) {
    this.d = deps;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  getAbilityTimerFrac(team: 'A' | 'B'): number {
    const ability = (team === 'A' ? this.d.teamA : this.d.teamB).ball.ability;
    if (ability?.trigger !== 'onTimer') return 0;
    const intervalMs = (ability.params as OnTimerParams).intervalMs;
    return intervalMs > 0 ? Math.min(1, this.abilityTimers[team] / intervalMs) : 0;
  }

  /** Spawns a unit for the given team at `ownerBody`'s weapon-tip position. */
  spawnUnit(team: 'A' | 'B', ownerBody: Matter.Body, simTime: number): void {
    const config = team === 'A' ? this.d.teamA : this.d.teamB;
    const attack = config.weapon.attacks.find((a) => a.type === 'summon');
    if (!attack) return;

    const maxCount = attack.summonMaxCount ?? 3;
    let teamCount = 0;
    for (const d of this.drones) if (d.team === team) teamCount++;
    if (teamCount >= maxCount) return;

    const orbitAngle = team === 'A'
      ? this.d.weapons.orbitAngleA
      : this.d.weapons.orbitAngleB;
    const hitboxR = getWeaponHitboxRadius(config.weapon);
    const tip = getOrbitPosition(
      ownerBody.position.x, ownerBody.position.y,
      config.ball.radius, orbitAngle, hitboxR,
    );

    const droneRadius       = attack.summonRadius ?? 10;
    const droneHp           = attack.summonHp ?? 30;
    const droneSpeed        = attack.summonSpeed ?? 3.5;
    const normalColor       = attack.summonNormalColor ?? '#3FB68B';
    const contactDamage     = attack.summonContactDamage ?? 4;
    const contactCooldownMs = attack.summonContactCooldownMs ?? 600;
    const contactStatus: DroneStatusConfig | undefined = attack.summonContactStatusEffect
      ? {
          type:      attack.summonContactStatusEffect,
          durationMs: attack.summonContactStatusDuration  ?? 2000,
          magnitude:  attack.summonContactStatusMagnitude ?? 0.3,
          color:      attack.summonContactStatusColor     ?? '#88CCFF',
          icon:       attack.summonContactStatusIcon,
        }
      : undefined;

    // Only give the unit a charged state if the attack config opts into it.
    const hasChargedCfg =
      attack.summonChargedColor !== undefined ||
      attack.summonChargedSpeed !== undefined ||
      attack.summonChargedDamage !== undefined;
    const chargedStatus: DroneStatusConfig | undefined = attack.summonChargedStatusEffect
      ? {
          type:      attack.summonChargedStatusEffect,
          durationMs: attack.summonChargedStatusDuration  ?? 2000,
          magnitude:  attack.summonChargedStatusMagnitude ?? 0.3,
          color:      attack.summonChargedStatusColor     ?? '#88CCFF',
          icon:       attack.summonChargedStatusIcon,
        }
      : undefined;
    const charged: ChargedConfig | undefined = hasChargedCfg
      ? {
          color:  attack.summonChargedColor  ?? '#D4FF88',
          speed:  attack.summonChargedSpeed  ?? droneSpeed * 4,
          damage: attack.summonChargedDamage ?? 10,
          status: chargedStatus,
        }
      : undefined;

    const body = Bodies.circle(tip.x, tip.y, droneRadius, {
      mass: attack.summonMass ?? 0.8,
      restitution: 1.0,
      friction: 0.05,
      frictionAir: 0,
      label: `drone-${team}`,
      collisionFilter: { category: DRONE_CATEGORY[team], mask: 0xffff },
    });
    Body.setVelocity(body, {
      x: Math.cos(orbitAngle) * droneSpeed,
      y: Math.sin(orbitAngle) * droneSpeed,
    });
    Composite.add(this.d.engine.world, body);
    this.drones.push({
      body, team,
      hp: droneHp, maxHp: droneHp,
      state: 'normal',
      color: normalColor,
      radius: droneRadius,
      contactDamage, contactCooldownMs, contactStatus,
      lastContactHitTime: -Infinity,
      lastWeaponHitTime: -Infinity,
      charged,
    });

    this.d.particles.spawnBurst(tip.x, tip.y, normalColor, 5);
    this.d.audio.emitAbility(team, config.audioProfile.abilityStyle, 'passive', simTime);
  }

  /** Called from the physics collision event — handles charged and normal unit hits. */
  handleCollision(bodyA: Matter.Body, bodyB: Matter.Body, simTime: number): void {
    if (this.drones.length === 0) return;
    const droneIdx = this.drones.findIndex(
      (d) => d.body.id === bodyA.id || d.body.id === bodyB.id,
    );
    if (droneIdx === -1) return;

    const drone = this.drones[droneIdx];

    if (drone.state === 'charged') {
      // A drone can only enter charged state if it has a ChargedConfig — assert it.
      const cfg = drone.charged!;
      const otherBody = drone.body.id === bodyA.id ? bodyB : bodyA;
      const enemyBody = drone.team === 'A' ? this.d.bodyB : this.d.bodyA;
      const enemyTeam: 'A' | 'B' = drone.team === 'A' ? 'B' : 'A';

      if (otherBody.id === enemyBody.id) {
        const dmg = Math.min(cfg.damage, this.d.hp[enemyTeam]);
        this.d.hp[enemyTeam] = Math.max(0, this.d.hp[enemyTeam] - dmg);
        this.d.damageDealt[drone.team] += dmg;
        if (dmg > 0) {
          this.d.recordGameEvent('hit', drone.team);
          if (cfg.status) {
            this.d.statusMgr.apply({ team: enemyTeam, type: cfg.status.type, durationMs: cfg.status.durationMs, magnitude: cfg.status.magnitude, stackBehavior: 'refresh', maxStacks: 1, color: cfg.status.color, icon: cfg.status.icon ?? 'burst', simTime });
          }
        }
        this.d.particles.spawnBurst(drone.body.position.x, drone.body.position.y, cfg.color, 14);
        this.d.particles.pushFloater(
          String(dmg),
          enemyBody.position.x + (Math.random() - 0.5) * 20,
          enemyBody.position.y - (enemyBody.circleRadius ?? 25) - 8,
          cfg.color,
        );
        this.d.effects.applyHitFlash(enemyTeam, 0.55, cfg.color, 6);
        const hitStyle = (drone.team === 'A' ? this.d.teamA : this.d.teamB).audioProfile.hitStyle;
        this.d.audio.emitHit(hitStyle, Math.min(1, dmg / 30), simTime);
      } else {
        this.d.particles.spawnBurst(drone.body.position.x, drone.body.position.y, '#88BB88', 5);
      }

      Composite.remove(this.d.engine.world, drone.body);
      this.drones.splice(droneIdx, 1);
    } else if (drone.state === 'normal') {
      const otherBody = drone.body.id === bodyA.id ? bodyB : bodyA;
      const enemyBody = drone.team === 'A' ? this.d.bodyB : this.d.bodyA;
      if (otherBody.id === enemyBody.id && simTime - drone.lastContactHitTime > drone.contactCooldownMs) {
        drone.lastContactHitTime = simTime;
        const enemyTeam: 'A' | 'B' = drone.team === 'A' ? 'B' : 'A';
        const dmg = Math.min(drone.contactDamage, this.d.hp[enemyTeam]);
        if (dmg > 0) {
          this.d.hp[enemyTeam] = Math.max(0, this.d.hp[enemyTeam] - dmg);
          this.d.damageDealt[drone.team] += dmg;
          this.d.recordGameEvent('hit', drone.team);
          if (drone.contactStatus) {
            this.d.statusMgr.apply({ team: enemyTeam, type: drone.contactStatus.type, durationMs: drone.contactStatus.durationMs, magnitude: drone.contactStatus.magnitude, stackBehavior: 'refresh', maxStacks: 1, color: drone.contactStatus.color, icon: drone.contactStatus.icon ?? 'dot-green', simTime });
          }
          this.d.particles.pushFloater(
            String(dmg),
            enemyBody.position.x + (Math.random() - 0.5) * 20,
            enemyBody.position.y - (enemyBody.circleRadius ?? 25) - 8,
            '#FFFFFF',
          );
          this.d.particles.spawnBurst(drone.body.position.x, drone.body.position.y, drone.color, 6);
          this.d.effects.applyHitFlash(enemyTeam, 0.35, drone.color, 4);
          const hitStyle = (drone.team === 'A' ? this.d.teamA : this.d.teamB).audioProfile.hitStyle;
          this.d.audio.emitHit(hitStyle, 0.3, simTime);
        }
      }
    }
  }

  /** Main per-tick update — call after Engine.update. */
  tick(scaledDelta: number, simTime: number, matchEnded: boolean): void {
    this.tickOnTimerAbility('A', this.d.teamA, scaledDelta, simTime, matchEnded);
    this.tickOnTimerAbility('B', this.d.teamB, scaledDelta, simTime, matchEnded);
    this.tickDrones(simTime);
    if (this.drones.length > 0) {
      this.processWeaponDroneDamage('A', this.d.weapons.orbitAngleA, this.d.bodyA, this.d.teamA, simTime);
      this.processWeaponDroneDamage('B', this.d.weapons.orbitAngleB, this.d.bodyB, this.d.teamB, simTime);
      this.processBulletDroneDamage();
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private tickOnTimerAbility(
    team: 'A' | 'B',
    config: TeamConfig,
    scaledDelta: number,
    simTime: number,
    matchEnded: boolean,
  ): void {
    if (matchEnded) return;
    const ability = config.ball.ability;
    if (ability?.trigger !== 'onTimer') return;
    this.abilityTimers[team] += scaledDelta;
    const intervalMs = (ability.params as OnTimerParams).intervalMs;
    if (this.abilityTimers[team] >= intervalMs) {
      this.abilityTimers[team] -= intervalMs;
      const body = team === 'A' ? this.d.bodyA : this.d.bodyB;
      applyAbility({
        ability, team, trigger: 'onTimer', body, teamConfig: config,
        statusMgr: this.d.statusMgr,
        particles: this.d.particles,
        effects: this.d.effects,
        audio: this.d.audio,
        simTime,
        recordProc: () => this.d.recordAbilityProc(team, 'onTimer'),
      });
      if (config.weapon.attacks.some((a) => a.type === 'summon')) {
        this.launchCharged(team, simTime);
      }
      this.d.onAnimationTrigger?.(team, ability.params as OnTimerParams);
    }
  }


  private launchCharged(team: 'A' | 'B', _simTime: number): void {
    const enemyBody = team === 'A' ? this.d.bodyB : this.d.bodyA;
    const ownerBody = team === 'A' ? this.d.bodyA : this.d.bodyB;
    const ownerConfig = team === 'A' ? this.d.teamA : this.d.teamB;
    const enemyDroneTeam: 'A' | 'B' = team === 'A' ? 'B' : 'A';

    const newPositions: { x: number; y: number }[] = [];
    let chargedColor = '#D4FF88'; // captured from the first eligible drone

    for (const drone of this.drones) {
      if (drone.team !== team || drone.state === 'charged') continue;
      if (!drone.charged) continue; // unit has no charged state — skip
      chargedColor = drone.charged.color;
      const dx = enemyBody.position.x - drone.body.position.x;
      const dy = enemyBody.position.y - drone.body.position.y;
      const dist = Math.hypot(dx, dy);
      const nx = dist >= 1 ? dx / dist : Math.cos(Math.random() * Math.PI * 2);
      const ny = dist >= 1 ? dy / dist : Math.sin(Math.random() * Math.PI * 2);
      Body.setVelocity(drone.body, { x: nx * drone.charged.speed, y: ny * drone.charged.speed });
      drone.hp = 1;
      drone.state = 'charged';
      drone.body.collisionFilter = {
        category: DRONE_CATEGORY[team],
        mask: 0xffff ^ DRONE_CATEGORY[team] ^ BALL_CATEGORY[team] ^ DRONE_CATEGORY[enemyDroneTeam],
      };
      newPositions.push({ x: drone.body.position.x, y: drone.body.position.y });
    }

    if (newPositions.length === 0) return;

    this.d.effects.pushWeaponEffect('caster-aura', ownerBody.position.x, ownerBody.position.y, 0, chargedColor, 33, { radius: ownerConfig.ball.radius });
    this.d.effects.pushWeaponEffect('shockwave', ownerBody.position.x, ownerBody.position.y, 0, chargedColor, 22, { radius: 120 });
    for (const pos of newPositions) {
      this.d.effects.pushWeaponEffect('shockwave', pos.x, pos.y, 0, '#AAFFCC', 18, { radius: 70 });
      this.d.particles.spawnBurst(pos.x, pos.y, chargedColor, 14);
    }
    this.d.effects.applyScreenFlash(0.5, '#AAFFAA', 12);
    this.d.effects.applyScreenShake(10, 22);
    this.d.effects.applyFreeze(30);
  }

  private tickDrones(_simTime: number): void {
    for (const drone of this.drones) {
      const m = drone.radius;
      const minC = m;
      const maxC = ARENA_SIZE - m;
      const pos = drone.body.position;
      const vel = drone.body.velocity;
      let cx = pos.x, cy = pos.y, vx = vel.x, vy = vel.y;
      if (cx < minC) { cx = minC; vx =  Math.abs(vx); }
      if (cx > maxC) { cx = maxC; vx = -Math.abs(vx); }
      if (cy < minC) { cy = minC; vy =  Math.abs(vy); }
      if (cy > maxC) { cy = maxC; vy = -Math.abs(vy); }
      if (cx !== pos.x || cy !== pos.y) {
        Body.setPosition(drone.body, { x: cx, y: cy });
        Body.setVelocity(drone.body, { x: vx, y: vy });
      }

      if (drone.state !== 'charged') continue;
      if (Math.random() < 0.75) {
        this.d.particles.pushTrail({
          x: drone.body.position.x,
          y: drone.body.position.y,
          radius: drone.radius * 0.8,
          color: drone.charged!.color,
          alpha: 0.7,
          ttl: 14,
          maxTtl: 14,
        });
      }
    }
  }

  private processWeaponDroneDamage(
    attackerTeam: 'A' | 'B',
    orbitAngle: number,
    attackerBody: Matter.Body,
    attackerConfig: TeamConfig,
    simTime: number,
  ): void {
    const defenderTeam: 'A' | 'B' = attackerTeam === 'A' ? 'B' : 'A';
    const weapon = attackerConfig.weapon;
    const baseHitR = getWeaponHitboxRadius(weapon);
    const tip = getOrbitPosition(
      attackerBody.position.x, attackerBody.position.y,
      attackerConfig.ball.radius, orbitAngle, baseHitR,
    );
    const dmgBase = weapon.attacks.find((a) => a.type !== 'summon')?.damage ?? weapon.attacks[0].damage;
    const dmgAmt = Math.max(2, dmgBase);

    for (let i = this.drones.length - 1; i >= 0; i--) {
      const drone = this.drones[i];
      if (drone.team !== defenderTeam) continue;
      if (simTime - drone.lastWeaponHitTime < 500) continue;

      const dist = Math.hypot(tip.x - drone.body.position.x, tip.y - drone.body.position.y);
      if (dist >= baseHitR + drone.radius) continue;

      drone.lastWeaponHitTime = simTime;
      drone.hp = Math.max(0, drone.hp - dmgAmt);
      this.d.particles.pushFloater(String(dmgAmt), drone.body.position.x, drone.body.position.y - drone.radius - 6, weapon.color ?? '#FFFFFF');

      if (drone.hp <= 0) {
        this.d.particles.spawnBurst(drone.body.position.x, drone.body.position.y, drone.color, 7);
        Composite.remove(this.d.engine.world, drone.body);
        this.drones.splice(i, 1);
      }
    }
  }

  private processBulletDroneDamage(): void {
    for (let bi = this.d.weapons.bullets.length - 1; bi >= 0; bi--) {
      const bullet = this.d.weapons.bullets[bi];
      const targetTeam: 'A' | 'B' = bullet.owner === 'A' ? 'B' : 'A';
      let bulletConsumed = false;

      for (let di = this.drones.length - 1; di >= 0; di--) {
        const drone = this.drones[di];
        if (drone.team !== targetTeam) continue;

        const dist = Math.hypot(bullet.x - drone.body.position.x, bullet.y - drone.body.position.y);
        if (dist >= drone.radius + bullet.radius) continue;

        const dmg = Math.max(2, bullet.attack.damage);
        drone.hp = Math.max(0, drone.hp - dmg);
        this.d.particles.pushFloater(String(dmg), drone.body.position.x, drone.body.position.y - drone.radius - 6, bullet.color);
        this.d.particles.spawnBurst(drone.body.position.x, drone.body.position.y, drone.color, 4);

        bulletConsumed = true;
        if (drone.hp <= 0) {
          this.d.particles.spawnBurst(drone.body.position.x, drone.body.position.y, drone.color, 8);
          Composite.remove(this.d.engine.world, drone.body);
          this.drones.splice(di, 1);
        }
        break;
      }

      if (bulletConsumed) this.d.weapons.bullets.splice(bi, 1);
    }
  }
}
