import Matter from 'matter-js';

type MatterPair = Matter.Pair;

/** Return the total normal impulse magnitude for a collision pair. */
export function getCollisionImpulse(pair: MatterPair): number {
  let total = 0;
  const contacts = pair.activeContacts as Array<{ normalImpulse?: number; vertex: { x: number; y: number } }>;
  for (const c of contacts) {
    total += Math.abs(c.normalImpulse ?? 0);
  }
  return total;
}

/** Check if a Matter.Body is one of the two ball bodies (by label). */
export function isBallBody(body: Matter.Body): boolean {
  return body.label === 'ball' || body.label === 'ballA' || body.label === 'ballB';
}

/** Check if a body matches a specific team label ('ballA' | 'ballB'). */
export function isTeamBody(body: Matter.Body, team: 'A' | 'B'): boolean {
  return body.label === `ball${team}`;
}

/** Get the collision contact point midpoint. */
export function getCollisionPoint(pair: MatterPair): { x: number; y: number } {
  const contacts = pair.activeContacts as Array<{ vertex: { x: number; y: number } }>;
  if (contacts.length === 0) {
    return {
      x: (pair.bodyA.position.x + pair.bodyB.position.x) / 2,
      y: (pair.bodyA.position.y + pair.bodyB.position.y) / 2,
    };
  }
  return { x: contacts[0].vertex.x, y: contacts[0].vertex.y };
}
