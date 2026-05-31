import Matter from 'matter-js';
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import type { TeamConfig, WeaponStats, AttackConfig, WinnerType, BallAbility, BallAbilityType, StatusEffect, StatusEffectType } from '../models/types';
import { synthesizeFightAudio, type AudioEvent } from '../audio/fightAudioSynthesizer';
import { StatusEffectManager } from './StatusEffectManager';
import { getHitMultipliers, getMeleeEffectLabel } from './WeaponHitProcessor';
import { isAbilityBerserk } from '../utils/ability';
import type { Particle, WeaponEffect, FloatingDamage, ScreenShake, ScreenFlash, HitFlash, TrailSegment, Bullet } from '../models/GameState';
import { Renderer } from '../rendering/Renderer';
import { drawBackground, drawArenaWalls } from '../rendering/drawBackground';
import { drawCaptureTopPanel, drawCaptureBottomPanel } from '../rendering/drawCaptureOverlay';
import { drawIntroCard, drawResultCard } from '../rendering/drawBattleCard';
import { loadAllSprites } from '../sprites/SpriteRegistry';
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

// ms the "ready" display holds before a hitscan attack fires — shared by charge display and firing logic
const HITSCAN_PREFIRE_MS = 150;

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

  private particles: Particle[] = [];
  private floaters: FloatingDamage[] = [];
  private trailSegments: TrailSegment[] = [];
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

  // Per-attack-index timers (length = weapon.attacks.length for each team)
  private lastHitTimesA: number[] = [];
  private lastHitTimesB: number[] = [];
  private burstCountsA: number[] = [];
  private burstCountsB: number[] = [];
  private lastBulletTimesA: number[] = [];
  private lastBulletTimesB: number[] = [];

  private bullets: Bullet[] = [];

  private statusMgr = new StatusEffectManager();

  private audioEvents: AudioEvent[] = [];
  private koSimTime = -1;
  // Minimum ms between ability audio events per team (prevents spam on per-tick triggers)
  private abilityAudioCooldownA = -Infinity;
  private abilityAudioCooldownB = -Infinity;
  // onLowHP fires every tick — only emit audio the first time the state is entered
  private onLowHPAudioFiredA = false;
  private onLowHPAudioFiredB = false;
  // Separate cooldowns so a wall bounce can't suppress an immediate ball-to-ball bounce
  private ballBounceCooldown = -Infinity;
  private wallBounceCooldown = -Infinity;

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

    const nA = config.teamA.weapon.attacks.length;
    const nB = config.teamB.weapon.attacks.length;
    this.lastHitTimesA  = new Array(nA).fill(0);
    this.lastHitTimesB  = new Array(nB).fill(0);
    this.burstCountsA   = new Array(nA).fill(0);
    this.burstCountsB   = new Array(nB).fill(0);
    this.lastBulletTimesA = new Array(nA).fill(0);
    this.lastBulletTimesB = new Array(nB).fill(0);

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

    // Sprites must be loaded before buildCaptureBg() draws the top panel.
    loadAllSprites();

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
        audio: { codec: 'aac', sampleRate: 44100, numberOfChannels: 1 },
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

        // Ball-to-ball bounce audio (cooldown prevents rapid-collision spam)
        if (this.simTime - this.ballBounceCooldown >= 120) {
          const intensity = Math.min(1, impulse / 8);
          this.audioEvents.push({ timeMs: this.simTime, type: 'bounce', intensity });
          this.ballBounceCooldown = this.simTime;
        }
      }

      // Wall-bounce ability trigger + audio
      for (const pair of event.pairs) {
        const isWall = (b: Matter.Body) => b.label === 'wall';
        const isBallA = (b: Matter.Body) => b.id === this.bodyA.id;
        const isBallB = (b: Matter.Body) => b.id === this.bodyB.id;
        if ((isWall(pair.bodyA) && isBallA(pair.bodyB)) || (isWall(pair.bodyB) && isBallA(pair.bodyA))) {
          this.applyBallAbility(this.teamA.ball.ability, 'A', 'onBounce', { x: this.bodyA.position.x, y: this.bodyA.position.y });
          if (this.simTime - this.wallBounceCooldown >= 120) {
            this.audioEvents.push({ timeMs: this.simTime, type: 'bounce', intensity: 0.4 });
            this.wallBounceCooldown = this.simTime;
          }
        } else if ((isWall(pair.bodyA) && isBallB(pair.bodyB)) || (isWall(pair.bodyB) && isBallB(pair.bodyA))) {
          this.applyBallAbility(this.teamB.ball.ability, 'B', 'onBounce', { x: this.bodyB.position.x, y: this.bodyB.position.y });
          if (this.simTime - this.wallBounceCooldown >= 120) {
            this.audioEvents.push({ timeMs: this.simTime, type: 'bounce', intensity: 0.4 });
            this.wallBounceCooldown = this.simTime;
          }
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

    // Record the frame count before the fight starts — used to offset audio event timestamps.
    const preFightFrames = frameIdx;

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

    // 1-second freeze on the KO moment — repeat the last rendered frame, no physics tick.
    for (let v = 0; v < this.fps; v++) {
      this.encodeFrame(frameIdx);
      frameIdx++;
    }

    Events.off(this.engine, 'collisionStart', handleCollision);

    // ── Fight → Result transition flash ──────────────────────────────────
    frameIdx = this.encodeWhiteFlash(frameIdx);

    // ── Phase 3: Result card ──────────────────────────────────────────────
    frameIdx = await this.encodeResultPhase(frameIdx, onProgress);

    onProgress(1.0);

    Engine.clear(this.engine);
    World.clear(this.engine.world, false);

    // ── Audio synthesis & encoding ────────────────────────────────────────
    if (this.muxer && typeof AudioEncoder !== 'undefined' && typeof AudioData !== 'undefined') {
      try {
        const preFightMs = (preFightFrames / this.fps) * 1000;
        const totalDurationMs = (frameIdx / this.fps) * 1000;
        // Offset fight-relative timestamps by the pre-fight intro+flash duration
        const audioEvents: AudioEvent[] = this.audioEvents.map((ev) => ({
          ...ev,
          timeMs: preFightMs + ev.timeMs,
        }));
        // Add KO event at the moment the match ended
        const koMs = this.koSimTime >= 0 ? this.koSimTime : this.simTime;
        audioEvents.push({ timeMs: preFightMs + koMs, type: 'ko', intensity: 1.0 });
        const pcm = synthesizeFightAudio(audioEvents, totalDurationMs);
        await this.encodeAudio(pcm, 44100);
      } catch (err) {
        console.warn('GameSimulator: audio synthesis failed', err);
      }
    }

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

    const berserkSpinA = isAbilityBerserk(this.teamA.ball.ability, this.hp.A / this.maxHp.A) ? 3.5 : 1.0;
    const berserkSpinB = isAbilityBerserk(this.teamB.ball.ability, this.hp.B / this.maxHp.B) ? 3.5 : 1.0;
    Body.setAngularVelocity(this.bodyA, this.teamA.ball.spinSpeed * 0.05 * berserkSpinA * Math.sign(this.bodyA.velocity.x || 1));
    Body.setAngularVelocity(this.bodyB, this.teamB.ball.spinSpeed * 0.05 * berserkSpinB * Math.sign(this.bodyB.velocity.x || 1));

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
        const angle = team === 'A' ? this.orbitAngleA : this.orbitAngleB;
        const hitboxR = getWeaponHitboxRadius(teamData.weapon);
        const pos = getOrbitPosition(body.position.x, body.position.y, teamData.ball.radius, angle, hitboxR);
        tx = pos.x; ty = pos.y;
        tr = hitboxR * Number(p.tickTrailRadiusFrac ?? 0.45);
      } else {
        tx = body.position.x; ty = body.position.y;
        tr = teamData.ball.radius * Number(p.tickTrailRadiusFrac ?? 0.5);
      }
      this.trailSegments.push({
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
    const ATTRACT_THRESHOLD = 200;
    if (adist > ATTRACT_THRESHOLD) {
      const k = 0.000004;
      const excess = adist - ATTRACT_THRESHOLD;
      const fx = (adx / adist) * k * excess;
      const fy = (ady / adist) * k * excess;
      Body.applyForce(this.bodyA, this.bodyA.position, { x: fx, y: fy });
      Body.applyForce(this.bodyB, this.bodyB.position, { x: -fx, y: -fy });
    }

    // Step trail segments in-place (avoids 2 array allocations per frame)
    for (let i = this.trailSegments.length - 1; i >= 0; i--) {
      const s = this.trailSegments[i];
      s.ttl -= 1;
      s.alpha *= s.ttl / s.maxTtl;
      if (s.ttl <= 0) this.trailSegments.splice(i, 1);
    }

    this.particles = stepParticles(this.particles);
    this.floaters = stepFloaters(this.floaters);

    const aKO = this.hp.A <= 0;
    const bKO = this.hp.B <= 0;
    if (aKO && bKO) { this.matchEnded = true; this.winner = 'draw'; }
    else if (bKO) { this.matchEnded = true; this.winner = 'A'; }
    else if (aKO) { this.matchEnded = true; this.winner = 'B'; }
    if (this.matchEnded && this.koSimTime === -1) this.koSimTime = this.simTime;

    this.simTime += delta;
  }

  private isBerserk(team: 'A' | 'B'): boolean {
    const t = team === 'A' ? this.teamA : this.teamB;
    return isAbilityBerserk(t.ball.ability, this.hp[team] / this.maxHp[team]);
  }

  private updateWeaponOrbit(delta: number): void {
    const dt = delta / 1000;
    const { teamA, teamB, bodyA, bodyB } = this;
    const berserkMult = 2.5;

    const anyAimA = teamA.weapon.attacks.some(a => a.aimAtEnemy);
    const anyAimB = teamB.weapon.attacks.some(a => a.aimAtEnemy);

    if (anyAimA) {
      this.orbitAngleA = Math.atan2(bodyB.position.y - bodyA.position.y, bodyB.position.x - bodyA.position.x);
    } else {
      this.orbitAngleA += orbitSpeed(teamA.weapon) * (this.isBerserk('A') ? berserkMult : 1) * dt;
    }
    if (anyAimB) {
      this.orbitAngleB = Math.atan2(bodyA.position.y - bodyB.position.y, bodyA.position.x - bodyB.position.x);
    } else {
      this.orbitAngleB -= orbitSpeed(teamB.weapon) * (this.isBerserk('B') ? berserkMult : 1) * dt;
    }

    const hitboxA = getWeaponHitboxRadius(teamA.weapon);
    const hitboxB = getWeaponHitboxRadius(teamB.weapon);

    // Charge display: use the same effective cooldown the firing condition uses,
    // so 100% / "ready" appears on exactly the same frame the laser fires.
    const laserA = teamA.weapon.attacks.filter(a => a.aimAtEnemy).sort((a, b) => b.cooldown - a.cooldown)[0];
    if (laserA) {
      const idx = teamA.weapon.attacks.indexOf(laserA);
      const cd = Math.max(WEAPON_HIT_COOLDOWN_MIN, laserA.cooldown * 1000);
      const effectiveCd = cd + (laserA.hitscan ? HITSCAN_PREFIRE_MS : 0);
      this.chargeA = Math.min(100, ((this.simTime - this.lastHitTimesA[idx]) / effectiveCd) * 100);
    }
    const laserB = teamB.weapon.attacks.filter(a => a.aimAtEnemy).sort((a, b) => b.cooldown - a.cooldown)[0];
    if (laserB) {
      const idx = teamB.weapon.attacks.indexOf(laserB);
      const cd = Math.max(WEAPON_HIT_COOLDOWN_MIN, laserB.cooldown * 1000);
      const effectiveCd = cd + (laserB.hitscan ? HITSCAN_PREFIRE_MS : 0);
      this.chargeB = Math.min(100, ((this.simTime - this.lastHitTimesB[idx]) / effectiveCd) * 100);
    }

    // Age existing effects BEFORE processAttacks so newly created effects
    // are always drawn at progress=0 (full brightness) on their first frame.
    for (const e of this.weaponEffects) e.progress += 1;
    this.weaponEffects = this.weaponEffects.filter((e) => e.progress < e.maxProgress);

    if (this.hp.A > 0 && this.hp.B > 0) {
      this.processAttacks('A', teamA.weapon, bodyA, bodyB, teamB.ball.radius, hitboxA);
    }
    if (this.hp.A > 0 && this.hp.B > 0) {
      this.processAttacks('B', teamB.weapon, bodyB, bodyA, teamA.ball.radius, hitboxB);
    }
  }

  private processAttacks(
    team: 'A' | 'B',
    weapon: WeaponStats,
    attacker: Matter.Body,
    defender: Matter.Body,
    defenderRadius: number,
    hitboxR: number,
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
          // Instant hitscan: charge reaches 100% at cd, then fires after a short hold so
          // "ready" is visible for several frames before the beam appears.
          if (this.simTime - hitTimes[i] >= cd + HITSCAN_PREFIRE_MS) {
            hitTimes[i] = this.simTime - HITSCAN_PREFIRE_MS;
            this.applyHit(weapon, attack, attacker, defender, team);
          }
        } else if (attack.bulletInterval) {
          // Burst mode: trigger burst on cooldown, then fire one bullet per interval
          if (burstCounts[i] === 0 && this.simTime - hitTimes[i] >= cd) {
            hitTimes[i] = this.simTime;
            burstCounts[i] = attack.bulletCount ?? 1;
            bulletTimes[i] = this.simTime - cd;
          }
          if (burstCounts[i] > 0 && this.simTime - bulletTimes[i] >= attack.bulletInterval * 1000) {
            bulletTimes[i] = this.simTime;
            const bulletIdx = (attack.bulletCount ?? 1) - burstCounts[i];
            this.spawnBullet(team, weapon, attack, hitboxR, bulletIdx);
            burstCounts[i]--;
          }
        } else {
          // Volley mode: fire all bullets at once when cooldown elapses
          if (this.simTime - hitTimes[i] >= cd) {
            hitTimes[i] = this.simTime;
            const count = attack.bulletCount ?? 1;
            for (let j = 0; j < count; j++) {
              this.spawnBullet(team, weapon, attack, hitboxR, j);
            }
          }
        }
      } else {
        // Orbit melee: check hitbox collision
        const pos = getOrbitPosition(attacker.position.x, attacker.position.y,
          (team === 'A' ? this.teamA : this.teamB).ball.radius, orbitAngle, hitboxR);
        const dist = Math.hypot(pos.x - defender.position.x, pos.y - defender.position.y);
        if (dist < hitboxR + defenderRadius && this.simTime - hitTimes[i] >= cd) {
          hitTimes[i] = this.simTime;
          this.applyHit(weapon, attack, attacker, defender, team);
        }
      }
    }
  }

  private spawnBullet(
    team: 'A' | 'B',
    weapon: WeaponStats,
    attack: AttackConfig,
    hitboxR: number,
    bulletIdx = 0,
  ): void {
    const body = team === 'A' ? this.bodyA : this.bodyB;
    const opponent = team === 'A' ? this.bodyB : this.bodyA;
    const angle = team === 'A' ? this.orbitAngleA : this.orbitAngleB;
    const ballRadius = (team === 'A' ? this.teamA : this.teamB).ball.radius;
    const start = getOrbitPosition(body.position.x, body.position.y, ballRadius, angle, hitboxR);
    const dx = opponent.position.x - start.x;
    const dy = opponent.position.y - start.y;
    const dist = Math.hypot(dx, dy);
    const baseAngle = dist > 0 ? Math.atan2(dy, dx) : 0;
    const speed = (attack.bulletSpeed ?? 2.0) * (2 / 3); // px per ms

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
    });

    // Emit fire sound once per volley (bulletIdx 0 = first bullet of the spread)
    if (bulletIdx === 0) {
      const hitStyle = (team === 'A' ? this.teamA : this.teamB).audioProfile.hitStyle;
      this.audioEvents.push({ timeMs: this.simTime, type: 'bulletFire', hitStyle, intensity: 1.0 });
    }
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
        this.applyHit(weapon, b.attack, attacker, enemy, b.owner);
        this.bullets.splice(i, 1);
      }
    }
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
      const lifesteal = this.statusMgr.getEffects(attackingTeam).find((e) => e.type === 'lifesteal');
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

    const applyTierEffects = (type: string, defTeam: 'A' | 'B', color: string, dmg: number) => {
      const shakeMag = Math.min(8, dmg / 2);
      const shakeTtl = Math.round(Math.min(SCREEN_SHAKE_TTL, dmg * 1.25));
      if (shakeMag >= 0.5) this.screenShake = { magnitude: shakeMag, ttl: shakeTtl };
      if (dmg >= 12 || type === 'aoe') this.slowMotion = SLOW_MOTION_FACTOR;
      const c = color || '#FFFFFF';
      if (type === 'melee') {
        if (defTeam === 'A') this.hitFlashA = { alpha: 0.65, color: c, ttl: 5 };
        else this.hitFlashB = { alpha: 0.65, color: c, ttl: 5 };
      } else if (type === 'projectile') {
        this.screenFlash = { alpha: 0.22, color: c, ttl: 5 };
      } else if (type === 'aoe') {
        this.screenFlash = { alpha: 0.40, color: c, ttl: 7 };
        if (defTeam === 'A') this.hitFlashA = { alpha: 0.75, color: '#FFFFFF', ttl: 6 };
        else this.hitFlashB = { alpha: 0.75, color: '#FFFFFF', ttl: 6 };
      } else if (type === 'shield') {
        if (defTeam === 'A') this.hitFlashA = { alpha: 0.50, color: c, ttl: 4 };
        else this.hitFlashB = { alpha: 0.50, color: c, ttl: 4 };
      }
    };

    switch (attack.type) {
      case 'melee': {
        const { kbMult, dmgMult } = getHitMultipliers(weapon, attack);
        applyKnockback(defender, dir.x, dir.y, attack.knockback * kbMult);
        damage(targetTeam, attack.damage * dmgMult);
        burst(defender.position.x, defender.position.y, weapon.color ?? '#CC6633', 8);
        this.weaponEffects.push(createWeaponEffect(getMeleeEffectLabel(weapon), attacker.position.x, attacker.position.y, hitAngle, weapon.color ?? '#CC6633', 12));
        break;
      }
      case 'shield': {
        applyKnockback(defender, dir.x, dir.y, attack.knockback * 1.8);
        if (attack.damage > 0) damage(targetTeam, Math.max(1, Math.round(attack.damage * 0.2)));
        this.weaponEffects.push(createWeaponEffect('shield', attacker.position.x, attacker.position.y, hitAngle, weapon.color ?? '#AAAAFF', 18, { radius: (attacker.circleRadius ?? 25) + 14 }));
        burst(attacker.position.x, attacker.position.y, weapon.color ?? '#AAAAFF', 6);
        break;
      }
      case 'projectile': {
        const { kbMult, dmgMult } = getHitMultipliers(weapon, attack);
        if (weapon.hitEffect === 'explosion') {
          this.weaponEffects.push(createWeaponEffect('explosion', defender.position.x, defender.position.y, 0, weapon.color ?? '#44AA44', 20, { radius: weapon.hitEffectRadius ?? 70 }));
        } else if (weapon.hitEffect === 'laser' && attack.hitscan) {
          // Full laser beam — only for the hitscan laser attack, not split bullets
          this.weaponEffects.push(createWeaponEffect('laser', attacker.position.x, attacker.position.y, hitAngle, weapon.color ?? '#44AAFF', 22, { x2: defender.position.x, y2: defender.position.y }));
          this.weaponEffects.push(createWeaponEffect('explosion', defender.position.x, defender.position.y, 0, weapon.color ?? '#44AAFF', 18, { radius: 55 }));
          this.screenShake = { magnitude: 8, ttl: 14 };
          this.screenFlash = { alpha: 0.45, color: weapon.color ?? '#4488FF', ttl: 8 };
          if (targetTeam === 'A') this.hitFlashA = { alpha: 0.9, color: '#FFFFFF', ttl: 8 };
          else this.hitFlashB = { alpha: 0.9, color: '#FFFFFF', ttl: 8 };
          this.slowMotion = SLOW_MOTION_FACTOR;
        }
        applyKnockback(defender, dir.x, dir.y, attack.knockback * kbMult);
        damage(targetTeam, attack.damage * dmgMult);
        const burstCount = attack.hitscan ? 22 : 8;
        burst(defender.position.x, defender.position.y, weapon.color ?? '#FFF', burstCount);
        break;
      }
      case 'aoe': {
        applyKnockback(defender, dir.x, dir.y, attack.knockback * 1.5);
        damage(targetTeam, attack.damage);
        this.weaponEffects.push(createWeaponEffect('shockwave', attacker.position.x, attacker.position.y, 0, weapon.color ?? '#FF44FF', 25, { radius: weapon.range * 30 }));
        burst(attacker.position.x, attacker.position.y, weapon.color ?? '#FF44FF', 15);
        break;
      }
      case 'utility': {
        if (weapon.utilityBehavior === 'pull') {
          const pullDir = directionBetween(defender, attacker);
          applyKnockback(defender, pullDir.x, pullDir.y, 80);
          if (attack.damage > 0) damage(targetTeam, attack.damage);
          burst((attacker.position.x + defender.position.x) / 2, (attacker.position.y + defender.position.y) / 2, weapon.color ?? '#44FFAA', 6);
        } else if (weapon.utilityBehavior === 'push-both') {
          applyKnockback(defender, dir.x, dir.y, attack.knockback * 1.3);
          applyKnockback(attacker, -dir.x, -dir.y, attack.knockback * (weapon.selfKnockbackFrac ?? 0.4));
          damage(targetTeam, attack.damage);
          this.weaponEffects.push(createWeaponEffect('explosion', attacker.position.x, attacker.position.y, 0, weapon.color ?? '#FFFF44', 18, { radius: 55 }));
        }
        break;
      }
    }

    applyTierEffects(attack.type, targetTeam, weapon.color ?? '#FFFFFF', lastDmg);

    // Audio: emit hit event scaled by damage (intensity 0–1 where 30 dmg = max)
    if (attack.type !== 'utility') {
      const hitStyle = (attackerTeam === 'A' ? this.teamA : this.teamB).audioProfile.hitStyle;
      if (attack.audioHint === 'laser') {
        // Weapon-defined laser: fire + heavy hit sounds (decoupled from hitStyle)
        this.audioEvents.push({ timeMs: this.simTime, type: 'laserFire', hitStyle, intensity: 1.0 });
        this.audioEvents.push({ timeMs: this.simTime, type: 'laserHit',  hitStyle, intensity: 1.0 });
      } else {
        this.audioEvents.push({
          timeMs: this.simTime,
          type: 'hit',
          hitStyle,
          intensity: Math.min(1, Math.max(0, lastDmg / 30)),
        });
      }
    }

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
      effectsA: this.statusMgr.getEffects('A'),
      effectsB: this.statusMgr.getEffects('B'),
    });

    // 2. Blit current physics frame into the arena region of the capture canvas.
    const cctx = this.captureCtx;
    (cctx as unknown as OffscreenCanvasRenderingContext2D).imageSmoothingEnabled = false;
    cctx.drawImage(this.physicsCanvas as unknown as HTMLCanvasElement, this.arenaX, this.arenaY, this.arenaDrawSize, this.arenaDrawSize);

    // 3. Redraw bottom panel with live ability status.
    drawCaptureBottomPanel(
      cctx,
      this.damageDealt.A, this.damageDealt.B, this.turns,
      this.teamA.ball.color, this.teamB.ball.color,
      this.statusMgr.getEffects('A'), this.statusMgr.getEffects('B'),
      this.teamA.ball.ability, this.teamB.ball.ability,
      this.hp.A / this.maxHp.A, this.hp.B / this.maxHp.B,
      this.chargeA, this.chargeB,
      this.teamA.weapon, this.teamB.weapon,
    );

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

  private async encodeAudio(pcm: Float32Array, sampleRate: number): Promise<void> {
    if (!this.muxer) return;
    const FRAME_SIZE = 1024;
    // Duration in microseconds for one AAC frame at this sample rate
    const frameDurationUs = Math.round(FRAME_SIZE / sampleRate * 1_000_000);

    type AudioChunkEntry = { data: Uint8Array; type: 'key' | 'delta'; timestampUs: number; meta: EncodedAudioChunkMetadata | undefined };
    const chunks: AudioChunkEntry[] = [];

    const audioEncoder = new AudioEncoder({
      output: (chunk, meta) => {
        const data = new Uint8Array(chunk.byteLength);
        chunk.copyTo(data);
        chunks.push({
          data,
          type: chunk.type,
          timestampUs: chunk.timestamp,
          meta: meta ?? undefined,
        });
      },
      error: (e) => console.warn('AudioEncoder error:', e),
    });

    audioEncoder.configure({ codec: 'mp4a.40.2', sampleRate, numberOfChannels: 1, bitrate: 128_000 });

    let frameIdx = 0;
    for (let offset = 0; offset < pcm.length; offset += FRAME_SIZE) {
      const frame = new Float32Array(FRAME_SIZE);
      frame.set(pcm.subarray(offset, Math.min(offset + FRAME_SIZE, pcm.length)));

      const timestampUs = frameIdx * frameDurationUs;
      const audioData = new AudioData({
        format: 'f32-planar',
        sampleRate,
        numberOfFrames: FRAME_SIZE,
        numberOfChannels: 1,
        timestamp: timestampUs,
        data: frame,
      });
      audioEncoder.encode(audioData);
      audioData.close();
      frameIdx++;

      if (frameIdx % 200 === 0) await new Promise<void>((r) => setTimeout(r, 0));
    }

    await audioEncoder.flush();
    audioEncoder.close();

    // Use addAudioChunkRaw with explicit duration to handle encoders that return null duration
    for (const { data, type, timestampUs, meta } of chunks) {
      this.muxer.addAudioChunkRaw(data, type, timestampUs, frameDurationUs, meta);
    }
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

    // Audio: emit ability event for meaningful triggers (not per-tick trail/passive)
    if (trigger !== 'trail' && trigger !== 'passive') {
      const abilityStyle = (team === 'A' ? this.teamA : this.teamB).audioProfile.abilityStyle;
      if (trigger === 'onLowHP') {
        // Fire exactly once when the state is first entered
        const alreadyFired = team === 'A' ? this.onLowHPAudioFiredA : this.onLowHPAudioFiredB;
        if (!alreadyFired) {
          this.audioEvents.push({ timeMs: this.simTime, type: 'ability', abilityStyle, intensity: 1.0 });
          if (team === 'A') this.onLowHPAudioFiredA = true;
          else this.onLowHPAudioFiredB = true;
        }
      } else {
        const cooldown = team === 'A' ? this.abilityAudioCooldownA : this.abilityAudioCooldownB;
        if (this.simTime - cooldown >= 600) {
          this.audioEvents.push({ timeMs: this.simTime, type: 'ability', abilityStyle, intensity: 1.0 });
          if (team === 'A') this.abilityAudioCooldownA = this.simTime;
          else this.abilityAudioCooldownB = this.simTime;
        }
      }
    }

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

    // Second status effect — allows dual-status abilities without a switch case
    if (p.secondStatusEffect) {
      const target2 = (p.secondStatusTarget as string) === 'enemy'
        ? (team === 'A' ? 'B' : 'A') : team;
      this.applyStatusEffect(
        target2,
        p.secondStatusEffect as StatusEffectType,
        Number(p.secondStatusDuration ?? 2000),
        Number(p.secondStatusMagnitude ?? 0.3),
        (p.secondStatusBehavior as StatusEffect['stackBehavior']) ?? 'refresh',
        Number(p.secondStatusMaxStacks ?? 1),
        p.secondStatusColor as string ?? '#FF8800',
        p.secondStatusIcon as string ?? '✨',
      );
    }

    // Trail on trigger — spawned at ball position when ability fires
    if (p.trailOnTrigger) {
      const ballRadius = (team === 'A' ? this.teamA : this.teamB).ball.radius;
      const count = Number(p.trailCount ?? 1);
      const spawnChance = Number(p.trailSpawnChance ?? 1);
      if (Math.random() < spawnChance) {
        for (let i = 0; i < count; i++) {
          const scatter = Number(p.trailScatterFrac ?? 0) * ballRadius;
          this.trailSegments.push({
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

    void opponentBody; void context;
  }
}
