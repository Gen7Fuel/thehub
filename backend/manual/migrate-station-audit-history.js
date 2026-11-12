/**
 * Migrates recent legacy Station Audit history into the v2 run/response and
 * issue collections. Run the configuration migration first.
 *
 * Scope (America/Toronto calendar boundaries):
 *   - 2026-11-01 onward: completed instances and all their items.
 *   - 2026-10-01 onward: every still-open store issue. For an October
 *     instance, only the open issue item is copied into responses.
 *
 * The default mode is a read-only dry run:
 *   node manual/migrate-station-audit-history.js
 *   node manual/migrate-station-audit-history.js --apply
 *
 * The migration never modifies legacy collections and does not send emails,
 * enqueue orders, write access logs, or emit socket events.
 */

require("dotenv").config();
const mongoose = require("mongoose");

const AuditInstance = require("../models/audit/auditInstance");
const AuditItem = require("../models/audit/auditItem");
const Location = require("../models/Location");
const User = require("../models/User");
const {
  StationAuditSection,
  StationAuditChecklist,
  StationAuditStatusOptionSet,
  StationAuditDepartment,
  StationAuditRun,
  StationAuditResponse,
  StationAuditIssue,
  StationAuditIssueActivity,
} = require("../models/station-audits");

const apply = process.argv.includes("--apply");
// Midnight in America/Toronto. Toronto is UTC-4 on both cutoff dates in 2026.
const OPEN_ISSUE_CUTOFF = new Date("2026-10-01T04:00:00.000Z");
const HISTORY_CUTOFF = new Date("2026-11-01T04:00:00.000Z");
const OPEN_STATUSES = new Set(["created", "in_progress", "on_hold"]);

const normalize = (value) => String(value ?? "").trim();
const key = (value) => normalize(value).toLowerCase();
const id = (value) => String(value?._id || value || "");

function uniqueIds(values) {
  return [...new Map(values.filter(Boolean).map((value) => [id(value), value])).values()];
}

function statusKey(value) {
  return key(value).replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function normalizeIssueStatus(value) {
  const normalized = statusKey(value);
  if (normalized === "in_progress" || normalized === "inprogress") return "in_progress";
  if (normalized === "on_hold" || normalized === "onhold") return "on_hold";
  if (normalized === "resolved" || normalized === "completed") return "resolved";
  return "created";
}

function isOpenIssue(item) {
  return item.issueRaised === true && normalizeIssueStatus(item.currentIssueStatus) !== "resolved";
}

function instanceTime(instance) {
  return instance.completedAt ? new Date(instance.completedAt).getTime() : 0;
}

function activityTimeline(item, fallbackDate) {
  const entries = (item.issueStatus || [])
    .map((entry, sourceIndex) => ({
      status: normalizeIssueStatus(entry.status),
      timestamp: entry.timestamp ? new Date(entry.timestamp) : null,
      sourceIndex,
    }))
    .filter((entry) => OPEN_STATUSES.has(entry.status))
    .sort((left, right) => {
      const timeDifference = (left.timestamp?.getTime() || 0) - (right.timestamp?.getTime() || 0);
      return timeDifference || left.sourceIndex - right.sourceIndex;
    });

  const compact = [];
  for (const entry of entries) {
    if (compact.at(-1)?.status === entry.status) continue;
    compact.push(entry);
  }

  if (!compact.length || compact[0].status !== "created") {
    compact.unshift({ status: "created", timestamp: fallbackDate, sourceIndex: -1 });
  }
  for (const entry of compact) {
    if (!entry.timestamp) entry.timestamp = fallbackDate;
  }
  return compact;
}

async function activeUsersByIds(userIds) {
  const orderedIds = uniqueIds(userIds).filter((userId) => mongoose.isValidObjectId(userId));
  if (!orderedIds.length) return [];
  const users = await User.find({ _id: { $in: orderedIds }, is_active: true })
    .select("_id email firstName lastName")
    .lean();
  const usersById = new Map(users.map((user) => [id(user), user]));
  return orderedIds.map((userId) => usersById.get(id(userId))).filter(Boolean);
}

async function activeAdminHeads() {
  const departments = await StationAuditDepartment.find({
    isAdminDepartment: true,
    active: true,
    departmentHead: { $ne: null },
  }).select("departmentHead").lean();
  return activeUsersByIds(departments.map((department) => department.departmentHead));
}

async function fallbackAssignees(department) {
  const defaults = await activeUsersByIds(department.defaultIssueAssignees || []);
  if (defaults.length) return defaults;
  const heads = await activeUsersByIds([department.departmentHead]);
  if (heads.length) return heads;
  const admins = await activeAdminHeads();
  return admins.length ? [admins[0]] : [];
}

async function initialAssignees(department, location) {
  if (department.assignmentStrategy === "station_manager") {
    const emails = [...(location.managerEmails || []), location.email]
      .map((email) => key(email))
      .filter(Boolean);
    if (emails.length) {
      const users = await User.find({
        email: { $in: emails.map((email) => new RegExp(`^${email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i")) },
        is_active: true,
      }).select("_id email firstName lastName").lean();
      const usersByEmail = new Map(users.map((user) => [key(user.email), user]));
      const ordered = uniqueIds(emails.map((email) => usersByEmail.get(email)).filter(Boolean));
      if (ordered.length) return ordered;
    }
  }
  return fallbackAssignees(department);
}

async function loadConfiguration() {
  const [sections, checklists, optionSets, departments, locations] = await Promise.all([
    StationAuditSection.find({ legacyTemplateId: { $exists: true } }).lean(),
    StationAuditChecklist.find({
      legacyTemplateId: { $exists: true },
      legacyItemId: { $exists: true },
    }).lean(),
    StationAuditStatusOptionSet.find({}).lean(),
    StationAuditDepartment.find({}).lean(),
    Location.find({}).select("_id stationName site email managerEmails").lean(),
  ]);

  const locationByName = new Map();
  for (const location of locations) {
    for (const name of [location.site, location.stationName]) {
      if (key(name)) locationByName.set(key(name), location);
    }
  }

  return {
    sectionByTemplate: new Map(sections.map((section) => [id(section.legacyTemplateId), section])),
    checklistByLegacyItem: new Map(checklists.map((checklist) => [id(checklist.legacyItemId), checklist])),
    checklistsByTemplate: checklists.reduce((map, checklist) => {
      const templateId = id(checklist.legacyTemplateId);
      if (!map.has(templateId)) map.set(templateId, []);
      map.get(templateId).push(checklist);
      return map;
    }, new Map()),
    optionSetById: new Map(optionSets.map((optionSet) => [id(optionSet), optionSet])),
    departmentById: new Map(departments.map((department) => [id(department), department])),
    departmentByName: new Map(departments.map((department) => [key(department.legacySelectOptionText || department.name), department])),
    locationByName,
  };
}

function matchChecklist(instance, item, config) {
  const candidates = (config.checklistsByTemplate.get(id(instance.template)) || []).filter(
    (checklist) => key(checklist.item) === key(item.item) && checklist.frequency === item.frequency
  );
  return candidates.length === 1 ? candidates[0] : null;
}

function selectedStatus(item, checklist, config, warnings) {
  const optionSet = config.optionSetById.get(id(checklist.statusOptionSet));
  const wanted = key(item.status);
  const option = (optionSet?.options || []).find(
    (candidate) => key(candidate.label) === wanted || key(candidate.key) === wanted
  );
  if (wanted && !option) {
    warnings.push(`Status "${item.status}" was not found in option set "${optionSet?.name || checklist.statusOptionSet}" for "${item.item}"; preserved as a label`);
  }
  return {
    optionSet: optionSet?._id || checklist.statusOptionSet || null,
    optionId: option?._id || null,
    key: option?.key || statusKey(item.status),
    label: option?.label || normalize(item.status),
  };
}

async function loadLegacyData() {
  const instances = await AuditInstance.find({
    completedAt: { $gte: OPEN_ISSUE_CUTOFF, $ne: null },
  }).sort({ completedAt: 1, _id: 1 }).lean();
  const items = instances.length
    ? await AuditItem.find({ instance: { $in: instances.map((instance) => instance._id) } }).lean()
    : [];
  const itemsByInstance = items.reduce((map, item) => {
    const instanceId = id(item.instance);
    if (!map.has(instanceId)) map.set(instanceId, []);
    map.get(instanceId).push(item);
    return map;
  }, new Map());
  return { instances, items, itemsByInstance };
}

async function occurrenceNumbers(config) {
  const issueItems = await AuditItem.find({ issueRaised: true }).lean();
  if (!issueItems.length) return new Map();
  const instances = await AuditInstance.find({
    _id: { $in: uniqueIds(issueItems.map((item) => item.instance)) },
  }).select("_id template site completedAt").lean();
  const instanceById = new Map(instances.map((instance) => [id(instance), instance]));
  const grouped = new Map();

  for (const item of issueItems) {
    const instance = instanceById.get(id(item.instance));
    const checklist = instance && matchChecklist(instance, item, config);
    const location = instance && config.locationByName.get(key(instance.site));
    if (!instance || !checklist || !location) continue;
    const pair = `${id(checklist)}:${id(location)}`;
    if (!grouped.has(pair)) grouped.set(pair, []);
    grouped.get(pair).push({ item, instance });
  }

  const result = new Map();
  for (const entries of grouped.values()) {
    entries.sort((left, right) => {
      const difference = instanceTime(left.instance) - instanceTime(right.instance);
      return difference || id(left.item).localeCompare(id(right.item));
    });
    entries.forEach((entry, index) => result.set(id(entry.item), index + 1));
  }
  return result;
}

function buildPlan(legacy, config, occurrences) {
  const errors = [];
  const warnings = [];
  const runs = [];
  const responses = [];
  const issues = [];
  const skipped = { beforeNovemberWithoutOpenIssue: 0, visitorOpenIssue: 0 };

  for (const instance of legacy.instances) {
    const allItems = legacy.itemsByInstance.get(id(instance)) || [];
    const fullHistory = new Date(instance.completedAt) >= HISTORY_CUTOFF;
    const openItems = allItems.filter(isOpenIssue);
    if (!fullHistory && !openItems.length) {
      skipped.beforeNovemberWithoutOpenIssue += 1;
      continue;
    }

    const section = config.sectionByTemplate.get(id(instance.template));
    const location = config.locationByName.get(key(instance.site));
    if (!section) errors.push(`Instance ${instance._id}: no migrated section for template ${instance.template}`);
    if (!location) errors.push(`Instance ${instance._id}: no Location matches site "${instance.site}"`);
    if (!instance.completedBy) errors.push(`Instance ${instance._id}: completedBy is missing`);
    if (!section || !location || !instance.completedBy) continue;

    const selectedItems = fullHistory ? allItems : openItems;
    const mappedItems = [];
    for (const item of selectedItems) {
      const checklist = matchChecklist(instance, item, config);
      if (!checklist) {
        errors.push(`Item ${item._id} ("${item.item}", ${item.frequency}) in instance ${instance._id}: checklist mapping is missing or ambiguous`);
        continue;
      }
      const department = config.departmentByName.get(key(item.assignedTo))
        || config.departmentById.get(id(checklist.department));
      if (!department) {
        errors.push(`Item ${item._id} ("${item.item}"): department "${item.assignedTo}" was not found`);
        continue;
      }
      mappedItems.push({ item, checklist, department });
    }
    if (!mappedItems.length) continue;

    const earliestCheckedAt = mappedItems
      .map(({ item }) => item.checkedAt && new Date(item.checkedAt))
      .filter(Boolean)
      .sort((left, right) => left - right)[0];
    const runKey = `${id(section)}:${id(location)}:${instance.frequency}:${instance.periodKey}:${instance.type}`;
    const run = {
      source: instance,
      naturalKey: runKey,
      document: {
        section: section._id,
        sectionSnapshot: { name: section.name, description: section.description || "" },
        site: location._id,
        frequency: instance.frequency,
        periodKey: instance.periodKey,
        type: instance.type || "store",
        state: "completed",
        startedBy: instance.completedBy,
        startedAt: earliestCheckedAt || instance.completedAt,
        completedBy: instance.completedBy,
        completedAt: instance.completedAt,
      },
    };
    runs.push(run);

    for (const { item, checklist, department } of mappedItems) {
      const status = selectedStatus(item, checklist, config, warnings);
      const response = {
        source: item,
        run,
        checklist,
        department,
        document: {
          checklist: checklist._id,
          checklistSnapshot: {
            item: normalize(item.item) || checklist.item,
            description: checklist.description || "",
            category: normalize(item.category) || checklist.category || "",
            frequency: item.frequency || checklist.frequency,
            department: department._id,
            departmentName: department.name,
          },
          checked: item.checked === true,
          checkedAt: item.checkedAt || null,
          checkedBy: item.checked ? instance.completedBy : null,
          selectedStatus: status,
          comment: normalize(item.comment),
          photos: (item.photos || []).map(normalize).filter(Boolean),
          requestOrder: item.requestOrder === true,
          orderCreated: item.orderCreated === true,
          issueRaised: item.issueRaised === true,
        },
      };
      responses.push(response);

      if (isOpenIssue(item)) {
        if ((instance.type || "store") !== "store") {
          skipped.visitorOpenIssue += 1;
          continue;
        }
        const fallbackDate = item.checkedAt || instance.completedAt;
        const timeline = activityTimeline(item, fallbackDate);
        issues.push({
          source: item,
          response,
          run,
          section,
          location,
          checklist,
          department,
          timeline,
          occurrenceNumber: occurrences.get(id(item)) || 1,
          raisedAt: timeline[0]?.timestamp || fallbackDate,
        });
      }
    }
  }

  return { runs, responses, issues, errors, warnings, skipped };
}

async function preflightAssignments(plan) {
  for (const issue of plan.issues) {
    const assignees = await initialAssignees(issue.department, issue.location);
    if (!assignees.length) {
      plan.errors.push(
        `Open issue item ${issue.source._id} ("${issue.source.item}"): no active default assignee, department head, station manager, or HO Admin head could be resolved`
      );
    }
  }
}

async function applyPlan(plan) {
  const savedRuns = new Map();
  for (const run of plan.runs) {
    const filter = {
      section: run.document.section,
      site: run.document.site,
      frequency: run.document.frequency,
      periodKey: run.document.periodKey,
      type: run.document.type,
    };
    const saved = await StationAuditRun.findOneAndUpdate(
      filter,
      { $set: run.document },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
    savedRuns.set(run.naturalKey, saved);
  }

  const savedResponses = new Map();
  for (const response of plan.responses) {
    const run = savedRuns.get(response.run.naturalKey);
    const saved = await StationAuditResponse.findOneAndUpdate(
      { run: run._id, checklist: response.checklist._id },
      { $set: { ...response.document, run: run._id } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
    savedResponses.set(id(response.source), saved);
  }

  const priorMigratedIssueByPair = new Map();
  for (const entry of [...plan.issues].sort((left, right) => left.raisedAt - right.raisedAt)) {
    const run = savedRuns.get(entry.run.naturalKey);
    const response = savedResponses.get(id(entry.source));
    const assigneeUsers = await initialAssignees(entry.department, entry.location);
    const pair = `${id(entry.checklist)}:${id(entry.location)}`;
    const previousIssue = priorMigratedIssueByPair.get(pair) || null;
    const issueDocument = {
      response: response._id,
      run: run._id,
      checklist: entry.checklist._id,
      section: entry.section._id,
      originDepartment: entry.department._id,
      currentDepartment: entry.department._id,
      site: entry.location._id,
      snapshot: {
        sectionName: entry.section.name,
        checklistItem: response.checklistSnapshot.item,
        category: response.checklistSnapshot.category,
        departmentName: entry.department.name,
        statusKey: response.selectedStatus.key,
        statusLabel: response.selectedStatus.label,
        originalComment: response.comment,
        originalPhotos: response.photos,
      },
      status: normalizeIssueStatus(entry.source.currentIssueStatus),
      // Legacy audits did not track priority. Keep the migration deterministic
      // and update previously migrated issue documents when --apply is rerun.
      priority: "low",
      assignees: assigneeUsers.map((user, index) => ({
        user: user._id,
        role: index === 0 ? "owner" : "collaborator",
        assignedBy: null,
        assignedAt: entry.raisedAt,
      })),
      previousIssue,
      occurrenceNumber: entry.occurrenceNumber,
      raisedBy: run.completedBy,
      raisedAt: entry.raisedAt,
      resolvedBy: null,
      resolvedAt: null,
    };
    const issue = await StationAuditIssue.findOneAndUpdate(
      { response: response._id },
      { $set: issueDocument },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
    priorMigratedIssueByPair.set(pair, issue._id);
    await StationAuditResponse.updateOne({ _id: response._id }, { $set: { issue: issue._id } });

    for (let index = 0; index < entry.timeline.length; index += 1) {
      const timelineEntry = entry.timeline[index];
      const previousStatus = index ? entry.timeline[index - 1].status : "";
      const dedupeKey = `legacy-history:${response._id}:status:${index}:${timelineEntry.status}`;
      const activityDocument = {
        issue: issue._id,
        eventType: index === 0 ? "issue_raised" : "status_changed",
        actor: null,
        body: index === 0 ? response.comment : "Migrated from legacy audit issue history",
        photos: index === 0 ? response.photos : [],
        changes: [{
          field: "status",
          from: previousStatus ? { value: previousStatus, label: previousStatus.replace(/_/g, " ") } : {},
          to: { value: timelineEntry.status, label: timelineEntry.status.replace(/_/g, " ") },
        }],
        dedupeKey,
        createdAt: timelineEntry.timestamp,
        updatedAt: timelineEntry.timestamp,
      };
      await StationAuditIssueActivity.findOneAndUpdate(
        { dedupeKey },
        { $set: activityDocument },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true, timestamps: false }
      );
    }
  }
}

function printPlan(plan) {
  const octoberRuns = plan.runs.filter((run) => new Date(run.source.completedAt) < HISTORY_CUTOFF).length;
  const novemberRuns = plan.runs.length - octoberRuns;
  const octoberResponses = plan.responses.filter(
    (response) => new Date(response.run.source.completedAt) < HISTORY_CUTOFF
  ).length;
  console.log("\nHistorical migration preview:");
  console.log(`  November+ full-history runs:       ${novemberRuns}`);
  console.log(`  October open-issue-only runs:      ${octoberRuns}`);
  console.log(`  Responses:                         ${plan.responses.length}`);
  console.log(`    October issue-only responses:    ${octoberResponses}`);
  console.log(`  Open issues:                       ${plan.issues.length}`);
  console.log(`  Issue activities:                  ${plan.issues.reduce((total, issue) => total + issue.timeline.length, 0)}`);
  console.log(`  Skipped Oct instances/no issue:    ${plan.skipped.beforeNovemberWithoutOpenIssue}`);
  console.log(`  Skipped visitor open issues:       ${plan.skipped.visitorOpenIssue}`);

  if (plan.warnings.length) {
    console.warn("\nWarnings:");
    plan.warnings.slice(0, 100).forEach((warning) => console.warn(`  - ${warning}`));
    if (plan.warnings.length > 100) console.warn(`  - ...and ${plan.warnings.length - 100} more`);
  }
  if (plan.errors.length) {
    console.error("\nMigration blocked:");
    plan.errors.slice(0, 100).forEach((error) => console.error(`  - ${error}`));
    if (plan.errors.length > 100) console.error(`  - ...and ${plan.errors.length - 100} more`);
  }
}

async function run() {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is not configured");
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Connected to MongoDB (${apply ? "APPLY" : "dry run"})`);
  console.log(`Open issue cutoff: ${OPEN_ISSUE_CUTOFF.toISOString()} (Oct 1 Toronto)`);
  console.log(`History cutoff:    ${HISTORY_CUTOFF.toISOString()} (Nov 1 Toronto)`);

  const config = await loadConfiguration();
  const [legacy, occurrences] = await Promise.all([
    loadLegacyData(),
    occurrenceNumbers(config),
  ]);
  const plan = buildPlan(legacy, config, occurrences);
  await preflightAssignments(plan);
  printPlan(plan);

  if (plan.errors.length) {
    throw new Error(`Preflight failed with ${plan.errors.length} mapping error(s); no data was written`);
  }
  if (!apply) {
    console.log("\nDry run complete. Re-run with --apply to write the historical migration.");
    return;
  }

  await applyPlan(plan);
  console.log("\nHistorical migration complete. Legacy collections were not modified.");
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
