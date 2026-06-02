---
name: create-ball
description: Design and implement a new fighter ball for the ball-battle-simulator. Runs a short interview, derives stats from an archetype, designs the weapon/ability/status effects, writes a self-contained ball module, and empirically balances it to a target tier with the sim/rank CLIs. Use when the user says "/create-ball", wants to add a new ball or fighter, design a new archetype, or build a ball with a custom weapon, ability, buff/debuff, or status effect — including ones that need a new engine primitive.
---

# Create Ball

Builds a new ball for the ball-battle-simulator and tunes it to a chosen power tier.

Two ways a ball can be built:

- **Compose** (default) — express it with existing primitives. One new file in `src/balls/`, registered in `src/balls/index.ts`. **Zero engine edits.**
- **Extend** (gated) — the concept needs a primitive the engine lacks (a new status effect, attack type, or ability trigger). Allowed, but only after you name the gap + cost and the user confirms.

Always try compose first. See [REFERENCE.md](REFERENCE.md) for every catalog, template, seed-stat table, the tiered extend playbook, and the tuning loop.

## The 9-step process

Run these in order. Do not write or edit any file before step 4 is approved.

### 1 — Interview (one question at a time)
Ask via `AskUserQuestion`, menus for rote fields, free text for the mechanic:
1. **Identity** — name, element/theme, one-line lore.
2. **Archetype** `[menu]` — aggressor / sniper / berserker / control / zoner / summoner. Seeds base stats (see [REFERENCE.md](REFERENCE.md#seed-stat-table)).
3. **Signature mechanic** `[free text]` — the weapon/ability gimmick in plain English.
4. **Tier** `[menu]` — S / A / B / C. The strength target (see [REFERENCE.md](REFERENCE.md#tiers--win-bands)).
5. **Visuals** — hex color + ball-icon idea + weapon look.
6. **Audio** `[menu]` — `hitStyle` (thunderous/swift/arcane) + `abilityStyle` (berserk/sharp/frenzy).

### 2 — Interpret & gate
Map the mechanic onto existing primitives ([REFERENCE.md](REFERENCE.md#primitive-catalogs)). Echo back your reading: either
> "I read this as **compose** using `<primitives>`."
or
> "This needs **extend**: a new `<status effect | attack type | ability trigger>`. Cost: `<easy/medium/hard>`. Proceed?"

Get an explicit yes before any extend work.

### 3 — Design
Pick seed stats from the archetype row. Define `weapon.attacks[]`, the `ability` params, and any status effects. Plan the extension (if any) against the [extend playbook](REFERENCE.md#extend-playbook).

### 4 — Design preview (APPROVAL PAUSE)
Show the full proposed spec — stats, weapon, ability, status effects, sprite/audio plan, and any engine extension + its cost. **Wait for approval. Write nothing until the user confirms.**

### 5 — Generate resources (reuse-first)
Sprites and audio are 100% procedural code — no asset files. Reuse before authoring:
- Scan `WEAPON_SPRITE_PAINTERS` / `PROJECTILE_SPRITE_PAINTERS` in `src/sprites/weaponSprites.ts` and the audio styles. If one fits, reuse its key.
- Else author a new procedural painter to the conventions in [REFERENCE.md](REFERENCE.md#resource-conventions) (24×24, white shapes, +X = business end, color via drop-shadow). The ball icon painter lives in the ball module.
- Convention-only: trust `tsc` for key registration; no image preview.

### 6 — Write & register
Write `src/balls/<id>.ts` ([template](REFERENCE.md#ball-module-template)) and wire all three spots in `src/balls/index.ts`. Apply any confirmed extension per the playbook.

### 7 — Verify (headless, blocking)
`npm run typecheck` && `npm run lint` && `npm run test`. Fix everything before continuing.

### 8 — Tune to tier (empirical loop)
`npm run sim -- <new-id> <each-existing-id>` and `npm run rank`. Adjust stats/magnitudes until the measured win-rate matches the declared tier band, fun score is good, and no matchup is lopsided. Re-run step 7 after edits. Full loop: [REFERENCE.md](REFERENCE.md#tuning-loop).

### 9 — Report
Final stats, **measured** tier (win % / Elo), fun score, files touched, and any engine extension made.
