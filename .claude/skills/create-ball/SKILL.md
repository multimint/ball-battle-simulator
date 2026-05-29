---
name: create-ball
description: Design and implement a brand-new ball type for the ball battle simulator. Runs an interview, derives balanced stats, designs a passive ability (including buff/debuff status effects), and writes fully working TypeScript code to ballPresets.ts, fighterPresets.ts, types.ts, GameSimulator.ts, and Renderer.ts. Use when the user says "/create-ball", wants to add a new ball, design a new fighter archetype, or asks to create a ball with a custom ability/mechanic including buffs or debuffs.
---

# Create Ball

Adds a new ball type with a unique passive ability and balanced stats. Writes all code automatically.

## Workflow

### Step 1 — Interview (one question at a time via AskUserQuestion)

Ask these 6 questions sequentially:

1. **Name & theme** — What is this ball called and what's its vibe?
   Options: Fire/Inferno, Ice/Frost, Ghost/Shadow, Stone/Earth, Storm/Thunder, Void/Dark, Nature/Poison, or custom
2. **Combat role** — Pick one: Tank / Speedster / Glass Cannon / Support / Chaos
3. **Passive ability** — Describe the special mechanic in plain English
   Direct effects: "leaves fire behind as it moves", "explodes on wall bounce", "regens HP slowly", "reflects some damage back"
   Buff/debuff: "burns the enemy on hit", "freezes the enemy on bounce", "poisons on attack", "gains rage at low HP", "hardens when hit", "steals life on attack", "gains a shield when hit", "boosts own speed on bounce"
   See the full catalog in [REFERENCE.md](REFERENCE.md#ability-catalog) and [REFERENCE.md](REFERENCE.md#buff-debuff-catalog)
4. **Color & icon** — Hex color + emoji (e.g. `#FF4400` 🔥)
5. **Passive peak power** — At full effect (max stacks, active), how strong should this ball be compared to Bloodrage?
   Options: Weaker than Bloodrage / Equal to Bloodrage / Stronger than Bloodrage / Much stronger (glass cannon trade-off)
6. **Balance lean** — Should the first version lean conservative (safer, easier to buff later) or aggressive (stronger, expect nerfs)?
   Default to **conservative** unless the user explicitly wants aggressive.

### Step 2 — Design & Balance Validation

**2a. Pick base stats**
Look up the role midpoint values from [REFERENCE.md](REFERENCE.md#balance-table).

**2b. Rate passive power tier and apply discount**
See [REFERENCE.md](REFERENCE.md#passive-power-budget) for the tier table (Weak / Medium / Strong / Extreme).
- Rate the passive based on its peak effect
- Apply the stat discount to `attackPower` (and `durability` for Extreme tier)
- If the user chose conservative lean, reduce by an additional 10%

**2c. Calculate and show effective DPS**
Use the formula in [REFERENCE.md](REFERENCE.md#effective-dps-formula):
> `effective DPS = weapon.damage × (attackPower / 100) / weapon.cooldown`

Compare to Bloodrage's baseline (~37 DPS). Show this summary to the user **before writing any code**:

```
Ball: <Name>
Role: <role> | Passive tier: <tier>
─────────────────────────────────────────
attackPower:  XX   (after passive discount)
durability:   XX
maxSpeed:     XX
weapon:       <name>, dmg XX, cooldown Xs
weapon orbit: XX rad/s  (speed × 1.5)
─────────────────────────────────────────
Baseline DPS: ~XX  (Bloodrage ≈ 37)
Peak DPS*:    ~XX  (with passive active)
* estimated — passive multiplier applied
```

Ask the user to confirm or adjust before proceeding to Step 3.

**2d. Pick weapon orbit speed**
See [REFERENCE.md](REFERENCE.md#balance-table) for orbit speed ranges by role. Faster orbit = more hit opportunities but less predictable hits. Choose a weapon from `src/constants/fighterPresets.ts` or design a new one.

> **If using `onLowHP` trigger:** the engine automatically gives this ball 2.5× faster weapon orbit and 2.5× stronger hit velocity bursts while in berserk state. No extra code needed. See [REFERENCE.md](REFERENCE.md#berserk-system) for the full behavior table.

### Step 3 — Add BallAbility system (idempotent)

Read `src/models/types.ts`.
- If `BallAbility` interface **does not exist**: add it using the template in [REFERENCE.md](REFERENCE.md#types-template)
- If it **already exists**: skip this step

### Step 4 — Write ball config

Append new `BallStats` entry (with `ability` field) to `src/constants/ballPresets.ts`
See template: [REFERENCE.md](REFERENCE.md#ball-template)

### Step 5 — Write fighter preset

Append a `FighterPreset` to `src/constants/fighterPresets.ts`
See template: [REFERENCE.md](REFERENCE.md#fighter-template)

> **Hit effects are free** — weapon category auto-picks screen flash, ball hit flash, and shake tiers. No extra code needed. To go beyond the tier defaults (e.g. ability-triggered shake on rage), add `hitFlash`/`hitScreenFlash`/`hitShakeMagnitude`/`hitSlowMo` params to the ability. See [REFERENCE.md](REFERENCE.md#hit-effects).

### Step 6 — Hook ability into simulator

Read `src/simulation/GameSimulator.ts`, then add `applyBallAbility()` calls at the correct trigger points.
See full instructions: [REFERENCE.md](REFERENCE.md#simulator-hooks)

### Step 7 — Draw weapon shape

Add a named shape for the new weapon in `src/rendering/drawOrbitWeapon.ts`.
See instructions and templates: [REFERENCE.md](REFERENCE.md#weapon-shape)

### Step 8 — Add ability rendering

Hook visual effect into `src/rendering/Renderer.ts`.
See instructions: [REFERENCE.md](REFERENCE.md#renderer-hooks)

### Step 9 — Verify

Run: `cd /Users/ongittiwat/Desktop/ball-battle-simulator/ball-battle-simulator && npx tsc --noEmit`
Fix any TypeScript errors before reporting done.

## Advanced reference

See [REFERENCE.md](REFERENCE.md) for: balance tables, passive power budget, DPS formula, ability catalog, all code templates, and hook insertion points.
