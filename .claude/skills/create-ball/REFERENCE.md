# Create Ball — Reference

## Balance Table

Pick midpoint values for the chosen role; adjust for flavour.

| Role         | radius | mass    | maxSpeed | friction | restitution | spinSpeed | durability | attackPower | knockbackPower | weapon orbit speed |
|--------------|--------|---------|----------|----------|-------------|-----------|------------|-------------|----------------|--------------------|
| Tank         | 28–32  | 4–6     | 2.5–4    | 0.20     | 0.3         | 1.0–1.5   | 130–180    | 70–90       | 90–120         | 3.0–5.0 rad/s      |
| Speedster    | 18–22  | 1–2     | 7–10     | 0.10     | 0.5         | 3.5–5.0   | 50–75      | 45–60       | 25–40          | 8.0–12.0 rad/s     |
| Glass Cannon | 16–20  | 1–1.5   | 6–8      | 0.05     | 0.6         | 4.0–6.0   | 25–45      | 90–120      | 15–30          | 10.0–15.0 rad/s    |
| Support      | 22–26  | 2–3     | 4–6      | 0.15     | 0.4         | 2.0–3.0   | 80–110     | 40–60       | 40–70          | 4.0–6.0 rad/s      |
| Chaos        | 20–26  | 1.5–3.5 | 5–8      | 0.10     | 0.5         | 3.0–5.0   | 60–100     | 60–90       | 50–80          | 6.0–10.0 rad/s     |

**Weapon orbit speed** is `weapon.speed × WEAPON_ORBIT_SPEED_SCALE (1.5)` rad/s. To hit a target orbit speed, set `weapon.speed = target / 1.5`. Example: 9 rad/s → `weapon.speed = 6.0`.

**Note:** All `fighterPresets.ts` entries override radius to `BALL_RADIUS = 24` and speed to `BALL_SPEED = 5.5` for balance. If your ball's role requires a different speed (Speedster, Glass Cannon), use an explicit value instead of `BALL_SPEED`.

---

## Passive Power Budget

Rate the passive ability's peak strength before picking base stats. A powerful passive must be offset by weaker base stats — total power = base stats + passive.

### Passive power tier table

| Tier | Description | Examples | attackPower discount | durability discount |
|------|-------------|---------|----------------------|---------------------|
| **Weak** | Minor effect, rarely active or tiny magnitude | Small HP regen, tiny speed tick | 0% | 0% |
| **Medium** | Meaningful but situational | Burn on hit (1 stack), harden when struck | 15% | 0% |
| **Strong** | Significant advantage, often active | Rage at low HP (+50% dmg), lifesteal on hit | 30% | 10% |
| **Extreme** | Game-changing, compounds or permanent | Permanent stacking speed (+210%), shield regen loop | 50–70% | 15–20% |

### How to apply

1. Rate the passive using the table above.
2. Take the role's midpoint `attackPower` and multiply by `(1 - discount)`.
3. For Extreme tier, also reduce `durability` by the listed amount.
4. If user chose **conservative lean**, apply an additional 10% reduction to `attackPower`.
5. If user chose **aggressive lean**, use the full midpoint values (no extra reduction).

### Examples

| Ball | Passive | Tier | Raw attackPower | After discount |
|------|---------|------|-----------------|---------------|
| Bloodrage | Rage at low HP (+50% dmg, situational) | Strong | 65 | 65 (already tuned) |
| Quickstrike | Permanent stacking +210% speed (5 stacks) | Extreme | 45 (Speedster mid) | ~10–15 |
| Poison Creep | Poison DoT on hit (no stack, slow) | Medium | 50 (Support mid) | ~42 |

---

## Effective DPS Formula

Use this to anchor a new ball's output *before* writing code and show it in the Step 2c summary.

**Bloodrage reference:**
> 45 (weapon dmg) × 0.65 (attackPower/100) ÷ 0.8s (cooldown) ≈ **37 effective DPS**

**Formula:**
> `baseline DPS = weapon.damage × (attackPower / 100) / weapon.cooldown`

**Passive multiplier estimates:**

| Passive type | DPS multiplier estimate |
|-------------|------------------------|
| Speed boost +X% (sustained) | × (1 + X × 0.4) — faster movement ≈ more frequent hits |
| Burn/poison DoT | + magnitude × stacks HP/s (additive) |
| Rage +X% damage | × (1 + X) while active |
| Lifesteal | no DPS change — reduces effective incoming damage |
| Shield | no DPS change — reduces effective incoming damage |

**Target baseline DPS by role** (before passive):

| Role | Conservative target | Aggressive target |
|------|--------------------|--------------------|
| Tank | 20–28 | 28–38 |
| Speedster | 15–22 | 22–32 |
| Glass Cannon | 40–55 | 55–75 |
| Support | 8–15 | 15–22 |
| Chaos | 25–40 | 40–55 |

---

## Ability Catalog

Map the user's plain-English description to one of these types:

| BallAbilityType | When it fires | Params | Example concept |
|-----------------|---------------|--------|-----------------|
| `trail`         | Every physics tick | `damagePerTick`, `tickInterval`, `trailDuration`, `color` | "leaves fire/ice/poison behind" |
| `onBounce`      | Ball hits arena wall | `radius`, `damage`, `knockback`, `color` | "explodes on bounce", "shockwave on wall hit" |
| `onHitDealt`    | Ball's weapon lands a hit | `effect` (`'ignite'|'slow'|'lifesteal'`), `value` | "life steals on attack", "ignites enemy on hit" |
| `onHitReceived` | Ball takes damage | `effect` (`'reflect'|'retaliate'|'harden'`), `value` | "reflects 20% damage back", "gains armor after being hit" |
| `onLowHP`       | HP drops below threshold | `threshold` (0–1), `effect` (`'rage'|'shield'|'burst'`), `multiplier` | "goes berserk below 30% HP", "gains a shield at low HP" |
| `passive`       | Always active | `regenPerTick`, `reflectPct`, `speedBonus` | "slowly regens HP", "always moving faster" |
| `spawnUnit`     | Triggered on timer or on hit | `unitRadius`, `unitDamage`, `orbitRadius`, `count`, `spawnInterval` | "spawns mini clones", "creates orbiting drones" |

---

## Buff/Debuff Catalog

Status effects are applied via `BallAbility.params` — no custom `case` needed in most situations. Use the generic system by setting `statusEffect` in the ability's `params`.

### Status effect types

| StatusEffectType | Target | What it does | Stacking |
|-----------------|--------|--------------|---------|
| `burn` | enemy | X HP/sec damage over time | stack (intensity ×stacks) |
| `poison` | enemy | X HP/sec slower DoT | ignore (no stack) |
| `freeze` | enemy | reduces speed by X% | refresh |
| `weaken` | enemy | reduces outgoing damage by X% | refresh |
| `rage` | self | increases outgoing damage by X% | refresh |
| `harden` | self | reduces incoming damage by X% | refresh |
| `speedBoost` | self | increases speed by X% | refresh |
| `lifesteal` | self | restores X% of damage dealt as HP | refresh |
| `shield` | self | absorbs X flat damage before HP is reduced | ignore |

### Params for buff/debuff abilities

When `params.statusEffect` is set, the generic handler in `applyBallAbility()` fires automatically — no custom `case` needed.

```typescript
params: {
  statusEffect: 'burn',       // StatusEffectType
  statusTarget: 'enemy',      // 'self' | 'enemy'
  statusDuration: 3000,       // milliseconds the effect lasts
  statusMagnitude: 0.15,      // effect strength (0.15 = 15% for multipliers, 15 HP/s for DoT)
  stackBehavior: 'stack',     // 'refresh' | 'stack' | 'ignore'
  maxStacks: 3,               // max stack count (for 'stack' behavior)
  statusColor: '#FF4400',     // ring color on the ball
  statusIcon: '🔥',           // icon shown above ball
}
```

### Magnitude guide

| Effect | magnitude meaning | good default |
|--------|------------------|--------------|
| burn / poison | HP lost per second | 8–20 |
| freeze | speed reduction fraction | 0.3–0.6 (30–60%) |
| weaken | damage reduction fraction | 0.2–0.4 |
| rage | damage boost fraction | 0.3–0.6 |
| harden | damage absorbed fraction | 0.3–0.5 |
| speedBoost | speed boost fraction | 0.3–0.8 |
| lifesteal | fraction of damage healed | 0.15–0.35 |
| shield | flat HP absorbed | 20–60 |

### Example: "Burns enemy on weapon hit"

```typescript
ability: {
  id: 'inferno-burn',
  name: 'Inferno Touch',
  description: 'Burns the enemy for 3 seconds on each weapon hit.',
  trigger: 'onHitDealt',
  params: {
    statusEffect: 'burn',
    statusTarget: 'enemy',
    statusDuration: 3000,
    statusMagnitude: 12,
    stackBehavior: 'stack',
    maxStacks: 3,
    statusColor: '#FF4400',
    statusIcon: '🔥',
  },
},
```

### Example: "Gains rage below 30% HP"

```typescript
ability: {
  id: 'berserker-rage',
  name: 'Blood Rage',
  description: 'Damage output +50% when below 30% HP.',
  trigger: 'onLowHP',
  params: {
    statusEffect: 'rage',
    statusTarget: 'self',
    statusDuration: 1200,       // short — re-applies every tick while low HP
    statusMagnitude: 0.5,
    stackBehavior: 'refresh',
    maxStacks: 1,
    statusColor: '#FF0000',
    statusIcon: '💢',
    threshold: 0.3,
  },
},
```

### Adding a second status effect (e.g. speedBoost alongside rage)

The generic handler applies **one** `statusEffect`. To add a second effect (like speedBoost on top of rage), add secondary params and handle them in a custom `case` in `applyBallAbility()`:

```typescript
// In ability params:
params: {
  // primary effect (generic handler)
  statusEffect: 'rage', statusTarget: 'self', statusDuration: 3000, statusMagnitude: 0.5,
  stackBehavior: 'refresh', maxStacks: 1, statusColor: '#FF4400', statusIcon: '💢',
  threshold: 0.3,
  // secondary speed boost (handled in your switch case)
  speedBoostDuration: 3000,
  speedBoostMagnitude: 0.7,     // +70% speed
  speedBoostColor: '#FF8800',
  speedBoostIcon: '⚡',
},

// In applyBallAbility() switch:
case 'your-ability-id': {
  this.applyStatusEffect(
    team, 'speedBoost',
    Number(p.speedBoostDuration ?? 3000),
    Number(p.speedBoostMagnitude ?? 0.4),
    'refresh', 1,
    p.speedBoostColor as string ?? '#FF8800',
    p.speedBoostIcon as string ?? '⚡',
  );
  break;
}
```

---

## Hit Effects

Every weapon hit automatically triggers visual effects based on its **category**. No code needed — the tier fires from `processHit()` in `GameSimulator.ts`.

### Weapon category tiers (auto-applied)

| Category | Screen flash | Ball hit flash | Screen shake | Slow motion |
|----------|-------------|----------------|--------------|-------------|
| `melee` | — | ✅ defender flashes weapon color | only for Heavy Hammer | — |
| `projectile` | ✅ weapon color, α=0.22 | — | only for heavy projectiles | — |
| `aoe` | ✅ weapon color, α=0.40 | ✅ defender flashes white | ✅ (existing heavyHit) | ✅ |
| `shield` | — | ✅ attacker flashes weapon color | — | — |
| `utility` | — | — | only for Repulsor | — |

### Ability-triggered screen effects (optional params)

To trigger screen effects from a passive ability, add any of these params to the ability's `params` object:

```typescript
params: {
  // ... existing status effect params ...

  // Ball hit flash (on the ball that owns this ability, or its enemy)
  hitFlash: true,
  hitFlashColor: '#FF4400',      // color of the overlay
  hitFlashTarget: 'self',        // 'self' | 'enemy'

  // Full-canvas color overlay
  hitScreenFlash: true,
  hitScreenFlashColor: '#FF2200',
  hitScreenFlashAlpha: 0.35,     // 0–1
  hitScreenFlashTtl: 5,          // frames

  // Screen shake
  hitShakeMagnitude: 4,          // 1–8 (matches existing SCREEN_SHAKE_MAGNITUDE scale)

  // Slow motion
  hitSlowMo: true,               // triggers SLOW_MOTION_FACTOR (0.25×) for ~8 frames
}
```

**Example — rage state that also flashes the ball red and shakes the screen:**
```typescript
ability: {
  id: 'bloodrage-fury',
  trigger: 'onLowHP',
  params: {
    threshold: 0.3,
    statusEffect: 'rage',
    statusTarget: 'self',
    statusDuration: 3000,
    statusMagnitude: 0.5,
    stackBehavior: 'refresh',
    maxStacks: 1,
    statusColor: '#FF4400',
    statusIcon: '💢',
    // Screen effects when rage activates
    hitFlash: true,
    hitFlashColor: '#FF2200',
    hitFlashTarget: 'self',
    hitShakeMagnitude: 3,
  },
},
```

---

## Berserk System

Any ball with `trigger: 'onLowHP'` automatically unlocks the **berserk system** when its HP drops below `threshold`. No extra params or code required — the engine detects it via `isBerserk(team)` in `GameSimulator.ts`.

### What activates automatically

**Weapon orbit speed** (`updateWeaponOrbit`):
- Weapon spins **2.5× faster** during berserk — visible blur of the orbiting weapon

**Hit velocity burst** (`applyHit`, after every weapon hit while berserk):
- Struck enemy gets a **2.5× stronger velocity burst** in the hit direction
- Enemy also receives a stronger, longer `speedBoost` debuff

| State | Orbit multiplier | Hit burst cap | Enemy speedBoost | Duration |
|-------|-----------------|--------------|------------------|----------|
| Normal | 1× | 6 px/s | +45–70% | 540–700ms |
| Berserk | **2.5×** | **10 px/s** | **+70–120%** | **700–1000ms** |

### Adding a speed trail during berserk

To add a fading orb trail in the `bloodrage-fury`-style switch case:

```typescript
case 'your-ability-id': {
  // ... status effects ...
  if (Math.random() < 0.7) {
    const ballRadius = (team === 'A' ? this.teamA : this.teamB).ball.radius;
    this.trailSegments.push({
      x: body.position.x,
      y: body.position.y,
      radius: ballRadius * 0.8,
      color: '#FF2200',
      alpha: 0.55,
      ttl: 12,
      maxTtl: 12,
    });
  }
  break;
}
```

---

## Weapon Shape

Every weapon orbits the ball and is drawn in `src/rendering/drawOrbitWeapon.ts`.

### Coordinate system

- Origin `(0, 0)` is the weapon's world position (already translated)
- **+X points radially outward** — this is the business end (blade tip, hammer head, barrel mouth)
- **-X points toward the ball** — this is where the handle starts
- `r` is the weapon's hitbox radius (20 for melee, 17 for projectile, 24 for shield/aoe, 18 for utility)

### How to add a named weapon shape

Find the correct shape function for the weapon's category and add an `else if` branch **before the final `else`**:

| Category | Function |
|----------|----------|
| `melee` | `drawMeleeShape()` |
| `shield` | `drawShieldShape()` — no name branching needed (one shape fits all) |
| `projectile` | `drawProjectileShape()` |
| `aoe` | `drawAoeShape()` — no name branching needed |
| `utility` | `drawUtilityShape()` |

```typescript
} else if (weapon.name === 'Your Weapon Name') {
  // draw shape here — see templates below
}
```

### Shape templates

**Axe** (melee — blade at +X, handle at -X):
```typescript
// Handle
ctx.strokeStyle = '#7A5C2E';
ctx.lineWidth = 3;
ctx.lineCap = 'round';
ctx.beginPath();
ctx.moveTo(-r * 1.0, 0);
ctx.lineTo(r * 0.2, 0);
ctx.stroke();
// Crescent blade
ctx.fillStyle = color;
ctx.shadowBlur = 8;
ctx.beginPath();
ctx.moveTo(r * 0.1, -r * 0.8);
ctx.lineTo(r * 0.85, -r * 1.1);
ctx.quadraticCurveTo(r * 1.5, 0, r * 0.85, r * 1.1);
ctx.lineTo(r * 0.1, r * 0.8);
ctx.closePath();
ctx.fill();
ctx.strokeStyle = '#FFFFFF44';
ctx.lineWidth = 1.5;
ctx.stroke();
```

**Dagger / Short Blade** (melee — thin stiletto tip at +X):
```typescript
ctx.fillStyle = color;
ctx.shadowBlur = 6;
ctx.beginPath();
ctx.moveTo(r * 1.2, 0);           // sharp tip
ctx.lineTo(r * 0.1, r * 0.14);   // guard bottom
ctx.lineTo(-r * 0.5, r * 0.09);  // pommel
ctx.lineTo(-r * 0.5, -r * 0.09);
ctx.lineTo(r * 0.1, -r * 0.14);  // guard top
ctx.closePath();
ctx.fill();
```

**Mace / Club** (melee — spiked head at +X):
```typescript
// Handle
ctx.strokeStyle = color;
ctx.lineWidth = 3;
ctx.lineCap = 'round';
ctx.beginPath();
ctx.moveTo(-r * 0.9, 0);
ctx.lineTo(r * 0.3, 0);
ctx.stroke();
// Flanged head
ctx.fillStyle = color;
ctx.shadowBlur = 8;
ctx.beginPath();
ctx.arc(r * 0.7, 0, r * 0.5, 0, Math.PI * 2);
ctx.fill();
// Spikes
ctx.strokeStyle = color;
ctx.lineWidth = 2;
for (let i = 0; i < 6; i++) {
  const a = (i / 6) * Math.PI * 2;
  ctx.beginPath();
  ctx.moveTo(r * 0.7 + Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5);
  ctx.lineTo(r * 0.7 + Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9);
  ctx.stroke();
}
```

**Scythe** (melee — curved blade arcing to +X and sweeping up):
```typescript
// Handle
ctx.strokeStyle = color;
ctx.lineWidth = 3;
ctx.lineCap = 'round';
ctx.beginPath();
ctx.moveTo(-r * 1.0, r * 0.4);
ctx.lineTo(r * 0.5, 0);
ctx.stroke();
// Curved blade
ctx.fillStyle = color;
ctx.shadowBlur = 8;
ctx.beginPath();
ctx.moveTo(r * 0.4, r * 0.1);
ctx.quadraticCurveTo(r * 1.4, -r * 0.3, r * 0.9, -r * 1.2);
ctx.lineTo(r * 0.7, -r * 1.0);
ctx.quadraticCurveTo(r * 1.1, -r * 0.3, r * 0.2, r * 0.0);
ctx.closePath();
ctx.fill();
ctx.strokeStyle = '#FFFFFF44';
ctx.lineWidth = 1.5;
ctx.stroke();
```

**Cannon / Gun barrel** (projectile — barrel mouth at +X):
```typescript
// Barrel
ctx.fillStyle = color;
ctx.shadowBlur = 8;
ctx.beginPath();
ctx.rect(-r * 0.3, -r * 0.28, r * 1.3, r * 0.56);
ctx.fill();
// Muzzle ring
ctx.strokeStyle = '#FFFFFF66';
ctx.lineWidth = 2;
ctx.beginPath();
ctx.arc(r * 1.0, 0, r * 0.28, 0, Math.PI * 2);
ctx.stroke();
// Body block
ctx.fillStyle = color + 'CC';
ctx.beginPath();
ctx.rect(-r * 0.6, -r * 0.5, r * 0.5, r * 1.0);
ctx.fill();
```

**Wand / Staff tip** (utility / projectile — orb at +X):
```typescript
// Shaft
ctx.strokeStyle = color;
ctx.lineWidth = 2.5;
ctx.lineCap = 'round';
ctx.beginPath();
ctx.moveTo(-r * 0.9, 0);
ctx.lineTo(r * 0.5, 0);
ctx.stroke();
// Glowing orb
ctx.fillStyle = color;
ctx.shadowBlur = 14;
ctx.beginPath();
ctx.arc(r * 0.8, 0, r * 0.38, 0, Math.PI * 2);
ctx.fill();
ctx.strokeStyle = '#FFFFFF88';
ctx.lineWidth = 1;
ctx.stroke();
```

---

## Code Templates

### `types-template`

> **Pre-scaffolded** — `BallAbility`, `BallAbilityType`, and `ability?` on `BallStats` are already in `src/models/types.ts`. Skip this step entirely.

---

### `ball-template`

Append to `src/constants/ballPresets.ts`. Update the import to include `BallAbility` if needed:

```typescript
import type { BallStats, BallAbility } from '../models/types';

// At the bottom of BALL_PRESETS array:
{
  name: 'YOUR_BALL_NAME',
  radius: 24,           // use role-appropriate value
  mass: 3.0,
  maxSpeed: 5.5,
  friction: 0.15,
  restitution: 0.4,
  spinSpeed: 2.5,
  durability: 100,
  attackPower: 60,
  knockbackPower: 60,
  color: '#RRGGBB',
  icon: '🔥',
  ability: {
    id: 'your-ability-id',
    name: 'Ability Name',
    description: 'What it does in one sentence.',
    trigger: 'trail',   // pick from BallAbilityType
    params: {
      // ability-specific params from the catalog
    },
  },
},
```

---

### `fighter-template`

Append to `src/constants/fighterPresets.ts` inside `FIGHTER_PRESETS`:

```typescript
{
  id: 'your-fighter-id',
  name: 'Fighter Display Name',
  lore: 'One-line flavour text.',
  icon: '🔥',
  ball: {
    name: 'YOUR_BALL_NAME',
    radius: BALL_RADIUS, mass: X, maxSpeed: BALL_SPEED,
    friction: 0.15, restitution: 0.4, spinSpeed: 2.5,
    durability: 100, attackPower: 60, knockbackPower: 60,
    color: '#RRGGBB', icon: '🔥',
    ability: { /* same ability object as ballPresets entry */ },
  },
  weapon: {
    name: 'Weapon Name',
    category: 'melee',   // or projectile, aoe, shield, utility
    damage: 60, knockback: 60,
    range: 1.0, speed: 4.0, cooldown: 1.5,
    trigger: 'onCollision',
    description: 'What the weapon does.',
    color: '#AABBCC',
  },
},
```

---

### `simulator-hooks`

> **Pre-scaffolded** — `applyBallAbility()` method, all call sites (tick/wall-bounce/hit), and `trailSegments` field are already in `GameSimulator.ts`.

**When `/create-ball` adds a new ability, only add a `case` inside the existing switch:**

#### Add a case inside `applyBallAbility()` switch (before the `default:` line)

```typescript
case 'YOUR_ABILITY_ID': {
  // Implement the ability logic here.
  // Available: body.position, opponentBody.position, this.hp, this.particles,
  //            this.weaponEffects, this.trailSegments, context.delta, context.x, context.y
  // Spawn particles:  spawnParticleBurst(this.particles, x, y, color, count, MAX_PARTICLES)
  // Add trail (full object shape):
  //   this.trailSegments.push({
  //     x: body.position.x,      // world X
  //     y: body.position.y,      // world Y
  //     radius: 18,              // visual size (px) — use ballRadius * 0.8 for orb style
  //     color: '#FF2200',        // fill color
  //     alpha: 0.55,             // starting opacity (0–1)
  //     ttl: 12,                 // frames until gone
  //     maxTtl: 12,              // same as ttl at spawn
  //   });
  //   Use if (Math.random() < 0.7) { ... } for organic look instead of every frame
  // Deal damage:      this.hp[team === 'A' ? 'B' : 'A'] = Math.max(0, this.hp[team === 'A' ? 'B' : 'A'] - Number(p.damage))
  // Apply force:      Body.applyForce(opponentBody, opponentBody.position, { x: fx, y: fy })
  // Heal self:        this.hp[team] = Math.min(this.maxHp[team], this.hp[team] + Number(p.healAmount))
  break;
}
```

---

### `renderer-hooks`

> **Pre-scaffolded** — `trailSegments`, `abilityA`, `abilityB` are already in `RenderState` and trail rendering is wired in `Renderer.render()`.

**For simple effects (particles, flashes):** Reuse `spawnParticleBurst()` directly in `applyBallAbility()` — no Renderer changes needed.

**For trail effects:** Push to `this.trailSegments` inside `applyBallAbility()` — it renders automatically.

**For aura/glow effects at low HP or rage mode — in `drawBall.ts`:**

After the existing low-HP red overlay, add an ability aura:
```typescript
if (ability?.trigger === 'onLowHP' && hpFraction < Number(ability.params.threshold ?? 0.3)) {
  ctx.save();
  ctx.shadowColor = ability.params.statusColor as string ?? '#FF0000';
  ctx.shadowBlur = 20;
  ctx.strokeStyle = ability.params.statusColor as string ?? '#FF0000';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, y, radius + 4, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}
```

Pass `ability` to `drawBall()` calls in `Renderer.render()` for this to work.
