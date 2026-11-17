const express = require("express");
const { accessibleLocations } = require("../../../services/stationAuditTrackerAccess");
const {
  FREQUENCIES,
  resolveStoreReportAvailability,
  resolveStoreReportOverview,
} = require("../../../services/stationAuditReportResolver");

const router = express.Router();

async function requestedLocation(req) {
  const requestedSite = String(req.query.site || "").trim();
  const locations = await accessibleLocations(req.user);
  const location = locations.find((entry) =>
    String(entry._id) === requestedSite
    || String(entry.site || "").toLowerCase() === requestedSite.toLowerCase()
    || String(entry.stationName || "").toLowerCase() === requestedSite.toLowerCase()
  );
  return { location, locations };
}

router.get("/availability", async (req, res) => {
  try {
    if (!req.user?._id) return res.status(401).json({ error: "Authenticated user is required" });
    const frequency = String(req.query.frequency || "daily").toLowerCase();
    const anchor = String(req.query.anchor || "").trim();
    if (!FREQUENCIES.includes(frequency)) return res.status(400).json({ error: "Invalid frequency" });
    if (!anchor) return res.status(400).json({ error: "Availability anchor is required" });
    const { location } = await requestedLocation(req);
    if (!location) return res.status(403).json({ error: "You do not have access to the requested site" });
    const periods = await resolveStoreReportAvailability({
      site: location._id,
      timezone: location.timezone,
      frequency,
      anchor,
    });
    return res.json({ frequency, anchor, periods });
  } catch (error) {
    if (error?.message === "INVALID_REPORT_PERIOD") return res.status(400).json({ error: "Invalid availability period" });
    console.error("Failed to load Station Audit report availability:", error);
    return res.status(500).json({ error: "Failed to load report availability" });
  }
});

router.get("/overview", async (req, res) => {
  try {
    if (!req.user?._id) return res.status(401).json({ error: "Authenticated user is required" });
    const frequency = String(req.query.frequency || "daily").toLowerCase();
    const date = String(req.query.date || "").trim();
    if (!FREQUENCIES.includes(frequency)) return res.status(400).json({ error: "Invalid frequency" });
    if (!date) return res.status(400).json({ error: "Report date is required" });

    const { location, locations } = await requestedLocation(req);
    if (!location) return res.status(403).json({ error: "You do not have access to the requested site" });

    const report = await resolveStoreReportOverview({
      site: location._id,
      timezone: location.timezone,
      frequency,
      date,
    });
    return res.json({
      type: "store",
      frequency,
      location: {
        _id: location._id,
        name: location.site || location.stationName,
        timezone: location.timezone || "America/Toronto",
      },
      sites: locations.map((entry) => ({ _id: entry._id, name: entry.site || entry.stationName })),
      ...report,
    });
  } catch (error) {
    if (error?.message === "INVALID_REPORT_PERIOD") {
      return res.status(400).json({ error: "Invalid report period" });
    }
    console.error("Failed to load Station Audit report overview:", error);
    return res.status(500).json({ error: "Failed to load Station Audit report" });
  }
});

module.exports = router;
