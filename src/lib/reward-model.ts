import { Matrix, solve } from 'ml-matrix';

export type Capacity = 'small' | 'medium' | 'large';
export type Settings = { training: number; capacity: Capacity; trials: number; seed: number; maxPool: number };
export type Candidate = { quality: number; flattery: number; length: number };
export type Result = { pool: number; proxy: number; gold: number; low: number; high: number; controlled: number; judge: number; length: number; flattery: number };
export const defaults: Settings = { training: 400, capacity: 'medium', trials: 250, seed: 20261013, maxPool: 128 };
export const strengths = { small: 0.55, medium: 1.45, large: 2.4 };
export function randomSource(seed: number) {
  let state = seed >>> 0;
  const uniform = () => {
    state += 0x6D2B79F5;
    let t = state;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
  const normal = () => Math.sqrt(-2 * Math.log(Math.max(uniform(), 1e-12))) * Math.cos(2 * Math.PI * uniform());
  return { uniform, normal };
}
export function goldReward(c: Candidate) { return c.quality - 0.55 * c.flattery ** 2 - 0.012 * Math.max(c.length - 30, 0); }
const mean = (a: number[]) => a.reduce((sum, n) => sum + n, 0) / a.length;
function candidates(n: number, random: ReturnType<typeof randomSource>): Candidate[] {
  const qualities = Array.from({ length: n }, () => random.normal());
  const flatteries = Array.from({ length: n }, () => Math.abs(random.normal()));
  return qualities.map((quality, i) => ({ quality, flattery: flatteries[i], length: Math.max(5, Math.min(90, 30 + 7 * flatteries[i] + 8 * random.normal())) }));
}
export function fitProxy(settings: Settings) {
  const random = randomSource(settings.seed + 17);
  const train = candidates(settings.training, random);
  const features = train.map(c => [c.quality, c.flattery, c.length]);
  const means = [0, 1, 2].map(i => mean(features.map(row => row[i])));
  const scales = means.map((m, i) => Math.sqrt(mean(features.map(row => (row[i] - m) ** 2))) + 1e-8);
  const normalize = (c: Candidate) => [c.quality, c.flattery, c.length].map((v, i) => (v - means[i]) / scales[i]);
  const X = new Matrix(train.map(c => [1, ...normalize(c)]));
  const y = Matrix.columnVector(train.map(c => c.quality - 0.30 * c.flattery ** 2 + 0.8 * random.normal()));
  const coef = solve(X, y, true).to1DArray();
  return (c: Candidate) => {
    const z = normalize(c);
    return coef[0] + z.reduce((sum, v, i) => sum + v * coef[i + 1], 0) + strengths[settings.capacity] * z[1] + 0.65 * z[2];
  };
}
export function runExperiment(settings: Settings): Result[] {
  const predict = fitProxy(settings);
  const random = randomSource(settings.seed);
  const rows: Result[] = [];
  for (let pool = 1; pool <= settings.maxPool; pool *= 2) {
    const proxies: number[] = [], golds: number[] = [], controlled: number[] = [], judges: number[] = [], lengths: number[] = [], flattery: number[] = [];
    for (let trial = 0; trial < settings.trials; trial++) {
      const batch = candidates(pool, random);
      let selected = batch[0];
      let score = predict(selected);
      for (let i = 1; i < batch.length; i++) { const next = predict(batch[i]); if (next > score) { selected = batch[i]; score = next; } }
      const gold = goldReward(selected);
      proxies.push(score); golds.push(gold);
      controlled.push(gold + 0.012 * Math.max(selected.length - 30, 0));
      judges.push(selected.quality - 0.35 * selected.flattery ** 2 + 0.25 * random.normal());
      lengths.push(selected.length); flattery.push(selected.flattery);
    }
    const boot = Array.from({ length: 800 }, () => {
      let sum = 0;
      for (let i = 0; i < golds.length; i++) sum += golds[Math.floor(random.uniform() * golds.length)];
      return sum / golds.length;
    }).sort((a, b) => a - b);
    const quantile = (q: number) => { const index = (boot.length - 1) * q; const low = Math.floor(index); return boot[low] + (boot[Math.ceil(index)] - boot[low]) * (index - low); };
    rows.push({ pool, proxy: mean(proxies), gold: mean(golds), low: quantile(.025), high: quantile(.975), controlled: mean(controlled), judge: mean(judges), length: mean(lengths), flattery: mean(flattery) });
  }
  return rows;
}