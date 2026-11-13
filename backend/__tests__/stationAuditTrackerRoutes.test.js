import { describe, expect, it } from "vitest";
import mongoose from "mongoose";
import trackerRouteModule from "../routes/station-audits/tracker/myIssueRoutes.js";
import trackerAccessModule from "../services/stationAuditTrackerAccess.js";

const {
  historicalIssueFilter,
  issueFilter,
  normalizeActivityInput,
  STATUS_TRANSITIONS,
} = trackerRouteModule;
const { accessibleSiteNames } = trackerAccessModule;

describe("station audit tracker access", () => {
  it("includes the user's own site and enabled site-access entries", () => {
    expect(accessibleSiteNames({
      stationName: "Rankin",
      site_access: new Map([["Couchiching", true], ["Sarnia", false]]),
    })).toEqual(["Rankin", "Couchiching"]);
  });
});

describe("station audit My Issues query", () => {
  it("always scopes open issues to the assignee and accessible sites", () => {
    const userId = new mongoose.Types.ObjectId();
    const siteId = new mongoose.Types.ObjectId();
    expect(issueFilter({ userId, siteIds: [siteId] })).toEqual({
      "assignees.user": userId,
      status: { $in: ["created", "in_progress", "on_hold"] },
      site: { $in: [siteId] },
    });
  });

  it("normalizes a combined comment and image activity", () => {
    expect(normalizeActivityInput({
      body: "  Pump repaired  ",
      photos: ["repair.jpg", "repair.jpg", "receipt.png"],
    })).toEqual({
      body: "Pump repaired",
      photos: ["repair.jpg", "receipt.png"],
    });
  });

  it("only exposes the approved issue status transitions", () => {
    expect(STATUS_TRANSITIONS).toEqual({
      created: ["in_progress", "on_hold"],
      on_hold: ["in_progress"],
      in_progress: ["on_hold", "resolved"],
    });
  });

  it("scopes history to the same checklist, before the current issue, and the previous year", () => {
    const currentIssue = {
      _id: new mongoose.Types.ObjectId(),
      checklist: new mongoose.Types.ObjectId(),
      raisedAt: new Date("2026-11-13T12:00:00.000Z"),
    };
    const filter = historicalIssueFilter(currentIssue);

    expect(filter._id).toEqual({ $ne: currentIssue._id });
    expect(filter.checklist).toBe(currentIssue.checklist);
    expect(filter.status).toEqual({ $ne: "created" });
    expect(filter.raisedAt.$lt).toBe(currentIssue.raisedAt);
    expect(filter.raisedAt.$gte).toBeInstanceOf(Date);
  });
});
