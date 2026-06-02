import type { SpritePainter } from './spriteDefinitions';

// 24×24 logical canvas, orbit center at (12,12), business end +X.
// Pure white shapes — weapon.color applied as drop-shadow at render time.

type Ctx = Parameters<SpritePainter>[0];

export const WEAPON_SPRITE_PAINTERS = {

  // Horizontal blade + crossguard
  'weapon-long-sword'(ctx: Ctx) {
    ctx.save();
    ctx.translate(12, 12);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineCap = 'round';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-9, 0);
    ctx.lineTo(11, 0);
    ctx.stroke();
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(1, -4);
    ctx.lineTo(1, 4);
    ctx.stroke();
    ctx.restore();
  },

  // Slim filled diamond
  'weapon-swift-sword'(ctx: Ctx) {
    ctx.save();
    ctx.translate(12, 12);
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(0, 3);
    ctx.lineTo(-6, 0);
    ctx.lineTo(0, -3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  },

  // Handle + thick vertical head
  'weapon-heavy-hammer'(ctx: Ctx) {
    ctx.save();
    ctx.translate(12, 12);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineCap = 'round';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-9, 0);
    ctx.lineTo(3, 0);
    ctx.stroke();
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(3, -7);
    ctx.lineTo(3, 7);
    ctx.stroke();
    ctx.restore();
  },

  // Shaft + filled triangle tip
  'weapon-long-spear'(ctx: Ctx) {
    ctx.save();
    ctx.translate(12, 12);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineCap = 'round';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-9, 0);
    ctx.lineTo(6, 0);
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(6, -4);
    ctx.lineTo(11, 0);
    ctx.lineTo(6, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  },

  // Center dot + 4 radiating spikes
  'weapon-chain-flail'(ctx: Ctx) {
    ctx.save();
    ctx.translate(12, 12);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 4, Math.sin(a) * 4);
      ctx.lineTo(Math.cos(a) * 9, Math.sin(a) * 9);
      ctx.stroke();
    }
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(0, 0, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  // Pentagon outline
  'weapon-defender-shield'(ctx: Ctx) {
    ctx.save();
    ctx.translate(12, 12);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(-5, -9);
    ctx.lineTo(8, -5);
    ctx.lineTo(10, 0);
    ctx.lineTo(8, 5);
    ctx.lineTo(-5, 9);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  },

  // Filled diamond
  'weapon-energy-laser'(ctx: Ctx) {
    ctx.save();
    ctx.translate(12, 12);
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(11, 0);
    ctx.lineTo(1, 5);
    ctx.lineTo(-6, 0);
    ctx.lineTo(1, -5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  },

  // Horizontal barrel rectangle
  'weapon-power-cannon'(ctx: Ctx) {
    ctx.save();
    ctx.translate(12, 12);
    ctx.fillStyle = '#FFFFFF';
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.rect(-5, -3, 16, 6);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  },

  // Single thick arc
  'weapon-boomerang'(ctx: Ctx) {
    ctx.save();
    ctx.translate(12, 12);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, 9, -Math.PI * 0.75, Math.PI * 0.75);
    ctx.stroke();
    ctx.restore();
  },

  // 6 radiating lines with center gap
  'weapon-shockwave'(ctx: Ctx) {
    ctx.save();
    ctx.translate(12, 12);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 3.5, Math.sin(a) * 3.5);
      ctx.lineTo(Math.cos(a) * 9, Math.sin(a) * 9);
      ctx.stroke();
    }
    ctx.restore();
  },

  // U-shape opening left, arc on right
  'weapon-magnet-beam'(ctx: Ctx) {
    ctx.save();
    ctx.translate(12, 12);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-3, -6.5);
    ctx.lineTo(5, -6.5);
    ctx.arc(5, 0, 6.5, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(-3, 6.5);
    ctx.stroke();
    ctx.restore();
  },

  // Double arrow ←→
  'weapon-repulsor'(ctx: Ctx) {
    ctx.save();
    ctx.translate(12, 12);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(1, 0);    ctx.lineTo(9, 0);
    ctx.moveTo(9, 0);    ctx.lineTo(5.5, -3.5);
    ctx.moveTo(9, 0);    ctx.lineTo(5.5, 3.5);
    ctx.moveTo(-1, 0);   ctx.lineTo(-9, 0);
    ctx.moveTo(-9, 0);   ctx.lineTo(-5.5, -3.5);
    ctx.moveTo(-9, 0);   ctx.lineTo(-5.5, 3.5);
    ctx.stroke();
    ctx.restore();
  },

  // Filled circle body + fuse line
  'weapon-grenade-bomb'(ctx: Ctx) {
    ctx.save();
    ctx.translate(12, 12);
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(0, 0, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -5.5);
    ctx.lineTo(3, -10);
    ctx.stroke();
    ctx.restore();
  },

  // Handle + crescent arc blade
  'weapon-war-axe'(ctx: Ctx) {
    ctx.save();
    ctx.translate(12, 12);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineCap = 'round';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-8, 0);
    ctx.lineTo(2, 0);
    ctx.stroke();
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(2, 0, 7, -Math.PI * 0.6, Math.PI * 0.6);
    ctx.stroke();
    ctx.restore();
  },

  // Solid tapered staff + green orb
  'weapon-spirit-staff'(ctx: Ctx) {
    ctx.save();
    ctx.translate(12, 12);
    // Solid shaft
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(-10,  2.2);
    ctx.lineTo(  5,  1.0);
    ctx.lineTo(  5, -1.0);
    ctx.lineTo(-10, -2.2);
    ctx.closePath();
    ctx.fill();
    // Highlight stripe
    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 0.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-9, -1.2);
    ctx.lineTo( 4, -0.6);
    ctx.stroke();
    ctx.globalAlpha = 1;
    // Green orb (drawn in white for sprite system; color tinted at render time)
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(8, 0, 3.2, 0, Math.PI * 2);
    ctx.fill();
    // Specular
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(6.8, -1, 1.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

} satisfies Record<string, SpritePainter>;

// ── Traveling projectile painters ─────────────────────────────────────────────

export const PROJECTILE_SPRITE_PAINTERS = {

  // Two concentric circles
  'proj-orb'(ctx: Ctx) {
    ctx.fillStyle = '#FFFFFF';
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.arc(12, 12, 7.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(12, 12, 3.5, 0, Math.PI * 2);
    ctx.fill();
  },

  // Simple arc
  'proj-boomerang'(ctx: Ctx) {
    ctx.save();
    ctx.translate(12, 12);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 0, 7, -Math.PI * 0.75, Math.PI * 0.75);
    ctx.stroke();
    ctx.restore();
  },

  // Filled circle + fuse line
  'proj-bomb'(ctx: Ctx) {
    ctx.save();
    ctx.translate(12, 12);
    ctx.fillStyle = '#FFFFFF';
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(2.5, -9);
    ctx.stroke();
    ctx.restore();
  },

} satisfies Record<string, SpritePainter>;
