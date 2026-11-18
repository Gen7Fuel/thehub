const express = require("express");
const mongoose = require("mongoose");
const { accessibleLocations } = require("../../../services/stationAuditTrackerAccess");
const {
  FREQUENCIES,
  resolveStoreReportAvailability,
  resolveStoreReportOverview,
  resolveReportSection,
  resolveVisitorComparison,
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
    const type = String(req.query.type || "store").toLowerCase();
    const anchor = String(req.query.anchor || "").trim();
    if (!FREQUENCIES.includes(frequency)) return res.status(400).json({ error: "Invalid frequency" });
    if (!["store", "visitor"].includes(type)) return res.status(400).json({ error: "Invalid audit type" });
    if (!anchor) return res.status(400).json({ error: "Availability anchor is required" });
    const { location } = await requestedLocation(req);
    if (!location) return res.status(403).json({ error: "You do not have access to the requested site" });
    const periods = await resolveStoreReportAvailability({
      site: location._id,
      timezone: location.timezone,
      type,
      frequency,
      anchor,
    });
    return res.json({ type, frequency, anchor, periods });
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
    const type = String(req.query.type || "store").toLowerCase();
    const date = String(req.query.date || "").trim();
    if (!FREQUENCIES.includes(frequency)) return res.status(400).json({ error: "Invalid frequency" });
    if (!["store", "visitor"].includes(type)) return res.status(400).json({ error: "Invalid audit type" });
    if (!date) return res.status(400).json({ error: "Report date is required" });

    const { location, locations } = await requestedLocation(req);
    if (!location) return res.status(403).json({ error: "You do not have access to the requested site" });

    const report = await resolveStoreReportOverview({
      site: location._id,
      timezone: location.timezone,
      type,
      frequency,
      date,
    });
    return res.json({
      type,
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

router.get("/sections/:sectionId", async (req, res) => {
  try {
    if (!req.user?._id) return res.status(401).json({ error: "Authenticated user is required" });
    const { sectionId } = req.params;
    const frequency = String(req.query.frequency || "daily").toLowerCase();
    const type = String(req.query.type || "store").toLowerCase();
    const date = String(req.query.date || "").trim();
    if (!mongoose.isValidObjectId(sectionId)) return res.status(400).json({ error: "Invalid section" });
    if (!FREQUENCIES.includes(frequency)) return res.status(400).json({ error: "Invalid frequency" });
    if (!["store", "visitor"].includes(type)) return res.status(400).json({ error: "Invalid audit type" });
    if (!date) return res.status(400).json({ error: "Report date is required" });
    const { location } = await requestedLocation(req);
    if (!location) return res.status(403).json({ error: "You do not have access to the requested site" });
    const report = await resolveReportSection({
      sectionId,
      site: location._id,
      timezone: location.timezone,
      type,
      frequency,
      date,
    });
    return res.json({
      location: { _id: location._id, name: location.site || location.stationName, timezone: location.timezone },
      ...report,
    });
  } catch (error) {
    if (error?.message === "INVALID_REPORT_PERIOD") return res.status(400).json({ error: "Invalid report period" });
    if (error?.message === "REPORT_SECTION_NOT_FOUND") return res.status(404).json({ error: "Report section not found" });
    console.error("Failed to load Station Audit report section:", error);
    return res.status(500).json({ error: "Failed to load report section" });
  }
});

router.get("/visitor-comparison/:sectionId", async (req, res) => {
  try {
    if (!req.user?._id) return res.status(401).json({ error: "Authenticated user is required" });
    const { sectionId } = req.params;
    const frequency = String(req.query.frequency || "daily").toLowerCase();
    const date = String(req.query.date || "").trim();
    if (!mongoose.isValidObjectId(sectionId)) return res.status(400).json({ error: "Invalid section" });
    if (!FREQUENCIES.includes(frequency)) return res.status(400).json({ error: "Invalid frequency" });
    if (!date) return res.status(400).json({ error: "Report date is required" });
    const { location } = await requestedLocation(req);
    if (!location) return res.status(403).json({ error: "You do not have access to the requested site" });
    const report = await resolveVisitorComparison({
      sectionId,
      site: location._id,
      timezone: location.timezone,
      frequency,
      date,
    });
    return res.json({
      location: { _id: location._id, name: location.site || location.stationName, timezone: location.timezone },
      ...report,
    });
  } catch (error) {
    if (error?.message === "INVALID_REPORT_PERIOD") return res.status(400).json({ error: "Invalid report period" });
    if (error?.message === "REPORT_SECTION_NOT_FOUND") return res.status(404).json({ error: "Report section not found" });
    console.error("Failed to load Station Audit visitor comparison:", error);
    return res.status(500).json({ error: "Failed to load visitor comparison" });
  }
});

module.exports = router;
