/**
 * Opening-hours consistency tests.
 *
 * Business hours are duplicated across the SEO shell (public/index.html:
 * JSON-LD structured data + FAQ answers + the visible "Visit" section) and the
 * React contact section (src/App.js). These tests guard every occurrence
 * against accidental drift and against malformed JSON-LD, which would silently
 * break Google rich results without any visible error.
 *
 * Canonical hours: Tuesday-Sunday 12:00-22:00, Monday 16:00-22:00.
 */
const fs = require('fs');
const path = require('path');

const INDEX_HTML = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'index.html'),
  'utf8',
);
const APP_JS = fs.readFileSync(path.join(__dirname, 'App.js'), 'utf8');

/** Extract and parse every <script type="application/ld+json"> block. */
function parseJsonLdBlocks(html) {
  const blocks = [];
  const re =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = re.exec(html)) !== null) {
    blocks.push(JSON.parse(match[1]));
  }
  return blocks;
}

/** The opening-hours array from whichever JSON-LD block declares it. */
function openingHoursSpecs(blocks) {
  const spec = blocks
    .map((block) => block.openingHoursSpecification)
    .find((value) => Array.isArray(value));
  if (!spec) {
    throw new Error(
      'No array-valued openingHoursSpecification found in any JSON-LD block',
    );
  }
  return spec;
}

describe('public/index.html JSON-LD structured data', () => {
  let blocks;

  beforeAll(() => {
    blocks = parseJsonLdBlocks(INDEX_HTML);
  });

  test('every JSON-LD block is valid JSON', () => {
    // parseJsonLdBlocks runs JSON.parse in beforeAll and throws on malformed
    // JSON, which would fail this whole suite at setup. Reaching this point
    // means every block parsed; assert each is a usable object for clarity.
    expect(blocks.length).toBeGreaterThan(0);
    blocks.forEach((block) => {
      expect(typeof block).toBe('object');
      expect(block).not.toBeNull();
    });
  });

  test('LocalBusiness exposes exactly two opening-hours specifications', () => {
    const specs = openingHoursSpecs(blocks);
    expect(specs).toBeDefined();
    expect(specs).toHaveLength(2);
  });

  test('Tuesday-Sunday specification is 12:00-22:00 and excludes Monday', () => {
    const weekday = openingHoursSpecs(blocks).find((spec) =>
      spec.dayOfWeek.includes('Tuesday'),
    );
    expect(weekday).toMatchObject({ opens: '12:00', closes: '22:00' });
    expect(weekday.dayOfWeek).toEqual([
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ]);
    expect(weekday.dayOfWeek).not.toContain('Monday');
  });

  test('Monday specification is 16:00-22:00', () => {
    const monday = openingHoursSpecs(blocks).find((spec) =>
      spec.dayOfWeek.includes('Monday'),
    );
    expect(monday).toMatchObject({ opens: '16:00', closes: '22:00' });
    expect(monday.dayOfWeek).toEqual(['Monday']);
  });

  test('no stale 11:00/21:00 times remain in structured data', () => {
    const serialised = JSON.stringify(openingHoursSpecs(blocks));
    expect(serialised).not.toContain('11:00');
    expect(serialised).not.toContain('21:00');
  });
});

describe('public/index.html human-readable copy', () => {
  test('visible Hours paragraph shows the new split hours', () => {
    expect(INDEX_HTML).toContain(
      'Tuesday to Sunday, 12:00 PM – 10:00 PM; Monday, 4:00 PM – 10:00 PM',
    );
  });

  test('detailed FAQ answer reflects the new split hours', () => {
    expect(INDEX_HTML).toContain(
      'open Tuesday to Sunday from 12:00 PM to 10:00 PM, and Monday from 4:00 PM to 10:00 PM',
    );
  });

  test('boba-store FAQ answer reflects the new split hours', () => {
    expect(INDEX_HTML).toContain(
      'Open Tuesday to Sunday from 12:00 PM to 10:00 PM, and Monday from 4:00 PM to 10:00 PM',
    );
  });

  test('no stale "11:00 AM" / "9:00 PM" / "11 AM to 9 PM" copy remains', () => {
    expect(INDEX_HTML).not.toContain('11:00 AM');
    expect(INDEX_HTML).not.toContain('9:00 PM');
    expect(INDEX_HTML).not.toContain('11 AM to 9 PM');
  });
});

describe('src/App.js contact section', () => {
  test('renders the new split hours', () => {
    expect(APP_JS).toContain('Tuesday - Sunday: 12pm - 10pm');
    expect(APP_JS).toContain('Monday: 4pm - 10pm');
  });

  test('no stale "11am - 9pm" line remains', () => {
    expect(APP_JS).not.toContain('11am - 9pm');
  });
});
