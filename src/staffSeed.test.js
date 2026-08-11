// The seed runs once and moves real data. What it must never do is lose a row
// silently: anything it cannot map is reported in `skipped`, never dropped.
//
// Fixtures are the live shapes as of 2026-08-10, including the junk cells the
// attendance sheet actually contains.

const {
  seedTasks, seedExperiments, seedDrinks, seedFestList, seedAttendance, seedFor,
} = require('./staffSeed');
const { getSchema, validate } = require('./staffSheets');

const TASK_ROWS = [
  ['', 'Department', 'Task Name', 'Subtask', 'Owner', 'Start Date', 'Due Date',
   'Priority', 'Status', 'Approval', 'Expected Impact', 'Remarks', 'Attachment Link'],
  ['1', 'Marketing', 'penalty kick campaign', 'shoot, edit', 'Rishav',
   '2026-06-27', '2026-06-01', '1', 'Not Started', 'FALSE', 'increase followers'],
  ['2', 'Content', 'leaflets', 'distribution', 'Kritika',
   '2026-06-11', '2026-06-16', '5', 'Completed', 'FALSE', 'drive footfall'],
  ['3', 'TBD', 'stall banner', '', 'BNB', '', '', '', 'In Progress'],
];

const FEST_ROWS = [
  [],
  ['Utensils', 'Stationery', 'Appliances ', '', 'Syrup'],
  ['boba boil pot', 'sticky pad', 'grinder', '', 'brown sugar'],
  ['strainer', '', '', '', 'lychee'],
  ['shaker cups'],
];

const ATT_ROWS = [
  [],
  ['Year:', '2026'],
  ['Month Number:', '5'],
  [],
  ['Employee Name', 'Role', '1', '2', '3', '4'],
  ['Day of Week', '', 'Thu', 'Fri', 'Sat', 'Sun'],
  ['Rishav', 'Ops', 'Present', 'Present', 'Weekoff', '0'],
  ['Arpan', 'Ops', 'Present', '27', '', 'Absent'],
];

describe('seedTasks', () => {
  it('carries every named task across', () => {
    const { records } = seedTasks(TASK_ROWS);
    expect(records.map((r) => r.values.taskName))
      .toEqual(['penalty kick campaign', 'leaflets', 'stall banner']);
  });

  it('maps the old Owner column onto addedBy, so ownership survives', () => {
    const { records } = seedTasks(TASK_ROWS);
    expect(records.map((r) => r.values.addedBy)).toEqual(['Rishav', 'Kritika', 'BNB']);
  });

  it('normalises statuses to the canonical set', () => {
    const { records } = seedTasks(TASK_ROWS);
    expect(records.map((r) => r.values.status)).toEqual(['Not Started', 'Completed', 'In Progress']);
  });

  it('keeps a priority of 5 — the live sheet uses 1 to 5, not 1 to 3', () => {
    expect(seedTasks(TASK_ROWS).records[1].values.priority).toBe('5');
  });

  it('carries the real Content and TBD departments rather than forcing a default', () => {
    const { records } = seedTasks(TASK_ROWS);
    expect(records.map((r) => r.values.department)).toEqual(['Marketing', 'Content', 'TBD']);
  });

  it('records the source row so a seeded row can be traced back', () => {
    expect(seedTasks(TASK_ROWS).records.map((r) => r.source)).toEqual([2, 3, 4]);
  });

  it('reports a non-empty row it could not name rather than dropping it silently', () => {
    const { records, skipped } = seedTasks([TASK_ROWS[0], ['9', 'Marketing', '', '', 'Rishav']]);
    expect(records).toHaveLength(0);
    expect(skipped).toEqual([{ row: 2, why: 'no task name' }]);
  });

  it('ignores a fully blank row without reporting it', () => {
    expect(seedTasks([TASK_ROWS[0], [], ['', '', '']]).skipped).toEqual([]);
  });

  it('carries a due-before-start row but reports it rather than importing it silently', () => {
    const { records, warnings } = seedTasks(TASK_ROWS);
    expect(records.map((r) => r.values.taskName)).toContain('penalty kick campaign');
    expect(warnings).toEqual([
      { row: 2, why: 'due 2026-06-01 is before start 2026-06-27', task: 'penalty kick campaign' },
    ]);
  });

  it('drops an unparseable date rather than inventing one', () => {
    const rows = [TASK_ROWS[0], ['1', 'Marketing', 'x', '', 'Rishav', 'next tuesday', '2026-13-45']];
    const [rec] = seedTasks(rows).records;
    expect(rec.values.startDate).toBe('');
    expect(rec.values.dueDate).toBe('');
  });
});

describe('seedFestList — seven columns become rows', () => {
  it('produces one record per item across all categories', () => {
    const { records } = seedFestList(FEST_ROWS);
    expect(records).toHaveLength(7);
  });

  it('trims the category name the sheet padded', () => {
    const { records } = seedFestList(FEST_ROWS);
    expect(records.some((r) => r.values.category === 'Appliances')).toBe(true);
    expect(records.some((r) => r.values.category === 'Appliances ')).toBe(false);
  });

  it('continues past a gap in a column instead of stopping at it', () => {
    const syrup = seedFestList(FEST_ROWS).records.filter((r) => r.values.category === 'Syrup');
    expect(syrup.map((r) => r.values.item)).toEqual(['brown sugar', 'lychee']);
  });

  it('skips a column with no header', () => {
    expect(seedFestList(FEST_ROWS).records.every((r) => r.values.category)).toBe(true);
  });

  it('starts everything unticked', () => {
    expect(seedFestList(FEST_ROWS).records.every((r) => r.values.done === 'No')).toBe(true);
  });
});

describe('seedAttendance — the matrix becomes person-days', () => {
  it('emits one record per person per filled day', () => {
    const { records } = seedAttendance(ATT_ROWS);
    expect(records).toHaveLength(5);
  });

  it('builds the date from the year and month labels at the top', () => {
    const { records } = seedAttendance(ATT_ROWS);
    expect(records[0].values.date).toBe('2026-05-01');
    expect(records.map((r) => r.values.date)).toContain('2026-05-03');
  });

  it('keeps Weekoff as the live sheet spells it', () => {
    const { records } = seedAttendance(ATT_ROWS);
    expect(records.find((r) => r.values.date === '2026-05-03').values.status).toBe('Weekoff');
  });

  it('reports the junk cells rather than guessing a status', () => {
    const { skipped } = seedAttendance(ATT_ROWS);
    expect(skipped.map((s) => s.why)).toEqual([
      'unrecognised attendance value "0"',
      'unrecognised attendance value "27"',
    ]);
  });

  it('attributes each row to the employee it belongs to', () => {
    const { records } = seedAttendance(ATT_ROWS);
    expect(records.every((r) => r.values.employee === r.values.addedBy)).toBe(true);
  });

  it('refuses the whole sheet when the month label is unreadable', () => {
    const broken = [[], ['Year:', 'twenty'], ['Month Number:', ''], [], [], [], ['Rishav']];
    const { records, skipped } = seedAttendance(broken);
    expect(records).toEqual([]);
    expect(skipped[0].why).toMatch(/unreadable year\/month/);
  });
});

describe('seedExperiments and seedDrinks', () => {
  it('keeps the Time column as a note rather than losing it', () => {
    const rows = [[], [], ['', 'Subject', 'Assignment', 'Priority', 'Items needed', 'Status', 'Time', 'Start date', 'Due on'],
      ['', 'Boba texture', 'Make own Lychee popping boba', '2', 'syrup', 'Not started', '2h', '2026-08-01', '2026-08-09']];
    const [rec] = seedExperiments(rows).records;
    expect(rec.values.notes).toBe('Time: 2h');
    expect(rec.values.assignment).toBe('Make own Lychee popping boba');
    expect(rec.values.status).toBe('Not Started');
  });

  it('falls back to the assignment when a subject is missing', () => {
    const rows = [[], [], ['', 'Subject', 'Assignment'], ['', '', 'Inhouse Brown Sugar']];
    expect(seedExperiments(rows).records[0].values.subject).toBe('Inhouse Brown Sugar');
  });

  it('defaults a drink with no status to Idea', () => {
    const rows = [[], [], [], ['', 'Drink Name', '', 'Inspiration Link', 'Ingredients', 'Current Status'],
      ['', 'Blue Pea Matcha Cloud']];
    expect(seedDrinks(rows).records[0].values.currentStatus).toBe('Idea');
  });

  it('drops a non-http inspiration link instead of carrying it', () => {
    const rows = [[], [], [], ['', 'Drink Name', '', 'Inspiration Link'],
      ['', 'X', '', 'javascript:alert(1)']];
    expect(seedDrinks(rows).records[0].values.inspirationLink).toBe('');
  });
});

describe('seeded records satisfy the schema they are destined for', () => {
  // The seed is worthless if it produces rows the console would then reject.
  const cases = [
    ['staff-tasks', seedTasks(TASK_ROWS)],
    ['staff-fest-list', seedFestList(FEST_ROWS)],
    ['staff-attendance', seedAttendance(ATT_ROWS)],
  ];

  it.each(cases)('%s', (id, { records }) => {
    const schema = getSchema(id);
    expect(records.length).toBeGreaterThan(0);
    for (const rec of records) {
      const { valid, errors } = validate(schema, rec.values, { allowIncomplete: true });
      expect({ id, source: rec.source, errors, valid }).toMatchObject({ valid: true });
    }
  });

  it('a legacy task with no due date migrates, but the same row typed in is refused', () => {
    // Row 4 of the live tracker: "stall banner", no dates at all.
    const legacy = seedTasks(TASK_ROWS).records[2].values;
    expect(validate(getSchema('staff-tasks'), legacy, { allowIncomplete: true }).valid).toBe(true);
    expect(validate(getSchema('staff-tasks'), legacy).errors.dueDate).toMatch(/required/i);
  });

  it('the relaxed mode still refuses a formula, a bad date and a bad option', () => {
    const schema = getSchema('staff-tasks');
    const opts = { allowIncomplete: true };
    expect(validate(schema, { taskName: '=IMPORTXML("http://evil","//a")' }, opts).errors.taskName).toMatch(/formula/i);
    expect(validate(schema, { taskName: 'x', dueDate: '2026-13-45' }, opts).errors.dueDate).toBeTruthy();
    expect(validate(schema, { taskName: 'x', status: 'Nearly' }, opts).errors.status).toBeTruthy();
  });
});

describe('seedFor', () => {
  it('dispatches by schema id', () => {
    expect(seedFor('staff-tasks', TASK_ROWS).records).toHaveLength(3);
  });

  it('refuses an unknown id rather than running an arbitrary seeder', () => {
    const { records, skipped } = seedFor('customer-details', TASK_ROWS);
    expect(records).toEqual([]);
    expect(skipped[0].why).toMatch(/no seeder/);
  });
});
