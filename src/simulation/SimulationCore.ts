import Matter from 'matter-js';
import type {
  TeamConfig,
  WeaponStats,
  AttackConfig,
  WinnerType,
  BallAbility,
  BallAbilityType,
} from '../models/types';
import { DroneController } from './DroneController';
export type { DroneBody } from './DroneController';
import { StatusEffectManager } from './StatusEffectManager';
import { isAbilityBerserk } from '../utils/ability';
import { getCollisionImpulse, getCollisionPoint } from '../utils/collision';
import {
  clampVelocity,
  nudgeBody,
  bodyOptionsFromBall,
} from '../utils/physics';
import {
  getWeaponHitboxRadius,
  getOrbitPosition,
} from '../rendering/drawOrbitWeapon';
import { EffectsController } from './EffectsController';
import { ParticleController } from './ParticleController';
import { AudioEmitter } from './AudioEmitter';
import { WeaponController } from './WeaponController';
import { processHit } from './HitProcessor';
import { applyAbility } from './AbilityHandler';
import {
  ARENA_SIZE,
  VELOCITY_CLAMP,
  PHYSICS_SPEED_SCALE,
  INITIAL_SPEED_MIN_FRAC,
  SCREEN_SHAKE_MAGNITUDE,
  SCREEN_SHAKE_TTL,
  STUCK_FRAMES,
  STUCK_MOVEMENT_THRESHOLD,
  HEAVY_HIT_THRESHOLD,
  WALL_THICKNESS,
  BALL_A_START,
  BALL_B_START,
  BERSERK_HOMING_BLEND,
  BERSERK_TRAIL_SPAWN_CHANCE,
  BERSERK_SPIN_MULT,
  BERSERK_TRAIL_COLOR,
  SOFT_ATTRACT_THRESHOLD_PX,
  SOFT_ATTRACT_FORCE_COEFF,
  BALL_CATEGORY,
} from '../constants/gameConstants';
import type { InitialVelocities } from '../store/useGameStore';
import type { ApplyEffectOptions } from './StatusEffectManager';
import { HP_SNAPSHOT_INTERVAL_MS } from '../utils/funScore';
import type { GameEvent, GameEventType } from '../utils/funScore';

const { Engine, Bodies, Composite, Body, Events } = Matter;

// ── Internal helpers ──────────────────────────────────────────────────────────

interface StuckState {
  lastX: number;
  lastY: number;
  stuckFrames: number;
}

interface TeamTickState {
  id: 'A' | 'B';
  config: TeamConfig;
  body: Matter.Body;
  stuck: StuckState;
}

function enforceMinSpeed(body: Matter.Body, maxSpeed: number): void {
  const minSpeed =
    maxSpeed * PHYSICS_SPEED_SCALE * INITIAL_SPEED_MIN_FRAC * 0.6;
  const vx = body.velocity.x;
  const vy = body.velocity.y;
  const speed = Math.hypot(vx, vy);
  if (speed < minSpeed) {
    const mag = speed > 0.01 ? speed : 1;
    const nx = speed > 0.01 ? vx / mag : Math.cos(Math.random() * Math.PI * 2);
    const ny = speed > 0.01 ? vy / mag : Math.sin(Math.random() * Math.PI * 2);
    Body.setVelocity(body, { x: nx * minSpeed, y: ny * minSpeed });
  }
}

export abstract class SimulationCore {
  protected engine: Matter.Engine;
  protected bodyA: Matter.Body;
  protected bodyB: Matter.Body;

  protected hp: { A: number; B: number };
  protected maxHp: { A: number; B: number };
  protected damageDealt: { A: number; B: number } = { A: 0, B: 0 };
  protected turns = 0;
  protected simTime = 0;
  protected winner: WinnerType = null;
  protected matchEnded = false;

  protected stuckA: StuckState = { lastX: 0, lastY: 0, stuckFrames: 0 };
  protected stuckB: StuckState = { lastX: 0, lastY: 0, stuckFrames: 0 };

  protected statusMgr = new StatusEffectManager();
  protected teamA: TeamConfig;
  protected teamB: TeamConfig;

  protected effects: EffectsController;
  protected particles: ParticleController;
  protected audio: AudioEmitter;
  protected weapons: WeaponController;
  private boundApplyHit!: (
    weapon: WeaponStats,
    attack: AttackConfig,
    attacker: Matter.Body,
    defender: Matter.Body,
    attackerTeam: 'A' | 'B',
  ) => void;
  protected hpSnapshots: { hpA: number; hpB: number }[] = [];
  private nextSnapshotMs = HP_SNAPSHOT_INTERVAL_MS;

  /** Single source of truth for discrete gameplay actions (see funScore). */
  protected gameEvents: GameEvent[] = [];
  private onLowHPProcRecorded = { A: false, B: false };

  // ── Drone controller ─────────────────────────────────────────────────────────
  protected droneCtrl!: DroneController;

  protected get drones() { return this.droneCtrl.drones; }
  protected getAbilityTimerFrac(team: 'A' | 'B'): number {
    return this.droneCtrl.getAbilityTimerFrac(team);
  }

  protected recordGameEvent(type: GameEventType, team: 'A' | 'B'): void {
    this.gameEvents.push({ timeMs: this.simTime, type, team });
  }

  protected recordAbilityProc = (
    team: 'A' | 'B',
    trigger: BallAbilityType,
  ): void => {
    // onLowHP fires every tick while berserk — deduplicate to one event per fight.
    // onTimer fires once per interval and is intentionally recorded each time (periodic events
    // all count for the momentum fun-score component).
    if (trigger === 'onLowHP') {
      if (this.onLowHPProcRecorded[team]) return;
      this.onLowHPProcRecorded[team] = true;
    }
    this.recordGameEvent('ability', team);
  };

  constructor(
    teamA: TeamConfig,
    teamB: TeamConfig,
    initialVelocities: InitialVelocities,
  ) {
    this.teamA = teamA;
    this.teamB = teamB;
    this.hp = { A: teamA.ball.durability, B: teamB.ball.durability };
    this.maxHp = { A: teamA.ball.durability, B: teamB.ball.durability };

    this.engine = Engine.create({ gravity: { x: 0, y: 0 } });

    const wallOpts: Matter.IBodyDefinition = {
      isStatic: true,
      restitution: 1.0,
      friction: 0,
      frictionStatic: 0,
      label: 'wall',
    };
    const half = WALL_THICKNESS / 2;
    const walls = [
      Bodies.rectangle(
        ARENA_SIZE / 2,
        -half,
        ARENA_SIZE + WALL_THICKNESS * 2,
        WALL_THICKNESS,
        wallOpts,
      ),
      Bodies.rectangle(
        ARENA_SIZE / 2,
        ARENA_SIZE + half,
        ARENA_SIZE + WALL_THICKNESS * 2,
        WALL_THICKNESS,
        wallOpts,
      ),
      Bodies.rectangle(
        -half,
        ARENA_SIZE / 2,
        WALL_THICKNESS,
        ARENA_SIZE + WALL_THICKNESS * 2,
        wallOpts,
      ),
      Bodies.rectangle(
        ARENA_SIZE + half,
        ARENA_SIZE / 2,
        WALL_THICKNESS,
        ARENA_SIZE + WALL_THICKNESS * 2,
        wallOpts,
      ),
    ];

    this.bodyA = Bodies.circle(
      BALL_A_START.x,
      BALL_A_START.y,
      teamA.ball.radius,
      {
        ...bodyOptionsFromBall(teamA.ball),
        label: 'ballA',
        collisionFilter: { category: BALL_CATEGORY.A, mask: 0xffff },
      },
    );
    this.bodyB = Bodies.circle(
      BALL_B_START.x,
      BALL_B_START.y,
      teamB.ball.radius,
      {
        ...bodyOptionsFromBall(teamB.ball),
        label: 'ballB',
        collisionFilter: { category: BALL_CATEGORY.B, mask: 0xffff },
      },
    );

    Composite.add(this.engine.world, [...walls, this.bodyA, this.bodyB]);
    Body.setVelocity(this.bodyA, initialVelocities.velA);
    Body.setVelocity(this.bodyB, initialVelocities.velB);

    this.effects = new EffectsController();
    this.particles = new ParticleController();
    this.audio = new AudioEmitter();
    this.weapons = new WeaponController(teamA, teamB);
    this.boundApplyHit = this.applyHit.bind(this);
    this.droneCtrl = new DroneController({
      teamA, teamB,
      bodyA: this.bodyA, bodyB: this.bodyB,
      engine: this.engine,
      hp: this.hp, maxHp: this.maxHp, damageDealt: this.damageDealt,
      effects: this.effects, particles: this.particles, audio: this.audio,
      statusMgr: this.statusMgr, weapons: this.weapons,
      recordGameEvent: (type, team) => this.recordGameEvent(type, team),
      recordAbilityProc: this.recordAbilityProc,
    });
  }

  applyStatusEffect(opts: Omit<ApplyEffectOptions, 'simTime'>): void {
    this.statusMgr.apply({ ...opts, simTime: this.simTime });
  }

  protected onCollision(event: Matter.IEventCollision<Matter.Engine>): void {
    const isWall = (b: Matter.Body) => b.label === 'wall';
    const isBallA = (b: Matter.Body) => b.id === this.bodyA.id;
    const isBallB = (b: Matter.Body) => b.id === this.bodyB.id;

    for (const pair of event.pairs) {
      const { bodyA, bodyB } = pair;

      if ([bodyA, bodyB].some(isBallA) && [bodyA, bodyB].some(isBallB)) {
        const impulse = getCollisionImpulse(pair);
        const point = getCollisionPoint(pair);
        if (impulse > HEAVY_HIT_THRESHOLD) {
          this.effects.applySlowMotion();
          this.effects.applyScreenShake(
            SCREEN_SHAKE_MAGNITUDE,
            SCREEN_SHAKE_TTL,
          );
        }
        this.particles.spawnBurst(point.x, point.y, this.teamA.ball.color, 8);
        this.turns++;
        this.audio.emitBallBounce(
          this.teamA.audioProfile.hitStyle,
          this.simTime,
        );
      } else if (
        (isWall(bodyA) && isBallA(bodyB)) ||
        (isWall(bodyB) && isBallA(bodyA))
      ) {
        this.audio.emitWallBounce(
          this.teamA.audioProfile.hitStyle,
          this.simTime,
        );
      } else if (
        (isWall(bodyA) && isBallB(bodyB)) ||
        (isWall(bodyB) && isBallB(bodyA))
      ) {
        this.audio.emitWallBounce(
          this.teamB.audioProfile.hitStyle,
          this.simTime,
        );
      }

      this.droneCtrl.handleCollision(bodyA, bodyB, this.simTime);
    }
  }

  protected tick(delta: number): void {
    const scaledDelta = delta * this.effects.slowMotion;

    this.effects.step();
    Engine.update(this.engine, scaledDelta);

    const teams: TeamTickState[] = [
      { id: 'A', config: this.teamA, body: this.bodyA, stuck: this.stuckA },
      { id: 'B', config: this.teamB, body: this.bodyB, stuck: this.stuckB },
    ];
    const speedMults = teams.map((t) =>
      this.statusMgr.getSpeedMultiplier(t.id),
    ) as [number, number];

    const berserk = teams.map((t) =>
      isAbilityBerserk(t.config.ball.ability, this.hp[t.id] / this.maxHp[t.id]),
    );
    for (let i = 0; i < 2; i++) {
      const team = teams[i];
      const enemy = teams[1 - i];
      const sMult = speedMults[i];
      clampVelocity(
        team.body,
        team.config.ball.maxSpeed * sMult,
        VELOCITY_CLAMP,
      );
      enforceMinSpeed(team.body, team.config.ball.maxSpeed * sMult);
      this.applyBerserkHoming(
        berserk[i],
        team.body,
        enemy.body,
        team.config.ball.radius,
      );
      const spin = berserk[i] ? BERSERK_SPIN_MULT : 1.0;
      Body.setAngularVelocity(
        team.body,
        team.config.ball.spinSpeed *
          0.05 *
          spin *
          sMult *
          Math.sign(team.body.velocity.x || 1),
      );
      this.updateStuck(team.stuck, team.body);
    }

    this.effects.stepWeaponEffects();
    const { hitboxA, hitboxB } = this.weapons.updateOrbit(
      scaledDelta,
      this.simTime,
      this.teamA,
      this.teamB,
      this.bodyA,
      this.bodyB,
      this.hp,
      this.maxHp,
      this.statusMgr,
    );
    const hitboxes = [hitboxA, hitboxB] as const;

    if (this.hp.A > 0 && this.hp.B > 0) {
      for (let i = 0; i < 2; i++) {
        const team = teams[i];
        const enemy = teams[1 - i];
        this.weapons.processAttacks(
          team.id,
          this.simTime,
          team.config.weapon,
          team.body,
          enemy.body,
          enemy.config.ball.radius,
          hitboxes[i],
          team.config.ball.radius,
          this.hp[team.id] / this.maxHp[team.id],
          team.config.ball.maxSpeed * speedMults[i],
          this.boundApplyHit,
          (w, atk, hr, idx, tid) => {
            this.weapons.spawnBullet(
              tid,
              w,
              atk,
              hr,
              idx,
              team.body,
              enemy.body,
              team.config.ball.radius,
            );
            if (idx === 0) {
              this.audio.emitBulletFire(
                team.config.audioProfile.hitStyle,
                this.simTime,
              );
              this.recordGameEvent('fire', team.id);
            }
          },
        );
      }
    }
    this.weapons.updateBullets(
      scaledDelta,
      this.hp,
      this.teamA,
      this.teamB,
      this.bodyA,
      this.bodyB,
      this.boundApplyHit,
      (b) => {
        if (b.spriteKey === 'proj-shuriken') {
          this.particles.spawnBurst(b.x, b.y, b.color, 14);
        }
      },
      (_b, px, py, _parryingTeam) => {
        this.particles.spawnBurst(px, py, '#FFFFFF', 10);
        this.particles.spawnBurst(px, py, '#5C6BC0', 6);
        this.audio.emitParry(this.simTime);
      },
    );

    this.statusMgr.tick(scaledDelta, this.hp);

    for (const team of teams) {
      this.applyBallAbility(team.config.ball.ability, team.id, 'passive', {
        delta: scaledDelta,
      });
      if (
        isAbilityBerserk(
          team.config.ball.ability,
          this.hp[team.id] / this.maxHp[team.id],
        )
      ) {
        this.applyBallAbility(team.config.ball.ability, team.id, 'onLowHP', {
          delta: scaledDelta,
        });
      }
      this.tickGenericTrail(team);
    }

    this.droneCtrl.tick(scaledDelta, this.simTime, this.matchEnded);

    const adx = this.bodyB.position.x - this.bodyA.position.x;
    const ady = this.bodyB.position.y - this.bodyA.position.y;
    const adist = Math.hypot(adx, ady);
    if (adist > SOFT_ATTRACT_THRESHOLD_PX) {
      const excess = adist - SOFT_ATTRACT_THRESHOLD_PX;
      const fx = (adx / adist) * SOFT_ATTRACT_FORCE_COEFF * excess;
      const fy = (ady / adist) * SOFT_ATTRACT_FORCE_COEFF * excess;
      Body.applyForce(this.bodyA, this.bodyA.position, { x: fx, y: fy });
      Body.applyForce(this.bodyB, this.bodyB.position, { x: -fx, y: -fy });
    }

    this.particles.step();

    const aKO = this.hp.A <= 0;
    const bKO = this.hp.B <= 0;
    if (aKO && bKO) {
      this.matchEnded = true;
      this.winner = 'draw';
    } else if (bKO) {
      this.matchEnded = true;
      this.winner = 'A';
    } else if (aKO) {
      this.matchEnded = true;
      this.winner = 'B';
    }
    if (this.matchEnded && this.audio.koSimTime < 0) {
      this.audio.koSimTime = this.simTime;
    }

    this.simTime += delta;
    while (this.simTime >= this.nextSnapshotMs) {
      this.hpSnapshots.push({ hpA: this.hp.A, hpB: this.hp.B });
      this.nextSnapshotMs += HP_SNAPSHOT_INTERVAL_MS;
    }
  }

  private applyBerserkHoming(
    active: boolean,
    self: Matter.Body,
    enemy: Matter.Body,
    radius: number,
  ): void {
    if (!active) return;
    const dx = enemy.position.x - self.position.x;
    const dy = enemy.position.y - self.position.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) return;
    const nx = dx / dist;
    const ny = dy / dist;
    const speed = Math.hypot(self.velocity.x, self.velocity.y);
    Body.setVelocity(self, {
      x:
        self.velocity.x * (1 - BERSERK_HOMING_BLEND) +
        nx * speed * BERSERK_HOMING_BLEND,
      y:
        self.velocity.y * (1 - BERSERK_HOMING_BLEND) +
        ny * speed * BERSERK_HOMING_BLEND,
    });
    if (Math.random() < BERSERK_TRAIL_SPAWN_CHANCE) {
      this.particles.pushTrail({
        x: self.position.x,
        y: self.position.y,
        radius: radius * 0.55,
        color: BERSERK_TRAIL_COLOR,
        alpha: 0.55,
        ttl: 10,
        maxTtl: 10,
      });
    }
  }

  private updateStuck(state: StuckState, body: Matter.Body): void {
    const dx = Math.abs(body.position.x - state.lastX);
    const dy = Math.abs(body.position.y - state.lastY);
    if (dx < STUCK_MOVEMENT_THRESHOLD && dy < STUCK_MOVEMENT_THRESHOLD) {
      state.stuckFrames++;
      if (state.stuckFrames >= STUCK_FRAMES) {
        nudgeBody(body, 0.008);
        state.stuckFrames = 0;
      }
    } else {
      state.stuckFrames = 0;
    }
    state.lastX = body.position.x;
    state.lastY = body.position.y;
  }

  private applyHit(
    weapon: WeaponStats,
    attack: AttackConfig,
    attacker: Matter.Body,
    defender: Matter.Body,
    attackerTeam: 'A' | 'B',
  ): void {
    processHit({
      weapon,
      attack,
      attacker,
      defender,
      attackerTeam,
      hp: this.hp,
      maxHp: this.maxHp,
      damageDealt: this.damageDealt,
      teamA: this.teamA,
      teamB: this.teamB,
      bodyA: this.bodyA,
      bodyB: this.bodyB,
      statusMgr: this.statusMgr,
      particles: this.particles,
      effects: this.effects,
      audio: this.audio,
      simTime: this.simTime,
      recordAbilityProc: this.recordAbilityProc,
      spawnUnit: (body) => this.droneCtrl.spawnUnit(attackerTeam, body, this.simTime),
    });
    this.recordGameEvent('hit', attackerTeam);
  }

  private applyBallAbility(
    ability: BallAbility | undefined,
    team: 'A' | 'B',
    trigger: BallAbilityType,
    _context: { delta?: number; x?: number; y?: number } = {},
  ): void {
    if (!ability || ability.trigger !== trigger) return;
    const body = team === 'A' ? this.bodyA : this.bodyB;
    const teamConfig = team === 'A' ? this.teamA : this.teamB;
    applyAbility({
      ability,
      team,
      trigger,
      body,
      teamConfig,
      statusMgr: this.statusMgr,
      particles: this.particles,
      effects: this.effects,
      audio: this.audio,
      simTime: this.simTime,
      recordProc: () => this.recordAbilityProc(team, trigger),
    });
  }

  private tickGenericTrail(team: TeamTickState): void {
    const p = team.config.ball.ability?.params;
    if (!p?.tickTrailEnabled) return;

    const condEffect = p.tickTrailConditionEffect;
    if (condEffect) {
      const effect = this.statusMgr
        .getEffects(team.id)
        .find((e) => e.type === condEffect);
      if (!effect || effect.stacks < (p.tickTrailConditionMinStacks ?? 1))
        return;
    }
    if (Math.random() >= (p.tickTrailSpawnChance ?? 1)) return;

    let tx: number, ty: number, tr: number;
    if (p.tickTrailAtWeapon) {
      const angle =
        team.id === 'A' ? this.weapons.orbitAngleA : this.weapons.orbitAngleB;
      const hitboxR = getWeaponHitboxRadius(team.config.weapon);
      const pos = getOrbitPosition(
        team.body.position.x,
        team.body.position.y,
        team.config.ball.radius,
        angle,
        hitboxR,
      );
      tx = pos.x;
      ty = pos.y;
      tr = hitboxR * (p.tickTrailRadiusFrac ?? 0.45);
    } else {
      tx = team.body.position.x;
      ty = team.body.position.y;
      tr = team.config.ball.radius * (p.tickTrailRadiusFrac ?? 0.5);
    }
    this.particles.pushTrail({
      x: tx,
      y: ty,
      radius: tr,
      color: p.tickTrailColor ?? '#FFFFFF',
      alpha: p.tickTrailAlpha ?? 0.5,
      ttl: p.tickTrailTtl ?? 8,
      maxTtl: p.tickTrailTtl ?? 8,
    });
  }

  protected registerCollisionHandler(): () => void {
    const handler = (e: Matter.IEventCollision<Matter.Engine>) =>
      this.onCollision(e);
    Events.on(this.engine, 'collisionStart', handler);
    return () => Events.off(this.engine, 'collisionStart', handler);
  }
}
