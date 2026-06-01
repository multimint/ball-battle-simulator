# Ball Battle Simulator

Physics-based fighting game where two customizable fighters battle in an enclosed arena. Matches are simulated deterministically, rendered with real-time effects, and exported as MP4 videos with procedurally synthesized audio.

**[Live demo](https://multimint.github.io/ball-battle-simulator/)**

![Screenshot](docs/screenshot.png)

---

## Features

- **Physics simulation** — Matter.js rigid-body engine with velocity clamping, collision impulses, and soft attraction to keep fighters engaged
- **Orbiting weapon system** — melee, projectile, AOE, and laser attack types; trigger conditions include collision, timer, speed threshold, low HP, and arena edge
- **Status effects** — burn, poison, freeze, rage, harden, speedBoost, weaken, lifesteal, shield; each with configurable stacking and duration
- **MP4 export** — intro card → fight → result card encoded in real time via Web Codecs API + MP4-Muxer; 1080×1920 portrait format
- **Procedural audio** — no sample files; all sounds synthesized from per-ball audio profiles via AudioEncoder
- **Deterministic replay** — identical fighters + velocities produce identical matches

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

---

## Architecture

```
Setup screen → SimulatingScreen → PlaybackScreen
                     │
              simulator.worker.ts          ← physics off main thread
                     │
              GameSimulator.ts             ← 60 Hz tick loop
              ├── WeaponController         ← orbit, fire, hitbox
              ├── HitProcessor             ← damage, knockback
              ├── StatusEffectManager      ← apply, tick, expire
              ├── AbilityHandler           ← trigger conditions
              ├── ParticleController       ← trail & burst particles
              ├── AudioEmitter             ← queue audio events
              └── VideoEncoder             ← MP4 encode per frame
                     │
              Renderer.ts                  ← Canvas 2D draw calls
```

**Simulation loop** — the Web Worker runs a fixed 60 Hz physics tick. Each tick: resolve collisions → apply weapon attacks → tick status effects → check ability triggers → emit audio events → encode video frame. The main thread receives the final MP4 blob and hands it to the PlaybackScreen.

**Rendering** — purely Canvas 2D, no WebGL. Each frame draws: background → balls (with HP rings and status icons) → orbit weapons → projectiles → particles → floating damage numbers → HUD panels.

**State management** — Zustand drives three app phases (`setup → simulating → playback`). Fighter selection, match results, and the encoded video blob all live in the store.

---

## Adding a New Ball

1. Copy `src/balls/_template.ts` to `src/balls/yourball.ts`
2. Fill in `BallDefinition`: stats, weapon config, ability, audio profile, and the 24×24 canvas painter
3. Import and register it in `src/balls/index.ts`
4. Add a fighter preset in `src/constants/fighterPresets.ts`

The template has inline comments for every field. The existing fighters (`bloodaxe.ts`, `hawkeye.ts`, `quickflail.ts`) are the best reference for non-trivial ability and weapon configs.

Key types: `BallDefinition` (`src/balls/types.ts`), `WeaponStats`, `BallAbility`, `StatusEffectType` (`src/models/types.ts`).
