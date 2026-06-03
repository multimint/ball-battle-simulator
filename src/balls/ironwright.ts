import type { BallDefinition, AudioProfile } from './types';
import type { SpritePainter } from '../sprites/spriteDefinitions';
import { BALL_RADIUS } from './constants';
import type { StatusEffect, StatusRow } from '../models/types';
import { registerWeaponShape } from '../rendering/weaponShapes';

// ── Forge hammer weapon shapes (5 tiers) ─────────────────────────────────────
// Each tier has a genuinely different SHAPE, not just a size change.
// Coordinate system: origin = weapon center, business end at +X, r ≈ 26px.

registerWeaponShape('Forge Hammer 0', (ctx, _color, r) => {
  // Crude Iron: a rough stone lump lashed to a stick — not yet a real hammer.
  // Irregular blob with no glow, very dark.
  ctx.shadowBlur = 0;

  // Stick handle: thin rough line
  ctx.strokeStyle = '#5A4A30';
  ctx.lineWidth = r * 0.14;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-r * 0.72, r * 0.04);
  ctx.lineTo(r * 0.12, -r * 0.02);
  ctx.stroke();

  // Rock head: irregular polygon, rough edges
  ctx.fillStyle = '#6A6A6A';
  ctx.strokeStyle = '#4A4A4A';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(r * 0.14, -r * 0.18);
  ctx.lineTo(r * 0.38, -r * 0.28);
  ctx.lineTo(r * 0.72, -r * 0.24);
  ctx.lineTo(r * 0.88, -r * 0.06);
  ctx.lineTo(r * 0.90,  r * 0.10);
  ctx.lineTo(r * 0.68,  r * 0.30);
  ctx.lineTo(r * 0.32,  r * 0.26);
  ctx.lineTo(r * 0.10,  r * 0.16);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Rough crack across rock face
  ctx.strokeStyle = '#404040';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(r * 0.30, -r * 0.20);
  ctx.lineTo(r * 0.60,  r * 0.16);
  ctx.stroke();
});

registerWeaponShape('Forge Hammer 1', (ctx, color, r) => {
  // Rough Forged: recognisably a hammer but asymmetric — the head is taller on
  // the back face than the front face, like a first-attempt forging.
  ctx.shadowColor = color;
  ctx.shadowBlur = 4;

  // Handle: slightly thicker, still plain
  ctx.fillStyle = '#6B5030';
  ctx.fillRect(-r * 0.70, -r * 0.07, r * 0.84, r * 0.14);

  // Asymmetric trapezoid head: back (−X side) is taller
  ctx.fillStyle = '#888888';
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(r * 0.12, -r * 0.22);  // back-top (shorter)
  ctx.lineTo(r * 0.82, -r * 0.36);  // front-top (taller)
  ctx.lineTo(r * 0.88,  r * 0.24);  // front-bottom
  ctx.lineTo(r * 0.12,  r * 0.30);  // back-bottom
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Visible weld seam — the head was pieced together
  ctx.strokeStyle = '#555555';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(r * 0.45, -r * 0.32);
  ctx.lineTo(r * 0.42,  r * 0.28);
  ctx.stroke();

  ctx.shadowBlur = 0;
});

registerWeaponShape('Forge Hammer 2', (ctx, color, r) => {
  // Tempered Steel: a classic T-shaped cross-peen hammer. Clean, symmetric,
  // professional. The cross-peen (wedge) on the back face is distinctive.
  ctx.shadowColor = color;
  ctx.shadowBlur = 9;
  ctx.fillStyle = color;

  // Main head — clean rectangle
  const hx = r * 0.10, hy = -r * 0.33, hw = r * 0.76, hh = r * 0.66;
  ctx.fillRect(hx, hy, hw, hh);

  // Cross-peen: a wedge pointing to −X off the back face
  ctx.beginPath();
  ctx.moveTo(hx,            hy + hh * 0.30);
  ctx.lineTo(hx - r * 0.30, hy + hh * 0.50);
  ctx.lineTo(hx,            hy + hh * 0.70);
  ctx.closePath();
  ctx.fill();

  // Polished striking face: bright rectangle at the +X end
  ctx.fillStyle = '#FFFFFF55';
  ctx.fillRect(hx + hw - r * 0.14, hy + r * 0.06, r * 0.12, hh - r * 0.12);

  // Rivets on head
  ctx.fillStyle = '#FFFFFF88';
  [hh * 0.25, hh * 0.75].forEach(dy => {
    ctx.beginPath();
    ctx.arc(hx + hw * 0.30, hy + dy, r * 0.045, 0, Math.PI * 2);
    ctx.fill();
  });

  // Handle: neat, slightly tapered
  ctx.fillStyle = '#7A5C2E';
  ctx.shadowBlur = 5;
  ctx.beginPath();
  ctx.moveTo(-r * 0.68, -r * 0.07);
  ctx.lineTo( r * 0.12, -r * 0.09);
  ctx.lineTo( r * 0.12,  r * 0.09);
  ctx.lineTo(-r * 0.68,  r * 0.07);
  ctx.closePath();
  ctx.fill();

  ctx.shadowBlur = 0;
});

registerWeaponShape('Forge Hammer 3', (ctx, color, r) => {
  // Refined Alloy: a heavy war-maul with prominent flanges projecting top and
  // bottom. The flange silhouette is the key distinctive shape.
  ctx.shadowColor = color;
  ctx.shadowBlur = 16;
  ctx.fillStyle = color;

  // Central maul block
  const hx = r * 0.08, hy = -r * 0.36, hw = r * 0.84, hh = r * 0.72;
  ctx.fillRect(hx, hy, hw, hh);

  // Top flange: prominent spike upward from top of head
  ctx.beginPath();
  ctx.moveTo(hx + hw * 0.25, hy);
  ctx.lineTo(hx + hw * 0.50, hy - r * 0.38);
  ctx.lineTo(hx + hw * 0.75, hy);
  ctx.closePath();
  ctx.fill();

  // Bottom flange: mirror spike downward
  ctx.beginPath();
  ctx.moveTo(hx + hw * 0.25, hy + hh);
  ctx.lineTo(hx + hw * 0.50, hy + hh + r * 0.38);
  ctx.lineTo(hx + hw * 0.75, hy + hh);
  ctx.closePath();
  ctx.fill();

  // Bright edge highlight
  ctx.strokeStyle = '#FFFFFFCC';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(hx, hy, hw, hh);

  // Engraved center groove
  ctx.strokeStyle = '#00000055';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(hx + hw * 0.5, hy + 3);
  ctx.lineTo(hx + hw * 0.5, hy + hh - 3);
  ctx.stroke();

  // Handle: thick, wrapped
  ctx.fillStyle = color;
  ctx.shadowBlur = 8;
  ctx.fillRect(-r * 0.72, -r * 0.12, r * 0.84, r * 0.24);
  // Wrapping bands on handle
  ctx.strokeStyle = '#00000055';
  ctx.lineWidth = 2;
  [-r * 0.50, -r * 0.30, -r * 0.10].forEach(x => {
    ctx.beginPath();
    ctx.moveTo(x, -r * 0.12); ctx.lineTo(x, r * 0.12);
    ctx.stroke();
  });

  ctx.shadowBlur = 0;
});

registerWeaponShape('Forge Hammer 4', (ctx, _color, r) => {
  // Molten Core: completely organic — no clean edges anywhere. The head is a
  // dripping liquid mass; the handle is scorched and cracked. Surreal aura.
  const MOLTEN = '#FF5500';
  const CORE   = '#FFAA00';
  const HOT    = '#FF8800';

  // Outer glow halo
  ctx.shadowColor = MOLTEN;
  ctx.shadowBlur = 32;

  // Main molten mass: rounded organic blob using bezier curves
  ctx.fillStyle = MOLTEN;
  ctx.beginPath();
  ctx.moveTo(r * 0.10, -r * 0.15);
  ctx.bezierCurveTo(r * 0.12, -r * 0.46, r * 0.55, -r * 0.50, r * 0.88, -r * 0.30);
  ctx.bezierCurveTo(r * 1.10,  r * 0.00, r * 1.02,  r * 0.34, r * 0.80,  r * 0.42);
  ctx.bezierCurveTo(r * 0.52,  r * 0.56, r * 0.22,  r * 0.48, r * 0.08,  r * 0.28);
  ctx.bezierCurveTo(r * -0.02, r * 0.14, r * 0.08,  r * 0.02, r * 0.10, -r * 0.15);
  ctx.closePath();
  ctx.fill();

  // Bright molten core (inner lighter blob)
  ctx.shadowBlur = 12;
  ctx.fillStyle = CORE;
  ctx.globalAlpha = 0.65;
  ctx.beginPath();
  ctx.moveTo(r * 0.28, -r * 0.12);
  ctx.bezierCurveTo(r * 0.30, -r * 0.30, r * 0.58, -r * 0.32, r * 0.78, -r * 0.15);
  ctx.bezierCurveTo(r * 0.90,  r * 0.02, r * 0.82,  r * 0.26, r * 0.60,  r * 0.30);
  ctx.bezierCurveTo(r * 0.38,  r * 0.36, r * 0.24,  r * 0.22, r * 0.26,  r * 0.06);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  // Drips hanging off the bottom of the blob
  ctx.shadowBlur = 8;
  ctx.fillStyle = HOT;
  [[r * 0.55, r * 0.42, r * 0.06, r * 0.18],
   [r * 0.35, r * 0.48, r * 0.04, r * 0.13],
   [r * 0.72, r * 0.40, r * 0.05, r * 0.10],
  ].forEach(([x, y, rx2, ry2]) => {
    ctx.beginPath();
    ctx.ellipse(x, y + ry2, rx2, ry2, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  // Scorched, cracked handle
  ctx.shadowBlur = 6;
  ctx.fillStyle = '#3A1800';
  ctx.fillRect(-r * 0.72, -r * 0.10, r * 0.84, r * 0.20);
  // Glowing cracks on handle
  ctx.strokeStyle = MOLTEN;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-r * 0.60, -r * 0.04); ctx.lineTo(-r * 0.45,  r * 0.06);
  ctx.moveTo(-r * 0.28,  r * 0.05); ctx.lineTo(-r * 0.15, -r * 0.06);
  ctx.stroke();

  ctx.shadowBlur = 0;
});

// ── Ball icon painter (orange-hot anvil) ─────────────────────────────────────

const painter: SpritePainter = (ctx) => {
  const IRON   = '#2A1000';  // near-black iron body
  const HEATED = '#CC4400';  // heated iron surface
  const HOT    = '#FF6600';  // hottest face / horn tip
  const BRIGHT = '#FFB300';  // glowing ember core

  // Anvil base (wide trapezoid at bottom) — dark iron
  ctx.fillStyle = IRON;
  ctx.beginPath();
  ctx.moveTo(3, 22); ctx.lineTo(21, 22);
  ctx.lineTo(19, 18); ctx.lineTo(5, 18);
  ctx.closePath();
  ctx.fill();

  // Anvil body — dark iron
  ctx.fillRect(5, 10, 13, 9);

  // Working face (top) — orange-hot from forging
  ctx.fillStyle = HEATED;
  ctx.fillRect(4, 8, 15, 3);

  // Hot edge highlight on the face
  ctx.strokeStyle = HOT;
  ctx.lineWidth = 0.8;
  ctx.strokeRect(4, 8, 15, 3);

  // Horn (tapers right) — darkened iron with hot tip
  ctx.fillStyle = IRON;
  ctx.beginPath();
  ctx.moveTo(17, 9); ctx.lineTo(23, 11);
  ctx.lineTo(23, 13); ctx.lineTo(17, 13);
  ctx.closePath();
  ctx.fill();
  // Hot tip at horn point
  ctx.fillStyle = HOT;
  ctx.beginPath();
  ctx.moveTo(21, 11.5); ctx.lineTo(23, 12); ctx.lineTo(21, 12.5);
  ctx.closePath();
  ctx.fill();

  // Glowing amber ember on working face
  ctx.fillStyle = BRIGHT;
  ctx.shadowColor = BRIGHT;
  ctx.shadowBlur = 7;
  ctx.beginPath();
  ctx.arc(9, 9, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
};

// ── Ball definition ───────────────────────────────────────────────────────────

export const ironwright: BallDefinition = {
  id: 'ironwright',
  name: 'Ironwright',
  lore: 'An ancient smith who forges his hammer hotter with every heartbeat of battle — by the final cycle, it strikes with liquid fire.',
  painter,
  ball: {
    name: 'Forge-Iron',
    radius: BALL_RADIUS,
    mass: 3.0,
    maxSpeed: 6.5,
    friction: 0.13,
    restitution: 0.45,
    spinSpeed: 3.0,
    durability: 65,
    color: '#E05A00',
    icon: 'ironwright-anvil',
    ability: {
      id: 'forge-cycle',
      name: 'Forge Cycle',
      description:
        'Every 6 s: forge the hammer up one tier (max 4). Each tier boosts outgoing damage and extends weapon reach. At Molten Core, hammer strikes also apply burn.',
      trigger: 'onTimer',
      params: {
        intervalMs: 6000,
        statusEffect: 'forgeHeat',
        statusTarget: 'self',
        statusDuration: 999999999,
        statusMagnitude: 0.22,
        stackBehavior: 'stack',
        maxStacks: 4,
        statusColor: '#FF6600',
        statusIcon: 'burst',
        rangePerStack: 0.15,
        // ── Forge visual: physics freeze + dark spotlight + flash + shake ──
        hitFreezeFrames: 14,
        hitFreezeColor: '#000000',
        hitFreezeAlpha: 0.80,
        hitScreenFlash: true,
        hitScreenFlashAlpha: 0.28,
        hitScreenFlashColor: '#FF6600',
        hitScreenFlashTtl: 8,
        hitShakeMagnitude: 6,
        hitFlash: true,
        hitFlashColor: '#FF8800',
        hitFlashTarget: 'self',
        // ── Amber particle burst ────────────────────────────────────────────
        trailOnTrigger: true,
        trailColor: '#FF6600',
        trailRadiusFrac: 0.95,
        trailAlpha: 0.75,
        trailTtl: 28,
        trailCount: 9,
        trailScatterFrac: 0.80,
      },
      getHudRows(effects: StatusEffect[], _hp: number, timerFrac = 0): StatusRow[] {
        const stacks = effects.find(e => e.type === 'forgeHeat')?.stacks ?? 0;
        const tiers = ['Crude', 'Rough', 'Tempered', 'Refined', 'Molten'] as const;
        const tierName = tiers[Math.min(stacks, 4)];
        const pct = Math.round(timerFrac * 100);
        return [
          { label: 'tier',  value: tierName },
          { label: 'forge', value: stacks >= 4 ? 'MAX' : `${pct}%` },
        ];
      },
    },
  },
  weapon: {
    name: 'Forge Hammer',
    range: 1.4,
    speed: 3.5,
    trigger: 'onCollision',
    hitReachMult: 1.3,
    description: 'Heavy hammer that grows deadlier with each forge cycle. At Molten Core, strikes sear the enemy with burn.',
    color: '#E05A00',
    icon: 'weapon-heavy-hammer',
    attacks: [
      {
        type: 'melee',
        cooldown: 1.0,
        damage: 8,
        knockback: 55,
        hitStatusEffect: 'burn',
        hitStatusDuration: 3000,
        hitStatusMagnitude: 0.5,
        hitStatusColor: '#FF4400',
        hitStatusIcon: 'burst',
        hitStatusMinSelfEffect: 'forgeHeat',
        hitStatusMinSelfStacks: 4,
      },
    ],
  },
  audioProfile: {
    hitStyle: 'thunderous',
    abilityStyle: 'forge',
  } satisfies AudioProfile,
};
