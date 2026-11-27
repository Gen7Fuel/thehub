import { describe, expect, it } from "vitest";
import statusOptionRouteModule from "../routes/station-audits/manager/statusOptionRoutes.js";

const { normalizeOptions, normalizeStatusOptionUpdate, normalizeStatusOptionCreate, requiredPermission } = statusOptionRouteModule;

describe("station audit status-option management", () => {
  it("normalizes valid options and rejects duplicate keys", () => {
    expect(normalizeOptions([{ label: " Pass " }, { label: "Pass" }])).toEqual({
      value: [
        { key: "pass", label: "Pass", sortOrder: 0 },
        { key: "pass-2", label: "Pass", sortOrder: 1 },
      ],
    });
    expect(normalizeOptions([{ label: "" }]).error).toMatch(/label/i);
  });

  it("accepts one update field at a time", () => {
    expect(normalizeStatusOptionUpdate({ active: false })).toEqual({ field: "active", value: false });
    expect(normalizeStatusOptionUpdate({ name: "A", active: true }).error).toMatch(/exactly one/i);
  });

  it("requires the nested permission for status updates", () => {
    expect(requiredPermission("name")).toBe("auditManager.statusOptions.edit");
    expect(requiredPermission("active")).toBe("auditManager.statusOptions.edit.statusUpdate");
  });

  it("requires all fields when creating a set", () => {
    const result = normalizeStatusOptionCreate({ name: "Pass or fail", description: "", options: [{ label: "Pass" }], active: true });
    expect(result.error).toBeUndefined();
    expect(normalizeStatusOptionCreate({ name: "Incomplete" }).error).toMatch(/required/i);
  });
});
