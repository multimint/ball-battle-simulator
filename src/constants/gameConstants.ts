export const ARENA_SIZE = 480;          // canvas width & height in px
export const CAPTURE_SCALE = 1.5;            // upscale factor: 480 → 720 (pixel-perfect ×1.5)
export const CAPTURE_CANVAS_WIDTH = 720;     // 480 × 1.5
export const CAPTURE_TOP_HEIGHT = 260;       // top info panel
export const CAPTURE_BOTTOM_HEIGHT = 380;    // bottom stats panel (1280 − 180 − 720)
export const CAPTURE_CANVAS_HEIGHT = 1280;   // 720 × 16/9 — TikTok-ready 9:16
export const CAPTURE_ARENA_PAD = 50;         // padding around fight area on all four sides
export const WALL_THICKNESS = 20;       // static wall body thickness
export const MAX_PARTICLES = 50;        // hard cap on simultaneous particles
export const STALEMATE_TIME_MS = 30_000; // 30 seconds → force end
// ── Speed system ──────────────────────────────────────────────────────────────
// Multiplier applied on top of each ball's maxSpeed when setting initial velocity.
// Raising this makes the whole match feel faster without touching individual presets.
export const PHYSICS_SPEED_SCALE = 1.8;
// Random speed range on spawn: speed ∈ [maxSpeed × SCALE × MIN_FRAC, maxSpeed × SCALE × MAX_FRAC]
// Keep the two values close so all fighters start at similar pace.
export const INITIAL_SPEED_MIN_FRAC = 0.88;  // 88 % of scaled maxSpeed
export const INITIAL_SPEED_MAX_FRAC = 1.00;  // 100 % of scaled maxSpeed
// Velocity ceiling: balls can momentarily exceed this after big collisions
export const VELOCITY_CLAMP = 1.8;      // max speed multiplier above maxSpeed
export const LOW_HP_THRESHOLD = 0.30;   // 30% HP triggers onLowHP weapons
export const HEAVY_HIT_THRESHOLD = 3;   // normalImpulse above this = heavy hit
export const SLOW_MOTION_FACTOR = 0.25; // physics slowdown on heavy hit
export const SLOW_MOTION_RECOVERY = 0.03; // per-frame recovery toward 1.0
export const SCREEN_SHAKE_MAGNITUDE = 6; // px
export const SCREEN_SHAKE_TTL = 18;     // frames
export const STUCK_FRAMES = 90;         // frames without movement before nudge
export const STUCK_MOVEMENT_THRESHOLD = 0.5; // px — counts as "not moving"
export const BALL_A_START = { x: 110, y: ARENA_SIZE / 2 };
export const BALL_B_START = { x: ARENA_SIZE - 110, y: ARENA_SIZE / 2 };
export const PARTICLE_BURST_COUNT = 10;  // particles per collision burst
export const FLOATER_RISE_SPEED = 0.8;  // px per frame upward
export const FLOATER_FADE_SPEED = 0.022; // alpha per frame
export const HP_RING_STROKE = 4;        // px — HP arc ring width
// ── Orbit weapon system ───────────────────────────────────────────────────────
export const WEAPON_ORBIT_GAP = 8;           // px gap between ball edge and weapon hitbox center
export const WEAPON_ORBIT_SPEED_SCALE = 1.5; // rad/s per weapon.speed unit
export const WEAPON_HIT_COOLDOWN_MIN = 320;  // ms minimum between orbit hits (prevents frame-spam)
