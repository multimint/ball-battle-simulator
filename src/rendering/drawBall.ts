import type { BallStats } from '../models/types';

export function drawBall(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  ball: BallStats,
  hp: number,
  maxHp: number,
  _teamLabel: string   // kept in signature so callers don't need updating
): void {
  const r = ball.radius;
  const hpFraction = Math.max(0, hp / maxHp);

  ctx.save();
  ctx.translate(x, y);

  // ── Drop shadow ────────────────────────────────────────────────────────
  ctx.shadowColor = 'rgba(0,0,0,0.28)';
  ctx.shadowBlur  = 10;
  ctx.shadowOffsetY = 3;

  // ── Ball body ─────────────────────────────────────────────────────────
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);

  // Tint body toward red as HP drops
  ctx.fillStyle = ball.color;
  ctx.fill();

  // Low-HP red overlay
  if (hpFraction < 0.35) {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(220,30,30,${(0.35 - hpFraction) * 1.2})`;
    ctx.fill();
  }

  // Sheen / highlight
  const shine = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.05, 0, 0, r);
  shine.addColorStop(0,   'rgba(255,255,255,0.45)');
  shine.addColorStop(0.5, 'rgba(255,255,255,0.08)');
  shine.addColorStop(1,   'rgba(0,0,0,0.12)');
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = shine;
  ctx.fill();

  ctx.shadowColor   = 'transparent';
  ctx.shadowBlur    = 0;
  ctx.shadowOffsetY = 0;

  // ── Outer stroke ──────────────────────────────────────────────────────
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(1,0,107,0.25)';
  ctx.lineWidth   = 1.5;
  ctx.stroke();

  // ── HP number inside ball ─────────────────────────────────────────────
  const displayHp = Math.max(0, Math.ceil(hp));
  const fontSize  = Math.max(7, r * 0.42);   // scales with ball size

  // Faint dark circle behind text for legibility
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.52, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fill();

  ctx.font         = `bold ${fontSize}px "Press Start 2P", monospace`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';

  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.fillText(String(displayHp), 0, 0);

  ctx.restore();
}
