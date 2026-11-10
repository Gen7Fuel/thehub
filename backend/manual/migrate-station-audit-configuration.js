/**
 * Migrates legacy Station Audit configuration into the v2 collections.
 *
 * This script intentionally does not migrate AuditInstance or AuditItem data.
 * It is safe to rerun: every write is keyed by a legacy source identifier.
 *
 * Run inside the backend container:
 *   node manual/migrate-station-audit-configuration.js
 *   node manual/migrate-station-audit-configuration.js --apply
 *
 * The default mode is a read-only dry run. The apply mode aborts before any
 * writes if a legacy site, status template, department, or creator cannot be
 * resolved. Departments using department-head assignment without a matching
 * Hub user are migrated inactive so they cannot receive new issues accidentally.
 * Station Manager remains active because its assignee is resolved from the site.
 */

require("dotenv").config();
const mongoose = require("mongoose");

const HO_ADMIN_NAME = "HO Admin";
const HO_ADMIN_HEAD_ID = new mongoose.Types.ObjectId("68bf1b4aa1f5bc66c9dd8b72");

const AuditTemplate = require("../models/audit/auditTemplate");
const SelectTemplate = require("../models/audit/selectTemplate");
const Location = require("../models/Location");
const User = require("../models/User");
const {
  StationAuditSection,
  StationAuditChecklist,
  StationAuditStatusOptionSet,
  StationAuditDepartment,
} = require("../models/station-audits");

const apply = process.argv.includes("--apply");
const RESERVED_SELECT_TEMPLATES = new Set(["assigned to", "category", "follow up"]);

const normalize = (value) => String(value || "").trim();
const lookupKey = (value) => normalize(value).toLowerCase();

function splitEmails(...values) {
  return [...new Set(
    values
      .flatMap((value) => String(value || "").split(","))
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  )];
}

function optionKeys(options) {
  const used = new Set();

  return options.map((option, index) => {
    const base = normalize(option.text)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || `option-${index + 1}`;

    let key = base;
    let suffix = 2;
    while (used.has(key)) key = `${base}-${suffix++}`;
    used.add(key);

    return {
      _id: option._id,
      key,
      label: normalize(option.text),
      sortOrder: index,
    };
  });
}

async function loadSourceData() {
  const [templates, selectTemplates, locations, users] = await Promise.all([
    AuditTemplate.find({}).lean(),
    SelectTemplate.find({}).lean(),
    Location.find({}).select("_id stationName site").lean(),
    User.find({}).select("_id email is_active").lean(),
  ]);

  if (!templates.length) throw new Error("No legacy AuditTemplate documents were found");

  const locationByName = new Map();
  for (const location of locations) {
    for (const name of [location.site, location.stationName]) {
      if (!normalize(name)) continue;
      const key = lookupKey(name);
      const existing = locationByName.get(key);
      if (existing && existing._id.toString() !== location._id.toString()) {
        throw new Error(`Multiple Location documents match legacy site name "${name}"`);
      }
      locationByName.set(key, location);
    }
  }

  const selectTemplateByName = new Map(
    selectTemplates.map((template) => [lookupKey(template.name), template])
  );
  const usersByEmail = new Map(
    users
      .filter((user) => normalize(user.email))
      .map((user) => [lookupKey(user.email), user])
  );

  return {
    templates,
    selectTemplates,
    locationByName,
    selectTemplateByName,
    usersByEmail,
  };
}

function buildMigrationDocuments(source) {
  const errors = [];
  const warnings = [];
  const fallbackCreator = source.templates.find((template) => template.createdBy)?.createdBy;

  if (!fallbackCreator) {
    errors.push("No legacy AuditTemplate has a createdBy user to use as the migration actor");
  }

  const assignedToTemplate = source.selectTemplateByName.get("assigned to");
  if (!assignedToTemplate) errors.push('SelectTemplate named "Assigned To" was not found');

  const statusSets = source.selectTemplates
    .filter((template) => !RESERVED_SELECT_TEMPLATES.has(lookupKey(template.name)))
    .map((template) => ({
      name: normalize(template.name),
      description: normalize(template.description),
      options: optionKeys(template.options || []),
      active: true,
      createdBy: template.createdBy || fallbackCreator,
      legacySelectTemplateId: template._id,
    }));

  const statusSetByLegacyName = new Map(
    statusSets.map((statusSet) => [lookupKey(statusSet.name), statusSet])
  );

  const departments = (assignedToTemplate?.options || []).map((option) => {
    const isStationManager = lookupKey(option.text) === "station manager";
    const defaultEmails = splitEmails(option.email, option.cc);
    const departmentHead = defaultEmails
      .map((email) => source.usersByEmail.get(email))
      .find(Boolean)?._id || null;

    const siteNotifications = [];
    for (const override of option.siteOverrides || []) {
      const siteName = normalize(override.site);
      const location = source.locationByName.get(lookupKey(siteName));
      if (!location) {
        errors.push(`Department "${option.text}" references unknown site "${siteName}"`);
        continue;
      }

      // Legacy site overrides replaced defaults. In v2 they are intentionally
      // migrated as additive recipients, matching the new notification policy.
      const emails = splitEmails(override.to, override.cc);
      if (emails.length) {
        siteNotifications.push({ site: location._id, emails });
      }
    }

    if (!isStationManager && !departmentHead) {
      warnings.push(
        `Department "${option.text}" has no legacy email matching a Hub user; migrated inactive`
      );
    }

    return {
      name: normalize(option.text),
      description: "",
      departmentHead,
      members: [],
      defaultIssueAssignees: departmentHead ? [departmentHead] : [],
      assignmentStrategy: isStationManager
        ? "station_manager"
        : "department_head",
      isAdminDepartment: false,
      notificationEmails: defaultEmails,
      siteNotifications,
      active: isStationManager || Boolean(departmentHead),
      createdBy: assignedToTemplate.createdBy || fallbackCreator,
      legacySelectOptionText: normalize(option.text),
    };
  });

  departments.push({
    name: HO_ADMIN_NAME,
    description: "Head office audit administration",
    departmentHead: HO_ADMIN_HEAD_ID,
    members: [],
    defaultIssueAssignees: [HO_ADMIN_HEAD_ID],
    assignmentStrategy: "department_head",
    isAdminDepartment: true,
    notificationEmails: [],
    siteNotifications: [],
    active: true,
    createdBy: fallbackCreator,
    legacySelectOptionText: HO_ADMIN_NAME,
  });

  const departmentByName = new Map(
    departments.map((department) => [lookupKey(department.name), department])
  );
  const sections = [];
  const checklists = [];

  for (const template of source.templates) {
    const sectionType = lookupKey(template.name) === "orders" ? "order" : "checklist";
    const sectionDepartmentNames = new Set();
    const sites = [];
    for (const siteName of template.sites || []) {
      const location = source.locationByName.get(lookupKey(siteName));
      if (!location) errors.push(`Template "${template.name}" references unknown site "${siteName}"`);
      else sites.push(location._id);
    }

    const sectionDocument = {
      name: normalize(template.name),
      description: normalize(template.description),
      sortOrder: 0,
      sectionType,
      sites: [...new Map(sites.map((id) => [id.toString(), id])).values()],
      active: true,
      createdBy: template.createdBy || fallbackCreator,
      legacyTemplateId: template._id,
      departmentLegacyNames: [],
    };
    sections.push(sectionDocument);

    for (const item of template.items || []) {
      const statusSet = statusSetByLegacyName.get(lookupKey(item.statusTemplate));
      const department = departmentByName.get(lookupKey(item.assignedTo));

      if (!statusSet) {
        errors.push(
          `Checklist "${item.item}" in "${template.name}" references missing status template "${item.statusTemplate}"`
        );
      }
      if (!department) {
        errors.push(
          `Checklist "${item.item}" in "${template.name}" references missing department "${item.assignedTo}"`
        );
      }
      if (department?.legacySelectOptionText) {
        sectionDepartmentNames.add(lookupKey(department.legacySelectOptionText));
      }

      const assignedSites = [];
      for (const assignedSite of item.assignedSites || []) {
        const location = source.locationByName.get(lookupKey(assignedSite.site));
        if (!location) {
          errors.push(
            `Checklist "${item.item}" in "${template.name}" references unknown site "${assignedSite.site}"`
          );
          continue;
        }
        if (assignedSite.assigned === true) assignedSites.push(location._id);
      }

      checklists.push({
        legacyTemplateId: template._id,
        legacyItemId: item._id,
        sectionLegacyId: template._id,
        statusSetLegacyId: statusSet?.legacySelectTemplateId,
        departmentLegacyName: department?.legacySelectOptionText,
        item: normalize(item.item),
        description: "",
        sortOrder: 0,
        category: normalize(item.category),
        frequency: item.frequency || "daily",
        auditTypes: sectionType === "order" ? ["store"] : ["store", "visitor"],
        followUp: false,
        commentRequired: item.commentRequired === true,
        requestOrderEnabled: Boolean(item.suppliesVendor),
        suppliesVendor: normalize(item.suppliesVendor),
        assignedSites: [...new Map(assignedSites.map((id) => [id.toString(), id])).values()],
        active: true,
        createdBy: template.createdBy || fallbackCreator,
      });
    }
    sectionDocument.departmentLegacyNames = [
      ...sectionDepartmentNames,
      lookupKey(HO_ADMIN_NAME),
    ];
  }

  sections
    .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: "base" }))
    .forEach((section, index) => {
      section.sortOrder = index;
    });

  const checklistsBySectionFrequency = new Map();
  for (const checklist of checklists) {
    const scopeKey = `${checklist.sectionLegacyId}:${checklist.frequency}`;
    if (!checklistsBySectionFrequency.has(scopeKey)) checklistsBySectionFrequency.set(scopeKey, []);
    checklistsBySectionFrequency.get(scopeKey).push(checklist);
  }
  for (const frequencyChecklists of checklistsBySectionFrequency.values()) {
    frequencyChecklists
      .sort((left, right) => left.item.localeCompare(right.item, undefined, { sensitivity: "base" }))
      .forEach((checklist, index) => {
        checklist.sortOrder = index;
      });
  }

  return { statusSets, departments, sections, checklists, errors, warnings };
}

async function upsertDocuments(documents) {
  const statusIds = new Map();
  for (const document of documents.statusSets) {
    const saved = await StationAuditStatusOptionSet.findOneAndUpdate(
      { legacySelectTemplateId: document.legacySelectTemplateId },
      { $set: document },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
    statusIds.set(document.legacySelectTemplateId.toString(), saved._id);
  }

  const departmentIds = new Map();
  for (const document of documents.departments) {
    const saved = await StationAuditDepartment.findOneAndUpdate(
      { legacySelectOptionText: document.legacySelectOptionText },
      { $set: document },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
    departmentIds.set(lookupKey(document.legacySelectOptionText), saved._id);
  }

  const sectionIds = new Map();
  for (const sourceSection of documents.sections) {
    const { departmentLegacyNames, ...document } = sourceSection;
    const saved = await StationAuditSection.findOneAndUpdate(
      { legacyTemplateId: document.legacyTemplateId },
      {
        $set: {
          ...document,
          departments: departmentLegacyNames
            .map((name) => departmentIds.get(name))
            .filter(Boolean),
        },
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
    sectionIds.set(document.legacyTemplateId.toString(), saved._id);
  }

  for (const sourceChecklist of documents.checklists) {
    const {
      sectionLegacyId,
      statusSetLegacyId,
      departmentLegacyName,
      ...document
    } = sourceChecklist;

    await StationAuditChecklist.findOneAndUpdate(
      {
        legacyTemplateId: document.legacyTemplateId,
        legacyItemId: document.legacyItemId,
      },
      {
        $set: {
          ...document,
          section: sectionIds.get(sectionLegacyId.toString()),
          statusOptionSet: statusIds.get(statusSetLegacyId.toString()),
          department: departmentIds.get(lookupKey(departmentLegacyName)),
        },
        $unset: { followUpInstructions: "" },
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
  }
}

async function removeObsoleteChecklistIndexes() {
  let indexes;
  try {
    indexes = await StationAuditChecklist.collection.indexes();
  } catch (error) {
    // A completely fresh database may not have created the collection yet.
    if (error?.code === 26 || error?.codeName === "NamespaceNotFound") return;
    throw error;
  }

  const parallelArrayIndexes = indexes.filter(
    (index) => index.key?.assignedSites && index.key?.auditTypes
  );
  for (const index of parallelArrayIndexes) {
    await StationAuditChecklist.collection.dropIndex(index.name);
    console.log(`Removed obsolete checklist index: ${index.name}`);
  }
}

async function run() {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is not configured");
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Connected to MongoDB (${apply ? "APPLY" : "dry run"})`);

  const source = await loadSourceData();
  const documents = buildMigrationDocuments(source);

  console.log("\nMigration summary:");
  console.log(`  StationAuditSection:         ${documents.sections.length}`);
  console.log(`  StationAuditChecklist:       ${documents.checklists.length}`);
  console.log(`  StationAuditStatusOptionSet: ${documents.statusSets.length}`);
  console.log(`  StationAuditDepartment:      ${documents.departments.length}`);

  if (documents.warnings.length) {
    console.warn("\nWarnings:");
    documents.warnings.forEach((warning) => console.warn(`  - ${warning}`));
  }

  if (documents.errors.length) {
    console.error("\nMigration blocked:");
    documents.errors.forEach((error) => console.error(`  - ${error}`));
    throw new Error(`Preflight failed with ${documents.errors.length} error(s); no data was written`);
  }

  if (!apply) {
    console.log("\nDry run complete. Re-run with --apply to write the configuration.");
    return;
  }

  await removeObsoleteChecklistIndexes();
  await upsertDocuments(documents);
  console.log("\nConfiguration migration complete. Legacy collections were not modified.");
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
