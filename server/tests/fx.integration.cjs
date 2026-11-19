// Explicit opt-in: creates temporary account records and deletes only those IDs.
// Run from server: node -r ts-node/register tests/fx.integration.cjs
const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');
const inherited = { ...process.env };
for (const file of ['../.env', '../../.env.exhibition']) {
  const full = path.resolve(__dirname, file);
  if (fs.existsSync(full)) for (const [key, value] of Object.entries(dotenv.parse(fs.readFileSync(full)))) {
    if (value !== '' && inherited[key] === undefined) process.env[key] = value;
  }
}
require('../src/utils/runtime');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { mongoUri } = require('../src/utils/db');
const KR = require('../src/models/tradingAccount.model').default;
const US = require('../src/models/usTradingAccount.model').default;
const Funding = require('../src/models/fundingTransaction.model').default;
const { FxQuote, FxConversion } = require('../src/models/fx.model');
const { convertFx } = require('../src/services/fx.service');
const { calculateExchange } = require('../src/utils/fx');
const ids = [new mongoose.Types.ObjectId().toString(), new mongoose.Types.ObjectId().toString()];
const token = id => jwt.sign({ id }, process.env.STOTRA_JWT_SECRET, { expiresIn: '10m', algorithm: 'HS256' });
const auth = token(ids[0]); const otherAuth = token(ids[1]);
const checks = [];
async function call(path, body, authValue = auth) {
  const res = await fetch(`http://127.0.0.1:3010/api/fx/${path}`, { method: body === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json', ...(authValue ? { authorization: `Bearer ${authValue}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(30000) });
  return { status: res.status, data: await res.json() };
}
const quote = (amount, direction = 'KRW_TO_USD') => call('quote', { direction, amount });
const exec = quoteId => call('convert', { quoteId });
const check = name => { checks.push(name); console.log(`PASS ${name}`); };
(async () => {
  await mongoose.connect(mongoUri(), { dbName: process.env.MONGO_DB_NAME, serverSelectionTimeoutMS: 10000 });
  try {
    assert.equal((await call('wallet', undefined, null)).status, 401);
    const rate = await call('rate', undefined, null); assert.equal(rate.status, 200); assert.ok(rate.data.rate > 100); check('public live rate / private account authentication');
    await KR.create({ userId: ids[0], cash: 1000000, totalDeposits: 1000000, reservedCash: 900000 });
    assert.equal((await quote(100001)).status, 409);
    for (const amount of [-1, 0, '1000', 1.25]) assert.equal((await quote(amount)).status, 400);
    const first = await call('quote', { direction: 'KRW_TO_USD', amount: 100000, rate: 1, targetAmount: 99999999 });
    assert.equal(first.status, 200); assert.equal(first.data.rate, rate.data.rate);
    assert.equal(first.data.targetAmount, calculateExchange('KRW_TO_USD', 100000, rate.data.rate).targetAmount); check('server-owned rate / amounts / reserved cash validation');
    assert.equal((await call('convert', { quoteId: first.data.quoteId }, otherAuth)).status, 404); check('quote ownership isolation');
    const attempts = await Promise.all([exec(first.data.quoteId), exec(first.data.quoteId), exec(first.data.quoteId)]);
    attempts.forEach(result => assert.equal(result.status, 200, JSON.stringify(result.data)));
    let wallet = (await call('wallet')).data;
    assert.equal(wallet.KRW.cash, 900000); assert.equal(wallet.KRW.availableCash, 0); assert.equal(wallet.USD.cash, first.data.targetAmount);
    assert.equal(await FxConversion.countDocuments({ userId: ids[0] }), 1);
    assert.equal(await Funding.countDocuments({ userId: ids[0] }), 2);
    assert.equal((await KR.findOne({ userId: ids[0] })).totalDeposits, 900000);
    assert.equal((await US.findOne({ userId: ids[0] })).totalDeposits, first.data.targetAmount); check('atomic KRW to USD / account creation / concurrent idempotent execution / funding ledger');
    await FxQuote.updateOne({ quoteId: first.data.quoteId }, { expiresAt: new Date(Date.now() - 1000) });
    assert.equal((await exec(first.data.quoteId)).status, 200); check('completed quote retry after expiration');
    const reverse = await quote(25, 'USD_TO_KRW'); assert.equal(reverse.status, 200);
    const reversed = await exec(reverse.data.quoteId); assert.equal(reversed.status, 200);
    assert.equal(reversed.data.wallet.KRW.cash, 900000 + reverse.data.targetAmount);
    assert.equal(reversed.data.wallet.USD.cash, Math.round((first.data.targetAmount - 25) * 100) / 100); check('USD to KRW and cent precision');
    await KR.updateOne({ userId: ids[0] }, { reservedCash: 0 });
    const expired = await quote(10000); assert.equal(expired.status, 200);
    await FxQuote.updateOne({ quoteId: expired.data.quoteId }, { expiresAt: new Date(Date.now() - 1000) });
    assert.equal((await exec(expired.data.quoteId)).status, 409); check('unexecuted expired quote rejection');
    const changed = await quote(50000); assert.equal(changed.status, 200);
    await KR.updateOne({ userId: ids[0] }, { reservedCash: reversed.data.wallet.KRW.cash - 1000 });
    const before = (await call('wallet')).data;
    assert.equal((await exec(changed.data.quoteId)).status, 409);
    assert.deepEqual((await call('wallet')).data, before); check('balance recheck at execution leaves both accounts untouched');
    await KR.updateOne({ userId: ids[0] }, { reservedCash: 0 });
    const rollback = await quote(10000); assert.equal(rollback.status, 200);
    const beforeRollback = (await call('wallet')).data;
    const originalCreate = Funding.create;
    Funding.create = async () => { throw new Error('TEST_INJECTED_LEDGER_FAILURE'); };
    try { await assert.rejects(convertFx(ids[0], rollback.data.quoteId), /TEST_INJECTED_LEDGER_FAILURE/); }
    finally { Funding.create = originalCreate; }
    assert.deepEqual((await call('wallet')).data, beforeRollback);
    assert.equal(await FxConversion.countDocuments({ quoteId: rollback.data.quoteId }), 0); check('ledger failure rolls back both currency accounts and receipt');
    await KR.updateOne({ userId: ids[0] }, { cash: 1000, totalDeposits: 1000 });
    await US.updateOne({ userId: ids[0] }, { cash: 0, totalDeposits: 0 });
    const a = await quote(800); const b = await quote(800);
    assert.equal(a.status, 200); assert.equal(b.status, 200);
    const racing = await Promise.all([exec(a.data.quoteId), exec(b.data.quoteId)]);
    assert.deepEqual(racing.map(r => r.status).sort(), [200, 409]);
    assert.equal((await call('wallet')).data.KRW.cash, 200); check('different quotes racing cannot overdraw the same wallet');
    const history = await call('history'); assert.equal(history.status, 200); assert.equal(history.data.length, 3);
    assert.deepEqual((await call('history', undefined, otherAuth)).data, []); check('persistent history and user isolation');
    console.log(JSON.stringify({ passed: checks.length, checks }));
  } finally {
    for (const model of [FxConversion, FxQuote, Funding, KR, US]) await model.deleteMany({ userId: { $in: ids } });
    console.log('Temporary test records removed; existing user balances were not modified.');
    await mongoose.disconnect();
  }
})().catch(error => { console.error(JSON.stringify({ name: error.name, message: error.message, code: error.code })); process.exitCode = 1; });
