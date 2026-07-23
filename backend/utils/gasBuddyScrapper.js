const { chromium } = require("playwright-extra");
const stealth = require("puppeteer-extra-plugin-stealth")();
const fs = require("fs");
const path = require("path");
const { emailQueue } = require("../queues/emailQueue");
const GasBuddySession = require("../models/GasBuddySession"); 
const { uploadToCdn } = require("./uploadToCdn");
const { runAutoLogin } = require("./gasBuddyLoginScrapper"); // Imports your automated DB login script

// Inject stealth mode to mask Playwright's automation footprints
chromium.use(stealth);

/**
 * Helper function to pipe a screenshot buffer directly into the isolated CDN container
 */
// async function uploadToCdn(fileBuffer, originalName) {
//   try {
//     const formData = new FormData();
//     const fileBlob = new Blob([fileBuffer], { type: "image/png" });
//     formData.append("file", fileBlob, originalName);

//     const response = await fetch("http://cdn:5001/cdn/upload", {
//       method: "POST",
//       body: formData,
//     });

//     if (!response.ok) {
//       throw new Error(`CDN server dropped connection with status: ${response.status}`);
//     }

//     const data = await response.json();
//     return `https://app.gen7fuel.com/cdn/download/${data.filename}`;
//   } catch (error) {
//     console.error("❌ Secondary Pipeline Error: Failed uploading image asset to CDN:", error);
//     return null; 
//   }
// }

/**
 * Core Price Submission Runner
 * Pulls session data from MongoDB, writes to a temporary local file, and executes the browser run.
 */
async function attemptPricePost({ gasBuddyStationId, prices }) {
  console.log("🤖 Initializing Headless Execution via Live Database States...");

// 1. Fetch live storage state directly from MongoDB
  const sessionDoc = await GasBuddySession.findOne({ key: "production_session" });
  if (!sessionDoc || !sessionDoc.stateData) {
    throw new Error("AUTHENTICATION_EXPIRED: No session found in the database.");
  }

  const systemChromiumPath = fs.existsSync("/usr/bin/chromium-browser")
    ? "/usr/bin/chromium-browser"
    : fs.existsSync("/usr/bin/chromium")
      ? "/usr/bin/chromium"
      : undefined;

  const browser = await chromium.launch({
    headless: true,
    executablePath: systemChromiumPath,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-blink-features=AutomationControlled"
    ]
  });

  // 2. Pass the MongoDB object directly into storageState in memory!
  const context = await browser.newContext({
    storageState: sessionDoc.stateData, // 👈 Directly injected from Mongo, no temp file needed!
    viewport: { width: 1400, height: 1000 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  });

  const page = await context.newPage();

  try {
    const businessUrl = `https://dashboard.gasbuddybusiness.io/client/station-profiles/station-profile?stationId=${gasBuddyStationId}`;
    console.log(`🔗 Navigating to Corporate Portal: ${businessUrl}`);

    await page.goto(businessUrl, { waitUntil: "networkidle", timeout: 60000 });

    // --- CRITICAL AUTODETECT CHECKS ---
    // Check if redirect properties indicate our token package is dead
    const currentUrl = page.url();
    const hasRedirectedToLogin = currentUrl.includes("login.html") || currentUrl.includes("iam.gasbuddy.com");
    
    // Fallback: Check if a login input field is visible in the viewport
    const loginInputExists = await page.locator('input[type="email"]').isVisible().catch(() => false);

    if (hasRedirectedToLogin || loginInputExists) {
      throw new Error("AUTHENTICATION_EXPIRED: Your GasBuddy session has expired or been revoked. Redirected to login.");
    }

    console.log("⏱️ Standing by for 5 seconds to let state data render completely...");
    await page.waitForTimeout(5000);

    const editBtnSelector = 'div.panel__panel___3Q2zW:has(h3:has-text("PRICES")) button.styles__buttonIcon___3NfYt';
    const editButton = page.locator(editBtnSelector).first();

    if (!(await editButton.isVisible())) {
      throw new Error("DOM_ELEMENT_MISSING: Price control card or modal edit pencil element couldn't be indexed on the workspace UI.");
    }

    console.log("✏️ Clicking the Price Configuration Card edit control node...");
    await editButton.click();

    const dialogModal = page
      .locator('div[role="dialog"][aria-modal="true"]:visible')
      .filter({ hasText: 'PRICES' })
      .first();

    await page.waitForTimeout(1000); 
    await dialogModal.waitFor({ state: "visible", timeout: 8000 });
    console.log("🔓 Pricing operational modification dialog overlay opened.");

    let updatesCommitted = 0;

    for (let [fuelType, rawPrice] of Object.entries(prices)) {
      if (rawPrice === undefined || rawPrice === null) continue;

      let normalizedFuelType = fuelType.trim();
      if (normalizedFuelType.toLowerCase().replace(/[\s-]/g, "") === "midgrade") {
        normalizedFuelType = "Midgrade";
      }

      const fuelColumn = dialogModal.locator(`div.grid__column___nhz7X:has(h5:text-is("${normalizedFuelType}"))`);

      if (await fuelColumn.count() === 0) {
        console.log(`⚠️ Grade column label matching [${fuelType}] (${normalizedFuelType}) wasn't identified. Skipping.`);
        continue;
      }

      const inputField = fuelColumn.locator('input[placeholder="Enter Price"]');

      if (await inputField.isVisible()) {
        const targetPriceString = String(rawPrice);

        await inputField.focus();
        await page.keyboard.press('Control+A');
        await page.keyboard.press('Meta+A');
        await page.keyboard.press('Backspace');

        await inputField.type(targetPriceString, { delay: 100 });

        const confirmButton = fuelColumn.locator('button:has-text("Confirm")');
        if (await confirmButton.isVisible()) {
          await confirmButton.click();
          console.log(` Staged change for ${normalizedFuelType} -> [${targetPriceString}]`);
          updatesCommitted++;
        } else {
          await inputField.dispatchEvent('change');
          await inputField.dispatchEvent('blur');
          updatesCommitted++;
        }
      }
    }

    const autoUpdateLabel = dialogModal.locator('label:has-text("Auto-update the price(s) for this price submission for today?")');
    const autoUpdateCheckbox = dialogModal.locator('div.checkbox__checkbox___2QDLE input[type="checkbox"]');

    if (await autoUpdateLabel.isVisible()) {
      const isAlreadyChecked = await autoUpdateCheckbox.isChecked({ force: true });
      if (!isAlreadyChecked) {
        console.log("📌 Syncing auto-update daily price locking toggle state to [ACTIVE]...");
        await autoUpdateLabel.click();
      } else {
        console.log("ℹ️ Auto-update price locking option toggle is already checked.");
      }
    }

    if (updatesCommitted > 0) {
      const saveButton = dialogModal.locator('button:has-text("Save Changes")');
      await page.waitForTimeout(500);

      if (!(await saveButton.isDisabled())) {
        console.log("🚀 Dispatched initial 'Save Changes' layer...");
        await saveButton.click();

        const confirmationModal = page.locator('div[role="dialog"][aria-modal="true"]').filter({ hasText: 'Confirm Price Submission' });

        try {
          await confirmationModal.waitFor({ state: "visible", timeout: 4000 });
          console.log("✋ Secondary confirmation barrier detected.");

          const submitPricesBtn = confirmationModal.locator('button:has-text("Submit Prices")');
          if (await submitPricesBtn.isVisible()) {
            await submitPricesBtn.click();
            console.log("🔥 Final 'Submit Prices' handshake executed successfully!");
          }
        } catch (e) {
          console.log("ℹ️ No secondary confirmation barrier appeared. Relying on primary ledger save.");
        }

        console.log(" Freezing executor loop 5 seconds to cycle final updates...");
        await page.waitForTimeout(5000);

        // 📸 AUDIT SUCCESS SCREENSHOT -> MEMORY BUFFER -> CDN CONTAINER
        const successBuffer = await page.screenshot();
        const cdnUrl = await uploadToCdn(successBuffer, `submission_proof_${gasBuddyStationId}.png`);

        if (cdnUrl) {
          console.log(`🎉 Success asset uploaded directly to CDN: ${cdnUrl}`);
        }

        // Capture newest storageState details and update MongoDB session doc
        const freshState = await context.storageState();
        await GasBuddySession.findOneAndUpdate(
          { key: "production_session" },
          { stateData: freshState, updatedAt: new Date() },
          { upsert: true }
        );
        console.log(`🎉 Success: Successfully executed (${updatesCommitted}) pricing updates on GasBuddy!`);
      } else {
        throw new Error('LEDGER_LOCKED: Save changes button context is locked or disabled in the DOM view.');
      }
    } else {
      console.log('🏁 Process wrapped: 0 structural values required active writing updates.');
    }

  } catch (error) {
    // If we throw outside, capture screenshot state for analysis
    let errorBuffer = null;
    try {
      errorBuffer = await page.screenshot({ fullPage: true });
    } catch (ssErr) {
      console.error("Unable to execute memory buffer screenshot dump:", ssErr);
    }
    
    // Attach screenshot buffer to error object to pass up to orchestrator
    error.screenshotBuffer = errorBuffer;
    throw error;
  } finally {
    await browser.close();
  }
}

/**
 * 🚀 ORCHESTRATOR / SELF-HEALING PUBLIC EXPORT
 * Safely calls our core update runner, catches auth errors, refreshes login via DB, and retries up to 3 times.
 */
async function postPricesToGasBuddy({ gasBuddyStationId, prices }) {
  const MAX_RETRIES = 3;
  let attempt = 0;
  let lastError = null;

  while (attempt < MAX_RETRIES) {
    attempt++;
    console.log(`🔄 [Attempt ${attempt}/${MAX_RETRIES}] Posting prices for Station ID: ${gasBuddyStationId}...`);

    try {
      // Execute pricing post
      await attemptPricePost({ gasBuddyStationId, prices });
      return; // Execution succeeded! Break and exit.

    } catch (error) {
      lastError = error;
      console.warn(`⚠️ Warning: Exception met during attempt ${attempt}:`, error.message);

      const isTokenError = error.message.includes("AUTHENTICATION_EXPIRED");

      if (isTokenError && attempt < MAX_RETRIES) {
        console.log("🔑 Session expired or missing. Initializing automated login pipeline...");
        try {
          // Pass current loop's attempt index straight into the login scraper!
          await runAutoLogin(attempt);
          console.log("✅ Automated login completed. Retrying price submission with the new credentials...");
          continue; // Move to next iteration of the while loop with a fresh session
        } catch (loginError) {
          console.error("❌ Failed executing self-healing automated login:", loginError.message);
          // If login itself fails, do not proceed with next loop; bubble up the login exception
          lastError = loginError;
          break; 
        }
      } else {
        // If it's a DOM/Layout failure or we have run out of retry allocations, exit the loop immediately
        break;
      }
    }
  }

  // --- ESCALATION ALERT DISPATCH CHANNEL ---
  // If we exit the loop, execution failed. Let's send an alert email.
  console.error(`🚨 PRICE POSTING ENGINES EXHAUSTED ALL RUNS. dispatching alert diagnostics...`);

  let emergencyCdnUrl = "";
  if (lastError.screenshotBuffer) {
    emergencyCdnUrl = await uploadToCdn(lastError.screenshotBuffer, `failure_error_${gasBuddyStationId}.png`);
  }

  const isTokenError = lastError.message.includes("AUTHENTICATION_EXPIRED");
  const errorTypeLabel = isTokenError ? "GasBuddy Session Expired (Retry Limit Exceeded)" : "GasBuddy Execution Failure";

  const systemAlertHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #f87171; border-radius: 16px; background-color: #ffffff;">
      <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
        <h2 style="color: #991b1b; margin: 0 0 8px 0; font-size: 16px; font-weight: 800; text-transform: uppercase;">
          ⚠️ Critical: ${errorTypeLabel}
        </h2>
        <p style="color: #b91c1c; margin: 0; font-size: 14px; font-weight: 600; line-height: 1.5;">
          An exception interrupted the background sync process for GasBuddy Station ID: <strong>${gasBuddyStationId}</strong>.
        </p>
      </div>

      <div style="margin-bottom: 24px; background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 14px; border-radius: 8px;">
        <strong style="color: #0f172a; font-size: 13px; text-transform: uppercase;">Error Technical Details:</strong>
        <p style="font-family: monospace; font-size: 13px; color: #ef4444; margin: 8px 0 0 0; white-space: pre-wrap;">
          ${lastError.message}
        </p>
      </div>

      ${emergencyCdnUrl ? `
        <div style="margin-bottom: 24px; text-align: center;">
          <a href="${emergencyCdnUrl}" target="_blank"
             style="display: inline-block; background-color: #dc2626; color: #ffffff; padding: 12px 20px; font-weight: bold; font-size: 13px; text-decoration: none; border-radius: 8px; text-transform: uppercase;">
             🔍 View Diagnostic Screenshot Evidence
          </a>
        </div>
      ` : `
        <p style="font-size: 12px; color: #94a3b8; font-style: italic; margin-bottom: 24px;">
          Note: Could not capture diagnostic screenshot because browser rendering context crashed.
        </p>
      `}

      <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; text-align: center;">
        <span style="font-size: 11px; color: #94a3b8; font-style: italic;">
          Automated operational alert pipeline — Gen 7 Fuel Hub System Engine.
        </span>
      </div>
    </div>
  `;

  await emailQueue.add(`gasbuddy-error-${Date.now()}`, {
    to: "daksh@gen7fuel.com",
    subject: `🚨 Hub Automation Sync Failure (Station: ${gasBuddyStationId})`,
    html: systemAlertHtml
  });

  console.log("📧 Exception notification successfully offloaded to BullMQ framework channels.");
  throw lastError;
}

module.exports = { postPricesToGasBuddy, uploadToCdn };
// const { chromium } = require("playwright-extra");
// const stealth = require("puppeteer-extra-plugin-stealth")();
// const fs = require("fs");
// const path = require("path");
// const { emailQueue } = require("../queues/emailQueue");
// const GasBuddySession = require("../models/GasBuddySession"); 
// const { runAutoLogin } = require("./gasBuddyLoginScrapper");

// // Inject stealth mode to mask Playwright's automation footprints
// chromium.use(stealth);

// /**
//  * Helper function to pipe a screenshot buffer directly into the isolated CDN container
//  * without touching your local repository's directory structure.
//  */
// async function uploadToCdn(fileBuffer, originalName) {
//   try {
//     const formData = new FormData();
//     // Convert memory buffer into a Blob format that fetch's FormData consumes natively
//     const fileBlob = new Blob([fileBuffer], { type: "image/png" });
//     formData.append("file", fileBlob, originalName);

//     // Hit the local CDN microservice container port (5001)
//     const response = await fetch("http://cdn:5001/cdn/upload", {
//       method: "POST",
//       body: formData,
//     });

//     if (!response.ok) {
//       throw new Error(`CDN server dropped connection with status: ${response.status}`);
//     }

//     const data = await response.json();
//     // Returns the clean accessibility URL link pointing to the file ID on your CDN
//     return `https://app.gen7fuel.com/cdn/download/${data.filename}`;
//   } catch (error) {
//     console.error("❌ Secondary Pipeline Error: Failed uploading image asset to CDN:", error);
//     return null; // Don't break the main thread if just the CDN upload fails
//   }
// }

// async function postPricesToGasBuddy({ gasBuddyStationId, prices }) {
//   console.log("🤖 Initializing Headless Production Engine via Business State Ledger...");

//   const sessionPath = path.resolve(__dirname, "../sessions/gasBuddy/gasbuddy-state.json");

//   if (!fs.existsSync(sessionPath)) {
//     throw new Error(`❌ Missing session file! Please execute your login generator to create: ${sessionPath}`);
//   }

//   const systemChromiumPath = fs.existsSync("/usr/bin/chromium-browser")
//     ? "/usr/bin/chromium-browser"
//     : fs.existsSync("/usr/bin/chromium")
//       ? "/usr/bin/chromium"
//       : undefined;

//   const browser = await chromium.launch({
//     headless: true,
//     executablePath: systemChromiumPath,
//     args: [
//       "--no-sandbox",
//       "--disable-setuid-sandbox",
//       "--disable-dev-shm-usage"
//     ]
//   });

//   const context = await browser.newContext({
//     storageState: sessionPath,
//     viewport: { width: 1400, height: 1000 },
//     userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
//   });

//   const page = await context.newPage();

//   try {
//     const businessUrl = `https://dashboard.gasbuddybusiness.io/client/station-profiles/station-profile?stationId=${gasBuddyStationId}`;
//     console.log(`🔗 Navigating to Corporate Portal: ${businessUrl}`);

//     await page.goto(businessUrl, { waitUntil: "networkidle", timeout: 60000 });

//     // Check if authentication tokens died and tripped redirect interception parameters
//     if (page.url().includes("login.html") || page.url().includes("iam.gasbuddy.com")) {
//       throw new Error("AUTHENTICATION_EXPIRED: Your gasbuddy-state.json tokens have expired or been revoked by the gateway.");
//     }

//     console.log("⏱️ Standing by for 5 seconds to let state data render completely...");
//     await page.waitForTimeout(5000);
//     // =========================================================================
//     // TESTING LAYER: CHOOSE ONE OF THE LINES BELOW TO RUN YOUR CYCLES
//     // =========================================================================

//     // ❌ TEST LINE (Causes a DOM_ELEMENT_MISSING error by breaking the selector name)
//     // const editBtnSelector = 'div.panel__panel___INVALID_SELECTOR_TESTING:has(h3:has-text("PRICES")) button.styles__buttonIcon___3NfYt';

//     // ✅ CORRECT PRODUCTION LINE (Commented out during your active testing rounds)
//     const editBtnSelector = 'div.panel__panel___3Q2zW:has(h3:has-text("PRICES")) button.styles__buttonIcon___3NfYt';

//     // =========================================================================

//     const editButton = page.locator(editBtnSelector).first();

//     if (!(await editButton.isVisible())) {
//       throw new Error("DOM_ELEMENT_MISSING: Price control card or modal edit pencil element couldn't be indexed on the workspace UI.");
//     }

//     console.log("✏️ Clicking the Price Configuration Card edit control node...");
//     await editButton.click();

//     // ⚡ FIX: Add the :visible pseudo-class filter and grab the primary active layer node
//     const dialogModal = page
//       .locator('div[role="dialog"][aria-modal="true"]:visible')
//       .filter({ hasText: 'PRICES' })
//       .first();

//     // Give the layout engine a split-second transition buffer to fully settle the animation
//     await page.waitForTimeout(1000); 

//     await dialogModal.waitFor({ state: "visible", timeout: 8000 });
//     console.log("🔓 Pricing operational modification dialog overlay opened.");

//     let updatesCommitted = 0;

//     for (let [fuelType, rawPrice] of Object.entries(prices)) {
//       if (rawPrice === undefined || rawPrice === null) continue;

//       let normalizedFuelType = fuelType.trim();
//       if (normalizedFuelType.toLowerCase().replace(/[\s-]/g, "") === "midgrade") {
//         normalizedFuelType = "Midgrade";
//       }

//       const fuelColumn = dialogModal.locator(`div.grid__column___nhz7X:has(h5:text-is("${normalizedFuelType}"))`);

//       if (await fuelColumn.count() === 0) {
//         console.log(`⚠️ Grade column label matching [${fuelType}] (${normalizedFuelType}) wasn't identified. Skipping.`);
//         continue;
//       }

//       const inputField = fuelColumn.locator('input[placeholder="Enter Price"]');

//       if (await inputField.isVisible()) {
//         const targetPriceString = String(rawPrice);

//         await inputField.focus();
//         await page.keyboard.press('Control+A');
//         await page.keyboard.press('Meta+A');
//         await page.keyboard.press('Backspace');

//         await inputField.type(targetPriceString, { delay: 100 });

//         const confirmButton = fuelColumn.locator('button:has-text("Confirm")');
//         if (await confirmButton.isVisible()) {
//           await confirmButton.click();
//           console.log(` Staged change for ${normalizedFuelType} -> [${targetPriceString}]`);
//           updatesCommitted++;
//         } else {
//           await inputField.dispatchEvent('change');
//           await inputField.dispatchEvent('blur');
//           updatesCommitted++;
//         }
//       }
//     }

//     const autoUpdateLabel = dialogModal.locator('label:has-text("Auto-update the price(s) for this price submission for today?")');
//     const autoUpdateCheckbox = dialogModal.locator('div.checkbox__checkbox___2QDLE input[type="checkbox"]');

//     if (await autoUpdateLabel.isVisible()) {
//       const isAlreadyChecked = await autoUpdateCheckbox.isChecked({ force: true });
//       if (!isAlreadyChecked) {
//         console.log("📌 Syncing auto-update daily price locking toggle state to [ACTIVE]...");
//         await autoUpdateLabel.click();
//       } else {
//         console.log("ℹ️ Auto-update price locking option toggle is already checked.");
//       }
//     }

//     if (updatesCommitted > 0) {
//       const saveButton = dialogModal.locator('button:has-text("Save Changes")');
//       await page.waitForTimeout(500);

//       if (!(await saveButton.isDisabled())) {
//         console.log("🚀 Dispatched initial 'Save Changes' layer...");
//         await saveButton.click();

//         const confirmationModal = page.locator('div[role="dialog"][aria-modal="true"]').filter({ hasText: 'Confirm Price Submission' });

//         try {
//           await confirmationModal.waitFor({ state: "visible", timeout: 4000 });
//           console.log("✋ Secondary confirmation barrier detected.");

//           const submitPricesBtn = confirmationModal.locator('button:has-text("Submit Prices")');
//           if (await submitPricesBtn.isVisible()) {
//             await submitPricesBtn.click();
//             console.log("🔥 Final 'Submit Prices' handshake executed successfully!");
//           }
//         } catch (e) {
//           console.log("ℹ️ No secondary confirmation barrier appeared. Relying on primary ledger save.");
//         }

//         console.log("寒 Freezing executor loop 5 seconds to cycle final updates...");
//         await page.waitForTimeout(5000);

//         // 📸 AUDIT SUCCESS SCREENSHOT -> MEMORY BUFFER -> CDN CONTAINER
//         const successBuffer = await page.screenshot();
//         const cdnUrl = await uploadToCdn(successBuffer, `submission_proof_${gasBuddyStationId}.png`);

//         if (cdnUrl) {
//           console.log(`🎉 Success asset uploaded directly to CDN: ${cdnUrl}`);
//         }

//         await context.storageState({ path: sessionPath });
//         console.log(`🎉 Success: Successfully executed (${updatesCommitted}) pricing shifts on GasBuddy Business Profile!`);
//       } else {
//         throw new Error('LEDGER_LOCKED: Save changes button context is locked or disabled in the DOM view.');
//       }
//     } else {
//       console.log('🏁 Process wrapped: 0 structural values required active writing updates.');
//     }

//   } catch (error) {
//     console.error("❌ CRITICAL DISPATCH EXCEPTION IN AUTO ENGINE:", error);

//     let emergencyCdnUrl = "";
//     try {
//       // 📸 DIAGNOSTIC SCREENSHOT -> MEMORY BUFFER -> CDN CONTAINER
//       const errorBuffer = await page.screenshot({ fullPage: true });
//       emergencyCdnUrl = await uploadToCdn(errorBuffer, `failure_error_${gasBuddyStationId}.png`);
//     } catch (ssErr) {
//       console.error("Unable to execute memory buffer screenshot dump:", ssErr);
//     }

//     // Determine the severity classification context for the title string
//     const isTokenError = error.message.includes("AUTHENTICATION_EXPIRED");
//     const errorTypeLabel = isTokenError ? "GasBuddy Session Expired" : "GasBuddy Execution Failure";

//     // 📬 GENERALIZED FAIL-SAFE RUNTIME ERROR EMAIL
//     const systemAlertHtml = `
//       <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #f87171; border-radius: 16px; background-color: #ffffff;">
//         <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
//           <h2 style="color: #991b1b; margin: 0 0 8px 0; font-size: 16px; font-weight: 800; text-transform: uppercase;">
//             ⚠️ Critical: ${errorTypeLabel}
//           </h2>
//           <p style="color: #b91c1c; margin: 0; font-size: 14px; font-weight: 600; line-height: 1.5;">
//             An exception interrupted the background sync process for GasBuddy Station ID: <strong>${gasBuddyStationId}</strong>.
//           </p>
//         </div>

//         <div style="margin-bottom: 24px; background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 14px; border-radius: 8px;">
//           <strong style="color: #0f172a; font-size: 13px; text-transform: uppercase;">Error Technical Details:</strong>
//           <p style="font-family: monospace; font-size: 13px; color: #ef4444; margin: 8px 0 0 0; white-space: pre-wrap;">
//             ${error.message}
//           </p>
//         </div>

//         ${emergencyCdnUrl ? `
//           <div style="margin-bottom: 24px; text-align: center;">
//             <a href="${emergencyCdnUrl}" target="_blank"
//                style="display: inline-block; background-color: #dc2626; color: #ffffff; padding: 12px 20px; font-weight: bold; font-size: 13px; text-decoration: none; border-radius: 8px; text-transform: uppercase;">
//               🔍 View Diagnostic Screenshot Evidence
//             </a>
//           </div>
//         ` : `
//           <p style="font-size: 12px; color: #94a3b8; font-style: italic; margin-bottom: 24px;">
//             Note: Could not capture diagnostic screenshot because browser rendering context crashed.
//           </p>
//         `}

//         <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; text-align: center;">
//           <span style="font-size: 11px; color: #94a3b8; font-style: italic;">
//             Automated operational alert pipeline — Gen 7 Fuel Hub System Engine.
//           </span>
//         </div>
//       </div>
//     `;

//     // Queue the generalized fallback payload into BullMQ immediately
//     await emailQueue.add(`gasbuddy-error-${Date.now()}`, {
//       to: "daksh@gen7fuel.com",
//       subject: `🚨 Hub Automation Sync Failure (Station: ${gasBuddyStationId})`,
//       html: systemAlertHtml
//     });

//     console.log("📧 Exception notification successfully offloaded to BullMQ framework channels.");
//     throw error;
//   } finally {
//     await browser.close();
//   }
// }

// module.exports = { postPricesToGasBuddy };