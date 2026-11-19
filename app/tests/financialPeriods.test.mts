import test from 'node:test';
import assert from 'node:assert/strict';
import { financialColumns } from '../src/utils/financialPeriods.ts';
test('quarter comparison uses the same quarter of the previous year', () => {
 const rows=['2026.06','2026.03','2025.12','2025.09','2025.06'].map(period=>({period}));
 assert.deepEqual(financialColumns(rows,'quarter').map(row=>row?.period),['2026.06','2026.03','2025.06']);
 assert.equal(financialColumns(rows.slice(0,3),'quarter')[2],undefined);
});
test('annual comparison and missing data retain their actual periods', () => {
 const rows=['2025','2024','2023'].map(period=>({period}));
 assert.deepEqual(financialColumns(rows,'annual'),rows);
 assert.deepEqual(financialColumns([],'quarter'),[undefined,undefined,undefined]);
 const dart=['2026 2Q','2026 1Q','2025 2Q'].map(period=>({period}));
 assert.equal(financialColumns(dart,'quarter')[2]?.period,'2025 2Q');
});
