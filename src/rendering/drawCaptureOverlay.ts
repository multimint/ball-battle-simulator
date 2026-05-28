import type { TeamConfig } from '../models/types';
import {
  CAPTURE_CANVAS_WIDTH,
  CAPTURE_TOP_HEIGHT,
  CAPTURE_CANVAS_HEIGHT,
} from '../constants/gameConstants';

const BG   = '#FFFADE';
const DIM  = 'rgba(1, 0, 107, 0.70)';
const RETRO = '"Press Start 2P", monospace';

function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 0 && ctx.measureText(t + '…').width > maxWidth) {
    t = t.slice(0, -1);
  }
  return t + '…';
}

function darkenHex(hex: string, factor = 0.75): string {
  const r = Math.round(parseInt(hex.slice(1, 3), 16) * factor);
  const g = Math.round(parseInt(hex.slice(3, 5), 16) * factor);
  const b = Math.round(parseInt(hex.slice(5, 7), 16) * factor);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/** Top panel: cream background, team names + VS only. */
export function drawCaptureTopPanel(
  ctx: CanvasRenderingContext2D,
  teamA: TeamConfig,
  teamB: TeamConfig,
): void {
  const W = CAPTURE_CANVAS_WIDTH;
  const H = CAPTURE_TOP_HEIGHT;
  const halfW  = W / 2;
  const quarterW = W / 4;
  const pad = 56;
  const maxNameW = halfW - pad * 2;
  const textY = H - 38;

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  // Team A name
  ctx.font = `48px ${RETRO}`;
  ctx.fillStyle = darkenHex(teamA.ball.color);
  ctx.fillText(truncate(ctx, teamA.name, maxNameW), quarterW, textY);

  // VS
  ctx.font = `28px ${RETRO}`;
  ctx.fillStyle = DIM;
  ctx.fillText('VS', halfW, textY);

  // Team B name
  ctx.font = `48px ${RETRO}`;
  ctx.fillStyle = darkenHex(teamB.ball.color);
  ctx.fillText(truncate(ctx, teamB.name, maxNameW), halfW + quarterW, textY);

}

/** Bottom panel: plain background, no text. */
export function drawCaptureBottomPanel(
  ctx: CanvasRenderingContext2D,
  _damageA: number,
  _damageB: number,
  _turns: number,
  _colorA: string,
  _colorB: string,
): void {
  const W = CAPTURE_CANVAS_WIDTH;
  const arenaH = CAPTURE_CANVAS_WIDTH;
  const panelY = CAPTURE_TOP_HEIGHT + arenaH;
  const panelH = CAPTURE_CANVAS_HEIGHT - panelY;

  ctx.fillStyle = BG;
  ctx.fillRect(0, panelY, W, panelH);
}
