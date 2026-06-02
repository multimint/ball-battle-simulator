import Matter from 'matter-js';
import type { TeamConfig } from '../models/types';
import { SimulationCore } from './SimulationCore';
import { VideoEncoder } from './VideoEncoder';
import { PHYSICS_STEP_MS } from '../constants/gameConstants';
import type { InitialVelocities, SimulationResult } from '../store/useGameStore';

const { Engine, World } = Matter;

interface GameSimulatorConfig {
  teamA: TeamConfig;
  teamB: TeamConfig;
  initialVelocities: InitialVelocities;
  fps?: number;
  bitrate?: number;
  workerMode?: boolean;
}

export class GameSimulator extends SimulationCore {
  private video: VideoEncoder;
  private initialVelocities: InitialVelocities;

  constructor(config: GameSimulatorConfig) {
    super(config.teamA, config.teamB, config.initialVelocities);
    this.initialVelocities = config.initialVelocities;
    this.video = new VideoEncoder(
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

    const deregister = this.registerCollisionHandler();

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
    const PHYSICS_STEP = PHYSICS_STEP_MS;
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

    deregister();

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
}
