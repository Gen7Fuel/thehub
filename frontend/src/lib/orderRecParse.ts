// Parsing for the order rec CSV export.
//
// This lives outside the upload route on purpose. The carton-code rules below
// decide what every item is matched against on the planogram, so they are worth
// testing directly — and importing the route component to do that would drag the
// whole navbar layout, dropzone and auth context into a unit test.
//
// File shape: row 1 is "Generated: ...", row 2 the header. After that, category
// headers ("101 | Cigarettes FN") introduce items. Each item is a row carrying
// its GTIN in column A, followed by sub-rows for the forms it is sold in — pack,
// case and carton — plus "Scan rate < 80%" notes.

import Papa from 'papaparse'

export interface ItemData {
  gtin: string
  // Column B of this item's CRT ("carton") row, when it has one. The planogram
  // lists this code — not the GTIN — for anything sold by the carton.
  crtCode: string
  vin: string
  itemName: string
  strainName?: string // New field for PCG CSVs
  size: string
  onHandQty: number
  forecast: number
  minStock: number
  itemsToOrder: number
  unitInCase: number
  casesToOrder: number
}

export interface CategoryData {
  number: string
  name: string
  items: ItemData[]
}

// Carton rows whose column B was present but unusable. Collected as an optional
// out-param so the return type stays a plain category list: only the upload
// screen cares, and it needs to warn before the order rec is ever created.
export interface OrderRecParseStats {
  unreadableCartonCodes: number
  /** The offending cell values, deduped, for the warning message. */
  samples: string[]
}

export function isValidOrderRecCSV(csvContent: string): boolean {
  const lines = csvContent.split('\n').map(line => line.trim()).filter(Boolean);
  if (!lines[0]?.startsWith('Generated:')) return false;
  const headerLine = lines[1];
  const requiredHeaders = ['GTIN', 'VIN', 'Item Name', 'Size', 'On Hand Qty'];
  for (const header of requiredHeaders) {
    if (!headerLine.includes(header)) return false;
  }
  const hasCategory = lines.some(line => /^\d+\s*\|\s*.+/.test(line));
  if (!hasCategory) return false;
  const hasItem = lines.some(line => /^\s*\d{12,}/.test(line));
  if (!hasItem) return false;
  return true;
}

// An item row is the one that carries the GTIN in column A. The rows beneath it
// — the pack/case/carton breakdown and the "Scan rate < 80%" notes — belong to
// it until the next item row or category header.
function itemGtinOf(columns: string[]): string | null {
  const digits = (columns[0] ?? '').trim().replace(/\D/g, '');
  return digits && /^\d{12,}$/.test(digits) ? digits : null;
}

export function parseOrderRecCSV(
  csvContent: string,
  stats?: OrderRecParseStats
): CategoryData[] {
  const lines = csvContent.split('\n');
  const dataLines = lines.slice(2).filter(line => line.trim() !== '');
  // Parse every line once up front. The carton lookup below needs to read the
  // rows that follow an item, and re-running Papa.parse inside that scan made
  // the whole parse quadratic in the number of lines.
  const parsedLines: string[][] = dataLines.map(
    line => (Papa.parse(line, { skipEmptyLines: true }).data[0] as string[]) || []
  );
  const isCategoryLine = (line: string) => {
    const trimmed = line.trim();
    return trimmed.includes('|') && trimmed.split('|').length >= 2;
  };

  const categories: CategoryData[] = [];
  let currentCategory: CategoryData | null = null;

  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i];
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;

    // Category line (number | name)
    if (isCategoryLine(line)) {
      const parts = trimmedLine.split('|');
      const number = parts[0].trim();
      const nameWithCSVData = parts.slice(1).join('|').trim();
      const name = nameWithCSVData.split(',')[0].trim();

      currentCategory = {
        number,
        name,
        items: []
      };
      categories.push(currentCategory);
      continue;
    }

    // Item line (starts with GTIN)
    const columns = parsedLines[i];
    const firstCell = (columns[0] ?? '').trim();
    if (firstCell === 'TOTALS:') break;

    const firstColumn = itemGtinOf(columns);
    if (!firstColumn || !currentCategory) continue;

    // The item's block ends at the next item row, the next category header, or
    // TOTALS — whichever comes first. Bounding it is what keeps an item that has
    // no carton row of its own from adopting a LATER item's: the previous
    // implementation scanned to the end of the file and did exactly that.
    let blockEnd = i + 1;
    while (blockEnd < dataLines.length) {
      const cols = parsedLines[blockEnd];
      if ((cols[0] ?? '').trim() === 'TOTALS:') break;
      if (isCategoryLine(dataLines[blockEnd])) break;
      if (itemGtinOf(cols)) break;
      blockEnd++;
    }

    // Column D names the form of each row — "... 20 PK", "... 20 CS", "... 20
    // CRT". Matched case-insensitively and as a whole word so that CRT inside
    // some other token cannot trigger it. The scan starts at the item's own row
    // because a few products (the "FN Rollies 200 BAG CRT" bags) are themselves
    // the carton and have no sub-row.
    let crtRow: string[] | null = null;
    for (let r = i; r < blockEnd; r++) {
      if (/\bCRT\b/i.test(parsedLines[r][3] ?? '')) {
        crtRow = parsedLines[r];
        break;
      }
    }

    // Column B of the carton row. Only a plain run of digits is usable: "↑"
    // means "same as the row above", and a CSV that has been through Excel can
    // render this cell as "6.80085E+11", which has already lost its real digits.
    // Both must yield no crtCode so the backend falls back to the GTIN rather
    // than matching the planogram on a value we could not actually read.
    const rawCrtCell = (crtRow?.[1] ?? '').trim();
    const crtDigits = rawCrtCell.replace(/[\s-]/g, '');
    const crtCode = /^\d+$/.test(crtDigits) ? crtDigits : '';

    // An empty cell is normal — the bag-style products are their own carton and
    // carry no code. A cell that held something we could not read is not, and it
    // silently downgrades the item to a GTIN comparison, so it gets reported.
    if (rawCrtCell && !crtCode && stats) {
      stats.unreadableCartonCodes++;
      if (!stats.samples.includes(rawCrtCell) && stats.samples.length < 3) {
        stats.samples.push(rawCrtCell);
      }
    }

    // Cigarettes are counted and ordered by the carton, so their quantities come
    // off the CRT row while the GTIN stays the pack barcode from column A. Every
    // other category reads its own row. crtCode is captured either way, which is
    // what lets cigars match the planogram by carton code too.
    const src = /cigarette/i.test(currentCategory.name) && crtRow ? crtRow : columns;

    const itemData: ItemData = {
      gtin: firstColumn,
      crtCode,
      vin: src[2]?.toString() || '',
      itemName: src[3] || '',
      size: src[4] || '',
      onHandQty: parseInt(src[5]) || 0,
      forecast: parseInt(src[6]) || 0,
      minStock: parseInt(src[7]) || 0,
      itemsToOrder: parseInt(src[8]) || 0,
      unitInCase: parseInt(src[9]) || 0,
      casesToOrder: parseInt(src[12]) || 0
    };
    currentCategory.items.push(itemData);
  }
  return categories;
}
