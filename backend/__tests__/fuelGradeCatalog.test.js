import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import FuelGrade from '../models/fuel/FuelGrade.js';
import { hasEffectiveAccess } from '../middleware/authMiddleware.js';

vi.mock('../models/User.js', () => ({ default: {} }));
vi.mock('../models/Maintenance.js', () => ({ default: {} }));
vi.mock('../utils/permissionStore.js', () => ({
  default: { getPermissionMap: () => new Map() },
}));

function loadGradeRouter(model = FuelGrade) {
  const router = { use: vi.fn(), get: vi.fn(), post: vi.fn(), patch: vi.fn() };
  const permissionMap = new Map([
    ['fuelManagement.manage', 12000], ['fuelManagement.manage.grades', 12001], ['fuelManagement.createOrder', 12002],
    ['fuelManagement.workspace', 12003], ['fuelManagement.orderPipeline', 12004],
    ['fuelManagement.volume', 12005], ['fuelManagement.statistics', 12006],
  ]);
  const dependencies = {
    express: { Router: () => router },
    mongoose: {},
    '../../models/fuel/FuelGrade': model,
    '../../services/fuelGradePosMapping': { ensureCstoreFuelTypes: async () => {} },
    '../../middleware/authMiddleware': { hasEffectiveAccess },
    '../../utils/permissionStore': { getPermissionMap: () => permissionMap },
    '../../middleware/changeLogger': { logChange: vi.fn() },
  };
  const source = readFileSync(new URL('../routes/fuel/fuelGradeRoutes.js', import.meta.url), 'utf8');
  runInNewContext(source, { require: (name) => dependencies[name], module: { exports: {} } });
  return router;
}

describe('Fuel grade catalog', () => {
  it('normalizes CStore codes and rejects duplicates and the reserved MID code', () => {
    const grade = new FuelGrade({
      key: 'Regular', name: 'Regular', shortName: 'RUL', color: '#475569', sortOrder: 1,
      cstoreFuelTypes: [' reg ', 'alt'],
    });

    expect(grade.cstoreFuelTypes).toEqual(['REG', 'ALT']);
    expect(grade.validateSync()).toBeUndefined();
    grade.cstoreFuelTypes = ['REG', 'reg'];
    expect(grade.validateSync().errors.cstoreFuelTypes.message).toMatch(/distinct/);
    grade.cstoreFuelTypes = ['mid'];
    expect(grade.validateSync().errors['cstoreFuelTypes.0'].message).toMatch(/MID is reserved/);
  });

  it('validates display metadata and keeps the original grade key on rename', () => {
    const grade = FuelGrade.hydrate({
      key: 'E15', name: 'E15', shortName: 'E15', color: '#475569', sortOrder: 20, active: true,
    });
    grade.set({ key: 'new-key', name: 'E15 gasoline', color: 'invalid', sortOrder: 1.5 });

    expect(grade.key).toBe('E15');
    expect(grade.name).toBe('E15 gasoline');
    expect(Object.keys(grade.validateSync().errors)).toEqual(expect.arrayContaining(['color', 'sortOrder']));
  });

  it('requires the catalog permission from the user record even without a permission header', () => {
    const router = loadGradeRouter();
    const [[guard]] = router.use.mock.calls;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();
    const req = { user: { role: { permissionsArray: [{ permId: 12001, value: true }] } } };

    guard(req, res, next);
    expect(next).toHaveBeenCalledOnce();

    req.user.customPermissionsArray = [{ permId: 12001, value: false }];
    guard(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: 'Access denied for fuelManagement.manage.grades' });
    expect(next).toHaveBeenCalledOnce();
  });

  it.each([12000, 12002, 12003, 12004, 12005, 12006])('lets permission %i read grade options without granting catalog administration', async (permId) => {
    const grades = [{ key: 'E15', name: 'E15', shortName: 'E15', color: '#475569', active: true }];
    const find = vi.fn().mockReturnValue({ sort: () => ({ lean: async () => grades }) });
    const router = loadGradeRouter({ find });
    const [, listOptions] = router.get.mock.calls.find(([path]) => path === '/options');
    const [[adminGuard]] = router.use.mock.calls;
    const req = { user: { role: { permissionsArray: [{ permId, value: true }] } } };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    await listOptions(req, res);
    expect(find).toHaveBeenCalledWith({}, 'key name shortName color active -_id');
    expect(res.json).toHaveBeenCalledWith(grades);

    adminGuard(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
