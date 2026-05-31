import Matter from 'matter-js';
import type { TeamConfig, WeaponStats, AttackConfig, WinnerType, BallAbility, BallAbilityType, StatusEffect, StatusEffectType } from '../models/types';
import type { SpriteKey } from '../sprites/SpriteKey';
import { StatusEffectManager } from './StatusEffectManager';
import { getHitMultipliers } from './WeaponHitProcessor';
import { isAbilityBerserk } from '../utils/ability';
import { getCollisionImpulse, getCollisionPoint } from '../utils/collision';
import { applyKnockback, clampVelocity, nudgeBody, directionBetween, bodyOptionsFromBall } from '../utils/physics';
import { getWeaponHitboxRadius, getOrbitPosition } from '../rendering/drawOrbitWeapon';
import { EffectsController } from './EffectsController';
import { ParticleController } from './ParticleController';
import { AudioEmitter } from './AudioEmitter';
import { WeaponController } from './WeaponController';
import { VideoEncoder } from './VideoEncoder';
import {
  ARENA_SIZE,
  VELOCITY_CLAMP,
  PHYSICS_SPEED_SCALE,
  INITIAL_SPEED_MIN_FRAC,
  SLOW_MOTION_FACTOR,
  SCREEN_SHAKE_MAGNITUDE,
  SCREEN_SHAKE_TTL,
  STUCK_FRAMES,
  STUCK_MOVEMENT_THRESHOLD,
  HEAVY_HIT_THRESHOLD,
  WALL_THICKNESS,
  BALL_A_START,
  BALL_B_START,
  MAX_PARTICLES,
} from '../constants/gameConstants';
import type { InitialVelocities, SimulationResult } from '../store/useGameStore';

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

    // ── Collision event: particles + turn counter ───────────────────────────
    const handleCollision = (event: Matter.IEventCollision<Matter.Engine>) => {
      for (const pair of event.pairs) {
        const invA = [pair.bodyA, pair.bodyB].some((b) => b.id === this.bodyA.id);
        const invB = [pair.bodyA, pair.bodyB].some((b) => b.id === this.bodyB.id);
        if (!invA || !invB) continue;

        const impulse = getCollisionImpulse(pair);
        const point   = getCollisionPoint(pair);

        if (impulse > HEAVY_HIT_THRESHOLD) {
          this.effects.applySlowMotion();
          this.effects.applyScreenShake(SCREEN_SHAKE_MAGNITUDE, SCREEN_SHAKE_TTL);
        }

        this.particles.spawnBurst(point.x, point.y, this.teamA.ball.color, 8);
        this.turns++;

        this.audio.emitBallBounce(this.teamA.audioProfile.hitStyle, this.simTime);
      }

      // Wall-bounce ability trigger + audio
      for (const pair of event.pairs) {
        const isWall  = (b: Matter.Body) => b.label === 'wall';
        const isBallA = (b: Matter.Body) => b.id === this.bodyA.id;
        const isBallB = (b: Matter.Body) => b.id === this.bodyB.id;
        if ((isWall(pair.bodyA) && isBallA(pair.bodyB)) || (isWall(pair.bodyB) && isBallA(pair.bodyA))) {
          this.applyBallAbility(this.teamA.ball.ability, 'A', 'onBounce', { x: this.bodyA.position.x, y: this.bodyA.position.y });
          this.audio.emitWallBounce(this.teamA.audioProfile.hitStyle, this.simTime);
        } else if ((isWall(pair.bodyA) && isBallB(pair.bodyB)) || (isWall(pair.bodyB) && isBallB(pair.bodyA))) {
          this.applyBallAbility(this.teamB.ball.ability, 'B', 'onBounce', { x: this.bodyB.position.x, y: this.bodyB.position.y });
          this.audio.emitWallBounce(this.teamB.audioProfile.hitStyle, this.simTime);
        }
      }
    };
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
    frameIdx = await this.video.encodeResultPhase(this.teamA, this.teamB, this.winner, frameIdx, onProgress);

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

  private tick(delta: number): void {
    const scaledDelta = delta * this.effects.slowMotion;

    this.effects.step();

    Engine.update(this.engine, scaledDelta);

    const speedMultA = this.getSpeedMultiplier('A');
    const speedMultB = this.getSpeedMultiplier('B');
    clampVelocity(this.bodyA, this.teamA.ball.maxSpeed * speedMultA, VELOCITY_CLAMP);
    clampVelocity(this.bodyB, this.teamB.ball.maxSpeed * speedMultB, VELOCITY_CLAMP);

    enforceMinSpeed(this.bodyA, this.teamA.ball.maxSpeed * speedMultA);
    enforceMinSpeed(this.bodyB, this.teamB.ball.maxSpeed * speedMultB);

    const berserkA = isAbilityBerserk(this.teamA.ball.ability, this.hp.A / this.maxHp.A);
    const berserkB = isAbilityBerserk(this.teamB.ball.ability, this.hp.B / this.maxHp.B);

    // Berserk homing — steer 25% toward enemy each tick
    this.applyBerserkHoming(berserkA, this.bodyA, this.bodyB, this.teamA.ball.radius);
    this.applyBerserkHoming(berserkB, this.bodyB, this.bodyA, this.teamB.ball.radius);

    const berserkSpinA = berserkA ? 3.5 : 1.0;
    const berserkSpinB = berserkB ? 3.5 : 1.0;
    Body.setAngularVelocity(this.bodyA, this.teamA.ball.spinSpeed * 0.05 * berserkSpinA * speedMultA * Math.sign(this.bodyA.velocity.x || 1));
    Body.setAngularVelocity(this.bodyB, this.teamB.ball.spinSpeed * 0.05 * berserkSpinB * speedMultB * Math.sign(this.bodyB.velocity.x || 1));

    this.updateStuck(this.stuckA, this.bodyA);
    this.updateStuck(this.stuckB, this.bodyB);

    // Weapon orbit & attack processing
    this.effects.stepWeaponEffects();
    const { hitboxA, hitboxB } = this.weapons.updateOrbit(
      scaledDelta, this.simTime,
      this.teamA, this.teamB,
      this.bodyA, this.bodyB,
      this.hp, this.maxHp,
      this.statusMgr,
    );

    if (this.hp.A > 0 && this.hp.B > 0) {
      this.weapons.processAttacks(
        'A', this.simTime, this.teamA.weapon, this.bodyA, this.bodyB,
        this.teamB.ball.radius, hitboxA, this.teamA.ball.radius,
        this.applyHit.bind(this),
        (w, atk, hr, idx, team) => {
          this.weapons.spawnBullet(team, w, atk, hr, idx, this.bodyA, this.bodyB, this.teamA.ball.radius);
          if (idx === 0) this.audio.emitBulletFire(this.teamA.audioProfile.hitStyle, this.simTime);
        },
      );
    }
    if (this.hp.A > 0 && this.hp.B > 0) {
      this.weapons.processAttacks(
        'B', this.simTime, this.teamB.weapon, this.bodyB, this.bodyA,
        this.teamA.ball.radius, hitboxB, this.teamB.ball.radius,
        this.applyHit.bind(this),
        (w, atk, hr, idx, team) => {
          this.weapons.spawnBullet(team, w, atk, hr, idx, this.bodyB, this.bodyA, this.teamB.ball.radius);
          if (idx === 0) this.audio.emitBulletFire(this.teamB.audioProfile.hitStyle, this.simTime);
        },
      );
    }
    this.weapons.updateBullets(scaledDelta, this.hp, this.teamA, this.teamB, this.bodyA, this.bodyB, this.applyHit.bind(this));

    // Tick status effects (DoT damage, duration countdown)
    this.tickStatusEffects(scaledDelta);

    // Ball ability ticks (trail, passive, onLowHP)
    this.applyBallAbility(this.teamA.ball.ability, 'A', 'trail',   { delta: scaledDelta, x: this.bodyA.position.x, y: this.bodyA.position.y });
    this.applyBallAbility(this.teamB.ball.ability, 'B', 'trail',   { delta: scaledDelta, x: this.bodyB.position.x, y: this.bodyB.position.y });
    this.applyBallAbility(this.teamA.ball.ability, 'A', 'passive', { delta: scaledDelta });
    this.applyBallAbility(this.teamB.ball.ability, 'B', 'passive', { delta: scaledDelta });

    // Generic tick trail — any ability with tickTrailEnabled emits trail each frame
    for (const team of ['A', 'B'] as const) {
      const teamData = team === 'A' ? this.teamA : this.teamB;
      const p = teamData.ball.ability?.params;
      if (!p?.tickTrailEnabled) continue;
      const condEffect = p.tickTrailConditionEffect as string | undefined;
      if (condEffect) {
        const effect = this.statusMgr.getEffects(team).find(e => e.type === condEffect);
        if (!effect || effect.stacks < Number(p.tickTrailConditionMinStacks ?? 1)) continue;
      }
      if (Math.random() >= Number(p.tickTrailSpawnChance ?? 1)) continue;
      const body = team === 'A' ? this.bodyA : this.bodyB;
      let tx: number, ty: number, tr: number;
      if (p.tickTrailAtWeapon) {
        const angle = team === 'A' ? this.weapons.orbitAngleA : this.weapons.orbitAngleB;
        const hitboxR = getWeaponHitboxRadius(teamData.weapon);
        const pos = getOrbitPosition(body.position.x, body.position.y, teamData.ball.radius, angle, hitboxR);
        tx = pos.x; ty = pos.y;
        tr = hitboxR * Number(p.tickTrailRadiusFrac ?? 0.45);
      } else {
        tx = body.position.x; ty = body.position.y;
        tr = teamData.ball.radius * Number(p.tickTrailRadiusFrac ?? 0.5);
      }
      this.particles.pushTrail({
        x: tx, y: ty, radius: tr,
        color: p.tickTrailColor as string ?? '#FFFFFF',
        alpha: Number(p.tickTrailAlpha ?? 0.5),
        ttl: Number(p.tickTrailTtl ?? 8),
        maxTtl: Number(p.tickTrailTtl ?? 8),
      });
    }

    const hpFracA = this.hp.A / this.maxHp.A;
    const hpFracB = this.hp.B / this.maxHp.B;
    if (isAbilityBerserk(this.teamA.ball.ability, hpFracA)) {
      this.applyBallAbility(this.teamA.ball.ability, 'A', 'onLowHP', { delta: scaledDelta });
    }
    if (isAbilityBerserk(this.teamB.ball.ability, hpFracB)) {
      this.applyBallAbility(this.teamB.ball.ability, 'B', 'onLowHP', { delta: scaledDelta });
    }

    // Soft attraction: pull balls toward each other when far apart
    const adx = this.bodyB.position.x - this.bodyA.position.x;
    const ady = this.bodyB.position.y - this.bodyA.position.y;
    const adist = Math.hypot(adx, ady);
    if (adist > 200) {
      const k = 0.000004;
      const excess = adist - 200;
      const fx = (adx / adist) * k * excess;
      const fy = (ady / adist) * k * excess;
      Body.applyForce(this.bodyA, this.bodyA.position, { x: fx,  y: fy  });
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
      x: self.velocity.x * 0.75 + nx * speed * 0.25,
      y: self.velocity.y * 0.75 + ny * speed * 0.25,
    });
    if (Math.random() < 0.65) {
      this.particles.pushTrail({ x: self.position.x, y: self.position.y, radius: radius * 0.55, color: '#FF3300', alpha: 0.55, ttl: 10, maxTtl: 10 });
    }
  }

  private encodeFrame(frameIdx: number): void {
    this.video.renderFrame({
      bodyA: this.bodyA,
      bodyB: this.bodyB,
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

  applyStatusEffect(
    team: 'A' | 'B',
    type: StatusEffectType,
    durationMs: number,
    magnitude: number,
    stackBehavior: StatusEffect['stackBehavior'],
    maxStacks: number,
    color: string,
    icon: SpriteKey,
  ): void {
    this.statusMgr.apply(team, type, durationMs, magnitude, stackBehavior, maxStacks, color, icon, this.simTime);
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
    const targetTeam: 'A' | 'B' = attackerTeam === 'A' ? 'B' : 'A';
    const dir = directionBetween(attacker, defender);
    const hitAngle = Math.atan2(dir.y, dir.x);

    let lastDmg = 0;
    const damage = (team: 'A' | 'B', amount: number): number => {
      const attackingTeam: 'A' | 'B' = team === 'A' ? 'B' : 'A';
      let modified = amount * this.getOutgoingDamageMultiplier(attackingTeam) * this.getIncomingDamageMultiplier(team);
      modified = this.consumeShield(team, modified);
      const rounded = Math.round(modified);
      const actual  = Math.min(rounded, this.hp[team]);
      this.hp[team] = Math.max(0, this.hp[team] - actual);
      if (actual > 0) {
        const fx = defender.position.x + (Math.random() - 0.5) * 20;
        const fy = defender.position.y - (defender.circleRadius ?? 25) - 8;
        this.particles.pushFloater(String(actual), fx, fy, weapon.color ?? '#FFFFFF');
      }
      const opponent: 'A' | 'B' = team === 'A' ? 'B' : 'A';
      this.damageDealt[opponent] += actual;
      const lifesteal = this.statusMgr.getEffects(attackingTeam).find((e) => e.type === 'lifesteal');
      if (lifesteal) {
        const heal = Math.round(actual * lifesteal.magnitude);
        if (heal > 0) this.hp[attackerTeam] = Math.min(this.maxHp[attackerTeam], this.hp[attackerTeam] + heal);
      }
      lastDmg = rounded;
      return rounded;
    };

    switch (attack.type) {
      case 'melee': {
        const { kbMult, dmgMult } = getHitMultipliers(weapon, attack);
        applyKnockback(defender, dir.x, dir.y, attack.knockback * kbMult);
        damage(targetTeam, attack.damage * dmgMult);
        this.particles.spawnBurst(defender.position.x, defender.position.y, weapon.color ?? '#CC6633', 8);
        break;
      }
      case 'shield': {
        applyKnockback(defender, dir.x, dir.y, attack.knockback * 1.8);
        if (attack.damage > 0) damage(targetTeam, Math.max(1, Math.round(attack.damage * 0.2)));
        this.effects.pushWeaponEffect('shield', attacker.position.x, attacker.position.y, hitAngle, weapon.color ?? '#AAAAFF', 18, { radius: (attacker.circleRadius ?? 25) + 14 });
        this.particles.spawnBurst(attacker.position.x, attacker.position.y, weapon.color ?? '#AAAAFF', 6);
        break;
      }
      case 'projectile': {
        const { kbMult, dmgMult } = getHitMultipliers(weapon, attack);
        if (weapon.hitEffect === 'explosion') {
          this.effects.pushWeaponEffect('explosion', defender.position.x, defender.position.y, 0, weapon.color ?? '#44AA44', 20, { radius: weapon.hitEffectRadius ?? 70 });
        } else if (weapon.hitEffect === 'laser' && attack.hitscan) {
          // Full laser beam — only for the hitscan laser attack, not split bullets
          this.effects.pushWeaponEffect('laser', attacker.position.x, attacker.position.y, hitAngle, weapon.color ?? '#44AAFF', 22, { x2: defender.position.x, y2: defender.position.y });
          this.effects.pushWeaponEffect('explosion', defender.position.x, defender.position.y, 0, weapon.color ?? '#44AAFF', 18, { radius: 55 });
          this.effects.applyScreenShake(8, 14);
          this.effects.applyScreenFlash(0.45, weapon.color ?? '#4488FF', 8);
          this.effects.applyHitFlash(targetTeam, 0.9, '#FFFFFF', 8);
          this.effects.applySlowMotion();
        }
        applyKnockback(defender, dir.x, dir.y, attack.knockback * kbMult);
        damage(targetTeam, attack.damage * dmgMult);
        this.particles.spawnBurst(defender.position.x, defender.position.y, weapon.color ?? '#FFF', attack.hitscan ? 22 : 8);
        break;
      }
      case 'aoe': {
        applyKnockback(defender, dir.x, dir.y, attack.knockback * 1.5);
        damage(targetTeam, attack.damage);
        this.effects.pushWeaponEffect('shockwave', attacker.position.x, attacker.position.y, 0, weapon.color ?? '#FF44FF', 25, { radius: weapon.range * 30 });
        this.particles.spawnBurst(attacker.position.x, attacker.position.y, weapon.color ?? '#FF44FF', 15);
        break;
      }
      case 'utility': {
        if (weapon.utilityBehavior === 'pull') {
          const pullDir = directionBetween(defender, attacker);
          applyKnockback(defender, pullDir.x, pullDir.y, 80);
          if (attack.damage > 0) damage(targetTeam, attack.damage);
          this.particles.spawnBurst((attacker.position.x + defender.position.x) / 2, (attacker.position.y + defender.position.y) / 2, weapon.color ?? '#44FFAA', 6);
        } else if (weapon.utilityBehavior === 'push-both') {
          applyKnockback(defender, dir.x, dir.y, attack.knockback * 1.3);
          applyKnockback(attacker, -dir.x, -dir.y, attack.knockback * (weapon.selfKnockbackFrac ?? 0.4));
          damage(targetTeam, attack.damage);
          this.effects.pushWeaponEffect('explosion', attacker.position.x, attacker.position.y, 0, weapon.color ?? '#FFFF44', 18, { radius: 55 });
        }
        break;
      }
    }

    // Attack-level status effect (e.g. freeze on laser hit)
    if (attack.hitStatusEffect && lastDmg > 0) {
      this.applyStatusEffect(targetTeam, attack.hitStatusEffect, attack.hitStatusDuration ?? 2000, attack.hitStatusMagnitude ?? 0.3, 'refresh', 1, attack.hitStatusColor ?? '#88CCFF', attack.hitStatusIcon ?? 'burst');
    }

    this.effects.applyTierEffects(attack.type, targetTeam, weapon.color ?? '#FFFFFF', lastDmg);

    // Audio: emit hit event scaled by damage
    if (attack.type !== 'utility') {
      const hitStyle = (attackerTeam === 'A' ? this.teamA : this.teamB).audioProfile.hitStyle;
      if (attack.audioHint === 'laser') {
        this.audio.emitLaser(hitStyle, this.simTime);
      } else {
        this.audio.emitHit(hitStyle, Math.min(1, Math.max(0, lastDmg / 30)), this.simTime);
      }
    }

    // Velocity burst in hit direction — amplified when attacker is in berserk
    if (lastDmg > 0) {
      const attackerBerserk = this.isBerserk(attackerTeam);
      const burstMult = attackerBerserk ? 2.5 : 1.0;
      const burst = Math.min(10, (lastDmg / 8) * burstMult);
      Body.setVelocity(defender, { x: defender.velocity.x + dir.x * burst, y: defender.velocity.y + dir.y * burst });
      const boostMag = attackerBerserk ? Math.min(1.2, lastDmg * 0.018) : Math.min(0.7, lastDmg * 0.01);
      const boostDur = Math.round(attackerBerserk ? Math.min(1000, lastDmg * 18) : Math.min(700, lastDmg * 12));
      this.applyStatusEffect(targetTeam, 'speedBoost', boostDur, boostMag, 'refresh', 1, '#FF6600', 'burst');
    }

    // Ball ability triggers for hit events
    this.applyBallAbility(attackerTeam === 'A' ? this.teamA.ball.ability : this.teamB.ball.ability, attackerTeam, 'onHitDealt',   { x: defender.position.x, y: defender.position.y });
    this.applyBallAbility(targetTeam  === 'A' ? this.teamA.ball.ability : this.teamB.ball.ability, targetTeam,  'onHitReceived', { x: defender.position.x, y: defender.position.y });
  }

  private applyBallAbility(
    ability: BallAbility | undefined,
    team: 'A' | 'B',
    trigger: BallAbilityType,
    context: { delta?: number; x?: number; y?: number } = {},
  ): void {
    if (!ability || ability.trigger !== trigger) return;
    const body = team === 'A' ? this.bodyA : this.bodyB;
    const p = ability.params;

    // Audio: emit ability event for meaningful triggers (not per-tick trail/passive)
    if (trigger !== 'trail' && trigger !== 'passive') {
      const abilityStyle = (team === 'A' ? this.teamA : this.teamB).audioProfile.abilityStyle;
      this.audio.emitAbility(team, abilityStyle, trigger, this.simTime);
    }

    // Generic status-effect application
    if (p.statusEffect) {
      const target = (p.statusTarget as string) === 'self' ? team : (team === 'A' ? 'B' : 'A');
      this.applyStatusEffect(target, p.statusEffect as StatusEffectType, Number(p.statusDuration ?? 2000), Number(p.statusMagnitude ?? 0.3), (p.stackBehavior as StatusEffect['stackBehavior']) ?? 'refresh', Number(p.maxStacks ?? 1), p.statusColor as string ?? '#FF8800', (p.statusIcon as SpriteKey | undefined) ?? 'burst');
    }

    // Ability-triggered screen effects
    if (p.hitFlash) {
      const flashColor = p.hitFlashColor as string ?? '#FFFFFF';
      const flashTeam = (p.hitFlashTarget as string) === 'enemy' ? (team === 'A' ? 'B' : 'A') : team;
      this.effects.applyHitFlash(flashTeam, 0.65, flashColor, 5);
    }
    if (p.hitShakeMagnitude) this.effects.applyScreenShake(Number(p.hitShakeMagnitude), SCREEN_SHAKE_TTL);
    if (p.hitSlowMo)         this.effects.applySlowMotion();
    if (p.hitScreenFlash)    this.effects.applyScreenFlash(Number(p.hitScreenFlashAlpha ?? 0.3), p.hitScreenFlashColor as string ?? '#FFFFFF', Math.round(Number(p.hitScreenFlashTtl ?? 5)));

    // Second status effect
    if (p.secondStatusEffect) {
      const target2 = (p.secondStatusTarget as string) === 'enemy' ? (team === 'A' ? 'B' : 'A') : team;
      this.applyStatusEffect(target2, p.secondStatusEffect as StatusEffectType, Number(p.secondStatusDuration ?? 2000), Number(p.secondStatusMagnitude ?? 0.3), (p.secondStatusBehavior as StatusEffect['stackBehavior']) ?? 'refresh', Number(p.secondStatusMaxStacks ?? 1), p.secondStatusColor as string ?? '#FF8800', (p.secondStatusIcon as SpriteKey | undefined) ?? 'burst');
    }

    // Trail on trigger — spawned at ball position when ability fires
    if (p.trailOnTrigger) {
      const ballRadius = (team === 'A' ? this.teamA : this.teamB).ball.radius;
      const count = Number(p.trailCount ?? 1);
      const spawnChance = Number(p.trailSpawnChance ?? 1);
      if (Math.random() < spawnChance) {
        for (let i = 0; i < count; i++) {
          const scatter = Number(p.trailScatterFrac ?? 0) * ballRadius;
          this.particles.pushTrail({
            x: body.position.x + (scatter > 0 ? (Math.random() - 0.5) * scatter : 0),
            y: body.position.y + (scatter > 0 ? (Math.random() - 0.5) * scatter : 0),
            radius: ballRadius * Number(p.trailRadiusFrac ?? 0.5),
            color: p.trailColor as string ?? '#FFFFFF',
            alpha: Number(p.trailAlpha ?? 0.5),
            ttl: Number(p.trailTtl ?? 8),
            maxTtl: Number(p.trailTtl ?? 8),
          });
        }
      }
    }

    void context;
  }
}
