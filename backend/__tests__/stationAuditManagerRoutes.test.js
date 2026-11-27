import { describe, expect, it } from "vitest";
import mongoose from "mongoose";
import sectionRouteModule from "../routes/station-audits/manager/sectionRoutes.js";

const { normalizeSectionUpdate, normalizeSectionOrder, normalizeSectionCreate, buildArchivedSectionOrder } = sectionRouteModule;

describe("station audit manager section updates", () => {
  it("accepts one supported metadata field at a time", () => {
    expect(normalizeSectionUpdate({ name: "  Operations  " })).toEqual({
      field: "name",
      value: "Operations",
    });
    expect(normalizeSectionUpdate({ active: false })).toEqual({ field: "active", value: false });
  });

  it("rejects bulk and unsupported updates", () => {
    expect(normalizeSectionUpdate({ name: "Operations", active: true }).error)
      .toMatch(/exactly one/i);
    expect(normalizeSectionUpdate({ createdBy: new mongoose.Types.ObjectId() }).error)
      .toMatch(/exactly one/i);
  });

  it("deduplicates valid department and site IDs", () => {
    const id = new mongoose.Types.ObjectId().toString();
    const result = normalizeSectionUpdate({ departments: [id, id] });
    expect(result.field).toBe("departments");
    expect(result.value).toHaveLength(1);
    expect(result.value[0].toString()).toBe(id);
  });

  it("rejects empty selections and invalid scalar values", () => {
    expect(normalizeSectionUpdate({ sites: [] }).error).toMatch(/at least one/i);
    expect(normalizeSectionUpdate({ sortOrder: 1 }).error).toMatch(/exactly one/i);
    expect(normalizeSectionUpdate({ sectionType: "report" }).error).toBe("Invalid section type");
  });
});

describe("station audit manager section ordering", () => {
  it("accepts a unique ordered list of section IDs", () => {
    const ids = [new mongoose.Types.ObjectId().toString(), new mongoose.Types.ObjectId().toString()];
    expect(normalizeSectionOrder({ sectionIds: ids })).toEqual({ sectionIds: ids });
  });

  it("rejects empty, duplicate, and invalid section IDs", () => {
    const id = new mongoose.Types.ObjectId().toString();
    expect(normalizeSectionOrder({ sectionIds: [] }).error).toMatch(/complete active section order/i);
    expect(normalizeSectionOrder({ sectionIds: [id, id] }).error).toMatch(/duplicates/i);
    expect(normalizeSectionOrder({ sectionIds: ["invalid"] }).error).toMatch(/invalid ID/i);
  });

  it("removes an archived section and compacts the active order", () => {
    const first = new mongoose.Types.ObjectId();
    const archived = new mongoose.Types.ObjectId();
    const third = new mongoose.Types.ObjectId();
    const previouslyArchived = new mongoose.Types.ObjectId();
    const sections = [
      { _id: archived, name: "Second", sortOrder: 1, active: true },
      { _id: previouslyArchived, name: "Old", sortOrder: 3, active: false },
      { _id: third, name: "Third", sortOrder: 2, active: true },
      { _id: first, name: "First", sortOrder: 0, active: true },
    ];

    expect(buildArchivedSectionOrder(sections, archived)).toEqual([
      first.toString(),
      third.toString(),
    ]);
  });
});

describe("station audit manager section creation", () => {
  it("normalizes a complete section and defaults it active", () => {
    const site = new mongoose.Types.ObjectId().toString();
    const department = new mongoose.Types.ObjectId().toString();
    const result = normalizeSectionCreate({
      name: "  New section  ",
      description: " Test ",
      sectionType: "checklist",
      sites: [site],
      departments: [department],
    });

    expect(result.error).toBeUndefined();
    expect(result.value.name).toBe("New section");
    expect(result.value.description).toBe("Test");
    expect(result.value.active).toBe(true);
  });

  it("rejects incomplete section creation", () => {
    expect(normalizeSectionCreate({}).error).toMatch(/name is required/i);
    expect(normalizeSectionCreate({
      name: "New section",
      sectionType: "checklist",
      sites: [],
      departments: [],
    }).error).toMatch(/sites must contain/i);
  });
});
