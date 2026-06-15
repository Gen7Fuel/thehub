const { chromium } = require("playwright-extra");
const stealth = require("puppeteer-extra-plugin-stealth")();
const fs = require("fs");
const path = require("path");
const emailQueue = require("../queues/emailQueue");

// Inject stealth mode to mask Playwright's automation footprints
chromium.use(stealth);

async function postPricesToGasBuddy({ gasBuddyStationId, prices }) {
  console.log("🤖 Initializing Headless Production Engine via Business State Ledger...");

  const sessionPath = path.resolve(__dirname, "../sessions/gasBuddy/gasbuddy-state.json");

  if (!fs.existsSync(sessionPath)) {
    throw new Error(`❌ Missing session file! Please execute your login generator to create: ${sessionPath}`);
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
      "--disable-dev-shm-usage"
    ]
  });

  const context = await browser.newContext({
    storageState: sessionPath,
    viewport: { width: 1400, height: 1000 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  });

  const page = await context.newPage();

  try {
    const businessUrl = `https://dashboard.gasbuddybusiness.io/client/station-profiles/station-profile?stationId=${gasBuddyStationId}`;
    console.log(`🔗 Navigating to Corporate Portal: ${businessUrl}`);

    await page.goto(businessUrl, { waitUntil: "networkidle", timeout: 60000 });

    // 🚀 FIXED: Check if authentication tokens died and tripped redirect interception parameters
    if (page.url().includes("login.html") || page.url().includes("iam.gasbuddy.com")) {
      console.log("🚨 Token expiration detected! Compiling critical email alert job...");

      const expiredNoticeHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #f87171; border-radius: 16px; background-color: #ffffff;">
          <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #991b1b; margin: 0 0 8px 0; font-size: 18px; font-weight: 800; text-transform: uppercase;">
              ⚠️ Critical: GasBuddy Session Expired
            </h2>
            <p style="color: #b91c1c; margin: 0; font-size: 14px; font-weight: 600; line-height: 1.5;">
              The automation engine was redirected to the login interface while processing changes for Station ID: ${gasBuddyStationId}.
            </p>
          </div>

          <div style="margin-bottom: 24px;">
            <p style="font-size: 14px; color: #334155; line-height: 1.6;">
              Your stored session tokens inside <code>gasbuddy-state.json</code> have expired or been revoked by the security gateway. Background pricing syncs will continue to fail until this is re-authenticated.
            </p>
          </div>

          <div style="margin-bottom: 24px; text-align: center;">
            <a href="https://dashboard.gasbuddybusiness.io/login.html" 
               style="display: inline-block; background-color: #dc2626; color: #ffffff; padding: 12px 24px; font-weight: bold; font-size: 14px; text-decoration: none; border-radius: 8px; text-transform: uppercase;">
              Re-authenticate GasBuddy Account
            </a>
          </div>

          <div style="border-top: 1px solid #e2e8f0; padding-top: 16px; text-align: center;">
            <span style="font-size: 11px; color: #94a3b8; font-style: italic;">
              Automated system pipeline exception tracker — Gen 7 Fuel Hub Engine.
            </span>
          </div>
        </div>
      `;

      // Dispatch alert payload down into your BullMQ system
      await emailQueue.add(`gasbuddy-token-expired-${Date.now()}`, {
        to: "daksh@gen7fuel.com",
        subject: `🚨 System Alert: GasBuddy Session Expired (Station: ${gasBuddyStationId})`,
        html: expiredNoticeHtml
      });

      console.log("📧 Token expiration notice safely queued into BullMQ.");
      throw new Error("🚨 The dashboard was redirected to login! Your gasbuddy-state.json tokens have expired.");
    }

    console.log("⏱️ Standing by for 5 seconds to let state data render completely...");
    await page.waitForTimeout(5000);

    // Locate the Pencil Edit Button wrapper next to the "PRICES" section header text block
    const editBtnSelector = 'div.panel__panel___3Q2zW:has(h3:has-text("PRICES")) button.styles__buttonIcon___3NfYt';
    const editButton = page.locator(editBtnSelector).first();

    if (!(await editButton.isVisible())) {
      throw new Error("❌ Fatal: Price control card or modal edit pencil element couldn't be indexed on the dashboard workspace UI.");
    }

    console.log("✏️ Clicking the Price Configuration Card edit control node...");
    await editButton.click();

    // 🚀 FIXED: Scopes selector via text presence filtering to break the strict 10-element tie violation
    const dialogModal = page.locator('div[role="dialog"][aria-modal="true"]').filter({ hasText: 'PRICES' });
    await dialogModal.waitFor({ state: "visible", timeout: 8000 });
    console.log("🔓 Pricing operational modification dialog overlay opened.");

    let updatesCommitted = 0;

    for (let [fuelType, rawPrice] of Object.entries(prices)) {
      if (rawPrice === undefined || rawPrice === null) continue;

      // 🚀 FIXED: Normalize variation spaces or casing formatting rules for "Mid Grade"
      let normalizedFuelType = fuelType.trim();
      if (normalizedFuelType.toLowerCase().replace(/[\s-]/g, "") === "midgrade") {
        normalizedFuelType = "Midgrade";
      }

      // Target layout tracking columns safely using normalized names
      const fuelColumn = dialogModal.locator(`div.grid__column___nhz7X:has(h5:text-is("${normalizedFuelType}"))`);

      if (await fuelColumn.count() === 0) {
        console.log(`⚠️ Grade column label matching [${fuelType}] (${normalizedFuelType}) wasn't identified inside the dashboard dialog panel. Skipping.`);
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

    // 🚀 FIXED: Target the checkbox toggle layer reliably using its literal label text string block
    const autoUpdateLabel = dialogModal.locator('label:has-text("Auto-update the price(s) for this price submission for today?")');

    // Target the corresponding hidden checkbox element structurally via the parent wrapper block container
    const autoUpdateCheckbox = dialogModal.locator('div.checkbox__checkbox___2QDLE input[type="checkbox"]');

    if (await autoUpdateLabel.isVisible()) {
      // Use .isChecked({ force: true }) to evaluate the state of visually hidden/styled input nodes safely
      const isAlreadyChecked = await autoUpdateCheckbox.isChecked({ force: true });

      if (!isAlreadyChecked) {
        console.log("📌 Syncing auto-update daily price locking toggle state to [ACTIVE]...");
        // Click the visible descriptive text label node component directly to trigger the state change safely
        await autoUpdateLabel.click();
      } else {
        console.log("ℹ️ Auto-update price locking option toggle is already checked.");
      }
    } else {
      console.log("⚠️ Operational Warning: Auto-update locking option reference label was missing inside dialog workspace elements.");
    }

    // 🚀 COMMENCING FINAL STATE WRITE TRANSACTION HANDSHAKE
    if (updatesCommitted > 0) {
      const saveButton = dialogModal.locator('button:has-text("Save Changes")');
      await page.waitForTimeout(500); // Quick stabilization pause

      if (!(await saveButton.isDisabled())) {
        console.log("🚀 Dispatched initial 'Save Changes' layer...");
        await saveButton.click();

        // 🚀 NEW: Dynamic handling for the 'Confirm Price Submission' secondary confirmation overlay
        const confirmationModal = page.locator('div[role="dialog"][aria-modal="true"]').filter({ hasText: 'Confirm Price Submission' });

        try {
          // Wait briefly to see if the secondary verification modal gets mounted to the DOM sheet tree
          await confirmationModal.waitFor({ state: "visible", timeout: 4000 });
          console.log("✋ Secondary confirmation barrier detected: 'Confirm Price Submission' overlay active.");

          const submitPricesBtn = confirmationModal.locator('button:has-text("Submit Prices")');
          if (await submitPricesBtn.isVisible()) {
            await submitPricesBtn.click();
            console.log("🔥 Final 'Submit Prices' handshake executed successfully!");
          }
        } catch (e) {
          // If the checkbox wasn't activated or the dialog didn't show, the first save button click was enough
          console.log("ℹ️ No secondary confirmation barrier appeared. Relying on primary ledger save.");
        }

        console.log("🥶 Freezing executor loop 5 seconds to cycle final updates...");
        await page.waitForTimeout(5000);

        // Capture audit log asset only at the very end of a successful iteration pipeline
        const postSubmitProofPath = path.resolve(__dirname, `../sessions/gasBuddy/submission_proof_${gasBuddyStationId}.png`);
        await page.screenshot({ path: postSubmitProofPath });
        console.log(`📸 Audit validation screenshot output logged cleanly: ${postSubmitProofPath}`);

        await context.storageState({ path: sessionPath });
        console.log("💾 Cycle complete: Current updated session tokens saved cleanly back to json ledger.");
        console.log(`🎉 Success: Successfully executed (${updatesCommitted}) pricing shifts on GasBuddy Business Profile!`);
      } else {
        throw new Error('❌ Failed processing changes: Save changes button context is locked/disabled in the DOM view.');
      }
    } else {
      console.log('🏁 Process wrapped: 0 structural values required active writing updates.');
    }

  } catch (error) {
    console.error("❌ CRITICAL DISPATCH EXCEPTION IN AUTO ENGINE:", error);

    try {
      const errorProofPath = path.resolve(__dirname, `../sessions/gasBuddy/failure_error_${gasBuddyStationId}.png`);
      await page.screenshot({ path: errorProofPath, fullPage: true });
      console.log(`📸 Emergency diagnostic trace screen saved to: ${errorProofPath}`);
    } catch (ssErr) {
      console.error("Unable to execute recovery screenshot dump:", ssErr);
    }

    throw error;
  } finally {
    await browser.close();
  }
}

module.exports = { postPricesToGasBuddy };
// const { chromium } = require("playwright-extra");
// const stealth = require("puppeteer-extra-plugin-stealth")();
// const fs = require("fs");
// const path = require("path");

// // Inject stealth mode to mask Playwright's automation footprints
// chromium.use(stealth);

// const GASBUDDY_SELECTOR_MAP = {
//   // Selector to open the dialog form
//   reportPricesButton: 'button:has-text("Report Prices")',

//   // Explicit IDs inside the modal container matching incoming payload keys
//   inputs: {
//     "Regular": '#regular_gas_credit_input',
//     "Mid Grade": '#midgrade_gas_credit_input',
//     "Premium": '#premium_gas_credit_input',
//     "Diesel": '#diesel_credit_input'
//   },

//   // The final green submit button at the bottom of the form
//   submitButton: 'button:has-text("Submit")'
// };

// async function postPricesToGasBuddy({ gasBuddyStationId, prices }) {
//   console.log("🤖 Initializing Headless Production Engine via Local JSON File...");

//   // Target path pointing straight to your sessions directory
//   const sessionPath = path.resolve(__dirname, "../sessions/gasBuddy/gasbuddy-state.json");

//   if (!fs.existsSync(sessionPath)) {
//     throw new Error(`❌ Missing session file! Please paste your JSON into: ${sessionPath}`);
//   }

//   // Inside utils/gasBuddyScrapper.js
//   const systemChromiumPath = fs.existsSync("/usr/bin/chromium-browser")
//     ? "/usr/bin/chromium-browser"
//     : fs.existsSync("/usr/bin/chromium")
//       ? "/usr/bin/chromium"
//       : undefined;

//   const browser = await chromium.launch({
//     executablePath: systemChromiumPath,
//     headless: true,
//     args: [
//       "--no-sandbox",
//       "--disable-setuid-sandbox",
//       "--disable-dev-shm-usage"
//     ]
//   });

//   const context = await browser.newContext({
//     storageState: sessionPath,
//     viewport: { width: 1280, height: 900 },
//     userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
//   });

//   const page = await context.newPage();

//   try {
//     const stationUrl = `https://www.gasbuddy.com/station/${gasBuddyStationId}`;
//     console.log(`🔗 Target Link: ${stationUrl}`);

//     await page.goto(stationUrl, { waitUntil: "networkidle", timeout: 45000 });

//     if (page.url().includes("iam.gasbuddy.com") || page.url().includes("/login")) {
//       throw new Error("🚨 The browser was redirected to login! Your gasbuddy-state.json file tokens have expired.");
//     }

//     // 1. Click the main page's report button to initialize the modal overlay
//     const reportBtn = page.locator(GASBUDDY_SELECTOR_MAP.reportPricesButton);
//     await reportBtn.click();

//     // 2. Explicitly wait for the modal structure to be visible
//     await page.waitForSelector('#regular_gas_credit_input', { state: 'visible', timeout: 5000 });

//     let updatesCommitted = 0;

//     // 3. Loop through your dynamic incoming functional parameter object
//     for (const [fuelType, rawPrice] of Object.entries(prices)) {
//       const selector = GASBUDDY_SELECTOR_MAP.inputs[fuelType];
//       if (!selector) {
//         console.log(`⚠️ Skipping fuel type [${fuelType}]: No selector mapping found.`);
//         continue;
//       }

//       const priceInput = page.locator(selector);

//       if (await priceInput.isVisible()) {
//         // Convert real decimals to GasBuddy cents notation format cleanly (e.g., 1.570 -> "157.0")
//         const targetPrice = (Number(rawPrice) * 100).toFixed(1);

//         await priceInput.focus();

//         // Overwrite Field Value
//         await page.keyboard.press('Control+A');
//         await page.keyboard.press('Meta+A');
//         await page.keyboard.press('Backspace');

//         // Type out the explicit configuration metrics
//         await priceInput.type(targetPrice, { delay: 150 });

//         // Contextually locate the adjacent contextual confirmation button
//         const entryContainer = priceInput.locator('xpath=..');
//         const confirmButton = entryContainer.locator('button:has-text("Confirm")');

//         if (await confirmButton.isVisible()) {
//           await confirmButton.click();
//           console.log(`✅ Staged pricing update for ${fuelType}: ${targetPrice}`);
//           updatesCommitted++;
//         } else {
//           await priceInput.dispatchEvent('change');
//           await priceInput.dispatchEvent('blur');
//           updatesCommitted++;
//         }
//       } else {
//         console.log(`⚠️ Field locator for [${fuelType}] was not visible on the modal sheet.`);
//       }
//     }

//     // 4. Final Submission Handshake
//     if (updatesCommitted > 0) {
//       const finalSubmit = page.locator(GASBUDDY_SELECTOR_MAP.submitButton);
//       await page.waitForTimeout(1000);

//       const isDisabled = await finalSubmit.getAttribute('disabled');

//       if (isDisabled === null) {
//         // Click the submit button
//         await finalSubmit.click();
//         console.log("🚀 Submit button clicked. Waiting 5 seconds for backend response...");

//         // Allow the modal to transition and AJAX calls to finish execution
//         await page.waitForTimeout(5000);

//         // Take an audit snapshot to confirm the modal closed or showed a "Success!" checkmark
//         const proofPath = path.resolve(__dirname, "../sessions/gasBuddy/submission_proof.png");
//         await page.screenshot({ path: proofPath });
//         console.log(`📸 Saved post-submit verification screen to: ${proofPath}`);

//         // 🔄 ALWAYS REFRESH THE COOKIES: Save the fresh short-lived tokens back to your file!
//         await context.storageState({ path: sessionPath });
//         console.log("💾 Session state cookies successfully cycled and updated in json.");

//         console.log(`🎉 Successfully published ${updatesCommitted} update(s) to GasBuddy ledger!`);
//       } else {
//         console.error('❌ Failed submission: The submit button remains disabled.');
//       }
//     } else {
//       console.log('Processed: 0 structural updates.');
//     }

//   } catch (error) {
//     console.error("❌ CRITICAL PROCESS EXCEPTION:", error);

//     // Defensive Exception Screenshot Capturing
//     try {
//       const errorProofPath = path.resolve(__dirname, "../sessions/gasBuddy/failure_error_snapshot.png");
//       await page.screenshot({ path: errorProofPath, fullPage: true });
//       console.log(`📸 Emergency failure snapshot dumped to: ${errorProofPath}`);
//     } catch (ssErr) {
//       console.error("Could not write emergency snapshot:", ssErr);
//     }

//     throw error;
//   } finally {
//     await browser.close();
//   }
// }

// module.exports = { postPricesToGasBuddy };
// const { chromium } = require("playwright");

// // Exact text matching based on your screenshots
// const GASBUDDY_SELECTOR_MAP = {
//   "Regular": {
//     input: 'div:has(> label:text-is("Regular")) + div input, input[aria-label="Regular"], label:text-is("Regular") + div input, input[name*="regular"]',
//     confirmBtn: 'div:has(> label:text-is("Regular")) button:has-text("CONFIRM")'
//   },
//   "Mid Grade": { // Note: GasBuddy calls this "Midgrade" in the UI
//     input: 'div:has(> label:has-text("Midgrade")) + div input, input[aria-label="Midgrade"], label:has-text("Midgrade") + div input, input[name*="midgrade"]',
//     confirmBtn: 'div:has(> label:has-text("Midgrade")) button:has-text("CONFIRM")'
//   },
//   "Premium": {
//     input: 'div:has(> label:text-is("Premium")) + div input, input[aria-label="Premium"], label:text-is("Premium") + div input, input[name*="premium"]',
//     confirmBtn: 'div:has(> label:text-is("Premium")) button:has-text("CONFIRM")'
//   },
//   "Diesel": {
//     input: 'div:has(> label:text-is("Diesel")) + div input, input[aria-label="Diesel"], label:text-is("Diesel") + div input, input[name*="diesel"]',
//     confirmBtn: 'div:has(> label:text-is("Diesel")) button:has-text("CONFIRM")'
//   }
// };

// async function postPricesToGasBuddy({ gasBuddyStationId, prices }) {
//   if (!process.env.GASBUDDY_EMAIL || !process.env.GASBUDDY_PASSWORD) {
//     throw new Error("Missing GASBUDDY_EMAIL or GASBUDDY_PASSWORD in environment variables.");
//   }

//   console.log(`🤖 Starting GasBuddy UI Flow for Station ID: ${gasBuddyStationId}`);

//   const userDataDir = "./playwright_saved_session";

//   // =========================================================================
//   // UPDATED INITIALIZATION FOR DOCKER COMPATIBILITY
//   // =========================================================================
//   const context = await chromium.launchPersistentContext(userDataDir, {
//     executablePath: "/usr/bin/chromium", // Points directly to your system binary
//     headless: true,                      // True because Docker containers don't have visual UI screens
//     args: [
//       '--no-sandbox',                    // Overcomes Linux security sandbox restrictions inside Docker
//       '--disable-setuid-sandbox',
//       '--disable-dev-shm-usage'          // Prevents Chrome from crashing on low shared memory allocations
//     ],
//     viewport: { width: 1280, height: 900 },
//     userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
//   });

//   const page = await context.newPage();

//   try {
//     // 1. Force navigate straight to the verified login domain
//     console.log("Navigating to GasBuddy Login Page...");
//     await page.goto("https://www.gasbuddy.com/login", { waitUntil: "domcontentloaded", timeout: 30000 });
//     await page.waitForTimeout(4000); // Allow time for React chunks and security challenges to settle

//     // Locate elements using explicit test attributes from the DOM
//     const loginEmailInput = page.locator('[data-testid="emailInput"], #email').first();

//     if (await loginEmailInput.isVisible()) {
//       console.log("🔐 Session missing. Initializing human-simulated login sequence...");

//       // Clear cookie/banner barriers if visible
//       const cookieAcceptBtn = page.locator('#onetrust-accept-btn-handler, button:has-text("Accept All Cookies")').first();
//       if (await cookieAcceptBtn.isVisible()) {
//         console.log("🍪 Dismissing cookie barrier...");
//         await cookieAcceptBtn.click();
//         await page.waitForTimeout(1000);
//       }

//       // Stealth Typing for Username/Email
//       await loginEmailInput.click();
//       await page.waitForTimeout(400);
//       // Simulates real finger typings by inserting a random delay between 50ms and 150ms per character
//       await page.keyboard.type(process.env.GASBUDDY_EMAIL, { delay: 110 });
//       await page.waitForTimeout(500);

//       // Stealth Typing for Password
//       const passwordInput = page.locator('[data-testid="passwordInput"], #password').first();
//       await passwordInput.click();
//       await page.waitForTimeout(300);
//       await page.keyboard.type(process.env.GASBUDDY_PASSWORD, { delay: 95 });
//       await page.waitForTimeout(600);

//       console.log("Submitting form parameters via structural pointer...");
//       const loginSubmitBtn = page.locator('[data-test="loginButton"], button[type="submit"]').first();

//       // Use physical mouse simulation instead of an artificial element.click()
//       await loginSubmitBtn.hover();
//       await page.waitForTimeout(200);
//       await loginSubmitBtn.click({ force: true });

//       console.log("Waiting for security routing resolution or form response errors...");

//       // Defensively race the successful navigation against an inline firewall error block
//       await Promise.race([
//         // Promise A: Successful login redirect path
//         page.waitForURL((url) => url.href.includes("gasbuddy.com") && !url.href.includes("/login"), { timeout: 35000 }),

//         // Promise B: Detect if a 403 or server alert shows up on the screen
//         (async () => {
//           await page.waitForTimeout(5000); // give the page a brief window to process the post
//           // Look for raw text strings or dynamic labels indicating a backend rejection
//           const bodyText = await page.innerText('body');
//           if (bodyText.includes("403") || bodyText.includes("Forbidden") || bodyText.includes("error")) {
//             throw new Error("🚨 GasBuddy backend threw a 403 / security error directly on the login form layer.");
//           }
//           // Loop wait if it hasn't navigated yet
//           await page.waitForTimeout(25000);
//         })()
//       ]);

//       console.log("✅ Authenticated successfully. Session context captured.");
//     } else {
//       console.log("✨ Active session genuinely recovered (Form structure absent). Proceeding.");
//     }

//     // 2. Open Station Profile Page
//     const stationUrl = `https://www.gasbuddy.com/station/${gasBuddyStationId}`;
//     console.log(`🔗 Navigating to station page: ${stationUrl}`);
//     await page.goto(stationUrl, { waitUntil: "domcontentloaded" });
//     await page.waitForTimeout(4000);

//     // 3. STEP 1: Interact with the now verified "REPORT PRICES" button
//     const reportPricesBtnSelector = 'button:has-text("REPORT PRICES")';
//     console.log("Locating the report action button element...");
//     await page.waitForSelector(reportPricesBtnSelector, { timeout: 15000 });

//     console.log("Clicking the reporting button...");
//     await page.click(reportPricesBtnSelector);

//     // 4. STEP 2: Handle the modal presentation overlay
//     console.log("Waiting for price modification dialog container...");
//     await page.waitForSelector('button:has-text("SUBMIT 0 PRICES"), button:has-text("SUBMIT")', { state: 'attached', timeout: 15000 });

//     let fieldsUpdatedCount = 0;

//     for (let [gradeName, priceValue] of Object.entries(prices)) {
//       const mapping = GASBUDDY_SELECTOR_MAP[gradeName];
//       if (!mapping) continue;

//       const inputLocator = page.locator(mapping.input).first();

//       if (await inputLocator.isVisible()) {
//         console.log(`✏️ Modifying field for [${gradeName}] with value: ${priceValue}`);
//         await inputLocator.click();
//         await page.keyboard.press("Control+A");
//         await page.keyboard.press("Backspace");
//         await page.waitForTimeout(200);
//         await page.keyboard.type(priceValue.toString(), { delay: 100 });
//         fieldsUpdatedCount++;
//       } else {
//         console.log(`⚠️ Field locator for [${gradeName}] not visible in modal context.`);
//       }
//     }

//     if (fieldsUpdatedCount > 0) {
//       console.log("⏸️ Review phase: Pausing 5 seconds...");
//       await page.waitForTimeout(5000);
//       console.log("🚀 Executing final submission click event...");
//       // await page.click(page.locator('button:has-text("SUBMIT")').first());
//       console.log("🏁 Flow finished successfully.");
//     } else {
//       console.log("⏹️ No active fields were modified.");
//     }

//   } catch (error) {
//     console.error("Critical execution error inside modal engine:", error);
//     try {
//       const screenshotPath = `/app/gasbuddy_error_snapshot.png`;
//       await page.screenshot({ path: screenshotPath, fullPage: true });
//       console.log(`📸 Saved debug screenshot to: ${screenshotPath}`);
//     } catch (screenshotError) {
//       console.error("Failed to capture error page screenshot:", screenshotError);
//     }
//     throw error;
//   } finally {
//     await context.close();
//   }
// }

// // module.exports = { postPricesToGasBuddy };
// const { chromium } = require("playwright");

// const GASBUDDY_SELECTOR_MAP = {
//   Regular: {
//     input:
//       'div:has(> label:text-is("Regular")) + div input'
//   },

//   "Mid Grade": {
//     input:
//       'div:has(> label:has-text("Midgrade")) + div input'
//   },

//   Premium: {
//     input:
//       'div:has(> label:text-is("Premium")) + div input'
//   },

//   Diesel: {
//     input:
//       'div:has(> label:text-is("Diesel")) + div input'
//   }
// };

// async function postPricesToGasBuddy({
//   gasBuddyStationId,
//   prices
// }) {
//   console.log(
//     "Opening saved session..."
//   );

//   const browser =
//     await chromium.launch({
//       headless: false
//     });

//   const context =
//     await browser.newContext({
//       storageState:
//         "./gasbuddy-state.json",

//       viewport: {
//         width: 1400,
//         height: 1000
//       }
//     });

//   const page =
//     await context.newPage();

//   try {
//     page.on(
//       "response",
//       async (res) => {
//         if (
//           res.status() >= 400
//         ) {
//           console.log(
//             "HTTP",
//             res.status(),
//             res.url()
//           );
//         }
//       }
//     );

//     const stationUrl =
//       `https://www.gasbuddy.com/station/${gasBuddyStationId}`;

//     console.log(
//       "Opening:",
//       stationUrl
//     );

//     await page.goto(
//       stationUrl,
//       {
//         waitUntil:
//           "networkidle"
//       }
//     );

//     await page.waitForTimeout(
//       3000
//     );

//     console.log(
//       "Click REPORT PRICES"
//     );

//     await page
//       .locator(
//         'button:has-text("REPORT PRICES")'
//       )
//       .first()
//       .click();

//     await page.waitForTimeout(
//       3000
//     );

//     let updated = 0;

//     for (const [
//       grade,
//       price
//     ] of Object.entries(
//       prices
//     )) {
//       const mapping =
//         GASBUDDY_SELECTOR_MAP[
//           grade
//         ];

//       if (!mapping)
//         continue;

//       const input =
//         page
//           .locator(
//             mapping.input
//           )
//           .first();

//       if (
//         await input.isVisible()
//       ) {
//         console.log(
//           `Updating ${grade}`
//         );

//         await input.fill(
//           String(price)
//         );

//         updated++;
//       }
//     }

//     console.log(
//       `${updated} fields updated`
//     );

//     console.log(
//       "Waiting before submit..."
//     );

//     await page.waitForTimeout(
//       10000
//     );

//     // Uncomment once verified
//     /*
//     await page
//       .locator(
//         'button:has-text("SUBMIT")'
//       )
//       .click();
//     */

//     console.log(
//       "Finished"
//     );
//   } finally {
//     await browser.close();
//   }
// }

// module.exports = {
//   postPricesToGasBuddy
// };