import { describe, expect, it } from "vitest";
import mongoose from "mongoose";
import trackerRouteModule from "../routes/station-audits/tracker/myIssueRoutes.js";
import trackerAccessModule from "../services/stationAuditTrackerAccess.js";

const { issueFilter } = trackerRouteModule;
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
});
