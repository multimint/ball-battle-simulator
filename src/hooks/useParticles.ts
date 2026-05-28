import { useRef } from 'react';
import type { Particle } from '../models/GameState';
import { MAX_PARTICLES, PARTICLE_BURST_COUNT } from '../constants/gameConstants';
import { spawnParticleBurst, stepParticles } from '../rendering/drawParticles';

export interface ParticleSystem {
  particles: React.MutableRefObject<Particle[]>;
  spawnBurst: (x: number, y: number, color: string, count?: number) => void;
  step: () => void;
}

export function useParticles(): ParticleSystem {
  const particles = useRef<Particle[]>([]);

  function spawnBurst(x: number, y: number, color: string, count = PARTICLE_BURST_COUNT): void {
    spawnParticleBurst(particles.current, x, y, color, count, MAX_PARTICLES);
  }

  function step(): void {
    particles.current = stepParticles(particles.current);
  }

  return { particles, spawnBurst, step };
}
