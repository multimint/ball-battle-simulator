import type { HitSoundKey, AbilitySoundKey } from './types';
export type { HitSoundKey, AbilitySoundKey } from './types';

export interface AudioEvent {
  timeMs: number;
  type: 'hit' | 'bulletFire' | 'laserFire' | 'laserHit' | 'ability' | 'ko' | 'bounce';
  hitStyle?: HitSoundKey;
  abilityStyle?: AbilitySoundKey;
  /** 0–1: normalized intensity (damage / reference max for hits; always 1.0 for KO) */
  intensity: number;
}

export const AUDIO_SAMPLE_RATE = 44100;

// ── Low-level primitives ──────────────────────────────────────────────────────

function mix(dst: Float32Array, src: Float32Array, startSample: number): void {
  const end = Math.min(dst.length, startSample + src.length);
  for (let i = startSample; i < end; i++) dst[i] += src[i - startSample];
}

function makeBuffer(durationS: number): Float32Array {
  return new Float32Array(Math.ceil(durationS * AUDIO_SAMPLE_RATE));
}

type WaveType = 'sine' | 'sawtooth' | 'square' | 'noise';

function sample(wave: WaveType, phase: number): number {
  switch (wave) {
    case 'sine':     return Math.sin(phase * Math.PI * 2);
    case 'sawtooth': return (phase % 1) * 2 - 1;
    case 'square':   return Math.sin(phase * Math.PI * 2) >= 0 ? 1 : -1;
    case 'noise':    return Math.random() * 2 - 1;
  }
}

interface EnvParams { attackS: number; decayS: number; peak: number }

function oscillator(
  wave: WaveType,
  startFreq: number,
  endFreq: number,
  durationS: number,
  env: EnvParams,
): Float32Array {
  const n = Math.ceil(durationS * AUDIO_SAMPLE_RATE);
  const out = new Float32Array(n);
  let phase = 0;
  const attackN = Math.ceil(env.attackS * AUDIO_SAMPLE_RATE);
  const decayN  = n - attackN;

  for (let i = 0; i < n; i++) {
    const t = i / n;
    const freq = startFreq + (endFreq - startFreq) * t;
    phase += freq / AUDIO_SAMPLE_RATE;

    // Amplitude envelope
    let amp: number;
    if (i < attackN) {
      amp = (i / Math.max(1, attackN)) * env.peak;
    } else {
      const decayT = (i - attackN) / Math.max(1, decayN);
      amp = env.peak * Math.exp(-5 * decayT);
    }
    out[i] = sample(wave, phase) * amp;
  }
  return out;
}

/** First-order IIR low-pass filter applied in-place. */
function lowpass(buf: Float32Array, cutoffHz: number): void {
  const alpha = (2 * Math.PI * cutoffHz / AUDIO_SAMPLE_RATE) /
                (1 + 2 * Math.PI * cutoffHz / AUDIO_SAMPLE_RATE);
  let prev = 0;
  for (let i = 0; i < buf.length; i++) {
    prev = alpha * buf[i] + (1 - alpha) * prev;
    buf[i] = prev;
  }
}

/** First-order IIR high-pass filter applied in-place. */
function highpass(buf: Float32Array, cutoffHz: number): void {
  const alpha = 1 / (1 + 2 * Math.PI * cutoffHz / AUDIO_SAMPLE_RATE);
  let prevIn = 0, prevOut = 0;
  for (let i = 0; i < buf.length; i++) {
    const x = buf[i];
    const y = alpha * (prevOut + x - prevIn);
    prevIn = x; prevOut = y;
    buf[i] = y;
  }
}

/** Soft waveshaper distortion applied in-place. */
function distort(buf: Float32Array, amount: number): void {
  const k = 2 * amount / (1 - amount);
  for (let i = 0; i < buf.length; i++) {
    buf[i] = (1 + k) * buf[i] / (1 + k * Math.abs(buf[i]));
  }
}

function clampBuf(buf: Float32Array, limit = 0.95): void {
  for (let i = 0; i < buf.length; i++) buf[i] = Math.max(-limit, Math.min(limit, buf[i]));
}

// ── Per-style synthesizers ────────────────────────────────────────────────────

function synthThunderous(intensity: number): Float32Array {
  const vol  = 0.84 + intensity * 1.10;
  const dur  = 0.25 + intensity * 0.15;

  const noise = oscillator('noise', 0, 0, dur, { attackS: 0.002, decayS: dur - 0.002, peak: vol });
  lowpass(noise, 160 + intensity * 80);

  const sub = oscillator('sawtooth', 55 + intensity * 20, 30, dur * 0.4,
    { attackS: 0.002, decayS: dur * 0.4 - 0.002, peak: vol * 0.55 });

  const out = makeBuffer(dur);
  mix(out, noise, 0);
  mix(out, sub, 0);
  clampBuf(out);
  return out;
}

function synthSwift(intensity: number): Float32Array {
  const vol = 0.45 + intensity * 0.55;
  const dur = 0.18 + intensity * 0.06;
  const out = makeBuffer(dur);

  // ── Swish: air-cut noise leading into the impact ──────────────────────
  const swishDur = 0.072;
  const swishN = Math.ceil(swishDur * AUDIO_SAMPLE_RATE);
  const swish = new Float32Array(swishN);
  const atkN = Math.ceil(0.004 * AUDIO_SAMPLE_RATE);
  for (let i = 0; i < swishN; i++) {
    const env = i < atkN
      ? i / atkN
      : Math.exp(-7 * (i - atkN) / (swishN - atkN));
    swish[i] = (Math.random() * 2 - 1) * vol * 0.52 * env;
  }
  highpass(swish, 2200);
  lowpass(swish, 7500);
  mix(out, swish, 0);

  // ── Body thump: low-mid punch when the blade connects ─────────────────
  // Offset 15 ms so it lands just after the swish peaks — feels like impact
  const thumpDur = 0.08 + intensity * 0.04;
  const thump = oscillator('noise', 0, 0, thumpDur,
    { attackS: 0.001, decayS: thumpDur - 0.001, peak: vol * 0.70 });
  highpass(thump, 120);
  lowpass(thump, 700);
  mix(out, thump, Math.round(0.015 * AUDIO_SAMPLE_RATE));

  // ── Metallic blade ring ───────────────────────────────────────────────
  const clangDur = 0.13 + intensity * 0.05;
  const clang = oscillator('sine', 1000 + intensity * 180, 420, clangDur,
    { attackS: 0.001, decayS: clangDur - 0.001, peak: vol * 0.48 });
  mix(out, clang, 0);

  // ── Hard crack transient at the moment of contact ─────────────────────
  const crack = oscillator('noise', 0, 0, 0.016,
    { attackS: 0.001, decayS: 0.015, peak: vol * 0.80 });
  highpass(crack, 3800);
  mix(out, crack, 0);

  clampBuf(out);
  return out;
}

function synthArcane(intensity: number): Float32Array {
  // Bullet hit: sharp energy impact, percussive not melodic
  const vol = 0.32 + intensity * 0.6;
  const dur = 0.08 + intensity * 0.07;

  // High-freq sine that drops quickly — "zap" impact
  const zap = oscillator('sine', 1200 + intensity * 400, 280, dur,
    { attackS: 0.001, decayS: dur - 0.001, peak: vol * 0.65 });
  // Noise crack for the physical impact feel
  const crack = oscillator('noise', 0, 0, 0.025, { attackS: 0.001, decayS: 0.024, peak: vol * 0.55 });
  highpass(crack, 2200);

  const out = makeBuffer(dur);
  mix(out, zap, 0);
  mix(out, crack, 0);
  clampBuf(out);
  return out;
}

function synthArcaneFire(): Float32Array {
  // Bullet fire: quick rising "pew" laser shot
  const dur = 0.06;
  const pew = oscillator('sine', 280, 1600, dur, { attackS: 0.001, decayS: dur - 0.001, peak: 0.32 });
  // Tiny transient click at the moment of fire
  const click = oscillator('noise', 0, 0, 0.012, { attackS: 0.001, decayS: 0.011, peak: 0.18 });
  highpass(click, 3500);

  const out = makeBuffer(dur);
  mix(out, pew, 0);
  mix(out, click, 0);
  return out;
}

function synthArcaneLaserFire(): Float32Array {
  // Hitscan laser charge + beam release: electric buildup then a sharp discharge crack
  const dur = 0.30;
  const out = makeBuffer(dur);

  // Rising electric buzz — sawtooth sweep 120→900 Hz simulates capacitor charging
  const buzz = oscillator('sawtooth', 120, 900, 0.18, { attackS: 0.005, decayS: 0.175, peak: 0.30 });
  lowpass(buzz, 1800);
  mix(out, buzz, 0);

  // Beam tone: high sine that fires and quickly fades (the actual beam sound)
  const beam = oscillator('sine', 3200, 1400, 0.22, { attackS: 0.002, decayS: 0.218, peak: 0.40 });
  mix(out, beam, 0);

  // Discharge crack at the moment of firing
  const discharge = oscillator('noise', 0, 0, 0.025, { attackS: 0.001, decayS: 0.024, peak: 0.65 });
  highpass(discharge, 3000);
  mix(out, discharge, 0);

  clampBuf(out);
  return out;
}

function synthArcaneLaserHit(): Float32Array {
  // Heavy energy impact: much bigger than a normal bullet hit
  const dur = 0.45;
  const out = makeBuffer(dur);

  // Sub boom: sine sweep 180→40 Hz — the body of the impact
  const boom = oscillator('sine', 180, 40, 0.38, { attackS: 0.002, decayS: 0.378, peak: 0.70 });
  mix(out, boom, 0);

  // Electric sizzle: high-frequency energy dissipating after the hit
  const sizzle = oscillator('noise', 0, 0, 0.30, { attackS: 0.001, decayS: 0.299, peak: 0.45 });
  highpass(sizzle, 4000);
  mix(out, sizzle, 0);

  // Mid-range crunch: bandpass noise for the impact body
  const crunch = oscillator('noise', 0, 0, 0.12, { attackS: 0.001, decayS: 0.119, peak: 0.50 });
  highpass(crunch, 600);
  lowpass(crunch, 3500);
  mix(out, crunch, 0);

  clampBuf(out);
  return out;
}

function synthBerserk(): Float32Array {
  // Primal rage surge — slow swell, no sharp transient, sounds like entering a state not taking a hit
  const dur = 0.75;
  const out = makeBuffer(dur);

  // Rising growl: low sawtooth sweeping up in pitch as rage builds, heavily distorted
  const growl = oscillator('sawtooth', 65, 155, dur, { attackS: 0.13, decayS: dur - 0.13, peak: 0.78 });
  distort(growl, 0.78);
  lowpass(growl, 480);
  mix(out, growl, 0);

  // Roar body: mid-frequency noise swell — the "breath" of the roar
  const roar = oscillator('noise', 0, 0, dur, { attackS: 0.15, decayS: dur - 0.15, peak: 0.42 });
  highpass(roar, 180);
  lowpass(roar, 1100);
  mix(out, roar, 0);

  // Upper air: adds openness without a crack-like transient
  const air = oscillator('noise', 0, 0, dur * 0.55, { attackS: 0.10, decayS: dur * 0.55 - 0.10, peak: 0.18 });
  highpass(air, 2200);
  lowpass(air, 5500);
  mix(out, air, 0);

  clampBuf(out);
  return out;
}

function synthSharp(): Float32Array {
  const dur = 0.22;
  const s = oscillator('sine', 2000, 480, dur, { attackS: 0.001, decayS: dur - 0.001, peak: 0.55 });
  const out = makeBuffer(dur);
  mix(out, s, 0);
  return out;
}

function synthFrenzy(): Float32Array {
  const freqs = [380, 480, 590, 720];
  const spacing = 0.028;
  const dur = spacing * freqs.length + 0.03;
  const out = makeBuffer(dur);
  freqs.forEach((freq, i) => {
    const startS = i * spacing;
    const blip = oscillator('square', freq, freq, 0.025, { attackS: 0.002, decayS: 0.023, peak: 0.38 });
    lowpass(blip, 2000);
    mix(out, blip, Math.round(startS * AUDIO_SAMPLE_RATE));
  });
  return out;
}

function synthBounce(intensity: number): Float32Array {
  const vol = 1.30 + intensity * 0.60; // intentionally >1 — clampBuf saturates for punch
  const dur = 0.06 + intensity * 0.02;
  const out = makeBuffer(dur);

  // Sub thud: very low sine sweep — the physical mass of the ball
  const thud = oscillator('sine', 80 + intensity * 30, 28, dur,
    { attackS: 0.002, decayS: dur - 0.002, peak: vol * 0.90 });
  mix(out, thud, 0);

  // Low-freq noise body: adds the dull "thok" texture, no high content
  const body = oscillator('noise', 0, 0, dur * 0.5,
    { attackS: 0.001, decayS: dur * 0.5 - 0.001, peak: vol * 0.40 });
  lowpass(body, 350);
  mix(out, body, 0);

  return out;
}

function synthKO(): Float32Array {
  const dur = 0.55;
  const out = makeBuffer(dur);

  // Sub thud: low sawtooth sweeping 130→20 Hz — the heavy "boom"
  const sub = oscillator('sawtooth', 130, 20, 0.45, { attackS: 0.002, decayS: 0.448, peak: 0.85 });
  lowpass(sub, 280);
  mix(out, sub, 0);

  // Body punch: sine 200→60 Hz — adds resonant weight
  const body = oscillator('sine', 200, 60, 0.30, { attackS: 0.003, decayS: 0.297, peak: 0.65 });
  mix(out, body, 0);

  // Crack transient: noise burst — sharp high-frequency attack on impact
  const crack = oscillator('noise', 0, 0, 0.06, { attackS: 0.001, decayS: 0.059, peak: 0.7 });
  highpass(crack, 2800);
  mix(out, crack, 0);

  // Low noise rumble: adds texture to the decay
  const rumble = oscillator('noise', 0, 0, 0.35, { attackS: 0.003, decayS: 0.347, peak: 0.25 });
  lowpass(rumble, 180);
  mix(out, rumble, 0);

  clampBuf(out);
  return out;
}


// ── Sound registries — add a new key here to support a new ball sound ────────
//
// To add a new hit sound:   add a key to HitSoundKey above + entry here.
// To add a new ability sound: add a key to AbilitySoundKey above + entry here.

const HIT_SOUNDS: Record<HitSoundKey, (intensity: number) => Float32Array> = {
  thunderous: synthThunderous,
  swift:      synthSwift,
  arcane:     synthArcane,
};

const ABILITY_SOUNDS: Record<AbilitySoundKey, () => Float32Array> = {
  berserk: synthBerserk,
  sharp:   synthSharp,
  frenzy:  synthFrenzy,
};

// Bullet-fire sounds keyed by hitStyle — only styles that fire bullets need an entry.
const BULLET_FIRE_SOUNDS: Partial<Record<HitSoundKey, () => Float32Array>> = {
  arcane: synthArcaneFire,
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Synthesizes all fight audio events into a mono Float32Array (44100 Hz PCM).
 * Pure JavaScript — no Web Audio API required, works in any execution context
 * including Dedicated Web Workers.
 */
export function synthesizeFightAudio(
  events: AudioEvent[],
  durationMs: number,
): Float32Array {
  const durationS = durationMs / 1000;
  const out = new Float32Array(Math.ceil(durationS * AUDIO_SAMPLE_RATE));

  for (const ev of events) {
    const startSample = Math.round((ev.timeMs / 1000) * AUDIO_SAMPLE_RATE);
    if (startSample < 0 || startSample >= out.length) continue;

    let signal: Float32Array | null = null;

    if (ev.type === 'hit' && ev.hitStyle) {
      signal = HIT_SOUNDS[ev.hitStyle]?.(ev.intensity) ?? null;
    } else if (ev.type === 'bulletFire' && ev.hitStyle) {
      signal = BULLET_FIRE_SOUNDS[ev.hitStyle]?.() ?? null;
    } else if (ev.type === 'laserFire') {
      signal = synthArcaneLaserFire();
    } else if (ev.type === 'laserHit') {
      signal = synthArcaneLaserHit();
    } else if (ev.type === 'ability' && ev.abilityStyle) {
      signal = ABILITY_SOUNDS[ev.abilityStyle]?.() ?? null;
    } else if (ev.type === 'ko') {
      signal = synthKO();
    } else if (ev.type === 'bounce') {
      signal = synthBounce(ev.intensity);
    }

    if (signal) mix(out, signal, startSample);
  }

  // Normalize to prevent clipping if many sounds overlap
  let peak = 0;
  for (let i = 0; i < out.length; i++) if (Math.abs(out[i]) > peak) peak = Math.abs(out[i]);
  if (peak > 0.95) {
    const scale = 0.9 / peak;
    for (let i = 0; i < out.length; i++) out[i] *= scale;
  }

  return out;
}
