// Store-created orders use the same site item book as cycle count inventory.
const barcodeKey = value => String(value ?? '').replace(/^0+/, '');

function validateBarcode(value) {
  if (typeof value !== 'string' || !/^\d{6,14}$/.test(value.trim()) || !barcodeKey(value.trim())) {
    throw Object.assign(new Error('Enter a barcode containing 6 to 14 digits.'), { status: 400 });
  }
  return barcodeKey(value.trim());
}

function requireStoreAccess(user, site, permissionMap) {
  if (!user) throw Object.assign(new Error('Authentication required.'), { status: 401 });
  const permId = permissionMap.get('orderRec');
  const override = user.customPermissionsArray?.find(p => p.permId === permId);
  const allowed = permId != null && (override?.value ?? user.role?.permissionsArray?.find(p => p.permId === permId)?.value);
  if (!allowed) throw Object.assign(new Error('Access denied for orderRec.'), { status: 403 });
  if (typeof site !== 'string' || !site.trim()) {
    throw Object.assign(new Error('Site is required.'), { status: 400 });
  }
  const siteAccess = user.site_access instanceof Map ? user.site_access.get(site) : user.site_access?.[site];
  if (site !== user.stationName && site !== user.site && siteAccess !== true) {
    throw Object.assign(new Error('Access denied for this site.'), { status: 403 });
  }
}

function scanItem(row) {
  const nullableNumber = value => value == null || value === '' ? null : Number(value);
  return {
    id: row.id,
    gtin: row.gtin || row.upc_barcode || row.upc,
    upc: row.upc_barcode || row.upc || row.gtin,
    itemName: row.description || 'Unnamed item',
    categoryNumber: String(row.category_id ?? '0'),
    onHandQty: nullableNumber(row.on_hand_qty),
    packsPerCarton: nullableNumber(row.pk_in_crt),
    cartonsPerCase: nullableNumber(row.crt_in_case),
    lastInventoryDate: row.last_inv_date,
    imageUrl: row.image_url || null,
    active: row.active,
  };
}

async function lookupScanItem(db, siteId, barcode) {
  const key = validateBarcode(barcode);
  const matches = await db('item_bk').where({ site: String(siteId) })
    .andWhere(function () {
      this.whereRaw("ltrim(upc_barcode, '0') = ?", [key])
        .orWhereRaw("ltrim(upc, '0') = ?", [key])
        .orWhereRaw("ltrim(gtin, '0') = ?", [key]);
    }).select('*').limit(2);
  if (!matches.length) throw Object.assign(new Error('No item found for this barcode at this store.'), { status: 404 });
  if (matches.length > 1) throw Object.assign(new Error('This barcode matches more than one item. Please ask an administrator to check the item book.'), { status: 409 });
  return scanItem(matches[0]);
}

function validateScanLines(items) {
  if (!Array.isArray(items) || items.length === 0 || items.length > 500) {
    throw Object.assign(new Error('An order must contain between 1 and 500 items.'), { status: 400 });
  }
  const ids = new Set();
  for (const item of items) {
    if (!item || !Number.isSafeInteger(item.id) || item.id < 1 ||
        !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 99999 || ids.has(item.id)) {
      throw Object.assign(new Error('Each item must have a unique item ID and a whole quantity from 1 to 99999.'), { status: 400 });
    }
    ids.add(item.id);
  }
}

function buildScanCategories(rows, lines) {
  const byId = new Map(rows.map(row => [row.id, row]));
  const categories = new Map();
  const gtins = new Set();
  for (const line of lines) {
    const row = byId.get(line.id);
    if (!row) throw Object.assign(new Error('An item is no longer in this store’s item book. Remove it and scan again.'), { status: 409 });
    const item = scanItem(row);
    if (!item.gtin || gtins.has(barcodeKey(item.gtin))) {
      throw Object.assign(new Error('Items have missing or duplicate product codes. Please check the item book.'), { status: 409 });
    }
    gtins.add(barcodeKey(item.gtin));
    const unitsPerCase = row.pk_in_crt > 0 && row.crt_in_case > 0 ? Number(row.pk_in_crt) * Number(row.crt_in_case) : 0;
    if (!categories.has(item.categoryNumber)) {
      categories.set(item.categoryNumber, { number: item.categoryNumber, name: 'Uncategorized', items: [] });
    }
    categories.get(item.categoryNumber).items.push({
      gtin: item.gtin,
      itemName: item.itemName,
      onHandQty: item.onHandQty,
      inventoryUpdatedAt: item.lastInventoryDate,
      unitInCase: unitsPerCase,
      itemsToOrder: unitsPerCase * line.quantity,
      casesToOrder: line.quantity,
    });
  }
  return [...categories.values()];
}

module.exports = { barcodeKey, validateBarcode, requireStoreAccess, scanItem, lookupScanItem, validateScanLines, buildScanCategories };
