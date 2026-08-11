// Schema for the staff-writable Google Sheets.
//
// WHY A SCHEMA AND NOT JUST "READ THE SHEET"
//   The first /partners build took row 0 as the header row for every sheet.
//   Across these five, the header sits on row 0, 1, 2 and 3 — so five of the
//   ten sheets it pulled rendered as "No data or rows found" and two more were
//   truncated to a single column. A sheet does not describe itself; this does.
//
// WHY IT IS ALSO THE SECURITY BOUNDARY
//   SHEETS below is an allowlist. The Drive account can see the customer list,
//   the daily sales tracker and the webhook-fed enquiry sheets; none of them
//   appear here, so no request can address them regardless of what it sends.
//   Adding a sheet to Drive does not expose it — someone has to add it here.
//
// SHAPES
//   records     rows of fields, addressed by header name      (marketing, experiments, drinks)
//   categories  parallel columns, each an independent list    (fest list)
//   monthGrid   employee x day matrix, one row per person     (attendance)

const MAX_TEXT = 200;
const MAX_LONG_TEXT = 2000;

// A leading =, +, - or @ makes Sheets evaluate the cell. In a sheet shared with
// the team that is a live exfiltration route: =IMPORTXML pulls a remote URL and
// =HYPERLINK disguises where a click goes. Checked on the first character only,
// so "Buy-one-get-one" and "Matcha + oat" pass untouched.
const FORMULA_LEAD = /^[=+\-@]/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * @param index Column position in the real sheet, 0-based. Explicit rather than
 *   resolved from the header text at runtime: these sheets have blank leading
 *   columns and duplicate blank headers, so name lookup alone is ambiguous.
 *   parseRecords still verifies the header matches and falls back to the name.
 */
const field = (key, column, index, opts = {}) => ({
  key,
  column,
  index,
  type: 'text',
  required: false,
  editable: true,
  ...opts,
});

const SHEETS = {
  'marketing-tracker': {
    id: 'marketing-tracker',
    label: 'Marketing Tracker',
    driveName: 'Marketing & Content Project Tracker 2026',
    shape: 'records',
    headerRow: 0,
    width: 13,
    ownerField: 'owner',
    // Column 0 is the sheet's own index column and 9 is Approval — both left
    // unmapped so a write preserves whatever is in them.
    fields: [
      field('department', 'Department', 1, { type: 'select', required: true, options: ['Marketing', 'Operations', 'Product'] }),
      field('taskName', 'Task Name', 2, { required: true }),
      field('subtask', 'Subtask', 3),
      field('owner', 'Owner', 4, { editable: false }),
      field('startDate', 'Start Date', 5, { type: 'date' }),
      field('dueDate', 'Due Date', 6, { type: 'date', required: true, notBefore: 'startDate' }),
      field('priority', 'Priority', 7, { type: 'select', options: ['1', '2', '3'] }),
      field('status', 'Status', 8, { type: 'select', options: ['Not Started', 'In Progress', 'Done'] }),
      field('expectedImpact', 'Expected Impact', 10, { type: 'longtext' }),
      field('remarks', 'Remarks', 11, { type: 'longtext' }),
      field('attachmentLink', 'Attachment Link', 12, { type: 'url' }),
    ],
  },

  experiments: {
    id: 'experiments',
    label: 'Experiments',
    driveName: 'EXPERIMENT tracker',
    shape: 'records',
    headerRow: 2,
    width: 9,
    // "Assignment" holds the person's name on this sheet — it is the owner
    // column under a different label.
    ownerField: 'assignment',
    fields: [
      field('subject', 'Subject', 1, { required: true }),
      field('assignment', 'Assignment', 2, { editable: false }),
      field('priority', 'Priority', 3, { type: 'select', options: ['1', '2', '3'] }),
      field('itemsNeeded', 'Items needed', 4, { type: 'longtext' }),
      field('status', 'Status', 5, { type: 'select', options: ['Not Started', 'In Progress', 'Done'] }),
      field('time', 'Time', 6),
      field('startDate', 'Start date', 7, { type: 'date' }),
      field('dueOn', 'Due on', 8, { type: 'date', notBefore: 'startDate' }),
    ],
  },

  // The sheet carries a title row, one unused blank column and three headers.
  // addedBy is new — it is what makes "edit your own" expressible here at all,
  // and it lands in the first column past the existing header.
  'drinks-invention': {
    id: 'drinks-invention',
    label: 'Drinks Invention',
    driveName: 'Drinks Invention List',
    shape: 'records',
    headerRow: 3,
    width: 7,
    ownerField: 'addedBy',
    fields: [
      field('drinkName', 'Drink Name', 1, { required: true }),
      field('inspirationLink', 'Inspiration Link', 3, { type: 'url' }),
      field('ingredients', 'Ingredients', 4, { type: 'longtext' }),
      field('currentStatus', 'Current Status', 5, { type: 'select', options: ['Idea', 'Testing', 'On menu', 'Parked'] }),
      // Column 6 does not exist in the sheet yet. Writing it creates it, which
      // is the point — without it "edit your own" cannot be expressed here.
      field('addedBy', 'Added By', 6, { editable: false }),
    ],
  },

  'fest-list': {
    id: 'fest-list',
    label: 'Needed for Fest',
    driveName: 'needed for fest',
    shape: 'categories',
    headerRow: 1,
    ownerField: null,
    fields: [],
  },

  attendance: {
    id: 'attendance',
    label: 'Attendance',
    driveName: 'Attendance Tracker 2026',
    shape: 'monthGrid',
    headerRow: 4,
    // Rows are people, not records, so there is no owner column to compare —
    // the row itself is the identity. canEdit is answered by row lookup, and
    // deliberately returns false through the record path.
    ownerField: null,
    nameColumn: 'Employee Name',
    fields: [],
  },
};

const has = (id) => typeof id === 'string' && Object.prototype.hasOwnProperty.call(SHEETS, id);

export function listSheets() {
  return Object.values(SHEETS).map(({ id, label, driveName, shape }) => ({ id, label, driveName, shape }));
}

export function getSchema(id) {
  return has(id) ? SHEETS[id] : null;
}

const text = (v) => (v === null || v === undefined ? '' : String(v));
const blank = (v) => text(v).trim() === '';

/**
 * Resolve each field to a column index.
 *
 * The declared index wins. The header is consulted only to catch a column
 * having been moved in the sheet since this file was written — if the name
 * turns up somewhere else, follow it, because the alternative is silently
 * reading the wrong column.
 */
function columnIndexes(schema, header) {
  const names = header.map((c) => text(c).trim().toLowerCase());
  const indexes = {};
  for (const f of schema.fields) {
    const declared = f.index;
    const atDeclared = names[declared];
    const wanted = f.column.trim().toLowerCase();
    if (atDeclared === wanted) {
      indexes[f.key] = declared;
      continue;
    }
    const found = names.indexOf(wanted);
    indexes[f.key] = found === -1 ? declared : found;
  }
  return indexes;
}

const headerOf = (schema, rows) =>
  (Array.isArray(rows) && Array.isArray(rows[schema.headerRow])) ? rows[schema.headerRow] : null;

export function parseRecords(schema, rows) {
  const header = headerOf(schema, rows);
  if (!schema || schema.shape !== 'records' || !header) return [];

  const indexes = columnIndexes(schema, header);
  const out = [];

  rows.slice(schema.headerRow + 1).forEach((row, i) => {
    const cells = Array.isArray(row) ? row : [];
    if (cells.every(blank)) return;
    const values = {};
    for (const f of schema.fields) values[f.key] = text(cells[indexes[f.key]]).trim();
    out.push({
      // 1-indexed, matching what the Sheets API expects for a range.
      rowNumber: schema.headerRow + i + 2,
      values,
    });
  });

  return out;
}

export function parseCategories(schema, rows) {
  const header = headerOf(schema, rows);
  if (!schema || schema.shape !== 'categories' || !header) return [];

  return header.reduce((acc, raw, col) => {
    const category = text(raw).trim();
    if (!category) return acc;

    const items = [];
    let lastIndex = -1;
    rows.slice(schema.headerRow + 1).forEach((row, i) => {
      const value = text(Array.isArray(row) ? row[col] : '').trim();
      const index = schema.headerRow + 1 + i;
      if (value) {
        items.push({ value, row: index + 1, column: col + 1 });
        lastIndex = index;
      }
    });

    acc.push({
      category,
      column: col + 1,
      items,
      // Where an add should land. Falls to the first data row when the column
      // is empty, so adding never overwrites the last item.
      nextFreeRow: (lastIndex === -1 ? schema.headerRow + 1 : lastIndex + 1) + 1,
    });
    return acc;
  }, []);
}

export function canEdit(schema, record, user) {
  if (!schema || !schema.ownerField || !record || !record.values) return false;
  const name = text(user && user.name).trim().toLowerCase();
  const owner = text(record.values[schema.ownerField]).trim().toLowerCase();
  if (!name || !owner) return false;
  return name === owner;
}

function validateField(f, raw, values) {
  const value = text(raw).trim();

  if (f.required && !value) return `${f.column} is required.`;
  if (!value) return null;

  if (f.type !== 'url' && FORMULA_LEAD.test(value)) {
    return `${f.column} cannot start with = + - or @ — Sheets would read it as a formula.`;
  }

  const cap = f.type === 'longtext' ? MAX_LONG_TEXT : MAX_TEXT;
  if (value.length > cap) return `${f.column} is too long — keep it under ${cap} characters.`;

  if (f.type === 'select' && f.options && !f.options.includes(value)) {
    return `${f.column} must be one of: ${f.options.join(', ')}.`;
  }

  if (f.type === 'date') {
    if (!ISO_DATE.test(value)) return `${f.column} must be a date (YYYY-MM-DD).`;
    const d = new Date(`${value}T00:00:00Z`);
    // Round-trip catches 2026-13-45, which Date would otherwise roll over.
    if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) {
      return `${f.column} is not a real date.`;
    }
    if (f.notBefore) {
      const other = text(values[f.notBefore]).trim();
      if (ISO_DATE.test(other) && value < other) {
        return `${f.column} is before the start date (${other}).`;
      }
    }
  }

  if (f.type === 'url' && !/^https?:\/\/\S+$/i.test(value)) {
    return `${f.column} must be a http:// or https:// link.`;
  }

  return null;
}

export function validate(schema, values = {}) {
  const errors = {};
  if (!schema) return { valid: false, errors };
  for (const f of schema.fields) {
    const message = validateField(f, values[f.key], values);
    if (message) errors[f.key] = message;
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * Build the row array to write.
 *
 * `existingRow` is preserved cell-for-cell where this schema has no field —
 * the sheet's own index column, formulas, anything a person added by hand.
 * `user` overrides the owner field: taking it from the payload would let
 * anyone file a row under someone else's name and bypass "edit your own".
 */
export function toRowValues(schema, values = {}, existingRow = null, user = null) {
  if (!schema || schema.shape !== 'records') return [];

  const base = Array.isArray(existingRow) ? existingRow : [];
  const width = Math.max(base.length, schema.width);
  const row = Array.from({ length: width }, (_, i) => text(base[i]));

  for (const f of schema.fields) {
    if (schema.ownerField === f.key && user && user.name) {
      row[f.index] = user.name;
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(values, f.key)) {
      row[f.index] = text(values[f.key]).trim();
    }
  }
  return row;
}
