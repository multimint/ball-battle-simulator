import type { Particle, FloatingDamage, TrailSegment } from '../models/GameState';
import { spawnParticleBurst, stepParticles } from '../rendering/drawParticles';
import { stepFloaters, createFloater } from '../rendering/drawFloaters';
import { MAX_PARTICLES } from '../constants/gameConstants';

export class ParticleController {
  particles: Particle[] = [];
  floaters: FloatingDamage[] = [];
  trailSegments: TrailSegment[] = [];

  step(): void {
    this.particles = stepParticles(this.particles);
    this.floaters  = stepFloaters(this.floaters);

    for (let i = this.trailSegments.length - 1; i >= 0; i--) {
      const s = this.trailSegments[i];
      s.ttl -= 1;
      s.alpha *= s.ttl / s.maxTtl;
      if (s.ttl <= 0) this.trailSegments.splice(i, 1);
    }
  }

  spawnBurst(x: number, y: number, color: string, count: number): void {
    spawnParticleBurst(this.particles, x, y, color, count, MAX_PARTICLES);
  }

  pushFloater(text: string, x: number, y: number, color: string): void {
    this.floaters.push(createFloater(text, x, y, color));
  }

  pushTrail(segment: Omit<TrailSegment, 'maxTtl'> & { maxTtl?: number }): void {
    const maxTtl = segment.maxTtl ?? segment.ttl;
    this.trailSegments.push({ ...segment, maxTtl });
  }
}
