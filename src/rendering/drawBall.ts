import type { HitFlash } from '../models/GameState';
import type { BallAbility, BallStats, StatusEffect } from '../models/types';

export function drawBall(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  ball: BallStats,
  hp: number,
  maxHp: number,
  _teamLabel: string,
  effects?: StatusEffect[],
  ability?: BallAbility,
  hitFlash?: HitFlash,
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

  // onLowHP rage aura (drawn before sheen so aura glows behind the highlight)
  if (ability?.trigger === 'onLowHP' && hpFraction < Number(ability.params.threshold ?? 0.3)) {
    ctx.save();
    ctx.shadowColor = ability.params.statusColor as string ?? '#FF4400';
    ctx.shadowBlur = 20;
    ctx.strokeStyle = ability.params.statusColor as string ?? '#FF4400';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, r + 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
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

  // Hit flash overlay — drawn after sheen so it sits on top of all ball layers
  if (hitFlash && hitFlash.ttl > 0 && hitFlash.alpha > 0.01) {
    ctx.save();
    ctx.globalAlpha = hitFlash.alpha;
    ctx.fillStyle = hitFlash.color;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ── Outer stroke ──────────────────────────────────────────────────────
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(1,0,107,0.25)';
  ctx.lineWidth   = 1.5;
  ctx.stroke();

  // ── Status effect rings ───────────────────────────────────────────────
  if (effects && effects.length > 0) {
    const segAngle = (Math.PI * 2) / effects.length;
    effects.forEach((effect, i) => {
      const startAngle = i * segAngle - Math.PI / 2;
      const alpha = Math.min(1, effect.remainingMs / 500); // fade out last 500ms
      ctx.save();
      ctx.shadowColor = effect.color;
      ctx.shadowBlur = 8;
      ctx.strokeStyle = effect.color;
      ctx.globalAlpha = alpha;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, r + 5, startAngle, startAngle + segAngle - 0.1);
      ctx.stroke();
      ctx.restore();
    });

    // Draw icons above the ball (one per effect, spaced horizontally)
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.font = `${Math.max(8, r * 0.45)}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    const iconY = -(r + 10);
    const iconSpacing = Math.max(12, r * 0.6);
    const startX = -((effects.length - 1) * iconSpacing) / 2;
    effects.forEach((effect, i) => {
      ctx.fillText(effect.icon, startX + i * iconSpacing, iconY);
    });
    ctx.restore();
  }

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
