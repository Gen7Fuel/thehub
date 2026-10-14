const fs = require("fs");
const { chromium } = require("playwright-extra");
const stealth = require("puppeteer-extra-plugin-stealth")();
const { uploadToCdn } = require("./uploadToCdn");

chromium.use(stealth);

const CSO_LOGIN_URL = "https://03.cstoreoffice.com";
const CSO_CUSTOMERS_URL = "https://03.cstoreoffice.com/app.php/accounting/lists/customers.list";

/**
 * Logs in to CStoreOffice, opens the accounting customers list and clicks
 * "Convert to Excel" to download the export. Returns the file contents as a
 * string (the export is an HTML table saved as .xls).
 *
 * On failure, a full-page screenshot is uploaded to the CDN and its URL is
 * attached to the thrown error as `screenshotUrl` for the alert email.
 * @returns {Promise<string>}
 */
async function downloadCsoCustomerExport() {
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
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });

  const context = await browser.newContext({
    viewport: { width: 1400, height: 1000 },
    acceptDownloads: true,
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });

  const page = await context.newPage();

  try {
    console.log("🔑 Authenticating with CStoreOffice Portal (AR customers)...");
    await page.goto(CSO_LOGIN_URL, { waitUntil: "networkidle", timeout: 60000 });
    await page.waitForSelector("#username", { state: "visible", timeout: 15000 });
    await page.fill("#username", process.env.PETROSOFT_USERNAME);
    await page.fill("#password", process.env.PETROSOFT_PASSWORD);
    await page.click("#kc-login");
    await page.waitForLoadState("networkidle");

    console.log("📋 Opening CStoreOffice customers list...");
    await page.goto(CSO_CUSTOMERS_URL, { waitUntil: "networkidle", timeout: 60000 });

    // <button type="button" class="btn" onclick="rep.Excel()">Convert to Excel</button>
    const convertButton = page.locator('button.btn:has-text("Convert to Excel")').first();
    await convertButton.waitFor({ state: "visible", timeout: 30000 });

    console.log("⬇️  Clicking [Convert to Excel] and waiting for the download...");
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 60000 }),
      convertButton.click(),
    ]);

    const downloadPath = await download.path();
    if (!downloadPath) {
      throw new Error(`CStoreOffice download failed: ${await download.failure()}`);
    }
    const contents = fs.readFileSync(downloadPath, "utf8");
    console.log(`✅ Downloaded ${download.suggestedFilename()} (${contents.length} chars).`);
    return contents;
  } catch (error) {
    try {
      const buffer = await page.screenshot({ fullPage: true });
      error.screenshotUrl = await uploadToCdn(buffer, `cso_ar_customers_err_${Date.now()}.png`);
    } catch (ssErr) {
      console.error("Unable to capture diagnostic screenshot:", ssErr);
    }
    throw error;
  } finally {
    await browser.close();
  }
}

module.exports = { downloadCsoCustomerExport };
