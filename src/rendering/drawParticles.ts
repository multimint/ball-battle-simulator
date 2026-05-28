import type { Particle } from '../models/GameState';

export function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]): void {
  for (const p of particles) {
    const alpha = p.life / p.maxLife;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius * alpha, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.fill();
    ctx.restore();
  }
}

export function stepParticles(particles: Particle[]): Particle[] {
  const alive: Particle[] = [];
  for (const p of particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.05; // slight gravity for visual interest
    p.vx *= 0.97;
    p.life -= 1;
    if (p.life > 0) alive.push(p);
  }
  return alive;
}

export function spawnParticleBurst(
  particles: Particle[],
  x: number,
  y: number,
  color: string,
  count: number,
  maxParticles: number
): void {
  const available = maxParticles - particles.length;
  const toSpawn = Math.min(count, available);
  for (let i = 0; i < toSpawn; i++) {
    const angle = (Math.PI * 2 * i) / toSpawn + Math.random() * 0.5;
    const speed = 1.5 + Math.random() * 3;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 20 + Math.floor(Math.random() * 20),
      maxLife: 40,
      radius: 2 + Math.random() * 3,
      color,
    });
  }
}
