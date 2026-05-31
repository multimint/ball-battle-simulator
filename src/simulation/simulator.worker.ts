import { GameSimulator } from './GameSimulator';
import { BALL_DEFINITIONS } from '../balls';
import type { TeamConfig } from '../models/types';
import type { InitialVelocities, SimulationResult } from '../store/useGameStore';

// Restore getHudRows (stripped before postMessage because functions can't be cloned).
function rehydrateTeam(team: TeamConfig): TeamConfig {
  const def = BALL_DEFINITIONS.find(b => b.id === team.fighterId);
  const fn = def?.ball.ability?.getHudRows;
  if (!fn || !team.ball.ability) return team;
  return { ...team, ball: { ...team.ball, ability: { ...team.ball.ability, getHudRows: fn } } };
}

interface WorkerInput {
  teamA: TeamConfig;
  teamB: TeamConfig;
  initialVelocities: InitialVelocities;
  fps?: number;
  bitrate?: number;
}

interface ProgressMessage  { type: 'progress'; pct: number }
interface CompleteMessage  { type: 'complete'; buffer: ArrayBuffer; vels: InitialVelocities; result: SimulationResult }
interface ErrorMessage     { type: 'error'; message: string }

type WorkerOutput = ProgressMessage | CompleteMessage | ErrorMessage;

// DedicatedWorkerGlobalScope.postMessage — cast avoids DOM/WebWorker lib conflict
const send = (msg: WorkerOutput, transfer?: Transferable[]) =>
  (self as unknown as { postMessage(m: unknown, t?: Transferable[]): void }).postMessage(msg, transfer);

self.onmessage = async (e: MessageEvent<WorkerInput>) => {
  const { teamA, teamB, initialVelocities, fps, bitrate } = e.data;
  const sim = new GameSimulator({ teamA: rehydrateTeam(teamA), teamB: rehydrateTeam(teamB), initialVelocities, fps, bitrate, workerMode: true });

  try {
    const { blob, vels, result } = await sim.run((pct) => {
      send({ type: 'progress', pct });
    });

    const buffer = await blob.arrayBuffer();
    send({ type: 'complete', buffer, vels, result }, [buffer]);
  } catch (err) {
    send({ type: 'error', message: String(err) });
  }
};
