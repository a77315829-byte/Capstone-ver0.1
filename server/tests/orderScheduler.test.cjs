const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createOrderScheduler}=require('../src/services/orderScheduler');
const {getKrxMarketStatus}=require('../src/services/marketSession.service');
const {getUsMarketStatus}=require('../src/services/usMarketSession.service');
const empty={marketOpen:true,userCount:0,checkedCount:0,filledCount:0};

test('scheduler starts immediately, repeats without a browser, and ignores duplicate starts',async t=>{
 t.mock.timers.enable({apis:['setInterval']});
 let calls=0;
 const scheduler=createOrderScheduler('unit','QA_SCHEDULER_INTERVAL',async()=>{calls++;return empty});
 try {
  scheduler.start();scheduler.start();await scheduler.run();assert.equal(calls,1);
  t.mock.timers.tick(30000);await scheduler.run();assert.equal(calls,2);
  assert.equal(scheduler.status().running,true);
  await scheduler.stop();t.mock.timers.tick(60000);await scheduler.run();assert.equal(calls,2);
 } finally {await scheduler.stop()}
});

test('slow sweep never overlaps; shutdown waits for it and prevents further ticks',async t=>{
 t.mock.timers.enable({apis:['setInterval']});
 let finish,calls=0;
 const scheduler=createOrderScheduler('unit','QA_SCHEDULER_INTERVAL',()=>{calls++;return new Promise(resolve=>{finish=resolve})});
 scheduler.start();await Promise.resolve();
 t.mock.timers.tick(90000);await Promise.resolve();assert.equal(calls,1);
 let stopped=false;const stopping=scheduler.stop().then(()=>{stopped=true});
 await Promise.resolve();assert.equal(stopped,false);assert.equal(scheduler.status().running,false);
 finish(empty);await stopping;assert.equal(stopped,true);
 t.mock.timers.tick(90000);await scheduler.run();assert.equal(calls,1);
});

test('failed sweep can retry on the next tick and a stopped scheduler can restart',async t=>{
 t.mock.timers.enable({apis:['setInterval']});
 const errors=t.mock.method(console,'error',()=>{});
 let calls=0;
 const scheduler=createOrderScheduler('unit','QA_SCHEDULER_INTERVAL',async()=>{if(++calls===1)throw new Error('test failure');return empty});
 try {
  scheduler.start();await scheduler.run();assert.equal(errors.mock.callCount(),1);
  t.mock.timers.tick(30000);await scheduler.run();assert.equal(calls,2);
  await scheduler.stop();scheduler.start();await scheduler.run();assert.equal(calls,3);
 } finally {await scheduler.stop()}
});

test('interval configuration keeps the 5-second lower bound',async t=>{
 t.mock.timers.enable({apis:['setInterval']});
 const previous=process.env.QA_SCHEDULER_INTERVAL;
 try {for(const [value,expected] of [['100',30000],['invalid',30000],['5000',5000]]){
  process.env.QA_SCHEDULER_INTERVAL=value;
  const scheduler=createOrderScheduler('unit','QA_SCHEDULER_INTERVAL',async()=>empty);
  scheduler.start();assert.equal(scheduler.status().intervalMs,expected);await scheduler.stop();
 }} finally {if(previous===undefined)delete process.env.QA_SCHEDULER_INTERVAL;else process.env.QA_SCHEDULER_INTERVAL=previous}
});

test('KR regular-session boundaries are 09:00 inclusive to 15:30 exclusive in Seoul',()=>{
 for(const [time,open] of [['08:59:59',false],['09:00:00',true],['15:29:59',true],['15:30:00',false],['16:30:00',false]]){
  assert.equal(getKrxMarketStatus(new Date(`2026-11-17T${time}+09:00`)).isOpen,open,time);
 }
 assert.equal(getKrxMarketStatus(new Date('2026-11-21T10:00:00+09:00')).isOpen,false);
});

test('US regular-session boundaries follow New York daylight saving time',()=>{
 for(const [time,open] of [['2026-11-17T14:29:59Z',false],['2026-11-17T14:30:00Z',true],['2026-11-17T20:59:59Z',true],['2026-11-17T21:00:00Z',false],['2026-07-07T13:30:00Z',true],['2026-07-07T20:00:00Z',false]]){
  assert.equal(getUsMarketStatus(new Date(time)).isOpen,open,time);
 }
});
