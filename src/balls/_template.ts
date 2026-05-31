/**
 * TEMPLATE — copy this file, rename it, fill in the values.
 *
 * Steps to add a new ball:
 *   1. Copy this file to src/balls/<yourball>.ts
 *   2. Fill in all fields below
 *   3. Add your sprite key to SpriteKey.ts
 *   4. Register in src/balls/index.ts:
 *        import { yourBall } from './<yourball>';
 *        export const BALL_DEFINITIONS = [..., yourBall] as const;
 *        export const BALL_SPRITE_PAINTERS = { ..., <yourkey>: yourBall.painter };
 *   Done — it will appear in the fighter selector automatically.
 */

import type { BallDefinition } from './types';
import type { SpritePainter } from '../sprites/spriteDefinitions';
import { BALL_RADIUS, BALL_SPEED } from './constants';

// ── Sprite ────────────────────────────────────────────────────────────────────
// Draw your icon on a 24×24 logical canvas. The system scales it automatically.
// Use any Canvas 2D API calls. Common palette: '#F7C430' gold, '#00BFA5' teal,
// '#FF6B35' orange, '#E74C3C' red, '#4CAF50' green, '#90A4AE' gray.

const painter: SpritePainter = (ctx) => {
  // Example: filled circle
  ctx.fillStyle = '#F7C430';
  ctx.beginPath();
  ctx.arc(12, 12, 9, 0, Math.PI * 2);
  ctx.fill();
};

// ── Ball definition ───────────────────────────────────────────────────────────

export const templateBall: BallDefinition = {
  id: 'template',                        // unique snake-case id used in stores/URLs
  name: 'Template',                      // display name shown in fighter selector
  lore: 'A one-line flavour description.',

  painter,

  ball: {
    name: 'Template Body',               // internal body name shown on result card
    radius: BALL_RADIUS,                 // keep equal to BALL_RADIUS for fair play
    mass: 3.0,                           // 2.5–3.5 is balanced
    maxSpeed: BALL_SPEED,                // 4.5–6.5; higher = faster
    friction: 0.12,                      // 0.08–0.18
    restitution: 0.45,                   // bounce 0.35–0.55
    spinSpeed: 3.5,                      // angular velocity base
    durability: 60,                      // HP — 40 (glass) to 80 (tank)
    attackPower: 8,                      // base damage multiplier
    knockbackPower: 45,                  // base knockback force
    color: '#F7C430',                    // CSS color shown as ball fill + team accent
    icon: 'lightning',                   // must match a key in SpriteKey.ts

    // Optional passive ability — remove if the ball has no ability
    ability: {
      id: 'template-ability',
      name: 'Template Ability',
      description: 'What the ability does in plain language.',
      trigger: 'onHitDealt',             // onHitDealt | onHitReceived | onLowHP | onBounce | passive
      params: {
        // ── Status effect applied on trigger ─────────────────────────────────
        statusEffect: 'speedBoost',      // burn | poison | freeze | rage | harden | speedBoost | weaken | lifesteal | shield
        statusTarget: 'self',            // 'self' | 'enemy'
        statusDuration: 2000,            // ms
        statusMagnitude: 0.3,            // multiplier; meaning depends on effect type
        stackBehavior: 'refresh',        // 'refresh' | 'stack' | 'ignore'
        maxStacks: 1,
        statusColor: '#F7C430',          // ring color shown around the ball
        statusIcon: 'lightning',         // sprite key for the icon above the ball

        // ── Optional: second simultaneous status effect ───────────────────────
        // secondStatusEffect: 'rage',
        // secondStatusDuration: 2000,
        // secondStatusMagnitude: 0.4,
        // secondStatusBehavior: 'refresh',
        // secondStatusMaxStacks: 1,
        // secondStatusColor: '#FF4400',
        // secondStatusIcon: 'burst',

        // ── Screen flash on trigger ───────────────────────────────────────────
        hitFlash: true,
        hitFlashColor: '#F7C430',
        hitFlashTarget: 'self',          // 'self' | 'enemy'

        // ── HUD label ─────────────────────────────────────────────────────────
        hudLabel: 'boost',               // shown in the bottom panel strip
      },
    },
  },

  weapon: {
    name: 'Template Weapon',
    range: 1.5,                          // orbit radius in ball-radii
    speed: 5.0,                          // orbit angular speed
    trigger: 'onCollision',              // onCollision | onTimer | onSpeed | onEdge | none
    description: 'One-line weapon description shown in the stats panel.',
    color: '#F7C430',
    effectLabel: 'sword',                // 'sword' | 'spear' | 'hammer' | 'flail' — melee animation
    attacks: [
      { type: 'melee', cooldown: 0.75, damage: 8, knockback: 45 },
    ],
  },
};
