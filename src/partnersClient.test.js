// The property that matters: nothing here decides whether a token is valid.
// Only the server does. A rejected token and an unreachable server must stay
// distinguishable, because collapsing them makes a stale deploy undiagnosable.

const ORIGIN = 'https://partners.test';

// process.env is read at module scope, so it has to be set before the import.
process.env.REACT_APP_PARTNERS_URL = ORIGIN;

const {
  fetchPartnerSheets,
  isPartnersConfigured,
  readStoredToken,
  storeToken,
  clearStoredToken,
  TOKEN_KEY,
} = require('./partnersClient');

const EXTRACT = {
  generatedAt: '2026-08-10T00:00:00.000Z',
  sheets: [{ id: 'abc', name: 'BnB Event Requests', rows: [['Name', 'Phone']] }],
};

const jsonResponse = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

beforeEach(() => {
  window.localStorage.clear();
});

describe('isPartnersConfigured', () => {
  test('is on when an endpoint is configured', () => {
    expect(isPartnersConfigured()).toBe(true);
  });
});

describe('token storage', () => {
  test('round-trips a token', () => {
    storeToken('abc123');
    expect(readStoredToken()).toBe('abc123');
    expect(window.localStorage.getItem(TOKEN_KEY)).toBe('abc123');
  });

  test('uses its own storage key so it cannot collide with the reports token', () => {
    // Two different Worker secrets. Sharing a key would send each service the
    // other's token and lock the owner out of whichever they logged into last.
    expect(TOKEN_KEY).not.toBe('bnbReportsToken');
  });

  test('reads empty when nothing is stored', () => {
    expect(readStoredToken()).toBe('');
  });

  test('clears a rejected token so the prompt reappears', () => {
    storeToken('stale');
    clearStoredToken();
    expect(readStoredToken()).toBe('');
  });

  test('survives blocked storage without throwing', () => {
    const spy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readStoredToken()).toBe('');
    spy.mockRestore();

    const setSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => storeToken('x')).not.toThrow();
    setSpy.mockRestore();
  });
});

describe('fetchPartnerSheets', () => {
  test('returns the extract on success', async () => {
    const fetchImpl = jest.fn(async () => jsonResponse(200, EXTRACT));
    const result = await fetchPartnerSheets('good-token', { fetchImpl });
    expect(result.status).toBe('ok');
    expect(result.data.sheets).toHaveLength(1);
  });

  test('sends the token as a bearer header, never in the URL', async () => {
    // A token in a query string lands in access logs and Referer headers.
    const fetchImpl = jest.fn(async () => jsonResponse(200, EXTRACT));
    await fetchPartnerSheets('good-token', { fetchImpl });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(`${ORIGIN}/data`);
    expect(url).not.toContain('good-token');
    expect(init.headers.authorization).toBe('Bearer good-token');
  });

  test('a 401 is unauthorised, distinct from unavailable', async () => {
    const fetchImpl = jest.fn(async () => jsonResponse(401, { error: 'unauthorised' }));
    const result = await fetchPartnerSheets('wrong', { fetchImpl });
    expect(result).toEqual({ status: 'unauthorised' });
  });

  test('a 500 is unavailable, not unauthorised', async () => {
    const fetchImpl = jest.fn(async () => jsonResponse(500, {}));
    const result = await fetchPartnerSheets('good', { fetchImpl });
    expect(result.status).toBe('unavailable');
  });

  test('a network failure never throws', async () => {
    const fetchImpl = jest.fn(async () => { throw new TypeError('Failed to fetch'); });
    await expect(fetchPartnerSheets('good', { fetchImpl })).resolves.toMatchObject({
      status: 'unavailable',
    });
  });

  test('an empty token short-circuits without hitting the network', async () => {
    const fetchImpl = jest.fn();
    const result = await fetchPartnerSheets('', { fetchImpl });
    expect(result).toEqual({ status: 'unauthorised' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('a response missing sheets is unavailable, not a broken page', async () => {
    // Without this the table render would throw somewhere far from the cause.
    for (const body of [null, {}, { sheets: 'not-an-array' }, { generatedAt: 'x' }]) {
      const fetchImpl = jest.fn(async () => jsonResponse(200, body));
      const result = await fetchPartnerSheets('good', { fetchImpl });
      expect(result.status).toBe('unavailable');
    }
  });

  test('an empty sheet list is a valid answer, not an error', async () => {
    // No Drive activity in 30 days is a real state the page must render.
    const fetchImpl = jest.fn(async () => jsonResponse(200, { sheets: [] }));
    const result = await fetchPartnerSheets('good', { fetchImpl });
    expect(result.status).toBe('ok');
    expect(result.data.sheets).toEqual([]);
  });

  test('invalid JSON is unavailable rather than an exception', async () => {
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => { throw new SyntaxError('Unexpected token <'); },
    }));
    const result = await fetchPartnerSheets('good', { fetchImpl });
    expect(result.status).toBe('unavailable');
  });
});
