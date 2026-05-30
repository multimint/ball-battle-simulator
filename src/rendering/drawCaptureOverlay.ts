import type { TeamConfig, StatusEffect, BallAbility, WeaponStats } from '../models/types';
import {
  CAPTURE_CANVAS_WIDTH,
  CAPTURE_TOP_HEIGHT,
  CAPTURE_CANVAS_HEIGHT,
} from '../constants/gameConstants';
import { COLORS } from '../constants/colors';
import { FONTS, TEXT_STYLES } from '../constants/typography';
import { fitText } from '../utils/canvas';

const BG  = COLORS.captureBackground;
const DIM = COLORS.panelTextDark;

function darkenHex(hex: string, factor = 0.75): string {
  const r = Math.round(parseInt(hex.slice(1, 3), 16) * factor);
  const g = Math.round(parseInt(hex.slice(3, 5), 16) * factor);
  const b = Math.round(parseInt(hex.slice(5, 7), 16) * factor);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/** Derives a { label, value } display pair from ability + live state. */
function getAbilityStatus(
  ability: BallAbility | undefined,
  weapon: WeaponStats | undefined,
  effects: StatusEffect[],
  hpFrac: number,
  charge: number,
): { label: string; value: string } {
  if (!ability) {
    if (weapon?.attacks.some(a => a.aimAtEnemy)) {
      if (charge >= 100) return { label: 'laser', value: 'ready' };
      return { label: 'laser', value: `${Math.floor(charge)}%` };
    }
    return { label: '—', value: '' };
  }

  switch (ability.trigger) {
    case 'onHitDealt': {
      const boost  = effects.find(e => e.type === 'speedBoost');
      const stacks = boost?.stacks ?? 0;
      const mult   = 1 + stacks * Number(ability.params?.statusMagnitude ?? 0.3);
      return { label: 'faster', value: `×${mult.toFixed(1)}` };
    }
    case 'onLowHP': {
      const threshold = Number(ability.params?.threshold ?? 0.3);
      const active    = hpFrac < threshold;
      return { label: 'berserk', value: active ? 'on' : 'off' };
    }
    default:
      return { label: '—', value: '' };
  }
}

/** Top panel: cream background, team names + VS only. */
export function drawCaptureTopPanel(
  ctx: CanvasRenderingContext2D,
  teamA: TeamConfig,
  teamB: TeamConfig,
): void {
  const W        = CAPTURE_CANVAS_WIDTH;
  const H        = CAPTURE_TOP_HEIGHT;
  const halfW    = W / 2;
  const quarterW = W / 4;
  const pad      = 56;
  const maxNameW = halfW - pad * 2;
  const textY    = H - 38;

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  ctx.textBaseline = 'middle';
  ctx.textAlign    = 'center';

  ctx.font      = TEXT_STYLES.teamNameLarge;
  ctx.fillStyle = darkenHex(teamA.ball.color);
  ctx.fillText(fitText(ctx, teamA.name.toUpperCase(), maxNameW, TEXT_STYLES.teamNameLarge), quarterW, textY);

  ctx.font      = TEXT_STYLES.vsLabel;
  ctx.fillStyle = DIM;
  ctx.fillText('VS', halfW, textY);

  ctx.font      = TEXT_STYLES.teamNameLarge;
  ctx.fillStyle = darkenHex(teamB.ball.color);
  ctx.fillText(fitText(ctx, teamB.name.toUpperCase(), maxNameW, TEXT_STYLES.teamNameLarge), halfW + quarterW, textY);
}

/** Bottom panel: always-visible ability status strip, tight below the arena. */
export function drawCaptureBottomPanel(
  ctx: CanvasRenderingContext2D,
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

  const statusA = getAbilityStatus(abilityA, weaponA, effectsA, hpFracA, chargeA);
  const statusB = getAbilityStatus(abilityB, weaponB, effectsB, hpFracB, chargeB);

  drawTeamStrip(ctx, statusA, colorA, 0,     halfW, stripY, stripH);
  drawTeamStrip(ctx, statusB, colorB, halfW, halfW, stripY, stripH);
}

function drawTeamStrip(
  ctx: CanvasRenderingContext2D,
  status: { label: string; value: string },
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

  ctx.font = TEXT_STYLES.abilityLabel;
  const labelW = ctx.measureText(`${status.label}:`).width;
  ctx.font = TEXT_STYLES.abilityValue;
  const valueW = ctx.measureText(status.value).width;

  const totalW   = dotR * 2 + gap + labelW + gap + valueW;
  const contentX = x + (w - totalW) / 2;

  const dotX = contentX + dotR;
  ctx.beginPath();
  ctx.arc(dotX, centerY, dotR, 0, Math.PI * 2);
  ctx.fillStyle   = color;
  ctx.fill();
  ctx.strokeStyle = COLORS.panelDotBorder;
  ctx.lineWidth   = 2;
  ctx.stroke();

  const labelX = dotX + dotR + gap;
  ctx.font         = TEXT_STYLES.abilityLabel;
  ctx.fillStyle    = COLORS.panelTextDim;
  ctx.textBaseline = 'middle';
  ctx.textAlign    = 'left';
  ctx.fillText(`${status.label}:`, labelX, centerY - 2);

  const valueX = labelX + labelW + gap;
  ctx.font      = TEXT_STYLES.abilityValue;
  ctx.fillStyle = darkenHex(color, 0.60);
  ctx.fillText(status.value, valueX, centerY - 2);

  ctx.restore();
}

// Re-export FONTS so callers that previously used the local RETRO constant don't need a separate import
export { FONTS };
