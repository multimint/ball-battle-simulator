import Matter from 'matter-js';
import { SimulationCore } from '../simulation/SimulationCore';
import { STALEMATE_TIME_MS, PHYSICS_STEP_MS } from '../constants/gameConstants';
import { computeFunScore } from '../utils/funScore';
import type { WinnerType } from '../models/types';

const { Engine, World } = Matter;

export interface FightResult {
  winner: WinnerType;
  hpA: number;
  hpB: number;
  damageDealt: { A: number; B: number };
  turnsElapsed: number;
  simTimeMs: number;
  funScore: number;
}

export class HeadlessSimulator extends SimulationCore {
  run(): FightResult {
    const PHYSICS_STEP = PHYSICS_STEP_MS;
    const deregister = this.registerCollisionHandler();

    while (!this.matchEnded) {
      this.tick(PHYSICS_STEP);
      if (!this.matchEnded && this.simTime >= STALEMATE_TIME_MS) {
        this.matchEnded = true;
        this.winner = this.hp.A === this.hp.B ? 'draw' : (this.hp.A > this.hp.B ? 'A' : 'B');
      }
    }

    deregister();
    Engine.clear(this.engine);
    World.clear(this.engine.world, false);

    return {
      winner: this.winner,
      hpA: this.hp.A,
      hpB: this.hp.B,
      damageDealt: { ...this.damageDealt },
      turnsElapsed: this.turns,
      simTimeMs: this.simTime,
      funScore: computeFunScore({
        snapshots: this.hpSnapshots,
        winner:   this.winner,
        hpA:      this.hp.A,
        hpB:      this.hp.B,
        maxHpA:   this.maxHp.A,
        maxHpB:   this.maxHp.B,
        damageA:  this.damageDealt.A,
        damageB:  this.damageDealt.B,
        simTimeMs: this.simTime,
        gameEvents: this.gameEvents,
      }),
    };
  }
}
