const fs = require("fs");
const { chromium } = require("playwright-extra");
const stealth = require("puppeteer-extra-plugin-stealth")();
const WriteOff = require("../models/WriteOff");
const User = require("../models/User");
const { pushNotification } = require("../services/notificationService");
const { emailQueue } = require("../queues/emailQueue");

chromium.use(stealth);

/**
 * Automates CStoreOffice entry and date selection, then inputs write-off items into the grid.
 *
 * @param {Object} params
 * @param {string} params.targetStationCsoCode - Station's Petrosoft CSO code.
 * @param {string} params.formattedDate - Date string in 'MM/DD/YYYY' format.
 * @param {string} params.formattedTime - Time string in 'HH:mm:ss' format.
 * @param {string} params.listNumber - List reference ID.
 * @param {string} params.writeOffId - MongoDB WriteOff document ID.
 * @param {Object} params.io - Socket.IO server instance.
 * @param {Array<Object>} params.items - Array of items from MongoDB [{ upc_barcode, reason, quantity }].
 */
async function syncWriteOffToCStore({
  targetStationCsoCode,
  formattedDate,
  formattedTime,
  listNumber,
  writeOffId,
  io,
  items = [],
  missingOnly = false,
}) {
  if (missingOnly) items = items.filter((item) => item.found === false);
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

  async function updateWriteOff(update) {
    if (!writeOffId) return;
    await WriteOff.findByIdAndUpdate(writeOffId, update);
  }

  async function uploadProof(buffer, originalName) {
    const formData = new FormData();
    formData.append(
      "file",
      new Blob([buffer], { type: "image/png" }),
      originalName,
    );
    const response = await fetch("http://cdn:5001/cdn/upload", {
      method: "POST",
      body: formData,
    });
    if (!response.ok) throw new Error(`CDN upload failed: ${response.status}`);
    const result = await response.json();
    return result.filename;
  }

  async function notifyAutomationIssue({ allItemsMissing, proofFilename, errorMessage }) {
    try {
      if (!allItemsMissing) {
        const proofUrl = proofFilename
          ? `https://app.gen7fuel.com/cdn/download/${proofFilename}`
          : "";
        await emailQueue.add(`writeoff-error-${Date.now()}`, {
          to: "daksh@gen7fuel.com",
          subject: `🚨 CStore Write-Off Automation Failure: ${listNumber}`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #f87171;border-radius:16px;background:#fff">
              <h2 style="color:#991b1b">⚠️ CStore Write-Off Automation Failure</h2>
              <p>A technical exception interrupted the automated CStore write-off process.</p>
              <p><strong>List:</strong> ${listNumber}</p>
              <p><strong>Error:</strong> ${errorMessage || "Unknown automation error"}</p>
              ${proofUrl ? `<p><a href="${proofUrl}">View diagnostic screenshot</a></p>` : ""}
            </div>`,
        });
        return;
      }
      if (!io) return;
      const categoryUsers = await User.find({ is_active: true })
        .populate("role", "role_name name")
        .select("email role");
      const categoryEmails = categoryUsers
        .filter((user) => /inventory\s*team/i.test(user.role?.role_name || user.role?.name || ""))
        .map((user) => user.email)
        .filter(Boolean);
      const recipients = allItemsMissing
        ? ["daksh@gen7fuel.com", "grayson@gen7fuel.com", ...categoryEmails]
        : ["daksh@gen7fuel.com"];

      await pushNotification({
        io,
        recipientEmails: [...new Set(recipients)],
        slug: "write-off-cso-automation-error",
        subject: `CStore Write-Off Items Not Found: ${listNumber}`,
        fieldValues: {
          listNumber,
          proofFilename,
          message: "All write-off items were missing from CStoreOffice.",
        },
      });
    } catch (notificationError) {
      console.error("❌ Failed to send write-off automation notification:", notificationError);
    }
  }

  await updateWriteOff({
    submittedAt: new Date(),
    csoSubmissionStatus: "pending",
  });
  let resolveUnknownItem;
  let unknownItemDetected = false;

  // An unknown UPC is reported through a native browser alert. If it is not
  // accepted, the alert blocks the page and the automation appears to hang.
  page.on("dialog", async (dialog) => {
    const message = dialog.message();
    console.warn(`⚠️ CStore dialog: ${message}`);
    if (/unknown item/i.test(message)) {
      unknownItemDetected = true;
      if (resolveUnknownItem) resolveUnknownItem();
    }
    await dialog.accept();
  });

  // CSO saves a row asynchronously.  The Save button can return immediately
  // while its AJAX lookup is still running, so the next item must not be
  // entered until the grid has created the next blank edit row.
  async function waitForCommittedEntry(previousCompletedEntryCount) {
    await page.waitForFunction(
      ({ previousCompletedEntryCount }) => {
        const completedEntryCount = Array.from(
          document.querySelectorAll('#oDGTableData > tbody > tr.dg-table-row'),
        ).filter((entry) => {
          const itemName = entry.querySelector('.selector_itemname')?.textContent.trim();
          const quantity = entry.querySelector('.selector_quantity')?.textContent.trim();
          const amount = entry.querySelector('.selector_amount')?.textContent.trim();
          return Boolean(itemName && quantity && amount && amount !== "NaN");
        }).length;

        return completedEntryCount > previousCompletedEntryCount;
      },
      { previousCompletedEntryCount },
      { timeout: 15000 },
    );
  }

  async function readWriteOffTotals() {
    return page.evaluate(() => {
      const toAmount = (value) => {
        const parsed = Number.parseFloat(String(value || "").replace(/,/g, ""));
        return Number.isFinite(parsed) ? parsed : 0;
      };
      const reportRows = Array.from(
        document.querySelectorAll(".tblReport tbody tr.even"),
      );
      const getTotal = (label) => {
        const row = reportRows.find((candidate) =>
          candidate.textContent.includes(label),
        );
        const inputs = row ? row.querySelectorAll("input") : [];
        return toAmount(inputs[inputs.length - 1]?.value);
      };

      return {
        today: getTotal("Today's Write-Offs:"),
        mtd: getTotal("Write-Offs MTD:"),
      };
    });
  }

  async function readCompletedEntryCount() {
    return page.evaluate(() =>
      Array.from(
        document.querySelectorAll("#oDGTableData > tbody > tr.dg-table-row"),
      ).filter((entry) => {
        const itemName = entry.querySelector(".selector_itemname")?.textContent.trim();
        const quantity = entry.querySelector(".selector_quantity")?.textContent.trim();
        const amount = entry.querySelector(".selector_amount")?.textContent.trim();
        return Boolean(itemName && quantity && amount && amount !== "NaN");
      }).length,
    );
  }

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

    // Capture the totals before adding this batch. Blank CSO inputs represent
    // zero, so normalize them before comparing the post-save values.
    const totalsBefore = await readWriteOffTotals();
    console.log(
      `📊 Write-off totals before save: Today=${totalsBefore.today} | MTD=${totalsBefore.mtd}`,
    );

    // CSO initially positions the editor on row 0, even when the selected
    // date already has saved entries. Move the grid cursor to the first empty
    // row so this batch is appended instead of editing the first existing row.
    const dataRows = page.locator("#oDGTableData > tbody > tr.dg-table-row");
    const existingEntryCount = await readCompletedEntryCount();
    if (existingEntryCount > 0) {
      // The last rendered grid row is the blank append row. Selecting it is
      // more reliable than fnDGMoveToRow(), which can leave the editor on row
      // zero when the page was loaded with existing entries.
      await dataRows.last().click({ force: true });
    } else {
      await page.evaluate(() => {
        if (typeof window.fnDGMoveToRow === "function") {
          window.fnDGMoveToRow(0);
        } else {
          throw new Error("CSO grid row navigation is unavailable.");
        }
      });
    }
    await page.waitForTimeout(500);

    // 4. Loop and Process Each Item into the #oDGTableEdit Grid
    let successfullyAddedCount = 0;
    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      unknownItemDetected = false;
      // WriteOff stores the field as `qty`; normalize it to the value used by
      // the CStore grid so the input never receives the literal string
      // "undefined".
      const { upc_barcode, reason, qty } = item;
      const quantity = qty;

      console.log(
        `\n⏳ Processing Item [${index + 1}/${items.length}] - UPC: ${upc_barcode}`,
      );

      // Step A: Select "Enter UPC / PLU" from "Enter By" Dropdown
      const enterByTd = page.locator('#oDGTableEdit td[ebindex="item"]');
      // Petrosoft's legacy combo box opens only from its arrow image. Clicking
      // the wrapper span leaves the option table in the DOM but hidden.
      await enterByTd.locator("span table img").click({ force: true });
      await page.waitForTimeout(300);

      // Scope the option to the active edit cell.  A global selector can find
      // hidden selector menus belonging to already-committed rows.
      const upcOption = enterByTd.locator('div[style*="z-index"] table td', {
        hasText: /^Enter UPC \/ PLU$/i,
      });

      await upcOption.waitFor({ state: "visible", timeout: 3000 });
      await upcOption.click();
      await page.waitForFunction(() => {
        const input = document.querySelector(
          '#oDGTableEdit td[ebindex="item"] input',
        );
        return input?.value?.trim() === "Enter UPC / PLU";
      }, undefined, { timeout: 3000 });
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

      // The unknown-item alert is raised during the UPC lookup, before the
      // row-level Save handler runs. Skip immediately so we do not populate
      // the rest of an invalid row or trigger the valid-UPC alert.
      if (unknownItemDetected) {
        console.warn(`⚠️ UPC ${upc_barcode} was not found; skipping item.`);
        await WriteOff.findOneAndUpdate(
          { _id: writeOffId, "items._id": item._id },
          { $set: { "items.$.found": false } },
        );
        await page.evaluate(() => {
          if (typeof window.fnDGButtonRevert === "function") {
            window.fnDGButtonRevert();
          }
        });
        await page.waitForTimeout(500);
        continue;
      }

      await WriteOff.findOneAndUpdate(
        { _id: writeOffId, "items._id": item._id },
        {
          $set: {
            "items.$.found": true,
          },
        },
      );

      // Step C: Select Reason
      if (reason) {
        const reasonCell = page.locator('#oDGTableEdit td[ebindex="reason"]');
        await reasonCell.locator("span table img").click({ force: true });
        await page.waitForTimeout(300);

        const reasonOption = reasonCell.locator(
          'div[style*="z-index"] table td',
          {
          hasText: new RegExp(`^${reason.trim()}$`, "i"),
          },
        );

        await reasonOption.waitFor({ state: "visible", timeout: 3000 });
        await reasonOption.click();
        await page.waitForFunction(
          (expectedReason) => {
            const input = document.querySelector(
              '#oDGTableEdit td[ebindex="reason"] input',
            );
            return input?.value?.trim().toLowerCase() === expectedReason;
          },
          reason.trim().toLowerCase(),
          { timeout: 3000 },
        );
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

      // Total Retail Value is rendered in the active editor row after the
      // quantity is entered. Read the exact amount cell before committing;
      // the committed table does not consistently retain the same selectors.
      await page.waitForFunction(() => {
        const cell = document.querySelector(
          '#oDGTableEdit td[ebindex="amount"]',
        );
        return Boolean(cell?.textContent.trim() && cell.textContent.trim() !== "NaN");
      }, undefined, { timeout: 5000 });
      const costText = await page
        .locator('#oDGTableEdit td[ebindex="amount"]')
        .textContent();
      const parsedCost = Number.parseFloat(String(costText || "").replace(/,/g, ""));
      await WriteOff.findOneAndUpdate(
        { _id: writeOffId, "items._id": item._id },
        {
          $set: {
            "items.$.found": true,
            "items.$.writeOffCost": Number.isFinite(parsedCost) ? parsedCost : 0,
          },
        },
      );

      // Step F: Save Item Row
      const previousCompletedEntryCount = await page.evaluate(() =>
        Array.from(
          document.querySelectorAll('#oDGTableData > tbody > tr.dg-table-row'),
        ).filter((entry) => {
          const itemName = entry.querySelector('.selector_itemname')?.textContent.trim();
          const quantity = entry.querySelector('.selector_quantity')?.textContent.trim();
          const amount = entry.querySelector('.selector_amount')?.textContent.trim();
          return Boolean(itemName && quantity && amount && amount !== "NaN");
        }).length,
      );
      const enterBtn = page.locator("#oDGTableEdit #dgButtonSave");
      await enterBtn.waitFor({ state: "visible", timeout: 5000 });
      const unknownItem = new Promise((resolve) => {
        resolveUnknownItem = resolve;
      });
      await enterBtn.click();

      // The CSO handler performs an async UPC validation before it calls the
      // actual grid save.  Waiting only a fixed delay lets the next iteration
      // overwrite the current edit row.  Wait for the committed row instead.
      const commitResult = await Promise.race([
        waitForCommittedEntry(previousCompletedEntryCount).then(() => "saved"),
        unknownItem.then(() => "unknown"),
      ]);
      resolveUnknownItem = undefined;

      if (commitResult === "unknown") {
        console.warn(`⚠️ UPC ${upc_barcode} was not found; skipping item.`);
        // CSO can leave reason/quantity/time populated after the alert while
        // clearing only the UPC. Reset the edit row before continuing so its
        // next save cannot trigger "You should enter a valid UPC".
        await page.evaluate(() => {
          if (typeof window.fnDGButtonRevert === "function") {
            window.fnDGButtonRevert();
          }
        });
        await page.waitForFunction(() => {
          const upcInput = document.querySelector(
            '#oDGTableEdit td[ebindex="upc"] input',
          );
          return !upcInput || upcInput.value.trim() === "";
        }, undefined, { timeout: 5000 });
        await page.waitForTimeout(500);
        continue;
      }

      console.log(`✅ Item ${upc_barcode} added to grid successfully.`);
      successfullyAddedCount += 1;
    }

    // 5. Save the completed write-off in CStoreOffice.
    const saveButton = page.locator("#Add_href");
    await saveButton.waitFor({ state: "visible", timeout: 10000 });
    await saveButton.click();

    // Saving is handled by the legacy page JavaScript and may not navigate.
    // Give its request/UI update time to complete before capturing the result.
    await page.waitForTimeout(3000);

    await page.waitForFunction(
      ({ todayBefore, mtdBefore, completedEntriesBeforeSave, successfullyAddedCount }) => {
        const toAmount = (value) => {
          const parsed = Number.parseFloat(String(value || "").replace(/,/g, ""));
          return Number.isFinite(parsed) ? parsed : 0;
        };
        const rows = Array.from(
          document.querySelectorAll(".tblReport tbody tr.even"),
        );
        const getTotal = (label) => {
          const row = rows.find((candidate) => candidate.textContent.includes(label));
          const inputs = row ? row.querySelectorAll("input") : [];
          return toAmount(inputs[inputs.length - 1]?.value);
        };

        const completedEntriesAfterSave = Array.from(
          document.querySelectorAll("#oDGTableData > tbody > tr.dg-table-row"),
        ).filter((entry) => {
          const itemName = entry.querySelector(".selector_itemname")?.textContent.trim();
          const quantity = entry.querySelector(".selector_quantity")?.textContent.trim();
          const amount = entry.querySelector(".selector_amount")?.textContent.trim();
          return Boolean(itemName && quantity && amount && amount !== "NaN");
        }).length;

        const totalsIncreased =
          getTotal("Today's Write-Offs:") > todayBefore &&
          getTotal("Write-Offs MTD:") > mtdBefore;
        const entriesAdded = completedEntriesAfterSave > completedEntriesBeforeSave;

        // If every requested UPC was unknown, there is intentionally no new
        // row or total to verify. Treat that as a completed no-op instead of
        // reporting a false automation failure.
        return successfullyAddedCount === 0 || totalsIncreased || entriesAdded;
      },
      {
        todayBefore: totalsBefore.today,
        mtdBefore: totalsBefore.mtd,
        completedEntriesBeforeSave: existingEntryCount,
        successfullyAddedCount,
      },
      { timeout: 15000 },
    );

    const totalsAfter = await readWriteOffTotals();
    console.log(
      `✅ Write-off totals verified: Today=${totalsAfter.today} | MTD=${totalsAfter.mtd}`,
    );
    console.log(`💾 CStore write-off saved for List: ${listNumber}`);

    // 6. Final Snapshot Capture (after Save), kept in memory and uploaded
    // directly to CDN without writing a local project/temp file.
    const timestamp = Date.now();
    const screenshotBuffer = await page.screenshot({ fullPage: true });
    const screenshotName = `WO_FINAL_${listNumber}_${targetStationCsoCode}_${timestamp}.png`;

    const proofFilename = await uploadProof(screenshotBuffer, screenshotName);
    const allItemsMissing = items.length > 0 && successfullyAddedCount === 0;
    await updateWriteOff({
      csoSubmissionStatus: allItemsMissing ? "error" : "success",
      csoSubmissionProof: proofFilename,
    });
    if (allItemsMissing) {
      await notifyAutomationIssue({ allItemsMissing: true, proofFilename });
    }

    return { success: true, proofFilename };
  } catch (error) {
    console.error(
      `❌ CStore Write-Off Sync Error for List ${listNumber}:`,
      error,
    );

    try {
      const errorBuffer = await page.screenshot({ fullPage: true });
      const errorName = `ERR_WO_${listNumber}_${Date.now()}.png`;
      const proofFilename = await uploadProof(errorBuffer, errorName);
      await updateWriteOff({
        csoSubmissionStatus: "error",
        csoSubmissionProof: proofFilename,
      });
      await notifyAutomationIssue({
        allItemsMissing: false,
        proofFilename,
        errorMessage: error.message,
      });
    } catch (ssErr) {
      console.error("Could not write local failure snapshot:", ssErr);
      await updateWriteOff({ csoSubmissionStatus: "error" });
    }

    throw error;
  } finally {
    await browser.close();
  }
}

module.exports = { syncWriteOffToCStore };
