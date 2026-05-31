import { BALL_SPRITE_PAINTERS } from '../balls/index';

export type SpritePainter = (
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
) => void;

// System sprites — not tied to a specific ball.
// Ball sprites come from src/balls/index.ts via BALL_SPRITE_PAINTERS.
const SYSTEM_PAINTERS = {

  burst(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D) {
    const pts = [12,0.5, 14.2,8.5, 22,5.5, 17,12.5, 23.5,15, 16,16.5, 20,23, 12,18.5, 4,23, 8,16.5, 0.5,15, 7,12.5, 2,5.5, 9.8,8.5];
    ctx.fillStyle = '#E74C3C';
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
    ctx.fill();
  },

  trophy(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D) {
    ctx.fillStyle = '#F7C430';
    ctx.beginPath();
    ctx.moveTo(7, 3); ctx.lineTo(17, 3); ctx.lineTo(17, 12);
    ctx.bezierCurveTo(17, 16, 12, 18, 12, 18);
    ctx.bezierCurveTo(12, 18, 7, 16, 7, 12);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#F7C430';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(7, 5); ctx.bezierCurveTo(4.5, 5, 4.5, 9, 7, 9); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(17, 5); ctx.bezierCurveTo(19.5, 5, 19.5, 9, 17, 9); ctx.stroke();
    ctx.fillRect(11, 18, 2, 3);
    ctx.fillRect(8, 21, 8, 2);
  },

  scales(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D) {
    ctx.fillStyle = '#90A4AE';
    ctx.strokeStyle = '#90A4AE';
    ctx.fillRect(11, 3, 2, 12);
    ctx.fillRect(3, 7, 18, 2);
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(5.5, 9); ctx.lineTo(5.5, 13); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(5.5, 13); ctx.lineTo(2.5, 13); ctx.lineTo(2.5, 16); ctx.lineTo(8.5, 16); ctx.lineTo(8.5, 13); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(18.5, 9); ctx.lineTo(18.5, 13); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(18.5, 13); ctx.lineTo(15.5, 13); ctx.lineTo(15.5, 16); ctx.lineTo(21.5, 16); ctx.lineTo(21.5, 13); ctx.closePath(); ctx.fill();
    ctx.fillRect(9, 16, 6, 2);
  },

  'dot-green'(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D) {
    ctx.fillStyle = '#4CAF50';
    ctx.beginPath(); ctx.arc(12, 12, 8, 0, Math.PI * 2); ctx.fill();
  },

  'dot-yellow'(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D) {
    ctx.fillStyle = '#FFC107';
    ctx.beginPath(); ctx.arc(12, 12, 8, 0, Math.PI * 2); ctx.fill();
  },

  'dot-red'(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D) {
    ctx.fillStyle = '#F44336';
    ctx.beginPath(); ctx.arc(12, 12, 8, 0, Math.PI * 2); ctx.fill();
  },

  ball(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D) {
    ctx.fillStyle = '#ECEFF1';
    ctx.beginPath(); ctx.arc(12, 12, 9, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#B0BEC5';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(5, 9); ctx.quadraticCurveTo(12, 7, 19, 9); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(4, 13); ctx.quadraticCurveTo(12, 11, 20, 13); ctx.stroke();
  },

} satisfies Record<string, SpritePainter>;

// Merged map — SpriteKey is derived from its keys in SpriteKey.ts.
export const SPRITE_PAINTERS = {
  ...BALL_SPRITE_PAINTERS,
  ...SYSTEM_PAINTERS,
} satisfies Record<string, SpritePainter>;
