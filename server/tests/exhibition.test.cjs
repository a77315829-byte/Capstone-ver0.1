const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
process.env.STOTRA_JWT_SECRET = "exhibition-unit-test-secret-at-least-32-characters";
process.env.AI_MODE = "rules";
process.env.AI_JUDGMENT_SERVICE_URL = "http://127.0.0.1:1";
process.env.MARKET_REACTION_URL = "http://127.0.0.1:1";
process.env.EXHIBITION_SERVICE_KEY = "internal-test-key";
const express = require("express");
const jwt = require("jsonwebtoken");
const { validateCredentials } = require("../src/middleware/credentials");
const { verifyToken } = require("../src/middleware/authJwt");
const { marketFallback, judgmentFallback } = require("../src/services/exhibitionFallback.service");
const requests = require("../src/utils/requests");
requests.fetchStockData = async () => { throw new Error("offline"); };
const judgment = require("../src/controller/judgmentProxy.controller");
const market = require("../src/controller/marketReaction.controller").default;
const scenario = require("../src/controller/scenarioProxy").default;
const User = require("../src/models/user.model").default;
const app = express();
app.use(express.json());
app.post("/auth/signup", validateCredentials, (_req,res)=>res.json({ok:true}));
app.post("/protected", verifyToken, (req,res)=>res.json({userId:req.body.userId}));
app.get("/judgment/:symbol", judgment.getJudgment);
app.post("/compare", judgment.compareJudgment);
app.get("/history/:symbol", judgment.judgmentHistory);
app.post("/market", market.simulate);
app.use("/scenario",scenario);
let server, origin;
before(async()=>{
 server = await new Promise(resolve=>{const s=app.listen(0,"127.0.0.1",()=>resolve(s));});
 origin="http://127.0.0.1:"+server.address().port;
 User.findById = () => ({ select: () => ({ lean: async () => ({username:"alice"}) }) });
});
after(()=>new Promise(resolve=>server.close(resolve)));
const post = (url, body, headers={}) => fetch(origin+url,{method:"POST",headers:{"Content-Type":"application/json",...headers},body:JSON.stringify(body)});
const token = jwt.sign({id:"111111111111111111111111"},process.env.STOTRA_JWT_SECRET,{algorithm:"HS256",expiresIn:"1h"});
test("MongoDB operators and invalid credentials are rejected before DB access", async()=>{
 for (const body of [{username:{$ne:null},password:"password123"},{username:"alice",password:{x:1}},{username:"alice",password:"short"},{username:"alice",password:"가".repeat(30)}]) {
  assert.equal((await post("/auth/signup",body)).status,400);
 }
 assert.equal((await post("/auth/signup",{username:"alice",password:"password123"})).status,200);
});
test("JWT enforces expiry/algorithm and replaces forged userId", async()=>{
 assert.equal((await post("/protected",{})).status,401);
 const res=await post("/protected",{userId:"someone-else"},{Authorization:"Bearer "+token});
 assert.equal((await res.json()).userId,"111111111111111111111111");
 const bad=jwt.sign({id:"111111111111111111111111"},process.env.STOTRA_JWT_SECRET,{algorithm:"HS384"});
 assert.equal((await post("/protected",{},{Authorization:"Bearer "+bad})).status,401);
 const expired=jwt.sign({id:"111111111111111111111111"},process.env.STOTRA_JWT_SECRET,{expiresIn:-1});
 assert.equal((await post("/protected",{},{Authorization:"Bearer "+expired})).status,401);
});
test("Scenario records require login and cannot target another username",async()=>{
 assert.equal((await fetch(origin+"/scenario/users/bob/quiz-progress")).status,401);
 assert.equal((await fetch(origin+"/scenario/users/bob/quiz-progress",{headers:{Authorization:"Bearer "+token}})).status,403);
});
test("Rule market results are finite, conservative and explicitly labelled",()=>{
 for(const text of ["실적 개선", "파산 매출 감소", "실적 개선을 부인했다", "관련 정보가 없습니다"]) {
  const r=marketFallback({code:"005930",name:"삼성전자"},text,null,null);
  assert.equal(r.market_pressure.buy+r.market_pressure.sell+r.market_pressure.hold,100);
  assert.equal(r.agent_reactions.length,5);
  assert.equal(r.meta.fallback_used,true);
  assert.equal(r.current_stock_context.current_price,null);
  assert.equal(r.current_stock_context.is_realtime,false);
  assert.equal(r.meta.db_save_status,"not_used");
 }
 const neutral=marketFallback({code:"005930",name:"삼성전자"},"실적 개선을 부인했다",null,null);
 assert.equal(neutral.market_pressure.hold,100);
});
test("Missing quote never invents price, evidence or confidence",()=>{
 const r=judgmentFallback("005930",null);
 assert.equal(r.judge,"관망"); assert.equal(r.confidence,0);
 assert.deepEqual(r.factors,[]); assert.equal(r.data_available,false);
});
test("AI service off still supports judgment, comparison and empty real history",async()=>{
 const r=await fetch(origin+"/judgment/005930"); assert.equal(r.status,200);
 assert.equal((await r.json()).source,"rule-based");
 const compare=await post("/compare",{symbol:"005930",user_judge:"매수"});
 assert.equal((await compare.json()).fallback_used,true);
 assert.deepEqual(await (await fetch(origin+"/history/005930")).json(),[]);
 assert.equal((await post("/compare",{symbol:"005930",user_judge:"unknown"})).status,400);
});
test("Market server off returns a complete fallback and rejects invalid payloads",async()=>{
 const valid={selected_stock:{code:"005930",name:"삼성전자"},input_text:"실적 개선과 수요 증가"};
 const response=await post("/market",valid); assert.equal(response.status,200);
 assert.equal((await response.json()).meta.fallback_used,true);
 assert.equal((await post("/market",{...valid,input_text:{bad:true}})).status,400);
 assert.equal((await post("/market",{...valid,selected_stock:{code:"../x",name:"x"}})).status,400);
});

test("auto mode falls back when the separate servers refuse connections", async()=>{
 process.env.AI_MODE="auto";
 const result=await fetch(origin+"/judgment/005930");
 assert.equal(result.status,200); assert.equal((await result.json()).fallback_used,true);
 const marketResult=await post("/market",{selected_stock:{code:"005930",name:"Samsung"},input_text:"실적 개선"});
 assert.equal(marketResult.status,200); assert.equal((await marketResult.json()).meta.fallback_used,true);
});

const { salaryRuleFallback, analyzeSalaryPlan } = require("../src/services/salaryAi.service");
const { validSalarySnapshot } = require("../src/middleware/salaryValidation");
const salarySnapshot = {
 standardYear:2026, rank:"병장",salary:1500000,enlistmentDate:"",promotionSpendingRate:0.5,
 militarySavings:500000,existingMilitarySavingsPrincipal:0,fixedExpenses:100000,variableExpenses:200000,
 totalExpenses:300000,remainingAmount:700000,overspendAmount:0,fixedItems:[],variableItems:[],
 topExpense:{label:"",amount:0},actualRatios:{savings:33,expenses:20,remaining:47},
 goal:{name:"전역",description:"",costItems:[],targetAmount:1000000,currentSaved:0,dischargeDate:"",
 monthsLeft:3,existingContributions:0,futureContributions:0,projectedContributions:0,projectedMatchingSupport:0,
 projectedMilitarySavings:0,projectedAvailableAtDischarge:0,goalGap:1000000,monthlyGoalNeeded:333334}
};
test("Salary fallback balances input funds and never invents improvement or an AI source",()=>{
 assert.equal(validSalarySnapshot(salarySnapshot),true);
 const r=salaryRuleFallback(salarySnapshot);
 assert.equal(r.source,"RULES");
 assert.equal(Object.values(r.allocation).reduce((a,b)=>a+b,0),700000);
 assert.equal(r.allocation.investmentPractice,0);
 assert.equal(r.projection.additionalSecured,0);
 assert.equal(r.monthlyPlan.expectedMonthlyImprovement,0);
 assert.match(r.diagnosis.summary,/규칙 기반/);
 const overspend={...salarySnapshot,remainingAmount:-100000,overspendAmount:100000,actualRatios:{savings:33,expenses:110,remaining:-43}};
 assert.equal(validSalarySnapshot(overspend),true);
 assert.equal(salaryRuleFallback(overspend).diagnosis.riskLevel,"HIGH");
});
test("Salary input rejects unbounded projection loops and invalid money",()=>{
 assert.equal(validSalarySnapshot({...salarySnapshot,goal:{...salarySnapshot.goal,monthsLeft:1e9}}),false);
 assert.equal(validSalarySnapshot({...salarySnapshot,salary:Infinity}),false);
 assert.equal(validSalarySnapshot({...salarySnapshot,fixedItems:[{amount:-1,label:"x"}]}),false);
});
test("Salary Ollama failure still returns the existing plan schema",async()=>{
 const original=global.fetch;
 process.env.AI_MODE="auto";
 try {
  global.fetch=async()=>{throw new Error("offline");};
  const result=await analyzeSalaryPlan(salarySnapshot);
  assert.equal(result.source,"RULES");
  assert.equal(result.result.source,"RULES");
  assert.ok(Array.isArray(result.result.projection.rankSegments));
 } finally { global.fetch=original; }
});
