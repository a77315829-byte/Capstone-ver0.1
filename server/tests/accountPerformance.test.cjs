const { test } = require('node:test');
const assert = require('node:assert/strict');
const { accountPerformance, fundedCapital } = require('../src/utils/accountPerformance');
test('sold-out loss persists even with zero initial cash and zero holdings', () => {
  const p = accountPerformance(989997, 0, 0, 0, 1000000, 1000000);
  assert.equal(p.totalProfitLoss, -10003);
  assert.equal(p.totalProfitLossRate, -1.0003);
});
test('realized and unrealized losses are both included', () => {
  const p = accountPerformance(700000, 250000, 300000, 0, 1010000, 1010000);
  assert.equal(p.unrealizedProfitLoss, -50000);
  assert.equal(p.totalProfitLoss, -60000);
});
test('FX withdrawals do not become losses or erase return after full withdrawal', () => {
  const p = accountPerformance(0, 0, 0, 0, -10003, 1000000);
  assert.equal(p.totalProfitLoss, 10003);
  assert.equal(p.investedCapital, 1000000);
  assert.equal(p.totalProfitLossRate, 1.0003);
});
test('recycling exchanged money does not double the return denominator', () => {
  const records = [{type:'MANUAL_TOP_UP',amount:1000000},{type:'FX_OUT',amount:300000},{type:'FX_IN',amount:300000}];
  assert.equal(fundedCapital(0,1000000,records),1000000);
  assert.equal(fundedCapital(0,-1,[{type:'FX_IN',amount:1000},{type:'FX_OUT',amount:1001}]),1000);
});
test('legacy funding absent from the ledger is retained and new funding expands capital', () => {
  assert.equal(fundedCapital(0,1500000,[{type:'MANUAL_TOP_UP',amount:500000}]),1500000);
});

const { externalCapital } = require('../src/utils/accountPerformance');
const { combinedHoldingPerformance } = require('../src/utils/accountPerformance');
test('held return uses remaining KR/USD purchase cost, not cash, deposits or realized profit',()=>{
 const p=combinedHoldingPerformance(100000,90000,100,80,1300);
 assert.equal(p.buyAmount,230000);assert.equal(p.profit,-36000);
 assert.equal(p.rate,-36000/230000*100);
 assert.equal(combinedHoldingPerformance(100000,90000,0,0,0).rate,-10);
 assert.equal(combinedHoldingPerformance(0,0,0,0,1300).rate,null);
});
test('combined principal excludes FX transfers while retaining original outside funding', () => {
 const kr=[{type:'MANUAL_TOP_UP',amount:1000000},{type:'FX_OUT',amount:500000},{type:'FX_IN',amount:510000}];
 const us=[{type:'FX_IN',amount:400},{type:'FX_OUT',amount:400}];
 assert.equal(externalCapital(0,1010000,kr),1000000);
 assert.equal(externalCapital(0,0,us),0);
});
test('combined principal preserves legacy funding and direct USD contributions', () => {
 assert.equal(externalCapital(0,1000,[]),1000);
 assert.equal(externalCapital(1000,200,[{type:'MANUAL_TOP_UP',amount:200}]),1200);
});
