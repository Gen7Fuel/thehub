const FuelGrade = require('../models/fuel/FuelGrade');

const legacyCodes = new Map([
  ['REG', 'Regular'],
  ['PNL', 'Premium'],
  ['DSL', 'Diesel'],
  ['DYED', 'Dyed Diesel'],
]);

let backfillPromise;

function ensureCstoreFuelTypes() {
  if (!backfillPromise) {
    backfillPromise = (async () => {
      await FuelGrade.init();
      await Promise.all([...legacyCodes].map(([code, key]) =>
        FuelGrade.updateOne(
          { key, cstoreFuelTypes: { $exists: false } },
          { $set: { cstoreFuelTypes: [code] } },
        ),
      ));
    })().catch(error => {
      backfillPromise = undefined;
      throw error;
    });
  }
  return backfillPromise;
}

async function getCstoreGradeMap() {
  await ensureCstoreFuelTypes();
  const grades = await FuelGrade.find({}, 'key cstoreFuelTypes -_id').lean();
  const gradeByCode = new Map();

  for (const grade of grades) {
    for (const code of grade.cstoreFuelTypes ?? []) {
      gradeByCode.set(code, grade.key);
    }
  }

  // Keep legacy imports working in environments where the catalog is still being set up.
  const catalogKeys = new Set(grades.map(grade => grade.key));
  for (const [code, key] of legacyCodes) {
    if (!catalogKeys.has(key) && !gradeByCode.has(code)) gradeByCode.set(code, key);
  }
  return gradeByCode;
}

module.exports = { ensureCstoreFuelTypes, getCstoreGradeMap };
