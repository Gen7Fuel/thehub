const moment = require("moment-timezone");

const BC_TIMEZONE = "America/Vancouver";
const BC_PROBE_INSTANT = "2026-11-07T14:13:00Z";
const BC_EXPECTED_OFFSET_MINUTES = -420;
const DEFAULT_ALERT_RECIPIENT = "daksh@gen7fuel.com";

const getTimezoneHealthSnapshot = (momentApi = moment) => {
  const zone = momentApi.tz.zone(BC_TIMEZONE);
  if (!zone) {
    throw new Error(`Timezone data does not contain ${BC_TIMEZONE}`);
  }

  const localProbe = momentApi.utc(BC_PROBE_INSTANT).tz(BC_TIMEZONE);

  return {
    timezone: BC_TIMEZONE,
    dataVersion: momentApi.tz.dataVersion || "unknown",
    probeInstant: BC_PROBE_INSTANT,
    localProbe: localProbe.format("YYYY-MM-DD HH:mm z Z"),
    offsetMinutes: localProbe.utcOffset(),
    isHealthy: localProbe.utcOffset() === BC_EXPECTED_OFFSET_MINUTES,
  };
};

const queueTimezoneAlert = async ({
  recipient,
  subject,
  text,
  emailQueueClient,
  logger,
}) => {
  try {
    await emailQueueClient.add("timezone-health-alert", {
      to: recipient,
      subject,
      text,
      html: `<p>${text.replace(/\n/g, "<br />")}</p>`,
    });
    logger.warn(`[Timezone] Alert email queued for ${recipient}.`);
  } catch (error) {
    logger.error("[Timezone] Could not queue alert email:", error);
  }
};

/**
 * Logs the deployed timezone data and queues a warning email when the known
 * B.C. permanent-UTC-7 rule is missing. This check is deliberately
 * non-blocking: failures are reported and swallowed so backend startup is
 * never prevented by timezone metadata or email-queue availability.
 */
const runTimezoneHealthCheck = async ({
  momentApi = moment,
  emailQueueClient,
  logger = console,
} = {}) => {
  const resolvedEmailQueueClient =
    emailQueueClient || require("../queues/emailQueue").emailQueue;
  let snapshot;
  const recipient = process.env.TIMEZONE_ALERT_EMAIL || DEFAULT_ALERT_RECIPIENT;

  try {
    snapshot = getTimezoneHealthSnapshot(momentApi);
    logger.log(
      `[Timezone] ${snapshot.timezone} data=${snapshot.dataVersion} ` +
        `probe=${snapshot.localProbe}`,
    );
  } catch (error) {
    logger.error("[Timezone] Health check could not inspect timezone data:", error);
    await queueTimezoneAlert({
      recipient,
      subject: "[Timezone Alert] Backend timezone data could not be inspected",
      text: [
        "The backend started, but its timezone data could not be inspected.",
        `Error: ${error.message}`,
        "The backend was not stopped. Investigate timezone data manually.",
      ].join("\n"),
      emailQueueClient: resolvedEmailQueueClient,
      logger,
    });
    return { isHealthy: false, error };
  }

  if (snapshot.isHealthy) {
    logger.log("[Timezone] Health check passed.");
    return snapshot;
  }

  const subject = `[Timezone Alert] ${snapshot.timezone} data is outdated`;
  const text = [
    "The backend started, but its timezone rules may be outdated.",
    `Timezone: ${snapshot.timezone}`,
    `Installed timezone data: ${snapshot.dataVersion}`,
    `Probe result: ${snapshot.localProbe}`,
    "Expected B.C. offset for the probe: UTC-7 (-420 minutes).",
    "The backend was not stopped. Update moment-timezone and redeploy when ready.",
  ].join("\n");

  logger.error(`[Timezone] Health check failed. ${text}`);

  await queueTimezoneAlert({
    recipient,
    subject,
    text,
    emailQueueClient: resolvedEmailQueueClient,
    logger,
  });

  return snapshot;
};

module.exports = {
  BC_TIMEZONE,
  BC_PROBE_INSTANT,
  BC_EXPECTED_OFFSET_MINUTES,
  getTimezoneHealthSnapshot,
  runTimezoneHealthCheck,
};
