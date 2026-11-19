import test from 'node:test';
import assert from 'node:assert/strict';
import { valueHolding, summarizeHoldings, tradingUpdate } from '../src/utils/holdingValuation.ts';
import { readHoldingWallet } from '../src/utils/holdingWallet.ts';
const position = {symbol:'SOXL',name:'SOXL',market:'AMEX',exchange:'AMS',quantity:3,avgPrice:40.05};
test('wallet distinguishes total cash and reserved cash; missing response is never zero balance',()=>{
 const wallet={KRW:{cash:1000000,reservedCash:200000,availableCash:800000},USD:{cash:100.25,reservedCash:10.01,availableCash:90.24}};
 assert.deepEqual(readHoldingWallet(wallet),wallet);
 for(const value of [null,{}, {...wallet,USD:{cash:100}}, {...wallet,USD:{cash:NaN,reservedCash:0,availableCash:0}}]) assert.equal(readHoldingWallet(value),null);
});
test('holding cost from server overrides rounded average price after partial sales',()=>{
 const h=valueHolding({...position,quantity:2,avgPrice:10.02,buyAmount:20.03},{price:11});
 assert.equal(h.profitLoss,1.97); assert.equal(h.profitLossRate,1.97/20.03*100);
});
test('holdings preserve USD cents, weighted total returns, and gains/losses', () => {
 const gain=valueHolding(position,{price:42.1,name:'디렉시온 미국 반도체 3배 ETF'});
 const loss=valueHolding({...position,symbol:'OTHER',quantity:1,avgPrice:100},{price:90});
 assert.equal(gain.evaluationAmount,126.3); assert.equal(gain.profitLoss,6.15);
 assert.equal(gain.name,'디렉시온 미국 반도체 3배 ETF'); assert.equal(loss.profitLoss,-10);
 const total=summarizeHoldings([gain,loss]);
 assert.equal(total.buyAmount,220.15); assert.equal(total.profitLoss,-3.85);
 assert.equal(total.profitLossRate,-3.85/220.15*100);
});
test('missing quotes never reuse purchase prices or report a fabricated zero return',()=>{
 for(const price of [undefined,0,-1,NaN,Infinity]) {
  const holding=valueHolding(position,{price});
  assert.equal(holding.currentPrice,null); assert.equal(holding.profitLoss,null);
  assert.equal(summarizeHoldings([holding]).evaluationAmount,null);
 }
 assert.equal(summarizeHoldings([]).profitLoss,0);
});
test('KR values use the holding cost and zero cost never produces an infinite return',()=>{
 const holding=valueHolding({...position,symbol:'005930',market:'KOSPI',quantity:2,avgPrice:50000},{price:55000});
 assert.equal(holding.profitLoss,10000); assert.equal(holding.profitLossRate,10);
 assert.equal(valueHolding({...position,avgPrice:0},{price:10}).profitLossRate,null);
});
test('successful trade mutations refresh the matching market; reads never reopen the panel',()=>{
 assert.deepEqual(tradingUpdate('post','/us-trading/orders'),{market:'US',openPanel:true});
 assert.deepEqual(tradingUpdate('post','/trading/orders/abc/cancel'),{market:'KR',openPanel:false});
 assert.deepEqual(tradingUpdate('post','/us-trading/orders/check-pending'),{market:'US',openPanel:false});
 assert.deepEqual(tradingUpdate('post','/stocks/005930/buy'),{market:'KR',openPanel:true});
 assert.equal(tradingUpdate('get','/us-trading/portfolio?evaluate=false'),null);
 assert.equal(tradingUpdate('post','/auth/login'),null);
});
