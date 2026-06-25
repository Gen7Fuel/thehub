/**
 * Processes grouped rows for a specific fuel grade to calculate an algorithmic recommended retail price.
 * Returns an object containing the price and a plain English explanation string.
 */
function calculateCustomRecPrice(stationSk, grade, gradeRows) {
  if (!gradeRows || gradeRows.length === 0) {
    return { recPrice: null, explanation: "By adding 12% margin to the Landed cost" };
  }

  // =========================================================================
  // RULE BLOCK: STATION 30900 (Rankin)
  // =========================================================================
  if (stationSk === "30900") {
    const localCityPrices = gradeRows
      .filter(
        (r) =>
          r["Competitor Type"] != null &&
          String(r["Competitor Type"]).trim() === "Local City",
      )
      .map((r) =>
        r["Competitor Price"] != null
          ? parseFloat(r["Competitor Price"])
          : null,
      )
      .filter((p) => p !== null && !isNaN(p));

    if (localCityPrices.length === 0) {
      return { recPrice: null, explanation: "By adding 12% margin to the Landed cost" };
    }

    const highestOffReserve = Math.max(...localCityPrices);
    const competitorTargetPrice = highestOffReserve - 0.09;

    const firstRow = gradeRows[0];
    const landedCost =
      firstRow["Landed Cost"] != null
        ? parseFloat(firstRow["Landed Cost"])
        : null;

    if (landedCost === null || isNaN(landedCost)) {
      return { recPrice: null, explanation: "By adding 12% margin to the Landed cost" };
    }
    const landedCostTargetPrice = landedCost + 0.18;
    const finalPrice = parseFloat(((competitorTargetPrice + landedCostTargetPrice) / 2).toFixed(4));

    return {
      recPrice: finalPrice,
      explanation: "Calculated by taking the average of the highest Local City competitor price minus 9 cents, and the Landed Cost plus 18 cents."
    };
  }

  // =========================================================================
  // RULE BLOCK: STATION 30904 (Smokeys)
  // =========================================================================
  if (stationSk === "30904") {
    const filteredBrandPrices = gradeRows
      .filter((r) => {
        const type =
          r["Competitor Type"] != null
            ? String(r["Competitor Type"]).trim()
            : "";
        const competitor =
          r["Competitor"] != null
            ? String(r["Competitor"]).trim().toLowerCase()
            : "";
        return (
          type === "Local City" &&
          (competitor.includes("canco") || competitor.includes("petro-canada"))
        );
      })
      .map((r) =>
        r["Competitor Price"] != null
          ? parseFloat(r["Competitor Price"])
          : null,
      )
      .filter((p) => p !== null && !isNaN(p));

    if (filteredBrandPrices.length === 0) {
      return { recPrice: null, explanation: "By adding 12% margin to the Landed cost" };
    }

    const highestTargetBrandPrice = Math.max(...filteredBrandPrices);
    const finalPrice = parseFloat((highestTargetBrandPrice - 0.1).toFixed(4));

    return {
      recPrice: finalPrice,
      explanation: "Calculated by taking the highest competitor price between Canco and Petro-Canada in the Local City area and subtracting 10 cents."
    };
  }

  // =========================================================================
  // RULE BLOCK: STATION 30901 (Jocko Point)
  // =========================================================================
  if (stationSk === "30901") {
    let picklesPrice = null;
    let eaglesPrice = null;
    let usedStation = "";

    gradeRows.forEach((r) => {
      if (r["Competitor Price"] == null) return;
      const competitorName =
        r["Competitor"] != null
          ? String(r["Competitor"]).trim().toLowerCase()
          : "";
      const targetPrice = parseFloat(r["Competitor Price"]);

      if (isNaN(targetPrice)) return;

      if (competitorName.includes("pickle")) picklesPrice = targetPrice;
      if (competitorName.includes("eagle")) eaglesPrice = targetPrice;
    });

    let selectedBaselinePrice = null;
    if (picklesPrice !== null && eaglesPrice !== null) {
      selectedBaselinePrice = Math.min(picklesPrice, eaglesPrice);
      usedStation = picklesPrice < eaglesPrice ? "Pickles" : "Eagles Nest";
    } else if (picklesPrice !== null) {
      selectedBaselinePrice = picklesPrice;
      usedStation = "Pickles";
    } else if (eaglesPrice !== null) {
      selectedBaselinePrice = eaglesPrice;
      usedStation = "Eagles Nest";
    }

    if (selectedBaselinePrice === null) {
      return { recPrice: null, explanation: "By adding 12% margin to the Landed cost" };
    }

    const finalPrice = parseFloat((selectedBaselinePrice - 0.02).toFixed(4));
    return {
      recPrice: finalPrice,
      explanation: `Calculated by taking the price from ${usedStation} and subtracting 2 cents.`
    };
  }

  // =========================================================================
  // RULE BLOCK: STATION 61327
  // =========================================================================
  if (stationSk === "61327") {
    const firstRow = gradeRows[0];
    const landedCost =
      firstRow["Landed Cost"] != null
        ? parseFloat(firstRow["Landed Cost"])
        : null;
    if (landedCost === null || isNaN(landedCost)) {
      return { recPrice: null, explanation: "By adding 12% margin to the Landed cost" };
    }

    const finalPrice = parseFloat((landedCost + 0.225).toFixed(4));
    return {
      recPrice: finalPrice,
      explanation: "Calculated by adding 22.5 cents to the Landed Cost."
    };
  }

  // =========================================================================
  // RULE BLOCK: STATION 68906 (Oliver)
  // =========================================================================
  if (stationSk === "68906") {
    const filteredBrandPrices = gradeRows
      .filter((r) => {
        const type =
          r["Competitor Type"] != null
            ? String(r["Competitor Type"]).trim()
            : "";
        const competitor =
          r["Competitor"] != null
            ? String(r["Competitor"]).trim().toLowerCase()
            : "";
        return type === "Local City" && (competitor.includes("canco") || competitor.includes("esso"));
      })
      .map((r) => {
        const price =
          r["Competitor Price"] != null
            ? parseFloat(r["Competitor Price"])
            : null;
        return { name: r["Competitor"], price };
      })
      .filter((item) => item.price !== null && !isNaN(item.price));

    if (filteredBrandPrices.length === 0) {
      return { recPrice: null, explanation: "By adding 12% margin to the Landed cost" };
    }

    const pricesArray = filteredBrandPrices.map((item) => item.price);
    const highestTargetBrandPrice = Math.max(...pricesArray);
    const finalPrice = parseFloat((highestTargetBrandPrice - 0.02).toFixed(4));

    return {
      recPrice: finalPrice,
      explanation: "Calculated by taking the highest competitor price between Canco and Esso in the Local City area and subtracting 2 cents."
    };
  }

  // =========================================================================
  // RULE BLOCK: STATION 68908 (Osoyoos)
  // =========================================================================
  if (stationSk === "68908") {
    const localCityPrices = gradeRows
      .filter(
        (r) =>
          r["Competitor Type"] != null &&
          String(r["Competitor Type"]).trim() === "Local City",
      )
      .map((r) =>
        r["Competitor Price"] != null
          ? parseFloat(r["Competitor Price"])
          : null,
      )
      .filter((p) => p !== null && !isNaN(p));

    if (localCityPrices.length === 0) {
      return { recPrice: null, explanation: "By adding 12% margin to the Landed cost" };
    }

    const highestLocalCityPrice = Math.max(...localCityPrices);
    const finalPrice = parseFloat((highestLocalCityPrice - 0.02).toFixed(4));

    return {
      recPrice: finalPrice,
      explanation: "Calculated by taking the highest Local City competitor price and subtracting 2 cents."
    };
  }

  // =========================================================================
  // RULE BLOCK: STATION 30903 (Walpole)
  // =========================================================================
  if (stationSk === "30903") {
    const filteredEssoPrices = gradeRows
      .filter((r) => {
        const type =
          r["Competitor Type"] != null
            ? String(r["Competitor Type"]).trim()
            : "";
        const competitor =
          r["Competitor"] != null
            ? String(r["Competitor"]).trim().toLowerCase()
            : "";
        return type === "Local City" && competitor.includes("esso");
      })
      .map((r) =>
        r["Competitor Price"] != null
          ? parseFloat(r["Competitor Price"])
          : null,
      )
      .filter((p) => p !== null && !isNaN(p));

    if (filteredEssoPrices.length === 0) {
      return { recPrice: null, explanation: "By adding 12% margin to the Landed cost" };
    }

    const highestEssoPrice = Math.max(...filteredEssoPrices);
    const finalPrice = parseFloat((highestEssoPrice - 0.1).toFixed(4));

    return {
      recPrice: finalPrice,
      explanation: "Calculated by taking the highest Esso price in the Local City area and subtracting 10 cents."
    };
  }

  // =========================================================================
  // RULE BLOCK: STATION 72560 (Enderby)
  // =========================================================================
  if (stationSk === "72560") {
    const gbRow = gradeRows.find((r) => {
      const competitor =
        r["Competitor"] != null ? String(r["Competitor"]).trim() : "";
      return competitor === "G&B Fuels";
    });

    const gbPrice =
      gbRow && gbRow["Competitor Price"] != null
        ? parseFloat(gbRow["Competitor Price"])
        : null;

    if (gbPrice === null || isNaN(gbPrice)) {
      return { recPrice: null, explanation: "By adding 12% margin to the Landed cost" };
    }

    const finalPrice = parseFloat(gbPrice.toFixed(4));
    return {
      recPrice: finalPrice,
      explanation: "Calculated by matching the G&B Fuels competitor price exactly."
    };
  }

  // =========================================================================
  // RULE BLOCK: STATION 62182 (Silver Grizzly)
  // =========================================================================
  if (stationSk === "62182") {
    const cancoPrices = gradeRows
      .filter((r) => {
        const competitor =
          r["Competitor"] != null
            ? String(r["Competitor"]).trim().toLowerCase()
            : "";
        return competitor.includes("canco");
      })
      .map((r) =>
        r["Competitor Price"] != null
          ? parseFloat(r["Competitor Price"])
          : null,
      )
      .filter((p) => p !== null && !isNaN(p));

    if (cancoPrices.length === 0) {
      return { recPrice: null, explanation: "By adding 12% margin to the Landed cost" };
    }

    const highestCancoPrice = Math.max(...cancoPrices);
    const finalPrice = parseFloat((highestCancoPrice - 0.02).toFixed(4));

    return {
      recPrice: finalPrice,
      explanation: "Calculated by taking the highest Canco competitor price and subtracting 2 cents."
    };
  }

  return { recPrice: null, explanation: "By adding 12% margin to the Landed cost" };
}

module.exports = { calculateCustomRecPrice };