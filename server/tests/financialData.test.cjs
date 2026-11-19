const { test } = require('node:test');
const assert = require('node:assert/strict');
const { financialNumber, financialCacheTtlMs } = require('../src/utils/financialData');
const { parseNaverFinancials } = require('../src/services/naverFinancial.service');
const { dartAnnualPeriod, dartQuarterAmount, mergeReportedPeriods } = require('../src/utils/financialData');
test('DART quarters use current-quarter amounts, never year-to-date figures', () => {
 assert.equal(dartQuarterAmount({thstrm_amount:'2,000',thstrm_add_amount:'9,000'}),2000);
 assert.equal(dartQuarterAmount({thstrm_add_amount:'9,000'}),null);
 assert.equal(dartAnnualPeriod('2025.01.01 ~ 2025.12.31',2025),'2025.12');
 assert.equal(dartAnnualPeriod(undefined,2025),'2025');
 const merged=mergeReportedPeriods([{period:'2025.12',revenue:123456,roe:null}], [{period:'2025.12',revenue:123000,roe:8},{period:'2024.12',revenue:90000,roe:7}]);
 assert.equal(merged[0].revenue,123456);
 assert.equal(merged[0].roe,8);
 assert.equal(merged[1].period,'2024.12');
});
test('missing and invalid finance values remain missing instead of becoming zero', () => {
 for(const value of [null, undefined, '', '  ', '-', 'N/A', '12억원', NaN, Infinity, true]) assert.equal(financialNumber(value),null);
 assert.equal(financialNumber('0'),0);
 assert.equal(financialNumber('-1,230.5'),-1230.5);
});
test('supplementary financials exclude estimates, preserve losses and convert hundred-million-won amounts', () => {
 const data = { itemCode: '005930', financeInfo: {
  trTitleList: [{key:'202512',isConsensus:'Y'},{key:'202412',isConsensus:'N'},{key:'202312',isConsensus:'N'}],
  rowList: [
   {title:'매출액',columns:{202512:{value:'9,999'},202412:{value:'1,234.5'},202312:{value:'1,000'}}},
   {title:'영업이익',columns:{202412:{value:'-10'}}},
   {title:'ROE',columns:{202412:{value:'-'}}},
  ],
 }};
 const result=parseNaverFinancials(data,'005930');
 assert.equal(result.length,2);
 assert.equal(result[0].period,'2024.12');
 assert.equal(result[0].revenue,123450000000);
 assert.equal(result[0].operatingProfit,-1000000000);
 assert.equal(result[0].roe,null);
 assert.deepEqual(parseNaverFinancials(data,'000660'),[]);
 assert.deepEqual(parseNaverFinancials({itemCode:'005930'},'005930'),[]);
});
test('provider failures and partial financials expire promptly; complete data keeps normal TTL', () => {
 assert.equal(financialCacheTtlMs({roe:null,revenue:null,operatingProfit:null}),60000);
 assert.equal(financialCacheTtlMs({roe:9,revenue:100,operatingProfit:null}),60000);
 assert.equal(financialCacheTtlMs({roe:0,revenue:100,operatingProfit:0}),21600000);
});
