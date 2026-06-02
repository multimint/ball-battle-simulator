import { describe, it, expect, vi } from 'vitest';
import { meleeHandler }      from '../melee';
import { shieldHandler }     from '../shield';
import { projectileHandler } from '../projectile';
import { aoeHandler }        from '../aoe';
import { utilityHandler }    from '../utility';
import { summonHandler }     from '../summon';
import { makeBody, makeParticles, makeEffects } from '../../__tests__/fixtures';
import type { AttackHandlerCtx } from '../types';
import type { WeaponStats, AttackConfig } from '../../../models/types';

function baseWeapon(overrides: Partial<WeaponStats> = {}): WeaponStats {
  return { name: 'Test', description: '', range: 1, speed: 5, trigger: 'onCollision', attacks: [], ...overrides };
}

function baseAttack(overrides: Partial<AttackConfig> = {}): AttackConfig {
  return { type: 'melee', cooldown: 1, damage: 10, knockback: 40, ...overrides };
}

function makeCtx(overrides: Partial<AttackHandlerCtx> = {}): AttackHandlerCtx {
  return {
    weapon:      baseWeapon(),
    attack:      baseAttack(),
    attacker:    makeBody(100, 240),
    defender:    makeBody(380, 240),
    targetTeam:  'B',
    dir:         { x: 1, y: 0 },
    hitAngle:    0,
    damage:      vi.fn().mockReturnValue(10),
    particles:   makeParticles(),
    effects:     makeEffects(),
    spawnUnit:   vi.fn(),
    ...overrides,
  };
}

// ─── melee ────────────────────────────────────────────────────────────────────

describe('meleeHandler', () => {
  it('calls damage on the target team', () => {
    const ctx = makeCtx();
    meleeHandler.resolve(ctx);
    expect(ctx.damage).toHaveBeenCalledWith('B', expect.any(Number));
  });

  it('applies weapon dmgMult to damage', () => {
    const ctx = makeCtx({ weapon: baseWeapon({ dmgMult: 2.0 }) });
    meleeHandler.resolve(ctx);
    expect(ctx.damage).toHaveBeenCalledWith('B', 20);
  });

  it('spawns burst at defender position', () => {
    const ctx = makeCtx();
    meleeHandler.resolve(ctx);
    expect(ctx.particles.spawnBurst).toHaveBeenCalledWith(
      ctx.defender.position.x, ctx.defender.position.y, expect.any(String), expect.any(Number)
    );
  });

  it('applies knockback in dir direction (positive force.x)', () => {
    const ctx = makeCtx();
    meleeHandler.resolve(ctx);
    expect(ctx.defender.force.x).toBeGreaterThan(0);
  });
});

// ─── shield ───────────────────────────────────────────────────────────────────

describe('shieldHandler', () => {
  it('does not call damage when attack.damage === 0', () => {
    const ctx = makeCtx({ attack: baseAttack({ type: 'shield', damage: 0, knockback: 100 }) });
    shieldHandler.resolve(ctx);
    expect(ctx.damage).not.toHaveBeenCalled();
  });

  it('calls damage with reduced amount when attack.damage > 0', () => {
    const ctx = makeCtx({ attack: baseAttack({ type: 'shield', damage: 10, knockback: 100 }) });
    shieldHandler.resolve(ctx);
    expect(ctx.damage).toHaveBeenCalledWith('B', expect.any(Number));
  });

  it('pushes a shield weapon effect at attacker position', () => {
    const ctx = makeCtx({ attack: baseAttack({ type: 'shield', damage: 0, knockback: 100 }) });
    shieldHandler.resolve(ctx);
    expect(ctx.effects.pushWeaponEffect).toHaveBeenCalledWith(
      'shield', ctx.attacker.position.x, ctx.attacker.position.y, expect.any(Number),
      expect.any(String), expect.any(Number), expect.any(Object)
    );
  });
});

// ─── projectile ───────────────────────────────────────────────────────────────

describe('projectileHandler', () => {
  it('calls damage on target team', () => {
    const ctx = makeCtx({ attack: baseAttack({ type: 'projectile', aimAtEnemy: true }) });
    projectileHandler.resolve(ctx);
    expect(ctx.damage).toHaveBeenCalledWith('B', expect.any(Number));
  });

  it('spawns burst at defender position', () => {
    const ctx = makeCtx({ attack: baseAttack({ type: 'projectile', aimAtEnemy: true }) });
    projectileHandler.resolve(ctx);
    expect(ctx.particles.spawnBurst).toHaveBeenCalledWith(
      ctx.defender.position.x, ctx.defender.position.y, expect.any(String), expect.any(Number)
    );
  });

  it('pushes explosion effect when hitEffect=explosion', () => {
    const ctx = makeCtx({
      weapon: baseWeapon({ hitEffect: 'explosion', hitEffectRadius: 70 }),
      attack: baseAttack({ type: 'projectile', aimAtEnemy: true }),
    });
    projectileHandler.resolve(ctx);
    expect(ctx.effects.pushWeaponEffect).toHaveBeenCalledWith(
      'explosion', expect.any(Number), expect.any(Number),
      0, expect.any(String), expect.any(Number), expect.any(Object)
    );
  });

  it('pushes laser effect when hitEffect=laser and hitscan=true', () => {
    const ctx = makeCtx({
      weapon: baseWeapon({ hitEffect: 'laser' }),
      attack: baseAttack({ type: 'projectile', aimAtEnemy: true, hitscan: true }),
    });
    projectileHandler.resolve(ctx);
    expect(ctx.effects.pushWeaponEffect).toHaveBeenCalledWith(
      'laser', expect.any(Number), expect.any(Number),
      expect.any(Number), expect.any(String), expect.any(Number), expect.any(Object)
    );
    expect(ctx.effects.applyScreenShake).toHaveBeenCalled();
  });
});

// ─── aoe ──────────────────────────────────────────────────────────────────────

describe('aoeHandler', () => {
  it('calls damage on target team', () => {
    const ctx = makeCtx({ attack: baseAttack({ type: 'aoe', damage: 6, knockback: 100 }) });
    aoeHandler.resolve(ctx);
    expect(ctx.damage).toHaveBeenCalledWith('B', 6);
  });

  it('pushes shockwave effect at attacker position', () => {
    const ctx = makeCtx({ attack: baseAttack({ type: 'aoe', damage: 6, knockback: 100 }) });
    aoeHandler.resolve(ctx);
    expect(ctx.effects.pushWeaponEffect).toHaveBeenCalledWith(
      'shockwave', ctx.attacker.position.x, ctx.attacker.position.y,
      0, expect.any(String), expect.any(Number), expect.any(Object)
    );
  });
});

// ─── utility ──────────────────────────────────────────────────────────────────

describe('utilityHandler', () => {
  it('emitsAudio is false', () => {
    expect(utilityHandler.emitsAudio).toBe(false);
  });

  describe('pull behavior', () => {
    it('applies knockback on defender toward attacker (negative force.x)', () => {
      const ctx = makeCtx({
        weapon: baseWeapon({ utilityBehavior: 'pull' }),
        attack: baseAttack({ type: 'utility', damage: 0, knockback: 0 }),
      });
      utilityHandler.resolve(ctx);
      // dir = {x:1, y:0} (attacker left of defender); pull = -dir → force.x < 0
      expect(ctx.defender.force.x).toBeLessThan(0);
    });

    it('skips damage when attack.damage === 0', () => {
      const ctx = makeCtx({
        weapon: baseWeapon({ utilityBehavior: 'pull' }),
        attack: baseAttack({ type: 'utility', damage: 0, knockback: 0 }),
      });
      utilityHandler.resolve(ctx);
      expect(ctx.damage).not.toHaveBeenCalled();
    });

    it('calls damage when attack.damage > 0', () => {
      const ctx = makeCtx({
        weapon: baseWeapon({ utilityBehavior: 'pull' }),
        attack: baseAttack({ type: 'utility', damage: 5, knockback: 0 }),
      });
      utilityHandler.resolve(ctx);
      expect(ctx.damage).toHaveBeenCalledWith('B', 5);
    });
  });

  describe('push-both behavior', () => {
    it('applies knockback to both attacker and defender', () => {
      const ctx = makeCtx({
        weapon: baseWeapon({ utilityBehavior: 'push-both' }),
        attack: baseAttack({ type: 'utility', damage: 4, knockback: 120 }),
      });
      utilityHandler.resolve(ctx);
      expect(ctx.defender.force.x).toBeGreaterThan(0);  // pushed right
      expect(ctx.attacker.force.x).toBeLessThan(0);     // pushed left (self-knockback)
    });

    it('calls damage on target team', () => {
      const ctx = makeCtx({
        weapon: baseWeapon({ utilityBehavior: 'push-both' }),
        attack: baseAttack({ type: 'utility', damage: 4, knockback: 120 }),
      });
      utilityHandler.resolve(ctx);
      expect(ctx.damage).toHaveBeenCalledWith('B', 4);
    });

    it('pushes explosion effect', () => {
      const ctx = makeCtx({
        weapon: baseWeapon({ utilityBehavior: 'push-both' }),
        attack: baseAttack({ type: 'utility', damage: 4, knockback: 120 }),
      });
      utilityHandler.resolve(ctx);
      expect(ctx.effects.pushWeaponEffect).toHaveBeenCalledWith(
        'explosion', expect.any(Number), expect.any(Number),
        0, expect.any(String), expect.any(Number), expect.any(Object)
      );
    });
  });
});

// ─── summon ───────────────────────────────────────────────────────────────────

describe('summonHandler', () => {
  it('calls spawnUnit with the attacker body', () => {
    const ctx = makeCtx({ attack: baseAttack({ type: 'summon', damage: 0, knockback: 0 }) });
    summonHandler.resolve(ctx);
    expect(ctx.spawnUnit).toHaveBeenCalledWith(ctx.attacker);
  });

  it('applies knockback to defender when knockback > 0', () => {
    const ctx = makeCtx({ attack: baseAttack({ type: 'summon', damage: 0, knockback: 60 }) });
    summonHandler.resolve(ctx);
    expect(ctx.defender.force.x).toBeGreaterThan(0);
  });

  it('does NOT apply knockback when knockback === 0', () => {
    const ctx = makeCtx({ attack: baseAttack({ type: 'summon', damage: 0, knockback: 0 }) });
    summonHandler.resolve(ctx);
    expect(ctx.defender.force.x).toBe(0);
  });

  it('emitsAudio is false', () => {
    expect(summonHandler.emitsAudio).toBe(false);
  });
});
