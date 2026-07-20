/**
 * Sends critical operational alerts to all active devices assigned to a specific store location.
 */
async function sendOperationalFuelAlarm({ pushOverUserKey, devices, stationName }) {
  if (!pushOverUserKey) {
    console.warn(`⚠️ [Pushover] Skipping broadcast: No pushOverUserKey found for site ${stationName}`);
    return;
  }

  // Filter out any devices explicitly muted by management
  const activeDevices = (devices || [])
    .filter(d => d.notificationEnabled === true)
    .map(d => d.deviceName);

  if (activeDevices.length === 0) {
    console.warn(`⚠️ [Pushover] All push notifications for ${stationName} are currently toggled off.`);
    return;
  }

  const url = "https://api.pushover.net/1/messages.json";
  
  // Format the notice cleanly without injecting raw price variations
  const structuredMessage = 
    `STATION SITE: ${stationName}\n` +
    `STATUS: Awaiting Bulloch & InfoNet Snapshots\n\n` +
    `Please log into the Hub on your station account, finalize the price adjustments on your physical POS registers, and upload the required receipt imagery to complete the audit cycle.`;

  // Process all active target tablets concurrently
  const pushPromises = activeDevices.map(async (deviceName) => {
    const payload = {
      token: process.env.PUSHOVER_API_TOKEN, // Pulled cleanly via system variables
      user: pushOverUserKey,
      device: deviceName,
      title: "🔔 Notice: Fuel Prices Updated",
      message: structuredMessage,
      priority: 2,      // Enforces loop mechanics & mandatory acknowledge button
      retry: 30,        // Re-chimes every 30 seconds if ignored on floor
      expire: 600,      // Automatic hard cutoff after 10 minutes 
      sound: "echo"     // Smooth 3-second non-irritating background sound
    };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (response.ok && data.status === 1) {
        console.log(`✅ [Pushover] Alarm successfully routed to device "${deviceName}" for ${stationName}.`);
      } else {
        console.error(`❌ [Pushover] API Exception on device "${deviceName}":`, data.errors || data);
      }
    } catch (error) {
      console.error(`❌ [Pushover] Request crash on device "${deviceName}":`, error.message);
    }
  });

  await Promise.all(pushPromises);
}

module.exports = { sendOperationalFuelAlarm };