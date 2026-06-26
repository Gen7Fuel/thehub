// testGasBuddy.js
const dotenv = require("dotenv");
const { postPricesToGasBuddy } = require("../utils/gasBuddyScrapper");

// Explicitly pull your credential details out of your .env mapping layer
dotenv.config();

async function runTest() {
  console.log("Starting isolated test runner...");

  // Mock payload containing a real/sample GasBuddy Station ID and prices
  const testPayload = {
    gasBuddyStationId: "205339", // Replace with a valid test station ID from GasBuddy
    prices: {
      "Regular": 1.568,
      "Mid Grade": 1.758,
      "Diesel": 1.868,
      "Premium": 1.868
    }
  };

  try {
    await postPricesToGasBuddy(testPayload);
    console.log("🎉 Isolated test completed with no errors thrown!");
  } catch (err) {
    console.error("💥 Execution halted via harness:", err);
  }
}

runTest();