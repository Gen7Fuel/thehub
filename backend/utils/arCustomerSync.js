const ArCustomer = require("../models/ArCustomer");

/**
 * Parses the CStoreOffice "Convert to Excel" customer export. The file is an
 * HTML table saved as .xls; a data row is any <tr> whose first cell is all
 * digits (customer id) and whose second cell is the customer name.
 * Mirrors the parser in Desk's ar-customer-api.ts so a manual upload and the
 * automated sync read the file identically.
 * @param {string} html
 * @returns {Array<{ customerId: string, name: string }>}
 */
function parseCsoCustomers(html) {
  const trMatches = html.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  const customers = [];
  for (const tr of trMatches) {
    const cells = (tr.match(/<(?:td|th)[\s\S]*?<\/(?:td|th)>/gi) ?? []).map((td) =>
      td
        .replace(/<[^>]+>/g, "")
        .replace(/&nbsp;/gi, "")
        .trim(),
    );
    if (cells.length >= 2 && /^\d+$/.test(cells[0])) {
      customers.push({ customerId: cells[0], name: cells[1] });
    }
  }
  return customers;
}

/**
 * Upserts the given customers (name only — credit limit, phone, email, notes
 * are Hub-owned) and deletes every customer not in the list.
 * @param {Array<{ customerId: string, name: string }>} customers
 */
async function syncArCustomers(customers) {
  const ops = customers.map(({ customerId, name }) => ({
    updateOne: {
      filter: { customerId },
      update: {
        $set: { name },
        $setOnInsert: { creditLimit: null, phone: "", email: "", notes: "" },
      },
      upsert: true,
    },
  }));

  const result = await ArCustomer.bulkWrite(ops);

  const customerIds = customers.map((c) => c.customerId);
  const deleteResult = await ArCustomer.deleteMany({
    customerId: { $nin: customerIds },
  });

  return {
    created: result.upsertedCount,
    updated: result.modifiedCount,
    deleted: deleteResult.deletedCount,
  };
}

module.exports = { parseCsoCustomers, syncArCustomers };
