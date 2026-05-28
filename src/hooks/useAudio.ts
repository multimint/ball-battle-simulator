import { useRef, useEffect } from 'react';

// Howler is optional — we load it lazily to avoid crashes if audio fails
let Howl: typeof import('howler').Howl | null = null;
import('howler').then((m) => { Howl = m.Howl; }).catch(() => {});

export interface AudioSystem {
  playCollision: (intensity?: number) => void;
  playWeaponFire: () => void;
  playKO: () => void;
  playVictory: () => void;
}

// Fallback: silent stub if Howler not available
const silence: AudioSystem = {
  playCollision: () => {},
  playWeaponFire: () => {},
  playKO: () => {},
  playVictory: () => {},
};

export function useAudio(): AudioSystem {
  const audioRef = useRef<AudioSystem>(silence);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Use Web Audio API oscillator as placeholder sounds (no external files needed)
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

    function beep(freq: number, duration: number, volume = 0.15, type: OscillatorType = 'square'): void {
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(volume, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + duration);
      } catch {
        // Audio context might be suspended — ignore
      }
    }

    function resumeCtx(): void {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    }

    audioRef.current = {
      playCollision: (intensity = 1) => {
        resumeCtx();
        beep(80 + intensity * 40, 0.08, 0.1 + intensity * 0.05, 'sawtooth');
      },
      playWeaponFire: () => {
        resumeCtx();
        beep(440, 0.05, 0.08, 'square');
        setTimeout(() => beep(880, 0.05, 0.05, 'square'), 50);
      },
      playKO: () => {
        resumeCtx();
        beep(200, 0.1, 0.2, 'sawtooth');
        setTimeout(() => beep(100, 0.2, 0.2, 'sawtooth'), 100);
        setTimeout(() => beep(50, 0.4, 0.15, 'sawtooth'), 200);
      },
      playVictory: () => {
        resumeCtx();
        [523, 659, 784, 1047].forEach((freq, i) => {
          setTimeout(() => beep(freq, 0.15, 0.15, 'square'), i * 120);
        });
      },
    };
  }, []);

  return audioRef.current;
}
