import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { expect, it, vi } from 'vitest';
import { getProcessedFuelSales } from '../services/supaBaseService.js';

const { rpc, getCstoreGradeMap } = vi.hoisted(() => ({
  rpc: vi.fn(),
  getCstoreGradeMap: vi.fn(),
}));

vi.mock('../utils/supabase/server.js', () => ({ supabase: { rpc } }));
vi.mock('../services/fuelGradePosMapping.js', () => ({ default: { getCstoreGradeMap } }));

it('backfills only missing legacy fields and respects cleared and reassigned mappings', async () => {
  const model = {
    init: vi.fn(),
    updateOne: vi.fn(),
    find: () => ({ lean: async () => [
      { key: 'Regular', cstoreFuelTypes: [] },
      { key: 'Premium', cstoreFuelTypes: ['PNL'] },
      { key: 'Custom Grade', cstoreFuelTypes: ['DSL', 'CUSTOM'] },
    ] }),
  };
  const source = readFileSync(new URL('../services/fuelGradePosMapping.js', import.meta.url), 'utf8');
  const context = { require: () => model, module: { exports: {} } };
  runInNewContext(source, context);
  const { ensureCstoreFuelTypes, getCstoreGradeMap: getMap } = context.module.exports;
  await Promise.all([ensureCstoreFuelTypes(), ensureCstoreFuelTypes()]);
  const map = await getMap();

  expect(model.init).toHaveBeenCalledOnce();
  expect(model.updateOne.mock.calls).toEqual([
    ['Regular', 'REG'], ['Premium', 'PNL'], ['Diesel', 'DSL'], ['Dyed Diesel', 'DYED'],
  ].map(([key, code]) => [{ key, cstoreFuelTypes: { $exists: false } }, { $set: { cstoreFuelTypes: [code] } }]));
  expect([...map]).toEqual([
    ['PNL', 'Premium'], ['DSL', 'Custom Grade'], ['CUSTOM', 'Custom Grade'], ['DYED', 'Dyed Diesel'],
  ]);
});

it('uses catalog aliases, retains the MID split, and reports unmapped POS codes', async () => {
  getCstoreGradeMap.mockResolvedValue(new Map([
    ['REG', 'Regular'], ['PNL', 'Premium'], ['DSL', 'Diesel'], ['DYED', 'Dyed Diesel'],
    ['C01', 'Dyed Premium'], ['C02', 'Dyed Premium'],
  ]));
  const latest = '2026-11-20T17:00:00Z';
  rpc.mockResolvedValue({ data: [
    { raw_grade: ' reg ', total_volume: '80' },
    { raw_grade: 'PNL', total_volume: '20' },
    { raw_grade: 'DSL', total_volume: '30' },
    { raw_grade: 'DYED', total_volume: '40' },
    { raw_grade: 'MID', total_volume: '8' },
    { raw_grade: 'MID', total_volume: '2' },
    { raw_grade: 'C01', total_volume: '10' },
    { raw_grade: 'c02', total_volume: '5.25' },
    { raw_grade: 'UNKNOWN', total_volume: '7', last_transaction: latest },
  ] });
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    expect(await getProcessedFuelSales('123', '2026-11-20')).toEqual({
      salesData: [
        { grade: 'Regular', volume: 85 },
        { grade: 'Premium', volume: 25 },
        { grade: 'Diesel', volume: 30 },
        { grade: 'Dyed Diesel', volume: 40 },
        { grade: 'Dyed Premium', volume: 15.25 },
      ],
      lastTransaction: latest,
    });
    expect(warning).toHaveBeenCalledWith('Unmapped CStore fuel types', {
      csoCode: '123', date: '2026-11-20', codes: ['UNKNOWN'],
    });
  } finally {
    warning.mockRestore();
  }
});
