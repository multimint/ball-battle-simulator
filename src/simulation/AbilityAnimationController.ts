import Matter from 'matter-js';
import type { TeamConfig, OnTimerParams } from '../models/types';
import type { EffectsController } from './EffectsController';
import type { ParticleController } from './ParticleController';
import type { AudioEmitter } from './AudioEmitter';
import type { GameEventType } from '../utils/funScore';
import { ARENA_SIZE } from '../constants/gameConstants';

const { Body } = Matter;

// ── Shared deps passed into every animation runner ────────────────────────────

export interface AnimationDeps {
  teamA: TeamConfig;
  teamB: TeamConfig;
  bodyA: Matter.Body;
  bodyB: Matter.Body;
  hp: { A: number; B: number };
  damageDealt: { A: number; B: number };
  effects: EffectsController;
  particles: ParticleController;
  audio: AudioEmitter;
  recordGameEvent: (type: GameEventType, team: 'A' | 'B') => void;
}

// ── Runner interface ──────────────────────────────────────────────────────────

export interface AbilityAnimationRunner<TState extends object = object> {
  /** Return true when these params should activate this runner. */
  canActivate(params: OnTimerParams): boolean;
  /** Called once when the ability fires. Returns the initial mutable state. */
  initiate(team: 'A' | 'B', params: OnTimerParams, deps: AnimationDeps): TState;
  /** Called every simulation tick. Return false when the animation is done. */
  tick(state: TState, simTime: number, deps: AnimationDeps): boolean;
}

// ── Open registry ─────────────────────────────────────────────────────────────
// Ball authors add custom animations without editing engine files:
//   registerAbilityAnimation('myAnim', { canActivate, initiate, tick });

const runners = new Map<string, AbilityAnimationRunner>();

export function registerAbilityAnimation(
  key: string,
  runner: AbilityAnimationRunner,
): void {
  runners.set(key, runner);
}

// ── Built-in: dash-through runner ─────────────────────────────────────────────

const DASH_START_HOLD  = 6;
const DASH_MOVE_FRAMES = 12;
const DASH_TOTAL       = 60;
const DASH_COLOR       = '#080820';
const DASH_ALPHA       = 0.72;

interface DashState {
  team: 'A' | 'B';
  enemyTeam: 'A' | 'B';
  fromX: number; fromY: number;
  midX:  number; midY:  number;
  toX:   number; toY:   number;
  nx: number;    ny: number;
  frame: number;
  damage: number;
  damageApplied: boolean;
  startHold:       number;
  moveFrames:      number;
  totalFrames:     number;
  trailColor:      string;
  slashColor:      string;
  slashColor2:     string;
  abilityHitStyle: string;
}

registerAbilityAnimation('dashThrough', {
  canActivate: (p) => !!p.dashThroughEnemy,

  initiate(team, params, deps): DashState {
    const enemyTeam: 'A' | 'B' = team === 'A' ? 'B' : 'A';
    const selfBody  = team      === 'A' ? deps.bodyA : deps.bodyB;
    const enemyBody = enemyTeam === 'A' ? deps.bodyA : deps.bodyB;
    const config    = team      === 'A' ? deps.teamA : deps.teamB;

    const dx   = enemyBody.position.x - selfBody.position.x;
    const dy   = enemyBody.position.y - selfBody.position.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) {
      // Return a trivially-done state so tick() finishes immediately
      return { team, enemyTeam, fromX: 0, fromY: 0, midX: 0, midY: 0, toX: 0, toY: 0, nx: 0, ny: 0, frame: 9999, damage: 0, damageApplied: true, startHold: 0, moveFrames: 0, totalFrames: 0, trailColor: '', slashColor: '', slashColor2: '', abilityHitStyle: '' };
    }

    const nx = dx / dist;
    const ny = dy / dist;
    const margin = config.ball.radius + 5;
    const toX = margin + Math.random() * (ARENA_SIZE - 2 * margin);
    const toY = margin + Math.random() * (ARENA_SIZE - 2 * margin);

    Body.setVelocity(selfBody,  { x: 0, y: 0 });
    Body.setVelocity(enemyBody, { x: 0, y: 0 });

    deps.effects.applyFreeze(
      2,
      params.dashFreezeColor ?? DASH_COLOR,
      params.dashFreezeAlpha ?? DASH_ALPHA,
      team,
    );

    return {
      team, enemyTeam,
      fromX: selfBody.position.x,  fromY: selfBody.position.y,
      midX:  enemyBody.position.x, midY:  enemyBody.position.y,
      toX, toY, nx, ny,
      frame: 0,
      damage:          params.dashDamage             ?? 10,
      damageApplied:   false,
      startHold:       params.dashStartHold          ?? DASH_START_HOLD,
      moveFrames:      params.dashMoveFrames          ?? DASH_MOVE_FRAMES,
      totalFrames:     params.dashTotalFrames         ?? DASH_TOTAL,
      trailColor:      params.dashColor               ?? '#3F51B5',
      slashColor:      params.dashSlashColor          ?? '#90CAF9',
      slashColor2:     params.dashSecondarySlashColor ?? '#5C6BC0',
      abilityHitStyle: params.dashAbilityHitStyle     ?? 'shadowslash',
    };
  },

  tick(ds: DashState, simTime, deps): boolean {
    const selfBody  = ds.team      === 'A' ? deps.bodyA : deps.bodyB;
    const enemyBody = ds.enemyTeam === 'A' ? deps.bodyA : deps.bodyB;
    const config    = ds.team      === 'A' ? deps.teamA : deps.teamB;

    ds.frame++;
    const isDone = ds.frame >= ds.totalFrames;
    if (!isDone) deps.effects.extendFreeze(2);

    Body.setVelocity(enemyBody, { x: 0, y: 0 });

    const inMove = ds.frame > ds.startHold && ds.frame <= ds.startHold + ds.moveFrames;
    if (inMove) {
      const mf   = ds.frame - ds.startHold;
      const half = ds.moveFrames / 2;
      let cx: number, cy: number;

      if (mf <= half) {
        const t = mf / half;
        cx = ds.fromX + (ds.midX - ds.fromX) * t;
        cy = ds.fromY + (ds.midY - ds.fromY) * t;
      } else {
        const t = (mf - half) / half;
        cx = ds.midX + (ds.toX - ds.midX) * t;
        cy = ds.midY + (ds.toY - ds.midY) * t;
      }

      Body.setPosition(selfBody, { x: cx, y: cy });
      deps.particles.pushTrail({
        x: cx, y: cy,
        radius: config.ball.radius * 0.55,
        color: ds.trailColor,
        alpha: 0.78,
        ttl: 22,
        maxTtl: 22,
      });

      if (mf === Math.ceil(half) && !ds.damageApplied) {
        ds.damageApplied = true;
        const actualDmg = Math.min(ds.damage, deps.hp[ds.enemyTeam]);
        if (actualDmg > 0) {
          deps.hp[ds.enemyTeam] = Math.max(0, deps.hp[ds.enemyTeam] - actualDmg);
          deps.damageDealt[ds.team] += actualDmg;
          deps.recordGameEvent('hit', ds.team);
        }

        const slashAngle = Math.atan2(ds.ny, ds.nx) - Math.PI * 0.5;
        deps.effects.pushWeaponEffect('sword', ds.midX, ds.midY, slashAngle,                  ds.slashColor,  75);
        deps.effects.pushWeaponEffect('sword', ds.midX, ds.midY, slashAngle + Math.PI * 0.5, ds.slashColor2, 75);
        deps.particles.pushFloater(
          String(actualDmg),
          enemyBody.position.x + (Math.random() - 0.5) * 20,
          enemyBody.position.y - (enemyBody.circleRadius ?? 25) - 8,
          ds.slashColor,
        );
        deps.particles.spawnBurst(ds.midX, ds.midY, ds.slashColor, 16);
        deps.effects.applyHitFlash(ds.enemyTeam, 0.85, ds.slashColor, 10);
        deps.audio.emitAbilityHit(ds.abilityHitStyle, simTime);
        deps.audio.emitHit(config.audioProfile.hitStyle, 1.0, simTime);
      }
    }

    if (isDone) {
      Body.setPosition(selfBody, { x: ds.toX, y: ds.toY });
      const exitDx   = ds.toX - ds.midX;
      const exitDy   = ds.toY - ds.midY;
      const exitDist = Math.hypot(exitDx, exitDy);
      const enx = exitDist > 0 ? exitDx / exitDist : ds.nx;
      const eny = exitDist > 0 ? exitDy / exitDist : ds.ny;
      Body.setVelocity(selfBody,  { x: enx * config.ball.maxSpeed * 1.4, y: eny * config.ball.maxSpeed * 1.4 });
      Body.setVelocity(enemyBody, { x: 0, y: 0 });
      return false; // done
    }

    return true; // ongoing
  },
} as AbilityAnimationRunner<DashState>);

// ── Controller ────────────────────────────────────────────────────────────────

interface ActiveAnimation {
  runner: AbilityAnimationRunner;
  state:  object;
}

export class AbilityAnimationController {
  private active: { A: ActiveAnimation | null; B: ActiveAnimation | null } = { A: null, B: null };

  constructor(private readonly deps: AnimationDeps) {}

  /** Called by DroneController when an onTimer ability fires. */
  trigger(team: 'A' | 'B', params: OnTimerParams): void {
    for (const runner of runners.values()) {
      if (runner.canActivate(params)) {
        const state = runner.initiate(team, params, this.deps);
        this.active[team] = { runner, state };
        return;
      }
    }
  }

  tick(simTime: number): void {
    for (const team of ['A', 'B'] as const) {
      const a = this.active[team];
      if (!a) continue;
      const ongoing = a.runner.tick(a.state, simTime, this.deps);
      if (!ongoing) this.active[team] = null;
    }
  }
}
