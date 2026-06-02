import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import type { TeamConfig, WinnerType } from '../models/types';
import type { RenderState } from '../rendering/Renderer';
import type { StatusEffect, BallAbility, WeaponStats } from '../models/types';
import { Renderer } from '../rendering/Renderer';
import { drawBackground, drawArenaWalls } from '../rendering/drawBackground';
import { drawCaptureTopPanel, drawCaptureBottomPanel } from '../rendering/drawCaptureOverlay';
import { drawIntroCard, drawResultCard } from '../rendering/drawBattleCard';
import { loadAllSprites } from '../sprites/SpriteRegistry';
import { synthesizeFightAudio, type AudioEvent } from '../audio/fightAudioSynthesizer';
import {
  ARENA_SIZE,
  CAPTURE_CANVAS_WIDTH,
  CAPTURE_CANVAS_HEIGHT,
  CAPTURE_TOP_HEIGHT,
  CAPTURE_ARENA_PAD,
  INTRO_DURATION_S,
  RESULT_DURATION_S,
  WHITE_FLASH_FRAMES,
} from '../constants/gameConstants';

type Ctx2D = OffscreenCanvasRenderingContext2D;

export interface HudData {
  damageDealtA: number;
  damageDealtB: number;
  turns: number;
  effectsA: StatusEffect[];
  effectsB: StatusEffect[];
  abilityA: BallAbility | undefined;
  abilityB: BallAbility | undefined;
  hpFracA: number;
  hpFracB: number;
  chargeA: number;
  chargeB: number;
  weaponA: WeaponStats;
  weaponB: WeaponStats;
  timerFracA: number;
  timerFracB: number;
}

function ctx2d(canvas: OffscreenCanvas): Ctx2D {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to acquire 2D context from OffscreenCanvas');
  return ctx;
}

export class VideoEncoder {
  private physicsCanvas: OffscreenCanvas;
  private captureCanvas: OffscreenCanvas;
  private captureBg!: OffscreenCanvas;
  private captureCtx: Ctx2D;
  readonly renderer: Renderer;

  private readonly arenaDrawSize: number = CAPTURE_CANVAS_WIDTH - CAPTURE_ARENA_PAD * 2;
  private readonly arenaX: number = CAPTURE_ARENA_PAD;
  private readonly arenaY: number = CAPTURE_TOP_HEIGHT + CAPTURE_ARENA_PAD;

  private encoder: globalThis.VideoEncoder | null = null;
  private muxer: Muxer<ArrayBufferTarget> | null = null;
  private target: ArrayBufferTarget | null = null;
  private frameCount = 0;

  readonly fps: number;
  readonly bitrate: number;
  readonly workerMode: boolean;

  constructor(teamA: TeamConfig, teamB: TeamConfig, fps: number, bitrate: number, workerMode: boolean) {
    this.fps = fps;
    this.bitrate = bitrate;
    this.workerMode = workerMode;

    this.physicsCanvas = new OffscreenCanvas(ARENA_SIZE, ARENA_SIZE);
    this.captureCanvas = new OffscreenCanvas(CAPTURE_CANVAS_WIDTH, CAPTURE_CANVAS_HEIGHT);
    this.captureCtx = ctx2d(this.captureCanvas);

    loadAllSprites();

    const physicsStaticBg = this.buildPhysicsStaticBg(teamA, teamB);
    const physicsCtx = ctx2d(this.physicsCanvas);
    this.renderer = new Renderer(physicsCtx, physicsStaticBg);

    this.captureBg = this.buildCaptureBg(teamA, teamB);
    this.captureCtx.drawImage(this.captureBg, 0, 0);
  }

  private buildPhysicsStaticBg(teamA: TeamConfig, teamB: TeamConfig): OffscreenCanvas {
    const bg = new OffscreenCanvas(ARENA_SIZE, ARENA_SIZE);
    const ctx = ctx2d(bg);
    drawBackground(ctx);
    drawArenaWalls(ctx, teamA.ball.color, teamB.ball.color);
    return bg;
  }

  private buildCaptureBg(teamA: TeamConfig, teamB: TeamConfig): OffscreenCanvas {
    const bg = new OffscreenCanvas(CAPTURE_CANVAS_WIDTH, CAPTURE_CANVAS_HEIGHT);
    const ctx = ctx2d(bg);
    drawCaptureTopPanel(ctx, teamA, teamB);

    ctx.fillStyle = '#FFFADE';
    ctx.fillRect(0, CAPTURE_TOP_HEIGHT, CAPTURE_CANVAS_WIDTH, CAPTURE_CANVAS_WIDTH);

    ctx.save();
    ctx.shadowColor = 'rgba(1, 0, 107, 0.18)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 6;
    ctx.fillStyle = '#FEFEFE';
    ctx.fillRect(this.arenaX, this.arenaY, this.arenaDrawSize, this.arenaDrawSize);
    ctx.restore();

    drawCaptureBottomPanel(ctx, 0, 0, 0, teamA.ball.color, teamB.ball.color);
    return bg;
  }

  initEncoder(): void {
    try {
      const target = new ArrayBufferTarget();
      this.target = target;
      this.muxer = new Muxer({
        target,
        video: { codec: 'avc', width: CAPTURE_CANVAS_WIDTH, height: CAPTURE_CANVAS_HEIGHT, frameRate: this.fps },
        audio: { codec: 'aac', sampleRate: 44100, numberOfChannels: 1 },
        fastStart: 'in-memory',
      });
      this.encoder = new globalThis.VideoEncoder({
        output: (chunk, meta) => this.muxer?.addVideoChunk(chunk, meta),
        error: (e) => console.error('VideoEncoder error:', e),
      });
      this.encoder.configure({
        codec: 'avc1.640033',
        width: CAPTURE_CANVAS_WIDTH,
        height: CAPTURE_CANVAS_HEIGHT,
        bitrate: this.bitrate,
        framerate: this.fps,
        hardwareAcceleration: 'prefer-hardware',
      });
    } catch (err) {
      console.error('VideoEncoder: failed to init encoder', err);
    }
  }

  restoreCaptureBg(): void {
    this.captureCtx.drawImage(this.captureBg, 0, 0);
  }

  renderFrame(state: RenderState, hud: HudData): void {
    this.renderer.render(state);

    const cctx = this.captureCtx;
    cctx.imageSmoothingEnabled = false;
    cctx.drawImage(this.physicsCanvas, this.arenaX, this.arenaY, this.arenaDrawSize, this.arenaDrawSize);

    drawCaptureBottomPanel(
      cctx,
      hud.damageDealtA, hud.damageDealtB, hud.turns,
      state.colorA, state.colorB,
      hud.effectsA, hud.effectsB,
      hud.abilityA, hud.abilityB,
      hud.hpFracA, hud.hpFracB,
      hud.chargeA, hud.chargeB,
      hud.weaponA, hud.weaponB,
      hud.timerFracA, hud.timerFracB,
    );
  }

  commitFrame(frameIdx: number): void {
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
      console.warn('VideoEncoder: frame skipped', err);
    }
  }

  get encoderQueueSize(): number {
    return this.encoder?.encodeQueueSize ?? 0;
  }

  async encodeIntroPhase(teamA: TeamConfig, teamB: TeamConfig, baseFrameIdx: number, onProgress: (pct: number) => void): Promise<number> {
    const INTRO_FRAMES = Math.round(this.fps * INTRO_DURATION_S);
    let frameIdx = baseFrameIdx;
    for (let i = 0; i < INTRO_FRAMES; i++) {
      drawIntroCard(this.captureCtx, i / this.fps, teamA, teamB);
      this.commitFrame(frameIdx++);
      const yieldInterval = this.workerMode ? 120 : 60;
      if (i % yieldInterval === 0 || this.encoderQueueSize > 60) {
        onProgress(0.02 * (i / INTRO_FRAMES));
        await new Promise<void>((r) => setTimeout(r, 0));
      }
    }
    return frameIdx;
  }

  async encodeResultPhase(teamA: TeamConfig, teamB: TeamConfig, winner: WinnerType, baseFrameIdx: number, onProgress: (pct: number) => void): Promise<number> {
    const RESULT_FRAMES = Math.round(this.fps * RESULT_DURATION_S);
    let frameIdx = baseFrameIdx;
    for (let i = 0; i < RESULT_FRAMES; i++) {
      drawResultCard(this.captureCtx, i / this.fps, teamA, teamB, winner);
      this.commitFrame(frameIdx++);
      const yieldInterval = this.workerMode ? 120 : 60;
      if (i % yieldInterval === 0 || this.encoderQueueSize > 60) {
        onProgress(0.95 + 0.04 * (i / RESULT_FRAMES));
        await new Promise<void>((r) => setTimeout(r, 0));
      }
    }
    return frameIdx;
  }

  encodeWhiteFlash(baseFrameIdx: number): number {
    let frameIdx = baseFrameIdx;
    for (let i = 0; i < WHITE_FLASH_FRAMES; i++) {
      this.captureCtx.fillStyle = '#ffffff';
      this.captureCtx.fillRect(0, 0, CAPTURE_CANVAS_WIDTH, CAPTURE_CANVAS_HEIGHT);
      this.commitFrame(frameIdx++);
    }
    return frameIdx;
  }

  async encodeAudio(pcm: Float32Array, sampleRate: number): Promise<void> {
    if (!this.muxer) return;
    const FRAME_SIZE = 1024;
    const frameDurationUs = Math.round(FRAME_SIZE / sampleRate * 1_000_000);

    type AudioChunkEntry = { data: Uint8Array; type: 'key' | 'delta'; timestampUs: number; meta: EncodedAudioChunkMetadata | undefined };
    const chunks: AudioChunkEntry[] = [];

    const audioEncoder = new AudioEncoder({
      output: (chunk, meta) => {
        const data = new Uint8Array(chunk.byteLength);
        chunk.copyTo(data);
        chunks.push({ data, type: chunk.type, timestampUs: chunk.timestamp, meta: meta ?? undefined });
      },
      error: (e) => console.warn('AudioEncoder error:', e),
    });

    audioEncoder.configure({ codec: 'mp4a.40.2', sampleRate, numberOfChannels: 1, bitrate: 128_000 });

    let frameIdx = 0;
    for (let offset = 0; offset < pcm.length; offset += FRAME_SIZE) {
      const frame = new Float32Array(FRAME_SIZE);
      frame.set(pcm.subarray(offset, Math.min(offset + FRAME_SIZE, pcm.length)));
      const timestampUs = frameIdx * frameDurationUs;
      const audioData = new AudioData({ format: 'f32-planar', sampleRate, numberOfFrames: FRAME_SIZE, numberOfChannels: 1, timestamp: timestampUs, data: frame });
      audioEncoder.encode(audioData);
      audioData.close();
      frameIdx++;
      if (frameIdx % 200 === 0) await new Promise<void>((r) => setTimeout(r, 0));
    }

    await audioEncoder.flush();
    audioEncoder.close();

    for (const { data, type, timestampUs, meta } of chunks) {
      this.muxer.addAudioChunkRaw(data, type, timestampUs, frameDurationUs, meta);
    }
  }

  async synthesizeAndEncodeAudio(audioEvents: AudioEvent[], koSimTime: number, preFightFrames: number, simDurationMs: number): Promise<void> {
    const preFightMs = Math.round(preFightFrames / this.fps * 1000);
    const totalDurationMs = preFightMs + simDurationMs + Math.round(1000 / this.fps * 2);
    const events = audioEvents.map(e => ({ ...e, timeMs: e.timeMs + preFightMs }));
    const koMs = koSimTime >= 0 ? koSimTime : simDurationMs;
    events.push({ timeMs: preFightMs + koMs, type: 'ko', intensity: 1.0 });
    const pcm = synthesizeFightAudio(events, totalDurationMs);
    await this.encodeAudio(pcm, 44100);
  }

  async finalize(): Promise<Blob> {
    if (!this.encoder || !this.muxer || !this.target) {
      return new Blob([], { type: 'video/mp4' });
    }
    try {
      await this.encoder.flush();
      this.muxer.finalize();
      this.encoder.close();
      return new Blob([this.target.buffer], { type: 'video/mp4' });
    } catch (err) {
      console.error('VideoEncoder: finalize failed', err);
      return new Blob([], { type: 'video/mp4' });
    }
  }
}
