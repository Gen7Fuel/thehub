const fs = require("fs");
const { chromium } = require("playwright-extra");
const stealth = require("puppeteer-extra-plugin-stealth")();
const path = require("path");
const { emailQueue } = require("../queues/emailQueue"); // 💡 Integrated email background queue

chromium.use(stealth);

/**
 * Helper function to pipe a screenshot buffer directly into the isolated CDN container
 * without touching your local repository's directory structure.
 */
async function uploadToCdn(fileBuffer, originalName) {
  try {
    const formData = new FormData();
    const fileBlob = new Blob([fileBuffer], { type: "image/png" });
    formData.append("file", fileBlob, originalName);

    const response = await fetch("http://cdn:5001/cdn/upload", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`CDN server dropped connection with status: ${response.status}`);
    }

    const data = await response.json();
    return `http://app.gen7fuel.com/cdn/download/${data.filename}`;
  } catch (error) {
    console.error("❌ Secondary Pipeline Error: Failed uploading image asset to CDN:", error);
    return null;
  }
}

/**
 * Core Playwright Engine to pipe the generated memory buffer straight into Petrosoft
 */
async function uploadInventoryToPetrosoft({
  targetStationCsoCode,
  csvFileBuffer,
}) {
  console.log(`🤖 Initializing Petrosoft Pipeline Context for Station ID: ${targetStationCsoCode}...`);

  // Detect server/container native environment binaries automatically
  const systemChromiumPath =
    process.env.CHROMIUM_PATH ||
    (fs.existsSync("/usr/bin/chromium-browser")
      ? "/usr/bin/chromium-browser"
      : fs.existsSync("/usr/bin/chromium")
        ? "/usr/bin/chromium"
        : undefined);

  console.log(`🌐 Pointing Playwright execution matrix to browser binary: ${systemChromiumPath || "Default Playwright Cache"}`);

  const browser = await chromium.launch({
    headless: true,
    executablePath: systemChromiumPath,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1400, height: 1000 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });

  const page = await context.newPage();

  try {
    // Auth Gateway
    const loginUrl = "https://03.cstoreoffice.com";
    await page.goto(loginUrl, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForSelector("#username", {
      state: "visible",
      timeout: 15000,
    });
    await page.fill("#username", process.env.PETROSOFT_USERNAME);
    await page.fill("#password", process.env.PETROSOFT_PASSWORD);
    await page.click("#kc-login");
    await page.waitForLoadState("networkidle");

    // Dynamic Station Redirect
    const importUrl = `https://03.cstoreoffice.com/app.php/inventory/import/${targetStationCsoCode}`;
    await page.goto(importUrl, { waitUntil: "load" });
    await page.waitForSelector("#oItemsFile", {
      state: "visible",
      timeout: 15000,
    });

    console.log("📂 Injecting dynamic in-memory CSV buffer parameters directly into file input node...");

    await page.setInputFiles("#oItemsFile", {
      name: `INV_${targetStationCsoCode}_${Date.now()}.csv`,
      mimeType: "text/csv",
      buffer: csvFileBuffer,
    });

    const uploadButton = page.locator("#btnSubmit");
    await uploadButton.waitFor({ state: "visible", timeout: 5000 });
    await uploadButton.click();

    // Verify Success Response
    const successCloseBtn = page.locator('button.btn:has-text("Close Window")');
    await successCloseBtn.waitFor({ state: "visible", timeout: 30000 });
    console.log("✅ Petrosoft API upload handshake accepted.");

    // Direct routing checkpoint capture
    const trackingManagerUrl = `https://03.cstoreoffice.com/Inventory/inventorymanager/?Station=${targetStationCsoCode}#`;
    await page.goto(trackingManagerUrl, {
      waitUntil: "networkidle",
      timeout: 45000,
    });
    await page.waitForTimeout(4000); // Let UI finish painting lists

    // 📸 SUCCESS BUFFER SNAPSHOT -> CDN PIPELINE
    const successBuffer = await page.screenshot({ fullPage: true });
    const successCdnUrl = await uploadToCdn(successBuffer, `petrosoft_sync_verified_${targetStationCsoCode}.png`);
    
    if (successCdnUrl) {
      console.log(`🎉 Audit track uploaded directly to CDN: ${successCdnUrl}`);
    }

    return { success: true, screenshotUrl: successCdnUrl };
  } catch (error) {
    console.error("❌ CRITICAL EXCEPTION IN PETROSOFT AUTOMATION PIPELINE:", error);
    
    let emergencyCdnUrl = "";
    try {
      // 📸 FAILURE BUFFER SNAPSHOT -> CDN PIPELINE
      const errorBuffer = await page.screenshot({ fullPage: true });
      emergencyCdnUrl = await uploadToCdn(errorBuffer, `petrosoft_err_${targetStationCsoCode}.png`);
    } catch (ssErr) {
      console.error("Unable to execute memory buffer screenshot dump:", ssErr);
    }

    // 📬 FORMAT INCIDENT NOTIFICATION MARKUP
    const systemAlertHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #f87171; border-radius: 16px; background-color: #ffffff;">
        <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
          <h2 style="color: #991b1b; margin: 0 0 8px 0; font-size: 16px; font-weight: 800; text-transform: uppercase;">
            ⚠️ Critical: Petrosoft Cycle Count Upload Failure
          </h2>
          <p style="color: #b91c1c; margin: 0; font-size: 14px; font-weight: 600; line-height: 1.5;">
            An exception interrupted the automated browser process pushing counts to Petrosoft for Station CSO Code: <strong>${targetStationCsoCode}</strong>.
          </p>
        </div>

        <div style="margin-bottom: 24px; background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 14px; border-radius: 8px;">
          <strong style="color: #0f172a; font-size: 13px; text-transform: uppercase;">Error Technical Details:</strong>
          <p style="font-family: monospace; font-size: 13px; color: #ef4444; margin: 8px 0 0 0; white-space: pre-wrap;">
            ${error.message}
          </p>
        </div>

        ${emergencyCdnUrl ? `
          <div style="margin-bottom: 24px; text-align: center;">
            <a href="${emergencyCdnUrl}" target="_blank"
               style="display: inline-block; background-color: #dc2626; color: #ffffff; padding: 12px 20px; font-weight: bold; font-size: 13px; text-decoration: none; border-radius: 8px; text-transform: uppercase;">
              🔍 View Petrosoft Diagnostic Screenshot
            </a>
          </div>
        ` : `
          <p style="font-size: 12px; color: #94a3b8; font-style: italic; margin-bottom: 24px;">
            Note: Could not capture diagnostic screenshot because browser rendering context crashed or hung.
          </p>
        `}

        <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; text-align: center;">
          <span style="font-size: 11px; color: #94a3b8; font-style: italic;">
            Automated operational alert pipeline — Gen 7 Fuel Hub System Engine.
          </span>
        </div>
      </div>
    `;

    // Queue the mail drop task immediately
    await emailQueue.add(`petrosoft-error-${Date.now()}`, {
      to: "daksh@gen7fuel.com",
      subject: `🚨 Hub Automation Sync Failure (Petrosoft Station: ${targetStationCsoCode})`,
      html: systemAlertHtml
    });

    console.log("📧 Exception notification successfully offloaded to emailQueue channels.");
    throw error;
  } finally {
    await browser.close();
  }
}

module.exports = { uploadInventoryToPetrosoft };