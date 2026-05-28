import type { TeamConfig } from '../models/types';
import {
  CAPTURE_CANVAS_WIDTH,
  CAPTURE_TOP_HEIGHT,
  CAPTURE_CANVAS_HEIGHT,
} from '../constants/gameConstants';

const BG = '#FFFADE';
const TEXT = '#01006B';
const DIM = 'rgba(1, 0, 107, 0.4)';
const RETRO = '"Press Start 2P", monospace';

function truncate(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 0 && ctx.measureText(t + '…').width > maxWidth) {
    t = t.slice(0, -1);
  }
  return t + '…';
}

/** Top panel: compact fighter row + weapon subtitle. */
export function drawCaptureTopPanel(
  ctx: CanvasRenderingContext2D,
  teamA: TeamConfig,
  teamB: TeamConfig,
): void {
  const W = CAPTURE_CANVAS_WIDTH;
  const H = CAPTURE_TOP_HEIGHT;

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  const pad = 42;
  const iconSize = 78;
  const nameRowY = 222;
  const weapRowY = 318;
  const halfW = W / 2;
  const maxNameW = halfW - pad - iconSize - 21 - 72;

  // ── Name row ─────────────────────────────────────────────────────────

  // Team A: icon then name (left-aligned)
  ctx.font = `${iconSize}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = TEXT;
  ctx.fillText(teamA.ball.icon ?? '⚽', pad, nameRowY);

  ctx.font = `30px ${RETRO}`;
  ctx.fillStyle = teamA.ball.color;
  ctx.textAlign = 'left';
  ctx.fillText(truncate(ctx, teamA.name, maxNameW), pad + iconSize + 18, nameRowY);

  // VS center
  ctx.font = `24px ${RETRO}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = DIM;
  ctx.fillText('VS', halfW, nameRowY);

  // Team B: name then icon (right-aligned)
  ctx.font = `30px ${RETRO}`;
  ctx.fillStyle = teamB.ball.color;
  ctx.textAlign = 'right';
  ctx.fillText(truncate(ctx, teamB.name, maxNameW), W - pad - iconSize - 18, nameRowY);

  ctx.font = `${iconSize}px sans-serif`;
  ctx.textAlign = 'right';
  ctx.fillStyle = TEXT;
  ctx.fillText(teamB.ball.icon ?? '⚽', W - pad, nameRowY);

  // ── Weapon subtitle row ───────────────────────────────────────────────

  ctx.font = `18px ${RETRO}`;
  ctx.textBaseline = 'middle';

  ctx.textAlign = 'left';
  ctx.fillStyle = teamA.ball.color;
  ctx.globalAlpha = 0.65;
  ctx.fillText(truncate(ctx, teamA.weapon.name, halfW - pad - 24), pad, weapRowY);

  ctx.textAlign = 'right';
  ctx.fillStyle = teamB.ball.color;
  ctx.fillText(truncate(ctx, teamB.weapon.name, halfW - pad - 24), W - pad, weapRowY);

  ctx.globalAlpha = 1;
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
