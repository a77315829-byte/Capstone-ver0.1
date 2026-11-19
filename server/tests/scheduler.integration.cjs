// Opt-in built-server integration. No live account or live market settings are changed.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const crypto=require('node:crypto'),net=require('node:net'),{fork}=require('node:child_process');
const dotenv=require('dotenv'),mongoose=require('mongoose'),jwt=require('jsonwebtoken');
const root=path.resolve(__dirname,'../..'),env={...process.env};
for(const file of ['server/.env','.env.exhibition'])for(const [k,v] of Object.entries(dotenv.parse(fs.readFileSync(path.join(root,file)))))if(v!==''&&process.env[k]===undefined)env[k]=v;
const uri=env.MONGODB_URI||`mongodb+srv://${encodeURIComponent(env.STOTRA_MONGODB_USERNAME)}:${encodeURIComponent(env.STOTRA_MONGODB_PASSWORD)}@${env.STOTRA_MONGODB_CLUSTER}/?retryWrites=true&w=majority`;
const runId=crypto.randomBytes(8).toString('hex'),dbName='qa_scheduler_'+runId;
const userId=new mongoose.Types.ObjectId().toString(),secret=crypto.randomBytes(32).toString('hex');
const auth=jwt.sign({id:userId},secret,{algorithm:'HS256',expiresIn:'20m'});
const checks=[];let child,origin,owned=false,log='';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,label,timeout=18000){const deadline=Date.now()+timeout;while(Date.now()<deadline){if(await fn())return;await sleep(150)}throw new Error('Timed out: '+label)}
function pass(name){checks.push(name);console.log('PASS '+name)}
async function api(route,body){const response=await fetch(origin+'/api/'+route,{method:body===undefined?'GET':'POST',headers:{authorization:'Bearer '+auth,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(12000)});const result=await response.json();assert(response.ok,route+': '+JSON.stringify(result));return result.data??result}
function configure(state){return new Promise((resolve,reject)=>{const requestId=crypto.randomBytes(5).toString('hex');const timer=setTimeout(()=>{child.off('message',receive);reject(new Error('child control timeout'))},5000);function receive(message){if(message.requestId===requestId){clearTimeout(timer);child.off('message',receive);resolve()}}child.on('message',receive);child.send({command:'configure',requestId,state})})}
async function stopChild(){if(!child||child.exitCode!==null)return;const ended=new Promise(resolve=>child.once('exit',resolve));child.send({command:'shutdown'});await Promise.race([ended,sleep(12000)]);if(child.exitCode===null){child.kill();await ended}}
(async()=>{
 try {
  assert.match(dbName,/^qa_scheduler_[a-f0-9]{16}$/);
  await mongoose.connect(uri,{dbName,serverSelectionTimeoutMS:10000});
  const db=mongoose.connection.db;
  assert.equal((await db.listCollections().toArray()).length,0,'Do not reuse any existing database');
  await db.collection('qa_owner').insertOne({runId});owned=true;
  const models={
   KR:{Account:require('../dist/models/tradingAccount.model').default,Order:require('../dist/models/tradeOrder.model').default,Holding:require('../dist/models/holding.model').default,path:'trading',symbol:'005930',price:100,limit:105,cash:10000},
   US:{Account:require('../dist/models/usTradingAccount.model').default,Order:require('../dist/models/usTradeOrder.model').default,Holding:require('../dist/models/usHolding.model').default,path:'us-trading',symbol:'SOXL',price:10,limit:10.5,cash:1000,exchange:'AMS'}
  };
  for(const m of Object.values(models))await m.Account.create({userId,cash:m.cash,totalDeposits:m.cash});
  const port=await new Promise(resolve=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p))})});
  origin='http://127.0.0.1:'+port;
  child=fork(path.join(root,'server/dist/index.js'),[],{cwd:path.join(root,'server'),execArgv:['-r',path.join(__dirname,'scheduler.preload.cjs')],env:{...env,MONGODB_URI:uri,MONGO_DB_NAME:dbName,QA_SCHEDULER_PROCESS:'yes',STOTRA_JWT_SECRET:secret,AUTH_CAPTCHA_MODE:'disabled',HOST:'127.0.0.1',NETWORK_ACCESS:'local',PORT:String(port),PENDING_ORDER_CHECK_INTERVAL_MS:'5000',US_PENDING_ORDER_CHECK_INTERVAL_MS:'5000',ALLOW_CLOSED_MARKET_ORDERS:'false',ALLOW_CLOSED_US_MARKET_ORDERS:'false',KRX_CLOSED_DATES:'',US_CLOSED_DATES:'',US_EARLY_CLOSE_DATES:''},stdio:['ignore','pipe','pipe','ipc']});
  child.stdout.on('data',x=>{log+=x});child.stderr.on('data',x=>{log+=x});
  await until(async()=>{try{return (await fetch(origin+'/api/health')).ok}catch{return false}},'server startup',45000);
  const health=await api('health');assert.equal(health.orderSchedulers.KR.running,true);assert.equal(health.orderSchedulers.US.running,true);
  pass('Built server starts both schedulers after DB connection');
  const submit=(m,side,limit,quantity=1)=>api(m.path+'/orders',{symbol:m.symbol,exchange:m.exchange,side,orderType:'LIMIT',quantity,limitPrice:limit});
  const pending={};
  for(const [name,m] of Object.entries(models)){pending[name]=await submit(m,'BUY',m.limit,2);assert.equal(pending[name].status,'PENDING')}
  await sleep(5500);
  for(const [name,m] of Object.entries(models)){assert.equal((await m.Order.findById(pending[name]._id)).status,'PENDING');assert.equal(await m.Holding.countDocuments({userId}),0)}
  pass('KR/US marketable limits stay pending before opening');
  await configure({krTime:'2026-11-17T09:00:00+09:00',usTime:'2026-11-17T09:30:00-05:00'});
  await until(async()=>{for(const [name,m] of Object.entries(models))if((await m.Order.findById(pending[name]._id)).status!=='FILLED')return false;return true},'automatic buy fills');
  for(const m of Object.values(models)){const a=await m.Account.findOne({userId}),h=await m.Holding.findOne({userId});assert.equal(a.cash,m.cash-m.price*2);assert.equal(a.reservedCash,0);assert.equal(h.quantity,2)}
  pass('Next timer tick fills both markets after opening; cash, reservations and holdings match');
  const waiting={};
  for(const [name,m] of Object.entries(models)){waiting[name]=await submit(m,'BUY',m.price*.9);assert.equal(waiting[name].status,'PENDING')}
  await sleep(5500);
  for(const [name,m] of Object.entries(models))assert.equal((await m.Order.findById(waiting[name]._id)).status,'PENDING');
  await configure({krPrice:90,usPrice:9,failQuotes:true});await sleep(5500);
  for(const [name,m] of Object.entries(models))assert.equal((await m.Order.findById(waiting[name]._id)).status,'PENDING');
  await configure({failQuotes:false});
  await until(async()=>{for(const [name,m] of Object.entries(models))if((await m.Order.findById(waiting[name]._id)).status!=='FILLED')return false;return true},'condition met after quote recovery');
  pass('Unmet limits stay pending; quote outage cannot fill, and recovery retries automatically');
  const sells={};
  for(const [name,m] of Object.entries(models)){sells[name]=await submit(m,'SELL',Math.round(m.price*1.1*100)/100);assert.equal(sells[name].status,'PENDING')}
  await configure({krPrice:110,usPrice:11});
  await until(async()=>{for(const [name,m] of Object.entries(models))if((await m.Order.findById(sells[name]._id)).status!=='FILLED')return false;return true},'automatic sells');
  const balances={};
  for(const [name,m] of Object.entries(models)){const h=await m.Holding.findOne({userId});assert.equal(h.quantity,2);assert.equal(h.reservedQuantity,0);const a=await m.Account.findOne({userId});assert.equal(a.cash,Math.round((m.cash-m.price*2-m.price*.9+m.price*1.1)*100)/100);balances[name]=a.cash}
  await sleep(5500);
  for(const [name,m] of Object.entries(models)){assert.equal((await m.Account.findOne({userId})).cash,balances[name]);assert.equal(await m.Order.countDocuments({userId,status:'FILLED'}),3)}
  pass('Sell limits fill at equality; later timer ticks do not duplicate fills');
  const combined=await api('trading/performance');
  assert.equal(combined.warning,null);assert(combined.combined);
  assert.equal(combined.combined.filledTradeCount,6);assert.equal(combined.combined.holdingCount,2);
  assert.equal(combined.combined.totalAsset,10040+1004*1300);
  assert.equal(combined.combined.totalProfitLoss,40+4*1300);
  assert.equal(combined.combined.investedCapital,10000+1000*1300);
  assert.equal(combined.combined.totalProfitLossRate,0.4);
  const holdingCost=(await models.KR.Holding.findOne({userId})).totalBuyAmount+(await models.US.Holding.findOne({userId})).totalBuyAmount*1300;
  const holdingValue=220+22*1300;
  assert.equal(combined.combined.holdingBuyAmount,holdingCost);
  assert.equal(combined.combined.holdingReturnRate,(holdingValue-holdingCost)/holdingCost*100);
  assert.equal(combined.combined.historyWarning,null);
  assert.equal(combined.combined.holdingsHistory.length,1);
  const beforeRate=combined.combined.holdingReturnRate;
  await models.KR.Account.updateOne({userId},{$inc:{cash:1000000,totalDeposits:1000000}});
  const afterDeposit=(await api('trading/performance')).combined;
  assert.equal(afterDeposit.holdingReturnRate,beforeRate);
  assert.equal(afterDeposit.investedCapital,combined.combined.investedCapital+1000000);
  assert.equal(afterDeposit.holdingsHistory.length,1,'same day must update, not duplicate');
  pass('Holding return uses KR/USD remaining cost; cash deposit leaves return unchanged and daily history persists');
  const soldKr=await models.KR.Order.findOne({userId,side:'SELL'}),soldUs=await models.US.Order.findOne({userId,side:'SELL'});
  assert.equal(combined.combined.history.reduce((sum,day)=>sum+day.profit,0),soldKr.realizedProfit+soldUs.realizedProfit*1300);
  const otherId=new mongoose.Types.ObjectId().toString();
  const otherAuth=jwt.sign({id:otherId},secret,{algorithm:'HS256',expiresIn:'5m'});
  const separate=await fetch(origin+'/api/trading/performance',{headers:{authorization:'Bearer '+otherAuth}});
  const separateData=(await separate.json()).data.combined;
  assert.equal(separateData.filledTradeCount,0);assert.equal(separateData.totalProfitLoss,0);
  assert.equal((await fetch(origin+'/api/trading/performance')).status,401);
  pass('Authenticated combined performance includes both markets, exact currency conversion, full history and account isolation');
  await configure({krTime:'2026-11-17T15:30:00+09:00',usTime:'2026-11-17T20:00:00-05:00'});
  for(const [name,m] of Object.entries(models)){pending[name]=await submit(m,'BUY',m.price*1.2);assert.equal(pending[name].status,'PENDING')}
  await sleep(5500);
  for(const [name,m] of Object.entries(models))assert.equal((await m.Order.findById(pending[name]._id)).status,'PENDING');
  pass('Both closing boundaries stop fills even if price conditions match');
  await configure({krTime:'2026-11-17T16:05:00+09:00',usTime:'2026-11-17T04:05:00-05:00',extendedAvailable:false});
  await sleep(5500);
  for(const [name,m]of Object.entries(models))assert.equal((await m.Order.findById(pending[name]._id)).status,'PENDING');
  await configure({extendedAvailable:true,stale:true});await sleep(5500);
  for(const [name,m]of Object.entries(models))assert.equal((await m.Order.findById(pending[name]._id)).status,'PENDING');
  await configure({stale:false,wrongSession:true});await sleep(5500);
  for(const [name,m]of Object.entries(models))assert.equal((await m.Order.findById(pending[name]._id)).status,'PENDING');
  for(const m of Object.values(models)){
   const response=await fetch(origin+'/api/'+m.path+'/orders',{method:'POST',headers:{authorization:'Bearer '+auth,'content-type':'application/json'},body:JSON.stringify({symbol:m.symbol,exchange:m.exchange,side:'BUY',quantity:1,orderType:'MARKET'})});assert.equal(response.status,409);
  }
  pass('KR post and US pre reject market orders; missing, stale and wrong-session quotes cannot fill limits');
  await configure({wrongSession:false});
  await until(async()=>{for(const[name,m]of Object.entries(models))if((await m.Order.findById(pending[name]._id)).status!=='FILLED')return false;return true},'extended-hours automatic buys');
  for(const [name,m] of Object.entries(models)){assert.equal((await m.Order.findById(pending[name]._id)).executedPrice,name==='KR'?110:11);assert.equal((await m.Account.findOne({userId})).reservedCash,0)}
  pass('KR aftermarket and US premarket limits automatically buy on verified fresh quote at requested price condition');
  for(const m of Object.values(models)){const immediate=await submit(m,'BUY',m.price*1.2);assert.equal(immediate.status,'FILLED')}
  pass('New marketable limits also fill immediately during the allowed extended session');
  for(const [name,m]of Object.entries(models)){sells[name]=await submit(m,'SELL',name==='KR'?125:12.5);assert.equal(sells[name].status,'PENDING')}
  await configure({krPrice:125,usPrice:12.5,usTime:'2026-11-17T17:05:00-05:00'});
  await until(async()=>{for(const[name,m]of Object.entries(models))if((await m.Order.findById(sells[name]._id)).status!=='FILLED')return false;return true},'extended-hours automatic sells');
  for(const m of Object.values(models))assert.equal((await m.Holding.findOne({userId})).reservedQuantity,0);
  pass('KR and US aftermarket limit sells automatically settle and release reserved shares');
  // Real KRX data, actual current session, disposable account only.
  if(process.env.QA_LIVE_KRX==='true'){
  await configure({krTime:'2026-11-17T20:00:00+09:00'});
  const liveBuy=await submit(models.KR,'BUY',500000);assert.equal(liveBuy.status,'PENDING');
  const beforeLive=await models.KR.Account.findOne({userId});
  const beforeQty=(await models.KR.Holding.findOne({userId})).quantity;
  await configure({liveKr:true});
  await until(async()=>(await models.KR.Order.findById(liveBuy._id)).status==='FILLED','actual KRX aftermarket quote and scheduler buy',45000);
  const liveBought=await models.KR.Order.findById(liveBuy._id);
  assert(liveBought.executedPrice>10000&&liveBought.executedPrice<=500000);
  assert.equal((await models.KR.Account.findOne({userId})).cash,beforeLive.cash-liveBought.executedPrice);
  assert.equal((await models.KR.Holding.findOne({userId})).quantity,beforeQty+1);
  await configure({liveKr:false});
  const liveSell=await submit(models.KR,'SELL',1);assert.equal(liveSell.status,'PENDING');
  await configure({liveKr:true});
  await until(async()=>(await models.KR.Order.findById(liveSell._id)).status==='FILLED','actual KRX aftermarket quote and scheduler sell',45000);
  const liveSold=await models.KR.Order.findById(liveSell._id);
  assert.equal((await models.KR.Account.findOne({userId})).cash,beforeLive.cash-liveBought.executedPrice+liveSold.executedPrice);
  assert.equal((await models.KR.Holding.findOne({userId})).quantity,beforeQty);
  pass(`LIVE KRX aftermarket automatic buy ${liveBought.executedPrice} / sell ${liveSold.executedPrice}; cash and holdings match`);
  }
  for(const capture of require('./fixtures/extended-us-quotes.json')){
  await configure({liveKr:false,usReplay:false,usTime:'2026-11-17T20:00:00-05:00',extendedAvailable:false});
  const row=capture.rows[0];
  const replayTime=require('../dist/utils/kisRealtime').domesticTimestamp(row.kymd,row.khms)*1000+30000;
  const replay=await api('us-trading/orders',{symbol:'NVDA',exchange:'NAS',side:'BUY',quantity:1,orderType:'LIMIT',limitPrice:500});assert.equal(replay.status,'PENDING');
  await configure({usReplay:capture.session,usTime:new Date(replayTime).toISOString()});
  await until(async()=>(await models.US.Order.findById(replay._id)).status==='FILLED','captured actual US post-market price replay');
  assert.equal((await models.US.Order.findById(replay._id)).executedPrice,Number(row.last));
  const sellReplay=await api('us-trading/orders',{symbol:'NVDA',exchange:'NAS',side:'SELL',quantity:1,orderType:'LIMIT',limitPrice:1});
  assert.equal(sellReplay.status,'FILLED');assert.equal(sellReplay.executedPrice,Number(row.last));
  assert.equal(await models.US.Holding.countDocuments({userId,symbol:'NVDA',quantity:{$gt:0}}),0);
  pass(`REPLAY US ${capture.session} buy/sell with actual KIS dated bar ${row.kymd} ${row.khms}, price ${row.last}; clock controlled, not a live-session test`);
  }
  await stopChild();assert.equal(child.exitCode,0);pass('Server shuts down both scheduler loops cleanly');
 } finally {
  await stopChild();
  if(owned){assert.equal(mongoose.connection.db.databaseName,dbName);assert.equal(await mongoose.connection.db.collection('qa_owner').countDocuments({runId}),1);await mongoose.connection.db.dropDatabase();console.log('Removed only this run disposable QA database.')}
  await mongoose.disconnect();
  fs.writeFileSync(path.join(root,'.qa/scheduler-integration-results.json'),JSON.stringify({checks,passed:checks.length,disposableDatabase:dbName,cleaned:owned},null,2));
  fs.writeFileSync(path.join(root,'.qa/scheduler-child.log'),log);
 }
})().catch(error=>{console.error(error.name+': '+error.message.replace(/mongodb(?:\+srv)?:\/\/[^@\s]+@/g,'mongodb://[redacted]@'));process.exitCode=1});
