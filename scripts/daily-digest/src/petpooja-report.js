import ExcelJS from 'exceljs';

// PetPooja "Item Wise Sales Report" xlsx structure (confirmed from real reports):
//   Rows 1-3: metadata (Date range, Name, Restaurant Name)
//   Rows 4-5: blank
//   Row   6: column headers ["Category", "Item", "Code", "Sap Code", "Qty.", "Total (₹)"]
//   Rows 7-10: summary aggregates (Total, Min, Max, Avg) in the Qty and Total columns
//   Rows 11+: item rows grouped by category, with a "Sub Total" row separating each group
//
// We extract:
//   - dateRange, restaurantName
//   - grandTotalQty, grandTotalRevenue (from row 7)
//   - items: [{ category, name, qty, total }]
//   - categories: [{ name, qty, total }] (from Sub Total rows + category carry-forward)

const HEADER_ROW = 6;
const TOTAL_ROW = 7;
const DATA_START_ROW = 11;

const COL_CATEGORY = 1;
const COL_ITEM = 2;
const COL_QTY = 5;
const COL_TOTAL = 6;

export async function parseItemWiseSalesReport(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const sheet = wb.worksheets[0];
  if (!sheet) return null;

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
        categories.push({
          name: currentCategory,
          qty: qty ?? 0,
          total: total ?? 0,
        });
      }
      currentCategory = null;
      continue;
    }

    if (catCell && itemCell) {
      currentCategory = catCell;
    }

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
    dateRange,
    restaurantName,
    grandTotalQty,
    grandTotalRevenue,
    items,
    categories,
  };
}

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
    dateRange: report.dateRange,
    totalOrders: report.grandTotalQty,
    totalRevenue: report.grandTotalRevenue,
    topItems,
    topCategories,
  };
}

function cellText(sheet, rowNum, colNum) {
  const v = sheet.getRow(rowNum).getCell(colNum).value;
  if (v == null) return null;
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
