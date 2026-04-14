#!/usr/bin/env node
import http from 'node:http';
import { handleWebhook } from './handler.js';
import { loadOrders, aggregateToday } from './storage.js';

const PORT = Number(process.env.PORT ?? 8787);
const EXPECTED_TOKEN = process.env.PETPOOJA_SHARED_TOKEN;
const STORE_PATH = process.env.PETPOOJA_STORE_PATH;
const DIGEST_API_TOKEN = process.env.DIGEST_API_TOKEN;
const LOCALE_TZ = process.env.DIGEST_LOCALE_TZ ?? 'Asia/Kolkata';

if (!EXPECTED_TOKEN) {
  console.error('PETPOOJA_SHARED_TOKEN is required — refuse to start without it.');
  process.exit(1);
}
if (!DIGEST_API_TOKEN) {
  console.error('DIGEST_API_TOKEN is required — refuse to start without it.');
  process.exit(1);
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'POST' && req.url === '/petpooja-webhook') {
      const body = await readJson(req);
      const result = await handleWebhook(body, {
        expectedToken: EXPECTED_TOKEN,
        storePath: STORE_PATH,
      });
      res.statusCode = result.statusCode;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ok: result.ok, ...(result.error ? { error: result.error } : {}) }));
      return;
    }
    if (req.method === 'GET' && req.url.startsWith('/petpooja-today')) {
      if (!authorised(req)) {
        res.statusCode = 401;
        res.end(JSON.stringify({ ok: false, error: 'bad-token' }));
        return;
      }
      const orders = await loadOrders(STORE_PATH);
      const summary = aggregateToday(orders, { localeTz: LOCALE_TZ });
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store');
      res.end(JSON.stringify({ ok: true, ...summary }));
      return;
    }
    if (req.method === 'GET' && req.url === '/health') {
      res.statusCode = 200;
      res.end('ok');
      return;
    }
    res.statusCode = 404;
    res.end(JSON.stringify({ ok: false, error: 'not-found' }));
  } catch (err) {
    console.error('webhook error:', err?.stack ?? err);
    res.statusCode = 500;
    res.end(JSON.stringify({ ok: false, error: 'internal' }));
  }
});

server.listen(PORT, () => {
  console.log(`petpooja-webhook listening on :${PORT}`);
});

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      data += chunk;
      // Refuse huge payloads — PetPooja orders are well under 64 KB.
      if (data.length > 256 * 1024) {
        reject(new Error('payload-too-large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        resolve(null);
      }
    });
    req.on('error', reject);
  });
}

function authorised(req) {
  const header = req.headers.authorization ?? '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  const token = match ? match[1] : null;
  return token && token === DIGEST_API_TOKEN;
}
