import { create } from 'zustand';
import type { GamePhase, WinnerType, TeamConfig, TeamId, FighterPreset } from '../models/types';
import { FIGHTER_PRESETS } from '../constants/fighterPresets';
import {
  PHYSICS_SPEED_SCALE,
  INITIAL_SPEED_MIN_FRAC,
  INITIAL_SPEED_MAX_FRAC,
} from '../constants/gameConstants';

export interface InitialVelocities {
  velA: { x: number; y: number };
  velB: { x: number; y: number };
}

export interface SimulationResult {
  winner: WinnerType;
  damageDealt: { A: number; B: number };
  turnsElapsed: number;
}

interface GameStore {
  phase: GamePhase;

  teamA: TeamConfig;
  teamB: TeamConfig;

  initialVelocities: InitialVelocities | null;
  preSimBlob: Blob | null;
  simulationResult: SimulationResult | null;

  setTeamName: (team: TeamId, name: string) => void;
  setFighterConfig: (team: TeamId, fighter: FighterPreset) => void;

  startNewSimulation: () => void;
  replaySimulation: () => void;
  setSimulationComplete: (blob: Blob, vels: InitialVelocities, result: SimulationResult) => void;
  resetToSetup: () => void;
}

const defaultTeamA: TeamConfig = {
  name: FIGHTER_PRESETS[0].name,
  ball: FIGHTER_PRESETS[0].ball,
  weapon: FIGHTER_PRESETS[0].weapon,
};

const defaultTeamB: TeamConfig = {
  name: FIGHTER_PRESETS[0].name,
  ball: FIGHTER_PRESETS[0].ball,
  weapon: FIGHTER_PRESETS[0].weapon,
};

function randomVelocity(maxSpeed: number, baseAngle: number): { x: number; y: number } {
  const scaled = maxSpeed * PHYSICS_SPEED_SCALE;
  const spd = scaled * (0.95 + Math.random() * 0.15);
  const angle = baseAngle + (Math.random() - 0.5) * Math.PI * 0.7;
  return { x: Math.cos(angle) * spd, y: Math.sin(angle) * spd };
}

export const useGameStore = create<GameStore>((set, get) => ({
  phase: 'setup',
  teamA: defaultTeamA,
  teamB: defaultTeamB,
  initialVelocities: null,
  preSimBlob: null,
  simulationResult: null,

  setTeamName: (team, name) =>
    set((s) => ({
      teamA: team === 'A' ? { ...s.teamA, name } : s.teamA,
      teamB: team === 'B' ? { ...s.teamB, name } : s.teamB,
    })),

  setFighterConfig: (team, fighter) =>
    set((s) => ({
      teamA: team === 'A'
        ? { ...s.teamA, name: fighter.name, ball: fighter.ball, weapon: fighter.weapon }
        : s.teamA,
      teamB: team === 'B'
        ? { ...s.teamB, name: fighter.name, ball: fighter.ball, weapon: fighter.weapon }
        : s.teamB,
    })),

  startNewSimulation: () => {
    const { teamA, teamB } = get();
    const vels: InitialVelocities = {
      velA: randomVelocity(teamA.ball.maxSpeed, 0),           // aimed right toward B ±63°
      velB: randomVelocity(teamB.ball.maxSpeed, Math.PI),    // aimed left toward A ±63°
    };
    set({ phase: 'simulating', initialVelocities: vels, preSimBlob: null, simulationResult: null });
  },

  replaySimulation: () => {
    set((s) => ({
      phase: 'simulating',
      preSimBlob: null,
      simulationResult: null,
      initialVelocities: s.initialVelocities,
    }));
  },

  setSimulationComplete: (blob, vels, result) =>
    set({ phase: 'playing', preSimBlob: blob, initialVelocities: vels, simulationResult: result }),

  resetToSetup: () =>
    set({
      phase: 'setup',
      initialVelocities: null,
      preSimBlob: null,
      simulationResult: null,
      teamA: defaultTeamA,
      teamB: defaultTeamB,
    }),
}));
