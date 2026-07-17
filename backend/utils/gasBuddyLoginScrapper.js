const { chromium } = require("playwright-extra");
const stealth = require("puppeteer-extra-plugin-stealth")();
const path = require("path");
const fs = require("fs");
const GasBuddySession = require("../models/GasBuddySession"); 
const { emailQueue } = require("../queues/emailQueue");

// Import the CDN helper function dynamically from your main scraper
// (Ensures we don't duplicate upload logic across files)
const { uploadToCdn } = require("./gasBuddyScrapper");

// Ensure environment variables are loaded if running locally
require("dotenv").config();

// Hook stealth plugin to mask automation footprint
chromium.use(stealth);

/**
 * Automates GasBuddy login and saves session states directly to MongoDB.
 * @param {number} attempt - Current retry attempt index passed from the orchestrator loop.
 */
async function runAutoLogin(attempt = 1) {
  console.log("=====================================================================");
  console.log(`🤖 STARTING AUTOMATED GASBUDDY LOGIN PIPELINE (Attempt: ${attempt}/3)`);
  console.log("=====================================================================");

  const email = process.env.GASBUDDY_EMAIL;
  const password = process.env.GASBUDDY_PASSWORD;

  if (!email || !password) {
    console.error("❌ ERROR: Missing GASBUDDY_EMAIL or GASBUDDY_PASSWORD in environment variables!");
    process.exit(1);
  }

  // Determine chromium path inside your Docker / container environment
  const systemChromiumPath = fs.existsSync("/usr/bin/chromium-browser")
    ? "/usr/bin/chromium-browser"
    : fs.existsSync("/usr/bin/chromium")
      ? "/usr/bin/chromium"
      : undefined;

  console.log(`⚙️  Chromium Executable Path: ${systemChromiumPath || "Default Playwright bundled browser"}`);

  // Launching in headless mode inside the container
  const browser = await chromium.launch({
    headless: true,
    executablePath: systemChromiumPath,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled",
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1400, height: 1000 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });

  const page = await context.newPage();

  try {
    console.log("🔗 Step 1: Navigating to GasBuddy Business Login Portal...");
    await page.goto("https://dashboard.gasbuddybusiness.io/login.html", {
      waitUntil: "networkidle",
      timeout: 60000,
    });

    console.log("🔍 Step 2: Waiting for form inputs to load in DOM...");
    const emailInput = page.locator('form input[name="email"]');
    const passwordInput = page.locator('form input[type="password"]');
    const signInButton = page.locator('form button[type="submit"]');

    await emailInput.waitFor({ state: "visible", timeout: 15000 });
    await passwordInput.waitFor({ state: "visible", timeout: 15000 });

    // Introduce a brief human delay
    await page.waitForTimeout(1000 + Math.random() * 1000);

    console.log(`✍️  Step 3: Simulating human keyboard entry for email...`);
    await emailInput.focus();
    await page.keyboard.press("Control+A");
    await page.keyboard.press("Backspace");
    await page.keyboard.type(email, { delay: 100 + Math.random() * 100 });

    await page.waitForTimeout(500 + Math.random() * 500);

    console.log("✍️  Step 4: Simulating human keyboard entry for password...");
    await passwordInput.focus();
    await page.keyboard.press("Control+A");
    await page.keyboard.press("Backspace");
    await page.keyboard.type(password, { delay: 90 + Math.random() * 90 });

    await page.waitForTimeout(800 + Math.random() * 500);

    console.log("🚀 Step 5: Dispatched Click Handshake on [Sign In] Button...");
    await signInButton.hover();
    await page.waitForTimeout(150 + Math.random() * 150);
    await signInButton.click();

    console.log("⏳ Step 6: Waiting for backend redirect authentication handshakes...");
    await Promise.race([
      page.waitForURL("**/client/home.html**", { timeout: 45000 }),
      page.waitForURL("**/client/station-profiles**", { timeout: 45000 })
    ]);

    console.log("⏱️  Step 7: Pausing 10s for authorization storage states to settle...");
    await page.waitForTimeout(10000);

    console.log("📸 Step 8: Capturing and uploading validation screenshot directly to CDN...");
    const successBuffer = await page.screenshot({ fullPage: true });
    const successCdnUrl = await uploadToCdn(successBuffer, `login_success_proof_${Date.now()}.png`);
    
    if (successCdnUrl) {
      console.log(`🖼️  Login success proof uploaded to CDN: ${successCdnUrl}`);
    }

    console.log("💾 Step 9: Serializing state memory directly to MongoDB...");
    const freshState = await context.storageState(); 

    await GasBuddySession.findOneAndUpdate(
      { key: "production_session" },
      { stateData: freshState, updatedAt: new Date() },
      { upsert: true, new: true }
    );
    console.log("🎉 SUCCESS: Auth state successfully committed to Database!");

  } catch (error) {
    console.error(`❌ CRITICAL EXCEPTION MET DURING LOGIN SEQUENCE ON ATTEMPT ${attempt}:`, error);

    // Only upload screenshot and send emails on the 3rd final retry
    if (attempt === 3) {
      console.log("🚨 Attempt 3 failed! Generating and sending critical error report...");
      let emergencyCdnUrl = "";

      try {
        const errorBuffer = await page.screenshot({ fullPage: true });
        emergencyCdnUrl = await uploadToCdn(errorBuffer, `login_failure_attempt_3_${Date.now()}.png`);
        console.log(`📸 Failure proof asset committed to CDN: ${emergencyCdnUrl}`);
      } catch (ssErr) {
        console.error("Unable to execute memory buffer screenshot dump:", ssErr);
      }

      // Email dispatch
      const loginAlertHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #dc2626; border-radius: 16px; background-color: #ffffff;">
          <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #991b1b; margin: 0 0 8px 0; font-size: 16px; font-weight: 800; text-transform: uppercase;">
              ⚠️ Critical: GasBuddy Automated Login Pipeline Exceeded Retries
            </h2>
            <p style="color: #b91c1c; margin: 0; font-size: 14px; font-weight: 600; line-height: 1.5;">
              The self-healing automated login function failed 3 consecutive times during runtime execution.
            </p>
          </div>

          <div style="margin-bottom: 24px; background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 14px; border-radius: 8px;">
            <strong style="color: #0f172a; font-size: 13px; text-transform: uppercase;">Error Details:</strong>
            <p style="font-family: monospace; font-size: 13px; color: #ef4444; margin: 8px 0 0 0; white-space: pre-wrap;">
              ${error.message}
            </p>
          </div>

          ${emergencyCdnUrl ? `
            <div style="margin-bottom: 24px; text-align: center;">
              <a href="${emergencyCdnUrl}" target="_blank"
                 style="display: inline-block; background-color: #dc2626; color: #ffffff; padding: 12px 20px; font-weight: bold; font-size: 13px; text-decoration: none; border-radius: 8px; text-transform: uppercase;">
                 🔍 View Login Error Screenshot Evidence
              </a>
            </div>
          ` : `
            <p style="font-size: 12px; color: #94a3b8; font-style: italic; margin-bottom: 24px;">
              Note: Could not capture diagnostic screenshot because browser context crashed.
            </p>
          `}

          <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; text-align: center;">
            <span style="font-size: 11px; color: #94a3b8; font-style: italic;">
              Automated operational alert pipeline — Gen 7 Fuel Hub System Engine.
            </span>
          </div>
        </div>
      `;

      await emailQueue.add(`gasbuddy-login-error-${Date.now()}`, {
        to: "daksh@gen7fuel.com",
        subject: "🚨 Critical: GasBuddy Autologin Failure Exhausted Retries",
        html: loginAlertHtml,
      });

      console.log("📧 Critical login failure email queued up successfully via BullMQ.");
    } else {
      console.log(`ℹ️ Attempt ${attempt} failed. Suppressing screenshots and email reports until retry limits are hit.`);
    }

    throw error;
  } finally {
    await browser.close();
    console.log("🔌 Browser engine context disposed.");
  }
}

// Run if called directly
if (require.main === module) {
  runAutoLogin(1).catch((err) => {
    console.error("Fatal run-state exception:", err);
    process.exit(1);
  });
}

module.exports = { runAutoLogin };