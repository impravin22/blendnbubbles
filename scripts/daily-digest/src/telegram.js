const TELEGRAM_API = 'https://api.telegram.org';
const DEFAULT_TIMEOUT_MS = 20_000;
const RETRY_COUNT = 3;

export class TelegramClient {
  constructor({ botToken, chatId }) {
    this.botToken = botToken;
    this.chatId = chatId;
    this.base = `${TELEGRAM_API}/bot${botToken}`;
  }

  async sendMessage(text) {
    const body = new URLSearchParams({
      chat_id: String(this.chatId),
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: 'true',
    });
    return await callWithRetry('sendMessage', () =>
      fetch(`${this.base}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      }),
    );
  }

  async sendDocument({ filename, buffer, mimeType, caption }) {
    const form = new FormData();
    form.append('chat_id', String(this.chatId));
    if (caption) form.append('caption', caption);
    form.append(
      'document',
      new Blob([buffer], { type: mimeType ?? 'application/octet-stream' }),
      filename,
    );
    return await callWithRetry('sendDocument', () =>
      fetch(`${this.base}/sendDocument`, {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS * 3),
      }),
    );
  }
}

async function callWithRetry(method, doFetch) {
  let lastError;
  for (let attempt = 1; attempt <= RETRY_COUNT; attempt++) {
    try {
      const res = await doFetch();
      let data;
      try {
        data = await res.json();
      } catch {
        throw new Error(`Telegram ${method} returned non-JSON (status ${res.status})`);
      }
      if (data.ok) return data.result;
      const retryable = res.status >= 500 || res.status === 429;
      const retryAfter = data?.parameters?.retry_after;
      if (retryable && attempt < RETRY_COUNT) {
        await sleep((retryAfter ?? 2 ** attempt) * 1000);
        continue;
      }
      throw new Error(
        `Telegram ${method} failed (${res.status}): ${data.description ?? 'unknown error'}`,
      );
    } catch (err) {
      lastError = err;
      const isNetwork = err?.name === 'TypeError' || err?.name === 'TimeoutError';
      if (isNetwork && attempt < RETRY_COUNT) {
        await sleep(2 ** attempt * 1000);
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
