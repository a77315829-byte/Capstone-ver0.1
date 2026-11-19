import { AsyncLocalStorage } from 'async_hooks';

// The exhibition runs one API process. Serialize cash mutations across BOTH
// markets, including scheduler fills; nested service calls reuse their lock.
const owners = new AsyncLocalStorage<Set<string>>();
const queues = new Map<string, Promise<void>>();
export async function withAccountMutation<T>(userId: string | undefined, work: () => Promise<T>): Promise<T> {
  const key = String(userId || '').trim();
  if (!key || owners.getStore()?.has(key)) return work();
  const previous = queues.get(key) || Promise.resolve();
  let release!: () => void;
  const ticket = new Promise<void>(resolve => { release = resolve; });
  queues.set(key, ticket);
  await previous;
  try { return await owners.run(new Set([...(owners.getStore() || []), key]), work); }
  finally { release(); if (queues.get(key) === ticket) queues.delete(key); }
}
