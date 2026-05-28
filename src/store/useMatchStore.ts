import { create } from 'zustand';

interface MatchStore {
  // ─── Live Match State ──────────────────────────────────────────────────────
  hp: { A: number; B: number };
  maxHp: { A: number; B: number };
  damageDealt: { A: number; B: number };   // cumulative damage shown in HUD
  turnsElapsed: number;                     // collision count used as "turns"
  matchStartTime: number;                   // Date.now() when match began

  // ─── Actions ──────────────────────────────────────────────────────────────
  initMatch: (durabilityA: number, durabilityB: number) => void;
  applyDamage: (team: 'A' | 'B', amount: number) => void;
  incrementTurns: () => void;
  resetMatch: () => void;
}

export const useMatchStore = create<MatchStore>((set) => ({
  hp: { A: 100, B: 100 },
  maxHp: { A: 100, B: 100 },
  damageDealt: { A: 0, B: 0 },
  turnsElapsed: 0,
  matchStartTime: 0,

  initMatch: (durabilityA, durabilityB) =>
    set({
      hp: { A: durabilityA, B: durabilityB },
      maxHp: { A: durabilityA, B: durabilityB },
      damageDealt: { A: 0, B: 0 },
      turnsElapsed: 0,
      matchStartTime: performance.now(),
    }),

  applyDamage: (team, amount) =>
    set((s) => {
      // actual damage dealt = capped at remaining HP
      const actualDmg = Math.min(amount, s.hp[team]);
      const newHp = Math.max(0, s.hp[team] - amount);
      // The OPPONENT is the one who "dealt" this damage
      const opponent = team === 'A' ? 'B' : 'A';
      return {
        hp: { ...s.hp, [team]: newHp },
        damageDealt: {
          ...s.damageDealt,
          [opponent]: s.damageDealt[opponent] + actualDmg,
        },
      };
    }),

  incrementTurns: () => set((s) => ({ turnsElapsed: s.turnsElapsed + 1 })),

  resetMatch: () =>
    set({
      hp: { A: 100, B: 100 },
      maxHp: { A: 100, B: 100 },
      damageDealt: { A: 0, B: 0 },
      turnsElapsed: 0,
      matchStartTime: 0,
    }),
}));
