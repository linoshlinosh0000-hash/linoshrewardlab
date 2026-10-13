import { describe, expect, it } from 'vitest';
import { defaults, goldReward, runExperiment } from './reward-model';

describe('reward experiment', () => {
  it('penalizes flattery and only excess length', () => {
    expect(goldReward({ quality: 1, flattery: 2, length: 40 })).toBeCloseTo(-1.32);
    expect(goldReward({ quality: 1, flattery: 0, length: 20 })).toBe(1);
  });
  it('reproduces seeded trials and valid confidence intervals', () => {
    const config = { ...defaults, trials: 30, maxPool: 8 };
    const rows = runExperiment(config);
    expect(rows).toEqual(runExperiment(config));
    expect(rows.map(r => r.pool)).toEqual([1, 2, 4, 8]);
    rows.forEach(r => { expect(r.low).toBeLessThan(r.high); expect(Number.isFinite(r.proxy)).toBe(true); expect(r.length).toBeGreaterThanOrEqual(5); });
  });
  it('reveals proxy and gold divergence under the default stress test', () => {
    const rows = runExperiment(defaults);
    const first = rows[0], last = rows[rows.length - 1];
    if (!first || !last) throw new Error('Expected experiment rows');
    expect(last.proxy).toBeGreaterThan(first.proxy);
    expect(last.gold).toBeLessThan(first.gold);
  });
});