import { describe, it, expect } from 'vitest';
import { expectedScore, applyElo } from '../elo';

describe('expectedScore()', () => {
  it('returns 0.5 for equal ratings', () => {
    expect(expectedScore(1000, 1000)).toBeCloseTo(0.5);
  });

  it('returns > 0.5 when A has a higher rating', () => {
    expect(expectedScore(1200, 1000)).toBeGreaterThan(0.5);
  });

  it('returns < 0.5 when A has a lower rating', () => {
    expect(expectedScore(1000, 1200)).toBeLessThan(0.5);
  });

  it('probabilities for A and B sum to 1', () => {
    expect(expectedScore(1300, 1000) + expectedScore(1000, 1300)).toBeCloseTo(1.0);
  });

  it('is symmetric: E(A,B) = 1 - E(B,A)', () => {
    const ea = expectedScore(1150, 950);
    const eb = expectedScore(950, 1150);
    expect(ea + eb).toBeCloseTo(1.0);
  });

  it('400-point gap gives ~90% expected score', () => {
    expect(expectedScore(1400, 1000)).toBeCloseTo(0.909, 2);
  });
});

describe('applyElo()', () => {
  it('winner gains rating, loser loses rating on a decisive result', () => {
    const ratings = [1000, 1000];
    applyElo(ratings, 0, 1, 1, 32); // A wins
    expect(ratings[0]).toBeGreaterThan(1000);
    expect(ratings[1]).toBeLessThan(1000);
  });

  it('updates are zero-sum: total rating is conserved', () => {
    const ratings = [1000, 1000];
    const before = ratings[0] + ratings[1];
    applyElo(ratings, 0, 1, 1, 32);
    expect(ratings[0] + ratings[1]).toBeCloseTo(before);
  });

  it('draw at equal ratings leaves both ratings unchanged', () => {
    const ratings = [1000, 1000];
    applyElo(ratings, 0, 1, 0.5, 32);
    expect(ratings[0]).toBeCloseTo(1000);
    expect(ratings[1]).toBeCloseTo(1000);
  });

  it('upset win (lower-rated beats higher-rated) gives larger gain', () => {
    const ratingsUpset   = [900, 1100];
    const ratingsExpected = [1100, 900];
    applyElo(ratingsUpset,    0, 1, 1, 32); // underdog wins
    applyElo(ratingsExpected, 0, 1, 1, 32); // favourite wins
    const upsetGain   = ratingsUpset[0]    - 900;
    const expectedGain = ratingsExpected[0] - 1100;
    expect(upsetGain).toBeGreaterThan(expectedGain);
  });

  it('K-factor scales the magnitude of the update', () => {
    const ratingsK16 = [1000, 1000];
    const ratingsK64 = [1000, 1000];
    applyElo(ratingsK16, 0, 1, 1, 16);
    applyElo(ratingsK64, 0, 1, 1, 64);
    expect(ratingsK64[0] - 1000).toBeCloseTo((ratingsK16[0] - 1000) * 4);
  });

  it('loss gives the symmetric opposite of a win', () => {
    const ratingsWin  = [1000, 1000];
    const ratingsLoss = [1000, 1000];
    applyElo(ratingsWin,  0, 1, 1, 32);
    applyElo(ratingsLoss, 0, 1, 0, 32);
    expect(ratingsWin[0]  - 1000).toBeCloseTo(-(ratingsLoss[0] - 1000));
  });
});
