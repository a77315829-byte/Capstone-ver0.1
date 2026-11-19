const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:net');
const { allowedPeer, lanInterfaces, connectionInfo, assertLanIsolation } = require('./lan.cjs');
const { checkPort } = require('./exhibition.cjs');
const interfaces = {
 'Wi-Fi': [{ address:'192.168.10.5', netmask:'255.255.255.0', internal:false, family:'IPv4' }],
 'Ethernet': [{ address:'10.20.5.4', netmask:'255.255.254.0', internal:false, family:'IPv4' }],
 'Hamachi': [{ address:'10.99.1.1', netmask:'255.255.255.0', internal:false }],
 'vEthernet (WSL)': [{ address:'172.20.0.1', netmask:'255.255.0.0', internal:false }],
 'Public': [{ address:'203.0.113.10', netmask:'255.255.255.0', internal:false }],
 'Loopback': [{ address:'127.0.0.1', netmask:'255.0.0.0', internal:true }],
};
test('Advertises only usable LAN adapters and respects the selected web port', () => {
 assert.deepEqual(lanInterfaces(interfaces).map(item=>item.name),['Wi-Fi','Ethernet']);
 const info=connectionInfo({NETWORK_ACCESS:'lan',PORT:'3020'},interfaces);
 assert.equal(info.localUrl,'http://localhost:3020');
 assert.deepEqual(info.addresses.map(item=>item.url),['http://192.168.10.5:3020','http://10.20.5.4:3020']);
 assert.deepEqual(connectionInfo({NETWORK_ACCESS:'local'},interfaces).addresses,[]);
 assert.throws(()=>connectionInfo({PORT:'65536'}));
 assert.throws(()=>connectionInfo({NETWORK_ACCESS:'public'}));
});
test('LAN boundary accepts the current subnet and IPv4 mapped peers', () => {
 for (const address of ['192.168.10.25','::ffff:192.168.10.25','10.20.4.2','10.20.5.200','127.0.0.1','::1']) {
  assert.equal(allowedPeer(address,'lan',interfaces),true,address);
 }
});
test('Outside subnets, public IPs and virtual networks are not exposed', () => {
 for (const address of ['192.168.11.25','10.20.6.2','10.99.1.2','172.20.0.2','203.0.113.11','8.8.8.8','::ffff:8.8.8.8','2001:db8::1','bad','']) {
  assert.equal(allowedPeer(address,'lan',interfaces),false,address);
 }
 assert.equal(allowedPeer('192.168.10.25','local',interfaces),false);
 assert.equal(allowedPeer('127.0.0.1','local',interfaces),true);
});
test('Invalid or missing network masks fail closed', () => {
 for (const netmask of ['0.0.0.0','255.0.255.0',undefined]) {
  assert.equal(allowedPeer('192.168.10.25','lan',{'Wi-Fi':[{address:'192.168.10.5',netmask}]}),false);
 }
});
test('LAN mode keeps AI and Ollama loopback-only', () => {
 assert.doesNotThrow(()=>assertLanIsolation({NETWORK_ACCESS:'lan',SERVICE_HOST:'127.0.0.1',OLLAMA_HOST:'127.0.0.1:11434'}));
 assert.throws(()=>assertLanIsolation({NETWORK_ACCESS:'lan',SERVICE_HOST:'0.0.0.0'}));
 assert.throws(()=>assertLanIsolation({NETWORK_ACCESS:'lan',OLLAMA_HOST:'0.0.0.0:11434'}));
 assert.throws(()=>assertLanIsolation({NETWORK_ACCESS:'lan',AI_JUDGMENT_SERVICE_URL:'http://192.168.10.5:8003'}));
});
test('A local port collision is caught before child servers start', async () => {
 const server=createServer();
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const port=server.address().port;
 try { await assert.rejects(checkPort(port,'127.0.0.1','PORT'),/THIS PC.*PORT.*Other PCs/); }
 finally { await new Promise(resolve=>server.close(resolve)); }
 await checkPort(port,'127.0.0.1','PORT');
});
