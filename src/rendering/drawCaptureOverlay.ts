import type { TeamConfig, StatusEffect, BallAbility, WeaponStats } from '../models/types';
import {
  CAPTURE_CANVAS_WIDTH,
  CAPTURE_TOP_HEIGHT,
  CAPTURE_CANVAS_HEIGHT,
} from '../constants/gameConstants';
import { COLORS } from '../constants/colors';
import { FONTS, TEXT_STYLES } from '../constants/typography';
import { fitText } from '../utils/canvas';
import { spriteRegistry } from '../sprites/SpriteRegistry';
import type { Ctx2D } from './ctx';

const BG  = COLORS.captureBackground;
const DIM = COLORS.panelTextDark;

function darkenHex(hex: string, factor = 0.75): string {
  const r = Math.round(parseInt(hex.slice(1, 3), 16) * factor);
  const g = Math.round(parseInt(hex.slice(3, 5), 16) * factor);
  const b = Math.round(parseInt(hex.slice(5, 7), 16) * factor);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

import type { StatusRow } from '../models/types';

/** Builds display rows: weapon charge row (central) + ability rows (delegated to ball). */
function getStatusRows(
  ability: BallAbility | undefined,
  weapon: WeaponStats | undefined,
  effects: StatusEffect[],
  hpFrac: number,
  charge: number,
): StatusRow[] {
  const rows: StatusRow[] = [];

  // Weapon charge row — always shown when weapon aims at enemy (weapon concern, not ball concern)
  if (weapon?.attacks.some(a => a.aimAtEnemy)) {
    rows.push(charge >= 100
      ? { label: 'laser', value: 'ready' }
      : { label: 'laser', value: `${Math.floor(charge)}%` });
  }

  // Ability rows — each ball owns its own display logic via getHudRows
  if (ability?.getHudRows) {
    rows.push(...ability.getHudRows(effects, hpFrac));
  }

  if (rows.length === 0) rows.push({ label: '—', value: '' });
  return rows;
}

/** Top panel: cream background, team sprite + name + VS. */
export function drawCaptureTopPanel(
  ctx: Ctx2D,
  teamA: TeamConfig,
  teamB: TeamConfig,
): void {
  const W          = CAPTURE_CANVAS_WIDTH;
  const H          = CAPTURE_TOP_HEIGHT;
  const halfW      = W / 2;
  const quarterW   = W / 4;
  const pad        = 56;
  const spriteSize = 48;
  const spriteGap  = 16;
  const maxNameW   = halfW - pad * 2 - spriteSize - spriteGap;
  const textY      = H - 38;

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  ctx.textBaseline = 'middle';

  function drawTeamLabel(team: TeamConfig, cx: number): void {
    ctx.font = TEXT_STYLES.teamNameLarge;
    const label = fitText(ctx, team.name.toUpperCase(), maxNameW, TEXT_STYLES.teamNameLarge);
    const nameW  = ctx.measureText(label).width;
    const groupW = spriteSize + spriteGap + nameW;
    const startX = cx - groupW / 2;

    const img = spriteRegistry()[team.ball.icon ?? 'ball'];
    if (img) {
      ctx.drawImage(img, startX, textY - spriteSize / 2, spriteSize, spriteSize);
    } else {
      console.warn(`[drawCaptureTopPanel] sprite not loaded: ${team.ball.icon ?? 'ball'}`);
    }

    ctx.fillStyle = darkenHex(team.ball.color);
    ctx.textAlign = 'left';
    ctx.fillText(label, startX + spriteSize + spriteGap, textY);
  }

  drawTeamLabel(teamA, quarterW);

  ctx.font      = TEXT_STYLES.vsLabel;
  ctx.fillStyle = DIM;
  ctx.textAlign = 'center';
  ctx.fillText('VS', halfW, textY);

  drawTeamLabel(teamB, halfW + quarterW);
}

/** Bottom panel: always-visible ability status strip, tight below the arena. */
export function drawCaptureBottomPanel(
  ctx: Ctx2D,
  _damageA: number,
  _damageB: number,
  _turns: number,
  colorA: string,
  colorB: string,
  effectsA: StatusEffect[] = [],
  effectsB: StatusEffect[] = [],
  abilityA?: BallAbility,
  abilityB?: BallAbility,
  hpFracA = 1,
  hpFracB = 1,
  chargeA = 0,
  chargeB = 0,
  weaponA?: WeaponStats,
  weaponB?: WeaponStats,
): void {
  const W      = CAPTURE_CANVAS_WIDTH;
  const panelY = CAPTURE_TOP_HEIGHT + CAPTURE_CANVAS_WIDTH;
  const panelH = CAPTURE_CANVAS_HEIGHT - panelY;

  ctx.fillStyle = BG;
  ctx.fillRect(0, panelY, W, panelH);

  const halfW  = W / 2;
  const stripY = panelY + 36;
  const stripH = 180;

  const rowsA = getStatusRows(abilityA, weaponA, effectsA, hpFracA, chargeA);
  const rowsB = getStatusRows(abilityB, weaponB, effectsB, hpFracB, chargeB);

  drawTeamStrip(ctx, rowsA, colorA, 0,     halfW, stripY, stripH);
  drawTeamStrip(ctx, rowsB, colorB, halfW, halfW, stripY, stripH);
}

function drawTeamStrip(
  ctx: Ctx2D,
  rows: StatusRow[],
  color: string,
  x: number,
  w: number,
  y: number,
  h: number,
): void {
  ctx.save();

  const centerY = y + h / 2;
  const dotR    = 16;
  const gap     = 20;
  const rowGap  = 36; // px between rows when stacked

  // Measure widest row to anchor dot position
  let maxTextW = 0;
  for (const row of rows) {
    ctx.font = TEXT_STYLES.abilityLabel;
    const lw = ctx.measureText(`${row.label}:`).width;
    ctx.font = TEXT_STYLES.abilityValue;
    const vw = ctx.measureText(row.value).width;
    maxTextW = Math.max(maxTextW, lw + gap + vw);
  }

  const totalW   = dotR * 2 + gap + maxTextW;
  const contentX = x + (w - totalW) / 2;
  const dotX     = contentX + dotR;

  // Dot — centered vertically across all rows
  ctx.beginPath();
  ctx.arc(dotX, centerY, dotR, 0, Math.PI * 2);
  ctx.fillStyle   = color;
  ctx.fill();
  ctx.strokeStyle = COLORS.panelDotBorder;
  ctx.lineWidth   = 2;
  ctx.stroke();

  const labelX    = dotX + dotR + gap;
  const totalRowH = (rows.length - 1) * rowGap;
  const firstRowY = centerY - totalRowH / 2;

  rows.forEach((row, i) => {
    const rowY = firstRowY + i * rowGap;

    ctx.font         = TEXT_STYLES.abilityLabel;
    ctx.fillStyle    = COLORS.panelTextDim;
    ctx.textBaseline = 'middle';
    ctx.textAlign    = 'left';
    const lw = ctx.measureText(`${row.label}:`).width;
    ctx.fillText(`${row.label}:`, labelX, rowY);

    ctx.font      = TEXT_STYLES.abilityValue;
    ctx.fillStyle = darkenHex(color, 0.60);
    ctx.fillText(row.value, labelX + lw + gap, rowY);
  });

  ctx.restore();
}

// Re-export FONTS so callers that previously used the local RETRO constant don't need a separate import
export { FONTS };
