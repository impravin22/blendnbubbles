import { isPlausibleScore, SCORE_CEILINGS } from './firebase';

describe('isPlausibleScore', () => {
  test('football scores up to the 40 ceiling pass', () => {
    expect(isPlausibleScore(0, 'football')).toBe(true);
    expect(isPlausibleScore(18, 'football')).toBe(true);
    expect(isPlausibleScore(40, 'football')).toBe(true);
  });

  test('football scores above 40 are rejected (spoof guard)', () => {
    expect(isPlausibleScore(41, 'football')).toBe(false);
    expect(isPlausibleScore(101, 'football')).toBe(false);
    expect(isPlausibleScore(9999, 'football')).toBe(false);
  });

  test('boba catcher keeps its own, higher ceiling', () => {
    expect(SCORE_CEILINGS.bobacatcher).toBe(1000);
    expect(isPlausibleScore(250, 'bobacatcher')).toBe(true);
    expect(isPlausibleScore(1001, 'bobacatcher')).toBe(false);
  });

  test('non-integer and negative scores are rejected for any game', () => {
    expect(isPlausibleScore(-1, 'football')).toBe(false);
    expect(isPlausibleScore(3.5, 'football')).toBe(false);
    expect(isPlausibleScore(NaN, 'football')).toBe(false);
    expect(isPlausibleScore('12', 'football')).toBe(false);
  });
});
