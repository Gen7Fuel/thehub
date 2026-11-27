import { describe, expect, it } from "vitest";
import mongoose from "mongoose";
import stationAuditModels from "../models/station-audits/index.js";
import checklistRevisionService from "../services/stationAuditChecklistRevision.js";

const {
  StationAuditSection,
  StationAuditChecklist,
  StationAuditChecklistRevision,
  StationAuditStatusOptionSet,
  StationAuditDepartment,
  StationAuditRun,
  StationAuditResponse,
  StationAuditIssue,
  StationAuditIssueActivity,
  StationAuditVisitorReportDispatch,
} = stationAuditModels;

const id = () => new mongoose.Types.ObjectId();
const { revisionVersionAfter } = checklistRevisionService;

describe("station audit models", () => {
  it("increments checklist versions through minor and major revisions", () => {
    expect(revisionVersionAfter()).toBe("v1.0");
    expect(revisionVersionAfter("v1.0")).toBe("v1.1");
    expect(revisionVersionAfter("v1.8")).toBe("v1.9");
    expect(revisionVersionAfter("v1.9")).toBe("v2.0");
    expect(revisionVersionAfter("v12.9")).toBe("v13.0");
  });

  it("omits the legacy template key for manually created sections", () => {
    const section = new StationAuditSection({
      name: "Manual section",
      sites: [id()],
      createdBy: id(),
    });

    expect(section.legacyTemplateId).toBeUndefined();
  });

  it("validates the configuration models", () => {
    const userId = id();
    const locationId = id();
    const section = new StationAuditSection({
      name: "Operations",
      sites: [locationId],
      departments: [id()],
      createdBy: userId,
    });
    const department = new StationAuditDepartment({
      name: "Maintenance",
      departmentHead: userId,
      createdBy: userId,
      notificationEmails: ["head@example.com"],
      siteNotifications: [{ site: locationId, emails: ["regional@example.com"] }],
    });
    const optionSet = new StationAuditStatusOptionSet({
      name: "Pass or issue",
      createdBy: userId,
      options: [
        { key: "pass", label: "Pass" },
        { key: "issue", label: "Issue" },
      ],
    });
    const checklist = new StationAuditChecklist({
      section: section._id,
      item: "Inspect fuel pumps",
      frequency: "daily",
      department: department._id,
      statusOptionSet: optionSet._id,
      createdBy: userId,
    });

    expect(section.validateSync()).toBeUndefined();
    expect(department.validateSync()).toBeUndefined();
    expect(department.legacySelectOptionText).toBeUndefined();
    expect(optionSet.validateSync()).toBeUndefined();
    expect(checklist.validateSync()).toBeUndefined();
    expect(checklist.legacyTemplateId).toBeUndefined();
    expect(checklist.legacyItemId).toBeUndefined();
    expect(section.sortOrder).toBe(0);
    expect(checklist.sortOrder).toBe(0);
    expect(section.sectionType).toBe("checklist");
    expect(checklist.auditTypes).toEqual(["store", "visitor"]);
  });

  it("rejects negative section and checklist sort orders", () => {
    const userId = id();
    const section = new StationAuditSection({
      name: "Operations",
      sites: [id()],
      createdBy: userId,
      sortOrder: -1,
    });
    const checklist = new StationAuditChecklist({
      section: id(),
      item: "Inspect fuel pumps",
      frequency: "daily",
      department: id(),
      statusOptionSet: id(),
      createdBy: userId,
      sortOrder: -1,
    });

    expect(section.validateSync()?.errors.sortOrder).toBeDefined();
    expect(checklist.validateSync()?.errors.sortOrder).toBeDefined();
  });

  it("rejects duplicate status keys and site overrides", () => {
    const userId = id();
    const optionSet = new StationAuditStatusOptionSet({
      name: "Duplicate options",
      createdBy: userId,
      options: [
        { key: "issue", label: "Issue" },
        { key: "ISSUE", label: "Issue again" },
      ],
    });
    const department = new StationAuditDepartment({
      name: "Duplicate sites",
      departmentHead: userId,
      createdBy: userId,
      siteNotifications: [{ site: userId }, { site: userId }],
    });

    expect(optionSet.validateSync()?.errors.options).toBeDefined();
    expect(department.validateSync()?.errors.siteNotifications).toBeDefined();
  });

  it("validates execution and issue history models", () => {
    const userId = id();
    const sectionId = id();
    const checklistId = id();
    const checklistRevisionId = id();
    const departmentId = id();
    const run = new StationAuditRun({
      section: sectionId,
      sectionSnapshot: { name: "Operations" },
      site: id(),
      frequency: "daily",
      periodKey: "2026-11-03",
      startedBy: userId,
    });
    const response = new StationAuditResponse({
      run: run._id,
      checklist: checklistId,
      checklistRevision: checklistRevisionId,
      checklistSnapshot: {
        item: "Inspect fuel pumps",
        frequency: "daily",
        department: departmentId,
        departmentName: "Maintenance",
      },
      checked: true,
      checkedAt: new Date(),
      checkedBy: userId,
    });
    const issue = new StationAuditIssue({
      response: response._id,
      run: run._id,
      checklist: checklistId,
      section: sectionId,
      originDepartment: departmentId,
      currentDepartment: departmentId,
      site: id(),
      snapshot: {
        sectionName: "Operations",
        checklistItem: "Inspect fuel pumps",
        departmentName: "Maintenance",
      },
      assignees: [{ user: userId, role: "owner", assignedBy: null }],
      raisedBy: userId,
    });
    const activity = new StationAuditIssueActivity({
      issue: issue._id,
      eventType: "status_changed",
      actor: userId,
      body: "Investigating",
      photos: ["investigation.jpg"],
      changes: [{
        field: "status",
        from: { value: "created", label: "Created" },
        to: { value: "in_progress", label: "In Progress" },
      }],
    });

    expect(run.validateSync()).toBeUndefined();
    expect(response.validateSync()).toBeUndefined();
    expect(issue.validateSync()).toBeUndefined();
    expect(issue.priority).toBe("low");
    expect(issue.assignees[0].read).toBe(false);
    expect(issue.assignees[0].readAt).toBeNull();
    expect(activity.validateSync()).toBeUndefined();

    const viewedActivity = new StationAuditIssueActivity({
      issue: issue._id,
      eventType: "issue_viewed",
      actor: userId,
    });
    expect(viewedActivity.validateSync()).toBeUndefined();

    issue.priority = "urgent";
    expect(issue.validateSync()?.errors.priority).toBeDefined();
  });

  it("validates the per-site Visitor report dispatch ledger", () => {
    const dispatch = new StationAuditVisitorReportDispatch({
      site: id(),
      reportDate: "2026-11-18",
      visitorRuns: [id(), id()],
    });

    expect(dispatch.validateSync()).toBeUndefined();
    expect(dispatch.status).toBe("generating");
    expect(dispatch.attempts).toBe(1);
  });

  it("keeps Store runs shared while scoping Visitor runs by startedBy", () => {
    const indexes = StationAuditRun.schema.indexes();
    const store = indexes.find(([, options]) => options.name === "station_audit_store_run_unique");
    const visitor = indexes.find(([, options]) => options.name === "station_audit_visitor_run_unique");

    expect(store?.[0]).not.toHaveProperty("startedBy");
    expect(store?.[1].partialFilterExpression).toEqual({ type: "store" });
    expect(visitor?.[0]).toHaveProperty("startedBy", 1);
    expect(visitor?.[1].partialFilterExpression).toEqual({ type: "visitor" });
  });

  it("validates checklist revision versions and snapshots", () => {
    const checklistId = id();
    const revision = new StationAuditChecklistRevision({
      checklist: checklistId,
      section: id(),
      version: "v1.0",
      current: true,
      snapshot: {
        item: "Inspect fuel pumps",
        frequency: "daily",
        auditTypes: ["store", "visitor"],
        department: id(),
        statusOptionSet: id(),
        assignedSites: [id()],
        active: true,
      },
      changedBy: id(),
      changeType: "created",
    });

    expect(revision.validateSync()).toBeUndefined();
    revision.version = "1.0";
    expect(revision.validateSync()?.errors.version).toBeDefined();
  });
});
