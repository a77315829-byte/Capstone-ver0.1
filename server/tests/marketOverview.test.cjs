const test = require('node:test');
const assert = require('node:assert/strict');
const { volumeLeaders, sortVolumeLeaders, sortMarketLeaders, isRankingSort, marketNumber, signedMarketNumber } = require('../src/utils/marketOverview');
const { holdingCost, splitHoldingCost } = require('../src/utils/usCostBasis');
test('volume rankings preserve Korean names, signed changes, and large accumulated volumes', () => {
 const kr=volumeLeaders([{mksc_shrn_iscd:'005930',hts_kor_isnm:'삼성전자',stck_prpr:'70,000',prdy_vrss_sign:'5',prdy_ctrt:'2.5',acml_vol:'10228602438'}]);
 assert.equal(kr[0].changeRate,-2.5); assert.equal(kr[0].volume,10228602438); assert.equal(kr[0].price,70000);
 const us=volumeLeaders([{symb:'SOXL',name:'English',last:'50.1234',tvol:'123456',sign:'2',rate:'+3.4'}],'AMS');
 assert.equal(us[0].name,'디렉시온 미국 반도체 3배 ETF'); assert.equal(us[0].exchange,'AMS'); assert.equal(us[0].price,50.1234);
});
test('merge exchanges by volume, keep identities, and reject invalid rows', () => {
 const row=(symbol,volume,exchange)=>({symbol,name:symbol,market:'NASDAQ',exchange,volume,price:1,changeRate:0,turnover:null});
 const sorted=sortVolumeLeaders([row('A',5,'NAS'),row('B',30,'AMS'),row('C',20,'NYS'),row('A',5,'NAS')],2);
 assert.deepEqual(sorted.map(x=>x.symbol),['B','C']);
 assert.deepEqual(volumeLeaders([{symb:'bad symbol',last:10,tvol:12},{symb:'A',last:0,tvol:3},{symb:'B',last:2,tvol:''}],'NAS'),[]);
 assert.equal(marketNumber(''),null); assert.equal(marketNumber('bad'),null); assert.equal(signedMarketNumber('3','5'),-3);
});
test('partial sales allocate every purchase cent; last sale receives remaining basis', () => {
 const cost=holdingCost({quantity:3,avgPrice:10.01,totalBuyAmount:30.04}); assert.equal(cost,30.04);
 const first=splitHoldingCost(cost,3,1); assert.deepEqual(first,{soldCost:10.01,remainingCost:20.03});
 const final=splitHoldingCost(first.remainingCost,2,2); assert.deepEqual(final,{soldCost:20.03,remainingCost:0});
 assert.equal(first.soldCost+final.soldCost,30.04);
 assert.equal(holdingCost({quantity:3,avgPrice:10.01}),30.03);
});

test('new Korean mixed-letter ETF codes and prefixed ETNs stay in ranking',()=>{
 const rows=volumeLeaders([{mksc_shrn_iscd:'0193T0',stck_prpr:'3845',acml_vol:'100'}, {mksc_shrn_iscd:'Q530107',stck_prpr:'2495',acml_vol:'90'}]);
 assert.deepEqual(rows.map(x=>x.symbol),['0193T0','530107']);
 const {normalizeStockSymbol}=require('../src/utils/requests');
 assert.equal(normalizeStockSymbol('0193T0'),'0193T0'); assert.equal(normalizeStockSymbol('Q530107'),'530107');
});

test('turnover and directional rankings use their own numeric metrics and exclude missing or wrong-direction values',()=>{
 const row=(symbol,volume,turnover,changeRate,exchange='NAS')=>({symbol,name:symbol,market:'NASDAQ',exchange,volume,price:1,changeRate,turnover});
 const rows=[row('VOLUME',900,20,2),row('VALUE',10,900,0),row('UP',20,50,15),row('DOWN',30,30,-25),row('DOWN2',40,40,-5),row('MISSING',1000,null,null)];
 assert.deepEqual(sortMarketLeaders(rows,'turnover').map(r=>r.symbol),['VALUE','UP','DOWN2','DOWN','VOLUME']);
 assert.deepEqual(sortMarketLeaders(rows,'gainers').map(r=>r.symbol),['UP','VOLUME']);
 assert.deepEqual(sortMarketLeaders(rows,'losers').map(r=>r.symbol),['DOWN','DOWN2']);
 assert.deepEqual(sortMarketLeaders(rows,'volume',2).map(r=>r.symbol),['MISSING','VOLUME']);
 assert.equal(rows[0].symbol,'VOLUME');
});

test('fluctuation responses use their own Korean symbol field and do not invent turnover',()=>{
 const [kr]=volumeLeaders([{stck_shrn_iscd:'0193T0',hts_kor_isnm:'ETF',stck_prpr:'3845',acml_vol:'100',prdy_ctrt:'15.12',prdy_vrss_sign:'5'}]);
 assert.equal(kr.symbol,'0193T0'); assert.equal(kr.changeRate,-15.12);assert.equal(kr.turnover,null);
 const [us]=volumeLeaders([{symb:'NVDA',last:'155.99',tvol:'166051333',tamt:'26311967514',rate:'-4.21',sign:'5'}],'NAS');
 assert.equal(us.turnover,26311967514);
 assert.equal(isRankingSort('turnover'),true);assert.equal(isRankingSort('losers'),true);
 for(const value of ['random','__proto__','toString','',null,['volume']]) assert.equal(isRankingSort(value),false);
});
