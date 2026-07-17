// --- CONFIGURATION ---
const PUSHOVER_API_TOKEN = "anc3ciu57a97bkd93m63dqgk9n6z7z";
const PUSHOVER_USER_KEY = "g2i28r276oziftoqhi5x8op31a3kkg";
const TEST_DEVICE_NAME = "test_tablet_1"; // Must match what you named it in the app

/**
 * Clean, isolated function to manually trigger your fuel price alarm
 */
async function sendManualFuelAlarm(priceString) {
  const url = "https://api.pushover.net/1/messages.json";

  const payload = {
    token: PUSHOVER_API_TOKEN,
    user: PUSHOVER_USER_KEY,
    device: TEST_DEVICE_NAME,
    title: "🔔 Attention: Fuel Price Sync Required",
    message: `A new price update (${priceString}) is ready. Click acknowledge to silence.`,

    // Keep priority 2 so the Acknowledge button and loop are active
    priority: 2,
    retry: 30, // Re-chime every 60 seconds if ignored
    expire: 600, // Safety cutoff after 10 minutes

    // --- The Soft Audio Fix ---
    sound: "echo"
  };

  try {
    console.log(`Sending alert to device: "${TEST_DEVICE_NAME}"...`);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (response.ok && data.status === 1) {
      console.log("✅ Success! Alarm successfully queued and sent to tablet.");
    } else {
      console.error("❌ Pushover API Error:", data.errors || data);
    }
  } catch (error) {
    console.error("❌ Network or Execution Error:", error.message);
  }
}

// // --- RUN THE FUNCTION MANUALLY ---
// // Change this string to whatever test price you want to display
sendManualFuelAlarm("$1.42/L Regular");