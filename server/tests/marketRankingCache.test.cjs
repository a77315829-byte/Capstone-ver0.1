const {test}=require('node:test'),assert=require('node:assert/strict');
const {createMarketRankingCache}=require('../src/services/marketRankingCache');
const {periodLeaders,sortMarketLeaders}=require('../src/utils/marketOverview');
const krRow={mksc_shrn_iscd:'005930',hts_kor_isnm:'삼성전자',stck_prpr:'100',acml_vol:'200',acml_tr_pbmn:'20000',prdy_ctrt:'3',prdy_vrss_sign:'2'};
const usRow={symb:'NVDA',last:'156.14',tvol:'300',tamt:'45000',rate:'-4.12',sign:'5'};
function setup(){
 const store=new Map(),calls=[];let time=Date.parse('2026-11-17T07:00:00Z'),mode='live';
 const deps={now:()=>time,load:async key=>structuredClone(store.get(key)||null),save:async(key,value)=>{store.set(key,structuredClone(value))},
  kr:async()=>{calls.push('KR');if(mode==='error')throw Error('offline');return{output:mode==='empty'?[]:[krRow]}},
  us:async(exchange,sort,period)=>{calls.push(`${exchange}:${period}`);if(mode==='error')throw Error('offline');
   return {output2:mode==='empty'?[]:[{...usRow,symb:exchange,...(period==='1'?{tvol:'0',tamt:'0',rate:'0',a_tvol:'500',a_tamt:'25000',n_rate:'-7'}:{})}]};}
 };
 return{deps,store,calls,tick:()=>{time+=21000},mode:v=>{mode=v}};
}
test('empty successful KR response preserves rows and original timestamp, including after restart',async()=>{
 const f=setup(),get=createMarketRankingCache(f.deps),first=await get('KR','volume');
 assert.equal(first.stale,false);assert.equal(f.store.size,1);
 f.mode('empty');f.tick();const closed=await get.refresh('KR','volume');
 assert.equal(closed.data.length,1);assert.equal(closed.asOf,first.asOf);assert.equal(closed.stale,true);
 assert.equal(f.store.get('KR:volume:session').asOf,first.asOf);
 const restarted=await createMarketRankingCache(f.deps).refresh('KR','volume');assert.deepEqual(restarted,closed);
});
test('US closed session keeps last complete daily ranking before trying a different period',async()=>{
 const f=setup(),get=createMarketRankingCache(f.deps);const first=await get('US','volume');
 f.mode('empty');f.tick();const result=await get.refresh('US','volume');
 assert.equal(result.period,'session');assert.equal(result.asOf,first.asOf);assert.equal(result.data.length,3);
 assert(!f.calls.some(x=>x.endsWith(':1')));
});
test('cold start retries a uniform recent period, then automatically returns to current daily rankings',async()=>{
 const f=setup();let open=false;
 f.deps.us=async(exchange,sort,period)=>{f.calls.push(`${exchange}:${period}`);return {output2:period==='0'&&!open?[]:[{...usRow,symb:exchange,a_tvol:exchange==='AMS'?'900':'500'}]}};
 const get=createMarketRankingCache(f.deps),recent=await get('US','volume');
 assert.equal(recent.period,'two-day');assert.match(recent.periodLabel,/2거래일 평균 거래량/);
 assert.equal(recent.data[0].exchange,'AMS');assert.equal(recent.data[0].volume,900);assert.equal(recent.data[0].changeRate,null);
 assert.equal(f.calls.length,6);
 f.tick();await get.refresh('US','volume');assert.equal(f.calls.length,9,'reuse period metrics, still retry today');
 open=true;f.tick();const live=await get.refresh('US','volume');assert.equal(live.period,'session');assert.equal(live.stale,false);assert.equal(live.error,null);
});
test('two-day ranking uses average volume/value and period change, never reset intraday values',()=>{
 const rows=[{...usRow,tvol:'0',tamt:'0',rate:'0',a_tvol:'166911031',a_tamt:'26331186202',n_rate:'-53.33'}];
 assert.equal(periodLeaders(rows,'NAS','volume')[0].volume,166911031);
 assert.equal(periodLeaders(rows,'NAS','turnover')[0].turnover,26331186202);
 assert.equal(periodLeaders(rows,'NAS','losers')[0].changeRate,-53.33);
 assert.equal(sortMarketLeaders(periodLeaders(rows,'NAS','losers'),'losers').length,1);
 assert.deepEqual(periodLeaders([{...usRow,a_tvol:''}],'NAS','volume'),[]);
});
test('partial current exchange result is labeled and never mixed with recent-period rows or persisted over complete data',async()=>{
 const f=setup(),get=createMarketRankingCache(f.deps);const first=await get('US','volume');
 f.deps.us=async exchange=>({output2:exchange==='NAS'?[usRow]:[]});f.tick();
 const partial=await get.refresh('US','volume');assert.equal(partial.period,'session');assert.equal(partial.data.length,1);
 assert.match(partial.error,/NYS, AMS/);assert.deepEqual(f.store.get('US:volume:session').data,first.data);
});
test('failed provider/store does not discard good in-memory data; complete outage without history is visibly unavailable',async()=>{
 const f=setup();f.deps.load=async()=>{throw Error('DB down')};f.deps.save=f.deps.load;
 const get=createMarketRankingCache(f.deps),first=await get('KR','volume');assert.equal(first.data.length,1);
 f.mode('error');f.tick();const last=await get.refresh('KR','volume');assert.equal(last.asOf,first.asOf);assert.equal(last.stale,true);
 const empty=await get('US','turnover');assert.equal(empty.data.length,0);assert.equal(empty.stale,true);assert(empty.error);assert.equal(empty.asOf,null);
});
test('zero-only daily lists trigger recent-period fallback instead of a fake normal zero ranking',async()=>{
 const f=setup();f.deps.us=async(exchange,sort,period)=>({output2:[{...usRow,tvol:'0',tamt:'0',a_tvol:'50'}]});
 const result=await createMarketRankingCache(f.deps)('US','volume');assert.equal(result.period,'two-day');assert.equal(result.data[0].volume,50);
});
test('concurrent refreshes share requests and stale data expires after seven days',async()=>{
 const f=setup(),get=createMarketRankingCache(f.deps);await Promise.all([get('KR','volume'),get('KR','volume')]);assert.equal(f.calls.length,1);
 f.mode('empty');f.deps.now=()=>Date.parse('2026-12-01T00:00:00Z');
 const expired=await createMarketRankingCache(f.deps)('KR','volume');assert.equal(expired.data.length,0);assert.equal(expired.asOf,null);
});
test('stored rankings return immediately during a slow provider refresh, including a cold process',async()=>{
 const f=setup(),get=createMarketRankingCache(f.deps),first=await get('KR','volume');
 let release;f.deps.kr=()=>new Promise(resolve=>{release=resolve});f.tick();
 const immediate=await get('KR','volume');assert.equal(immediate.data.length,1);assert.equal(immediate.stale,true);assert.equal(immediate.asOf,first.asOf);
 const work=get.refresh('KR','volume');await new Promise(setImmediate);release({output:[{...krRow,acml_vol:'500'}]});await work;
 assert.equal((await get('KR','volume')).data[0].volume,500);
 const restarted=createMarketRankingCache(f.deps),loaded=await restarted('KR','volume');
 assert.equal(loaded.data[0].volume,500);assert.equal(loaded.stale,true);
 const restartedWork=restarted.refresh('KR','volume');await new Promise(setImmediate);release({output:[]});await restartedWork;
});
