# Ball Battle Simulator

Physics-based fighting game where two customizable fighters battle in an enclosed arena. Matches are simulated deterministically, rendered with real-time effects, and exported as MP4 videos with procedurally synthesized audio.

**[Live demo](https://multimint.github.io/ball-battle-simulator/)**

---

## Features

- **Physics simulation** — Matter.js rigid-body engine with velocity clamping, collision impulses, and soft attraction to keep fighters engaged
- **Orbiting weapon system** — melee, projectile, AOE, laser, and summon attack types; trigger conditions include collision, timer, speed threshold, low HP, and arena edge
- **Spawned units** — summon attacks spawn persistent units (wisps) that harass the enemy and can be launched as high-speed charged projectiles via ability triggers
- **Status effects** — burn, poison, freeze, rage, harden, speedBoost, weaken, lifesteal, shield; each with configurable stacking and duration
- **MP4 export** — intro card → fight → result card encoded in real time via Web Codecs API + MP4-Muxer; 1080×1920 portrait format
- **Procedural audio** — no sample files; all sounds synthesized from per-ball audio profiles via AudioEncoder
- **Deterministic replay** — identical fighters + velocities produce identical matches
- **Headless CLI** — run hundreds of fights without rendering for fast balance testing
- **Fun score** — every fight is rated 0–100 on how entertaining it was (closeness, comebacks, pacing, and more) for balance tuning

### Fighters

| Fighter | HP | Ability |
|---|---|---|
| Quick Flail | 60 | Momentum — stacking speedBoost up to 6× on hits |
| Hawkeye | 60 | Permafrost — laser hits apply freeze |
| Blood Axe | 70 | Bloodrage — berserk at <30% HP (+50% dmg, +70% speed, +80 knockback) |
| Revenant | 66 | Soul Surge — every 16 s converts Wisps to Banshees that hurl toward the enemy |
| Ironwright | 65 | Forge Cycle — hammer strikes build forgeHeat stacks for escalating damage |
| Shinobi | 60 | Shadowstep — every 7.5 s: time stops (1 s), Shinobi dashes through the enemy dealing 10 damage with katana slash effects |

---

## Tech Stack

| Layer | Library |
|---|---|
| UI | React 18, Zustand, Tailwind CSS, Radix UI |
| Physics | Matter.js 0.19 |
| Rendering | Canvas 2D API |
| Video | Web Codecs API, MP4-Muxer |
| Audio | Howler.js, Web Audio API |
| Build | Vite 5, TypeScript 6, Vitest |

---

## Getting Started

```bash
npm install
npm run dev        # dev server at http://localhost:5173/ball-battle-simulator/
```

```bash
npm run build      # production build → dist/
npm run test       # unit tests (Vitest)
npm run typecheck  # tsc -b
npm run lint       # ESLint
```

```bash
# Balance testing CLI — no browser, no video, ~5ms per fight
npm run balls                                  # list all ball IDs
npm run sim -- quick-flail blood-axe           # 100 fights (default)
npm run sim -- quick-flail blood-axe --runs 500
npm run sim -- quick-flail blood-axe --runs 1 --log   # blow-by-blow event log of one fight

npm run rank                                   # Elo ranking, all matchups (500 runs default)
npm run rank -- --runs 100                     # quicker check
```

`npm run sim` output — one matchup. `±` shows run-to-run spread (win-rate standard error; standard deviation for fight time, fun score, and each fun-score factor). The per-factor breakdown shows which dimension drives or drags the score when tuning:

```
Quick Flail vs Blood Axe  (100 runs)
───────────────────────────────────────────────────────
  Quick Flail  wins:   65 ( 65% ±5%)   avg HP left when winning: 15.4
  Blood Axe    wins:   35 ( 35% ±5%)   avg HP left when winning: 7.7
  Draw                  0 (  0%)
  Avg fight: 24.0s ±3.5s  (10 ball collisions)
  Avg fun score: 70/100 ±12
    closeness         81 ±15
    damage symmetry   74 ±17
    duration          66 ±24
    momentum          58 ±40
    opening hook      64 ±27
    comeback          79 ±17
───────────────────────────────────────────────────────
  Completed 100 fights in 650ms  (6.5ms per fight)
```

Add `--log` to print the full timestamped action log (hits, shots, ability procs) of the first fight, plus its result and per-factor scores — useful with `--runs 1` for a single-fight trace:

```
Fight #1 event log  (28 actions)
───────────────────────────────────────────────────────
    4.9s  Blood Axe    hit
    5.0s  Quick Flail  ability
    5.0s  Quick Flail  hit
    ...
───────────────────────────────────────────────────────
  Result: Quick Flail wins  (30.0s, A 36 HP / B 22 HP)
  Fun score: 70/100   [closeness 81  dmgSymmetry 74  duration 66  momentum 58  hook 64  comeback 79]
```

`npm run rank` output — full Elo leaderboard (a live progress bar tracks the run, then clears):

```
Ranking 3 balls — 3 matchups × 200 runs = 600 fights
  [████████████████████████] 100%

Ball Rankings  (3 balls × 200 runs, 600 fights total)
─────────────────────────────────────────────────
  #1  Quick Flail  1090 Elo   ████████████
  #2  Hawkeye      1030 Elo   █████████
  #3  Blood Axe     880 Elo   █

Head-to-head decisive win % (draws excluded):
                 Quic  Hawk  Bloo
  Quick Flail     —   54%   60%
  Hawkeye       47%     —   72%
  Blood Axe     40%   28%     —
─────────────────────────────────────────────────
  Completed in 3523ms  (5.9ms per fight)
```

### Fun score

Each fight gets a 0–100 **fun score** ([`src/utils/funScore.ts`](src/utils/funScore.ts)) — a heuristic for how entertaining the match was to watch, surfaced in both the CLI and the in-app result card. It is the equal-weighted average of six factors:

| Factor | Rewards |
|---|---|
| **Closeness** | The winner finishing with little HP to spare (a draw scores max) |
| **Damage symmetry** | Both fighters dealing similar total damage |
| **Duration** | Fights landing in a 30–40s sweet spot (Gaussian falloff outside) |
| **Momentum** | The HP-fraction lead changing hands repeatedly |
| **Opening hook** | Lots of action (hits, shots, ability procs) in the first 5 seconds |
| **Comeback** | The eventual winner having been close to death before winning |

Momentum and comeback compare HP **fractions** (`hp / maxHp`), not absolute HP, so they stay meaningful for matchups between fighters with very different durability. The factors are derived from per-fight `gameEvents` (a gameplay action log) and periodic HP snapshots recorded by `SimulationCore`.

---

## Architecture

```
Setup screen → SimulatingScreen → PlaybackScreen
                     │
              simulator.worker.ts          ← physics off main thread
                     │
              GameSimulator.ts             ← extends SimulationCore; drives MP4 encoding
                     │
              SimulationCore.ts            ← shared 60 Hz tick loop
              ├── WeaponController         ← orbit, fire, hitbox
              ├── DroneController          ← spawned unit lifecycle (wisp/charged states)
              ├── HitProcessor             ← damage, knockback
              ├── StatusEffectManager      ← apply, tick, expire
              ├── AbilityHandler           ← trigger conditions
              ├── ParticleController       ← trail & burst particles
              ├── AudioEmitter             ← queue audio events
              └── VideoEncoder             ← MP4 encode per frame (GameSimulator only)
                     │
              Renderer.ts                  ← Canvas 2D draw calls

              HeadlessSimulator.ts         ← extends SimulationCore; no rendering/video
              (used by CLI: src/cli/sim.ts)
```

**Simulation loop** — the Web Worker runs a fixed 60 Hz physics tick. Each tick: resolve collisions → apply weapon attacks → tick status effects → check ability triggers → emit audio events → encode video frame. The main thread receives the final MP4 blob and hands it to the PlaybackScreen.

**Headless mode** — `HeadlessSimulator` extends the same `SimulationCore` tick loop but skips all rendering and video encoding. Used by `npm run sim` for balance testing at ~200× real-time speed.

**Rendering** — purely Canvas 2D, no WebGL. Each frame draws: background → balls (with HP rings and status icons) → orbit weapons → projectiles → particles → floating damage numbers → HUD panels.

**State management** — Zustand drives three app phases (`setup → simulating → playback`). Fighter selection, match results, and the encoded video blob all live in the store.

---

## Adding a New Ball

1. Copy `src/balls/_template.ts` to `src/balls/yourball.ts`
2. Fill in `BallDefinition`: stats, weapon config, ability, audio profile, and the 24×24 canvas painter
3. Import and append it to `BALL_DEFINITIONS` in `src/balls/index.ts` — it auto-registers everywhere

The template has inline comments for every field. The existing fighters are the best reference for non-trivial configs:

| Reference | Good for |
|---|---|
| `bloodaxe.ts` | `onLowHP` berserk ability, melee weapon |
| `hawkeye.ts` | projectile weapon, `onHitDealt` status effect |
| `quickflail.ts` | `onHitDealt` stacking ability |
| `revenant.ts` | `summon` attack type, spawned units (wisp/banshee), `onTimer` ability |
| `ironwright.ts` | stacking status effect (`forgeHeat`), tiered weapon sprites per stack |
| `shinobi.ts` | `dashThroughEnemy` ability, bouncing projectiles, world-fixed orbit weapon |

**Weapon attack types:** `melee`, `projectile` (supports hitscan, burst fire, wall-bouncing), `aoe`, `shield`, `utility` (push/pull), `summon` (spawns persistent units that can enter a charged state via ability trigger).

**Bouncing projectiles** — set `maxBounces` on a projectile attack to make the bullet ricochet off walls and enemy weapons (parry). Combine with `bulletTtl` to control flight time. Set `projectileIcon` to a registered sprite key for custom bullet visuals.

**Dash-through ability** — add `dashThroughEnemy: true` to any `onTimer` ability's params to trigger the 60-frame (1 s) time-stop dash. All visual and timing params are configurable per ball:

| Param | Default | Effect |
|---|---|---|
| `dashDamage` | 10 | HP dealt on impact |
| `dashColor` | `'#3F51B5'` | Dash trail particle colour |
| `dashSlashColor` | `'#90CAF9'` | Primary slash mark colour |
| `dashSecondarySlashColor` | `'#5C6BC0'` | Secondary slash mark colour |
| `dashAbilityHitStyle` | `'shadowslash'` | `AbilitySoundKey` played at impact |
| `dashStartHold` | 6 | Freeze frames before movement starts |
| `dashMoveFrames` | 12 | Frames for the lerp through enemy |
| `dashTotalFrames` | 60 | Total freeze duration (frames @ 60 Hz) |
| `dashFreezeColor` | `'#080820'` | Casting overlay colour |
| `dashFreezeAlpha` | 0.72 | Casting overlay peak alpha |

**Custom orbit-weapon shapes** — set `projectileOrbitFixed: true` and `icon: 'my-icon'` on the weapon, then call `registerProjectileIconShape('my-icon', painter)` in `src/rendering/weaponShapes.ts`. The orbit rotation is cancelled before drawing so the shape keeps a fixed world orientation (like a shuriken).

**Custom bullet visuals** — call `registerBulletPainter('my-proj-key', (ctx, bullet) => { ... })` in `src/rendering/drawBullets.ts` and set `projectileIcon: 'my-proj-key'` on the weapon. The painter receives the full `Bullet` object (including `ttl` for spin/animation).

**Charge fade thresholds** — set `chargeHideBelow` (default 30%) and `chargeFadeUpTo` (default 60%) on `WeaponStats` to control when the orbit weapon disappears and fades back in after firing.

**Summon attack config fields** — all optional with sensible defaults:
`summonHp`, `summonRadius`, `summonSpeed`, `summonMaxCount`, `summonMass`, `summonNormalColor`, `summonContactDamage`, `summonContactCooldownMs`, `summonChargedColor`, `summonChargedSpeed`, `summonChargedDamage`, plus `summonContact/ChargedStatus*` for applying status effects on drone hit.

Key types: `BallDefinition` (`src/balls/types.ts`), `WeaponStats`, `BallAbility`, `AttackConfig`, `StatusEffectType` (`src/models/types.ts`).

After adding a ball, use the CLI to check balance before watching a full video:

```bash
npm run sim -- your-ball-id existing-ball-id --runs 200
```
