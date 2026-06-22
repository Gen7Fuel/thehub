const { chromium } = require("playwright-extra");
const stealth = require("puppeteer-extra-plugin-stealth")();
const fs = require("fs");
const path = require("path");

// Inject stealth engine configuration matching your GasBuddy baseline
chromium.use(stealth);

async function uploadInventoryToPetrosoft() {
    console.log("🤖 Initializing Petrosoft Inventory Sync Engine...");

    // Validate the targets and paths before spinning up the browser context
    const csvFilePath = path.resolve(__dirname, "../tmp/DAX_INV_TEST(in).csv");
    const tempDir = path.resolve(__dirname, "../tmp");

    if (!fs.existsSync(csvFilePath)) {
        throw new Error(`❌ Target data payload missing at: ${csvFilePath}`);
    }

    // Detect server/container native environment binaries automatically
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

    // Create an isolated window space
    const context = await browser.newContext({
        viewport: { width: 1400, height: 1000 },
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    });

    const page = await context.newPage();

    try {
        // 💡 Fix: Target the base root application to let Keycloak generate fresh runtime session variables
        const loginUrl = "https://03.cstoreoffice.com";
        console.log(`🔗 Navigating to Petrosoft Gateway: ${loginUrl}`);

        // Step forward and wait until the dynamic redirects establish the user form inputs
        await page.goto(loginUrl, { waitUntil: "networkidle", timeout: 60000 });

        // Extra safeguard: Wait explicitly for the username block to verify routing finalized
        console.log("⏱️ Confirming form input visibility...");
        await page.waitForSelector("#username", { state: "visible", timeout: 15000 });

        console.log("🔑 Injecting authorization credentials from .env context...");
        await page.fill("#username", process.env.PETROSOFT_USERNAME);
        await page.fill("#password", process.env.PETROSOFT_PASSWORD);

        console.log("🚀 Submitting authentication payload sequence...");
        await page.click("#kc-login");

        console.log("⏱️ Waiting for internal network responses to stabilize...");
        await page.waitForLoadState("networkidle");

        // Capture explicit proof of the backend dashboard application view post-login
        const screenshotPath = path.join(tempDir, `petrosoft_login_success_${Date.now()}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`📸 Audit checkpoint preserved safely to local disk: ${screenshotPath}`);

        console.log(`ℹ️ [Ready for Next Step]: Verified active UI visibility.`);

    } catch (error) {
        console.error("❌ CRITICAL DISPATCH EXCEPTION IN PETROSOFT ENGINE:", error);

        try {
            const errorScreenshotPath = path.join(tempDir, `petrosoft_failure_${Date.now()}.png`);
            await page.screenshot({ path: errorScreenshotPath, fullPage: true });
            console.log(`📸 Diagnostic error state snapshot written safely to: ${errorScreenshotPath}`);
        } catch (ssErr) {
            console.error("Unable to execute diagnostic screenshot capture:", ssErr);
        }

        throw error;
    } finally {
        await browser.close();
        console.log("🔒 Headless production engine shut down successfully.");
    }
}

// Export for manual script runner usage or integration testing
module.exports = { uploadInventoryToPetrosoft };

// Execute directly if processed from the terminal instance
if (require.main === module) {
    // Ensure your execution reads local variables if running outside the Docker Compose orchestration layer
    require("dotenv").config();
    uploadInventoryToPetrosoft();
}