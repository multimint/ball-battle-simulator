import { GameSimulator } from './GameSimulator';
import type { TeamConfig } from '../models/types';
import type { InitialVelocities, SimulationResult } from '../store/useGameStore';

interface WorkerInput {
  teamA: TeamConfig;
  teamB: TeamConfig;
  initialVelocities: InitialVelocities;
}

interface ProgressMessage  { type: 'progress'; pct: number }
interface CompleteMessage  { type: 'complete'; buffer: ArrayBuffer; vels: InitialVelocities; result: SimulationResult }
interface ErrorMessage     { type: 'error'; message: string }

type WorkerOutput = ProgressMessage | CompleteMessage | ErrorMessage;

// DedicatedWorkerGlobalScope.postMessage — cast avoids DOM/WebWorker lib conflict
const send = (msg: WorkerOutput, transfer?: Transferable[]) =>
  (self as unknown as { postMessage(m: unknown, t?: Transferable[]): void }).postMessage(msg, transfer);

self.onmessage = async (e: MessageEvent<WorkerInput>) => {
  const { teamA, teamB, initialVelocities } = e.data;
  const sim = new GameSimulator({ teamA, teamB, initialVelocities, workerMode: true });

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
