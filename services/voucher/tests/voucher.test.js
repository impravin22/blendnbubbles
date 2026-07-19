import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  discountFor,
  signVoucher,
  verifyVoucher,
  isClaimable,
  SCORE_MAX_AGE_MS,
  VOUCHER_TTL_MS,
} from '../src/voucher.js';

const SECRET = 'test-secret-not-the-real-one';
const NOW = 1_800_000_000_000;

const claim = (over = {}) => ({
  entryId: 'abc123',
  name: 'Pravy',
  score: 7,
  game: 'football',
  playerId: null,
  rupees: 14,
  issuedAt: NOW,
  ...over,
});

describe('discountFor', () => {
  test('pays Rs 2 per goal for football', () => {
    assert.equal(discountFor(1, 'football'), 2);
    assert.equal(discountFor(10, 'football'), 20);
    assert.equal(discountFor(19, 'football'), 38);
  });

  // Regression. The rate used to be flat and applied to whatever score arrived,
  // but the two games do not share units: football counts goals (capped at 19),
  // Boba Catcher counts points (capped at 1000, items worth up to 10 each with a
  // 3x combo). The flat rate paid the maximum discount for any Boba Catcher run
  // past 25 points — an ordinary score, on the default game path.
  test('Boba Catcher mints nothing — its reward is not measured in rupees', () => {
    assert.equal(discountFor(25, 'bobacatcher'), 0);
    assert.equal(discountFor(1000, 'bobacatcher'), 0);
  });

  test('an unknown or missing game mints nothing, never a default rate', () => {
    assert.equal(discountFor(19, 'roulette'), 0);
    assert.equal(discountFor(19, undefined), 0);
    assert.equal(discountFor(19, null), 0);
  });

  test('zero goals earns nothing', () => {
    assert.equal(discountFor(0, 'football'), 0);
  });

  test('caps as a backstop and never pays out for junk input', () => {
    assert.equal(discountFor(25, 'football'), 50);
    assert.equal(discountFor(9999, 'football'), 50);
    assert.equal(discountFor(-5, 'football'), 0);
    assert.equal(discountFor(3.5, 'football'), 0);
    assert.equal(discountFor('10', 'football'), 0);
    assert.equal(discountFor(NaN, 'football'), 0);
  });
});

describe('signVoucher / verifyVoucher', () => {
  test('a freshly signed voucher verifies and round-trips its claim', async () => {
    const token = await signVoucher(claim(), SECRET);
    const result = await verifyVoucher(token, SECRET, NOW);
    assert.equal(result.ok, true);
    assert.equal(result.claim.entryId, 'abc123');
    assert.equal(result.claim.rupees, 14);
  });

  test('a tampered payload is rejected — the whole point of the signature', async () => {
    const token = await signVoucher(claim({ rupees: 14 }), SECRET);
    const [, signature] = token.split('.');
    // Re-encode the claim with a bigger payout, keeping the original signature.
    const forged = Buffer.from(JSON.stringify(claim({ rupees: 50 })))
      .toString('base64url');
    const result = await verifyVoucher(`${forged}.${signature}`, SECRET, NOW);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'bad-signature');
  });

  test('a voucher signed with another secret is rejected', async () => {
    const token = await signVoucher(claim(), 'someone-elses-secret');
    const result = await verifyVoucher(token, SECRET, NOW);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'bad-signature');
  });

  test('expires after its TTL', async () => {
    const token = await signVoucher(claim(), SECRET);
    const justInside = await verifyVoucher(token, SECRET, NOW + VOUCHER_TTL_MS - 1);
    assert.equal(justInside.ok, true);
    const justOutside = await verifyVoucher(token, SECRET, NOW + VOUCHER_TTL_MS + 1);
    assert.equal(justOutside.ok, false);
    assert.equal(justOutside.reason, 'expired');
  });

  test('malformed tokens are rejected rather than throwing', async () => {
    for (const bad of ['', 'nodot', 'a.', '.b', null, undefined, 42, {}]) {
      const result = await verifyVoucher(bad, SECRET, NOW);
      assert.equal(result.ok, false, `expected rejection for ${JSON.stringify(bad)}`);
    }
  });

  test('a payload that is not valid JSON cannot reach the parser unsigned', async () => {
    // Signed, so it clears the HMAC check, but the bytes are not JSON. This must
    // report malformed rather than throw out of the Worker.
    const payload = Buffer.from('not json at all').toString('base64url');
    const token = await signVoucher(claim(), SECRET);
    const forged = `${payload}.${token.split('.')[1]}`;
    const result = await verifyVoucher(forged, SECRET, NOW);
    assert.equal(result.ok, false);
  });
});

describe('isClaimable', () => {
  const entry = (over = {}) => ({
    score: 7,
    createdAt: new Date(NOW).toISOString(),
    ...over,
  });

  test('accepts a fresh, positive, server-stamped score', () => {
    assert.equal(isClaimable(entry(), NOW).ok, true);
  });

  test('rejects a score older than the freshness window — the board is public', () => {
    // Without this, anyone could read the top of the leaderboard and mint a
    // voucher from a stranger's run.
    const old = entry({ createdAt: new Date(NOW - SCORE_MAX_AGE_MS - 1).toISOString() });
    const result = isClaimable(old, NOW);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'stale');
  });

  test('accepts a score right at the edge of the window', () => {
    const edge = entry({ createdAt: new Date(NOW - SCORE_MAX_AGE_MS + 1000).toISOString() });
    assert.equal(isClaimable(edge, NOW).ok, true);
  });

  test('rejects a future timestamp rather than trusting it', () => {
    const future = entry({ createdAt: new Date(NOW + 10 * 60_000).toISOString() });
    assert.equal(isClaimable(future, NOW).ok, false);
  });

  test('a zero score earns no voucher', () => {
    const result = isClaimable(entry({ score: 0 }), NOW);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'no-prize');
  });

  test('rejects missing, malformed, and non-integer entries', () => {
    assert.equal(isClaimable(null, NOW).ok, false);
    assert.equal(isClaimable(entry({ score: 'seven' }), NOW).ok, false);
    assert.equal(isClaimable(entry({ score: -1 }), NOW).ok, false);
    assert.equal(isClaimable(entry({ createdAt: 'not-a-date' }), NOW).ok, false);
  });
});
