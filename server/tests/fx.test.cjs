const { test } = require('node:test');
const assert = require('node:assert/strict');
const { calculateExchange, signedFundingAmount } = require('../src/utils/fx');
const { usableRate } = require('../src/services/fxRate.service');
const { withAccountMutation } = require('../src/services/accountMutationLock');

test('KRW/USD uses server rate and truncates only the received amount', () => {
  assert.equal(calculateExchange('KRW_TO_USD', 100000, 1337).targetAmount, 74.79);
  assert.equal(calculateExchange('USD_TO_KRW', 74.79, 1337).targetAmount, 99994);
  assert.equal(calculateExchange('USD_TO_KRW', 0.01, 1337).targetAmount, 13);
});
test('rejects invalid money, currencies, precision, and rates', () => {
  for (const amount of [-1, 0, NaN, Infinity, '100', 1e10, null, {}, 1.2]) assert.throws(() => calculateExchange('KRW_TO_USD', amount, 1337));
  for (const amount of [0.001, 1.111]) assert.throws(() => calculateExchange('USD_TO_KRW', amount, 1337));
  for (const rate of [0, NaN, Infinity, -1400, 1]) assert.throws(() => calculateExchange('KRW_TO_USD', 10000, rate));
  assert.throws(() => calculateExchange('USD_TO_USD', 10000, 1337));
  assert.throws(() => calculateExchange('KRW_TO_USD', 1, 1337));
});
test('repeated round trips never create currency', () => {
  for (const rate of [100, 1337, 1498.57, 10000]) for (const original of [1000, 10000, 123456, 999999999]) {
    const usd = calculateExchange('KRW_TO_USD', original, rate).targetAmount;
    assert.ok(calculateExchange('USD_TO_KRW', usd, rate).targetAmount <= original);
  }
});
test('rate age permits weekends but rejects stale, future and missing dates', () => {
  const now = Date.parse('2026-11-17T10:00:00Z');
  assert.ok(usableRate(1337, '2026-11-16', now));
  assert.ok(usableRate(1337, '2026-11-13', now));
  for (const date of ['', '2026-11-01', '2026-11-20']) assert.equal(usableRate(1337, date, now), false);
});
test('FX cashflows preserve investment P/L and treat withdrawals as negative flows', () => {
  const records = [{ amount: 1000000, type: 'MANUAL_TOP_UP' }, { amount: 100000, type: 'FX_OUT' }, { amount: 10000, type: 'FX_IN' }];
  const funding = records.reduce((sum, record) => sum + signedFundingAmount(record), 0);
  assert.equal(funding, 910000);
  assert.equal(915000 - funding, 5000);
  assert.equal(signedFundingAmount({ type: 'FX_OUT', amount: 2000000 }), -2000000);
});
test('account locks serialize orders/conversion, allow nested calls and release on error', async () => {
  const events = []; let release;
  const first = withAccountMutation('a', async () => {
    events.push('first');
    await withAccountMutation('a', async () => events.push('nested'));
    await new Promise(resolve => { release = resolve; });
    events.push('released');
  });
  await new Promise(resolve => setImmediate(resolve));
  const second = withAccountMutation('a', async () => events.push('second'));
  await withAccountMutation('b', async () => events.push('other'));
  assert.deepEqual(events, ['first', 'nested', 'other']);
  release(); await Promise.all([first, second]);
  assert.deepEqual(events, ['first', 'nested', 'other', 'released', 'second']);
  await assert.rejects(withAccountMutation('a', async () => { throw new Error('test'); }));
  assert.equal(await withAccountMutation('a', async () => 42), 42);
});
