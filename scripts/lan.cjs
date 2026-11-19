const os = require('node:os');
const net = require('node:net');

function ipv4Number(address) {
 if (net.isIP(address || '') !== 4) return null;
 return address.split('.').reduce((value, part) => ((value << 8) | Number(part)) >>> 0, 0);
}
function privateIpv4(address) {
 const value = ipv4Number(address);
 return value !== null && ((value >>> 24) === 10 || (value >>> 20) === 0xac1 || (value >>> 16) === 0xc0a8);
}
function validMask(mask) {
 const value = ipv4Number(mask);
 if (value === null || value === 0) return false;
 const inverse = (~value) >>> 0;
 return (inverse & (inverse + 1)) === 0;
}
function lanInterfaces(interfaces = os.networkInterfaces()) {
 const rows = [];
 for (const [name, addresses] of Object.entries(interfaces)) {
  // Virtual/VPN adapters must not accidentally become school exhibition entry points.
  if (/hamachi|tailscale|zerotier|virtual|vmware|vethernet|loopback|\btun\b|\btap\b/i.test(name)) continue;
  for (const item of addresses || []) {
   if (item.internal || !privateIpv4(item.address) || !validMask(item.netmask)) continue;
   rows.push({ name, address: item.address, netmask: item.netmask });
  }
 }
 return rows;
}
function loopback(address) {
 return address === '::1' || (ipv4Number(address) !== null && address.startsWith('127.'));
}
function allowedPeer(address, mode, interfaces = os.networkInterfaces()) {
 const peer = (address || '').replace(/^::ffff:/i, '');
 if (loopback(peer)) return true;
 if (mode !== 'lan' || !privateIpv4(peer)) return false;
 const value = ipv4Number(peer);
 return lanInterfaces(interfaces).some(item => {
  const mask = ipv4Number(item.netmask);
  return (value & mask) === (ipv4Number(item.address) & mask);
 });
}
function connectionInfo(env, interfaces = os.networkInterfaces()) {
 const port = Number(env.PORT || 3010);
 if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('PORT must be between 1024 and 65535.');
 const mode = env.NETWORK_ACCESS || 'local';
 if (!['local', 'lan'].includes(mode)) throw new Error('NETWORK_ACCESS must be local or lan.');
 const adapters = lanInterfaces(interfaces);
 return { mode, port, localUrl: `http://localhost:${port}`, nodePath: process.execPath,
  addresses: mode === 'lan' ? adapters.map(item => ({ ...item, url: `http://${item.address}:${port}` })) : [] };
}
function assertLanIsolation(env) {
 if (env.NETWORK_ACCESS !== 'lan') return;
 if (env.SERVICE_HOST && !['127.0.0.1', 'localhost', '::1'].includes(env.SERVICE_HOST)) {
  throw new Error('School LAN mode keeps SERVICE_HOST=127.0.0.1. Only the web port is shared.');
 }
 for (const key of ['SCENARIO_SERVICE_URL','MARKET_REACTION_URL','AI_JUDGMENT_SERVICE_URL','OLLAMA_BASE_URL','OLLAMA_HOST']) {
  if (!env[key]) continue;
  const value = env[key].includes('://') ? env[key] : `http://${env[key]}`;
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(value).hostname)) {
   throw new Error(`School LAN mode requires a loopback address for ${key}.`);
  }
 }
}
module.exports = { lanInterfaces, privateIpv4, allowedPeer, connectionInfo, assertLanIsolation };
