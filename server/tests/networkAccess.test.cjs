const {test}=require('node:test');
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const {networkBoundary,inexpensiveAiRequest}=require('../src/utils/networkAccess');
const {attachStockStream}=require('../src/services/stockStream.service');

test('HTTP boundary uses the socket IP, never a spoofed forwarded header',()=>{
 const request={socket:{remoteAddress:'203.0.113.5'},headers:{'x-forwarded-for':'127.0.0.1'}};
 let code,next=false;
 const response={status(value){code=value;return this;},json(){}};
 networkBoundary(request,response,()=>{next=true});
 assert.equal(code,403);assert.equal(next,false);
 networkBoundary({socket:{remoteAddress:'127.0.0.1'}},response,()=>{next=true});
 assert.equal(next,true);
});
test('WebSocket upgrade has the same network boundary as HTTP',()=>{
 const server=new EventEmitter();attachStockStream(server);
 let status='';
 const socket={end(message){status=message}};
 server.emit('upgrade',{socket:{remoteAddress:'203.0.113.5'},headers:{host:'school:3010',origin:'http://school:3010'},url:'/api/stocks/005930/stream'},socket,Buffer.alloc(0));
 assert.match(status,/403 Forbidden/);
 server.emit('close');
});
test('Cached result polling and watch heartbeat do not spend expensive generation quota',()=>{
 for (const [method,originalUrl] of [['GET','/api/ai-judgment/005930'],['GET','/api/ai-judgment/005930/history'],['POST','/api/ai-judgment/005930/watch'],['DELETE','/api/ai-judgment/005930/watch']]) {
  assert.equal(inexpensiveAiRequest({method,originalUrl}),true);
 }
 for (const originalUrl of ['/api/ai-judgment/compare','/api/market-reaction/simulate','/api/salary-ai/analyze','/api/ai/asset-advice']) {
  assert.equal(inexpensiveAiRequest({method:'POST',originalUrl}),false);
 }
});
