const {test}=require('node:test'),assert=require('node:assert/strict');
const {getKrxMarketStatus:kr}=require('../src/services/marketSession.service');
const {getUsMarketStatus:us}=require('../src/services/usMarketSession.service');
const {krExtendedQuote,usExtendedQuote,isFreshSessionQuote}=require('../src/utils/extendedQuote');

test('KR aftermarket boundaries, weekend and holiday retain regular-only market orders',()=>{
 for(const [clock,session,allowed] of [['15:30:00','CLOSED',false],['15:59:59','CLOSED',false],['16:00:00','POST',true],['19:59:59','POST',true],['20:00:00','CLOSED',false]]){
  const s=kr(new Date(`2026-11-17T${clock}+09:00`));assert.equal(s.sessionType,session);assert.equal(s.limitOrderAllowed,allowed);assert.equal(s.isOpen,false);
 }
 assert.equal(kr(new Date('2026-11-21T17:00:00+09:00')).limitOrderAllowed,false);
 const prev=process.env.KRX_CLOSED_DATES;process.env.KRX_CLOSED_DATES='2026-11-17:QA';
 try{assert.equal(kr(new Date('2026-11-17T17:00:00+09:00')).limitOrderAllowed,false)}finally{if(prev===undefined)delete process.env.KRX_CLOSED_DATES;else process.env.KRX_CLOSED_DATES=prev}
});
test('US pre/post boundaries respect DST, holidays and early close post-market end',()=>{
 for(const offset of ['-04:00','-05:00'])for(const [clock,type]of [['03:59:59','CLOSED'],['04:00:00','PRE'],['09:29:59','PRE'],['09:30:00','REGULAR'],['16:00:00','POST'],['19:59:59','POST'],['20:00:00','CLOSED']]){
  const s=us(new Date(`${offset==='-04:00'?'2026-07-07':'2026-11-17'}T${clock}${offset}`));assert.equal(s.sessionType,type);assert.equal(s.isOpen,type==='REGULAR');assert.equal(s.limitOrderAllowed,type!=='CLOSED');
 }
 assert.equal(us(new Date('2026-11-21T08:00:00-05:00')).limitOrderAllowed,false);
 const prev=process.env.US_EARLY_CLOSE_DATES;process.env.US_EARLY_CLOSE_DATES='2026-11-27=13:00=Early';
 try{assert.equal(us(new Date('2026-11-27T13:00:00-05:00')).sessionType,'POST');assert.equal(us(new Date('2026-11-27T17:00:00-05:00')).limitOrderAllowed,false)}finally{if(prev===undefined)delete process.env.US_EARLY_CLOSE_DATES;else process.env.US_EARLY_CLOSE_DATES=prev}
 const holiday=process.env.US_CLOSED_DATES;process.env.US_CLOSED_DATES='2026-11-17:QA';
 try{assert.equal(us(new Date('2026-11-17T08:00:00-05:00')).limitOrderAllowed,false)}finally{if(holiday===undefined)delete process.env.US_CLOSED_DATES;else process.env.US_CLOSED_DATES=holiday}
});
test('KR execution requires matching dated current-session bar and actual recent trade',()=>{
 const now=new Date('2026-11-17T16:55:35+09:00'),s=kr(now);
 const trade={stck_cntg_hour:'165530',stck_prpr:'100',cnqn:'2'};
 const bar={stck_bsop_date:'20261117',stck_cntg_hour:'165500',stck_prpr:'100',cntg_vol:'20'};
 assert.equal(krExtendedQuote([trade],[bar],s,now).price,100);
 for(const changes of [{stck_bsop_date:'20261116'},{stck_cntg_hour:'170000'},{cntg_vol:'0'},{stck_cntg_hour:'153000'}])assert.equal(krExtendedQuote([trade],[{...bar,...changes}],s,now),null);
 for(const changes of [{stck_cntg_hour:'165600'},{stck_prpr:'0'},{cnqn:'0'},{stck_cntg_hour:'153000'}])assert.equal(krExtendedQuote([{...trade,...changes}],[bar],s,now),null);
});
test('US dated minute trades exclude stale close, empty bars, future and wrong-session quotes',()=>{
 const now=new Date('2026-11-17T04:10:30-05:00'),s=us(now);
 const row={kymd:'20261117',khms:'181000',last:'25.125',evol:'100'};
 const q=usExtendedQuote([row],s,now);assert.equal(q.price,25.125);assert.equal(q.session,'PRE');
 for(const changes of [{kymd:'20261116'},{khms:'180700'},{khms:'181100'},{evol:'0'},{last:'NaN'},{khms:'060000'}])assert.equal(usExtendedQuote([{...row,...changes}],s,now),null);
 assert.equal(isFreshSessionQuote({...q,session:'POST'},s,now),false);
 const post=new Date('2026-11-18T06:00:30+09:00');
 assert.equal(usExtendedQuote([{...row,kymd:'20261118',khms:'060000'}],us(post),post).session,'POST');
 assert.equal(usExtendedQuote([{...row,kymd:'20261118',khms:'055900'}],us(post),post),null);
});
