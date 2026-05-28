import Matter from 'matter-js';
import type { BallStats } from '../models/types';

const { Body, Vector } = Matter;

/** Apply a knockback force to a body toward a direction (normalized vector). */
export function applyKnockback(
  body: Matter.Body,
  directionX: number,
  directionY: number,
  strength: number
): void {
  const mag = Math.hypot(directionX, directionY) || 1;
  Body.applyForce(body, body.position, {
    x: (directionX / mag) * strength * 0.0001,
    y: (directionY / mag) * strength * 0.0001,
  });
}

/** Clamp a body's velocity to maxSpeed × clampFactor. */
export function clampVelocity(body: Matter.Body, maxSpeed: number, clampFactor = 1.2): void {
  const speed = Vector.magnitude(body.velocity);
  const limit = maxSpeed * clampFactor;
  if (speed > limit) {
    Body.setVelocity(body, {
      x: (body.velocity.x / speed) * limit,
      y: (body.velocity.y / speed) * limit,
    });
  }
}

/** Apply a small random nudge to unstick a body. */
export function nudgeBody(body: Matter.Body, strength = 0.005): void {
  const angle = Math.random() * Math.PI * 2;
  Body.applyForce(body, body.position, {
    x: Math.cos(angle) * strength,
    y: Math.sin(angle) * strength,
  });
}

/** Get the unit vector from bodyA toward bodyB. */
export function directionBetween(
  from: Matter.Body,
  to: Matter.Body
): { x: number; y: number } {
  const dx = to.position.x - from.position.x;
  const dy = to.position.y - from.position.y;
  const mag = Math.hypot(dx, dy) || 1;
  return { x: dx / mag, y: dy / mag };
}

/** Distance between two bodies' centers. */
export function distanceBetween(a: Matter.Body, b: Matter.Body): number {
  return Math.hypot(b.position.x - a.position.x, b.position.y - a.position.y);
}

/** Build Matter.js body options from BallStats. */
export function bodyOptionsFromBall(ball: BallStats): Matter.IBodyDefinition {
  return {
    restitution: ball.restitution,
    friction: ball.friction,
    // frictionAir: 0 → no air drag; balls keep their speed between bounces.
    // Any speed loss comes only from ball–ball collisions (governed by restitution).
    frictionAir: 0,
    frictionStatic: 0,
    density: ball.mass / (Math.PI * ball.radius * ball.radius),
    label: 'ball',
  };
}

/** Give a body an initial velocity aimed roughly at the arena center. */
export function setInitialVelocity(
  body: Matter.Body,
  ball: BallStats,
  towardX: number,
  towardY: number
): void {
  const dx = towardX - body.position.x;
  const dy = towardY - body.position.y;
  const mag = Math.hypot(dx, dy) || 1;
  const spd = ball.maxSpeed * 0.6;
  Body.setVelocity(body, {
    x: (dx / mag) * spd,
    y: (dy / mag) * spd,
  });
}
