import { describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import checklistRouteModule from "../routes/station-audits/checklistRoutes.js";

const { periodKeyFor, periodKeysFor } = checklistRouteModule;

describe("station audit checklist period keys", () => {
  it("preserves the legacy daily, weekly, and monthly key formats", () => {
    const date = DateTime.fromISO("2025-09-26", { zone: "America/Toronto" });

    expect(periodKeyFor("daily", date)).toBe("2025-09-26");
    expect(periodKeyFor("weekly", date)).toBe("2025-W39");
    expect(periodKeyFor("monthly", date)).toBe("2025-09");
  });

  it("uses the supplied station timezone and rejects invalid dates", () => {
    expect(periodKeysFor("America/Vancouver", "2026-11-03")).toEqual({
      daily: "2026-11-03",
      weekly: "2026-W45",
      monthly: "2026-11",
    });
    expect(periodKeysFor("America/Toronto", "not-a-date")).toBeNull();
  });
});
