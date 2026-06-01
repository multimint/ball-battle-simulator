import Matter from 'matter-js';
import type { WeaponStats, AttackConfig, TeamConfig } from '../models/types';
import type { StatusEffectManager } from './StatusEffectManager';
import type { ParticleController } from './ParticleController';
import type { EffectsController } from './EffectsController';
import type { AudioEmitter } from './AudioEmitter';
import { applyAbility } from './AbilityHandler';
import { getHitMultipliers } from './WeaponHitProcessor';
import { applyKnockback, directionBetween } from '../utils/physics';
import { isAbilityBerserk } from '../utils/ability';
import { BERSERK_BURST_MULT } from '../constants/gameConstants';

const { Body } = Matter;

export interface HitCtx {
  weapon: WeaponStats;
  attack: AttackConfig;
  attacker: Matter.Body;
  defender: Matter.Body;
  attackerTeam: 'A' | 'B';
  hp: { A: number; B: number };
  maxHp: { A: number; B: number };
  damageDealt: { A: number; B: number };
  teamA: TeamConfig;
  teamB: TeamConfig;
  bodyA: Matter.Body;
  bodyB: Matter.Body;
  statusMgr: StatusEffectManager;
  particles: ParticleController;
  effects: EffectsController;
  audio: AudioEmitter;
  simTime: number;
}

export function processHit(ctx: HitCtx): void {
  const { weapon, attack, attacker, defender, attackerTeam } = ctx;
  const targetTeam: 'A' | 'B' = attackerTeam === 'A' ? 'B' : 'A';
  const dir = directionBetween(attacker, defender);
  const hitAngle = Math.atan2(dir.y, dir.x);

  let lastDmg = 0;
  const damage = (team: 'A' | 'B', amount: number): number => {
    const attackingTeam: 'A' | 'B' = team === 'A' ? 'B' : 'A';
    let modified = amount
      * ctx.statusMgr.getOutgoingDamageMultiplier(attackingTeam)
      * ctx.statusMgr.getIncomingDamageMultiplier(team);
    modified = ctx.statusMgr.consumeShield(team, modified);
    const rounded = Math.round(modified);
    const actual  = Math.min(rounded, ctx.hp[team]);
    ctx.hp[team]  = Math.max(0, ctx.hp[team] - actual);
    if (actual > 0) {
      const fx = defender.position.x + (Math.random() - 0.5) * 20;
      const fy = defender.position.y - (defender.circleRadius ?? 25) - 8;
      ctx.particles.pushFloater(String(actual), fx, fy, weapon.color ?? '#FFFFFF');
    }
    const opponent: 'A' | 'B' = team === 'A' ? 'B' : 'A';
    ctx.damageDealt[opponent] += actual;
    const lifesteal = ctx.statusMgr.getEffects(attackingTeam).find((e) => e.type === 'lifesteal');
    if (lifesteal) {
      const heal = Math.round(actual * lifesteal.magnitude);
      if (heal > 0) ctx.hp[attackerTeam] = Math.min(ctx.maxHp[attackerTeam], ctx.hp[attackerTeam] + heal);
    }
    lastDmg = rounded;
    return rounded;
  };

  switch (attack.type) {
    case 'melee': {
      const { kbMult, dmgMult } = getHitMultipliers(weapon, attack);
      applyKnockback(defender, dir.x, dir.y, attack.knockback * kbMult);
      damage(targetTeam, attack.damage * dmgMult);
      ctx.particles.spawnBurst(defender.position.x, defender.position.y, weapon.color ?? '#CC6633', 8);
      break;
    }
    case 'shield': {
      applyKnockback(defender, dir.x, dir.y, attack.knockback * 1.8);
      if (attack.damage > 0) damage(targetTeam, Math.max(1, Math.round(attack.damage * 0.2)));
      ctx.effects.pushWeaponEffect('shield', attacker.position.x, attacker.position.y, hitAngle, weapon.color ?? '#AAAAFF', 18, { radius: (attacker.circleRadius ?? 25) + 14 });
      ctx.particles.spawnBurst(attacker.position.x, attacker.position.y, weapon.color ?? '#AAAAFF', 6);
      break;
    }
    case 'projectile': {
      const { kbMult, dmgMult } = getHitMultipliers(weapon, attack);
      if (weapon.hitEffect === 'explosion') {
        ctx.effects.pushWeaponEffect('explosion', defender.position.x, defender.position.y, 0, weapon.color ?? '#44AA44', 20, { radius: weapon.hitEffectRadius ?? 70 });
      } else if (weapon.hitEffect === 'laser' && attack.hitscan) {
        ctx.effects.pushWeaponEffect('laser', attacker.position.x, attacker.position.y, hitAngle, weapon.color ?? '#44AAFF', 22, { x2: defender.position.x, y2: defender.position.y });
        ctx.effects.pushWeaponEffect('explosion', defender.position.x, defender.position.y, 0, weapon.color ?? '#44AAFF', 18, { radius: 55 });
        ctx.effects.applyScreenShake(8, 14);
        ctx.effects.applyScreenFlash(0.45, weapon.color ?? '#4488FF', 8);
        ctx.effects.applyHitFlash(targetTeam, 0.9, '#FFFFFF', 8);
        ctx.effects.applySlowMotion();
      }
      applyKnockback(defender, dir.x, dir.y, attack.knockback * kbMult);
      damage(targetTeam, attack.damage * dmgMult);
      ctx.particles.spawnBurst(defender.position.x, defender.position.y, weapon.color ?? '#FFF', attack.hitscan ? 22 : 8);
      break;
    }
    case 'aoe': {
      applyKnockback(defender, dir.x, dir.y, attack.knockback * 1.5);
      damage(targetTeam, attack.damage);
      ctx.effects.pushWeaponEffect('shockwave', attacker.position.x, attacker.position.y, 0, weapon.color ?? '#FF44FF', 25, { radius: weapon.range * 30 });
      ctx.particles.spawnBurst(attacker.position.x, attacker.position.y, weapon.color ?? '#FF44FF', 15);
      break;
    }
    case 'utility': {
      if (weapon.utilityBehavior === 'pull') {
        const pullDir = directionBetween(defender, attacker);
        applyKnockback(defender, pullDir.x, pullDir.y, 80);
        if (attack.damage > 0) damage(targetTeam, attack.damage);
        ctx.particles.spawnBurst(
          (attacker.position.x + defender.position.x) / 2,
          (attacker.position.y + defender.position.y) / 2,
          weapon.color ?? '#44FFAA', 6,
        );
      } else if (weapon.utilityBehavior === 'push-both') {
        applyKnockback(defender, dir.x,  dir.y,  attack.knockback * 1.3);
        applyKnockback(attacker, -dir.x, -dir.y, attack.knockback * (weapon.selfKnockbackFrac ?? 0.4));
        damage(targetTeam, attack.damage);
        ctx.effects.pushWeaponEffect('explosion', attacker.position.x, attacker.position.y, 0, weapon.color ?? '#FFFF44', 18, { radius: 55 });
      }
      break;
    }
  }

  if (attack.hitStatusEffect && lastDmg > 0) {
    ctx.statusMgr.apply({ team: targetTeam, type: attack.hitStatusEffect, durationMs: attack.hitStatusDuration ?? 2000, magnitude: attack.hitStatusMagnitude ?? 0.3, stackBehavior: 'refresh', maxStacks: 1, color: attack.hitStatusColor ?? '#88CCFF', icon: attack.hitStatusIcon ?? 'burst', simTime: ctx.simTime });
  }

  ctx.effects.applyTierEffects(attack.type, targetTeam, weapon.color ?? '#FFFFFF', lastDmg);

  if (attack.type !== 'utility') {
    const hitStyle = (attackerTeam === 'A' ? ctx.teamA : ctx.teamB).audioProfile.hitStyle;
    if (attack.audioHint === 'laser') {
      ctx.audio.emitLaser(hitStyle, ctx.simTime);
    } else {
      ctx.audio.emitHit(hitStyle, Math.min(1, Math.max(0, lastDmg / 30)), ctx.simTime);
    }
  }

  if (lastDmg > 0) {
    const attackerConfig = attackerTeam === 'A' ? ctx.teamA : ctx.teamB;
    const attackerBerserk = isAbilityBerserk(attackerConfig.ball.ability, ctx.hp[attackerTeam] / ctx.maxHp[attackerTeam]);
    const burstMult = attackerBerserk ? BERSERK_BURST_MULT : 1.0;
    const burst = Math.min(10, (lastDmg / 8) * burstMult);
    Body.setVelocity(defender, { x: defender.velocity.x + dir.x * burst, y: defender.velocity.y + dir.y * burst });
    const boostMag = attackerBerserk ? Math.min(1.2, lastDmg * 0.018) : Math.min(0.7, lastDmg * 0.01);
    const boostDur = Math.round(attackerBerserk ? Math.min(1000, lastDmg * 18) : Math.min(700, lastDmg * 12));
    ctx.statusMgr.apply({ team: targetTeam, type: 'speedBoost', durationMs: boostDur, magnitude: boostMag, stackBehavior: 'refresh', maxStacks: 1, color: '#FF6600', icon: 'burst', simTime: ctx.simTime });
  }

  const sharedAbilityCtx = { statusMgr: ctx.statusMgr, particles: ctx.particles, effects: ctx.effects, audio: ctx.audio, simTime: ctx.simTime };

  const attackerConfig = attackerTeam === 'A' ? ctx.teamA : ctx.teamB;
  const defenderConfig = targetTeam   === 'A' ? ctx.teamA : ctx.teamB;
  const attackerBody   = attackerTeam === 'A' ? ctx.bodyA : ctx.bodyB;
  const defenderBody   = targetTeam   === 'A' ? ctx.bodyA : ctx.bodyB;

  if (attackerConfig.ball.ability?.trigger === 'onHitDealt') {
    applyAbility({ ability: attackerConfig.ball.ability, team: attackerTeam, trigger: 'onHitDealt', body: attackerBody, teamConfig: attackerConfig, ...sharedAbilityCtx });
  }
  if (defenderConfig.ball.ability?.trigger === 'onHitReceived') {
    applyAbility({ ability: defenderConfig.ball.ability, team: targetTeam, trigger: 'onHitReceived', body: defenderBody, teamConfig: defenderConfig, ...sharedAbilityCtx });
  }
}
