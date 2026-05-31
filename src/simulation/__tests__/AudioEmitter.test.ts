import { describe, it, expect, beforeEach } from 'vitest';
import { AudioEmitter } from '../AudioEmitter';

describe('AudioEmitter', () => {
  let audio: AudioEmitter;

  beforeEach(() => { audio = new AudioEmitter(); });

  describe('emitHit', () => {
    it('adds a hit event', () => {
      audio.emitHit('swift', 0.5, 1000);
      const events = audio.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ type: 'hit', hitStyle: 'swift', intensity: 0.5, timeMs: 1000 });
    });
  });

  describe('emitAbility — onLowHP deduplication', () => {
    it('emits the first time', () => {
      audio.emitAbility('A', 'berserk', 'onLowHP', 500);
      expect(audio.getEvents()).toHaveLength(1);
    });

    it('does not emit a second time for same team', () => {
      audio.emitAbility('A', 'berserk', 'onLowHP', 500);
      audio.emitAbility('A', 'berserk', 'onLowHP', 600);
      expect(audio.getEvents()).toHaveLength(1);
    });

    it('emits independently per team', () => {
      audio.emitAbility('A', 'berserk', 'onLowHP', 500);
      audio.emitAbility('B', 'berserk', 'onLowHP', 600);
      expect(audio.getEvents()).toHaveLength(2);
    });
  });

  describe('emitAbility — cooldown enforcement', () => {
    it('respects 600ms cooldown', () => {
      audio.emitAbility('A', 'frenzy', 'onHitDealt', 0);
      audio.emitAbility('A', 'frenzy', 'onHitDealt', 400); // too soon
      expect(audio.getEvents()).toHaveLength(1);
    });

    it('emits after cooldown expires', () => {
      audio.emitAbility('A', 'frenzy', 'onHitDealt', 0);
      audio.emitAbility('A', 'frenzy', 'onHitDealt', 700); // past cooldown
      expect(audio.getEvents()).toHaveLength(2);
    });
  });

  describe('bounce cooldowns', () => {
    it('emits ball bounce and enforces cooldown', () => {
      expect(audio.emitBallBounce('swift', 0)).toBe(true);
      expect(audio.emitBallBounce('swift', 50)).toBe(false); // too soon
      expect(audio.emitBallBounce('swift', 200)).toBe(true); // past cooldown
    });

    it('emits wall bounce independently from ball bounce', () => {
      audio.emitBallBounce('swift', 0);
      expect(audio.emitWallBounce('swift', 0)).toBe(true); // separate cooldown
    });
  });
});
