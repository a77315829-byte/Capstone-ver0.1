// Temporary KRW mock accounts only. Controlled execution never changes the running server's market hours.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),dotenv=require('dotenv');
const inherited={...process.env};
for(const file of ['../.env','../../.env.exhibition'])for(const [key,value]of Object.entries(dotenv.parse(fs.readFileSync(path.resolve(__dirname,file)))))if(value!==''&&inherited[key]===undefined)process.env[key]=value;
require('../src/utils/runtime');
const mongoose=require('mongoose'),jwt=require('jsonwebtoken');
const {mongoUri}=require('../src/utils/db');
const Account=require('../src/models/tradingAccount.model').default;
const Holding=require('../src/models/holding.model').default;
const Order=require('../src/models/tradeOrder.model').default;
const Funding=require('../src/models/fundingTransaction.model').default;
const trades=require('../src/services/trading.service');
const requests=require('../src/utils/requests');
const market=require('../src/services/marketSession.service');
const ids=[new mongoose.Types.ObjectId().toString(),new mongoose.Types.ObjectId().toString()];
const auth=jwt.sign({id:ids[0]},process.env.STOTRA_JWT_SECRET,{expiresIn:'15m',algorithm:'HS256'});
const checks=[];const check=n=>{checks.push(n);console.log('PASS '+n);};
async function api(url,body){const response=await fetch('http://127.0.0.1:3010/api/'+url,{method:body===undefined?'GET':'POST',headers:{'content-type':'application/json',authorization:'Bearer '+auth},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(30000)});return {status:response.status,body:await response.json()};}
(async()=>{
 await mongoose.connect(mongoUri(),{dbName:process.env.MONGO_DB_NAME,serverSelectionTimeoutMS:10000});
 try{
  assert.equal((await api('trading/top-up',{})).status,200);
  const pending=await api('trading/orders',{symbol:'005930',side:'BUY',orderType:'LIMIT',quantity:1,limitPrice:1});
  assert.equal(pending.status,201);assert.equal(pending.body.data.status,'PENDING');
  const wallet=await api('fx/wallet');assert.equal(wallet.body.KRW.reservedCash,1);assert.equal(wallet.body.KRW.availableCash,999999);
  const orderId=pending.body.data._id||pending.body.data.id;
  assert.equal((await api('trading/orders/'+orderId+'/cancel',{})).status,200);
  assert.equal((await api('fx/wallet')).body.KRW.reservedCash,0);
  check('KR live HTTP limit order reserves KRW and cancellation releases it');
  if(!market.getKrxMarketStatus().isOpen){assert.equal((await api('trading/orders',{symbol:'005930',side:'BUY',orderType:'MARKET',quantity:1})).status,409);check('KR live HTTP correctly blocks market orders while market is closed');}
  const userId=ids[1];await Account.create({userId,cash:1000000,totalDeposits:1000000});
  let price=100000;const oldQuote=requests.fetchStockData,oldStatus=market.getKrxMarketStatus;
  requests.fetchStockData=async()=>({symbol:'005930',name:'temporary test',market:'KOSPI',price,changeRate:0});
  market.getKrxMarketStatus=()=>({isOpen:true,orderAllowedByOverride:false});
  const trade=(side,quantity)=>trades.createTradeOrder({userId,symbol:'005930',side,quantity,orderType:'MARKET'});
  try{
   await trade('BUY',2);price=100003;await trade('BUY',1);
   let p=await trades.getPortfolio(userId,{evaluate:true});
   assert.equal(p.holdings[0].quantity,3);assert.equal(p.holdings[0].avgPrice,100001);assert.equal(p.holdings[0].buyAmount,300003);assert.equal(p.account.cash,699997);assert.equal(p.holdings[0].profitLoss,6);
   assert.equal(p.holdings[0].profitLossRate,6/300003*100);check('KR controlled multi-price buys reconcile cash, weighted cost, holdings and return');
   price=110000;const sale=await trade('SELL',1);assert.equal(sale.realizedProfit,9999);
   p=await trades.getPortfolio(userId,{evaluate:true});assert.equal(p.holdings[0].quantity,2);assert.equal(p.holdings[0].buyAmount,200002);assert.equal(p.account.cash,809997);assert.equal(p.holdings[0].profitLoss,19998);
   check('KR controlled partial sell reconciles cash, realized gain and remaining unrealized gain');
   price=90000;const last=await trade('SELL',2);assert.equal(last.realizedProfit,-20002);
   p=await trades.getPortfolio(userId,{evaluate:true});assert.equal(p.holdings.length,0);assert.equal(p.account.cash,989997);assert.equal(p.account.adjustedProfit,-10003);assert.equal(p.account.adjustedReturnRate,-10003/1000000*100);
   assert.equal(sale.realizedProfit+last.realizedProfit,-10003);
   assert.equal(p.account.totalProfitLoss,-10003);assert.equal(p.account.totalProfitLossRate,-10003/1000000*100);
   check('KR controlled full sell clears holdings and retains total realized loss in MyPage fields');
   const extra=[];
   for(let i=0;i<60;i++)for(const side of ['BUY','SELL'])extra.push({userId,symbol:'005930',name:'temporary history fixture',market:'KRX',side,orderType:'MARKET',status:'FILLED',quantity:1,filledQuantity:1,orderPrice:side==='BUY'?100:99,executedPrice:side==='BUY'?100:99,realizedProfit:side==='SELL'?-1:0,executedAt:new Date()});
   await Order.insertMany(extra);await Account.updateOne({userId},{$inc:{cash:-60}});
   p=await trades.getPortfolio(userId,{evaluate:true,performance:true});
   assert.equal(p.performance.filledTradeCount,124);assert.equal(p.performance.realizedProfit,-10063);
   assert.equal(p.performance.history.reduce((sum,day)=>sum+day.profit,0),-10063);
   assert.equal(p.account.totalProfitLoss,-10063);assert(p.performance.payoffRatio>0);
   const historicalToken=jwt.sign({id:userId},process.env.STOTRA_JWT_SECRET,{expiresIn:'5m',algorithm:'HS256'});
   const persisted=await fetch('http://127.0.0.1:3010/api/trading/portfolio?evaluate=true&performance=true',{headers:{authorization:'Bearer '+historicalToken}});
   assert.equal(persisted.status,200);const restored=(await persisted.json()).data;
   assert.equal(restored.performance.filledTradeCount,124);assert.equal(restored.account.totalProfitLoss,-10063);
   check('Full history beyond 50 orders and loss restore from DB in the independent running server');
  }finally{requests.fetchStockData=oldQuote;market.getKrxMarketStatus=oldStatus;}
  fs.writeFileSync(path.resolve(__dirname,'../../.qa/pre-school-kr-trade-results.json'),JSON.stringify({passed:checks.length,checks},null,2));
 }finally{for(const model of [Order,Holding,Funding,Account])await model.deleteMany({userId:{$in:ids}});await mongoose.disconnect();console.log('Only temporary KR account records removed.');}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
