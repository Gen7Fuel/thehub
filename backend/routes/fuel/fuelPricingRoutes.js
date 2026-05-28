const express = require('express');
const router = express.Router();
const Location = require('../../models/Location');
const { getFuelPricingDate } = require('../../services/sqlService');

router.get('/', async (req, res) => {
  try {
    const stores = await Location.find({ type: 'store' }).lean();
    if (!stores.length) {
      return res.status(200).json({ stations: [], pricingData: {} });
    }

    let dateSK = req.query.date;
    if (!dateSK) {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      dateSK = `${yyyy}${mm}${dd}`;
    }

    const sqlResult = await getFuelPricingDate(dateSK);
    const rows = sqlResult.recordset || [];

    console.log(`Fetched ${rows.length} rows for dateSK: ${dateSK}`);

    const pricingMap = {};

    rows.forEach(row => {
      const cso = row.Station_SK != null ? String(row.Station_SK).trim() : null;
      const grade = row.Type != null ? String(row.Type).trim() : null;

      if (!cso || !grade) return;

      if (!pricingMap[cso]) pricingMap[cso] = {};
      if (!pricingMap[cso][grade]) {
        pricingMap[cso][grade] = {
          metrics: {
            landedCost: row['Landed Cost'],
            prevLandedCost: row['T-1 Landed Cost'],
            rackPrice: row["Today's Rack"],
            prevRackPrice: row["T-1's Rack"],
            recPrice: row['Rec Price'],
            low: row['Low'],
            prevLow: row['T-1 Low'],
            avg: row['Avg'],
            prevAvg: row['T-1 Avg'],
            high: row['High'],
            prevHigh: row['T-1 High'],
          },
          competitors: []
        };
      }

      // Append competitor entry only if it contains actual data (not NULL/empty)
      if (row.Competitor && String(row.Competitor).trim().toUpperCase() !== 'NULL') {
        const compTypeRaw = row['Competitor Type'] != null ? String(row['Competitor Type']).trim() : '';

        // Map "Local Reserve" or "Local City" cleanly for the frontend filter matches
        let assignedType = 'City Area'; // Fallback
        if (compTypeRaw === 'Local Reserve') {
          assignedType = 'Reserve Area';
        } else if (compTypeRaw === 'Local City') {
          assignedType = 'City Area';
        }

        pricingMap[cso][grade].competitors.push({
          type: assignedType,
          name: String(row.Competitor).trim(),
          address: row['Competitor Address'] != null && String(row['Competitor Address']).toUpperCase() !== 'NULL'
            ? String(row['Competitor Address']).trim()
            : 'N/A',
          price: row['Competitor Price'],
          updatedDate: row['C_Updated Date'] && String(row['C_Updated Date']).toUpperCase() !== 'NULL' ? row['C_Updated Date'] : 'N/A',
          updatedTime: row['C_Updated Time'] && String(row['C_Updated Time']).toUpperCase() !== 'NULL' ? row['C_Updated Time'] : 'N/A'
        });
      }
    });

    return res.status(200).json({
      stations: stores.map(s => ({
        csoCode: s.csoCode,
        stationName: s.stationName,
        address: s.address
      })),
      pricingData: pricingMap
    });

  } catch (error) {
    console.error("Error processing fuel pricing metrics:", error);
    return res.status(500).json({ error: "Internal server error assembly failed." });
  }
});

module.exports = router;