# Create Ball — Reference

Ground truth for the skill. Verify against the live code before writing — paths below are current as of this writing but the codebase moves.

---

## Architecture in one breath

A ball is one self-contained module: `src/balls/<id>.ts` exporting a `BallDefinition` (`painter`, `ball` + optional `ability`, `weapon`, `audioProfile`). Register it in `src/balls/index.ts`. **Nothing else needs to change for a compose-tier ball** — the simulator (`AbilityHandler`, `StatusEffectManager`, `ATTACK_HANDLERS`) and renderer are all generic and params-driven. There is **no switch-case to edit** (the old skill's biggest lie).

Canonical, fully-commented field list lives in `src/balls/_template.ts` — read it. Real examples: `quickflail.ts`, `hawkeye.ts`, `bloodaxe.ts`.

---

## Tiers & win-bands

The user declares intended strength; you tune the measured average win-rate vs the current field toward its band (sim reports win % ±SE).

| Tier | Avg win vs field | Feel |
|------|------------------|------|
| S | 60–70% | Oppressive; expect to be the one others are balanced against |
| A | 55–65% | Strong, clearly favoured most matchups |
| B | 45–55% | Even; the default "fair fight" target |
| C | 35–45% | Underdog; wins on spectacle/specific matchups |

Always-on quality gates regardless of tier: **fun score is good** and **no single matchup is lopsided** (roughly outside 25–75%). A "balanced" ball that produces boring one-note fights is not done.

---

## Seed-stat table

Starting points only — the [tuning loop](#tuning-loop) does the real balancing. All balls use `radius: BALL_RADIUS` (24). `maxSpeed` baseline `BALL_SPEED` is 5.5. Grounded in the three live balls:

| Archetype | mass | maxSpeed | friction | restitution | spinSpeed | durability | weapon shape | example attack |
|-----------|------|----------|----------|-------------|-----------|------------|--------------|----------------|
| Aggressor (fast melee) | 2.8 | 5.5 | 0.10 | 0.50 | 4.5 | 60 | fast long blade, `onSpeed`, high `hitReachMult` | melee cd 0.7, dmg 4, kb 40 |
| Sniper (ranged) | 3.0 | 7.5 | 0.12 | 0.45 | 3.5 | 60 | projectile, `onTimer`, long `range` (≈10) | proj cd 2 dmg 3 ×3 bullets + hitscan cd 10 dmg 15 |
| Berserker (heavy) | 3.0 | 5.5 | 0.15 | 0.40 | 2.5 | 70 | slow heavy, `onCollision` | melee cd 0.8, dmg 6, kb 55 |
| Control (debuffer) | 3.0 | 5.0 | 0.13 | 0.45 | 3.0 | 65 | medium reach, applies status | low dmg, high status uptime |
| Zoner (area denial) | 3.2 | 5.0 | 0.15 | 0.45 | 2.5 | 70 | aoe / mine | bursty, positional |
| Summoner (indirect) | 3.0 | 5.0 | 0.13 | 0.45 | 3.0 | 65 | weak primary + spawned helper | needs hard-tier trigger (see playbook) |

Live reference values: Quick Flail (aggressor) dur 60, Long Sword speed 6.75 `onSpeed` hitReachMult 1.8; Hawkeye (sniper) maxSpeed 7.5, Energy Laser range 10 `onTimer`; Blood Axe (berserker) dur 70, War Axe speed 4 `onCollision` hitReachMult 1.4.

> `onLowHP` abilities auto-unlock the engine's berserk boost (faster orbit + stronger hit bursts) below `threshold` — no extra code.

---

## Primitive catalogs

If the mechanic fits these, it's **compose**. If not, it's **extend**.

### Status effects (9) — `StatusEffectType` in `src/models/types.ts`
`burn` (DoT, stacks), `poison` (slow DoT, no stack), `freeze` (−speed & weapon spin), `rage` (+own outgoing dmg), `harden` (−own incoming dmg), `speedBoost` (+own speed), `weaken` (−enemy outgoing dmg), `lifesteal` (heal on hit), `shield` (absorb flat dmg).

Apply via ability `params` (`statusEffect`/`statusTarget`/`statusDuration`/`statusMagnitude`/`stackBehavior`/`maxStacks`/`statusColor`/`statusIcon`) or on a weapon attack (`hitStatusEffect` + `hitStatus*`). A second simultaneous effect uses the `secondStatus*` params. No code needed.

### Attack types (5) — `AttackConfig['type']`
`melee`, `projectile` (supports `aimAtEnemy`, `hitscan`, `bulletCount`/`bulletSpread`/`bulletInterval`/`bulletSpeed`), `aoe`, `shield`, `utility` (`pull` / `push-both`). Hitscan projectile already covers "laser/beam".

### Ability triggers (3) — `BallAbility.trigger`
`onHitDealt` (weapon lands a hit; `rangePerStack` available), `onLowHP` (`threshold` required), `passive`. **No `onTimer`/`onHitReceived`/`onBounce`** — wanting one is the hard extend.

### Audio styles — `src/audio/types.ts`
`hitStyle`: `thunderous | swift | arcane`. `abilityStyle`: `berserk | sharp | frenzy`. A new style is an extend (synthesized in `fightAudioSynthesizer.ts`; no asset files).

### Sprites — `src/sprites/weaponSprites.ts`
Reuse-first. Existing weapon keys include `weapon-long-sword`, `weapon-swift-sword`, `weapon-heavy-hammer`, `weapon-long-spear`, `weapon-chain-flail`, `weapon-defender-shield`, `weapon-energy-laser`, `weapon-power-cannon`, `weapon-boomerang`, `weapon-shockwave`, `weapon-magnet-beam`, `weapon-repulsor`, `weapon-grenade-bomb`, `weapon-war-axe`. Projectiles: `proj-orb`, `proj-boomerang`, `proj-bomb`. **Note: `src/rendering/weaponShapes.ts` is legacy/dead — do not use it.**

---

## Ball module template

Compact shape — see `src/balls/_template.ts` for the exhaustive commented param list.

```typescript
import type { BallDefinition, AudioProfile } from './types';
import type { SpritePainter } from '../sprites/spriteDefinitions';
import { BALL_RADIUS, BALL_SPEED } from './constants';
import type { StatusEffect, StatusRow } from '../models/types';

const painter: SpritePainter = (ctx) => { /* 24×24 icon */ };

export const myBall: BallDefinition = {
  id: 'my-ball',                 // unique snake-case
  name: 'My Ball',
  lore: 'One line.',
  painter,
  ball: {
    name: 'Body Name',
    radius: BALL_RADIUS, mass: 3.0, maxSpeed: BALL_SPEED,
    friction: 0.13, restitution: 0.45, spinSpeed: 3.0,
    durability: 65, color: '#RRGGBB', icon: 'my-ball-icon',
    ability: {                   // omit if no ability
      id: 'my-ability', name: 'Ability', description: '...',
      trigger: 'onHitDealt',     // onHitDealt | onLowHP | passive
      params: { /* status + fx params from the catalog */ },
      getHudRows(effects: StatusEffect[], hpFrac: number): StatusRow[] { return []; },
    },
  },
  weapon: {
    name: 'Weapon', range: 1.5, speed: 5.0, trigger: 'onCollision',
    description: '...', color: '#RRGGBB', icon: 'weapon-long-sword',
    attacks: [{ type: 'melee', cooldown: 0.75, damage: 8, knockback: 45 }],
  },
  audioProfile: { hitStyle: 'swift', abilityStyle: 'frenzy' } satisfies AudioProfile,
};
```

### Register (3 edits in `src/balls/index.ts`)
1. `import { myBall } from './myball';`
2. append to `BALL_DEFINITIONS = [..., myBall]`
3. add the icon painter to `BALL_SPRITE_PAINTERS`: `'my-ball-icon': myBall.painter,`

`SpriteKey` is derived automatically from registered painter keys — no union to edit. A duplicate `id` throws at startup (guard in index.ts).

---

## Resource conventions

All procedural; 24×24 logical canvas.
- **Ball icon** (in the ball module): draw freely with any fill/stroke colors; this is the colored emblem.
- **Weapon sprite** (`WEAPON_SPRITE_PAINTERS`): `ctx.translate(12,12)` then draw in **pure white** (`#FFFFFF`); orbit center is (12,12); **+X is the business end** (blade tip / muzzle); the ball is toward −X. `weapon.color` is applied as a drop-shadow at render — don't hardcode it.
- **Projectile sprite** (`PROJECTILE_SPRITE_PAINTERS`): same, white, centered.

---

## Extend playbook

Only after step-2 confirmation. Each adds to a registry — find the live registry, don't assume line numbers.

### EASY — new status effect
Files: `src/models/types.ts`, `src/simulation/statusEffects/<name>.ts`, `src/simulation/statusEffects/index.ts`.
A handler implements any of `tick` (DoT/HoT — mutate `hp[team]`), `speedMult`, `outDmgMult`, `inDmgMult`.

```typescript
// 1. add to the StatusEffectType union in models/types.ts:  | 'vulnerable'
// 2. src/simulation/statusEffects/vulnerable.ts
import type { StatusEffectHandler } from './types';
export const vulnerableHandler: StatusEffectHandler = {
  inDmgMult(effect) { return 1 + effect.magnitude; }, // enemy takes +X% damage
};
// 3. register in statusEffects/index.ts: import + add `vulnerable: vulnerableHandler,`
```
(`harden` returns `1 - magnitude`; mirror it for damage amp. DoT example: see `burn.ts`.)

### MEDIUM — new attack type
Files: `src/models/types.ts`, `src/simulation/attackHandlers/<name>.ts`, `src/simulation/attackHandlers/index.ts`, + a weapon sprite.
`resolve(ctx)` gets `{ weapon, attack, attacker, defender, targetTeam, dir, hitAngle, damage(team,amount), particles, effects }`.

```typescript
// 1. add to AttackConfig['type'] union in models/types.ts:  | 'boomerang'
// 2. src/simulation/attackHandlers/boomerang.ts
import { applyKnockback } from '../../utils/physics';
import { getHitMultipliers } from '../WeaponHitProcessor';
import type { AttackHandler } from './types';
export const boomerangHandler: AttackHandler = {
  resolve({ weapon, attack, defender, dir, targetTeam, damage, particles }) {
    const { kbMult, dmgMult } = getHitMultipliers(weapon, attack);
    applyKnockback(defender, dir.x, dir.y, attack.knockback * kbMult);
    damage(targetTeam, attack.damage * dmgMult);
    particles.spawnBurst(defender.position.x, defender.position.y, weapon.color ?? '#FFF', 8);
  },
};
// 3. register in attackHandlers/index.ts: import + add `boomerang: boomerangHandler,`
// 4. reuse `weapon-boomerang` sprite or author one.
```
(Genuinely-new *behavior* like a returning projectile or persistent zone needs its own state in the sim loop — that crosses into HARD.)

### HARD — new ability trigger / spawned entity (e.g. Revenant summoner)
This is expensive and touches multiple systems. **Re-confirm with a clear cost warning before starting.**
- New trigger (`onTimer`/`onHitReceived`/`onBounce`): add to `BallAbilityType` (`models/types.ts`), then find where `applyAbility` is invoked in the sim loop (`GameSimulator` / `HitProcessor`) and add the new call-site that fires it under the right condition. Reuse `AbilityHandler`'s generic params.
- Spawned entity (drone/turret): needs a secondary-body lifecycle in the simulator, its own render path, and probably audio. Treat as a mini-feature; do it deliberately, verify each layer.

---

## Tuning loop

1. `npm run sim -- <new-id> <existing-id> --runs 200` for each existing ball. Read win % ±SE, avg HP, and the fun-score components (closeness, damage symmetry, duration, momentum, opening hook, comeback). `--log` prints a fight trace.
2. `npm run rank` for the round-robin Elo + head-to-head matrix sanity check.
3. Adjust toward the declared tier:
   - Too strong/weak overall → nudge `durability`, weapon `damage`/`cooldown`, ability `magnitude`/`maxStacks`.
   - One lopsided matchup → look at *why* (the `--log` trace) before global nerfs.
   - Low fun (one-sided, too fast, no swings) → soften burst, add counterplay, lengthen fights.
4. Re-run step 7 (typecheck/lint/test) after any edit. Repeat until the band + fun gates pass.

---

## Improvements appendix (documented-on-demand, NOT auto-applied)

Offer these only when a ball actually needs them:
- **`vulnerable` status** — the obvious gap: `harden`/`weaken` exist but nothing makes the enemy *take* more. ~5 lines (EASY recipe above). Enables curse/armor-shred debuffers.
- **Stack decay** — `StatusEffectManager.tick` never decrements `remainingMs` for `stackBehavior: 'stack'` effects and never removes them, so stacks are **permanent** for the fight (Quick Flail fakes this with `duration: 999999999`). To get fading stacks, add timed per-stack decay in the manager.
- **Ability-trigger expansion** — `onTimer` (unlocks summoners/periodics), `onHitReceived` (thorns/retaliate), `onBounce`. HARD recipe.
- **HoT / body-aware ticks** — the `tick` hook can heal (mutate `hp[team]` upward) for regen; giving it body/velocity access would enable movement-scaling effects (bleed-on-move).
