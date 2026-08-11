// The schema is two things at once, and both are load-bearing.
//
// It is a READER: these five sheets put their headers on four different rows
// (0, 1, 2 and 3), and Sheets omits trailing empty cells so every row arrives
// ragged. Nothing can address a column by name without this.
//
// It is also a SECURITY BOUNDARY: it is an allowlist. `customer details
// dec-april`, `Daily_Sales_Record_Tracker_2025` and the webhook-fed sheets are
// absent by construction, so no request — however malformed — can reach them.

const {
  listSheets,
  getSchema,
  parseRecords,
  parseCategories,
  validate,
  toRowValues,
  canEdit,
} = require('./staffSheets');

const USER = { email: 'rishav@blendnbubbles.com', name: 'Rishav' };
const OTHER = { email: 'arpan@blendnbubbles.com', name: 'Arpan' };

// Shapes lifted verbatim from the live Drive extract (2026-08-10), including
// the ragged tails and the blank leading column.
const MARKETING_ROWS = [
  ['', 'Department', 'Task Name', 'Subtask', 'Owner', 'Start Date', 'Due Date',
   'Priority', 'Status', 'Approval', 'Expected Impact', 'Remarks', 'Attachment Link'],
  ['1', 'Marketing', 'penalty kick campaign', 'shoot, edit', 'Rishav',
   '2026-06-27', '2026-06-01', '1', 'Not Started', 'FALSE', 'increase followers'],
  ['2', 'Marketing', 'leaflets', 'distribution', 'Rishav',
   '2026-06-11', '2026-06-16', '3', 'In Progress', 'FALSE', 'drive footfall'],
  ['3', 'Marketing', 'festival stall banner', 'design', 'Arpan',
   '2026-06-02', '2026-06-22', '2', 'Done', 'TRUE', 'stall visibility'],
];

const FEST_ROWS = [
  [],
  ['Utensils', 'Stationery', 'Appliances ', 'Premix', 'Syrup', "Tapioca/ Popping boba's", 'Others'],
  ['boba boil pot', 'sticky pad', 'mixture/grinder 2', 'creamer 3 kg', 'special sugar'],
  ['strainer', 'marker'],
  ['shaker cups'],
];

describe('the allowlist', () => {
  it('exposes exactly the five sheets staff were given', () => {
    expect(listSheets().map((s) => s.id).sort()).toEqual([
      'attendance', 'drinks-invention', 'experiments', 'fest-list', 'marketing-tracker',
    ]);
  });

  it('does not expose the customer list, sales tracker, or webhook sheets', () => {
    const exposed = listSheets().map((s) => s.driveName.toLowerCase());
    for (const forbidden of [
      'customer details dec-april',
      'daily_sales_record_tracker_2025',
      'bnb event requests',
      'bnb anniversary spins webhook',
      'bnb campaign quotation',
    ]) {
      expect(exposed).not.toContain(forbidden);
    }
  });

  it('returns null for an unknown id rather than guessing', () => {
    expect(getSchema('customer-details')).toBeNull();
    expect(getSchema('')).toBeNull();
    expect(getSchema(undefined)).toBeNull();
  });

  it('rejects a traversal-flavoured id without throwing', () => {
    expect(getSchema('../../customer details dec-april')).toBeNull();
    expect(getSchema('__proto__')).toBeNull();
    expect(getSchema('constructor')).toBeNull();
  });

  it('every schema declares where its header row actually is', () => {
    // The bug this prevents: assuming row 0. Five sheets, four different answers.
    const rows = listSheets().map((s) => [s.id, getSchema(s.id).headerRow]);
    expect(Object.fromEntries(rows)).toEqual({
      'marketing-tracker': 0,
      'fest-list': 1,
      experiments: 2,
      'drinks-invention': 3,
      attendance: 4,
    });
  });
});

describe('parseRecords', () => {
  const schema = getSchema('marketing-tracker');

  it('maps cells to field keys by header position', () => {
    const [first] = parseRecords(schema, MARKETING_ROWS);
    expect(first.values.taskName).toBe('penalty kick campaign');
    expect(first.values.owner).toBe('Rishav');
    expect(first.values.priority).toBe('1');
  });

  it('pads ragged rows instead of shearing them', () => {
    // Row 1 has 11 cells against a 13-column header; Sheets dropped the tail.
    const [first] = parseRecords(schema, MARKETING_ROWS);
    expect(first.values.remarks).toBe('');
    expect(first.values.attachmentLink).toBe('');
  });

  it('records the real sheet row number so an edit can target it', () => {
    const records = parseRecords(schema, MARKETING_ROWS);
    // Header at index 0, so the first record is sheet row 2 (1-indexed).
    expect(records.map((r) => r.rowNumber)).toEqual([2, 3, 4]);
  });

  it('skips rows that are entirely blank', () => {
    const withGap = [MARKETING_ROWS[0], [], MARKETING_ROWS[1], ['', '', '']];
    expect(parseRecords(schema, withGap)).toHaveLength(1);
  });

  it('returns an empty list for a sheet with only a header', () => {
    expect(parseRecords(schema, [MARKETING_ROWS[0]])).toEqual([]);
  });

  it('survives rows arriving before the header row exists', () => {
    expect(parseRecords(schema, [])).toEqual([]);
    expect(parseRecords(schema, null)).toEqual([]);
  });

  it('reads experiments from row 2, not row 0', () => {
    const exp = getSchema('experiments');
    const rows = [
      [],
      ['', 'EXPERIMENTS - TRACKER'],
      ['', 'Subject', 'Assignment', 'Priority', 'Items needed', 'Status', 'Time', 'Start date', 'Due on'],
      ['', 'Brown sugar ratio', 'Rishav', '2', 'syrup, scale', 'In Progress', '2h', '2026-08-01', '2026-08-09'],
    ];
    const [rec] = parseRecords(exp, rows);
    expect(rec.values.subject).toBe('Brown sugar ratio');
    expect(rec.rowNumber).toBe(4);
  });
});

describe('ownership', () => {
  const schema = getSchema('marketing-tracker');

  it('matches a record to the signed-in user by name', () => {
    const [mine, , theirs] = parseRecords(schema, MARKETING_ROWS);
    expect(canEdit(schema, mine, USER)).toBe(true);
    expect(canEdit(schema, theirs, USER)).toBe(false);
  });

  it('is case and whitespace insensitive — sheets are typed by hand', () => {
    const rows = [MARKETING_ROWS[0], ['1', 'Marketing', 'x', '', '  rishav  ', '', '', '', '', '', '']];
    const [rec] = parseRecords(schema, rows);
    expect(canEdit(schema, rec, USER)).toBe(true);
  });

  it('refuses when the owner cell is blank rather than letting anyone claim it', () => {
    const rows = [MARKETING_ROWS[0], ['1', 'Marketing', 'orphan task', '', '', '', '', '', '', '', '']];
    const [rec] = parseRecords(schema, rows);
    expect(canEdit(schema, rec, USER)).toBe(false);
    expect(canEdit(schema, rec, OTHER)).toBe(false);
  });

  it('refuses when there is no signed-in user at all', () => {
    const [mine] = parseRecords(schema, MARKETING_ROWS);
    expect(canEdit(schema, mine, null)).toBe(false);
    expect(canEdit(schema, mine, {})).toBe(false);
  });

  it('never grants edit on a shape that has no owner column', () => {
    const att = getSchema('attendance');
    expect(canEdit(att, { values: {} }, USER)).toBe(false);
  });
});

describe('validate', () => {
  const schema = getSchema('marketing-tracker');
  const good = {
    department: 'Marketing', taskName: 'Durga Puja promo', owner: 'Rishav',
    startDate: '2026-08-11', dueDate: '2026-10-26', priority: '2', status: 'Not Started',
  };

  it('accepts a complete record', () => {
    expect(validate(schema, good)).toEqual({ valid: true, errors: {} });
  });

  it('names every missing required field, not just the first', () => {
    const { valid, errors } = validate(schema, { ...good, taskName: '', dueDate: '' });
    expect(valid).toBe(false);
    expect(Object.keys(errors).sort()).toEqual(['dueDate', 'taskName']);
  });

  it('treats whitespace as missing', () => {
    expect(validate(schema, { ...good, taskName: '   ' }).errors.taskName).toBeTruthy();
  });

  it('rejects a due date before the start date', () => {
    // This is not hypothetical: the live "penalty kick campaign" row starts
    // 2026-06-27 and is due 2026-06-01.
    const { valid, errors } = validate(schema, {
      ...good, startDate: '2026-06-27', dueDate: '2026-06-01',
    });
    expect(valid).toBe(false);
    expect(errors.dueDate).toMatch(/start/i);
  });

  it('allows a due date equal to the start date', () => {
    expect(validate(schema, { ...good, startDate: '2026-08-11', dueDate: '2026-08-11' }).valid).toBe(true);
  });

  it('rejects a value outside a select field options', () => {
    expect(validate(schema, { ...good, status: 'Nearly done' }).errors.status).toBeTruthy();
    expect(validate(schema, { ...good, priority: '9' }).errors.priority).toBeTruthy();
  });

  it('rejects a malformed date rather than passing it to the sheet', () => {
    expect(validate(schema, { ...good, dueDate: 'next tuesday' }).errors.dueDate).toBeTruthy();
    expect(validate(schema, { ...good, dueDate: '2026-13-45' }).errors.dueDate).toBeTruthy();
  });

  it('caps free text so one paste cannot bloat the row', () => {
    expect(validate(schema, { ...good, taskName: 'x'.repeat(500) }).errors.taskName).toMatch(/long/i);
  });

  it('rejects a formula injection attempt in a text cell', () => {
    // A leading =, +, - or @ makes Sheets evaluate the cell. HYPERLINK and
    // IMPORTXML in a shared sheet are a genuine exfiltration route.
    for (const payload of ['=HYPERLINK("http://evil","x")', '+1+1', '-2+3', '@SUM(A1)']) {
      expect(validate(schema, { ...good, taskName: payload }).errors.taskName).toMatch(/formula/i);
    }
  });

  it('leaves an ordinary hyphenated or plus-containing string alone', () => {
    expect(validate(schema, { ...good, taskName: 'Buy-one-get-one promo' }).valid).toBe(true);
    expect(validate(schema, { ...good, taskName: 'Matcha + oat' }).valid).toBe(true);
  });
});

describe('toRowValues', () => {
  const schema = getSchema('marketing-tracker');

  it('positions each value at its header index', () => {
    const row = toRowValues(schema, {
      department: 'Marketing', taskName: 'Durga Puja promo', owner: 'Rishav',
      startDate: '2026-08-11', dueDate: '2026-10-26', priority: '2', status: 'Not Started',
    });
    expect(row[1]).toBe('Marketing');
    expect(row[2]).toBe('Durga Puja promo');
    expect(row[4]).toBe('Rishav');
    expect(row[6]).toBe('2026-10-26');
  });

  it('emits a row the full width of the header', () => {
    expect(toRowValues(schema, { taskName: 'x' })).toHaveLength(13);
  });

  it('preserves unmapped columns of an existing row when editing', () => {
    // Column 0 is the sheet's own index column — not ours to overwrite.
    const existing = MARKETING_ROWS[1];
    const row = toRowValues(schema, { taskName: 'renamed' }, existing);
    expect(row[0]).toBe('1');
    expect(row[2]).toBe('renamed');
  });

  it('never writes the owner field from user input', () => {
    // Owner comes from the session, never the payload — otherwise "edit your
    // own" is bypassed by simply typing someone else's name.
    const row = toRowValues(schema, { taskName: 'x', owner: 'Arpan' }, null, USER);
    expect(row[4]).toBe('Rishav');
  });
});

describe('parseCategories', () => {
  const schema = getSchema('fest-list');

  it('reads the seven categories from row 1', () => {
    expect(parseCategories(schema, FEST_ROWS).map((c) => c.category)).toEqual([
      'Utensils', 'Stationery', 'Appliances', 'Premix', 'Syrup', "Tapioca/ Popping boba's", 'Others',
    ]);
  });

  it('collects each column downward as that category list', () => {
    const [utensils] = parseCategories(schema, FEST_ROWS);
    expect(utensils.items.map((i) => i.value)).toEqual(['boba boil pot', 'strainer', 'shaker cups']);
  });

  it('carries the cell address so a tick can target it', () => {
    const [utensils] = parseCategories(schema, FEST_ROWS);
    expect(utensils.items[0]).toMatchObject({ row: 3, column: 1 });
  });

  it('skips blanks inside a column rather than emitting empty items', () => {
    const gappy = [[], ['Utensils'], ['pot'], [''], ['jug']];
    const [cat] = parseCategories(schema, gappy);
    expect(cat.items.map((i) => i.value)).toEqual(['pot', 'jug']);
  });

  it('reports the first free cell so an add does not overwrite', () => {
    const [utensils] = parseCategories(schema, FEST_ROWS);
    expect(utensils.nextFreeRow).toBe(6);
  });

  it('handles a category with no items at all', () => {
    const [, stationery] = parseCategories(schema, [[], ['Utensils', 'Stationery'], ['pot']]);
    expect(stationery.items).toEqual([]);
    expect(stationery.nextFreeRow).toBe(3);
  });
});

describe('drinks invention — the schema that did not exist', () => {
  const schema = getSchema('drinks-invention');

  it('defines the columns the sheet was missing', () => {
    expect(schema.fields.map((f) => f.key)).toEqual([
      'drinkName', 'inspirationLink', 'ingredients', 'currentStatus', 'addedBy',
    ]);
  });

  it('requires a name and nothing else', () => {
    expect(validate(schema, { drinkName: 'Blue Pea Matcha Cloud' }).valid).toBe(true);
    expect(validate(schema, { drinkName: '' }).valid).toBe(false);
  });

  it('rejects a non-http inspiration link', () => {
    expect(validate(schema, { drinkName: 'x', inspirationLink: 'javascript:alert(1)' }).errors.inspirationLink)
      .toBeTruthy();
    expect(validate(schema, { drinkName: 'x', inspirationLink: 'https://instagram.com/p/abc' }).valid).toBe(true);
  });

  it('reads the existing rows despite the header sitting on row 3', () => {
    const rows = [
      [], ['', 'Drinks Invention List'], [],
      ['', 'Drink Name', '', 'Inspiration Link', 'Ingredients', 'Current Status'],
      ['', 'Blue Pea Matcha Cloud'],
      ['', 'Blue Pea Fruit Tea', '', '', 'Peach/ Passion/ Red Grapefruit'],
    ];
    const recs = parseRecords(schema, rows);
    expect(recs).toHaveLength(2);
    expect(recs[1].values.ingredients).toBe('Peach/ Passion/ Red Grapefruit');
    expect(recs[0].rowNumber).toBe(5);
  });
});
