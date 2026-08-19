const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright-extra");
const stealth = require("puppeteer-extra-plugin-stealth")();

chromium.use(stealth);

/**
 * Automates CStoreOffice entry and date selection, then inputs write-off items into the grid.
 *
 * @param {Object} params
 * @param {string} params.targetStationCsoCode - Station's Petrosoft CSO code.
 * @param {string} params.formattedDate - Date string in 'MM/DD/YYYY' format.
 * @param {string} params.formattedTime - Time string in 'HH:mm:ss' format.
 * @param {string} params.listNumber - List reference ID.
 * @param {Array<Object>} params.items - Array of items from MongoDB [{ upc_barcode, reason, quantity }].
 */
async function syncWriteOffToCStore({
  targetStationCsoCode,
  formattedDate,
  formattedTime,
  listNumber,
  items = [],
}) {
  console.log(
    `🤖 Starting CStore Write-Off Automation for List: ${listNumber}...`,
  );
  console.log(
    `📍 Station CSO Code: ${targetStationCsoCode} | Target Date: ${formattedDate} | Target Time: ${formattedTime}`,
  );
  console.log(`📦 Items to process: ${items.length}`);

  const systemChromiumPath =
    process.env.CHROMIUM_PATH ||
    (fs.existsSync("/usr/bin/chromium-browser")
      ? "/usr/bin/chromium-browser"
      : fs.existsSync("/usr/bin/chromium")
        ? "/usr/bin/chromium"
        : undefined);

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
    // 1. Auth Gateway
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

    // 2. Direct Spoilage Route
    const spoilageUrl = `https://03.cstoreoffice.com/daily-store-spoilage.php?Station=${targetStationCsoCode}`;
    console.log(`🔗 Navigating to Spoilage Module: ${spoilageUrl}`);
    await page.goto(spoilageUrl, { waitUntil: "networkidle", timeout: 45000 });

    // 3. Set Station Local Date
    const [monthStr, dayStr, yearStr] = formattedDate.split("/");
    const day = parseInt(dayStr, 10);
    const month = parseInt(monthStr, 10);
    const year = parseInt(yearStr, 10);

    console.log(
      `📅 Executing date switch to Day: ${day}, Month: ${month}, Year: ${year}...`,
    );

    await page.evaluate(
      ({ day, month, year }) => {
        if (typeof window.fnHCalendarOnSelect === "function") {
          window.fnHCalendarOnSelect(day, month, year);
        } else {
          throw new Error(
            "fnHCalendarOnSelect handler is not available on page context.",
          );
        }
      },
      { day, month, year },
    );

    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);

    // 4. Loop and Process Each Item into the #oDGTableEdit Grid
    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      const { upc_barcode, reason, quantity } = item;

      console.log(
        `\n⏳ Processing Item [${index + 1}/${items.length}] - UPC: ${upc_barcode}`,
      );

      // Step A: Select "Enter UPC / PLU" from "Enter By" Dropdown
      const enterByTd = page.locator('#oDGTableEdit td[ebindex="item"]');
      await enterByTd.click();
      await page.waitForTimeout(300);

      const upcOption = page.locator('div[style*="z-index"] table td', {
        hasText: /^Enter UPC \/ PLU$/i,
      });

      if (await upcOption.isVisible()) {
        await upcOption.click();
      } else {
        await page.keyboard.press("Escape");
      }
      await page.waitForTimeout(300);

      // Step B: Focus Parent Cell to render the UPC input visible
      const upcCell = page.locator('#oDGTableEdit td[ebindex="upc"]');
      await upcCell.click(); // Clicking the cell activates the input mode in Petrosoft

      const upcInputSelector = '#oDGTableEdit td[ebindex="upc"] input';

      // Fill input directly via DOM evaluation to prevent "Element is not visible" failure
      await page.evaluate(
        ({ selector, value }) => {
          const el = document.querySelector(selector);
          if (el) {
            el.style.display = "block"; // Ensure visibility
            el.style.visibility = "visible";
            el.focus();
            el.value = value;
            el.dispatchEvent(new Event("input", { bubbles: true }));
            el.dispatchEvent(new Event("change", { bubbles: true }));
          }
        },
        { selector: upcInputSelector, value: String(upc_barcode) },
      );

      // Trigger Petrosoft's form item loader manually if needed
      await page.evaluate((selector) => {
        const el = document.querySelector(selector);
        if (el && typeof el.onchange === "function") {
          el.onchange();
        }
      }, upcInputSelector);

      // Wait buffer for product lookup AJAX response
      await page.waitForTimeout(2500);

      // Step C: Select Reason
      if (reason) {
        const reasonCell = page.locator('#oDGTableEdit td[ebindex="reason"]');
        await reasonCell.click();
        await page.waitForTimeout(300);

        const reasonOption = page.locator('div[style*="z-index"] table td', {
          hasText: new RegExp(`^${reason.trim()}$`, "i"),
        });

        if (await reasonOption.isVisible()) {
          await reasonOption.click();
        } else {
          const fallbackOption = page.locator(
            'div[style*="z-index"] table td',
            {
              hasText: /^Spoilage$/i,
            },
          );
          if (await fallbackOption.isVisible()) {
            await fallbackOption.click();
          } else {
            await page.keyboard.press("Escape");
          }
        }
      }

      // Step D: Enter Quantity
      const qtyCell = page.locator('#oDGTableEdit td[ebindex="quantity"]');
      await qtyCell.click();

      await page.evaluate(
        ({ value }) => {
          const el = document.querySelector(
            '#oDGTableEdit td[ebindex="quantity"] input',
          );
          if (el) {
            el.focus();
            el.value = value;
            el.dispatchEvent(new Event("input", { bubbles: true }));
            el.dispatchEvent(new Event("keyup", { bubbles: true }));
            el.dispatchEvent(new Event("change", { bubbles: true }));
          }
        },
        { value: String(quantity) },
      );

      // Step E: Enter Time
      const timeCell = page.locator('#oDGTableEdit td[ebindex="time"]');
      await timeCell.click();

      await page.evaluate(
        ({ value }) => {
          const el = document.querySelector(
            '#oDGTableEdit td[ebindex="time"] input',
          );
          if (el) {
            el.focus();
            el.value = value;
            el.dispatchEvent(new Event("input", { bubbles: true }));
            el.dispatchEvent(new Event("change", { bubbles: true }));
          }
        },
        { value: formattedTime },
      );

      // Step F: Save Item Row
      const enterBtn = page.locator("#oDGTableEdit #dgButtonSave");
      await enterBtn.click({ force: true });

      // Wait for table commit
      await page.waitForTimeout(1500);
      console.log(`✅ Item ${upc_barcode} added to grid successfully.`);
    }

    // 5. Final Snapshot Capture
    const debugDir = path.join(process.cwd(), "temp_automation_snapshots");
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }

    const timestamp = Date.now();
    const screenshotPath = path.join(
      debugDir,
      `WO_FINAL_${listNumber}_${targetStationCsoCode}_${timestamp}.png`,
    );

    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`📸 Final output snapshot saved locally to: ${screenshotPath}`);

    return { success: true, screenshotPath };
  } catch (error) {
    console.error(
      `❌ CStore Write-Off Sync Error for List ${listNumber}:`,
      error,
    );

    try {
      const debugDir = path.join(process.cwd(), "temp_automation_snapshots");
      if (!fs.existsSync(debugDir)) fs.mkdirSync(debugDir, { recursive: true });
      const errPath = path.join(
        debugDir,
        `ERR_WO_${listNumber}_${Date.now()}.png`,
      );
      await page.screenshot({ path: errPath, fullPage: true });
      console.log(`📸 Failure snapshot saved to: ${errPath}`);
    } catch (ssErr) {
      console.error("Could not write local failure snapshot:", ssErr);
    }

    throw error;
  } finally {
    await browser.close();
  }
}

module.exports = { syncWriteOffToCStore };
