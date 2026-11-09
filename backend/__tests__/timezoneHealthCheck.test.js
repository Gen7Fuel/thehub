import { describe, it, expect, vi, beforeEach } from "vitest";

const emailQueue = { add: vi.fn() };

vi.mock("bullmq", () => ({
  Queue: vi.fn().mockReturnValue({}),
  Worker: vi.fn().mockReturnValue({ on: vi.fn() }),
}));

vi.mock("../utils/redisClient", () => ({}));

// Match the extensionless require used inside timezoneHealthCheck.js.
vi.mock("../queues/emailQueue", () => ({ emailQueue }));

import {
  BC_TIMEZONE,
  getTimezoneHealthSnapshot,
  runTimezoneHealthCheck,
} from "../services/timezoneHealthCheck.js";

const makeMomentApi = ({ offsetMinutes, dataVersion = "test" }) => ({
  tz: {
    dataVersion,
    zone: vi.fn(() => ({})),
  },
  utc: vi.fn(() => ({
    tz: vi.fn(() => ({
      utcOffset: vi.fn(() => offsetMinutes),
      format: vi.fn(() => "2026-11-07 07:13 PDT -07:00"),
    })),
  })),
});

const logger = {
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  emailQueue.add.mockResolvedValue({ id: "timezone-alert-1" });
  delete process.env.TIMEZONE_ALERT_EMAIL;
});

describe("timezoneHealthCheck", () => {
  it("recognizes the expected permanent UTC-7 B.C. rule", () => {
    const snapshot = getTimezoneHealthSnapshot(
      makeMomentApi({ offsetMinutes: -420, dataVersion: "2026e" }),
    );

    expect(snapshot.timezone).toBe(BC_TIMEZONE);
    expect(snapshot.dataVersion).toBe("2026e");
    expect(snapshot.isHealthy).toBe(true);
  });

  it("logs and emails a warning without blocking startup when data is stale", async () => {
    const result = await runTimezoneHealthCheck({
      momentApi: makeMomentApi({ offsetMinutes: -480, dataVersion: "2026a" }),
      emailQueueClient: emailQueue,
      logger,
    });

    expect(result.isHealthy).toBe(false);
    expect(logger.error).toHaveBeenCalled();
    expect(emailQueue.add).toHaveBeenCalledWith(
      "timezone-health-alert",
      expect.objectContaining({
        to: "daksh@gen7fuel.com",
        subject: expect.stringContaining("America/Vancouver"),
      }),
    );
  });

  it("swallows email queue failures so the backend can continue", async () => {
    emailQueue.add.mockRejectedValueOnce(new Error("Redis unavailable"));

    const result = await runTimezoneHealthCheck({
      momentApi: makeMomentApi({ offsetMinutes: -480, dataVersion: "2026a" }),
      emailQueueClient: emailQueue,
      logger,
    });

    expect(result.isHealthy).toBe(false);
    expect(logger.error).toHaveBeenCalledTimes(2);
  });

  it("emails an alert when timezone data cannot be inspected", async () => {
    const brokenMomentApi = {
      tz: {
        dataVersion: "unknown",
        zone: vi.fn(() => null),
      },
    };

    const result = await runTimezoneHealthCheck({
      momentApi: brokenMomentApi,
      emailQueueClient: emailQueue,
      logger,
    });

    expect(result.isHealthy).toBe(false);
    expect(emailQueue.add).toHaveBeenCalledWith(
      "timezone-health-alert",
      expect.objectContaining({
        to: "daksh@gen7fuel.com",
        subject: expect.stringContaining("could not be inspected"),
      }),
    );
  });
});
