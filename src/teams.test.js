import { TEAMS, FEATURED_TEAMS, getTeamByCode, numberColourFor } from './teams';

describe('TEAMS dataset', () => {
  test('contains the full 48-team tournament field', () => {
    expect(TEAMS).toHaveLength(48);
  });

  test('surfaces exactly eight featured nations', () => {
    expect(FEATURED_TEAMS).toHaveLength(8);
    expect(FEATURED_TEAMS.map((t) => t.code)).toEqual([
      'ARG', 'BRA', 'ESP', 'GER', 'NED', 'POR', 'FRA', 'ENG',
    ]);
  });

  test('every team has the required fields', () => {
    for (const t of TEAMS) {
      expect(typeof t.code).toBe('string');
      expect(t.code).toMatch(/^[A-Z]{3}$/);
      expect(t.name.length).toBeGreaterThan(0);
      expect(t.flag.length).toBeGreaterThan(0);
      expect(t.primary).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(t.secondary).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  test('codes are unique', () => {
    const codes = TEAMS.map((t) => t.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe('getTeamByCode', () => {
  test('finds a known team', () => {
    expect(getTeamByCode('ARG').name).toBe('Argentina');
  });

  test('returns null for an unknown code', () => {
    expect(getTeamByCode('ZZZ')).toBeNull();
  });
});

describe('numberColourFor', () => {
  test('uses dark text on a light jersey', () => {
    expect(numberColourFor('#F4F4F4')).toBe('#1A1A1A');
    expect(numberColourFor('#FCDD09')).toBe('#1A1A1A'); // Brazil yellow
  });

  test('uses light text on a dark jersey', () => {
    expect(numberColourFor('#1E2F97')).toBe('#FFFFFF'); // France blue
    expect(numberColourFor('#0A2342')).toBe('#FFFFFF'); // navy
  });

  test('accepts shorthand hex', () => {
    expect(numberColourFor('#fff')).toBe('#1A1A1A');
    expect(numberColourFor('#000')).toBe('#FFFFFF');
  });
});
