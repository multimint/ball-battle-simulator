import Matter from 'matter-js';
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import type { TeamConfig, WeaponStats, WinnerType } from '../models/types';
import type { Particle, WeaponEffect, FloatingDamage, ScreenShake } from '../models/GameState';
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
  STALEMATE_TIME_MS,
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
  private weaponEffects: WeaponEffect[] = [];
  private screenShake: ScreenShake = { magnitude: 0, ttl: 0 };
  private slowMotion = 1.0;

  private stuckA: StuckState = { lastX: 0, lastY: 0, stuckFrames: 0 };
  private stuckB: StuckState = { lastX: 0, lastY: 0, stuckFrames: 0 };

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
  private workerMode: boolean;

  private teamA: TeamConfig;
  private teamB: TeamConfig;
  private initialVelocities: InitialVelocities;

  constructor(config: GameSimulatorConfig) {
    this.teamA = config.teamA;
    this.teamB = config.teamB;
    this.initialVelocities = config.initialVelocities;
    this.fps = config.fps ?? 60;
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
        bitrate: 20_000_000,           // 20 Mbps for 1080p60 HD quality
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
    };
    Events.on(this.engine, 'collisionStart', handleCollision);

    // ── Phase 1: Intro card ───────────────────────────────────────────────
    let frameIdx = await this.encodeIntroPhase(0, onProgress);

    // ── Intro → Fight transition flash ───────────────────────────────────
    frameIdx = this.encodeWhiteFlash(frameIdx);

    // Restore the static fight-view background before encoding fight frames.
    this.captureCtx.drawImage(this.captureBg as unknown as HTMLCanvasElement, 0, 0);

    // ── Phase 2: Fight simulation ─────────────────────────────────────────
    const STEP = 1000 / this.fps;

    while (!this.matchEnded && this.simTime < STALEMATE_TIME_MS) {
      this.tick(STEP);
      this.encodeFrame(frameIdx);
      frameIdx++;

      // Yield periodically to drain encoder output callbacks and (on main thread) keep UI responsive.
      // In worker mode fewer yields are needed since the UI thread is never blocked.
      const yieldInterval = this.workerMode ? 120 : 60;
      if (frameIdx % yieldInterval === 0 || (this.encoder?.encodeQueueSize ?? 0) > 60) {
        onProgress(0.05 + 0.88 * Math.min(this.simTime / STALEMATE_TIME_MS, 1));
        await new Promise<void>((r) => setTimeout(r, 0));
      }
    }

    if (!this.matchEnded) {
      this.winner = this.hp.A > this.hp.B ? 'A' : this.hp.B > this.hp.A ? 'B' : 'draw';
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

    Engine.update(this.engine, scaledDelta);

    clampVelocity(this.bodyA, this.teamA.ball.maxSpeed, VELOCITY_CLAMP);
    clampVelocity(this.bodyB, this.teamB.ball.maxSpeed, VELOCITY_CLAMP);

    enforceMinSpeed(this.bodyA, this.teamA.ball.maxSpeed);
    enforceMinSpeed(this.bodyB, this.teamB.ball.maxSpeed);

    Body.setAngularVelocity(this.bodyA, this.teamA.ball.spinSpeed * 0.05 * Math.sign(this.bodyA.velocity.x || 1));
    Body.setAngularVelocity(this.bodyB, this.teamB.ball.spinSpeed * 0.05 * Math.sign(this.bodyB.velocity.x || -1));

    this.updateStuck(this.stuckA, this.bodyA);
    this.updateStuck(this.stuckB, this.bodyB);

    this.updateWeaponOrbit(scaledDelta);

    this.particles = stepParticles(this.particles);
    this.floaters = stepFloaters(this.floaters);

    const aKO = this.hp.A <= 0;
    const bKO = this.hp.B <= 0;
    if (aKO && bKO) { this.matchEnded = true; this.winner = 'draw'; }
    else if (bKO) { this.matchEnded = true; this.winner = 'A'; }
    else if (aKO) { this.matchEnded = true; this.winner = 'B'; }

    this.simTime += delta;
  }

  private updateWeaponOrbit(delta: number): void {
    const dt = delta / 1000;
    const { teamA, teamB, bodyA, bodyB } = this;

    this.orbitAngleA += orbitSpeed(teamA.weapon) * dt;
    this.orbitAngleB -= orbitSpeed(teamB.weapon) * dt;

    const hitboxA = getWeaponHitboxRadius(teamA.weapon);
    const hitboxB = getWeaponHitboxRadius(teamB.weapon);
    const posA = getOrbitPosition(bodyA.position.x, bodyA.position.y, teamA.ball.radius, this.orbitAngleA, hitboxA);
    const posB = getOrbitPosition(bodyB.position.x, bodyB.position.y, teamB.ball.radius, this.orbitAngleB, hitboxB);

    if (this.hp.A > 0 && this.hp.B > 0) {
      const distAtoB = Math.hypot(posA.x - bodyB.position.x, posA.y - bodyB.position.y);
      if (distAtoB < hitboxA + teamB.ball.radius) {
        const cooldown = Math.max(WEAPON_HIT_COOLDOWN_MIN, teamA.weapon.cooldown * 1000);
        if (this.simTime - this.lastHitA >= cooldown) {
          this.lastHitA = this.simTime;
          this.applyHit(teamA.weapon, bodyA, bodyB, 'A');
        }
      }
    }

    if (this.hp.A > 0 && this.hp.B > 0) {
      const distBtoA = Math.hypot(posB.x - bodyA.position.x, posB.y - bodyA.position.y);
      if (distBtoA < hitboxB + teamA.ball.radius) {
        const cooldown = Math.max(WEAPON_HIT_COOLDOWN_MIN, teamB.weapon.cooldown * 1000);
        if (this.simTime - this.lastHitB >= cooldown) {
          this.lastHitB = this.simTime;
          this.applyHit(teamB.weapon, bodyB, bodyA, 'B');
        }
      }
    }

    for (const e of this.weaponEffects) e.progress += 1;
    this.weaponEffects = this.weaponEffects.filter((e) => e.progress < e.maxProgress);
  }

  private applyHit(weapon: WeaponStats, attacker: Matter.Body, defender: Matter.Body, attackerTeam: 'A' | 'B'): void {
    const targetTeam: 'A' | 'B' = attackerTeam === 'A' ? 'B' : 'A';
    const dir = directionBetween(attacker, defender);
    const hitAngle = Math.atan2(dir.y, dir.x);

    const damage = (team: 'A' | 'B', amount: number) => {
      const rounded = Math.round(amount);
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
    };

    const burst = (x: number, y: number, color: string, count: number) => {
      spawnParticleBurst(this.particles, x, y, color, count, MAX_PARTICLES);
    };

    const heavyHit = (mag: number) => {
      this.slowMotion = SLOW_MOTION_FACTOR;
      this.screenShake = { magnitude: mag, ttl: SCREEN_SHAKE_TTL };
    };

    switch (weapon.category) {
      case 'melee': {
        let kbMult = 1.0, dmgMult = 1.0, heavyShake = 0;
        if (weapon.name === 'Heavy Hammer') { kbMult = 1.6; dmgMult = 1.2; heavyShake = 6; }
        else if (weapon.name === 'Long Spear') { kbMult = 0.9; }
        else if (weapon.name === 'Chain Flail') { kbMult = 0.7; dmgMult = 0.8; }
        applyKnockback(defender, dir.x, dir.y, weapon.knockback * kbMult);
        damage(targetTeam, weapon.damage * dmgMult);
        burst(defender.position.x, defender.position.y, weapon.color ?? '#CC6633', 8);
        if (heavyShake > 0) heavyHit(heavyShake);
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
          heavyHit(5);
        } else if (weapon.name === 'Power Cannon') {
          dmgMult = 1.1; kbMult = 1.5;
          heavyHit(4);
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
        heavyHit(5);
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
          heavyHit(4);
        }
        break;
      }
    }
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
      colorA: this.teamA.ball.color,
      colorB: this.teamB.ball.color,
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
}
