// The load-bearing property here is that requestVoucher never throws and never
// collapses distinct outcomes together: the card says something different for
// a declined score, an unreachable Worker, and the feature being switched off.

const ORIGIN = 'https://voucher.test';

// process.env is read at module scope, so it has to be set before the import.
process.env.REACT_APP_VOUCHER_URL = ORIGIN;

const { requestVoucher, isVoucherEnabled, redeemUrl } = require('./voucherClient');

const ENTRY_ID = 'aBcDeF1234567890GhIj';

const jsonResponse = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

const issued = {
  token: 'payload.signature',
  rupees: 38,
  name: 'Pravy',
  score: 19,
  game: 'football',
  expiresAt: 1_800_000_000_000,
};

describe('isVoucherEnabled', () => {
  test('is on when an endpoint is configured', () => {
    expect(isVoucherEnabled()).toBe(true);
  });
});

describe('requestVoucher', () => {
  test('returns the issued voucher on success', async () => {
    const fetchImpl = jest.fn(async () => jsonResponse(200, issued));
    const result = await requestVoucher(ENTRY_ID, { fetchImpl });
    expect(result.status).toBe('issued');
    expect(result.rupees).toBe(38);
    expect(result.token).toBe('payload.signature');
  });

  test('sends only the entry id — the server decides the amount', async () => {
    const fetchImpl = jest.fn(async () => jsonResponse(200, issued));
    await requestVoucher(ENTRY_ID, { fetchImpl });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(`${ORIGIN}/issue`);
    expect(JSON.parse(init.body)).toEqual({ entryId: ENTRY_ID });
  });

  test('a 409 is a decision, not a failure, and keeps its reason', async () => {
    // The card needs to distinguish "your score was too old to claim" from
    // "we could not reach the server", so these must not collapse together.
    const fetchImpl = jest.fn(async () => jsonResponse(409, { error: 'stale' }));
    const result = await requestVoucher(ENTRY_ID, { fetchImpl });
    expect(result).toEqual({ status: 'declined', reason: 'stale' });
  });

  test('a 409 with an unreadable body still reports declined', async () => {
    const fetchImpl = jest.fn(async () => ({
      ok: false,
      status: 409,
      json: async () => { throw new SyntaxError('not json'); },
    }));
    const result = await requestVoucher(ENTRY_ID, { fetchImpl });
    expect(result.status).toBe('declined');
  });

  test('a server error is unavailable, not declined', async () => {
    const fetchImpl = jest.fn(async () => jsonResponse(500, {}));
    const result = await requestVoucher(ENTRY_ID, { fetchImpl });
    expect(result).toEqual({ status: 'unavailable' });
  });

  test('a network failure never throws — a dead Worker must not cost the game', async () => {
    const fetchImpl = jest.fn(async () => { throw new TypeError('Failed to fetch'); });
    await expect(requestVoucher(ENTRY_ID, { fetchImpl })).resolves.toEqual({
      status: 'unavailable',
    });
  });

  test('a malformed success body is treated as unavailable', async () => {
    for (const body of [{}, { token: 'x' }, { rupees: 10 }, { token: 'x', rupees: '10' }, null]) {
      const fetchImpl = jest.fn(async () => jsonResponse(200, body));
      const result = await requestVoucher(ENTRY_ID, { fetchImpl });
      expect(result.status).toBe('unavailable');
    }
  });

  test('a missing entry id short-circuits without calling the network', async () => {
    const fetchImpl = jest.fn();
    const result = await requestVoucher(undefined, { fetchImpl });
    expect(result).toEqual({ status: 'unavailable' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('a hanging request is aborted rather than left to leak', async () => {
    let abortSignal;
    const fetchImpl = jest.fn(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          abortSignal = init.signal;
          init.signal.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    const result = await requestVoucher(ENTRY_ID, { fetchImpl, timeoutMs: 10 });
    expect(result).toEqual({ status: 'unavailable' });
    expect(abortSignal.aborted).toBe(true);
  });
});

describe('redeemUrl', () => {
  test('puts the token in the fragment, so it never reaches an access log', () => {
    const url = redeemUrl('payload.signature', ORIGIN);
    expect(url).toBe(`${ORIGIN}/redeem#payload.signature`);
    expect(url).not.toContain('?');
  });

  test('escapes a token containing URL-significant characters', () => {
    expect(redeemUrl('a/b+c=', ORIGIN)).toBe(`${ORIGIN}/redeem#a%2Fb%2Bc%3D`);
  });
});
