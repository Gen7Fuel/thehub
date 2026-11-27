import { describe, expect, it } from "vitest";
import mongoose from "mongoose";
import checklistManagerRouteModule from "../routes/station-audits/manager/checklistRoutes.js";

const { normalizeChecklistUpdate, normalizeChecklistCreate, normalizeChecklistOrder, requiredChecklistPermission } = checklistManagerRouteModule;

describe("station audit manager checklist updates", () => {
  it("accepts one supported metadata field at a time", () => {
    expect(normalizeChecklistUpdate({ category: "  Safety  " })).toEqual({
      field: "category",
      value: "Safety",
    });

    expect(normalizeChecklistUpdate({
      category: "Safety",
      frequency: "daily",
    }).error).toMatch(/exactly one/i);
  });

  it("requires at least one valid audit visibility", () => {
    expect(normalizeChecklistUpdate({ auditTypes: [] }).error).toMatch(/store, visitor/i);
    expect(normalizeChecklistUpdate({ auditTypes: ["visitor", "visitor"] })).toEqual({
      field: "auditTypes",
      value: ["visitor"],
    });
  });

  it("accepts boolean follow-up and comment requirements", () => {
    expect(normalizeChecklistUpdate({ followUp: true })).toEqual({
      field: "followUp",
      value: true,
    });
    expect(normalizeChecklistUpdate({ followUp: "yes" }).error).toMatch(/true or false/i);
  });

  it("reserves activation changes for the nested status permission", () => {
    expect(requiredChecklistPermission("active"))
      .toBe("auditManager.checklist.edit.updateActiveStatus");
    expect(requiredChecklistPermission("category"))
      .toBe("auditManager.checklist.edit");
  });

  it("normalizes order creation metadata", () => {
    expect(normalizeChecklistUpdate({
      orderConfiguration: { enabled: true, vendor: "  Supply Co  " },
    })).toEqual({
      field: "orderConfiguration",
      value: { requestOrderEnabled: true, suppliesVendor: "Supply Co" },
    });

    expect(normalizeChecklistUpdate({
      orderConfiguration: { enabled: true, vendor: "" },
    }).error).toMatch(/vendor is required/i);
  });
});

describe("station audit manager checklist ordering", () => {
  it("accepts a unique ordered list of checklist IDs", () => {
    const first = new mongoose.Types.ObjectId().toString();
    const second = new mongoose.Types.ObjectId().toString();
    expect(normalizeChecklistOrder({ frequency: "weekly", checklistIds: [first, second] })).toEqual({
      frequency: "weekly",
      checklistIds: [first, second],
    });
  });

  it("rejects duplicate and invalid checklist IDs", () => {
    const id = new mongoose.Types.ObjectId().toString();
    expect(normalizeChecklistOrder({ frequency: "daily", checklistIds: [id, id] }).error).toMatch(/duplicates/i);
    expect(normalizeChecklistOrder({ frequency: "daily", checklistIds: ["invalid"] }).error).toMatch(/invalid ID/i);
    expect(normalizeChecklistOrder({ frequency: "yearly", checklistIds: [] }).error).toMatch(/frequency/i);
  });
});

describe("station audit manager checklist creation", () => {
  it("normalizes a complete new checklist and applies safe defaults", () => {
    const department = new mongoose.Types.ObjectId().toString();
    const statusOptionSet = new mongoose.Types.ObjectId().toString();
    const result = normalizeChecklistCreate({
      item: "  Pump inspection  ",
      department,
      statusOptionSet,
      active: false,
    });

    expect(result.error).toBeUndefined();
    expect(result.value).toMatchObject({
      item: "Pump inspection",
      frequency: "daily",
      auditTypes: ["store", "visitor"],
      followUp: false,
      commentRequired: false,
      assignedSites: [],
      requestOrderEnabled: false,
      suppliesVendor: "",
      active: false,
    });
  });

  it("requires a name, department, and status-option set", () => {
    expect(normalizeChecklistCreate({}).error).toBeTruthy();
  });
});
