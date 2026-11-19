// Read-only live check; start the exhibition server first. No account or trade writes.
const assert = require('node:assert/strict');
const base = process.env.TEST_API_BASE || 'http://127.0.0.1:3010/api';
const get = query => fetch(`${base}/markets/overview?${query}`, { signal: AbortSignal.timeout(35000) });
(async () => {
  let passed = 0;
  for (const market of ['KR', 'US']) {
    const samples = {};
    for (const sort of ['volume', 'turnover', 'gainers', 'losers']) {
      const response = await get(new URLSearchParams({ market, sort }));
      assert.equal(response.status, 200);
      const result = await response.json();
      assert.equal(result.market, market); assert.equal(result.sort, sort);
      assert.equal(result.ranking.stale, false); assert.equal(result.ranking.error, null);
      const rows = result.ranking.data;
      assert.equal(rows.length, 30, `${market} ${sort}: expected 30 current leaders`);
      const value = row => row[sort === 'volume' ? 'volume' : sort === 'turnover' ? 'turnover' : 'changeRate'];
      rows.forEach((row, index) => {
        assert.ok(Number.isFinite(value(row)));
        if (sort === 'gainers') assert.ok(value(row) > 0);
        if (sort === 'losers') assert.ok(value(row) < 0);
        if (index) assert.ok(sort === 'losers' ? value(rows[index - 1]) <= value(row) : value(rows[index - 1]) >= value(row));
      });
      assert.equal(new Set(rows.map(row => `${row.exchange || 'KR'}:${row.symbol}`)).size, rows.length);
      assert.ok(result.indices.every(index => index.data?.price > 0 && !index.stale));
      samples[sort] = rows.map(row => row.symbol).join(',');
      console.log(JSON.stringify({ passed: true, market, sort, rows: rows.length, first: rows[0].symbol, value: value(rows[0]) }));
      passed++;
    }
    // Different API rankings must not be the same 30 volume leaders reordered.
    assert.notEqual(samples.volume.split(',').sort().join(','), samples.turnover.split(',').sort().join(','));
  }
  for (const query of ['market=bad', 'sort=bad', 'sort=__proto__', 'sort=volume&sort=losers']) assert.equal((await get(query)).status, 400);
  const defaultResponse = await (await get('market=KR')).json();
  assert.equal(defaultResponse.sort, 'volume');
  console.log(JSON.stringify({ passed, invalidInputsRejected: 4, defaultSort: 'volume' }));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
