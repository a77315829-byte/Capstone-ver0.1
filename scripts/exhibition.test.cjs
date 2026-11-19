const { test } = require("node:test");
const assert = require("node:assert/strict");
const { serviceEnv, health, requiredModels } = require("./exhibition.cjs");
test("Service settings isolate database names and carry the shared key", () => {
 const env = { MONGODB_URI:"mongodb://example.invalid", MONGO_DB_NAME:"web-db",
  SCENARIO_DB_NAME:"scenario-db", JUDGMENT_DB_NAME:"judgment-db",
  EXHIBITION_SERVICE_KEY:"test-service-key", STOTRA_KIS_APP_KEY:"test-kis-key" };
 const scenario = serviceEnv({name:"scenario",dir:"services/scenario-server"},env,{});
 const judgment = serviceEnv({name:"judgment",dir:"services/ai-judgment-service"},env,{});
 assert.equal(scenario.MONGODB_DATABASE,"scenario-db");
 assert.equal(judgment.MONGO_DB_NAME,"judgment-db");
 assert.equal(judgment.MONGO_URI,env.MONGODB_URI);
 assert.equal(scenario.EXHIBITION_SERVICE_KEY,env.EXHIBITION_SERVICE_KEY);
 assert.equal(scenario.KIS_APP_KEY,"test-kis-key");
 assert.equal(scenario.DATA_BACKEND,"mongodb");
});
test("Existing service databases are preserved unless explicitly overridden for that service", () => {
 const env = { MONGODB_URI: "mongodb://web.invalid" };
 const scenario = { name: "scenario", dir: "services/scenario-server" };
 const judgment = { name: "judgment", dir: "services/ai-judgment-service" };
 assert.equal(serviceEnv(scenario, env, { MONGODB_URI: "mongodb://scenario.invalid" }).MONGODB_URI, "mongodb://scenario.invalid");
 assert.equal(serviceEnv(judgment, env, { MONGO_URI: "mongodb://judgment.invalid" }).MONGO_URI, "mongodb://judgment.invalid");
 assert.equal(serviceEnv(judgment, { ...env, JUDGMENT_MONGODB_URI: "mongodb://override.invalid" }, { MONGO_URI: "mongodb://judgment.invalid" }).MONGO_URI, "mongodb://override.invalid");
 assert.equal(serviceEnv(scenario, { ...env, SCENARIO_MONGODB_URI: "mongodb://override.invalid" }, { MONGODB_URI: "mongodb://scenario.invalid" }).MONGODB_URI, "mongodb://override.invalid");
});
test("Doctor does not mistake a disconnected database for healthy", async () => {
 const original=global.fetch;
 try {
  global.fetch=async()=>({ok:true,json:async()=>({database:"unavailable"})});
  assert.equal(await health("http://example.invalid"),false);
  global.fetch=async()=>({ok:true,json:async()=>({database:"connected"})});
  assert.equal(await health("http://example.invalid"),true);
 } finally { global.fetch=original; }
});
test("School setup installs every configured AI model and the RAG embedding model once", () => {
 assert.deepEqual(requiredModels({ OLLAMA_MODEL: "qwen2.5:1.5b" }), ["qwen2.5:1.5b", "bge-m3"]);
 assert.deepEqual(requiredModels({ OLLAMA_MODEL: "main", STOTRA_LLM_MODEL: "assistant",
  SALARY_AI_MODEL: "salary", OLLAMA_SALARY_MODEL: "unused", OLLAMA_ASSET_MODEL: "asset",
  OLLAMA_EMBEDDING_MODEL: "embedding" }), ["main", "assistant", "salary", "asset", "embedding"]);
});
