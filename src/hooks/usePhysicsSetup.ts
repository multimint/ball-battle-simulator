import { useRef, useEffect } from 'react';
import Matter from 'matter-js';
import {
  ARENA_SIZE,
  WALL_THICKNESS,
  BALL_A_START,
  BALL_B_START,
  PHYSICS_SPEED_SCALE,
  INITIAL_SPEED_MIN_FRAC,
  INITIAL_SPEED_MAX_FRAC,
} from '../constants/gameConstants';
import { bodyOptionsFromBall } from '../utils/physics';
import type { BallStats } from '../models/types';

const { Engine, World, Bodies, Composite, Body } = Matter;

export interface PhysicsRefs {
  engineRef: React.MutableRefObject<Matter.Engine | null>;
  bodyA: React.MutableRefObject<Matter.Body | null>;
  bodyB: React.MutableRefObject<Matter.Body | null>;
}

/**
 * Return a random speed within [minFrac, maxFrac] of (maxSpeed × scale).
 * The tight range keeps all fighters feeling similar in pace.
 */
function randomSpeed(maxSpeed: number): number {
  const scaled = maxSpeed * PHYSICS_SPEED_SCALE;
  const frac = INITIAL_SPEED_MIN_FRAC + Math.random() * (INITIAL_SPEED_MAX_FRAC - INITIAL_SPEED_MIN_FRAC);
  return scaled * frac;
}

/**
 * Return a fully random unit direction vector.
 * No bias toward the opponent — pure physics from here.
 */
function randomDirection(): { x: number; y: number } {
  const angle = Math.random() * Math.PI * 2;
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

export function usePhysicsSetup(ballA: BallStats, ballB: BallStats): PhysicsRefs {
  const engineRef = useRef<Matter.Engine | null>(null);
  const bodyA = useRef<Matter.Body | null>(null);
  const bodyB = useRef<Matter.Body | null>(null);

  useEffect(() => {
    // ── Engine (top-down: zero gravity) ──────────────────────────────────
    const engine = Engine.create({ gravity: { x: 0, y: 0 } });
    engineRef.current = engine;

    // ── Boundary Walls ────────────────────────────────────────────────────
    // restitution: 1.0 → perfectly elastic bounce; balls keep their speed after a wall hit.
    const wallOpts: Matter.IBodyDefinition = {
      isStatic: true,
      restitution: 1.0,   // no energy lost on wall bounce
      friction: 0,
      frictionStatic: 0,
      label: 'wall',
    };
    const half = WALL_THICKNESS / 2;
    const walls = [
      Bodies.rectangle(ARENA_SIZE / 2, -half,               ARENA_SIZE + WALL_THICKNESS * 2, WALL_THICKNESS, wallOpts),
      Bodies.rectangle(ARENA_SIZE / 2,  ARENA_SIZE + half,  ARENA_SIZE + WALL_THICKNESS * 2, WALL_THICKNESS, wallOpts),
      Bodies.rectangle(-half,            ARENA_SIZE / 2,    WALL_THICKNESS, ARENA_SIZE + WALL_THICKNESS * 2, wallOpts),
      Bodies.rectangle(ARENA_SIZE + half, ARENA_SIZE / 2,   WALL_THICKNESS, ARENA_SIZE + WALL_THICKNESS * 2, wallOpts),
    ];

    // ── Ball Bodies ───────────────────────────────────────────────────────
    const bA = Bodies.circle(BALL_A_START.x, BALL_A_START.y, ballA.radius, {
      ...bodyOptionsFromBall(ballA),
      label: 'ballA',
    });
    const bB = Bodies.circle(BALL_B_START.x, BALL_B_START.y, ballB.radius, {
      ...bodyOptionsFromBall(ballB),
      label: 'ballB',
    });

    bodyA.current = bA;
    bodyB.current = bB;

    Composite.add(engine.world, [...walls, bA, bB]);

    // ── Random initial velocity ───────────────────────────────────────────
    // Each ball gets a fully random direction and a speed within a tight band.
    // After this point, movement is 100 % physics — no steering.
    const dirA = randomDirection();
    const spdA = randomSpeed(ballA.maxSpeed);
    Body.setVelocity(bA, { x: dirA.x * spdA, y: dirA.y * spdA });

    const dirB = randomDirection();
    const spdB = randomSpeed(ballB.maxSpeed);
    Body.setVelocity(bB, { x: dirB.x * spdB, y: dirB.y * spdB });

    return () => {
      Engine.clear(engine);
      World.clear(engine.world, false);
      engineRef.current = null;
      bodyA.current = null;
      bodyB.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Intentionally runs once on mount

  return { engineRef, bodyA, bodyB };
}
