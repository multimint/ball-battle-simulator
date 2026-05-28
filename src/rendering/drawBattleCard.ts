import type { TeamConfig, WinnerType } from '../models/types';
import { CAPTURE_CANVAS_WIDTH, CAPTURE_CANVAS_HEIGHT } from '../constants/gameConstants';

type Ctx2D = CanvasRenderingContext2D;

const RETRO = '"Press Start 2P", monospace';

// Smooth acceleration + deceleration — used for all panel slides
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// Smooth deceleration, no bounce — used for badge pop-in
function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

// Smooth in + out — used for the winner expansion
function easeInOutQuart(t: number): number {
  return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;
}

function fitText(ctx: Ctx2D, text: string, maxWidth: number, font: string): string {
  ctx.font = font;
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxWidth) {
    t = t.slice(0, -1);
  }
  return t + '…';
}

function drawTeamPanel(
  ctx: Ctx2D,
  team: TeamConfig,
  panelY: number,
  panelW: number,
  panelH: number,
  dimForLoss: boolean,
  winnerLabelAlpha = 0,
): void {
  const cx = panelW / 2;
  const cy = panelY + panelH / 2;

  ctx.fillStyle = team.ball.color;
  ctx.fillRect(0, panelY, panelW, panelH);

  ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
  ctx.fillRect(0, panelY, panelW, panelH);

  if (dimForLoss) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
    ctx.fillRect(0, panelY, panelW, panelH);
  }

  const textW = panelW - 120;

  ctx.font = '200px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(team.ball.icon ?? '⚽', cx, cy - 160);

  const nameFont = `bold 72px ${RETRO}`;
  ctx.font = nameFont;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(fitText(ctx, team.name.toUpperCase(), textW, nameFont), cx, cy + 50);

  const weapFont = `32px ${RETRO}`;
  ctx.font = weapFont;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.68)';
  ctx.textAlign = 'center';
  ctx.fillText(fitText(ctx, team.weapon.name, textW, weapFont), cx, cy + 165);

  if (winnerLabelAlpha > 0) {
    ctx.save();
    ctx.globalAlpha = winnerLabelAlpha;
    ctx.font = `bold 52px ${RETRO}`;
    ctx.fillStyle = '#ffd700';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🏆  WINNER!', cx, cy + 310);
    ctx.restore();
  }
}

/**
 * Badge (VS, trophy, draw icon) drawn at an explicit canvas Y position.
 * This lets the badge ride on the divider as it moves during expansion.
 */
function drawCentreBadge(
  ctx: Ctx2D,
  scale: number,
  label: string,
  subLabel: string,
  subColor: string,
  cy: number,
): void {
  ctx.save();
  ctx.translate(CAPTURE_CANVAS_WIDTH / 2, cy);
  ctx.scale(scale, scale);

  ctx.fillStyle = '#0a0a14';
  ctx.beginPath();
  ctx.arc(0, 0, 108, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
  ctx.lineWidth = 6;
  ctx.stroke();

  ctx.font = '80px sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 0, -14);

  if (subLabel) {
    ctx.font = `bold 24px ${RETRO}`;
    ctx.fillStyle = subColor;
    ctx.fillText(subLabel, 0, 72);
  }

  ctx.restore();
}

/**
 * Pre-fight intro card — Team A top, Team B bottom.
 * t: 0..INTRO_DURATION_S
 */
export function drawIntroCard(
  ctx: Ctx2D,
  t: number,
  teamA: TeamConfig,
  teamB: TeamConfig,
): void {
  const W = CAPTURE_CANVAS_WIDTH;
  const H = CAPTURE_CANVAS_HEIGHT;
  const halfH = H / 2;

  // 0–0.6 s slide in, 0.6–0.8 s VS badge pops
  const slideT  = easeInOutCubic(Math.min(t / 0.6, 1));
  const vsScale = easeOutQuart(Math.max(0, Math.min((t - 0.6) / 0.2, 1)));

  ctx.fillStyle = '#0a0a14';
  ctx.fillRect(0, 0, W, H);

  drawTeamPanel(ctx, teamA, (slideT - 1) * halfH,          W, halfH, false);
  drawTeamPanel(ctx, teamB, halfH + (1 - slideT) * halfH,  W, halfH, false);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.fillRect(0, halfH - 2, W, 4);

  if (vsScale > 0.01) {
    drawCentreBadge(ctx, vsScale, 'VS', '', '#ffffff', halfH);
  }
}

/**
 * Post-fight result card.
 *
 * Winner case — four phases:
 *   0.0 – 0.6 s  both panels slide in from edges  (easeInOutCubic)
 *   0.6 – 0.8 s  trophy badge pops in at divider   (easeOutQuart)
 *   0.8 – 1.4 s  winner grows, loser exits, badge rides divider away  (easeInOutQuart)
 *   1.4 s+       full-screen winner, WINNER! label fades in
 *
 * Draw case — split-screen stays for full duration with DRAW badge.
 *
 * t: 0..RESULT_DURATION_S
 */
export function drawResultCard(
  ctx: Ctx2D,
  t: number,
  teamA: TeamConfig,
  teamB: TeamConfig,
  winner: WinnerType,
): void {
  const W = CAPTURE_CANVAS_WIDTH;
  const H = CAPTURE_CANVAS_HEIGHT;
  const halfH = H / 2;

  const slideT    = easeInOutCubic(Math.min(t / 0.6, 1));
  const badgeScale = easeOutQuart(Math.max(0, Math.min((t - 0.6) / 0.2, 1)));

  // ── Draw ─────────────────────────────────────────────────────────────────
  if (winner === 'draw') {
    ctx.fillStyle = '#0a0a14';
    ctx.fillRect(0, 0, W, H);
    drawTeamPanel(ctx, teamA, (slideT - 1) * halfH,         W, halfH, false);
    drawTeamPanel(ctx, teamB, halfH + (1 - slideT) * halfH, W, halfH, false);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillRect(0, halfH - 2, W, 4);
    if (badgeScale > 0.01) {
      drawCentreBadge(ctx, badgeScale, '🤝', 'DRAW', '#cccccc', halfH);
    }
    return;
  }

  // ── Winner expansion ──────────────────────────────────────────────────────
  const expandT       = easeInOutQuart(Math.max(0, Math.min((t - 0.8) / 0.6, 1)));
  const winnerTextAlpha = Math.max(0, Math.min(1, (expandT - 0.8) / 0.2));

  const aWins      = winner === 'A';
  const winnerTeam = aWins ? teamA : teamB;
  const loserTeam  = aWins ? teamB : teamA;

  // ── Panel Y positions ─────────────────────────────────────────────────────
  // Slide-in: panels approach from opposite edges, never overlap.
  // Expansion: winner grows toward opposite edge; loser is pushed out in its own direction.

  // Loser: slides in → exits out its own edge as expansion progresses
  const loserSlideY  = aWins ? halfH + (1 - slideT) * halfH : (slideT - 1) * halfH;
  const loserExpandY = aWins ? halfH + expandT * halfH       : -expandT * halfH;
  const loserPanelY  = slideT < 1 ? loserSlideY : loserExpandY;

  // Winner: slides in → expands to full screen
  const winnerSlideY  = aWins ? (slideT - 1) * halfH               : halfH + (1 - slideT) * halfH;
  const winnerExpandY = aWins ? 0                                   : halfH * (1 - expandT);
  const winnerPanelY  = slideT < 1 ? winnerSlideY : winnerExpandY;
  const winnerPanelH  = slideT < 1 ? halfH        : halfH * (1 + expandT);

  // ── Divider Y — sits at the meeting edge of both panels ──────────────────
  // aWins: winner bottom = 0 + winnerPanelH = halfH*(1+expandT)  →  moves down
  // bWins: winner top    = halfH*(1-expandT)                       →  moves up
  // Badge travels from halfH down to H+120 so it fully exits the frame (badge radius = 108 px)
  const dividerY = slideT < 1
    ? halfH
    : halfH + expandT * (halfH + 120);

  // ── Draw ─────────────────────────────────────────────────────────────────
  ctx.fillStyle = '#0a0a14';
  ctx.fillRect(0, 0, W, H);

  // Loser exits behind/under the winner panel
  drawTeamPanel(ctx, loserTeam,  loserPanelY,  W, halfH,       true);
  // Winner drawn on top — expands from its half to full canvas
  drawTeamPanel(ctx, winnerTeam, winnerPanelY, W, winnerPanelH, false, winnerTextAlpha);

  // Divider rides with the loser edge and exits the canvas naturally
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.fillRect(0, dividerY - 2, W, 4);

  // Badge rides the divider — no fade needed, it simply exits with the loser
  if (badgeScale > 0.01) {
    drawCentreBadge(ctx, badgeScale, '🏆', 'WINNER', '#ffd700', dividerY);
  }
}
