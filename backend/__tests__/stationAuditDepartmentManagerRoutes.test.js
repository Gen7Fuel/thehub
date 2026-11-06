import { describe, expect, it } from "vitest";
import mongoose from "mongoose";
import departmentRouteModule from "../routes/station-audits/manager/departmentRoutes.js";

const { membershipFilter, normalizeDepartmentUpdate, normalizeDepartmentCreate, requiredPermission } = departmentRouteModule;

describe("station audit department access scope", () => {
  it("matches departments where the requester is the head or a member", () => {
    const userId = new mongoose.Types.ObjectId();
    expect(membershipFilter(userId)).toEqual({
      $or: [
        { departmentHead: userId },
        { "members.user": userId },
      ],
    });
  });
});

describe("station audit department updates", () => {
  it("normalizes one field per request", () => {
    expect(normalizeDepartmentUpdate({ name: "  Maintenance  " })).toEqual({
      field: "name",
      value: "Maintenance",
    });
    expect(normalizeDepartmentUpdate({ active: false })).toEqual({ field: "active", value: false });
    expect(normalizeDepartmentUpdate({ members: [] })).toEqual({ field: "members", value: [] });
    expect(normalizeDepartmentUpdate({ name: "A", active: true }).error).toMatch(/exactly one/i);
  });

  it("maps sensitive fields to their nested permissions", () => {
    expect(requiredPermission("name")).toBe("auditManager.department.edit");
    expect(requiredPermission("assignmentStrategy")).toBe("auditManager.department.edit.strategyAutomation");
    expect(requiredPermission("active")).toBe("auditManager.department.edit.status");
  });

  it("requires and normalizes the complete create payload", () => {
    const userId = new mongoose.Types.ObjectId().toString();
    const result = normalizeDepartmentCreate({
      name: "Operations",
      description: "Shared operations queue",
      departmentHead: userId,
      members: [userId],
      defaultIssueAssignees: [userId],
      assignmentStrategy: "operations_queue",
      escalationDepartment: null,
      notificationEmails: ["OPS@example.com"],
      siteNotifications: [],
      active: true,
    });
    expect(result.error).toBeUndefined();
    expect(result.value.notificationEmails).toEqual(["ops@example.com"]);
    expect(normalizeDepartmentCreate({ name: "Incomplete" }).error).toMatch(/required/i);
  });
});
