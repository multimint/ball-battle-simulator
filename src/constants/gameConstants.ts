export const ARENA_SIZE = 480;          // canvas width & height in px
export const CAPTURE_SCALE = 2.25;           // upscale factor: 480 → 1080 (×2.25)
export const CAPTURE_CANVAS_WIDTH = 1080;    // 1080p wide
export const CAPTURE_TOP_HEIGHT = 220;       // top info panel
export const CAPTURE_BOTTOM_HEIGHT = 352;    // bottom stats panel (1920 − 488 − 1080)
export const CAPTURE_CANVAS_HEIGHT = 1920;   // 1080p × 16/9 — TikTok-ready 9:16 HD
export const CAPTURE_ARENA_PAD = 75;         // padding around fight area on all four sides
export const WALL_THICKNESS = 20;       // static wall body thickness
export const MAX_PARTICLES = 50;        // hard cap on simultaneous particles
export const STALEMATE_TIME_MS = 30_000; // 30 seconds → force end
export const PHYSICS_STEP_MS = 1000 / 60; // physics loop step: 60 Hz
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
// ── Berserk homing ────────────────────────────────────────────────────────────
export const BERSERK_HOMING_BLEND = 0.25;       // fraction of velocity steered toward enemy per tick
export const BERSERK_TRAIL_SPAWN_CHANCE = 0.65; // probability of spawning a trail segment while homing
// ── Soft ball attraction ──────────────────────────────────────────────────────
export const SOFT_ATTRACT_THRESHOLD_PX = 200;   // distance above which balls pull toward each other
export const SOFT_ATTRACT_FORCE_COEFF = 0.000004; // force per excess px
// ── Audio cooldowns ───────────────────────────────────────────────────────────
export const BOUNCE_COOLDOWN_MS = 120;          // min ms between bounce audio events
export const ABILITY_AUDIO_COOLDOWN_MS = 600;   // min ms between repeated ability audio events
// ── Orbit weapon system ───────────────────────────────────────────────────────
export const WEAPON_ORBIT_GAP = 8;           // px gap between ball edge and weapon hitbox center
export const WEAPON_ORBIT_SPEED_SCALE = 1.5; // rad/s per weapon.speed unit
export const WEAPON_HIT_COOLDOWN_MIN = 320;  // ms minimum between orbit hits (prevents frame-spam)
// ── Intro / result card timing ────────────────────────────────────────────────
export const INTRO_DURATION_S = 2;           // seconds of intro card before fight
export const RESULT_DURATION_S = 3;          // seconds of result card after fight
export const WHITE_FLASH_FRAMES = 3;         // solid-white frames at each scene transition
// ── Berserk system ────────────────────────────────────────────────────────────
export const BERSERK_SPIN_MULT = 3.5;        // angular velocity multiplier when berserk
export const BERSERK_BURST_MULT = 2.5;       // hit velocity burst multiplier when berserk
export const BERSERK_TRAIL_COLOR = '#FF3300'; // homing trail particle color
// ── Weapon hitscan system ─────────────────────────────────────────────────────
export const HITSCAN_PREFIRE_MS = 150;       // ms delay before hitscan fires (visual telegraph)
export const BERSERK_ORBIT_SPEED_MULT = 2.5; // orbit speed multiplier when berserk
// ── Weapon trigger thresholds ─────────────────────────────────────────────────
export const WEAPON_SPEED_TRIGGER_FRAC = 0.70;  // ball must reach 70% of maxSpeed to fire onSpeed weapons
export const WEAPON_EDGE_THRESHOLD_PX  = 80;    // within 80 px of any wall fires onEdge weapons
