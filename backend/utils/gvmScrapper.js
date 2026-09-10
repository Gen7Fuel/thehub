const { chromium } = require("playwright-extra");
const stealth = require("puppeteer-extra-plugin-stealth")();
const fs = require("fs");
const { emailQueue } = require("../queues/emailQueue");
const GvmSession = require("../models/GvmSession");
const { uploadToCdn } = require("./uploadToCdn");
const { runAutoLogin, GVM_BASE_URL } = require("./gvmLoginScrapper");

// Inject stealth mode to mask Playwright's automation footprints
chromium.use(stealth);

const GVM_PRICING_URL = `${GVM_BASE_URL}/pricing`;

/**
 * Locates the price <input> for a given grade row. GVM's "New" pricing
 * modal is a plain data table: one <tr> per grade, a
 * <td data-label="Product"><span>{grade}</span></td> next to the
 * <td data-label="Price"> that holds the input — confirmed against live
 * markup. Mirrors gasBuddyScrapper.js's per-grade column lookup
 * (`h5:text-is(...)`), using :text-is() for the same reason: "Diesel" as a
 * substring would incorrectly also match the "Dyed Diesel" row.
 */
function priceInputForGrade(page, modal, gradeLabel) {
  const row = modal.locator("tr.mud-table-row").filter({
    has: page.locator(`td[data-label="Product"] span:text-is("${gradeLabel}")`),
  });
  return row.locator('td[data-label="Price"] input');
}

/**
 * Selects a location in the "New" pricing modal's location dropdown.
 * Confirmed against live markup: this is a MudBlazor multi-select-style
 * combobox (checkbox rows, role="option", aria-label exactly the location's
 * display name) — not a native <select>. Confirmed the dropdown does NOT
 * auto-close after picking an option, so it's dismissed explicitly
 * afterward (Escape, falling back to a click elsewhere in the modal) so the
 * price fields underneath aren't obscured by the still-open popover.
 */
async function selectLocation(page, modal, gvmLocationName) {
  const trigger = modal.locator('.mud-select-extended .mud-input-slot[tabindex="0"]').first();
  await trigger.click();

  const option = page.getByRole("option", { name: gvmLocationName, exact: true });
  await option.waitFor({ state: "visible", timeout: 5000 });
  await option.click();

  await page.keyboard.press("Escape").catch(() => {});
  const popoverStillOpen = await page.locator(".mud-popover-open").isVisible().catch(() => false);
  if (popoverStillOpen) {
    await modal.getByText("Retail Pricing", { exact: true }).click({ force: true }).catch(() => {});
  }
}

/**
 * Core Price Submission Runner
 * Pulls session data from MongoDB and executes the browser run. Modeled
 * directly on gasBuddyScrapper.js's attemptPricePost.
 */
async function attemptPricePost({ gvmLocationName, prices }) {
  console.log("🤖 Initializing Headless Execution via Live Database States (GVM Unifi)...");

  const sessionDoc = await GvmSession.findOne({ key: "production_session" });
  if (!sessionDoc || !sessionDoc.stateData) {
    throw new Error("AUTHENTICATION_EXPIRED: No GVM session found in the database.");
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
      "--disable-blink-features=AutomationControlled",
    ],
  });

  const context = await browser.newContext({
    storageState: sessionDoc.stateData,
    viewport: { width: 1400, height: 1000 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });

  const page = await context.newPage();

  try {
    console.log(`🔗 Navigating directly to GVM pricing page (reusing session): ${GVM_PRICING_URL}`);
    await page.goto(GVM_PRICING_URL, { waitUntil: "networkidle", timeout: 60000 });

    // --- CRITICAL AUTODETECT CHECKS ---
    const currentUrl = page.url();
    const hasRedirectedToLogin = currentUrl.includes("login") || currentUrl === GVM_BASE_URL;
    const loginInputExists = await page.locator('input[type="password"]').isVisible().catch(() => false);

    if (hasRedirectedToLogin || loginInputExists) {
      throw new Error("AUTHENTICATION_EXPIRED: Your GVM Unifi session has expired or been revoked. Redirected to login.");
    }

    console.log("⏱️ Standing by for the pricing page to fully render...");
    await page.waitForTimeout(3000);

    const newButton = page.getByRole("button", { name: "New", exact: true }).first();

    if (!(await newButton.isVisible().catch(() => false))) {
      throw new Error('DOM_ELEMENT_MISSING: The "New" pricing button could not be found on the pricing page.');
    }

    console.log('✏️ Clicking "New" to open the pricing modal...');
    await newButton.click();

    const modal = page.locator('[role="dialog"]:visible').first();
    await modal.waitFor({ state: "visible", timeout: 8000 });
    console.log("🔓 New-pricing modal opened.");

    // The "Effective At" date/time field above the price table is
    // deliberately left untouched — confirmed it's fine to leave at
    // whatever it defaults to.

    console.log(`📍 Selecting location: ${gvmLocationName}`);
    await selectLocation(page, modal, gvmLocationName);

    let updatesCommitted = 0;

    for (const [gradeLabel, rawPrice] of Object.entries(prices)) {
      if (rawPrice === undefined || rawPrice === null) continue;

      const inputField = priceInputForGrade(page, modal, gradeLabel);

      if (!(await inputField.isVisible().catch(() => false))) {
        console.log(`⚠️ Price field for [${gradeLabel}] wasn't found in the modal. Skipping.`);
        continue;
      }

      const numericPrice = Number(rawPrice);
      if (!Number.isFinite(numericPrice)) {
        throw new Error(`INVALID_PRICE: ${gradeLabel} value "${rawPrice}" is not a valid number.`);
      }

      // Deliberate business rule (not a rounding artifact): GVM Unifi is
      // always posted 1¢ below Hub's actual price. Applied here, at the
      // single point where prices actually reach GVM, so it can't be
      // bypassed or duplicated depending on which caller builds `prices`.
      const GVM_PRICE_ADJUSTMENT = 0.01;
      const adjustedPrice = numericPrice - GVM_PRICE_ADJUSTMENT;
      if (adjustedPrice < 0) {
        throw new Error(`INVALID_PRICE: ${gradeLabel} adjusted price would be negative (${numericPrice} - ${GVM_PRICE_ADJUSTMENT} = ${adjustedPrice}).`);
      }

      // Confirmed: the field's placeholder ("0.0000") implies 4 decimal
      // places. Pad to that precision regardless of what precision the
      // caller passed in — GVM's exact tolerance for fewer/more digits is
      // unconfirmed, so this is the safe default rather than passing
      // whatever precision Hub's internal price happens to carry.
      const targetPriceString = adjustedPrice.toFixed(4);
      console.log(`💲 ${gradeLabel}: Hub price ${numericPrice.toFixed(4)} -> GVM price ${targetPriceString} (-${GVM_PRICE_ADJUSTMENT})`);

      const clearAndTypePrice = async () => {
        await inputField.focus();
        await inputField.fill("");
        await page.keyboard.press("Control+A");
        await page.keyboard.press("Backspace");
        await inputField.type(targetPriceString, { delay: 100 });
      };

      await clearAndTypePrice();

      // Read back what actually landed before committing — a real price
      // should never be posted without confirming it matches what was typed.
      let actualValue = await inputField.inputValue();
      if (actualValue !== targetPriceString) {
        console.log(`⚠️ Value mismatch for ${gradeLabel}: expected "${targetPriceString}", field shows "${actualValue}". Retrying clear+type once...`);
        await clearAndTypePrice();
        actualValue = await inputField.inputValue();
      }

      if (actualValue !== targetPriceString) {
        throw new Error(`PRICE_TYPE_MISMATCH: ${gradeLabel} field shows "${actualValue}" after retry, expected "${targetPriceString}". Refusing to submit a price GVM may have mis-parsed.`);
      }

      console.log(`✅ Staged ${gradeLabel} -> [${targetPriceString}]`);
      updatesCommitted++;
    }

    if (updatesCommitted === 0) {
      console.log("🏁 Process wrapped: 0 grade values required active writing updates.");
      return;
    }

    const saveButton = modal.getByRole("button", { name: "Save", exact: true }).first();
    await page.waitForTimeout(500);

    if (await saveButton.isDisabled().catch(() => false)) {
      throw new Error("LEDGER_LOCKED: Save button is disabled in the DOM view.");
    }

    console.log("🚀 Dispatched 'Save' on the pricing modal...");
    await saveButton.click();

    // Confirmed success behavior: GVM shows a green success toast for a few
    // seconds and redirects back to /pricing, closing the modal. Grab a
    // screenshot shortly after clicking Save (best-effort — while the toast
    // is likely still visible) as evidence, but treat the modal actually
    // closing as the hard pass/fail gate: if it's still open after this,
    // the save did not go through (e.g. a validation error) and this should
    // throw rather than continue silently.
    await page.waitForTimeout(800);
    const toastBuffer = await page.screenshot().catch(() => null);

    await modal.waitFor({ state: "hidden", timeout: 15000 });
    console.log("✅ Pricing modal closed — save confirmed.");

    if (toastBuffer) {
      const toastCdnUrl = await uploadToCdn(toastBuffer, `gvm_success_toast_${gvmLocationName}_${Date.now()}.png`);
      if (toastCdnUrl) {
        console.log(`🖼️  Success toast evidence uploaded to CDN: ${toastCdnUrl}`);
      }
    }

    console.log("⏱️ Pausing 3 seconds to let the /pricing view settle...");
    await page.waitForTimeout(3000);

    const successBuffer = await page.screenshot();
    const cdnUrl = await uploadToCdn(successBuffer, `gvm_submission_proof_${gvmLocationName}_${Date.now()}.png`);
    if (cdnUrl) {
      console.log(`🎉 Success asset uploaded to CDN: ${cdnUrl}`);
    }

    const freshState = await context.storageState();
    await GvmSession.findOneAndUpdate(
      { key: "production_session" },
      { stateData: freshState, updatedAt: new Date() },
      { upsert: true }
    );
    console.log(`🎉 Success: Executed (${updatesCommitted}) pricing updates on GVM Unifi for ${gvmLocationName}!`);

  } catch (error) {
    let errorBuffer = null;
    try {
      errorBuffer = await page.screenshot({ fullPage: true });
    } catch (ssErr) {
      console.error("Unable to execute memory buffer screenshot dump:", ssErr);
    }

    error.screenshotBuffer = errorBuffer;
    throw error;
  } finally {
    await browser.close();
  }
}

/**
 * ORCHESTRATOR / SELF-HEALING PUBLIC EXPORT
 * Safely calls the core update runner, catches auth errors, refreshes login
 * via DB, and retries up to 3 times. Modeled directly on
 * gasBuddyScrapper.js's postPricesToGasBuddy.
 */
async function postPricesToGvm({ gvmLocationName, prices }) {
  const MAX_RETRIES = 3;
  let attempt = 0;
  let lastError = null;

  while (attempt < MAX_RETRIES) {
    attempt++;
    console.log(`🔄 [Attempt ${attempt}/${MAX_RETRIES}] Posting GVM prices for location: ${gvmLocationName}...`);

    try {
      await attemptPricePost({ gvmLocationName, prices });
      return;

    } catch (error) {
      lastError = error;
      console.warn(`⚠️ Warning: Exception met during attempt ${attempt}:`, error.message);

      const isTokenError = error.message.includes("AUTHENTICATION_EXPIRED");

      if (isTokenError && attempt < MAX_RETRIES) {
        console.log("🔑 Session expired or missing. Initializing automated login pipeline...");
        try {
          await runAutoLogin(attempt);
          console.log("✅ Automated login completed. Retrying price submission with the new session...");
          continue;
        } catch (loginError) {
          console.error("❌ Failed executing self-healing automated login:", loginError.message);
          lastError = loginError;
          break;
        }
      } else {
        break;
      }
    }
  }

  console.error("🚨 GVM PRICE POSTING ENGINES EXHAUSTED ALL RUNS. dispatching alert diagnostics...");

  let emergencyCdnUrl = "";
  if (lastError.screenshotBuffer) {
    emergencyCdnUrl = await uploadToCdn(lastError.screenshotBuffer, `gvm_failure_error_${gvmLocationName}.png`);
  }

  const isTokenError = lastError.message.includes("AUTHENTICATION_EXPIRED");
  const errorTypeLabel = isTokenError ? "GVM Unifi Session Expired (Retry Limit Exceeded)" : "GVM Unifi Execution Failure";

  const systemAlertHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #f87171; border-radius: 16px; background-color: #ffffff;">
      <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
        <h2 style="color: #991b1b; margin: 0 0 8px 0; font-size: 16px; font-weight: 800; text-transform: uppercase;">
          ⚠️ Critical: ${errorTypeLabel}
        </h2>
        <p style="color: #b91c1c; margin: 0; font-size: 14px; font-weight: 600; line-height: 1.5;">
          An exception interrupted the background sync process for GVM Location: <strong>${gvmLocationName}</strong>.
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

  await emailQueue.add(`gvm-error-${Date.now()}`, {
    to: "daksh@gen7fuel.com",
    subject: `🚨 Hub Automation Sync Failure (GVM Location: ${gvmLocationName})`,
    html: systemAlertHtml
  });

  console.log("📧 Exception notification successfully offloaded to BullMQ framework channels.");
  throw lastError;
}

module.exports = { postPricesToGvm };
