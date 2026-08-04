import { buildSubmitUrl, isEventsEnabled, submitEventRequest } from './eventsClient';

const FIELDS = {
  name: 'Ananya Sen',
  org: "St. Xavier's College",
  email: 'ananya@example.com',
  phone: '+91 98301 22334',
  social: '@ananya',
  eventType: 'College fest',
  eventDate: '2026-09-14',
  guests: '100 – 250',
  message: 'Fresher welcome, 300 students, outdoor stalls.',
  brochure: 'https://drive.google.com/file/d/abc',
  hp: '',
};

const okResponse = (body = { ok: true, emailed: true }) => ({
  ok: true,
  json: () => Promise.resolve(body),
});

describe('eventsClient with no webhook configured', () => {
  // REACT_APP_EVENTS_WEBHOOK_URL is unset under test, so the module-level
  // constant is empty — the disabled path is the real default here.
  it('reports the feature as disabled', () => {
    expect(isEventsEnabled()).toBe(false);
  });

  it('builds no URL', () => {
    expect(buildSubmitUrl(FIELDS)).toBeNull();
  });

  it('returns disabled without calling fetch', async () => {
    const fetchImpl = jest.fn();
    const result = await submitEventRequest(FIELDS, { fetchImpl });
    expect(result).toEqual({ status: 'disabled' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('short-circuits the honeypot before even checking the URL', async () => {
    const fetchImpl = jest.fn();
    const result = await submitEventRequest({ ...FIELDS, hp: 'gotcha' }, { fetchImpl });
    expect(result).toEqual({ status: 'sent' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('eventsClient with a webhook configured', () => {
  // The URL is read at module load, so point the env var and re-import.
  let client;

  beforeEach(() => {
    jest.resetModules();
    process.env.REACT_APP_EVENTS_WEBHOOK_URL = 'https://script.google.com/macros/s/FAKE/exec';
    client = require('./eventsClient');
  });

  afterEach(() => {
    delete process.env.REACT_APP_EVENTS_WEBHOOK_URL;
    jest.resetModules();
  });

  it('reports the feature as enabled', () => {
    expect(client.isEventsEnabled()).toBe(true);
  });

  it('builds a GET URL carrying every field, percent-encoded', () => {
    const url = client.buildSubmitUrl({ ...FIELDS, name: '<img onerror=x>&joe' });
    expect(url.startsWith('https://script.google.com/macros/s/FAKE/exec?')).toBe(true);
    const params = new URL(url).searchParams;
    expect(params.get('name')).toBe('<img onerror=x>&joe');
    expect(url).not.toContain('<img');
    expect(params.get('eventType')).toBe('College fest');
    expect(params.get('eventDate')).toBe('2026-09-14');
    expect(params.get('userAgent')).toBeTruthy();
    expect(params.get('pageHref')).toBeTruthy();
  });

  it('omits empty optional fields from the URL', () => {
    const url = client.buildSubmitUrl({ ...FIELDS, org: '', social: '', brochure: '' });
    const params = new URL(url).searchParams;
    expect(params.has('org')).toBe(false);
    expect(params.has('social')).toBe(false);
    expect(params.has('brochure')).toBe(false);
  });

  it('resolves sent on an ok reply', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(okResponse());
    const result = await client.submitEventRequest(FIELDS, { fetchImpl });
    expect(result).toEqual({ status: 'sent' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ method: 'GET' });
  });

  it('maps a missing-fields reply to invalid', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      okResponse({ ok: false, error: 'missing-fields', fields: ['email'] })
    );
    const result = await client.submitEventRequest(FIELDS, { fetchImpl });
    expect(result).toEqual({ status: 'invalid', fields: ['email'] });
  });

  it('maps an HTTP error to unavailable', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: false, status: 500 });
    const result = await client.submitEventRequest(FIELDS, { fetchImpl });
    expect(result).toEqual({ status: 'unavailable' });
  });

  it('maps a network failure to unavailable without throwing', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const result = await client.submitEventRequest(FIELDS, { fetchImpl });
    expect(result).toEqual({ status: 'unavailable' });
  });

  it('maps malformed JSON to unavailable', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.reject(new SyntaxError('bad json')),
    });
    const result = await client.submitEventRequest(FIELDS, { fetchImpl });
    expect(result).toEqual({ status: 'unavailable' });
  });

  it('aborts a hung request after the timeout and reports unavailable', async () => {
    const fetchImpl = jest.fn(
      (url, { signal }) =>
        new Promise((resolve, reject) => {
          signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        })
    );
    const result = await client.submitEventRequest(FIELDS, { fetchImpl, timeoutMs: 10 });
    expect(result).toEqual({ status: 'unavailable' });
  });
});
