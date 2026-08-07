import { CATERING_STEPS, CATERING_PACKAGES, CATERING_OCCASIONS } from './cateringData';

describe('cateringData', () => {
  it('gives every step a unique id and the fields the page renders', () => {
    expect(CATERING_STEPS.length).toBeGreaterThan(0);
    expect(new Set(CATERING_STEPS.map((s) => s.id)).size).toBe(CATERING_STEPS.length);
    CATERING_STEPS.forEach((step) => {
      expect(typeof step.title).toBe('string');
      expect(step.title.length).toBeGreaterThan(0);
      expect(typeof step.body).toBe('string');
      expect(step.body.length).toBeGreaterThan(0);
    });
  });

  it('gives every package a unique id and the fields the page renders', () => {
    expect(new Set(CATERING_PACKAGES.map((p) => p.id)).size).toBe(CATERING_PACKAGES.length);
    CATERING_PACKAGES.forEach((pack) => {
      ['name', 'guests', 'cups', 'unit', 'fits'].forEach((key) => {
        expect(typeof pack[key]).toBe('string');
        expect(pack[key].length).toBeGreaterThan(0);
      });
      expect(Array.isArray(pack.includes)).toBe(true);
      expect(pack.includes.length).toBeGreaterThan(0);
    });
  });

  it('flags exactly one package as most booked', () => {
    expect(CATERING_PACKAGES.filter((p) => p.popular)).toHaveLength(1);
  });

  it('orders packages from smallest to largest', () => {
    const sizes = CATERING_PACKAGES.map((p) => parseInt(p.cups, 10));
    sizes.forEach((size) => expect(Number.isNaN(size)).toBe(false));
    expect(sizes).toEqual([...sizes].sort((a, b) => a - b));
  });

  it('starts at the 50-cup minimum we actually serve', () => {
    const smallest = Math.min(...CATERING_PACKAGES.map((p) => parseInt(p.cups, 10)));
    expect(smallest).toBe(50);
  });

  it('lists occasions without duplicates', () => {
    expect(CATERING_OCCASIONS.length).toBeGreaterThan(0);
    expect(new Set(CATERING_OCCASIONS).size).toBe(CATERING_OCCASIONS.length);
  });
});
