import { describe, expect, it } from "vitest";
import reportResolver from "../services/stationAuditReportResolver.js";

const { availabilityPeriods, reportPeriod } = reportResolver;

describe("station audit report periods", () => {
  it("resolves daily and monthly periods in the station timezone", () => {
    const daily = reportPeriod("daily", "2026-11-17", "America/Toronto");
    const monthly = reportPeriod("monthly", "2026-11-17", "America/Toronto");

    expect(daily.periodKey).toBe("2026-11-17");
    expect(daily.label).toBe("Nov 17, 2026");
    expect(monthly.periodKey).toBe("2026-11");
    expect(monthly.label).toBe("November 2026");
  });

  it("preserves the legacy week key and returns its complete date range", () => {
    const weekly = reportPeriod("weekly", "2026-11-17", "America/Toronto");

    expect(weekly.periodKey).toMatch(/^2026-W\d+$/);
    expect(weekly.start.getTime()).toBeLessThanOrEqual(new Date("2026-11-17T12:00:00Z").getTime());
    expect(weekly.end.getTime()).toBeGreaterThanOrEqual(new Date("2026-11-17T12:00:00Z").getTime());
  });

  it("builds Sunday-to-Saturday weekly availability rows", () => {
    const weeks = availabilityPeriods("weekly", "2026-11-01", "America/Toronto");

    expect(weeks[0].date).toBe("2026-11-01");
    expect(weeks[0].endDate).toBe("2026-11-07");
    expect(weeks.at(-1).date).toBe("2026-11-29");
    expect(weeks.at(-1).endDate).toBe("2026-12-05");
  });
});
