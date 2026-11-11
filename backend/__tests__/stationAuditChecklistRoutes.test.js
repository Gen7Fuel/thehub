import { describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import checklistRouteModule from "../routes/station-audits/checklistRoutes.js";

const { periodKeyFor, periodKeysFor, normalizeResponseInput, shouldCreateIssue } = checklistRouteModule;

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

describe("station audit response input", () => {
  it("creates operational issues only for completed store responses", () => {
    expect(shouldCreateIssue("store", { checked: true, issueRaised: true })).toBe(true);
    expect(shouldCreateIssue("visitor", { checked: true, issueRaised: true })).toBe(false);
    expect(shouldCreateIssue("store", { checked: false, issueRaised: true })).toBe(false);
  });

  it("normalizes response values and removes duplicate image paths", () => {
    expect(normalizeResponseInput({
      checked: true,
      statusOptionId: " option-id ",
      comment: " checked ",
      photos: ["one.jpg", "one.jpg", "two.jpg"],
      issueRaised: true,
      requestOrder: true,
      issueAlreadyResolved: true,
      resolutionComment: " fixed before submission ",
    })).toEqual({
      checked: true,
      statusOptionId: "option-id",
      comment: "checked",
      photos: ["one.jpg", "two.jpg"],
      issueRaised: true,
      requestOrder: true,
      issueAlreadyResolved: true,
      resolutionComment: "fixed before submission",
    });
  });

  it("rejects excessive or unsafe image paths", () => {
    expect(normalizeResponseInput({ photos: Array.from({ length: 11 }, (_, index) => `${index}.jpg`) }).error)
      .toMatch(/at most 10 images/);
    expect(normalizeResponseInput({ photos: ["../secret.jpg"] }).error).toBe("Invalid image path");
  });
});
