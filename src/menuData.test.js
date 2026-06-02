import { MENU } from './menuData';

describe('MENU data', () => {
  test('has categories with unique ids', () => {
    expect(MENU.length).toBeGreaterThan(0);
    const ids = MENU.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every category has a title, a known type and items', () => {
    for (const cat of MENU) {
      expect(cat.title.length).toBeGreaterThan(0);
      expect(['temp', 'single']).toContain(cat.type);
      expect(cat.items.length).toBeGreaterThan(0);
    }
  });

  test('temp items offer at least one temperature with a valid price and a description', () => {
    const temp = MENU.filter((c) => c.type === 'temp');
    for (const cat of temp) {
      for (const item of cat.items) {
        const offered = [item.hot, item.cold].filter((p) => p != null);
        expect(offered.length).toBeGreaterThan(0); // not both unavailable
        for (const p of offered) {
          expect(Number.isInteger(p)).toBe(true);
          expect(p).toBeGreaterThan(0);
        }
        expect(typeof item.desc).toBe('string');
        expect(item.desc.length).toBeGreaterThan(0);
      }
    }
  });

  test('single items have a positive integer price', () => {
    const single = MENU.filter((c) => c.type === 'single');
    for (const cat of single) {
      for (const item of cat.items) {
        expect(Number.isInteger(item.price)).toBe(true);
        expect(item.price).toBeGreaterThan(0);
      }
    }
  });

  test('matches the printed board on key items', () => {
    const soda = MENU.find((c) => c.id === 'soda');
    expect(soda.items).toHaveLength(10);

    const choc = MENU.find((c) => c.id === 'chocolate');
    const cocoa = choc.items.find((i) => i.name === 'Hot Cocoa Cloud');
    expect(cocoa).toMatchObject({ hot: 199, cold: null });

    const coffee = MENU.find((c) => c.id === 'coffee');
    const brew = coffee.items.find((i) => i.name === 'Classic Boba Brew');
    expect(brew).toMatchObject({ hot: 119, cold: null });
  });
});
