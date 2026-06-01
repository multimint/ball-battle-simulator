import Matter from 'matter-js';
import type { TeamConfig, WeaponStats, AttackConfig, WinnerType, BallAbility, BallAbilityType } from '../models/types';
import { StatusEffectManager } from './StatusEffectManager';
import { isAbilityBerserk } from '../utils/ability';
import { getCollisionImpulse, getCollisionPoint } from '../utils/collision';
import { clampVelocity, nudgeBody, bodyOptionsFromBall } from '../utils/physics';
import { getWeaponHitboxRadius, getOrbitPosition } from '../rendering/drawOrbitWeapon';
import { EffectsController } from './EffectsController';
import { ParticleController } from './ParticleController';
import { AudioEmitter } from './AudioEmitter';
import { WeaponController } from './WeaponController';
import { VideoEncoder } from './VideoEncoder';
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
} from '../constants/gameConstants';
import type { InitialVelocities, SimulationResult } from '../store/useGameStore';
import type { ApplyEffectOptions } from './StatusEffectManager';

const { Engine, World, Bodies, Composite, Body, Events } = Matter;

interface GameSimulatorConfig {
  teamA: TeamConfig;
  teamB: TeamConfig;
  initialVelocities: InitialVelocities;
  fps?: number;
  bitrate?: number;
  workerMode?: boolean;
}

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
  const minSpeed = maxSpeed * PHYSICS_SPEED_SCALE * INITIAL_SPEED_MIN_FRAC * 0.6;
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

export class GameSimulator {
  private engine: Matter.Engine;
  private bodyA: Matter.Body;
  private bodyB: Matter.Body;

  private hp: { A: number; B: number };
  private maxHp: { A: number; B: number };
  private damageDealt: { A: number; B: number } = { A: 0, B: 0 };
  private turns = 0;
  private simTime = 0;
  private winner: WinnerType = null;
  private matchEnded = false;

  private stuckA: StuckState = { lastX: 0, lastY: 0, stuckFrames: 0 };
  private stuckB: StuckState = { lastX: 0, lastY: 0, stuckFrames: 0 };

  private statusMgr = new StatusEffectManager();

  private teamA: TeamConfig;
  private teamB: TeamConfig;
  private initialVelocities: InitialVelocities;

  // Controllers
  private effects: EffectsController;
  private particles: ParticleController;
  private audio: AudioEmitter;
  private weapons: WeaponController;
  private video: VideoEncoder;

  constructor(config: GameSimulatorConfig) {
    this.teamA = config.teamA;
    this.teamB = config.teamB;
    this.initialVelocities = config.initialVelocities;

    this.hp    = { A: config.teamA.ball.durability, B: config.teamB.ball.durability };
    this.maxHp = { A: config.teamA.ball.durability, B: config.teamB.ball.durability };

    // ── Physics engine ──────────────────────────────────────────────────────
    this.engine = Engine.create({ gravity: { x: 0, y: 0 } });

    const wallOpts: Matter.IBodyDefinition = { isStatic: true, restitution: 1.0, friction: 0, frictionStatic: 0, label: 'wall' };
    const half = WALL_THICKNESS / 2;
    const walls = [
      Bodies.rectangle(ARENA_SIZE / 2, -half, ARENA_SIZE + WALL_THICKNESS * 2, WALL_THICKNESS, wallOpts),
      Bodies.rectangle(ARENA_SIZE / 2, ARENA_SIZE + half, ARENA_SIZE + WALL_THICKNESS * 2, WALL_THICKNESS, wallOpts),
      Bodies.rectangle(-half, ARENA_SIZE / 2, WALL_THICKNESS, ARENA_SIZE + WALL_THICKNESS * 2, wallOpts),
      Bodies.rectangle(ARENA_SIZE + half, ARENA_SIZE / 2, WALL_THICKNESS, ARENA_SIZE + WALL_THICKNESS * 2, wallOpts),
    ];

    this.bodyA = Bodies.circle(BALL_A_START.x, BALL_A_START.y, config.teamA.ball.radius, { ...bodyOptionsFromBall(config.teamA.ball), label: 'ballA' });
    this.bodyB = Bodies.circle(BALL_B_START.x, BALL_B_START.y, config.teamB.ball.radius, { ...bodyOptionsFromBall(config.teamB.ball), label: 'ballB' });

    Composite.add(this.engine.world, [...walls, this.bodyA, this.bodyB]);
    Body.setVelocity(this.bodyA, config.initialVelocities.velA);
    Body.setVelocity(this.bodyB, config.initialVelocities.velB);

    // ── Controllers ─────────────────────────────────────────────────────────
    this.effects  = new EffectsController();
    this.particles = new ParticleController();
    this.audio    = new AudioEmitter();
    this.weapons  = new WeaponController(config.teamA, config.teamB);
    this.video    = new VideoEncoder(
      config.teamA,
      config.teamB,
      config.fps ?? 60,
      config.bitrate ?? 20_000_000,
      config.workerMode ?? false,
    );
  }

  async run(onProgress: (pct: number) => void): Promise<{ blob: Blob; vels: InitialVelocities; result: SimulationResult }> {
    const isEncoderSupported = typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined';
    if (isEncoderSupported) this.video.initEncoder();

    const handleCollision = (e: Matter.IEventCollision<Matter.Engine>) => this.onCollision(e);
    Events.on(this.engine, 'collisionStart', handleCollision);

    // ── Phase 1: Intro card ───────────────────────────────────────────────
    let frameIdx = await this.video.encodeIntroPhase(this.teamA, this.teamB, 0, onProgress);

    // ── Intro → Fight transition flash ───────────────────────────────────
    frameIdx = this.video.encodeWhiteFlash(frameIdx);

    // Restore the static fight-view background before encoding fight frames.
    this.video.restoreCaptureBg();

    // Record the frame count before the fight starts — used to offset audio event timestamps.
    const preFightFrames = frameIdx;

    // ── Phase 2: Fight simulation ─────────────────────────────────────────
    // Physics always steps at 60 Hz so fights are deterministic regardless of output fps.
    const PHYSICS_STEP = 1000 / 60;
    const encodeEvery  = Math.round(60 / this.video.fps);
    let physicsFrame = 0;
    const yieldInterval = this.video.workerMode ? 120 : 60;

    while (!this.matchEnded) {
      this.tick(PHYSICS_STEP);
      physicsFrame++;

      if (physicsFrame % encodeEvery === 0) {
        this.encodeFrame(frameIdx);
        frameIdx++;
      }

      // Yield periodically to drain encoder output callbacks and keep UI responsive.
      if (physicsFrame % yieldInterval === 0 || this.video.encoderQueueSize > 60) {
        onProgress(0.05 + 0.88 * Math.min(this.simTime / 60_000, 0.99));
        await new Promise<void>((r) => setTimeout(r, 0));
      }
    }

    // 1-second freeze on the KO moment — repeat the last rendered frame, no physics tick.
    for (let v = 0; v < this.video.fps; v++) {
      this.encodeFrame(frameIdx);
      frameIdx++;
    }

    Events.off(this.engine, 'collisionStart', handleCollision);

    // ── Fight → Result transition flash ──────────────────────────────────
    frameIdx = this.video.encodeWhiteFlash(frameIdx);

    // ── Phase 3: Result card ──────────────────────────────────────────────
    await this.video.encodeResultPhase(this.teamA, this.teamB, this.winner, frameIdx, onProgress);

    onProgress(1.0);

    Engine.clear(this.engine);
    World.clear(this.engine.world, false);

    // ── Audio synthesis & encoding ────────────────────────────────────────
    if (typeof AudioEncoder !== 'undefined' && typeof AudioData !== 'undefined') {
      try {
        await this.video.synthesizeAndEncodeAudio(
          this.audio.getEvents(),
          this.audio.koSimTime,
          preFightFrames,
          this.simTime,
        );
      } catch (err) {
        console.warn('GameSimulator: audio synthesis failed', err);
      }
    }

    const blob = await this.video.finalize();

    return {
      blob,
      vels: this.initialVelocities,
      result: {
        winner: this.winner,
        damageDealt: { ...this.damageDealt },
        turnsElapsed: this.turns,
      },
    };
  }

  private onCollision(event: Matter.IEventCollision<Matter.Engine>): void {
    const isWall  = (b: Matter.Body) => b.label === 'wall';
    const isBallA = (b: Matter.Body) => b.id === this.bodyA.id;
    const isBallB = (b: Matter.Body) => b.id === this.bodyB.id;

    for (const pair of event.pairs) {
      const { bodyA, bodyB } = pair;

      if ([bodyA, bodyB].some(isBallA) && [bodyA, bodyB].some(isBallB)) {
        const impulse = getCollisionImpulse(pair);
        const point   = getCollisionPoint(pair);
        if (impulse > HEAVY_HIT_THRESHOLD) {
          this.effects.applySlowMotion();
          this.effects.applyScreenShake(SCREEN_SHAKE_MAGNITUDE, SCREEN_SHAKE_TTL);
        }
        this.particles.spawnBurst(point.x, point.y, this.teamA.ball.color, 8);
        this.turns++;
        this.audio.emitBallBounce(this.teamA.audioProfile.hitStyle, this.simTime);
      } else if ((isWall(bodyA) && isBallA(bodyB)) || (isWall(bodyB) && isBallA(bodyA))) {
        this.audio.emitWallBounce(this.teamA.audioProfile.hitStyle, this.simTime);
      } else if ((isWall(bodyA) && isBallB(bodyB)) || (isWall(bodyB) && isBallB(bodyA))) {
        this.audio.emitWallBounce(this.teamB.audioProfile.hitStyle, this.simTime);
      }
    }
  }

  private tick(delta: number): void {
    const scaledDelta = delta * this.effects.slowMotion;

    this.effects.step();
    Engine.update(this.engine, scaledDelta);

    const teams = [
      { id: 'A' as const, config: this.teamA, body: this.bodyA, stuck: this.stuckA },
      { id: 'B' as const, config: this.teamB, body: this.bodyB, stuck: this.stuckB },
    ];
    const speedMults = teams.map(t => this.getSpeedMultiplier(t.id)) as [number, number];

    // Speed clamp, min-speed enforcement, berserk homing, spin, stuck detection
    const berserk = teams.map(t => isAbilityBerserk(t.config.ball.ability, this.hp[t.id] / this.maxHp[t.id]));
    for (let i = 0; i < 2; i++) {
      const team    = teams[i];
      const enemy   = teams[1 - i];
      const sMult   = speedMults[i];
      clampVelocity(team.body, team.config.ball.maxSpeed * sMult, VELOCITY_CLAMP);
      enforceMinSpeed(team.body, team.config.ball.maxSpeed * sMult);
      this.applyBerserkHoming(berserk[i], team.body, enemy.body, team.config.ball.radius);
      const spin = berserk[i] ? BERSERK_SPIN_MULT : 1.0;
      Body.setAngularVelocity(team.body, team.config.ball.spinSpeed * 0.05 * spin * sMult * Math.sign(team.body.velocity.x || 1));
      this.updateStuck(team.stuck, team.body);
    }

    // Weapon orbit & attack processing
    this.effects.stepWeaponEffects();
    const { hitboxA, hitboxB } = this.weapons.updateOrbit(
      scaledDelta, this.simTime,
      this.teamA, this.teamB,
      this.bodyA, this.bodyB,
      this.hp, this.maxHp,
      this.statusMgr,
    );
    const hitboxes = [hitboxA, hitboxB] as const;

    if (this.hp.A > 0 && this.hp.B > 0) {
      for (let i = 0; i < 2; i++) {
        const team    = teams[i];
        const enemy   = teams[1 - i];
        this.weapons.processAttacks(
          team.id, this.simTime, team.config.weapon, team.body, enemy.body,
          enemy.config.ball.radius, hitboxes[i], team.config.ball.radius,
          this.hp[team.id] / this.maxHp[team.id],
          team.config.ball.maxSpeed * speedMults[i],
          this.applyHit.bind(this),
          (w, atk, hr, idx, tid) => {
            this.weapons.spawnBullet(tid, w, atk, hr, idx, team.body, enemy.body, team.config.ball.radius);
            if (idx === 0) this.audio.emitBulletFire(team.config.audioProfile.hitStyle, this.simTime);
          },
        );
      }
    }
    this.weapons.updateBullets(scaledDelta, this.hp, this.teamA, this.teamB, this.bodyA, this.bodyB, this.applyHit.bind(this));

    this.tickStatusEffects(scaledDelta);

    // Ball ability ticks (passive, onLowHP) + per-frame ambient trail
    for (const team of teams) {
      this.applyBallAbility(team.config.ball.ability, team.id, 'passive', { delta: scaledDelta });
      if (isAbilityBerserk(team.config.ball.ability, this.hp[team.id] / this.maxHp[team.id])) {
        this.applyBallAbility(team.config.ball.ability, team.id, 'onLowHP', { delta: scaledDelta });
      }
      this.tickGenericTrail(team);
    }

    // Soft attraction: pull balls toward each other when far apart
    const adx   = this.bodyB.position.x - this.bodyA.position.x;
    const ady   = this.bodyB.position.y - this.bodyA.position.y;
    const adist = Math.hypot(adx, ady);
    if (adist > SOFT_ATTRACT_THRESHOLD_PX) {
      const excess = adist - SOFT_ATTRACT_THRESHOLD_PX;
      const fx = (adx / adist) * SOFT_ATTRACT_FORCE_COEFF * excess;
      const fy = (ady / adist) * SOFT_ATTRACT_FORCE_COEFF * excess;
      Body.applyForce(this.bodyA, this.bodyA.position, { x:  fx, y:  fy });
      Body.applyForce(this.bodyB, this.bodyB.position, { x: -fx, y: -fy });
    }

    this.particles.step();

    const aKO = this.hp.A <= 0;
    const bKO = this.hp.B <= 0;
    if      (aKO && bKO) { this.matchEnded = true; this.winner = 'draw'; }
    else if (bKO)        { this.matchEnded = true; this.winner = 'A'; }
    else if (aKO)        { this.matchEnded = true; this.winner = 'B'; }
    if (this.matchEnded && this.audio.koSimTime < 0) {
      this.audio.koSimTime = this.simTime;
    }

    this.simTime += delta;
  }

  private isBerserk(team: 'A' | 'B'): boolean {
    const t = team === 'A' ? this.teamA : this.teamB;
    return isAbilityBerserk(t.ball.ability, this.hp[team] / this.maxHp[team]);
  }

  private applyBerserkHoming(active: boolean, self: Matter.Body, enemy: Matter.Body, radius: number): void {
    if (!active) return;
    const dx = enemy.position.x - self.position.x;
    const dy = enemy.position.y - self.position.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) return;
    const nx = dx / dist;
    const ny = dy / dist;
    const speed = Math.hypot(self.velocity.x, self.velocity.y);
    Body.setVelocity(self, {
      x: self.velocity.x * (1 - BERSERK_HOMING_BLEND) + nx * speed * BERSERK_HOMING_BLEND,
      y: self.velocity.y * (1 - BERSERK_HOMING_BLEND) + ny * speed * BERSERK_HOMING_BLEND,
    });
    if (Math.random() < BERSERK_TRAIL_SPAWN_CHANCE) {
      this.particles.pushTrail({ x: self.position.x, y: self.position.y, radius: radius * 0.55, color: BERSERK_TRAIL_COLOR, alpha: 0.55, ttl: 10, maxTtl: 10 });
    }
  }

  private encodeFrame(frameIdx: number): void {
    this.video.renderFrame({
      ballAPos: { x: this.bodyA.position.x, y: this.bodyA.position.y, angle: this.bodyA.angle },
      ballBPos: { x: this.bodyB.position.x, y: this.bodyB.position.y, angle: this.bodyB.angle },
      ballA: this.teamA.ball,
      ballB: this.teamB.ball,
      hpA: this.hp.A,
      hpB: this.hp.B,
      maxHpA: this.maxHp.A,
      maxHpB: this.maxHp.B,
      particles:     this.particles.particles,
      weaponEffects: this.effects.weaponEffects,
      floaters:      this.particles.floaters,
      weaponA: this.teamA.weapon,
      weaponB: this.teamB.weapon,
      orbitAngleA: this.weapons.orbitAngleA,
      orbitAngleB: this.weapons.orbitAngleB,
      screenShake: this.effects.screenShake,
      screenFlash: this.effects.screenFlash,
      hitFlashA:   this.effects.hitFlashA,
      hitFlashB:   this.effects.hitFlashB,
      colorA: this.teamA.ball.color,
      colorB: this.teamB.ball.color,
      trailSegments: this.particles.trailSegments,
      bullets:  this.weapons.bullets,
      abilityA: this.teamA.ball.ability,
      abilityB: this.teamB.ball.ability,
      effectsA: this.statusMgr.getEffects('A'),
      effectsB: this.statusMgr.getEffects('B'),
      rangeMultA: this.weapons.rangeMultA,
      rangeMultB: this.weapons.rangeMultB,
    }, {
      damageDealtA: this.damageDealt.A,
      damageDealtB: this.damageDealt.B,
      turns: this.turns,
      effectsA: this.statusMgr.getEffects('A'),
      effectsB: this.statusMgr.getEffects('B'),
      abilityA: this.teamA.ball.ability,
      abilityB: this.teamB.ball.ability,
      hpFracA:  this.hp.A / this.maxHp.A,
      hpFracB:  this.hp.B / this.maxHp.B,
      chargeA:  this.weapons.chargeA,
      chargeB:  this.weapons.chargeB,
      weaponA:  this.teamA.weapon,
      weaponB:  this.teamB.weapon,
    });
    this.video.commitFrame(frameIdx);
  }

  private updateStuck(state: StuckState, body: Matter.Body): void {
    const dx = Math.abs(body.position.x - state.lastX);
    const dy = Math.abs(body.position.y - state.lastY);
    if (dx < STUCK_MOVEMENT_THRESHOLD && dy < STUCK_MOVEMENT_THRESHOLD) {
      state.stuckFrames++;
      if (state.stuckFrames >= STUCK_FRAMES) { nudgeBody(body, 0.008); state.stuckFrames = 0; }
    } else {
      state.stuckFrames = 0;
    }
    state.lastX = body.position.x;
    state.lastY = body.position.y;
  }

  applyStatusEffect(opts: Omit<ApplyEffectOptions, 'simTime'>): void {
    this.statusMgr.apply({ ...opts, simTime: this.simTime });
  }

  private tickStatusEffects(delta: number): void {
    this.statusMgr.tick(delta, this.hp);
  }

  private getSpeedMultiplier(team: 'A' | 'B'): number {
    return this.statusMgr.getSpeedMultiplier(team);
  }

  private getOutgoingDamageMultiplier(team: 'A' | 'B'): number {
    return this.statusMgr.getOutgoingDamageMultiplier(team);
  }

  private getIncomingDamageMultiplier(team: 'A' | 'B'): number {
    return this.statusMgr.getIncomingDamageMultiplier(team);
  }

  private consumeShield(team: 'A' | 'B', rawDamage: number): number {
    return this.statusMgr.consumeShield(team, rawDamage);
  }

  private applyHit(
    weapon: WeaponStats,
    attack: AttackConfig,
    attacker: Matter.Body,
    defender: Matter.Body,
    attackerTeam: 'A' | 'B',
  ): void {
    processHit({
      weapon, attack, attacker, defender, attackerTeam,
      hp: this.hp, maxHp: this.maxHp, damageDealt: this.damageDealt,
      teamA: this.teamA, teamB: this.teamB,
      bodyA: this.bodyA, bodyB: this.bodyB,
      statusMgr: this.statusMgr,
      particles: this.particles,
      effects: this.effects,
      audio: this.audio,
      simTime: this.simTime,
    });
  }

  private applyBallAbility(
    ability: BallAbility | undefined,
    team: 'A' | 'B',
    trigger: BallAbilityType,
    _context: { delta?: number; x?: number; y?: number } = {},
  ): void {
    if (!ability || ability.trigger !== trigger) return;
    const body       = team === 'A' ? this.bodyA : this.bodyB;
    const teamConfig = team === 'A' ? this.teamA  : this.teamB;
    applyAbility({
      ability, team, trigger, body, teamConfig,
      statusMgr: this.statusMgr,
      particles: this.particles,
      effects: this.effects,
      audio: this.audio,
      simTime: this.simTime,
    });
  }

  private tickGenericTrail(team: TeamTickState): void {
    const p = team.config.ball.ability?.params;
    if (!p?.tickTrailEnabled) return;

    const condEffect = p.tickTrailConditionEffect;
    if (condEffect) {
      const effect = this.statusMgr.getEffects(team.id).find(e => e.type === condEffect);
      if (!effect || effect.stacks < (p.tickTrailConditionMinStacks ?? 1)) return;
    }
    if (Math.random() >= (p.tickTrailSpawnChance ?? 1)) return;

    let tx: number, ty: number, tr: number;
    if (p.tickTrailAtWeapon) {
      const angle   = team.id === 'A' ? this.weapons.orbitAngleA : this.weapons.orbitAngleB;
      const hitboxR = getWeaponHitboxRadius(team.config.weapon);
      const pos     = getOrbitPosition(team.body.position.x, team.body.position.y, team.config.ball.radius, angle, hitboxR);
      tx = pos.x; ty = pos.y;
      tr = hitboxR * (p.tickTrailRadiusFrac ?? 0.45);
    } else {
      tx = team.body.position.x; ty = team.body.position.y;
      tr = team.config.ball.radius * (p.tickTrailRadiusFrac ?? 0.5);
    }
    this.particles.pushTrail({
      x: tx, y: ty, radius: tr,
      color:  p.tickTrailColor ?? '#FFFFFF',
      alpha:  p.tickTrailAlpha ?? 0.5,
      ttl:    p.tickTrailTtl ?? 8,
      maxTtl: p.tickTrailTtl ?? 8,
    });
  }
}
