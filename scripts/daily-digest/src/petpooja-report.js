import ExcelJS from 'exceljs';

// PetPooja sends two distinct xlsx templates, distinguishable by the "Name:"
// metadata row at the top of the file. We support both and normalise their
// outputs to the same shape.
//
//   Template A — "Item Wise: Sales Report"
//     Columns: Category | Item | Code | Sap Code | Qty. | Total (₹)
//     Aggregate template: one row per item with its total quantity + revenue
//     for the period, grouped by Category with Sub Total dividers.
//
//   Template B — "Item Wise Report With Bill No."   (the actual nightly email)
//     Columns: Date | Timestamp | Server Name | Table No. | Covers |
//              Invoice No. | hsn_code | Category | Item | Variation |
//              Price | Qty. | Sub Total | Discount | Tax
//     Bill-line-by-line. One row per item sold (so 17 rows = 17 items sold).
//     Last row is a "Total" summary in the Price/Qty/Sub Total/Discount/Tax
//     columns.

const TEMPLATE_HEADER_ROW = {
  sales: 6,
  billwise: 5,
};

export async function parseItemWiseSalesReport(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const sheet = wb.worksheets[0];
  if (!sheet) return null;

  const templateName = cellText(sheet, 2, 2) ?? '';
  if (templateName.startsWith('Item Wise Report With Bill No')) {
    return parseBillwiseReport(sheet);
  }
  if (templateName.startsWith('Item Wise')) {
    return parseAggregateSalesReport(sheet);
  }
  throw new Error(
    `PetPooja xlsx template mismatch: unsupported "${templateName}" at row 2`,
  );
}

// -- Template A parser (aggregate sales report) --

function parseAggregateSalesReport(sheet) {
  const HEADER_ROW = TEMPLATE_HEADER_ROW.sales;
  const TOTAL_ROW = 7;
  const DATA_START_ROW = 11;
  const COL_CATEGORY = 1;
  const COL_ITEM = 2;
  const COL_QTY = 5;
  const COL_TOTAL = 6;

  const categoryHeader = cellText(sheet, HEADER_ROW, COL_CATEGORY);
  const totalHeader = cellText(sheet, HEADER_ROW, COL_TOTAL);
  if (categoryHeader !== 'Category' || !/^Total/.test(totalHeader ?? '')) {
    throw new Error(
      `PetPooja aggregate template header mismatch at row ${HEADER_ROW}: "${categoryHeader}" / "${totalHeader}"`,
    );
  }

  const dateRange = cellText(sheet, 1, 2);
  const restaurantName = cellText(sheet, 3, 2);
  const grandTotalQty = cellNumber(sheet, TOTAL_ROW, COL_QTY);
  const grandTotalRevenue = cellNumber(sheet, TOTAL_ROW, COL_TOTAL);

  const items = [];
  const categories = [];
  let currentCategory = null;

  for (let r = DATA_START_ROW; r <= sheet.rowCount; r++) {
    const catCell = cellText(sheet, r, COL_CATEGORY);
    const itemCell = cellText(sheet, r, COL_ITEM);
    const qty = cellNumber(sheet, r, COL_QTY);
    const total = cellNumber(sheet, r, COL_TOTAL);

    if (catCell === 'Sub Total') {
      if (currentCategory && (qty != null || total != null)) {
        categories.push({ name: currentCategory, qty: qty ?? 0, total: total ?? 0 });
      }
      currentCategory = null;
      continue;
    }

    if (catCell && itemCell) currentCategory = catCell;

    if (itemCell && (qty != null || total != null)) {
      items.push({
        category: currentCategory,
        name: itemCell,
        qty: qty ?? 0,
        total: total ?? 0,
      });
    }
  }

  return {
    template: 'sales',
    dateRange,
    restaurantName,
    grandTotalQty,
    grandTotalRevenue,
    items,
    categories,
    billCount: null,
  };
}

// -- Template B parser (bill-line-by-line report) --

function parseBillwiseReport(sheet) {
  const HEADER_ROW = TEMPLATE_HEADER_ROW.billwise;
  const COL_INVOICE = 6;
  const COL_CATEGORY = 8;
  const COL_ITEM = 9;
  const COL_QTY = 12;
  const COL_SUBTOTAL = 13;

  if (cellText(sheet, HEADER_ROW, COL_INVOICE) !== 'Invoice No.') {
    throw new Error(
      `PetPooja billwise template header mismatch at row ${HEADER_ROW}: expected "Invoice No." at col ${COL_INVOICE}`,
    );
  }

  const dateRange = cellText(sheet, 1, 2);
  const restaurantName = cellText(sheet, 3, 2);

  const billSet = new Set();
  const itemTotals = new Map();
  const categoryTotals = new Map();
  let runningRevenue = 0;
  let runningQty = 0;

  for (let r = HEADER_ROW + 1; r <= sheet.rowCount; r++) {
    const firstCell = cellText(sheet, r, 1);
    if (firstCell === 'Total') break; // summary row

    const invoice = cellText(sheet, r, COL_INVOICE);
    const category = cellText(sheet, r, COL_CATEGORY);
    const item = cellText(sheet, r, COL_ITEM);
    const qty = cellNumber(sheet, r, COL_QTY) ?? 0;
    const subtotal = cellNumber(sheet, r, COL_SUBTOTAL) ?? 0;

    if (!item) continue;
    if (invoice) billSet.add(invoice);
    runningQty += qty;
    runningRevenue += subtotal;

    const itemKey = item;
    const prevItem = itemTotals.get(itemKey) ?? { category, name: item, qty: 0, total: 0 };
    itemTotals.set(itemKey, {
      category: prevItem.category ?? category,
      name: item,
      qty: prevItem.qty + qty,
      total: prevItem.total + subtotal,
    });

    if (category) {
      const prevCat = categoryTotals.get(category) ?? { name: category, qty: 0, total: 0 };
      categoryTotals.set(category, {
        name: category,
        qty: prevCat.qty + qty,
        total: prevCat.total + subtotal,
      });
    }
  }

  return {
    template: 'billwise',
    dateRange,
    restaurantName,
    grandTotalQty: runningQty,
    grandTotalRevenue: runningRevenue,
    items: [...itemTotals.values()],
    categories: [...categoryTotals.values()],
    billCount: billSet.size,
  };
}

// -- Shared helpers --

export function summariseForDigest(report, { topN = 5 } = {}) {
  if (!report) return null;
  const topItems = [...report.items]
    .sort((a, b) => b.qty - a.qty)
    .slice(0, topN)
    .map((item) => ({ name: item.name, category: item.category, qty: item.qty, total: item.total }));
  const topCategories = [...report.categories]
    .sort((a, b) => b.total - a.total)
    .slice(0, 3)
    .map((c) => ({ name: c.name, qty: c.qty, total: c.total }));
  return {
    template: report.template,
    dateRange: report.dateRange,
    totalOrders: report.grandTotalQty,
    totalRevenue: report.grandTotalRevenue,
    billCount: report.billCount,
    topItems,
    topCategories,
  };
}

function cellText(sheet, rowNum, colNum) {
  const v = sheet.getRow(rowNum).getCell(colNum).value;
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object' && 'richText' in v) {
    return v.richText.map((rt) => rt.text).join('').trim();
  }
  const str = String(v).trim();
  return str === '' ? null : str;
}

function cellNumber(sheet, rowNum, colNum) {
  const v = sheet.getRow(rowNum).getCell(colNum).value;
  if (v == null || v === '') return null;
  const n = typeof v === 'object' && 'result' in v ? Number(v.result) : Number(v);
  return Number.isFinite(n) ? n : null;
}
