// Test child only. Never loaded by npm start. A dedicated disposable DB is mandatory.
const assert=require('node:assert/strict');
assert.match(process.env.MONGO_DB_NAME || '', /^qa_scheduler_[a-f0-9]{16}$/);
assert.equal(process.env.QA_SCHEDULER_PROCESS,'yes');
const kr=require('../dist/services/marketSession.service');
const us=require('../dist/services/usMarketSession.service');
const quotes=require('../dist/utils/requests');
const krStatus=kr.getKrxMarketStatus,usStatus=us.getUsMarketStatus;
const originalKrQuote=quotes.fetchStockData,originalKrExtended=quotes.fetchKrxExtendedQuote;
const ext=require('../dist/utils/extendedQuote'),originalFresh=ext.isFreshSessionQuote;
const state={krTime:'2026-11-17T08:59:00+09:00',usTime:'2026-11-17T03:59:00-05:00',krPrice:100,usPrice:10,failQuotes:false,extendedAvailable:false,stale:false,wrongSession:false,liveKr:false,usReplay:false};
kr.getKrxMarketStatus=()=>krStatus(state.liveKr?new Date():new Date(state.krTime));
us.getUsMarketStatus=()=>usStatus(new Date(state.usTime));
quotes.fetchStockData=async symbol=>{assert.equal(symbol,'005930');if(state.liveKr)return originalKrQuote(symbol);if(state.failQuotes)throw new Error('QA quote outage');return {symbol,name:'QA',market:'KOSPI',price:state.krPrice}};
quotes.fetchUsStockData=async(symbol,exchange)=>{assert(['SOXL','NVDA'].includes(symbol));if(state.failQuotes)throw new Error('QA quote outage');return {symbol,name:'QA',exchange,price:state.usPrice}};
function fakeExtended(market){if(!state.extendedAvailable)return null;const isKr=market==='KR',now=new Date(isKr?state.krTime:state.usTime),s=isKr?krStatus(now):usStatus(now);return {price:isKr?state.krPrice:state.usPrice,observedAt:new Date(now.getTime()-(state.stale?181000:1000)).toISOString(),source:'QA',session:state.wrongSession?'REGULAR':s.sessionType}}
quotes.fetchKrxExtendedQuote=async symbol=>state.liveKr?originalKrExtended(symbol):fakeExtended('KR');
quotes.fetchUsExtendedQuote=async(symbol,exchange)=>{
 if(state.usReplay){assert.equal(symbol,'NVDA');assert.equal(exchange,'NAS');const capture=require('./fixtures/extended-us-quotes.json').find(r=>r.session===state.usReplay);return ext.usExtendedQuote(capture.rows,us.getUsMarketStatus(),new Date(state.usTime))}
 return fakeExtended('US');
};
ext.isFreshSessionQuote=(quote,status,now)=>originalFresh(quote,status,status.timezone==='Asia/Seoul'&&state.liveKr?now:new Date(status.timezone==='Asia/Seoul'?state.krTime:state.usTime));
quotes.fetchUsdKrwQuotation=async()=>({rate:1300,date:new Date().toISOString().slice(0,10)});
process.on('message',message=>{
 if(message.command==='configure'){Object.assign(state,message.state);process.send({requestId:message.requestId,ok:true})}
 if(message.command==='shutdown')process.emit('SIGTERM');
});
