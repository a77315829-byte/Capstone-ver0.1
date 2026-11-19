import { test } from 'node:test';
import assert from 'node:assert/strict';
import { performancePoints, performanceDomain } from '../src/utils/performanceChart.ts';
import { holdingPerformancePoints } from '../src/utils/performanceChart.ts';
test('held return history preserves each observed cost basis and never invents earlier prices',()=>{
 const old={date:'2026-11-16',profit:-100,rate:-10,buyAmount:1000,observedAt:'2026-11-16T09:00:00Z'};
 const current={date:'2026-11-17',profit:100,rate:5,buyAmount:2000,observedAt:'2026-11-17T09:00:00Z'};
 const points=holdingPerformancePoints([old],current,365);
 assert.equal(points.length,2);assert.equal(points[0].value,-10);assert.equal(points[1].value,5);
 assert.equal(points[0].date,'2026-11-16');
 assert.equal(holdingPerformancePoints([old],current,1).length,1);
 assert.equal(holdingPerformancePoints([], {...current,rate:null,buyAmount:0,profit:0},365)[0].value,null);
});
test('holding loss is visible with no sells, using funded capital when initial cash is zero', () => {
  assert.equal(performancePoints([], 1000000, -50000).at(-1)?.value, -5);
});
test('selected window retains cumulative earlier losses rather than resetting to zero', () => {
  const points = performancePoints([{date:'2026-09-01',profit:-10000},{date:'2026-11-16',profit:-5000}],1000000,-18000,7,Date.parse('2026-11-17T00:00:00+09:00'));
  assert.equal(points[0].value,-1);
  assert.equal(points[1].value,-1.5);
  assert(Math.abs(points.at(-1)!.value + 1.8) < 1e-10);
});
test('more than fifty fills contribute to cumulative performance', () => {
  const points = performancePoints(Array.from({length:80},()=>({date:'2026-11-16',profit:-100})),1000000,-8000);
  assert.equal(points.at(-2)?.value,-0.8);
});

test('all six period controls map to different calendar ranges and preserve recorded dates', () => {
 const now=Date.parse('2026-11-17T16:00:00+09:00');
 const first='2025-01-01';
 const starts=[7,30,90,180,365,undefined].map(days=>performanceDomain(days,now,first).start);
 assert.equal(new Set(starts).size,6);
 starts.forEach((start,i)=>{if(i>0)assert(start<starts[i-1])});
 const points=performancePoints([{date:'2025-03-01',profit:100},{date:'2026-11-16',profit:-200}],1000,-150,7,now,first);
 assert.equal(points[0].value,10);
 assert.equal(points[1].date,'2026-11-16');assert.equal(points[1].value,-10);
 assert.equal(points.at(-1)?.value,-15);assert.equal(points.at(-1)?.kind,'current');
});
test('new accounts leave the time before the first record empty instead of inventing past valuation', () => {
 const now=Date.parse('2026-11-17T16:00:00+09:00');
 const points=performancePoints([],1000,-100,365,now,'2026-11-16');
 assert.equal(points[0].date,'2026-11-16');
 assert(points[0].time>performanceDomain(365,now,'2026-11-16').start);
 assert.equal(points.at(-1)?.profit,-100);
});
