import type { FloatingDamage } from '../models/GameState';
import { FLOATER_RISE_SPEED, FLOATER_FADE_SPEED } from '../constants/gameConstants';

export function drawFloaters(ctx: CanvasRenderingContext2D, floaters: FloatingDamage[]): void {
  for (const f of floaters) {
    ctx.save();
    ctx.globalAlpha = f.alpha;
    ctx.font = '15px "Press Start 2P", monospace';
    ctx.fillStyle = f.color;
    ctx.strokeStyle = 'rgba(0,0,0,0.6)';
    ctx.lineWidth = 4;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeText(f.text, f.x, f.y);
    ctx.fillText(f.text, f.x, f.y);
    ctx.restore();
  }
}

export function stepFloaters(floaters: FloatingDamage[]): FloatingDamage[] {
  const alive: FloatingDamage[] = [];
  for (const f of floaters) {
    f.y -= FLOATER_RISE_SPEED;
    f.alpha -= FLOATER_FADE_SPEED;
    if (f.alpha > 0) alive.push(f);
  }
  return alive;
}

let floaterId = 0;
export function createFloater(
  text: string,
  x: number,
  y: number,
  color: string
): FloatingDamage {
  return {
    id: String(floaterId++),
    text,
    x,
    y,
    alpha: 1.0,
    color,
  };
}
