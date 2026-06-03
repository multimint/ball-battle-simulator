import type Matter from 'matter-js';
import type { BallAbility, BallAbilityType, TeamConfig } from '../models/types';
import type { StatusEffectManager } from './StatusEffectManager';
import type { ParticleController } from './ParticleController';
import type { EffectsController } from './EffectsController';
import type { AudioEmitter } from './AudioEmitter';
import { SCREEN_SHAKE_TTL } from '../constants/gameConstants';

export interface AbilityCtx {
  ability: BallAbility;
  team: 'A' | 'B';
  trigger: BallAbilityType;
  body: Matter.Body;
  teamConfig: TeamConfig;
  statusMgr: StatusEffectManager;
  particles: ParticleController;
  effects: EffectsController;
  audio: AudioEmitter;
  simTime: number;
  /** Records this proc as a gameplay action (non-passive triggers only). */
  recordProc?: () => void;
}

export function applyAbility(ctx: AbilityCtx): void {
  const { ability, team, trigger, body, teamConfig } = ctx;
  const p = ability.params;
  const enemy: 'A' | 'B' = team === 'A' ? 'B' : 'A';

  if (trigger !== 'passive') {
    ctx.audio.emitAbility(team, teamConfig.audioProfile.abilityStyle, trigger, ctx.simTime);
    ctx.recordProc?.();
  }

  if (p.statusEffect) {
    const target = p.statusTarget === 'self' ? team : enemy;
    ctx.statusMgr.apply({ team: target, type: p.statusEffect, durationMs: p.statusDuration ?? 2000, magnitude: p.statusMagnitude ?? 0.3, stackBehavior: p.stackBehavior ?? 'refresh', maxStacks: p.maxStacks ?? 1, color: p.statusColor ?? '#FF8800', icon: p.statusIcon ?? 'burst', simTime: ctx.simTime });
  }

  if (p.hitFlash) {
    const flashTeam = p.hitFlashTarget === 'enemy' ? enemy : team;
    ctx.effects.applyHitFlash(flashTeam, 0.65, p.hitFlashColor ?? '#FFFFFF', 5);
  }
  if (p.hitShakeMagnitude) ctx.effects.applyScreenShake(p.hitShakeMagnitude, SCREEN_SHAKE_TTL);
  if (p.hitSlowMo)         ctx.effects.applySlowMotion();
  if (p.hitScreenFlash)    ctx.effects.applyScreenFlash(p.hitScreenFlashAlpha ?? 0.3, p.hitScreenFlashColor ?? '#FFFFFF', Math.round(p.hitScreenFlashTtl ?? 5));
  if (p.hitFreezeFrames)   ctx.effects.applyFreeze(p.hitFreezeFrames, p.hitFreezeColor ?? '#22CC55', p.hitFreezeAlpha ?? 0.22);

  if (p.secondStatusEffect) {
    const target2 = p.secondStatusTarget === 'enemy' ? enemy : team;
    ctx.statusMgr.apply({ team: target2, type: p.secondStatusEffect, durationMs: p.secondStatusDuration ?? 2000, magnitude: p.secondStatusMagnitude ?? 0.3, stackBehavior: p.secondStatusBehavior ?? 'refresh', maxStacks: p.secondStatusMaxStacks ?? 1, color: p.secondStatusColor ?? '#FF8800', icon: p.secondStatusIcon ?? 'burst', simTime: ctx.simTime });
  }

  if (p.trailOnTrigger) {
    const ballRadius = teamConfig.ball.radius;
    const count = p.trailCount ?? 1;
    const spawnChance = p.trailSpawnChance ?? 1;
    if (Math.random() < spawnChance) {
      for (let i = 0; i < count; i++) {
        const scatter = (p.trailScatterFrac ?? 0) * ballRadius;
        ctx.particles.pushTrail({
          x: body.position.x + (scatter > 0 ? (Math.random() - 0.5) * scatter : 0),
          y: body.position.y + (scatter > 0 ? (Math.random() - 0.5) * scatter : 0),
          radius: ballRadius * (p.trailRadiusFrac ?? 0.5),
          color: p.trailColor ?? '#FFFFFF',
          alpha: p.trailAlpha ?? 0.5,
          ttl:    p.trailTtl ?? 8,
          maxTtl: p.trailTtl ?? 8,
        });
      }
    }
  }
}
