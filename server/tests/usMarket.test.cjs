const {test} = require('node:test');
const assert = require('node:assert/strict');
const {parseUsIntradayRows} = require('../src/utils/usIntraday');
const {normalizeSimulationStock} = require('../src/utils/marketSimulation');
const {marketFallback} = require('../src/services/exhibitionFallback.service');
const row = (kymd, khms, last='155.12') => ({kymd, khms, open:'155.10', high:'155.30', low:'155.01', last, evol:'2345'});

test('US catalog search presents descriptive Korean names and preserves ticker/exchange identity', async () => {
  const {searchUsStocks} = require('../src/utils/requests');
  const results = await searchUsStocks('디렉시온');
  assert.ok(results.some(item => item.symbol === 'SOXL' && item.name === '디렉시온 미국 반도체 3배 ETF' && item.exchange === 'AMS' && item.assetType === 'ETF'));
  assert.ok(results.some(item => item.symbol === 'SOXS' && item.name.includes('인버스')));
  const exact = await searchUsStocks('TQQQ');
  assert.equal(exact[0].symbol, 'TQQQ');
  assert.equal(exact[0].name, '프로셰어즈 나스닥100 3배 ETF');
  assert.ok(exact[0].summary.includes('일간'));
});

test('US intraday timestamps keep midnight rollover and DST independent of host timezone', () => {
  const points=parseUsIntradayRows([row('20261117','003000'),row('20260701','223000')]);
  assert.equal(new Date(points[0].time*1000).toISOString(),'2026-07-01T13:30:00.000Z');
  assert.equal(new Date(points[1].time*1000).toISOString(),'2026-11-16T15:30:00.000Z');
  assert.equal(points[1].close,155.12);
  assert.equal(points[1].volume,2345);
});
test('US candles sort, deduplicate and reject incomplete or impossible OHLC data',()=>{
  const points=parseUsIntradayRows([row('20261117','003500'),row('20261117','003000'),row('20261117','003000'),row('20261117','003600','0'),{...row('20261117','003700'),high:'1'}, {...row('20261117','003800'),khms:''}]);
  assert.equal(points.length,2);
  assert.equal(points[1].time-points[0].time,300);
  assert.deepEqual(parseUsIntradayRows(null),[]);
  assert.deepEqual(parseUsIntradayRows([null, undefined, 'invalid']),[]);
});
test('US simulator uses ticker/exchange and USD; KR callers remain compatible',()=>{
  const stock=normalizeSimulationStock({code:'spy',name:'SPY ETF',market:'US',exchange:'AMS',currency:'KRW'});
  assert.deepEqual(stock,{code:'SPY',name:'SPY ETF',market:'US',exchange:'AMS',currency:'USD'});
  assert.equal(normalizeSimulationStock({code:'005930',name:'삼성전자'}).currency,'KRW');
  assert.equal(normalizeSimulationStock({code:'NVDA',name:'엔비디아',market:'KR'}),null);
  assert.equal(normalizeSimulationStock({code:'NVDA',name:'엔비디아',exchange:'anything'}),null);
});
test('US algorithm fallback keeps decimal USD quote and uses no invented price offline',()=>{
  const stock=normalizeSimulationStock({code:'NVDA',name:'엔비디아',market:'US'});
  const result=marketFallback(stock,'수요 증가와 실적 개선','hypothetical_scenario',{price:155.12,changeRate:1.2});
  assert.equal(result.current_stock_context.current_price,155.12);
  assert.equal(result.current_stock_context.currency,'USD');
  assert.equal(result.meta.fallback_used,true);
  assert.equal(result.agent_reactions.length,5);
  assert.equal(marketFallback(stock,'수요 증가',null,null).current_stock_context.current_price,null);
});
