import Matter from 'matter-js';
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import type { TeamConfig, WeaponStats, WinnerType, BallAbility, BallAbilityType, StatusEffect, StatusEffectType } from '../models/types';
import type { Particle, WeaponEffect, FloatingDamage, ScreenShake, ScreenFlash, HitFlash, TrailSegment, Bullet } from '../models/GameState';
import { Renderer } from '../rendering/Renderer';
import { drawBackground, drawArenaWalls } from '../rendering/drawBackground';
import { drawCaptureTopPanel, drawCaptureBottomPanel } from '../rendering/drawCaptureOverlay';
import { drawIntroCard, drawResultCard } from '../rendering/drawBattleCard';
import { spawnParticleBurst, stepParticles } from '../rendering/drawParticles';
import { stepFloaters, createFloater } from '../rendering/drawFloaters';
import { createWeaponEffect } from '../rendering/drawWeaponEffect';
import { getWeaponHitboxRadius, getOrbitPosition } from '../rendering/drawOrbitWeapon';
import { applyKnockback, clampVelocity, nudgeBody, directionBetween, bodyOptionsFromBall } from '../utils/physics';
import { getCollisionImpulse, getCollisionPoint } from '../utils/collision';
import {
  ARENA_SIZE,
  CAPTURE_CANVAS_WIDTH,
  CAPTURE_CANVAS_HEIGHT,
  CAPTURE_TOP_HEIGHT,
  CAPTURE_ARENA_PAD,
  WALL_THICKNESS,
  BALL_A_START,
  BALL_B_START,
  MAX_PARTICLES,

  VELOCITY_CLAMP,
  PHYSICS_SPEED_SCALE,
  INITIAL_SPEED_MIN_FRAC,
  SLOW_MOTION_FACTOR,
  SLOW_MOTION_RECOVERY,
  SCREEN_SHAKE_MAGNITUDE,
  SCREEN_SHAKE_TTL,
  STUCK_FRAMES,
  STUCK_MOVEMENT_THRESHOLD,
  HEAVY_HIT_THRESHOLD,
  WEAPON_ORBIT_SPEED_SCALE,
  WEAPON_HIT_COOLDOWN_MIN,
  INTRO_DURATION_S,
  RESULT_DURATION_S,
  WHITE_FLASH_FRAMES,
} from '../constants/gameConstants';
import type { InitialVelocities, SimulationResult } from '../store/useGameStore';

const { Engine, World, Bodies, Composite, Body, Events } = Matter;

// OffscreenCanvas contexts share the same API surface as CanvasRenderingContext2D
// but TypeScript treats them as different types. This alias lets us cast safely.
type Ctx2D = CanvasRenderingContext2D;

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

function orbitSpeed(weapon: WeaponStats): number {
  return Math.max(1.8, weapon.speed) * WEAPON_ORBIT_SPEED_SCALE;
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

  private orbitAngleA = Math.PI * 0.25;
  private orbitAngleB = Math.PI * 1.25;
  private lastHitA = -99999;
  private lastHitB = -99999;

  private particles: Particle[] = [];
  private floaters: FloatingDamage[] = [];
  private trailSegments: TrailSegment[] = [];
  private activeEffectsA: StatusEffect[] = [];
  private activeEffectsB: StatusEffect[] = [];
  private weaponEffects: WeaponEffect[] = [];
  private screenShake: ScreenShake = { magnitude: 0, ttl: 0 };
  private screenFlash: ScreenFlash = { alpha: 0, color: '#FFFFFF', ttl: 0 };
  private hitFlashA: HitFlash = { alpha: 0, color: '#FFFFFF', ttl: 0 };
  private hitFlashB: HitFlash = { alpha: 0, color: '#FFFFFF', ttl: 0 };
  private slowMotion = 1.0;

  private stuckA: StuckState = { lastX: 0, lastY: 0, stuckFrames: 0 };
  private stuckB: StuckState = { lastX: 0, lastY: 0, stuckFrames: 0 };

  private chargeA = 0;
  private chargeB = 0;

  private bullets: Bullet[] = [];

  private physicsCanvas: OffscreenCanvas;
  private captureCanvas: OffscreenCanvas;
  private captureBg!: OffscreenCanvas;
  private captureCtx: Ctx2D;
  private renderer: Renderer;

  // Pre-computed arena layout (constant throughout the match)
  private readonly arenaDrawSize: number = CAPTURE_CANVAS_WIDTH - CAPTURE_ARENA_PAD * 2;
  private readonly arenaX: number = CAPTURE_ARENA_PAD;
  private readonly arenaY: number = CAPTURE_TOP_HEIGHT + CAPTURE_ARENA_PAD;

  private encoder: VideoEncoder | null = null;
  private muxer: Muxer<ArrayBufferTarget> | null = null;
  private target: ArrayBufferTarget | null = null;
  private frameCount = 0;
  private fps: number;
  private bitrate: number;
  private workerMode: boolean;

  private teamA: TeamConfig;
  private teamB: TeamConfig;
  private initialVelocities: InitialVelocities;

  constructor(config: GameSimulatorConfig) {
    this.teamA = config.teamA;
    this.teamB = config.teamB;
    this.initialVelocities = config.initialVelocities;
    this.fps = config.fps ?? 60;
    this.bitrate = config.bitrate ?? 20_000_000;
    this.workerMode = config.workerMode ?? false;

    this.hp = { A: config.teamA.ball.durability, B: config.teamB.ball.durability };
    this.maxHp = { A: config.teamA.ball.durability, B: config.teamB.ball.durability };

    // ── Physics engine ──────────────────────────────────────────────────────
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
      Bodies.rectangle(ARENA_SIZE / 2, -half, ARENA_SIZE + WALL_THICKNESS * 2, WALL_THICKNESS, wallOpts),
      Bodies.rectangle(ARENA_SIZE / 2, ARENA_SIZE + half, ARENA_SIZE + WALL_THICKNESS * 2, WALL_THICKNESS, wallOpts),
      Bodies.rectangle(-half, ARENA_SIZE / 2, WALL_THICKNESS, ARENA_SIZE + WALL_THICKNESS * 2, wallOpts),
      Bodies.rectangle(ARENA_SIZE + half, ARENA_SIZE / 2, WALL_THICKNESS, ARENA_SIZE + WALL_THICKNESS * 2, wallOpts),
    ];

    this.bodyA = Bodies.circle(BALL_A_START.x, BALL_A_START.y, config.teamA.ball.radius, {
      ...bodyOptionsFromBall(config.teamA.ball),
      label: 'ballA',
    });
    this.bodyB = Bodies.circle(BALL_B_START.x, BALL_B_START.y, config.teamB.ball.radius, {
      ...bodyOptionsFromBall(config.teamB.ball),
      label: 'ballB',
    });

    Composite.add(this.engine.world, [...walls, this.bodyA, this.bodyB]);
    Body.setVelocity(this.bodyA, config.initialVelocities.velA);
    Body.setVelocity(this.bodyB, config.initialVelocities.velB);

    // ── Canvases ─────────────────────────────────────────────────────────────
    this.physicsCanvas = new OffscreenCanvas(ARENA_SIZE, ARENA_SIZE);
    this.captureCanvas = new OffscreenCanvas(CAPTURE_CANVAS_WIDTH, CAPTURE_CANVAS_HEIGHT);
    this.captureCtx = this.captureCanvas.getContext('2d') as unknown as Ctx2D;

    // Pre-render the physics arena background (grid + walls) once.
    // These 25+ draw calls are completely static and are replaced by a single drawImage each frame.
    const physicsStaticBg = this.buildPhysicsStaticBg();
    const physicsCtx = this.physicsCanvas.getContext('2d') as unknown as Ctx2D;
    this.renderer = new Renderer(physicsCtx, physicsStaticBg);

    // Pre-render the capture canvas static parts (top panel + arena bg + card shadow + bottom panel)
    // and stamp them onto captureCanvas ONCE. Per-frame rendering only overwrites the arena region.
    // captureBg is kept so run() can restore it after the intro card phase.
    this.captureBg = this.buildCaptureBg();
    this.captureCtx.drawImage(this.captureBg as unknown as HTMLCanvasElement, 0, 0);
  }

  private buildPhysicsStaticBg(): OffscreenCanvas {
    const bg = new OffscreenCanvas(ARENA_SIZE, ARENA_SIZE);
    const ctx = bg.getContext('2d') as unknown as Ctx2D;
    drawBackground(ctx);
    drawArenaWalls(ctx, this.teamA.ball.color, this.teamB.ball.color);
    return bg;
  }

  private buildCaptureBg(): OffscreenCanvas {
    const bg = new OffscreenCanvas(CAPTURE_CANVAS_WIDTH, CAPTURE_CANVAS_HEIGHT);
    const ctx = bg.getContext('2d') as unknown as Ctx2D;

    drawCaptureTopPanel(ctx, this.teamA, this.teamB);

    ctx.fillStyle = '#FFFADE';
    ctx.fillRect(0, CAPTURE_TOP_HEIGHT, CAPTURE_CANVAS_WIDTH, CAPTURE_CANVAS_WIDTH);

    ctx.save();
    ctx.shadowColor = 'rgba(1, 0, 107, 0.18)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = '#FEFEFE';
    ctx.fillRect(this.arenaX, this.arenaY, this.arenaDrawSize, this.arenaDrawSize);
    ctx.restore();

    drawCaptureBottomPanel(ctx, 0, 0, 0, this.teamA.ball.color, this.teamB.ball.color);

    return bg;
  }


  private initEncoder(): void {
    try {
      const target = new ArrayBufferTarget();
      this.target = target;
      this.muxer = new Muxer({
        target,
        video: { codec: 'avc', width: CAPTURE_CANVAS_WIDTH, height: CAPTURE_CANVAS_HEIGHT, frameRate: this.fps },
        fastStart: 'in-memory',
      });
      this.encoder = new VideoEncoder({
        output: (chunk, meta) => this.muxer!.addVideoChunk(chunk, meta),
        error: (e) => console.error('GameSimulator VideoEncoder error:', e),
      });
      this.encoder.configure({
        codec: 'avc1.640033',          // H.264 High Profile Level 5.1 — supports 1080p@60fps
        width: CAPTURE_CANVAS_WIDTH,
        height: CAPTURE_CANVAS_HEIGHT,
        bitrate: this.bitrate,
        framerate: this.fps,
        hardwareAcceleration: 'prefer-hardware',
      });
    } catch (err) {
      console.error('GameSimulator: failed to init encoder', err);
    }
  }

  async run(onProgress: (pct: number) => void): Promise<{ blob: Blob; vels: InitialVelocities; result: SimulationResult }> {
    const isEncoderSupported = typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined';
    if (isEncoderSupported) {
      this.initEncoder();
    }

    // ── Collision event: particles + turn counter ───────────────────────────
    const handleCollision = (event: Matter.IEventCollision<Matter.Engine>) => {
      for (const pair of event.pairs) {
        const invA = [pair.bodyA, pair.bodyB].some((b) => b.id === this.bodyA.id);
        const invB = [pair.bodyA, pair.bodyB].some((b) => b.id === this.bodyB.id);
        if (!invA || !invB) continue;

        const impulse = getCollisionImpulse(pair);
        const point = getCollisionPoint(pair);

        if (impulse > HEAVY_HIT_THRESHOLD) {
          this.slowMotion = SLOW_MOTION_FACTOR;
          this.screenShake = { magnitude: SCREEN_SHAKE_MAGNITUDE, ttl: SCREEN_SHAKE_TTL };
        }

        spawnParticleBurst(this.particles, point.x, point.y, this.teamA.ball.color, 8, MAX_PARTICLES);
        this.turns++;
      }

      // Wall-bounce ability trigger
      for (const pair of event.pairs) {
        const isWall = (b: Matter.Body) => b.label === 'wall';
        const isBallA = (b: Matter.Body) => b.id === this.bodyA.id;
        const isBallB = (b: Matter.Body) => b.id === this.bodyB.id;
        if ((isWall(pair.bodyA) && isBallA(pair.bodyB)) || (isWall(pair.bodyB) && isBallA(pair.bodyA))) {
          this.applyBallAbility(this.teamA.ball.ability, 'A', 'onBounce', { x: this.bodyA.position.x, y: this.bodyA.position.y });
        } else if ((isWall(pair.bodyA) && isBallB(pair.bodyB)) || (isWall(pair.bodyB) && isBallB(pair.bodyA))) {
          this.applyBallAbility(this.teamB.ball.ability, 'B', 'onBounce', { x: this.bodyB.position.x, y: this.bodyB.position.y });
        }
      }
    };
    Events.on(this.engine, 'collisionStart', handleCollision);

    // ── Phase 1: Intro card ───────────────────────────────────────────────
    let frameIdx = await this.encodeIntroPhase(0, onProgress);

    // ── Intro → Fight transition flash ───────────────────────────────────
    frameIdx = this.encodeWhiteFlash(frameIdx);

    // Restore the static fight-view background before encoding fight frames.
    this.captureCtx.drawImage(this.captureBg as unknown as HTMLCanvasElement, 0, 0);

    // ── Phase 2: Fight simulation ─────────────────────────────────────────
    // Physics always steps at 60 Hz so fights are deterministic regardless of
    // output fps. encodeEvery skips frames when outputting at < 60 fps.
    const PHYSICS_STEP = 1000 / 60;
    const encodeEvery = Math.round(60 / this.fps);
    let physicsFrame = 0;
    const yieldInterval = this.workerMode ? 120 : 60;

    while (!this.matchEnded) {
      this.tick(PHYSICS_STEP);
      physicsFrame++;

      if (physicsFrame % encodeEvery === 0) {
        this.encodeFrame(frameIdx);
        frameIdx++;
      }

      // Yield periodically to drain encoder output callbacks and keep UI responsive.
      if (physicsFrame % yieldInterval === 0 || (this.encoder?.encodeQueueSize ?? 0) > 60) {
        onProgress(0.05 + 0.88 * Math.min(this.simTime / 60_000, 0.99));
        await new Promise<void>((r) => setTimeout(r, 0));
      }
    }

    Events.off(this.engine, 'collisionStart', handleCollision);

    // ── Fight → Result transition flash ──────────────────────────────────
    frameIdx = this.encodeWhiteFlash(frameIdx);

    // ── Phase 3: Result card ──────────────────────────────────────────────
    frameIdx = await this.encodeResultPhase(frameIdx, onProgress);

    onProgress(1.0);

    Engine.clear(this.engine);
    World.clear(this.engine.world, false);

    const blob = await this.finalizeVideo();

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
    const scaledDelta = delta * this.slowMotion;

    if (this.slowMotion < 1.0) {
      this.slowMotion = Math.min(1.0, this.slowMotion + SLOW_MOTION_RECOVERY);
    }
    if (this.screenShake.ttl > 0) this.screenShake.ttl--;
    if (this.screenFlash.ttl > 0) { this.screenFlash.ttl--; this.screenFlash.alpha *= 0.72; }
    if (this.hitFlashA.ttl > 0) { this.hitFlashA.ttl--; this.hitFlashA.alpha *= 0.68; }
    if (this.hitFlashB.ttl > 0) { this.hitFlashB.ttl--; this.hitFlashB.alpha *= 0.68; }

    Engine.update(this.engine, scaledDelta);

    const speedMultA = this.getSpeedMultiplier('A');
    const speedMultB = this.getSpeedMultiplier('B');
    clampVelocity(this.bodyA, this.teamA.ball.maxSpeed * speedMultA, VELOCITY_CLAMP);
    clampVelocity(this.bodyB, this.teamB.ball.maxSpeed * speedMultB, VELOCITY_CLAMP);

    enforceMinSpeed(this.bodyA, this.teamA.ball.maxSpeed * speedMultA);
    enforceMinSpeed(this.bodyB, this.teamB.ball.maxSpeed * speedMultB);

    const berserkSpinA = this.teamA.ball.ability?.trigger === 'onLowHP' && this.hp.A / this.maxHp.A < Number(this.teamA.ball.ability?.params?.threshold ?? 0.3) ? 3.5 : 1.0;
    const berserkSpinB = this.teamB.ball.ability?.trigger === 'onLowHP' && this.hp.B / this.maxHp.B < Number(this.teamB.ball.ability?.params?.threshold ?? 0.3) ? 3.5 : 1.0;
    Body.setAngularVelocity(this.bodyA, this.teamA.ball.spinSpeed * 0.05 * berserkSpinA * Math.sign(this.bodyA.velocity.x || 1));
    Body.setAngularVelocity(this.bodyB, this.teamB.ball.spinSpeed * 0.05 * berserkSpinB * Math.sign(this.bodyB.velocity.x || -1));

    this.updateStuck(this.stuckA, this.bodyA);
    this.updateStuck(this.stuckB, this.bodyB);

    this.updateWeaponOrbit(scaledDelta);
    this.updateBullets(scaledDelta);

    // Tick status effects (DoT damage, duration countdown)
    this.tickStatusEffects(scaledDelta);

    // Ball ability ticks (trail, passive, onLowHP)
    this.applyBallAbility(this.teamA.ball.ability, 'A', 'trail', { delta: scaledDelta, x: this.bodyA.position.x, y: this.bodyA.position.y });
    this.applyBallAbility(this.teamB.ball.ability, 'B', 'trail', { delta: scaledDelta, x: this.bodyB.position.x, y: this.bodyB.position.y });
    this.applyBallAbility(this.teamA.ball.ability, 'A', 'passive', { delta: scaledDelta });
    this.applyBallAbility(this.teamB.ball.ability, 'B', 'passive', { delta: scaledDelta });

    // Quickstrike orbit trail — spawns at weapon position when speedBoost stacks >= 2
    for (const team of ['A', 'B'] as const) {
      const teamData = team === 'A' ? this.teamA : this.teamB;
      if (teamData.ball.ability?.id === 'quickstrike-momentum') {
        const effects = team === 'A' ? this.activeEffectsA : this.activeEffectsB;
        const boost = effects.find(e => e.type === 'speedBoost');
        if (boost && boost.stacks >= 2 && Math.random() < 0.75) {
          const body = team === 'A' ? this.bodyA : this.bodyB;
          const orbitAngle = team === 'A' ? this.orbitAngleA : this.orbitAngleB;
          const hitboxR = getWeaponHitboxRadius(teamData.weapon);
          const pos = getOrbitPosition(body.position.x, body.position.y, teamData.ball.radius, orbitAngle, hitboxR);
          this.trailSegments.push({
            x: pos.x,
            y: pos.y,
            radius: hitboxR * 0.45,
            color: '#44FF44',
            alpha: 0.55,
            ttl: 8,
            maxTtl: 8,
          });
        }
      }
    }

    const hpFracA = this.hp.A / this.maxHp.A;
    const hpFracB = this.hp.B / this.maxHp.B;
    if (hpFracA < Number(this.teamA.ball.ability?.params?.threshold ?? 0.3)) {
      this.applyBallAbility(this.teamA.ball.ability, 'A', 'onLowHP', { delta: scaledDelta });
    }
    if (hpFracB < Number(this.teamB.ball.ability?.params?.threshold ?? 0.3)) {
      this.applyBallAbility(this.teamB.ball.ability, 'B', 'onLowHP', { delta: scaledDelta });
    }

    // Soft attraction: pull balls toward each other when far apart
    const adx = this.bodyB.position.x - this.bodyA.position.x;
    const ady = this.bodyB.position.y - this.bodyA.position.y;
    const adist = Math.hypot(adx, ady);
    const ATTRACT_THRESHOLD = 200;
    if (adist > ATTRACT_THRESHOLD) {
      const k = 0.000004;
      const excess = adist - ATTRACT_THRESHOLD;
      const fx = (adx / adist) * k * excess;
      const fy = (ady / adist) * k * excess;
      Body.applyForce(this.bodyA, this.bodyA.position, { x: fx, y: fy });
      Body.applyForce(this.bodyB, this.bodyB.position, { x: -fx, y: -fy });
    }

    // Step trail segments
    this.trailSegments = this.trailSegments
      .map((s) => ({ ...s, ttl: s.ttl - 1, alpha: s.alpha * (s.ttl / s.maxTtl) }))
      .filter((s) => s.ttl > 0);

    this.particles = stepParticles(this.particles);
    this.floaters = stepFloaters(this.floaters);

    const aKO = this.hp.A <= 0;
    const bKO = this.hp.B <= 0;
    if (aKO && bKO) { this.matchEnded = true; this.winner = 'draw'; }
    else if (bKO) { this.matchEnded = true; this.winner = 'A'; }
    else if (aKO) { this.matchEnded = true; this.winner = 'B'; }

    this.simTime += delta;
  }

  private isBerserk(team: 'A' | 'B'): boolean {
    const t = team === 'A' ? this.teamA : this.teamB;
    const threshold = Number(t.ball.ability?.params?.threshold ?? 0.3);
    return t.ball.ability?.trigger === 'onLowHP' && this.hp[team] / this.maxHp[team] < threshold;
  }

  private updateWeaponOrbit(delta: number): void {
    const dt = delta / 1000;
    const { teamA, teamB, bodyA, bodyB } = this;
    const berserkMult = 2.5;

    if (teamA.weapon.aimAtEnemy) {
      this.orbitAngleA = Math.atan2(bodyB.position.y - bodyA.position.y, bodyB.position.x - bodyA.position.x);
    } else {
      this.orbitAngleA += orbitSpeed(teamA.weapon) * (this.isBerserk('A') ? berserkMult : 1) * dt;
    }
    if (teamB.weapon.aimAtEnemy) {
      this.orbitAngleB = Math.atan2(bodyA.position.y - bodyB.position.y, bodyA.position.x - bodyB.position.x);
    } else {
      this.orbitAngleB -= orbitSpeed(teamB.weapon) * (this.isBerserk('B') ? berserkMult : 1) * dt;
    }

    const hitboxA = getWeaponHitboxRadius(teamA.weapon);
    const hitboxB = getWeaponHitboxRadius(teamB.weapon);

    if (this.hp.A > 0 && this.hp.B > 0) {
      if (teamA.weapon.aimAtEnemy) {
        const cooldown = Math.max(WEAPON_HIT_COOLDOWN_MIN, teamA.weapon.cooldown * 1000);
        if (this.simTime - this.lastHitA >= cooldown) {
          this.lastHitA = this.simTime;
          this.spawnBullet('A', teamA.weapon, hitboxA);
        }
      } else {
        const posA = getOrbitPosition(bodyA.position.x, bodyA.position.y, teamA.ball.radius, this.orbitAngleA, hitboxA);
        const distAtoB = Math.hypot(posA.x - bodyB.position.x, posA.y - bodyB.position.y);
        if (distAtoB < hitboxA + teamB.ball.radius) {
          const cooldown = Math.max(WEAPON_HIT_COOLDOWN_MIN, teamA.weapon.cooldown * 1000);
          if (this.simTime - this.lastHitA >= cooldown) {
            this.lastHitA = this.simTime;
            this.applyHit(teamA.weapon, bodyA, bodyB, 'A');
          }
        }
      }
    }

    if (this.hp.A > 0 && this.hp.B > 0) {
      if (teamB.weapon.aimAtEnemy) {
        const cooldown = Math.max(WEAPON_HIT_COOLDOWN_MIN, teamB.weapon.cooldown * 1000);
        if (this.simTime - this.lastHitB >= cooldown) {
          this.lastHitB = this.simTime;
          this.spawnBullet('B', teamB.weapon, hitboxB);
        }
      } else {
        const posB = getOrbitPosition(bodyB.position.x, bodyB.position.y, teamB.ball.radius, this.orbitAngleB, hitboxB);
        const distBtoA = Math.hypot(posB.x - bodyA.position.x, posB.y - bodyA.position.y);
        if (distBtoA < hitboxB + teamA.ball.radius) {
          const cooldown = Math.max(WEAPON_HIT_COOLDOWN_MIN, teamB.weapon.cooldown * 1000);
          if (this.simTime - this.lastHitB >= cooldown) {
            this.lastHitB = this.simTime;
            this.applyHit(teamB.weapon, bodyB, bodyA, 'B');
          }
        }
      }
    }

    for (const e of this.weaponEffects) e.progress += 1;
    this.weaponEffects = this.weaponEffects.filter((e) => e.progress < e.maxProgress);
  }

  private spawnBullet(team: 'A' | 'B', weapon: WeaponStats, hitboxR: number): void {
    const body = team === 'A' ? this.bodyA : this.bodyB;
    const opponent = team === 'A' ? this.bodyB : this.bodyA;
    const angle = team === 'A' ? this.orbitAngleA : this.orbitAngleB;
    const ballRadius = (team === 'A' ? this.teamA : this.teamB).ball.radius;
    const start = getOrbitPosition(body.position.x, body.position.y, ballRadius, angle, hitboxR);
    const dx = opponent.position.x - start.x;
    const dy = opponent.position.y - start.y;
    const dist = Math.hypot(dx, dy);
    const speed = 2.0; // px per ms
    this.bullets.push({
      x: start.x,
      y: start.y,
      vx: dist > 0 ? (dx / dist) * speed : speed,
      vy: dist > 0 ? (dy / dist) * speed : 0,
      owner: team,
      radius: 5,
      color: weapon.color ?? '#4488CC',
      ttl: 2000,
    });
  }

  private updateBullets(scaledDelta: number): void {
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx * scaledDelta;
      b.y += b.vy * scaledDelta;
      b.ttl -= scaledDelta;
      if (b.ttl <= 0) {
        this.bullets.splice(i, 1);
        continue;
      }
      const attacker = b.owner === 'A' ? this.bodyA : this.bodyB;
      const enemy = b.owner === 'A' ? this.bodyB : this.bodyA;
      const enemyBall = b.owner === 'A' ? this.teamB.ball : this.teamA.ball;
      const dx = enemy.position.x - b.x;
      const dy = enemy.position.y - b.y;
      const dist = Math.hypot(dx, dy);
      if (dist < enemyBall.radius + b.radius && this.hp.A > 0 && this.hp.B > 0) {
        const weapon = b.owner === 'A' ? this.teamA.weapon : this.teamB.weapon;
        this.applyHit(weapon, attacker, enemy, b.owner);
        this.bullets.splice(i, 1);
      }
    }
  }

  private applyHit(weapon: WeaponStats, attacker: Matter.Body, defender: Matter.Body, attackerTeam: 'A' | 'B'): void {
    const targetTeam: 'A' | 'B' = attackerTeam === 'A' ? 'B' : 'A';
    const dir = directionBetween(attacker, defender);
    const hitAngle = Math.atan2(dir.y, dir.x);

    let lastDmg = 0;
    const damage = (team: 'A' | 'B', amount: number): number => {
      // Apply attacker buff and defender debuff multipliers
      const attackingTeam: 'A' | 'B' = team === 'A' ? 'B' : 'A';
      let modified = amount * this.getOutgoingDamageMultiplier(attackingTeam) * this.getIncomingDamageMultiplier(team);
      modified = this.consumeShield(team, modified);
      const rounded = Math.round(modified);
      const actual = Math.min(rounded, this.hp[team]);
      this.hp[team] = Math.max(0, this.hp[team] - rounded);
      const opponent: 'A' | 'B' = team === 'A' ? 'B' : 'A';
      this.damageDealt[opponent] += actual;
      this.floaters.push(
        createFloater(
          `-${rounded}`,
          defender.position.x + (Math.random() - 0.5) * 20,
          defender.position.y - 20,
          targetTeam === 'A' ? '#E47D79' : '#4A90E2',
        ),
      );
      // Lifesteal: heal the attacker for a fraction of damage dealt
      const lifesteal = this.activeEffectsA.concat(this.activeEffectsB)
        .find((e) => e.type === 'lifesteal' && (team === 'B' ? attackerTeam === 'A' : attackerTeam === 'B'));
      if (lifesteal) {
        const heal = Math.round(actual * lifesteal.magnitude);
        if (heal > 0) {
          this.hp[attackerTeam] = Math.min(this.maxHp[attackerTeam], this.hp[attackerTeam] + heal);
          this.floaters.push(createFloater(`+${heal}`, attacker.position.x, attacker.position.y - 20, '#44FF88'));
        }
      }
      lastDmg = rounded;
      return rounded;
    };

    const burst = (x: number, y: number, color: string, count: number) => {
      spawnParticleBurst(this.particles, x, y, color, count, MAX_PARTICLES);
    };

    const applyTierEffects = (category: string, defTeam: 'A' | 'B', color: string, dmg: number) => {
      // Damage-scaled screen shake — magnitude and duration both grow with damage
      const shakeMag = Math.min(8, dmg / 2);
      const shakeTtl = Math.round(Math.min(SCREEN_SHAKE_TTL, dmg * 1.25));
      if (shakeMag >= 0.5) {
        this.screenShake = { magnitude: shakeMag, ttl: shakeTtl };
      }
      // Slow motion on heavy hits (≥12 damage) or any aoe
      if (dmg >= 12 || category === 'aoe') {
        this.slowMotion = SLOW_MOTION_FACTOR;
      }
      const c = color || '#FFFFFF';
      if (category === 'melee') {
        if (defTeam === 'A') this.hitFlashA = { alpha: 0.65, color: c, ttl: 5 };
        else this.hitFlashB = { alpha: 0.65, color: c, ttl: 5 };
      } else if (category === 'projectile') {
        this.screenFlash = { alpha: 0.22, color: c, ttl: 5 };
      } else if (category === 'aoe') {
        this.screenFlash = { alpha: 0.40, color: c, ttl: 7 };
        if (defTeam === 'A') this.hitFlashA = { alpha: 0.75, color: '#FFFFFF', ttl: 6 };
        else this.hitFlashB = { alpha: 0.75, color: '#FFFFFF', ttl: 6 };
      } else if (category === 'shield') {
        if (defTeam === 'A') this.hitFlashA = { alpha: 0.50, color: c, ttl: 4 };
        else this.hitFlashB = { alpha: 0.50, color: c, ttl: 4 };
      }
    };

    switch (weapon.category) {
      case 'melee': {
        let kbMult = 1.0, dmgMult = 1.0;
        if (weapon.name === 'Heavy Hammer') { kbMult = 1.6; dmgMult = 1.2; }
        else if (weapon.name === 'Long Spear') { kbMult = 0.9; }
        else if (weapon.name === 'Chain Flail') { kbMult = 0.7; dmgMult = 0.8; }
        applyKnockback(defender, dir.x, dir.y, weapon.knockback * kbMult);
        damage(targetTeam, weapon.damage * dmgMult);
        burst(defender.position.x, defender.position.y, weapon.color ?? '#CC6633', 8);
        const et = weapon.name === 'Heavy Hammer' ? 'hammer' : weapon.name === 'Long Spear' ? 'spear' : weapon.name === 'Chain Flail' ? 'flail' : 'sword';
        this.weaponEffects.push(createWeaponEffect(et, attacker.position.x, attacker.position.y, hitAngle, weapon.color ?? '#CC6633', 12));
        break;
      }
      case 'shield': {
        applyKnockback(defender, dir.x, dir.y, weapon.knockback * 1.8);
        if (weapon.damage > 0) damage(targetTeam, Math.max(1, Math.round(weapon.damage * 0.2)));
        this.weaponEffects.push(createWeaponEffect('shield', attacker.position.x, attacker.position.y, hitAngle, weapon.color ?? '#AAAAFF', 18, { radius: (attacker.circleRadius ?? 25) + 14 }));
        burst(attacker.position.x, attacker.position.y, weapon.color ?? '#AAAAFF', 6);
        break;
      }
      case 'projectile': {
        let dmgMult = 1.0, kbMult = 1.0;
        if (weapon.name === 'Grenade Bomb') {
          dmgMult = 1.3; kbMult = 1.2;
          this.weaponEffects.push(createWeaponEffect('explosion', defender.position.x, defender.position.y, 0, weapon.color ?? '#44AA44', 20, { radius: 70 }));
        } else if (weapon.name === 'Power Cannon') {
          dmgMult = 1.1; kbMult = 1.5;
        } else if (weapon.name === 'Energy Laser') {
          this.weaponEffects.push(createWeaponEffect('laser', attacker.position.x, attacker.position.y, hitAngle, weapon.color ?? '#44AAFF', 10, { x2: defender.position.x, y2: defender.position.y }));
        }
        applyKnockback(defender, dir.x, dir.y, weapon.knockback * kbMult);
        damage(targetTeam, weapon.damage * dmgMult);
        burst(defender.position.x, defender.position.y, weapon.color ?? '#FFF', 10);
        break;
      }
      case 'aoe': {
        applyKnockback(defender, dir.x, dir.y, weapon.knockback * 1.5);
        damage(targetTeam, weapon.damage);
        this.weaponEffects.push(createWeaponEffect('shockwave', attacker.position.x, attacker.position.y, 0, weapon.color ?? '#FF44FF', 25, { radius: weapon.range * 30 }));
        burst(attacker.position.x, attacker.position.y, weapon.color ?? '#FF44FF', 15);
        break;
      }
      case 'utility': {
        if (weapon.name === 'Magnet Beam') {
          const pullDir = directionBetween(defender, attacker);
          applyKnockback(defender, pullDir.x, pullDir.y, 80);
          if (weapon.damage > 0) damage(targetTeam, weapon.damage);
          burst((attacker.position.x + defender.position.x) / 2, (attacker.position.y + defender.position.y) / 2, weapon.color ?? '#44FFAA', 6);
        } else if (weapon.name === 'Repulsor') {
          applyKnockback(defender, dir.x, dir.y, weapon.knockback * 1.3);
          applyKnockback(attacker, -dir.x, -dir.y, weapon.knockback * 0.4);
          damage(targetTeam, weapon.damage);
          this.weaponEffects.push(createWeaponEffect('explosion', attacker.position.x, attacker.position.y, 0, weapon.color ?? '#FFFF44', 18, { radius: 55 }));
        }
        break;
      }
    }

    applyTierEffects(weapon.category, targetTeam, weapon.color ?? '#FFFFFF', lastDmg);

    // Velocity burst in hit direction — amplified when attacker is in berserk
    if (lastDmg > 0) {
      const attackerBerserk = this.isBerserk(attackerTeam);
      const burstMult = attackerBerserk ? 2.5 : 1.0;
      const burst = Math.min(10, (lastDmg / 8) * burstMult);
      Body.setVelocity(defender, {
        x: defender.velocity.x + dir.x * burst,
        y: defender.velocity.y + dir.y * burst,
      });
      const boostMag = attackerBerserk ? Math.min(1.2, lastDmg * 0.018) : Math.min(0.7, lastDmg * 0.01);
      const boostDur = Math.round(attackerBerserk ? Math.min(1000, lastDmg * 18) : Math.min(700, lastDmg * 12));
      this.applyStatusEffect(targetTeam, 'speedBoost', boostDur, boostMag, 'refresh', 1, '#FF6600', '💨');
    }

    // Ball ability triggers for hit events
    this.applyBallAbility(
      attackerTeam === 'A' ? this.teamA.ball.ability : this.teamB.ball.ability,
      attackerTeam, 'onHitDealt',
      { x: defender.position.x, y: defender.position.y },
    );
    this.applyBallAbility(
      targetTeam === 'A' ? this.teamA.ball.ability : this.teamB.ball.ability,
      targetTeam, 'onHitReceived',
      { x: defender.position.x, y: defender.position.y },
    );
  }

  private encodeFrame(frameIdx: number): void {
    // 1. Render dynamic content to the small physics canvas (480×480).
    this.renderer.render({
      bodyA: this.bodyA,
      bodyB: this.bodyB,
      ballA: this.teamA.ball,
      ballB: this.teamB.ball,
      hpA: this.hp.A,
      hpB: this.hp.B,
      maxHpA: this.maxHp.A,
      maxHpB: this.maxHp.B,
      particles: this.particles,
      weaponEffects: this.weaponEffects,
      floaters: this.floaters,
      weaponA: this.teamA.weapon,
      weaponB: this.teamB.weapon,
      orbitAngleA: this.orbitAngleA,
      orbitAngleB: this.orbitAngleB,
      screenShake: this.screenShake,
      screenFlash: this.screenFlash,
      hitFlashA: this.hitFlashA,
      hitFlashB: this.hitFlashB,
      colorA: this.teamA.ball.color,
      colorB: this.teamB.ball.color,
      trailSegments: this.trailSegments,
      bullets: this.bullets,
      abilityA: this.teamA.ball.ability,
      abilityB: this.teamB.ball.ability,
      effectsA: this.activeEffectsA,
      effectsB: this.activeEffectsB,
    });

    // 2. Blit current physics frame into the arena region of the capture canvas.
    //    captureCanvas was pre-initialized with the static background (top panel,
    //    arena bg, card shadow, bottom panel), so only the arena area needs updating.
    const cctx = this.captureCtx;
    (cctx as unknown as OffscreenCanvasRenderingContext2D).imageSmoothingEnabled = false;
    cctx.drawImage(this.physicsCanvas as unknown as HTMLCanvasElement, this.arenaX, this.arenaY, this.arenaDrawSize, this.arenaDrawSize);

    this.commitFrame(frameIdx);
  }

  /** Commits whatever is currently drawn on captureCanvas as the next encoded video frame. */
  private commitFrame(frameIdx: number): void {
    if (!this.encoder || this.encoder.state === 'closed') return;
    try {
      const durationUs = Math.round(1_000_000 / this.fps);
      const timestampUs = frameIdx * durationUs;
      const frame = new VideoFrame(this.captureCanvas, { timestamp: timestampUs, duration: durationUs });
      const keyFrame = frameIdx % (this.fps * 2) === 0;
      this.encoder.encode(frame, { keyFrame });
      frame.close();
      this.frameCount++;
    } catch (err) {
      console.warn('GameSimulator: frame skipped', err);
    }
  }

  private async encodeIntroPhase(baseFrameIdx: number, onProgress: (pct: number) => void): Promise<number> {
    const INTRO_FRAMES = Math.round(this.fps * INTRO_DURATION_S);
    let frameIdx = baseFrameIdx;
    for (let i = 0; i < INTRO_FRAMES; i++) {
      drawIntroCard(this.captureCtx, i / this.fps, this.teamA, this.teamB);
      this.commitFrame(frameIdx++);
      const yieldInterval = this.workerMode ? 120 : 60;
      if (i % yieldInterval === 0 || (this.encoder?.encodeQueueSize ?? 0) > 60) {
        onProgress(0.02 * (i / INTRO_FRAMES));
        await new Promise<void>((r) => setTimeout(r, 0));
      }
    }
    return frameIdx;
  }

  private async encodeResultPhase(baseFrameIdx: number, onProgress: (pct: number) => void): Promise<number> {
    const RESULT_FRAMES = Math.round(this.fps * RESULT_DURATION_S);
    let frameIdx = baseFrameIdx;
    for (let i = 0; i < RESULT_FRAMES; i++) {
      drawResultCard(this.captureCtx, i / this.fps, this.teamA, this.teamB, this.winner);
      this.commitFrame(frameIdx++);
      const yieldInterval = this.workerMode ? 120 : 60;
      if (i % yieldInterval === 0 || (this.encoder?.encodeQueueSize ?? 0) > 60) {
        onProgress(0.95 + 0.04 * (i / RESULT_FRAMES));
        await new Promise<void>((r) => setTimeout(r, 0));
      }
    }
    return frameIdx;
  }

  private encodeWhiteFlash(baseFrameIdx: number): number {
    let frameIdx = baseFrameIdx;
    for (let i = 0; i < WHITE_FLASH_FRAMES; i++) {
      this.captureCtx.fillStyle = '#ffffff';
      this.captureCtx.fillRect(0, 0, CAPTURE_CANVAS_WIDTH, CAPTURE_CANVAS_HEIGHT);
      this.commitFrame(frameIdx++);
    }
    return frameIdx;
  }

  private async finalizeVideo(): Promise<Blob> {
    if (!this.encoder || !this.muxer || !this.target) {
      // Return a tiny empty blob if encoding is not supported
      return new Blob([], { type: 'video/mp4' });
    }
    try {
      await this.encoder.flush();
      this.muxer.finalize();
      this.encoder.close();
      return new Blob([this.target.buffer], { type: 'video/mp4' });
    } catch (err) {
      console.error('GameSimulator: finalize failed', err);
      return new Blob([], { type: 'video/mp4' });
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

  applyStatusEffect(
    team: 'A' | 'B',
    type: StatusEffectType,
    durationMs: number,
    magnitude: number,
    stackBehavior: StatusEffect['stackBehavior'],
    maxStacks: number,
    color: string,
    icon: string,
  ): void {
    const effects = team === 'A' ? this.activeEffectsA : this.activeEffectsB;
    const existing = effects.find((e) => e.type === type);

    if (existing) {
      if (stackBehavior === 'refresh') {
        existing.remainingMs = durationMs;
      } else if (stackBehavior === 'stack' && existing.stacks < existing.maxStacks) {
        existing.stacks++;
        existing.remainingMs = durationMs;
      }
      // 'ignore' — do nothing
      return;
    }

    effects.push({
      id: `${type}-${team}-${this.simTime}`,
      type,
      remainingMs: durationMs,
      magnitude,
      stackBehavior,
      stacks: 1,
      maxStacks,
      color,
      icon,
    });
  }

  private tickStatusEffects(delta: number): void {
    for (const team of ['A', 'B'] as const) {
      const effects = team === 'A' ? this.activeEffectsA : this.activeEffectsB;
      const alive: StatusEffect[] = [];

      for (const effect of effects) {
        effect.remainingMs -= delta;

        // Apply per-tick effects
        if (effect.type === 'burn') {
          const dmgPerMs = (effect.magnitude * effect.stacks) / 1000;
          this.hp[team] = Math.max(0, this.hp[team] - dmgPerMs * delta);
        } else if (effect.type === 'poison') {
          const dmgPerMs = effect.magnitude / 1000;
          this.hp[team] = Math.max(0, this.hp[team] - dmgPerMs * delta);
        }

        if (effect.remainingMs > 0) alive.push(effect);
      }

      if (team === 'A') this.activeEffectsA = alive;
      else this.activeEffectsB = alive;
    }
  }

  private getSpeedMultiplier(team: 'A' | 'B'): number {
    const effects = team === 'A' ? this.activeEffectsA : this.activeEffectsB;
    let mult = 1.0;
    for (const e of effects) {
      if (e.type === 'freeze') mult *= (1 - e.magnitude * e.stacks);
      if (e.type === 'speedBoost') {
        const bonus = e.magnitude * e.stacks + (e.stacks > 3 ? e.magnitude * (e.stacks - 3) : 0);
        mult *= (1 + bonus);
      }
    }
    return Math.max(0.1, mult);
  }

  private getOutgoingDamageMultiplier(team: 'A' | 'B'): number {
    const effects = team === 'A' ? this.activeEffectsA : this.activeEffectsB;
    let mult = 1.0;
    for (const e of effects) {
      if (e.type === 'rage') mult *= (1 + e.magnitude);
      if (e.type === 'weaken') mult *= (1 - e.magnitude);
    }
    return Math.max(0.1, mult);
  }

  private getIncomingDamageMultiplier(team: 'A' | 'B'): number {
    const effects = team === 'A' ? this.activeEffectsA : this.activeEffectsB;
    let mult = 1.0;
    for (const e of effects) {
      if (e.type === 'harden') mult *= (1 - e.magnitude);
    }
    return Math.max(0.1, mult);
  }

  private consumeShield(team: 'A' | 'B', rawDamage: number): number {
    const effects = team === 'A' ? this.activeEffectsA : this.activeEffectsB;
    const shieldIdx = effects.findIndex((e) => e.type === 'shield');
    if (shieldIdx === -1) return rawDamage;

    const shield = effects[shieldIdx];
    const absorbed = Math.min(shield.magnitude, rawDamage);
    shield.magnitude -= absorbed;
    if (shield.magnitude <= 0) effects.splice(shieldIdx, 1);
    return rawDamage - absorbed;
  }

  private applyBallAbility(
    ability: BallAbility | undefined,
    team: 'A' | 'B',
    trigger: BallAbilityType,
    context: { delta?: number; x?: number; y?: number } = {},
  ): void {
    if (!ability || ability.trigger !== trigger) return;
    const body = team === 'A' ? this.bodyA : this.bodyB;
    const opponentBody = team === 'A' ? this.bodyB : this.bodyA;
    const p = ability.params;

    // Generic status-effect application — any ability can carry statusEffect params
    if (p.statusEffect) {
      const target = (p.statusTarget as string) === 'self' ? team : (team === 'A' ? 'B' : 'A');
      this.applyStatusEffect(
        target,
        p.statusEffect as StatusEffectType,
        Number(p.statusDuration ?? 2000),
        Number(p.statusMagnitude ?? 0.3),
        (p.stackBehavior as StatusEffect['stackBehavior']) ?? 'refresh',
        Number(p.maxStacks ?? 1),
        p.statusColor as string ?? '#FF8800',
        p.statusIcon as string ?? '✨',
      );
    }

    // Ability-triggered screen effects (set via params in ball ability definition)
    if (p.hitFlash) {
      const flashColor = p.hitFlashColor as string ?? '#FFFFFF';
      const flashTeam = (p.hitFlashTarget as string) === 'enemy' ? (team === 'A' ? 'B' : 'A') : team;
      if (flashTeam === 'A') this.hitFlashA = { alpha: 0.65, color: flashColor, ttl: 5 };
      else this.hitFlashB = { alpha: 0.65, color: flashColor, ttl: 5 };
    }
    if (p.hitShakeMagnitude) {
      this.screenShake = { magnitude: Number(p.hitShakeMagnitude), ttl: SCREEN_SHAKE_TTL };
    }
    if (p.hitSlowMo) {
      this.slowMotion = SLOW_MOTION_FACTOR;
    }
    if (p.hitScreenFlash) {
      this.screenFlash = {
        alpha: Number(p.hitScreenFlashAlpha ?? 0.3),
        color: p.hitScreenFlashColor as string ?? '#FFFFFF',
        ttl: Math.round(Number(p.hitScreenFlashTtl ?? 5)),
      };
    }

    switch (ability.id) {
      // Each new ball's ability case will be added here by /create-ball
      case 'marksman-target-lock': {
        const delta = context.delta ?? 16;
        if (team === 'A') this.chargeA += Number(p.chargeRate ?? 0.05) * delta;
        else this.chargeB += Number(p.chargeRate ?? 0.05) * delta;
        const charge = team === 'A' ? this.chargeA : this.chargeB;
        if (charge >= 100) {
          if (team === 'A') this.chargeA = 0;
          else this.chargeB = 0;
          // Burst toward opponent
          const vel = body.velocity;
          const speed = Math.hypot(vel.x, vel.y);
          const dx = opponentBody.position.x - body.position.x;
          const dy = opponentBody.position.y - body.position.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 0 && speed > 0.01) {
            const burstSpeed = speed * (1 + Number(p.burstMagnitude ?? 0.8));
            Body.setVelocity(body, {
              x: -(dx / dist) * burstSpeed,
              y: -(dy / dist) * burstSpeed,
            });
          }
          // Speed boost status for visual ring
          this.applyStatusEffect(
            team, 'speedBoost',
            Number(p.burstDuration ?? 1200),
            Number(p.burstMagnitude ?? 0.8),
            'refresh', 1,
            p.burstColor as string ?? '#66AAFF',
            p.burstIcon as string ?? '🎯',
          );
          // Trail orbs on burst
          const ballRadius = (team === 'A' ? this.teamA : this.teamB).ball.radius;
          for (let i = 0; i < 3; i++) {
            const offsetX = (Math.random() - 0.5) * ballRadius * 0.5;
            const offsetY = (Math.random() - 0.5) * ballRadius * 0.5;
            this.trailSegments.push({
              x: body.position.x + offsetX,
              y: body.position.y + offsetY,
              radius: ballRadius * 0.6,
              color: p.burstColor as string ?? '#66AAFF',
              alpha: 0.7,
              ttl: 12,
              maxTtl: 12,
            });
          }
        }
        break;
      }
      case 'quickstrike-momentum': {
        // Spawn a green burst of trail orbs at the moment of each hit
        const ballRadius = (team === 'A' ? this.teamA : this.teamB).ball.radius;
        for (let i = 0; i < 3; i++) {
          const offsetX = (Math.random() - 0.5) * ballRadius * 0.5;
          const offsetY = (Math.random() - 0.5) * ballRadius * 0.5;
          this.trailSegments.push({
            x: body.position.x + offsetX,
            y: body.position.y + offsetY,
            radius: ballRadius * 0.6,
            color: '#44FF44',
            alpha: 0.6,
            ttl: 10,
            maxTtl: 10,
          });
        }
        break;
      }
      case 'bloodrage-fury': {
        this.applyStatusEffect(
          team,
          'speedBoost',
          Number(p.speedBoostDuration ?? 3000),
          Number(p.speedBoostMagnitude ?? 0.7),
          'refresh',
          1,
          p.speedBoostColor as string ?? '#FF8800',
          p.speedBoostIcon as string ?? '⚡',
        );
        // Fading orb trail behind the ball during berserk
        if (Math.random() < 0.7) {
          const ballRadius = (team === 'A' ? this.teamA : this.teamB).ball.radius;
          this.trailSegments.push({
            x: body.position.x,
            y: body.position.y,
            radius: ballRadius * 0.8,
            color: '#FF2200',
            alpha: 0.55,
            ttl: 12,
            maxTtl: 12,
          });
        }
        break;
      }
      default:
        break;
    }
    // Suppress unused-variable warnings until ability cases are added
    void body; void opponentBody; void p; void context;
  }
}
