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
const { convertFx, createFxQuote } = require('../src/services/fx.service');
const { calculateExchange } = require('../src/utils/fx');

const Holding = require('../src/models/usHolding.model').default;
const Order = require('../src/models/usTradeOrder.model').default;
const trades = require('../src/services/usTrading.service');
const requests = require('../src/utils/requests');
const market = require('../src/services/usMarketSession.service');
const ids = [new mongoose.Types.ObjectId().toString(), new mongoose.Types.ObjectId().toString()];
const auth = jwt.sign({ id: ids[0] }, process.env.STOTRA_JWT_SECRET, { expiresIn: '15m', algorithm: 'HS256' });
const round = value => Math.round((value + Number.EPSILON) * 100) / 100;
const checks = [];
const check = name => { checks.push(name); console.log('PASS ' + name); };
const results = {};
async function api(url, body) {
 const response = await fetch('http://127.0.0.1:3010/api/' + url, {method:body === undefined ? 'GET':'POST',
  headers:{'content-type':'application/json',authorization:'Bearer '+auth},
  ...(body === undefined ? {}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(30000)});
 const data=await response.json();
 assert.ok(response.ok, url + ': ' + response.status + ' ' + (data.message || 'request failed'));
 return data.data ?? data;
}
async function fx(direction, amount) {
 const quote=await api('fx/quote',{direction,amount});
 const converted=await api('fx/convert',{quoteId:quote.quoteId});
 return {...converted,quote};
}
async function controlledPrices() {
 const userId=ids[1];
 await US.create({userId,cash:1000,totalDeposits:1000});
 let price=10.01;
 const oldQuote=requests.fetchUsStockData, oldStatus=market.getUsMarketStatus;
 requests.fetchUsStockData=async () => ({symbol:'SOXL',name:'test',exchange:'AMS',price,changeRate:0});
 market.getUsMarketStatus=() => ({isOpen:true,orderAllowedByOverride:false});
 const trade=(side,quantity) => trades.createUsTradeOrder({userId,symbol:'SOXL',exchange:'AMS',side,orderType:'MARKET',quantity});
 try {
  await trade('BUY',2); price=10.02; await trade('BUY',1);
  let p=await trades.getUsPortfolio(userId,{evaluate:true});
  assert.equal(p.holdings[0].quantity,3);
  assert.equal(p.holdings[0].buyAmount,30.04,'weighted purchase cost must preserve every cent');
  assert.equal(p.holdings[0].profitLoss,0.02);
  assert.equal(p.holdings[0].profitLossRate,round(0.02/30.04*100));
  check('different-price buys preserve cost and weighted unrealized return');
  price=11; const sell1=await trade('SELL',1);
  assert.equal(sell1.realizedProfit,0.99);
  p=await trades.getUsPortfolio(userId,{evaluate:true});
  assert.equal(p.holdings[0].quantity,2); assert.equal(p.holdings[0].buyAmount,20.03);
  assert.equal(p.holdings[0].profitLoss,1.97); assert.equal(p.holdings[0].profitLossRate,round(1.97/20.03*100));
  assert.equal(p.account.totalProfitLoss,2.96);
  check('partial sale splits exact cost and separates realized/unrealized gains');
  price=9; const sell2=await trade('SELL',2);
  assert.equal(sell2.realizedProfit,-2.03);
  p=await trades.getUsPortfolio(userId,{evaluate:true});
  assert.equal(p.holdings.length,0); assert.equal(p.account.cash,998.96);
  assert.equal(p.account.totalProfitLoss,-1.04); assert.equal(p.account.totalProfitLossRate,round(-1.04/1000*100));
  assert.equal(round(sell1.realizedProfit+sell2.realizedProfit),-1.04);
  check('full sale clears holding and reconciles realized loss to cash and account return');
  const back = await createFxQuote(userId,'USD_TO_KRW',p.account.cash);
  await convertFx(userId,back.quoteId);
  p = await trades.getUsPortfolio(userId,{evaluate:true});
  assert.equal(p.account.cash,0); assert.equal(p.account.totalProfitLoss,-1.04);
  assert.equal(p.account.totalProfitLossRate,round(-1.04/1000*100));
  check('withdrawal of all USD preserves historical trading P/L and return');
 } finally { requests.fetchUsStockData=oldQuote; market.getUsMarketStatus=oldStatus; }
}
async function liveRoundtrip() {
 await api('trading/top-up',{});
 assert.equal((await api('fx/wallet')).KRW.cash,1000000);
 const inbound=await fx('KRW_TO_USD',500000); const dollars=inbound.wallet.USD.cash;
 assert.equal(inbound.wallet.KRW.cash,500000); assert.equal(dollars,inbound.quote.targetAmount);
 results.startKrw=1000000; results.convertedKrw=500000; results.receivedUsd=dollars; results.rateIn=inbound.quote.rate;
 check('live HTTP: KRW funding -> FX -> spendable USD');
 const order=async (side,quantity,extra={}) => api('us-trading/orders',{symbol:'SOXL',exchange:'AMS',side,orderType:'MARKET',quantity,...extra});
 const buy=await order('BUY',3); assert.equal(buy.status,'FILLED');
 const buyCost=round(buy.executedPrice*3);
 let portfolio=await api('us-trading/portfolio?evaluate=true');
 assert.equal(portfolio.holdings.length,1); let h=portfolio.holdings[0];
 assert.equal(h.quantity,3); assert.equal(h.buyAmount,buyCost); assert.equal(h.avgPrice,buy.executedPrice);
 assert.equal(portfolio.account.cash,round(dollars-buyCost));
 assert.equal(h.evaluationAmount,round(h.currentPrice*3));
 assert.equal(h.profitLoss,round(h.evaluationAmount-buyCost));
 assert.equal(h.profitLossRate,round(h.profitLoss/buyCost*100));
 assert.equal(portfolio.account.totalProfitLoss,round(portfolio.account.cash+h.evaluationAmount-dollars));
 results.buyPrice=buy.executedPrice;results.buyCostUsd=buyCost;
 check('live HTTP: purchased with exchanged dollars / quantity / average / current valuation / return');
 const pending=await order('BUY',1,{orderType:'LIMIT',limitPrice:0.01}); assert.equal(pending.status,'PENDING');
 let wallet=await api('fx/wallet'); assert.equal(wallet.USD.reservedCash,0.01);
 assert.equal(wallet.USD.availableCash,round(wallet.USD.cash-0.01));
 const cancelled=await api(`us-trading/orders/${pending._id || pending.id}/cancel`,{}); assert.equal(cancelled.status,'CANCELED');
 assert.equal((await api('fx/wallet')).USD.reservedCash,0);
 check('live HTTP: limit order reservation and cancellation update spendable cash');
 const sell1=await order('SELL',1); assert.equal(sell1.status,'FILLED');
 assert.equal(sell1.realizedProfit,round(sell1.executedPrice-buy.executedPrice));
 portfolio=await api('us-trading/portfolio?evaluate=true'); h=portfolio.holdings[0];
 assert.equal(h.quantity,2); assert.equal(h.buyAmount,round(buy.executedPrice*2));
 assert.equal(portfolio.account.cash,round(dollars-buyCost+sell1.executedPrice));
 assert.equal(h.profitLoss,round(h.currentPrice*2-h.buyAmount));
 assert.equal(h.profitLossRate,round(h.profitLoss/h.buyAmount*100));
 check('live HTTP: partial sale updates cash / remaining position / realized and unrealized return');
 const sell2=await order('SELL',2); assert.equal(sell2.status,'FILLED');
 const proceeds=round(sell1.executedPrice+round(sell2.executedPrice*2));
 const pnl=round(proceeds-buyCost);
 portfolio=await api('us-trading/portfolio?evaluate=true');
 assert.equal(portfolio.holdings.length,0); assert.equal(portfolio.account.cash,round(dollars+pnl));
 assert.equal(portfolio.account.totalProfitLoss,pnl); assert.equal(portfolio.account.totalProfitLossRate,round(pnl/dollars*100));
 assert.equal(round(sell1.realizedProfit+sell2.realizedProfit),pnl);
 results.sellPrices=[sell1.executedPrice,sell2.executedPrice];results.realizedPnlUsd=pnl;results.usReturnBeforeFx=portfolio.account.totalProfitLossRate;
 check('live HTTP: complete sale clears holding / proceeds / realized profit / account return');
 const beforeFx=portfolio.account.cash;
 const outbound=await fx('USD_TO_KRW',beforeFx);
 assert.equal(outbound.wallet.USD.cash,0); assert.equal(outbound.wallet.USD.availableCash,0);
 assert.equal(outbound.wallet.KRW.cash,500000+outbound.quote.targetAmount);
 assert.equal(outbound.wallet.KRW.availableCash,outbound.wallet.KRW.cash);
 const afterFx = await api('us-trading/portfolio?evaluate=true');
 assert.equal(afterFx.holdings.length,0);
 assert.equal(afterFx.account.totalProfitLoss,pnl);
 assert.equal(afterFx.account.totalProfitLossRate,round(pnl/dollars*100));
 const history=await api('us-trading/orders?limit=50');
 assert.equal(history.filter(o=>o.status==='FILLED').length,3);
 assert.equal(round(history.filter(o=>o.side==='SELL').reduce((sum,o)=>sum+o.realizedProfit,0)),pnl);
 assert.equal((await api('fx/history')).length,2);
 results.convertedBackUsd=beforeFx;results.receivedKrw=outbound.quote.targetAmount;results.rateOut=outbound.quote.rate;results.finalKrw=outbound.wallet.KRW.cash;
 check('live HTTP: sell proceeds -> KRW / zero USD and holdings / persisted trade and FX history');
}
(async()=>{
 await mongoose.connect(mongoUri(),{dbName:process.env.MONGO_DB_NAME,serverSelectionTimeoutMS:10000});
 try {
  if(!process.argv.includes('--live-only')) await controlledPrices();
  if(!process.argv.includes('--controlled-only')) await liveRoundtrip();
  fs.writeFileSync(path.resolve(__dirname,'../../.qa/fx-trade-roundtrip-results.json'),JSON.stringify({passed:checks.length,checks,results},null,2));
  console.log(JSON.stringify({passed:checks.length,results}));
 } finally {
  for(const model of [Order,Holding,FxConversion,FxQuote,Funding,KR,US]) await model.deleteMany({userId:{$in:ids}});
  console.log('Only temporary test records removed. Existing user balances and holdings untouched.');
  await mongoose.disconnect();
 }
})().catch(error=>{console.error(JSON.stringify({name:error.name,message:error.message}));process.exitCode=1;});
