// One-time transforms: existing sheet -> new staff-console sheet.
//
// READ ONLY, ONE DIRECTION. Nothing here writes to, mutates, or returns
// anything destined for an original sheet. Each function takes the rows the
// Sheets API handed back and returns plain value objects for the new sheet.
// The originals are untouched by construction — they are an input.
//
// The awkward part is that two of the five sources are not tables:
//   needed for fest    seven parallel category columns  -> one row per item
//   Attendance Tracker employee x 31-day matrix         -> one row per person-day
//
// Values are normalised to the canonical options in staffSheets.js, because the
// live sheets carry variants ("Not started" and "Not Started" both appear) and
// junk (two attendance cells contain "0" and "27"). Anything that cannot be
// mapped is reported rather than silently dropped — see the `skipped` counts.

const text = (v) => (v === null || v === undefined ? '' : String(v).trim());
const cell = (row, i) => text(Array.isArray(row) ? row[i] : '');

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const pad = (n) => String(n).padStart(2, '0');

/** Keep a real ISO date, drop anything else rather than guess a format. */
function isoDate(value) {
  const v = text(value);
  if (ISO.test(v)) {
    const d = new Date(`${v}T00:00:00Z`);
    if (!Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v) return v;
  }
  return '';
}

const STATUS_MAP = {
  'not started': 'Not Started',
  'notstarted': 'Not Started',
  'to do': 'Not Started',
  'in progress': 'In Progress',
  'inprogress': 'In Progress',
  'ongoing': 'In Progress',
  done: 'Completed',
  complete: 'Completed',
  completed: 'Completed',
};

const ATTENDANCE_MAP = {
  present: 'Present',
  p: 'Present',
  absent: 'Absent',
  a: 'Absent',
  weekoff: 'Weekoff',
  'week off': 'Weekoff',
  wo: 'Weekoff',
  leave: 'Leave',
  l: 'Leave',
  'half day': 'Half day',
  hd: 'Half day',
};

const mapWith = (table, value) => table[text(value).toLowerCase()] || '';

/** Priority is 1-5 in the live sheet; anything else is not a priority. */
const priority = (value) => (/^[1-5]$/.test(text(value)) ? text(value) : '');

const record = (values, source) => ({ values, source });

export function seedTasks(rows = []) {
  const skipped = [];
  const warnings = [];
  const out = [];
  rows.slice(1).forEach((row, i) => {
    const taskName = cell(row, 2);
    if (!taskName) {
      if (row && row.some((c) => text(c))) skipped.push({ row: i + 2, why: 'no task name' });
      return;
    }
    const startDate = isoDate(cell(row, 5));
    const dueDate = isoDate(cell(row, 6));
    out.push(record({
      department: cell(row, 1) || 'TBD',
      taskName,
      subtask: cell(row, 3),
      startDate,
      dueDate,
      priority: priority(cell(row, 7)),
      status: mapWith(STATUS_MAP, cell(row, 8)),
      expectedImpact: cell(row, 10),
      remarks: cell(row, 11),
      attachmentLink: /^https?:\/\//i.test(cell(row, 12)) ? cell(row, 12) : '',
      // The old Owner column is who the row belongs to. Carrying it into
      // addedBy is what keeps "edit your own" true after the migration.
      addedBy: cell(row, 4),
    }, i + 2));

    // Carried, not corrected — but surfaced, so it is a decision rather than a
    // silent import. The live "penalty kick campaign" row is due 2026-06-01
    // and starts 2026-06-27.
    if (startDate && dueDate && dueDate < startDate) {
      warnings.push({ row: i + 2, why: `due ${dueDate} is before start ${startDate}`, task: taskName });
    }
  });
  return { records: out, skipped, warnings };
}

export function seedExperiments(rows = []) {
  const skipped = [];
  const warnings = [];
  const out = [];
  rows.slice(3).forEach((row, i) => {
    const subject = cell(row, 1);
    const assignment = cell(row, 2);
    if (!subject && !assignment) {
      if (row && row.some((c) => text(c))) skipped.push({ row: i + 4, why: 'no subject or assignment' });
      return;
    }
    const time = cell(row, 6);
    out.push(record({
      subject: subject || assignment,
      assignment,
      itemsNeeded: cell(row, 4),
      priority: priority(cell(row, 3)),
      status: mapWith(STATUS_MAP, cell(row, 5)),
      startDate: isoDate(cell(row, 7)),
      dueOn: isoDate(cell(row, 8)),
      // The old sheet has a free-text Time column with no equivalent field.
      // Folding it into Notes keeps the information rather than losing it.
      notes: time ? `Time: ${time}` : '',
      addedBy: '',
    }, i + 4));
  });
  return { records: out, skipped, warnings };
}

export function seedDrinks(rows = []) {
  const skipped = [];
  const warnings = [];
  const out = [];
  rows.slice(4).forEach((row, i) => {
    const drinkName = cell(row, 1);
    if (!drinkName) {
      if (row && row.some((c) => text(c))) skipped.push({ row: i + 5, why: 'no drink name' });
      return;
    }
    out.push(record({
      drinkName,
      inspirationLink: /^https?:\/\//i.test(cell(row, 3)) ? cell(row, 3) : '',
      ingredients: cell(row, 4),
      currentStatus: cell(row, 5) || 'Idea',
      notes: '',
      addedBy: '',
    }, i + 5));
  });
  return { records: out, skipped, warnings };
}

/**
 * Seven parallel columns become one row per item.
 *
 * Column headers sit on row 1. Each column below is an independent list, so a
 * blank cell is a gap, not a terminator — the scan continues past it.
 */
export function seedFestList(rows = []) {
  const header = Array.isArray(rows[1]) ? rows[1] : [];
  const skipped = [];
  const warnings = [];
  const out = [];

  header.forEach((rawCategory, col) => {
    const category = text(rawCategory);
    if (!category) return;
    rows.slice(2).forEach((row, i) => {
      const item = cell(row, col);
      if (!item) return;
      out.push(record({
        category,
        item,
        quantity: '',
        done: 'No',
        doneBy: '',
        addedBy: '',
      }, i + 3));
    });
  });

  return { records: out, skipped, warnings };
}

/**
 * The employee x day matrix becomes one row per person per day.
 *
 * Day columns are found by reading the header rather than assuming a fixed
 * offset, and the month comes from the two label rows at the top. Cells that
 * are not a recognised attendance value ("0" and "27" both appear in the live
 * sheet) are reported as skipped, never guessed at.
 */
export function seedAttendance(rows = []) {
  const skipped = [];
  const warnings = [];
  const out = [];

  const year = text(cell(rows[1], 1));
  const month = text(cell(rows[2], 1));
  if (!/^\d{4}$/.test(year) || !/^\d{1,2}$/.test(month)) {
    return { records: [], warnings, skipped: [{ row: 2, why: `unreadable year/month (${year}/${month})` }] };
  }

  const header = Array.isArray(rows[4]) ? rows[4] : [];
  const dayColumns = [];
  header.forEach((h, col) => {
    const day = text(h);
    if (/^\d{1,2}$/.test(day) && Number(day) >= 1 && Number(day) <= 31) {
      dayColumns.push({ col, day: Number(day) });
    }
  });

  rows.slice(6).forEach((row, i) => {
    const employee = cell(row, 0);
    if (!employee) return;
    for (const { col, day } of dayColumns) {
      const raw = cell(row, col);
      if (!raw) continue;
      const status = mapWith(ATTENDANCE_MAP, raw);
      if (!status) {
        skipped.push({ row: i + 7, why: `unrecognised attendance value ${JSON.stringify(raw)}` });
        continue;
      }
      out.push(record({
        employee,
        date: `${year}-${pad(month)}-${pad(day)}`,
        status,
        note: '',
        addedBy: employee,
      }, i + 7));
    }
  });

  return { records: out, skipped, warnings };
}

const SEEDERS = {
  'staff-tasks': seedTasks,
  'staff-experiments': seedExperiments,
  'staff-drinks': seedDrinks,
  'staff-fest-list': seedFestList,
  'staff-attendance': seedAttendance,
};

export function seedFor(schemaId, rows) {
  const fn = Object.prototype.hasOwnProperty.call(SEEDERS, schemaId) ? SEEDERS[schemaId] : null;
  return fn ? fn(rows) : { records: [], warnings: [], skipped: [{ row: 0, why: `no seeder for ${schemaId}` }] };
}
