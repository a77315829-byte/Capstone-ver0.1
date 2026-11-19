type SweepResult = { marketOpen: boolean; userCount: number; checkedCount: number; filledCount: number };

// One timer per market, no overlapping sweeps, and drain before disconnecting the DB.
export function createOrderScheduler(name: string, intervalSetting: string, sweep: () => Promise<SweepResult>) {
 let timer: ReturnType<typeof setInterval> | undefined;
 let active: Promise<void> | undefined;
 let stopping = false;
 let intervalMs = 30_000;

 function run(): Promise<void> {
  if (stopping) return Promise.resolve();
  if (active) return active;
  active = Promise.resolve().then(sweep).then(result => {
   if (result.marketOpen && result.checkedCount > 0) {
    console.log(`[${name}] users=${result.userCount} checked=${result.checkedCount} filled=${result.filledCount}`);
   }
  }).catch(error => {
   console.error(`[${name}] failed:`, error?.message || error);
  }).finally(() => { active = undefined; });
  return active;
 }

 function start() {
  if (timer) return;
  const configured = Number(process.env[intervalSetting]);
  intervalMs = Number.isFinite(configured) && configured >= 5_000 ? configured : 30_000;
  stopping = false;
  timer = setInterval(() => { void run(); }, intervalMs);
  timer.unref?.();
  console.log(`[${name}] started: ${intervalMs}ms`);
  void run();
 }

 async function stop() {
  stopping = true;
  if (timer) clearInterval(timer);
  timer = undefined;
  await active;
 }

 return { start, stop, run, status: () => ({ running: Boolean(timer), intervalMs, checking: Boolean(active) }) };
}
