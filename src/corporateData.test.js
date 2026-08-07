import { BOOKING_OPTIONS, OCCASIONS, PACKAGES, TRUST_MARKERS } from './corporateData';

describe('corporateData', () => {
  it('offers exactly one zero-budget and one sponsored route', () => {
    expect(BOOKING_OPTIONS).toHaveLength(2);
    expect(BOOKING_OPTIONS.map((o) => o.id)).toEqual(['guests-pay', 'sponsored']);
  });

  it('highlights only the zero-budget option, the easiest yes for a buyer', () => {
    const highlighted = BOOKING_OPTIONS.filter((o) => o.highlight);
    expect(highlighted).toHaveLength(1);
    expect(highlighted[0].id).toBe('guests-pay');
  });

  it('gives every booking option the fields the page renders', () => {
    BOOKING_OPTIONS.forEach((option) => {
      ['tag', 'name', 'cost', 'body', 'note'].forEach((key) => {
        expect(typeof option[key]).toBe('string');
        expect(option[key].length).toBeGreaterThan(0);
      });
    });
  });

  it('lists occasions without duplicates', () => {
    expect(OCCASIONS.length).toBeGreaterThan(0);
    expect(new Set(OCCASIONS).size).toBe(OCCASIONS.length);
  });

  it('does not advertise Holi, which falls in spring and had passed for 2026', () => {
    expect(OCCASIONS.map((o) => o.toLowerCase())).not.toContain('holi');
  });

  it('orders packages from smallest to largest headcount', () => {
    const sizes = PACKAGES.map((p) => parseInt(p.cups, 10));
    expect(sizes).toEqual([...sizes].sort((a, b) => a - b));
    sizes.forEach((size) => expect(Number.isNaN(size)).toBe(false));
  });

  it('gives every package a unique id and the fields the page renders', () => {
    expect(new Set(PACKAGES.map((p) => p.id)).size).toBe(PACKAGES.length);
    PACKAGES.forEach((pack) => {
      ['cups', 'unit', 'fits', 'detail'].forEach((key) => {
        expect(typeof pack[key]).toBe('string');
        expect(pack[key].length).toBeGreaterThan(0);
      });
    });
  });

  it('carries the FSSAI licence number, the strongest trust marker for a food vendor', () => {
    const fssai = TRUST_MARKERS.find((m) => m.id === 'fssai');
    expect(fssai).toBeDefined();
    expect(fssai.detail).toMatch(/^\d{14}$/);
  });
});
