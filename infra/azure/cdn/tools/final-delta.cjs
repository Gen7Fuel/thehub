// Frozen Blob-to-Blob reconciliation. Library only: importing never mutates storage.
// Full plans/receipts contain media identifiers and must remain private.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { inventory, manifest, copyAndVerify, OWNER } = require('../../../../cdn/scripts/copy-media.cjs');

async function planFinalDelta(source, destination) {
  const files = await inventory(source);
  assert.ok(files.length, 'Refusing an empty final source');
  const target = await inventory(destination);
  for (const file of target) assert.equal(file.metadata.erpmediacopy, OWNER, 'Unmanaged destination; review required');
  const names = new Set(files.map(file => file.name));
  const plan = { version: 1, source: files, destination: target,
    deletions: target.filter(file => !names.has(file.name)), sourceManifest: manifest(files) };
  // Includes every ETag, date and checksum: a reviewed plan cannot silently
  // change if either side is modified before execution.
  const canonical = list => list.map(file => [file.name, file.etag, file.size, file.sha256, file.originalmtime, file.contentType]);
  plan.digest = crypto.createHash('sha256').update(JSON.stringify([canonical(files), canonical(target)])).digest('hex');
  return plan;
}

async function finalize({ source, destination, sign, approvedDigest, approvedDeleteCount,
  checkFence, retainPlan, receipt, report, concurrency = 4 }) {
  assert.equal(typeof checkFence, 'function', 'Writer fencing check required');
  assert.equal(typeof retainPlan, 'function', 'Private verified plan retention required');
  const fence = async () => assert.equal(await checkFence(), true, 'Writers must remain paused and drained');
  await fence();
  const plan = await planFinalDelta(source, destination);
  assert.equal(plan.digest, approvedDigest, 'Reviewed plan changed; re-plan required');
  assert.equal(plan.deletions.length, approvedDeleteCount, 'Reviewed deletion count differs');
  const retained = await retainPlan(plan);
  assert.ok(retained?.verified === true && retained.digest === plan.digest, 'Private plan readback must be verified');
  // Repeat inventory after retention so no stale plan authorizes mutations.
  assert.equal((await planFinalDelta(source, destination)).digest, plan.digest, 'Storage changed after plan retention');
  for (const file of plan.deletions) {
    await fence();
    await destination.getBlobClient(file.name).delete({ conditions: { ifMatch: file.etag } });
  }
  const result = await copyAndVerify({ source, destination, sign, concurrency, receipt, report, beforeWrite: fence });
  await fence();
  assert.equal(result.sourceUnchanged, true, 'Source changed during final delta');
  assert.equal(result.manifestSha256, plan.sourceManifest, 'Source changed after reviewed plan');
  return { ...result, phase: 'frozen-delta-verified', reviewedPlanDigest: plan.digest,
    deleted: plan.deletions.length, productionCutover: false, finalDeltaRequired: false };
}

module.exports = { planFinalDelta, finalize };
