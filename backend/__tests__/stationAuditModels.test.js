import { describe, expect, it } from "vitest";
import mongoose from "mongoose";
import stationAuditModels from "../models/station-audits/index.js";

const {
  StationAuditSection,
  StationAuditChecklist,
  StationAuditStatusOptionSet,
  StationAuditDepartment,
  StationAuditRun,
  StationAuditResponse,
  StationAuditIssue,
  StationAuditIssueComment,
  StationAuditIssueAssignmentEvent,
} = stationAuditModels;

const id = () => new mongoose.Types.ObjectId();

describe("station audit models", () => {
  it("validates the configuration models", () => {
    const userId = id();
    const locationId = id();
    const section = new StationAuditSection({ name: "Operations", sites: [locationId], createdBy: userId });
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
    expect(optionSet.validateSync()).toBeUndefined();
    expect(checklist.validateSync()).toBeUndefined();
    expect(section.sortOrder).toBe(0);
    expect(checklist.sortOrder).toBe(0);
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
      department: departmentId,
      site: id(),
      snapshot: {
        sectionName: "Operations",
        checklistItem: "Inspect fuel pumps",
        departmentName: "Maintenance",
      },
      assignee: userId,
      raisedBy: userId,
    });
    const comment = new StationAuditIssueComment({ issue: issue._id, author: userId, body: "Investigating" });
    const assignment = new StationAuditIssueAssignmentEvent({
      issue: issue._id,
      assignee: userId,
      assignedBy: userId,
    });

    expect(run.validateSync()).toBeUndefined();
    expect(response.validateSync()).toBeUndefined();
    expect(issue.validateSync()).toBeUndefined();
    expect(comment.validateSync()).toBeUndefined();
    expect(assignment.validateSync()).toBeUndefined();
  });
});
