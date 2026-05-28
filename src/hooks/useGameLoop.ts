// @ts-nocheck — file retained for reference; no longer used by App.tsx
import { useEffect, useRef } from 'react';
import Matter from 'matter-js';
import type { BallStats, WeaponStats } from '../models/types';
import type { ScreenShake, StuckState } from '../models/GameState';
import { gameBus } from '../models/EventBus';
import { Renderer } from '../rendering/Renderer';
import { drawCaptureTopPanel, drawCaptureBottomPanel } from '../rendering/drawCaptureOverlay';
import { CAPTURE_TOP_HEIGHT, CAPTURE_CANVAS_WIDTH, CAPTURE_ARENA_PAD } from '../constants/gameConstants';
import { clampVelocity, nudgeBody } from '../utils/physics';
import { getCollisionImpulse, getCollisionPoint } from '../utils/collision';
import { stepFloaters, createFloater } from '../rendering/drawFloaters';
import type { ParticleSystem } from './useParticles';
import type { WeaponSystem } from './useWeaponSystem';
import { useMatchStore } from '../store/useMatchStore';
import { useGameStore } from '../store/useGameStore';
import {
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
} from '../constants/gameConstants';
import type { FloatingDamage } from '../models/GameState';

const { Engine, Events } = Matter;

type CaptureFrameFn = (canvas: HTMLCanvasElement, timestampMs: number) => void;

interface UseGameLoopParams {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  captureCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  captureFrameRef: React.RefObject<CaptureFrameFn | null>;
  engineRef: React.MutableRefObject<Matter.Engine | null>;
  bodyA: React.MutableRefObject<Matter.Body | null>;
  bodyB: React.MutableRefObject<Matter.Body | null>;
  ballA: BallStats;
  ballB: BallStats;
  weaponA: WeaponStats;
  weaponB: WeaponStats;
  particles: ParticleSystem;
  weapons: WeaponSystem;
  onAudioCollision: (intensity: number) => void;
  onAudioKO: () => void;
  onAudioVictory: () => void;
  onAudioWeaponFire: () => void;
}

export function useGameLoop(params: UseGameLoopParams): void {
  const {
    canvasRef, captureCanvasRef, captureFrameRef, engineRef, bodyA, bodyB,
    ballA, ballB, weaponA, weaponB,
    particles, weapons,
    onAudioCollision, onAudioKO, onAudioVictory,
  } = params;

  // Store accessors are called inline via getState() inside the effect to avoid stale closures.

  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const slowMotionRef = useRef<number>(1.0);
  const screenShakeRef = useRef<ScreenShake>({ magnitude: 0, ttl: 0 });
  const floatersRef = useRef<FloatingDamage[]>([]);
  const matchEndedRef = useRef(false);
  const stuckA = useRef<StuckState>({ lastX: 0, lastY: 0, stuckFrames: 0 });
  const stuckB = useRef<StuckState>({ lastX: 0, lastY: 0, stuckFrames: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !engineRef.current || !bodyA.current || !bodyB.current) return;
    // Non-null asserted — guard above guarantees these
    const engine = engineRef.current as Matter.Engine;
    const bA = bodyA.current as Matter.Body;
    const bB = bodyB.current as Matter.Body;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const renderer = new Renderer(ctx);
    matchEndedRef.current = false;
    lastTimeRef.current = performance.now();

    // ── Subscribe to game bus events ─────────────────────────────────────
    const unsubDamage = gameBus.on('damage', ({ team, amount, x, y }) => {
      const rounded = Math.round(amount);
      useMatchStore.getState().applyDamage(team, rounded);
      floatersRef.current.push(
        createFloater(
          `-${rounded}`,
          x + (Math.random() - 0.5) * 20,
          y - 20,
          team === 'A' ? '#E47D79' : '#4A90E2'
        )
      );
    });

    const unsubParticle = gameBus.on('particleBurst', ({ x, y, color, count }) => {
      particles.spawnBurst(x, y, color, count);
    });

    const unsubHeavy = gameBus.on('heavyHit', ({ magnitude }) => {
      slowMotionRef.current = SLOW_MOTION_FACTOR;
      screenShakeRef.current = { magnitude: magnitude || SCREEN_SHAKE_MAGNITUDE, ttl: SCREEN_SHAKE_TTL };
    });

    // ── Direct collision event: physics feedback only (no damage) ────────
    // Damage comes exclusively from orbit weapon hits (useWeaponSystem.updateOrbit).
    const handleCollision = (event: Matter.IEventCollision<Matter.Engine>) => {
      for (const pair of event.pairs) {
        const bodies = [pair.bodyA, pair.bodyB];
        const invA = bodies.some((b) => b.id === bA.id);
        const invB = bodies.some((b) => b.id === bB.id);
        if (!invA || !invB) continue;

        const impulse = getCollisionImpulse(pair);
        const point = getCollisionPoint(pair);

        // Screen shake + slow-motion on heavy hit
        if (impulse > HEAVY_HIT_THRESHOLD) {
          slowMotionRef.current = SLOW_MOTION_FACTOR;
          screenShakeRef.current = { magnitude: SCREEN_SHAKE_MAGNITUDE, ttl: SCREEN_SHAKE_TTL };
          onAudioCollision(Math.min(3, impulse / HEAVY_HIT_THRESHOLD));
        } else {
          onAudioCollision(0.5);
        }

        // Collision spark burst
        particles.spawnBurst(point.x, point.y, ballA.color, 8);
        useMatchStore.getState().incrementTurns();
      }
    };

    Events.on(engine, 'collisionStart', handleCollision);

    // ── Weapon system uses pure orbit math — no Matter.js listeners needed ──

    // ── Main tick function ────────────────────────────────────────────────
    function tick(timestamp: number): void {
      const rawDelta = timestamp - lastTimeRef.current;
      lastTimeRef.current = timestamp;

      // Cap delta to avoid huge jumps on tab switch
      const delta = Math.min(rawDelta, 50) * slowMotionRef.current;

      // Recover slow motion
      if (slowMotionRef.current < 1.0) {
        slowMotionRef.current = Math.min(1.0, slowMotionRef.current + SLOW_MOTION_RECOVERY);
      }

      // Decay screen shake
      if (screenShakeRef.current.ttl > 0) {
        screenShakeRef.current.ttl -= 1;
      }

      // Physics step
      Engine.update(engine, delta);

      // Velocity ceiling
      clampVelocity(bA, ballA.maxSpeed, VELOCITY_CLAMP);
      clampVelocity(bB, ballB.maxSpeed, VELOCITY_CLAMP);

      // Speed floor: if a ball nearly stops after a freak collision, boost it back
      // in whatever direction it was already going (no steering).
      enforceMinSpeed(bA, ballA.maxSpeed);
      enforceMinSpeed(bB, ballB.maxSpeed);

      // Angular velocity: set from ballStats spinSpeed (visual spin indicator only)
      Matter.Body.setAngularVelocity(bA, ballA.spinSpeed * 0.05 * Math.sign(bA.velocity.x || 1));
      Matter.Body.setAngularVelocity(bB, ballB.spinSpeed * 0.05 * Math.sign(bB.velocity.x || -1));

      // Stuck detection
      updateStuck(stuckA, bA);
      updateStuck(stuckB, bB);

      // Get current HP from store
      const { hp: currentHp } = useMatchStore.getState();

      // Orbit weapon system step (advances angles, detects hits, applies effects)
      weapons.updateOrbit(delta, timestamp, bA, bB, ballA, ballB, weaponA, weaponB, currentHp.A, currentHp.B);

      // Particle step
      particles.step();

      // Floater step
      floatersRef.current = stepFloaters(floatersRef.current);

      // Match end check
      if (!matchEndedRef.current) {
        const { hp: liveHp } = useMatchStore.getState();
        const aKO = liveHp.A <= 0;
        const bKO = liveHp.B <= 0;
        const elapsed = timestamp - useMatchStore.getState().matchStartTime;
        const stalemate = elapsed > STALEMATE_TIME_MS;

        if (aKO && bKO) {
          matchEndedRef.current = true;
          useGameStore.getState().endMatch('draw');
          onAudioKO();
        } else if (bKO) {
          matchEndedRef.current = true;
          useGameStore.getState().endMatch('A');
          onAudioKO();
          onAudioVictory();
        } else if (aKO) {
          matchEndedRef.current = true;
          useGameStore.getState().endMatch('B');
          onAudioKO();
          onAudioVictory();
        } else if (stalemate) {
          matchEndedRef.current = true;
          const winner = liveHp.A > liveHp.B ? 'A' : liveHp.B > liveHp.A ? 'B' : 'draw';
          useGameStore.getState().endMatch(winner);
        }
      }

      // Render
      renderer.render({
        bodyA: bA,
        bodyB: bB,
        ballA,
        ballB,
        hpA: useMatchStore.getState().hp.A,
        hpB: useMatchStore.getState().hp.B,
        maxHpA: useMatchStore.getState().maxHp.A,
        maxHpB: useMatchStore.getState().maxHp.B,
        particles: particles.particles.current,
        weaponEffects: weapons.weaponEffects.current,
        floaters: floatersRef.current,
        weaponA,
        weaponB,
        orbitAngleA: weapons.orbitAngleA.current,
        orbitAngleB: weapons.orbitAngleB.current,
        screenShake: screenShakeRef.current,
        colorA: ballA.color,
        colorB: ballB.color,
      });

      // Composite onto the 9:16 capture canvas for display + recording
      const cc = captureCanvasRef.current;
      if (cc) {
        const cctx = cc.getContext('2d');
        if (cctx && canvas) {
          const { teamA, teamB } = useGameStore.getState();
          const { damageDealt, turnsElapsed } = useMatchStore.getState();
          drawCaptureTopPanel(cctx, teamA, teamB);

          // Fill arena section with cream background
          cctx.fillStyle = '#FFFADE';
          cctx.fillRect(0, CAPTURE_TOP_HEIGHT, CAPTURE_CANVAS_WIDTH, CAPTURE_CANVAS_WIDTH);

          // Subtle card shadow behind the fight area
          const arenaDrawSize = CAPTURE_CANVAS_WIDTH - CAPTURE_ARENA_PAD * 2;
          const arenaX = CAPTURE_ARENA_PAD;
          const arenaY = CAPTURE_TOP_HEIGHT + CAPTURE_ARENA_PAD;
          cctx.save();
          cctx.shadowColor = 'rgba(1, 0, 107, 0.18)';
          cctx.shadowBlur = 24;
          cctx.shadowOffsetY = 6;
          cctx.fillStyle = '#FEFEFE';
          cctx.fillRect(arenaX, arenaY, arenaDrawSize, arenaDrawSize);
          cctx.restore();

          // Upscale arena 480×480 → padded area with nearest-neighbor for clean pixel art look
          cctx.imageSmoothingEnabled = false;
          cctx.drawImage(canvas, arenaX, arenaY, arenaDrawSize, arenaDrawSize);
          drawCaptureBottomPanel(
            cctx,
            damageDealt.A, damageDealt.B,
            turnsElapsed,
            teamA.ball.color, teamB.ball.color,
          );

          // Encode this composite frame into the MP4
          captureFrameRef.current?.(cc, timestamp);
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      Events.off(engine, 'collisionStart', handleCollision);
      unsubDamage();
      unsubParticle();
      unsubHeavy();
      gameBus.clear();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Intentionally runs once; all params accessed via closure
}

function updateStuck(state: React.MutableRefObject<StuckState>, body: Matter.Body): void {
  const dx = Math.abs(body.position.x - state.current.lastX);
  const dy = Math.abs(body.position.y - state.current.lastY);
  if (dx < STUCK_MOVEMENT_THRESHOLD && dy < STUCK_MOVEMENT_THRESHOLD) {
    state.current.stuckFrames += 1;
    if (state.current.stuckFrames >= STUCK_FRAMES) {
      nudgeBody(body, 0.008);
      state.current.stuckFrames = 0;
    }
  } else {
    state.current.stuckFrames = 0;
  }
  state.current.lastX = body.position.x;
  state.current.lastY = body.position.y;
}

/**
 * If a ball drops below the minimum expected speed (e.g. after a near-perfect
 * head-on collision), restore it to minSpeed in its current direction.
 * Direction is preserved — this is NOT steering.
 */
function enforceMinSpeed(body: Matter.Body, maxSpeed: number): void {
  const minSpeed = maxSpeed * PHYSICS_SPEED_SCALE * INITIAL_SPEED_MIN_FRAC * 0.6;
  const vx = body.velocity.x;
  const vy = body.velocity.y;
  const speed = Math.hypot(vx, vy);
  if (speed < minSpeed) {
    // Keep current direction; if nearly zero pick a random one
    const mag = speed > 0.01 ? speed : 1;
    const nx = speed > 0.01 ? vx / mag : Math.cos(Math.random() * Math.PI * 2);
    const ny = speed > 0.01 ? vy / mag : Math.sin(Math.random() * Math.PI * 2);
    Matter.Body.setVelocity(body, { x: nx * minSpeed, y: ny * minSpeed });
  }
}
