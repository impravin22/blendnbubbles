/**
 * Compute today / week-to-date / month-to-date window keys in the configured
 * timezone. Pulled out of scrape.js so the unit tests do not have to load
 * Playwright (which is an optional dev dep).
 */

export function computeWindows(now = new Date(), localeTz = 'Asia/Kolkata') {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: localeTz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const today = formatter.format(now);
  const wParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: localeTz,
    weekday: 'short',
  }).formatToParts(now);
  const weekdayName = wParts.find((p) => p.type === 'weekday')?.value;
  const weekdayMap = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  const offset = weekdayMap[weekdayName] ?? 0;
  const weekStartDate = new Date(now);
  weekStartDate.setUTCDate(weekStartDate.getUTCDate() - offset);
  const weekStart = formatter.format(weekStartDate);
  const [year, month] = today.split('-').map(Number);
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  return {
    todayStart: today,
    todayEnd: today,
    weekStart,
    weekEnd: today,
    monthStart,
    monthEnd: today,
  };
}
