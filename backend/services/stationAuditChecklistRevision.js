const {
  StationAuditChecklist,
  StationAuditChecklistRevision,
} = require("../models/station-audits");

function revisionVersionAfter(version) {
  const match = /^v([1-9]\d*)\.([0-9])$/.exec(String(version || ""));
  if (!match) return "v1.0";
  const major = Number(match[1]);
  const minor = Number(match[2]);
  return minor === 9 ? `v${major + 1}.0` : `v${major}.${minor + 1}`;
}

function checklistSnapshot(checklist) {
  return {
    item: checklist.item,
    description: checklist.description || "",
    sortOrder: checklist.sortOrder ?? null,
    category: checklist.category || "",
    frequency: checklist.frequency,
    auditTypes: checklist.auditTypes || [],
    department: checklist.department,
    statusOptionSet: checklist.statusOptionSet,
    followUp: checklist.followUp === true,
    commentRequired: checklist.commentRequired === true,
    requestOrderEnabled: checklist.requestOrderEnabled === true,
    suppliesVendor: checklist.suppliesVendor || "",
    assignedSites: checklist.assignedSites || [],
    active: checklist.active === true,
  };
}

function revisionScopeKeys(checklist) {
  return (checklist.assignedSites || []).flatMap((site) =>
    (checklist.auditTypes || []).map((type) => `${site}:${type}`)
  );
}

async function createChecklistRevision(checklistOrId, { changedBy, changeType = "updated", at = new Date() } = {}) {
  const checklist = typeof checklistOrId === "object" && checklistOrId.item
    ? checklistOrId
    : await StationAuditChecklist.findById(checklistOrId).lean();
  if (!checklist) throw new Error("Cannot revise a missing Station Audit checklist");

  const current = await StationAuditChecklistRevision.findOne({
    checklist: checklist._id,
    current: true,
  }).sort({ createdAt: -1 });
  const version = revisionVersionAfter(current?.version);

  const revision = await StationAuditChecklistRevision.create({
    checklist: checklist._id,
    section: checklist.section,
    version,
    current: false,
    effectiveFrom: at,
    effectiveTo: null,
    snapshot: checklistSnapshot(checklist),
    scopeKeys: revisionScopeKeys(checklist),
    changedBy: changedBy || checklist.createdBy,
    changeType,
  });

  if (current) {
    await StationAuditChecklistRevision.updateOne(
      { _id: current._id, current: true },
      { $set: { current: false, effectiveTo: at } }
    );
  }
  await StationAuditChecklistRevision.updateOne(
    { _id: revision._id },
    { $set: { current: true } }
  );
  return StationAuditChecklistRevision.findById(revision._id);
}

module.exports = {
  checklistSnapshot,
  createChecklistRevision,
  revisionScopeKeys,
  revisionVersionAfter,
};
