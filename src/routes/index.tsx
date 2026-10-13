import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Activity, ArrowDownRight, ArrowUpRight, ArrowRight, Check, ChevronDown, Download, FlaskConical, Info, Play, RotateCcw, Settings2, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { defaults, runExperiment, strengths, type Capacity, type Result, type Settings } from '@/lib/reward-model';

export const Route = createFileRoute('/')({
  head: () => ({ meta: [
    { title: 'RewardLab — Hunting the Reward Hack' },
    { name: 'description', content: 'Run a reproducible synthetic reward-hacking experiment. Compare proxy reward, held-out gold quality, and an independent judge.' },
    { property: 'og:title', content: 'RewardLab — Hunting the Reward Hack' },
    { property: 'og:description', content: 'An interactive experiment in reward optimization and true quality.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
  component: Index,
});

const format = (value: number) => value.toFixed(2);
function RewardPlot({ rows, showJudge, confidence = false }: { rows: Result[]; showJudge: boolean; confidence?: boolean }) {
  const width = 780, height = 310, left = 53, right = 28, top = 22, bottom = 47;
  const values = rows.flatMap(r => confidence ? [r.low, r.high] : [r.proxy, r.gold, ...(showJudge ? [r.judge] : [])]);
  const minimum = Math.floor(Math.min(-1, ...values)), maximum = Math.ceil(Math.max(1, ...values));
  const x = (i: number) => left + i / Math.max(1, rows.length - 1) * (width - left - right);
  const y = (v: number) => top + (maximum - v) / (maximum - minimum) * (height - top - bottom);
  const points = (key: 'proxy' | 'gold' | 'judge') => rows.map((r, i) => `${x(i)},${y(r[key])}`).join(' ');
  return <svg viewBox={`0 0 ${width} ${height}`} className="plot-svg" role="img" aria-label={confidence ? 'Gold reward with 95% bootstrap confidence intervals' : 'Proxy reward versus gold reward across candidate pool sizes'}>
    {Array.from({ length: 6 }, (_, i) => minimum + (maximum - minimum) * i / 5).map(v => <g key={v}><line x1={left} x2={width-right} y1={y(v)} y2={y(v)} className="plot-grid"/><text x={left-15} y={y(v)+4} textAnchor="end" className="plot-label">{v.toFixed(1)}</text></g>)}
    {rows.map((r, i) => <text key={r.pool} x={x(i)} y={height-23} textAnchor="middle" className="plot-label">{r.pool}</text>)}
    <polygon className="plot-ci" points={[...rows.map((r,i)=>`${x(i)},${y(r.high)}`), ...rows.map((r,i)=>`${x(i)},${y(r.low)}`).reverse()].join(' ')}/>
    {!confidence && <polyline points={points('proxy')} className="plot-proxy"/>}
    <polyline points={points('gold')} className="plot-gold"/>
    {showJudge && !confidence && <polyline points={points('judge')} className="plot-judge"/>}
    {rows.map((r,i)=><g key={r.pool}>{!confidence && <circle cx={x(i)} cy={y(r.proxy)} r="4" className="fill-proxy"/>}<circle cx={x(i)} cy={y(r.gold)} r="4" className="fill-gold"/>{confidence && <><line x1={x(i)} x2={x(i)} y1={y(r.low)} y2={y(r.high)} className="plot-gold"/><line x1={x(i)-5} x2={x(i)+5} y1={y(r.low)} y2={y(r.low)} className="plot-gold"/><line x1={x(i)-5} x2={x(i)+5} y1={y(r.high)} y2={y(r.high)} className="plot-gold"/></>}<title>{`Pool ${r.pool}: proxy ${format(r.proxy)}, gold ${format(r.gold)}, CI [${format(r.low)}, ${format(r.high)}]`}</title></g>)}
  </svg>;
}
function Index() {
  const [settings, setSettings] = useState<Settings>(defaults);
  const [applied, setApplied] = useState<Settings>(defaults);
  const [rows, setRows] = useState<Result[]>([]);
  const [busy, setBusy] = useState(false);
  const [runs, setRuns] = useState(0);
  const [tab, setTab] = useState('rewards');
  const [judge, setJudge] = useState(true);
  const [comparison, setComparison] = useState<{ training: number; capacity: Capacity; row: Result }[]>([]);
  useEffect(() => { setRows(runExperiment(defaults)); }, []);
  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => setSettings(s => ({ ...s, [key]: value }));
  const execute = () => {
    setBusy(true);
    window.setTimeout(() => {
      setRows(runExperiment(settings)); setApplied({ ...settings }); setComparison([]); setRuns(r => r+1); setBusy(false);
    }, 40);
  };
  const compare = () => {
    setBusy(true);
    window.setTimeout(() => {
      const results: typeof comparison = [];
      for (const training of [80,400,2000]) for (const capacity of ['small','medium','large'] as Capacity[]) {
        const result = runExperiment({ ...applied, training, capacity, trials: 200, seed: applied.seed + training, maxPool: 128 });
        for (const row of result.filter(r=>[8,32,128].includes(r.pool))) results.push({ training, capacity, row });
      }
      setComparison(results); setBusy(false);
    }, 40);
  };
  const exportData = () => {
    const header = 'pool_size,proxy_reward_mean,gold_reward_mean,gold_ci_low,gold_ci_high,length_controlled_mean,independent_judge_mean,mean_length';
    const data = rows.map(r=>[r.pool,r.proxy,r.gold,r.low,r.high,r.controlled,r.judge,r.length].join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([`${header}\n${data}`], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href=url; a.download='rewardlab-results.csv'; a.click(); URL.revokeObjectURL(url);
  };
  const first=rows[0], last=rows[rows.length-1];
  const best=rows.reduce<Result | undefined>((best,r)=>!best || r.gold>best.gold ? r : best, undefined);
  const dirty = JSON.stringify(settings)!==JSON.stringify(applied);
  return <>
    <header className="app-header"><div className="app-width flex h-full items-center justify-between"><div className="flex items-center gap-3"><span className="brand-mark"><Activity size={21}/></span><span className="text-xl font-semibold">RewardLab<span className="text-primary">.</span></span><span className="desktop-label ml-5 border-l border-border pl-5 text-sm text-muted-foreground">Reinforcement learning experiments</span></div><div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="status-dot"/>Synthetic environment</div></div></header>
    <main className="app-width pb-10 pt-10">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-5"><div><div className="eyebrow mb-3 flex items-center gap-2"><FlaskConical size={13}/>Experiment 01 <span className="px-1">/</span> Reward optimization</div><h1 className="page-title">Hunting the reward hack</h1><p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">When a higher score doesn't mean a better answer.<br className="desktop-label"/> Explore the gap between proxy reward and true quality.</p></div><div className="mt-3 flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground"><ShieldCheck size={14} className="text-primary"/>One-step bandit <span className="text-border">|</span> Best-of-N</div></div>
      <div className="experiment-layout">
        <aside className="control-panel">
          <div className="control-section"><div className="mb-1 flex items-center gap-2 text-sm font-semibold"><SlidersHorizontal size={16}/>Experiment setup</div><p className="mt-2 text-xs text-muted-foreground">Model & optimization settings</p></div>
          <div className="control-section space-y-6">
            <div><label className="mb-3 block text-xs font-medium">Training examples</label><div className="segmented">{[80,400,2000].map(n=><Button key={n} variant="ghost" data-active={settings.training===n} aria-pressed={settings.training===n} onClick={()=>update('training',n)}>{n.toLocaleString()}</Button>)}</div></div>
            <div><label className="mb-3 block text-xs font-medium">Proxy model capacity</label><div className="segmented">{(['small','medium','large'] as Capacity[]).map(c=><Button key={c} variant="ghost" data-active={settings.capacity===c} aria-pressed={settings.capacity===c} onClick={()=>update('capacity',c)} className="capitalize">{c}</Button>)}</div><div className="mt-2 flex justify-between text-[11px] text-muted-foreground"><span>Shortcut strength</span><span className="mono">{strengths[settings.capacity].toFixed(2)}</span></div></div>
            <div><div className="mb-4 flex items-center justify-between"><label className="text-xs font-medium">Maximum pool size</label><span className="mono rounded bg-secondary px-2 py-1 text-xs text-primary">{settings.maxPool}</span></div><Slider aria-label="Maximum pool size" value={[Math.log2(settings.maxPool)]} onValueChange={v=>update('maxPool',2**v[0])} min={1} max={7} step={1}/><div className="mono mt-3 flex justify-between text-[10px] text-muted-foreground"><span>2</span><span>128 candidates</span></div></div>
          </div>
          <div className="control-section space-y-5"><div><label className="mb-2 block text-xs font-medium" htmlFor="trials">Trials per pool size</label><select id="trials" className="form-input" value={settings.trials} onChange={e=>update('trials',Number(e.target.value))}><option value={100}>100 trials</option><option value={250}>250 trials</option><option value={500}>500 trials</option><option value={1000}>1,000 trials</option></select></div><div><label className="mb-2 block text-xs font-medium" htmlFor="seed">Random seed</label><input id="seed" className="form-input" type="number" min={0} max={4294967295} value={settings.seed} onChange={e=>update('seed',Math.max(0,Math.min(4294967295,Number(e.target.value))))}/></div></div>
          <div className="control-section"><Button className="h-11 w-full" onClick={execute} disabled={busy}>{busy ? <Activity className="animate-pulse"/> : <Play size={15}/>} {busy?'Running experiment…':'Run experiment'}</Button><Button variant="ghost" className="mt-2 w-full text-xs text-muted-foreground" disabled={busy} onClick={()=>setSettings({...defaults})}><RotateCcw size={13}/>Reset settings</Button><p className="mt-3 text-center text-[10px] text-muted-foreground">{dirty ? 'Settings changed · ready to run' : 'Seeded & reproducible'}</p></div>
        </aside>
        <section className="min-w-0">
          <div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-2 text-sm font-semibold">Experiment results <span className="rounded bg-secondary px-2 py-0.5 text-[10px] font-medium text-primary">{busy?'RUNNING':rows.length?'COMPLETE':'INITIALIZING'}</span></div><Button variant="ghost" size="sm" onClick={exportData} disabled={!rows.length || busy} className="text-muted-foreground"><Download size={14}/><span className="desktop-label">Export CSV</span></Button></div>
          <div className="stat-grid mb-5"><div className="stat-card"><div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">Proxy reward<ArrowUpRight size={16} className="text-proxy"/></div><div className="stat-number mono text-proxy">{last?format(last.proxy):'—'}</div><div className="mt-2 text-[10px] text-muted-foreground">{last&&first?`${format(last.proxy-first.proxy)} vs. pool size 1`:'Mean optimized score'}</div></div><div className="stat-card"><div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">Gold reward<ArrowDownRight size={16} className="text-gold"/></div><div className="stat-number mono text-gold">{last?format(last.gold):'—'}</div><div className="mt-2 text-[10px] text-muted-foreground">{last&&first?`${format(last.gold-first.gold)} vs. pool size 1`:'Mean held-out score'}</div></div><div className="stat-card"><div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">Reward gap<ArrowRight size={16}/></div><div className="stat-number mono">{last?format(last.proxy-last.gold):'—'}</div><div className="mt-2 text-[10px] text-muted-foreground">At {applied.maxPool} candidates</div></div></div>
          <div className="plot-panel"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5"><div className="flex gap-5">{[['rewards','Reward curves'],['confidence','Confidence intervals'],['comparison','Comparison']].map(([id,label])=><Button key={id} variant="ghost" className="tab-button text-xs" data-active={tab===id} onClick={()=>setTab(id)}>{label}</Button>)}</div></div>
            {tab!=='comparison' ? <><div className="flex flex-wrap items-start justify-between gap-4 px-5 pb-2 pt-5"><div><h2 className="text-sm font-semibold">{tab==='confidence'?'Gold reward & uncertainty':'Proxy reward vs. true quality'}</h2><p className="mt-1 text-[11px] text-muted-foreground">{applied.trials} trials per pool · {applied.training.toLocaleString()} training examples · {applied.capacity} capacity</p></div><div className="flex flex-wrap gap-4 text-[10px] text-muted-foreground">{tab!=='confidence'&&<span className="flex items-center gap-1.5"><i className="legend-dot bg-proxy"/>Proxy</span>}<span className="flex items-center gap-1.5"><i className="legend-dot bg-gold"/>Gold</span>{tab!=='confidence'&&<label className="flex cursor-pointer items-center gap-1.5"><input type="checkbox" aria-label="Show independent judge" checked={judge} onChange={e=>setJudge(e.target.checked)} className="accent-primary"/><i className="legend-dot bg-judge"/>Judge</label>}</div></div><div className="px-2 pt-2">{rows.length?<RewardPlot rows={rows} showJudge={judge} confidence={tab==='confidence'}/>:<div className="h-64"/>}</div><div className="pb-5 text-center text-[11px] text-muted-foreground">Candidate pool size <span className="px-1">·</span> increasing optimization pressure →</div><div className="flex items-center gap-2 border-t border-border bg-muted/40 px-5 py-3 text-[10px] text-muted-foreground"><Info size={13}/>{tab==='confidence'?'95% bootstrap intervals · 800 resamples per setting':'Shaded area represents the gold reward’s 95% confidence interval.'}</div></> : <div className="p-5"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-sm font-semibold">Training data × model capacity</h2><p className="mt-1 text-xs text-muted-foreground">9 settings · 200 trials · pools of 8, 32, and 128</p></div><Button size="sm" onClick={compare} disabled={busy}><Play/>{comparison.length?'Run again':'Run comparison'}</Button></div>{comparison.length ? <div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Training</th><th>Capacity</th><th>Pool</th><th>Proxy</th><th>Gold</th><th>Judge</th></tr></thead><tbody>{comparison.map(c=><tr key={`${c.training}-${c.capacity}-${c.row.pool}`}><td>{c.training}</td><td>{c.capacity}</td><td>{c.row.pool}</td><td className="text-proxy">{format(c.row.proxy)}</td><td className="text-gold">{format(c.row.gold)}</td><td>{format(c.row.judge)}</td></tr>)}</tbody></table></div> : <div className="flex h-52 flex-col items-center justify-center gap-3 text-muted-foreground"><Settings2 size={28}/><span className="text-sm">Comparison not run</span></div>}</div>}
          </div>
          {last&&first&&<div className="my-5 flex items-start gap-3 rounded-md border border-border bg-warning-surface px-4 py-4"><span className="mt-0.5 text-warning-ink"><Info size={17}/></span><div><h3 className="text-xs font-semibold text-warning-ink">{last.proxy>first.proxy && last.gold<first.gold ? 'Reward hacking detected' : 'Experiment observation'}</h3><p className="mt-1.5 text-xs leading-relaxed text-warning-ink">{last.proxy>first.proxy && last.gold<first.gold ? 'The proxy score rises while held-out quality falls. More candidates give the model more opportunities to exploit flattery and length.' : 'Compare proxy and gold rewards across pool sizes. This setting does not show the default rise–fall pattern.'} Best observed gold reward: pool size {best?.pool}.</p></div></div>}
          <div className="plot-panel"><div className="flex items-center justify-between px-5 py-4"><h2 className="text-sm font-semibold">Results by pool size</h2><span className="mono text-[10px] text-muted-foreground">{rows.length} settings</span></div><div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Pool size</th><th>Proxy reward</th><th>Gold reward</th><th>95% gold CI</th><th>Judge</th><th>Avg. length</th></tr></thead><tbody>{rows.map(r=><tr key={r.pool}><td>{r.pool}{r.pool===best?.pool&&<Check size={11} className="ml-2 inline text-primary"/>}</td><td className="text-proxy">{format(r.proxy)}</td><td className="text-gold">{format(r.gold)}</td><td className="text-muted-foreground">[{format(r.low)}, {format(r.high)}]</td><td>{format(r.judge)}</td><td>{r.length.toFixed(1)}</td></tr>)}</tbody></table></div></div>
          {last&&<div className="mt-5 grid grid-cols-2 gap-5 border-b border-border pb-5"><div><p className="eyebrow mb-2">Length-controlled gold</p><span className="mono text-lg">{format(last.controlled)}</span><p className="mt-1 text-[11px] text-muted-foreground">Explicit length penalty removed</p></div><div><p className="eyebrow mb-2">Selected flattery</p><span className="mono text-lg">{format(last.flattery)}</span><p className="mt-1 text-[11px] text-muted-foreground">Mean at the largest candidate pool</p></div></div>}
        </section>
      </div>
      <details className="mt-8 border-t border-border pt-5"><summary className="flex cursor-pointer list-none items-center justify-between text-xs font-medium text-muted-foreground"><span className="flex items-center gap-2"><FlaskConical size={14}/>Experiment methodology</span><ChevronDown size={14}/></summary><div className="mt-4 grid gap-5 text-xs leading-relaxed text-muted-foreground md:grid-cols-3"><div><h3 className="mb-2 font-semibold text-foreground">Synthetic candidates</h3><p>Quality ~ N(0, 1). Flattery ~ |N(0, 1)|. Length ~ N(30 + 7 × flattery, 8), clipped to [5, 90]. The highest proxy score wins each one-step episode.</p></div><div><h3 className="mb-2 font-semibold text-foreground">Held-out gold reward</h3><p className="mono text-[11px]">quality − 0.55 × flattery² − 0.012 × max(length − 30, 0)</p><p className="mt-2">Gold is evaluated only after selection. The independent judge uses a 0.35 flattery penalty and N(0, 0.25) noise.</p></div><div><h3 className="mb-2 font-semibold text-foreground">Proxy & reproducibility</h3><p>Least-squares regression on standardized features; noisy labels use quality − 0.30 × flattery². Proxy adds capacity-dependent flattery and 0.65 × standardized length shortcuts. The equations match the notebook; browser randomness differs from NumPy, so scores are not identical.</p></div></div></details>
      <footer className="mt-7 flex flex-wrap items-center justify-between gap-3 text-[10px] text-muted-foreground"><span>RewardLab <span className="px-2">/</span> A synthetic study of reward optimization</span><span className="mono">Seed {applied.seed} · {runs?`Run ${runs}`:'Initial run'} · No real language model</span></footer>
    </main>
  </>;
}