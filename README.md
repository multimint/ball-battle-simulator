# Ball Battle Simulator

Physics-based fighting game where two customizable fighters battle in an enclosed arena. Matches are simulated deterministically, rendered with real-time effects, and exported as MP4 videos with procedurally synthesized audio.

**[Live demo](https://multimint.github.io/ball-battle-simulator/)**

---

## Features

- **Physics simulation** — Matter.js rigid-body engine with velocity clamping, collision impulses, and soft attraction to keep fighters engaged
- **Orbiting weapon system** — melee, projectile, AOE, and laser attack types; trigger conditions include collision, timer, speed threshold, low HP, and arena edge
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
| Blood Axe | 70 | Bloodrage — berserk at <30% HP (+50% dmg, +70% speed) |

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

npm run rank                                   # Elo ranking, all matchups (500 runs default)
npm run rank -- --runs 100                     # quicker check
```

`npm run sim` output — one matchup (`±` shows run-to-run spread: win-rate standard error, and standard deviation of fight time / fun score):

```
Quick Flail vs Blood Axe  (100 runs)
───────────────────────────────────────────────────────
  Quick Flail  wins:   59 ( 59% ±5%)   avg HP left when winning: 13.7
  Blood Axe    wins:   40 ( 40% ±5%)   avg HP left when winning: 10.6
  Draw                  1 (  1%)
  Avg fight: 24.4s ±3.6s  (9 ball collisions)
  Avg fun score: 71/100 ±13
───────────────────────────────────────────────────────
  Completed 100 fights in 672ms  (6.7ms per fight)
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

The template has inline comments for every field. The existing fighters (`bloodaxe.ts`, `hawkeye.ts`, `quickflail.ts`) are the best reference for non-trivial ability and weapon configs.

Key types: `BallDefinition` (`src/balls/types.ts`), `WeaponStats`, `BallAbility`, `StatusEffectType` (`src/models/types.ts`).

After adding a ball, use the CLI to check balance before watching a full video:

```bash
npm run sim -- your-ball-id existing-ball-id --runs 200
```
