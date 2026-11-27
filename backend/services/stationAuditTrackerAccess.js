const Location = require("../models/Location");

function siteAccessEntries(siteAccess) {
  if (!siteAccess) return [];
  if (siteAccess instanceof Map) return [...siteAccess.entries()];
  if (typeof siteAccess.entries === "function") return [...siteAccess.entries()];
  return Object.entries(siteAccess);
}

function accessibleSiteNames(user) {
  return [...new Set([
    user?.stationName,
    user?.site,
    ...siteAccessEntries(user?.site_access)
      .filter(([, enabled]) => enabled === true)
      .map(([name]) => name),
  ].map((name) => String(name || "").trim()).filter(Boolean))];
}

async function accessibleLocations(user) {
  const names = accessibleSiteNames(user);
  if (!names.length) return [];
  return Location.find({
    $or: [
      { stationName: { $in: names } },
      { site: { $in: names } },
    ],
  })
    .select("_id stationName site timezone")
    .sort({ stationName: 1 })
    .lean();
}

module.exports = { accessibleSiteNames, accessibleLocations };
