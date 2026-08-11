// Schema for the staff console's own Google Sheets.
//
// THESE ARE NEW SHEETS. NOTHING HERE ADDRESSES AN EXISTING ONE.
//   The console reads and writes only sheets it created itself. The originals
//   — the customer list, the sales tracker, the live fest and attendance
//   sheets — are never named here and are never written.
//
//   That is enforced by Google, not by this file. The OAuth grant is
//   `drive.file` (per-file access to files the app created) plus
//   `drive.readonly`. A write aimed at a pre-existing sheet is refused by the
//   API regardless of what this code asks for. Read access is separate and
//   read-only, which is what the one-time seed uses.
//
// WHY NEW SHEETS ARE BETTER THAN ADOPTING THE OLD ONES
//   The originals put their headers on four different rows, ship ragged rows,
//   and two of them are not tables at all: the fest list is seven parallel
//   category columns and attendance is an employee x day matrix. Both are
//   normalised here into ordinary rows, so one parser serves everything and
//   the UI is free to render a checklist or a month grid on top.
//
// EVERY SHEET SHARES THE SAME SPINE
//   rowId      opaque, stable — an edit targets this, not a row number, so a
//              sort or an inserted row in the sheet cannot redirect a write
//   addedBy    who created it; the basis of "edit your own"
//   addedAt    ISO timestamp
//   updatedBy  who last changed it
//   updatedAt  ISO timestamp

const MAX_TEXT = 200;
const MAX_LONG_TEXT = 2000;

// A leading =, +, - or @ makes Sheets evaluate the cell. In a sheet the whole
// team can open that is a live exfiltration route — =IMPORTXML fetches a remote
// URL, =HYPERLINK disguises a destination. First character only, so
// "Buy-one-get-one" and "Matcha + oat" are untouched.
const FORMULA_LEAD = /^[=+\-@]/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const f = (key, column, index, opts = {}) => ({
  key, column, index, type: 'text', required: false, editable: true, ...opts,
});

// Written on create/update by the server, never by the client. Appended after
// the domain columns of each sheet.
const auditFields = (start) => [
  f('addedBy', 'Added By', start, { editable: false }),
  f('addedAt', 'Added At', start + 1, { editable: false }),
  f('updatedBy', 'Updated By', start + 2, { editable: false }),
  f('updatedAt', 'Updated At', start + 3, { editable: false }),
];

const ROW_ID = f('rowId', 'Row Id', 0, { editable: false });

// Canonical values, taken from what the live sheets actually contain rather
// than invented: Status is "Completed", not "Done", and Priority runs to 5.
// The seed normalises the variants it finds ("Not started" vs "Not Started").
const STATUS = ['Not Started', 'In Progress', 'Completed'];
const PRIORITY = ['1', '2', '3', '4', '5'];
const DEPARTMENT = ['Marketing', 'Content', 'Operations', 'TBD'];

const SHEETS = {
  'staff-tasks': {
    id: 'staff-tasks',
    label: 'Tasks',
    title: 'BnB Staff — Tasks',
    shape: 'records',
    ui: 'table',
    headerRow: 0,
    ownerField: 'addedBy',
    seedFrom: 'Marketing & Content Project Tracker 2026',
    fields: [
      ROW_ID,
      f('department', 'Department', 1, { type: 'select', required: true, options: DEPARTMENT }),
      f('taskName', 'Task Name', 2, { required: true }),
      f('subtask', 'Subtask', 3),
      f('startDate', 'Start Date', 4, { type: 'date' }),
      f('dueDate', 'Due Date', 5, { type: 'date', required: true, notBefore: 'startDate' }),
      f('priority', 'Priority', 6, { type: 'select', options: PRIORITY }),
      f('status', 'Status', 7, { type: 'select', options: STATUS }),
      f('expectedImpact', 'Expected Impact', 8, { type: 'longtext' }),
      f('remarks', 'Remarks', 9, { type: 'longtext' }),
      f('attachmentLink', 'Attachment Link', 10, { type: 'url' }),
      ...auditFields(11),
    ],
  },

  'staff-experiments': {
    id: 'staff-experiments',
    label: 'Experiments',
    title: 'BnB Staff — Experiments',
    shape: 'records',
    ui: 'table',
    headerRow: 0,
    ownerField: 'addedBy',
    seedFrom: 'EXPERIMENT tracker',
    fields: [
      ROW_ID,
      f('subject', 'Subject', 1, { required: true }),
      // "Assignment" on the old sheet holds the experiment itself — values like
      // "Make own Lychee popping boba" — not a person. It was briefly mapped as
      // the owner column; the live data says otherwise.
      f('assignment', 'Assignment', 2, { type: 'longtext' }),
      f('itemsNeeded', 'Items Needed', 3, { type: 'longtext' }),
      f('priority', 'Priority', 4, { type: 'select', options: PRIORITY }),
      f('status', 'Status', 5, { type: 'select', options: STATUS }),
      f('startDate', 'Start Date', 6, { type: 'date' }),
      f('dueOn', 'Due On', 7, { type: 'date', notBefore: 'startDate' }),
      f('notes', 'Notes', 8, { type: 'longtext' }),
      ...auditFields(9),
    ],
  },

  'staff-drinks': {
    id: 'staff-drinks',
    label: 'Drinks Invention',
    title: 'BnB Staff — Drinks Invention',
    shape: 'records',
    ui: 'table',
    headerRow: 0,
    ownerField: 'addedBy',
    seedFrom: 'Drinks Invention List',
    fields: [
      ROW_ID,
      f('drinkName', 'Drink Name', 1, { required: true }),
      f('inspirationLink', 'Inspiration Link', 2, { type: 'url' }),
      f('ingredients', 'Ingredients', 3, { type: 'longtext' }),
      f('currentStatus', 'Current Status', 4, { type: 'select', options: ['Idea', 'Testing', 'On menu', 'Parked'] }),
      f('notes', 'Notes', 5, { type: 'longtext' }),
      ...auditFields(6),
    ],
  },

  // Was seven parallel columns. Now one row per item, so an item can carry who
  // added it, whether it is done, and who ticked it — none of which a bare
  // column of strings could express.
  'staff-fest-list': {
    id: 'staff-fest-list',
    label: 'Needed for Fest',
    title: 'BnB Staff — Fest List',
    shape: 'records',
    ui: 'checklist',
    headerRow: 0,
    ownerField: 'addedBy',
    groupBy: 'category',
    seedFrom: 'needed for fest',
    fields: [
      ROW_ID,
      f('category', 'Category', 1, {
        type: 'select', required: true,
        options: ['Utensils', 'Stationery', 'Appliances', 'Premix', 'Syrup', "Tapioca/ Popping boba's", 'Others'],
      }),
      f('item', 'Item', 2, { required: true }),
      f('quantity', 'Quantity', 3),
      f('done', 'Done', 4, { type: 'select', options: ['Yes', 'No'] }),
      f('doneBy', 'Done By', 5, { editable: false }),
      ...auditFields(6),
    ],
  },

  // Was an employee x 31-day matrix, one sheet per month. Now one row per
  // person per day: any date range works, a person's own rows are addressable,
  // and nobody has to add columns in January.
  'staff-attendance': {
    id: 'staff-attendance',
    label: 'Attendance',
    title: 'BnB Staff — Attendance',
    shape: 'records',
    ui: 'monthGrid',
    headerRow: 0,
    // The employee is the subject of the row, so that — not who typed it — is
    // what "your own" means here.
    ownerField: 'employee',
    seedFrom: 'Attendance Tracker 2026',
    fields: [
      ROW_ID,
      f('employee', 'Employee', 1, { required: true, editable: false }),
      f('date', 'Date', 2, { type: 'date', required: true }),
      // "Weekoff" is the word the live sheet uses; keeping it means the seed
      // carries across unchanged rather than being reinterpreted.
      f('status', 'Status', 3, { type: 'select', required: true, options: ['Present', 'Absent', 'Weekoff', 'Leave', 'Half day'] }),
      f('note', 'Note', 4),
      ...auditFields(5),
    ],
  },
};

const has = (id) => typeof id === 'string' && Object.prototype.hasOwnProperty.call(SHEETS, id);

export function listSheets() {
  return Object.values(SHEETS).map(({ id, label, title, ui, seedFrom }) => ({ id, label, title, ui, seedFrom }));
}

export function getSchema(id) {
  return has(id) ? SHEETS[id] : null;
}

/** Header row to write when the sheet is first created. */
export function headerFor(schema) {
  if (!schema) return [];
  const row = Array.from({ length: widthOf(schema) }, () => '');
  for (const field of schema.fields) row[field.index] = field.column;
  return row;
}

export function widthOf(schema) {
  return schema ? Math.max(...schema.fields.map((x) => x.index)) + 1 : 0;
}

/** Fields a person may actually send. Audit and identity columns are excluded. */
export function editableFields(schema) {
  return schema ? schema.fields.filter((x) => x.editable) : [];
}

const text = (v) => (v === null || v === undefined ? '' : String(v));
const blank = (v) => text(v).trim() === '';

export function parseRecords(schema, rows) {
  if (!schema || !Array.isArray(rows)) return [];
  const header = rows[schema.headerRow];
  if (!Array.isArray(header)) return [];

  const names = header.map((c) => text(c).trim().toLowerCase());
  const indexes = {};
  for (const field of schema.fields) {
    // Declared position wins; fall back to the header name if a column moved.
    const wanted = field.column.trim().toLowerCase();
    indexes[field.key] = names[field.index] === wanted
      ? field.index
      : (names.indexOf(wanted) === -1 ? field.index : names.indexOf(wanted));
  }

  const out = [];
  rows.slice(schema.headerRow + 1).forEach((row, i) => {
    const cells = Array.isArray(row) ? row : [];
    if (cells.every(blank)) return;
    const values = {};
    for (const field of schema.fields) values[field.key] = text(cells[indexes[field.key]]).trim();
    out.push({ rowNumber: schema.headerRow + i + 2, values });
  });
  return out;
}

export function canEdit(schema, record, user) {
  if (!schema || !schema.ownerField || !record || !record.values) return false;
  const name = text(user && user.name).trim().toLowerCase();
  const owner = text(record.values[schema.ownerField]).trim().toLowerCase();
  return Boolean(name) && Boolean(owner) && name === owner;
}

function validateField(field, raw, values, allowIncomplete) {
  const value = text(raw).trim();

  // Seeded rows are grandfathered: the live tracker has tasks with no due date,
  // and refusing to migrate them would lose real work. Format, option and
  // formula-injection checks still apply — only the required-ness is relaxed,
  // and only for the one-time import. Anything typed into the form is held to
  // the full rule.
  if (field.required && !value) return allowIncomplete ? null : `${field.column} is required.`;
  if (!value) return null;

  if (field.type !== 'url' && FORMULA_LEAD.test(value)) {
    return `${field.column} cannot start with = + - or @ — Sheets would read it as a formula.`;
  }

  const cap = field.type === 'longtext' ? MAX_LONG_TEXT : MAX_TEXT;
  if (value.length > cap) return `${field.column} is too long — keep it under ${cap} characters.`;

  if (field.type === 'select' && field.options && !field.options.includes(value)) {
    return `${field.column} must be one of: ${field.options.join(', ')}.`;
  }

  if (field.type === 'date') {
    if (!ISO_DATE.test(value)) return `${field.column} must be a date (YYYY-MM-DD).`;
    const d = new Date(`${value}T00:00:00Z`);
    // Round-trip catches 2026-13-45, which Date would otherwise roll forward.
    if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) {
      return `${field.column} is not a real date.`;
    }
    // Ordering is a data-quality rule, not a safety one. The live tracker has a
    // task due before it starts; refusing to migrate it would lose real work,
    // so the seed carries it and the seeder reports it instead.
    if (field.notBefore && !allowIncomplete) {
      const other = text(values[field.notBefore]).trim();
      if (ISO_DATE.test(other) && value < other) {
        return `${field.column} is before the start date (${other}).`;
      }
    }
  }

  if (field.type === 'url' && !/^https?:\/\/\S+$/i.test(value)) {
    return `${field.column} must be a http:// or https:// link.`;
  }

  return null;
}

/**
 * @param options.allowIncomplete Skip required-field checks. Used by the
 *   one-time seed so legacy rows migrate; never set for user input.
 */
export function validate(schema, values = {}, options = {}) {
  const errors = {};
  if (!schema) return { valid: false, errors };
  for (const field of schema.fields) {
    const message = validateField(field, values[field.key], values, options.allowIncomplete === true);
    if (message) errors[field.key] = message;
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * Build the row to write.
 *
 * Identity and audit columns come from `meta`, never from `values` — otherwise
 * a payload could claim someone else's name and walk straight through the
 * ownership check. Unmapped columns of an existing row are preserved.
 */
export function toRowValues(schema, values = {}, existingRow = null, meta = {}) {
  if (!schema) return [];
  const base = Array.isArray(existingRow) ? existingRow : [];
  const row = Array.from({ length: Math.max(base.length, widthOf(schema)) }, (_, i) => text(base[i]));
  const isNew = !Array.isArray(existingRow);
  const who = text(meta.user && meta.user.name).trim();
  const when = text(meta.now).trim();

  for (const field of schema.fields) {
    if (field.editable && Object.prototype.hasOwnProperty.call(values, field.key)) {
      row[field.index] = text(values[field.key]).trim();
    }
  }

  const put = (key, value) => {
    const field = schema.fields.find((x) => x.key === key);
    if (field && value) row[field.index] = value;
  };

  if (isNew) {
    put('rowId', text(meta.rowId));
    put('addedBy', who);
    put('addedAt', when);
    // The employee owns their attendance row; it is identity, not input.
    if (schema.ownerField === 'employee') put('employee', who);
  }
  put('updatedBy', who);
  put('updatedAt', when);

  return row;
}
