const fs = require("node:fs");
const path = require("node:path");
const net = require("node:net");
const { spawn } = require("node:child_process");
const crypto = require("node:crypto");
const { connectionInfo, assertLanIsolation } = require('./lan.cjs');
const root = path.resolve(__dirname, "..");
const services = [
 { name: "scenario", dir: "services/scenario-server", app: "main:app", port: 8000, health: "/" },
 { name: "market", dir: "simulator/market_reaction", app: "app.main:app", port: 8002, health: "/health" },
 { name: "judgment", dir: "services/ai-judgment-service", app: "app.main:app", port: 8003, health: "/health" },
];
const profile = process.argv.find(x => x.startsWith("--profile="))?.split("=")[1] || "all";
const action = process.argv[2] || "start";
if (!["all", "web", "services"].includes(profile)) throw new Error("Use --profile=all|web|services");
const children = new Set();
let stopping = false;
function spawnChild(command, args, cwd, env = process.env, stdio = "inherit") {
 const child = spawn(command, args, { cwd, env, stdio, windowsHide: true, shell: false });
 children.add(child);
 child.once("exit", () => children.delete(child));
 return child;
}
function run(command, args, cwd, env) {
 return new Promise((resolve, reject) => {
  const child = spawnChild(command, args, cwd, env);
  child.once("error", reject);
  child.once("exit", code => code === 0 ? resolve() : reject(new Error("Command failed (" + code + "): " + command)));
 });
}
function npm(args, cwd) {
 const cli = process.env.npm_execpath || path.join(path.dirname(process.execPath), "node_modules/npm/bin/npm-cli.js");
 return run(process.execPath, [cli, ...args], cwd);
}
const pythonPath = service => path.join(root, service.dir, ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
function ollamaExecutable(env) {
 if (env.OLLAMA_EXECUTABLE) return env.OLLAMA_EXECUTABLE;
 if (process.platform === "win32" && env.LOCALAPPDATA) {
  const installed = path.join(env.LOCALAPPDATA, "Programs", "Ollama", "ollama.exe");
  if (fs.existsSync(installed)) return installed;
 }
 return "ollama";
}
function requiredModels(env) {
 const main = env.OLLAMA_MODEL || "qwen2.5:1.5b";
 return [...new Set([main, env.STOTRA_LLM_MODEL || main,
  env.SALARY_AI_MODEL || env.OLLAMA_SALARY_MODEL || main,
  env.OLLAMA_ASSET_MODEL || main, env.OLLAMA_EMBEDDING_MODEL || "bge-m3"])];
}
function loadEnv() {
 const dotenv = require(path.join(root, "server/node_modules/dotenv"));
 const local = path.join(root, ".env.exhibition");
 const legacy = path.join(root, "server/.env");
 const env = { ...process.env };
 for (const file of [legacy, local]) {
  if (fs.existsSync(file)) for (const [key, value] of Object.entries(dotenv.parse(fs.readFileSync(file)))) {
   if (value !== "" && process.env[key] === undefined) env[key] = value;
  }
 }
 if (!env.MONGODB_URI && env.STOTRA_MONGODB_USERNAME && env.STOTRA_MONGODB_PASSWORD && env.STOTRA_MONGODB_CLUSTER) {
  env.MONGODB_URI = "mongodb+srv://" + encodeURIComponent(env.STOTRA_MONGODB_USERNAME) + ":" +
   encodeURIComponent(env.STOTRA_MONGODB_PASSWORD) + "@" + env.STOTRA_MONGODB_CLUSTER + "/?retryWrites=true&w=majority";
 }
 return env;
}
function serviceEnv(service, env, localSettings) {
 const dotenv = require(path.join(root, "server/node_modules/dotenv"));
 const file = path.join(root, service.dir, ".env");
 const local = localSettings ?? (fs.existsSync(file) ? dotenv.parse(fs.readFileSync(file)) : {});
 const merged = { ...local, ...env, PYTHONUNBUFFERED: "1", PYTHONUTF8: "1",
  PYTHONPATH: path.join(root, "services") + path.delimiter + (env.PYTHONPATH || "") };
 if (service.name === "scenario") {
  merged.MONGODB_URI = env.SCENARIO_MONGODB_URI || local.MONGODB_URI || env.MONGODB_URI || "";
  merged.KIS_APP_KEY = env.STOTRA_KIS_APP_KEY || local.KIS_APP_KEY || "";
  merged.KIS_APP_SECRET = env.STOTRA_KIS_APP_SECRET || local.KIS_APP_SECRET || "";
  merged.KIS_ENV = env.STOTRA_KIS_ENV || local.KIS_ENV || "real";
  merged.MONGODB_DATABASE = env.SCENARIO_DB_NAME || local.MONGODB_DATABASE || "anttitude_scenario";
  merged.DATA_BACKEND = "mongodb";
 }
 if (service.name === "judgment") {
  merged.MONGO_URI = env.JUDGMENT_MONGODB_URI || local.MONGO_URI || env.MONGODB_URI || "";
  merged.MONGO_DB_NAME = env.JUDGMENT_DB_NAME || local.MONGO_DB_NAME || "anttitude_ai_judgment";
  merged.KIS_APP_KEY = env.STOTRA_KIS_APP_KEY || local.KIS_APP_KEY || "";
  merged.KIS_APP_SECRET = env.STOTRA_KIS_APP_SECRET || local.KIS_APP_SECRET || "";
  merged.KIS_BASE_URL = env.STOTRA_KIS_ENV === "demo" ? "https://openapivts.koreainvestment.com:29443" : "https://openapi.koreainvestment.com:9443";
  merged.LLM_PROVIDER = env.LLM_PROVIDER || local.LLM_PROVIDER || "ollama";
 }
 merged.OLLAMA_HOST = env.OLLAMA_BASE_URL || local.OLLAMA_HOST || "http://127.0.0.1:11434";
 merged.OLLAMA_BASE_URL = env.OLLAMA_BASE_URL || local.OLLAMA_BASE_URL || "http://127.0.0.1:11434";
 return merged;
}
async function setup() {
 await npm(["ci", "--no-audit", "--no-fund"], path.join(root, "server"));
 if (profile !== "services") {
  await npm(["ci", "--no-audit", "--no-fund"], path.join(root, "app"));
  await npm(["run", "build"], path.join(root, "app"));
 }
 if (profile !== "web") for (const service of services) {
  const cwd = path.join(root, service.dir);
  if (!fs.existsSync(pythonPath(service))) {
   await run(process.env.PYTHON_EXE || "python", ["-c", "import sys; assert (3,10) <= sys.version_info[:2] <= (3,12), 'Use Python 3.10-3.12; Python 3.12 is tested.'"], cwd);
   await run(process.env.PYTHON_EXE || "python", ["-m", "venv", ".venv"], cwd);
  }
  await run(pythonPath(service), ["-m", "pip", "install", "-r", "requirements.txt"], cwd);
 }
 const target = path.join(root, ".env.exhibition");
 if (!fs.existsSync(target)) {
  let content = fs.readFileSync(path.join(root, "exhibition.env.example"), "utf8");
  content = content.replace("STOTRA_JWT_SECRET=", "STOTRA_JWT_SECRET=" + crypto.randomBytes(32).toString("hex"));
  content = content.replace("EXHIBITION_SERVICE_KEY=", "EXHIBITION_SERVICE_KEY=" + crypto.randomBytes(32).toString("hex"));
  const dotenv = require(path.join(root, "server/node_modules/dotenv"));
  const existing = file => fs.existsSync(path.join(root, file)) ? dotenv.parse(fs.readFileSync(path.join(root, file))) : {};
  const web = existing("server/.env");
  const scenario = existing("services/scenario-server/.env");
  const judgment = existing("services/ai-judgment-service/.env");
  for (const [name, value] of Object.entries({
   MONGO_DB_NAME: process.env.MONGO_DB_NAME || web.MONGO_DB_NAME,
   SCENARIO_DB_NAME: process.env.SCENARIO_DB_NAME || scenario.MONGODB_DATABASE,
   JUDGMENT_DB_NAME: process.env.JUDGMENT_DB_NAME || judgment.MONGO_DB_NAME,
  })) {
   if (value) content = content.replace(new RegExp("^" + name + "=.*$", "m"), () => name + "=" + JSON.stringify(value));
  }
  fs.writeFileSync(target, content);
 }
 console.log("Setup complete. Configure .env.exhibition, then npm start. DB data has not been seeded or deleted.");
}
async function setupModels(env) {
 const url = new URL(env.OLLAMA_BASE_URL || "http://127.0.0.1:11434");
 if (!["127.0.0.1", "localhost"].includes(url.hostname)) throw new Error("School setup requires a local Ollama installation.");
 const command = ollamaExecutable(env);
 const modelEnv = { ...env, OLLAMA_HOST: url.host };
 if (!(await health(url.origin + "/api/tags"))) {
  let failure;
  const child = spawnChild(command, ["serve"], root, modelEnv);
  child.once("error", () => { failure = "Install Ollama for Windows, then rerun setup-exhibition.bat."; });
  child.once("exit", code => { if (code) failure = "Ollama could not start. Check port 11434 and rerun setup."; });
  let ready = false;
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
   if (failure) throw new Error(failure);
   if (await health(url.origin + "/api/tags")) { ready = true; break; }
   await new Promise(resolve => setTimeout(resolve, 500));
  }
  if (!ready) throw new Error("Ollama did not become ready within 30 seconds.");
 }
 const response = await fetch(url.origin + "/api/tags", { signal: AbortSignal.timeout(10000) });
 const installed = (await response.json()).models || [];
 const names = new Set(installed.flatMap(model => [model.name, model.model]));
 for (const model of requiredModels(env)) {
  if (names.has(model) || names.has(model + ":latest")) console.log("Model ready: " + model);
  else await run(command, ["pull", model], root, modelEnv);
 }
 console.log("AI models ready. Run start-exhibition.bat to start the exhibition.");
}
function checkPort(port, host, setting = '') {
 return new Promise((resolve, reject) => {
  const server = net.createServer();
  server.once("error", () => reject(new Error("Port " + port + " is already in use on THIS PC or unavailable. Stop the old service" + (setting ? " or change " + setting + " in .env.exhibition" : " on this PC") + ". Other PCs using the same port do not conflict.")));
  server.listen(port, host, () => server.close(resolve));
 });
}
async function health(url) {
 try {
  const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
  const body = await response.json();
  return response.ok && body?.database !== "unavailable" && body?.data?.database !== "unavailable";
 } catch { return false; }
}
async function doctor(env) {
 const checks = [
  ["web/database", "http://127.0.0.1:" + (env.PORT || 3010) + "/api/health"],
  ["scenario", (env.SCENARIO_SERVICE_URL || "http://127.0.0.1:8000") + "/"],
  ["market", (env.MARKET_REACTION_URL || "http://127.0.0.1:8002") + "/health"],
  ["judgment", (env.AI_JUDGMENT_SERVICE_URL || "http://127.0.0.1:8003") + "/health"],
  ["ollama", (env.OLLAMA_BASE_URL || "http://127.0.0.1:11434") + "/api/tags"],
 ];
 const statuses = await Promise.all(checks.map(async ([name, url]) => [name, await health(url)]));
 statuses.forEach(([name, ok]) => console.log(name + ": " + (ok ? "OK" : "UNAVAILABLE")));
 console.log("AI_MODE=" + (env.AI_MODE || "auto") + "; DB connection/seed data must be verified before the exhibition.");
 printConnections(env);
 if (statuses.some(([, ok]) => !ok)) process.exitCode = 1;
}
function printConnections(env) {
 const info = connectionInfo(env);
 console.log('This PC: ' + info.localUrl);
 if (info.mode === 'lan') {
  for (const item of info.addresses) console.log('Same Wi-Fi / ' + item.name + ': ' + item.url);
  if (!info.addresses.length) console.log('No private LAN IPv4 address found. Connect school Wi-Fi and run show-school-address.bat.');
  console.log('School LAN only. Run enable-school-lan.bat as administrator once on the school PC.');
 }
}
async function stop(code = 0) {
 if (stopping) return;
 stopping = true;
 const pending = [...children].map(child => {
  if (process.platform !== "win32" || !child.pid) { child.kill("SIGTERM"); return Promise.resolve(); }
  // Windows venv launchers create a second python.exe. Stop only our owned tree.
  return new Promise(resolve => {
   const killer = spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
   killer.once("error", resolve);
   killer.once("exit", resolve);
  });
 });
 await Promise.race([Promise.allSettled(pending), new Promise(resolve => setTimeout(resolve, 5000))]);
 process.exit(code);
}
async function start(env) {
 connectionInfo(env);
 assertLanIsolation(env);
 if (!env.EXHIBITION_SERVICE_KEY || env.EXHIBITION_SERVICE_KEY.length < 32) throw new Error("Set EXHIBITION_SERVICE_KEY (32+ characters) for the Node/Python services.");
 if (!env.MONGODB_URI) throw new Error("Set MONGODB_URI or existing STOTRA_MONGODB_* in .env.exhibition/server/.env.");
 const selected = profile === "web" ? [] : services.filter(s => s.name === "scenario" || env.AI_MODE !== "rules");
 const host = env.SERVICE_HOST || "127.0.0.1";
 for (const service of selected) {
  if (!fs.existsSync(pythonPath(service))) throw new Error("Run npm run setup for " + service.name);
  await checkPort(service.port, host);
 }
 if (profile !== "services") {
  if (!fs.existsSync(path.join(root, "app/dist/index.html")) || !fs.existsSync(path.join(root, "server/dist/index.js"))) throw new Error("Run npm run build first.");
  await checkPort(Number(env.PORT || 3010), env.HOST || "127.0.0.1", 'PORT');
 }
 // Ollama may already be running as a desktop service. Start it only if needed.
 const ollamaUrl = new URL(env.OLLAMA_BASE_URL || "http://127.0.0.1:11434");
 if (profile !== "web" && env.AI_MODE !== "rules" &&
  ["127.0.0.1", "localhost"].includes(ollamaUrl.hostname) && !(await health(ollamaUrl.origin + "/api/tags"))) {
  const ollama = spawnChild(ollamaExecutable(env), ["serve"], root, { ...env, OLLAMA_HOST: env.OLLAMA_HOST || ollamaUrl.host });
  ollama.once("error", () => console.log("Ollama unavailable: rule-based fallback remains available. Install/pull models separately."));
  ollama.once("exit", code => { if (!stopping && code) console.log("Ollama exited; using available fallback."); });
 }
 for (const service of selected) {
  const child = spawnChild(pythonPath(service), ["-m", "uvicorn", service.app, "--host", host, "--port", String(service.port)],
   path.join(root, service.dir), serviceEnv(service, env));
  child.once("error", error => { console.error(service.name + ": " + error.message); void stop(1); });
  child.once("exit", code => {
   if (!stopping) { console.error(service.name + " exited (" + code + ")."); if (service.name === "scenario") void stop(1); }
  });
 }
 if (profile !== "services") {
  const child = spawnChild(process.execPath, ["dist/index.js"], path.join(root, "server"), env);
  child.once("error", error => { console.error(error.message); void stop(1); });
  child.once("exit", code => { if (!stopping) void stop(code || 1); });
  printConnections(env);
 }
 console.log("Profile: " + profile + ". Ctrl+C stops only services launched here.");
}
module.exports = { serviceEnv, health, requiredModels, checkPort };
if (require.main === module) {
 process.on("SIGINT", () => void stop());
 process.on("SIGTERM", () => void stop());
 (async () => {
  if (action === "school-setup") {
   if (Number(process.versions.node.split(".")[0]) < 22) throw new Error("Install Node.js 22 or newer first.");
   await run(process.env.PYTHON_EXE || "python", ["-c", "import sys; assert (3,10) <= sys.version_info[:2] <= (3,12), 'Install Python 3.12 with Add python.exe to PATH checked.'"], root);
   await run(ollamaExecutable(process.env), ["--version"], root);
   await setup();
   await setupModels(loadEnv());
   return stop(0);
  }
  if (action === "setup") return setup();
  const env = loadEnv();
  if (action === 'lan') { printConnections(env); return; }
  if (action === 'network-config') { console.log(JSON.stringify(connectionInfo(env))); return; }
  if (action === "models") { await setupModels(env); return stop(0); }
  if (action === "doctor") return doctor(env);
  if (action === "seed") {
   const service = services[0];
   return run(pythonPath(service), ["-m", "scripts.seed_database"], path.join(root, service.dir), serviceEnv(service, env));
  }
  if (action === "build") {
   await npm(["run", "tsc"], path.join(root, "server"));
   return npm(["run", "build"], path.join(root, "app"));
  }
  if (action !== "start") throw new Error("Unknown action");
  return start(env);
 })().catch(error => { console.error(error.message); void stop(1); });
}
