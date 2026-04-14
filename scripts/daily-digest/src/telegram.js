const TELEGRAM_API = 'https://api.telegram.org';

export class TelegramClient {
  constructor({ botToken, chatId }) {
    this.botToken = botToken;
    this.chatId = chatId;
    this.base = `${TELEGRAM_API}/bot${botToken}`;
  }

  async sendMessage(text, { parseMode = 'HTML', disablePreview = true } = {}) {
    const body = new URLSearchParams({
      chat_id: String(this.chatId),
      text,
      parse_mode: parseMode,
      disable_web_page_preview: String(disablePreview),
    });
    const res = await fetch(`${this.base}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const data = await res.json();
    if (!data.ok) {
      throw new Error(`Telegram sendMessage failed: ${data.description ?? res.status}`);
    }
    return data.result;
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
    const res = await fetch(`${this.base}/sendDocument`, {
      method: 'POST',
      body: form,
    });
    const data = await res.json();
    if (!data.ok) {
      throw new Error(`Telegram sendDocument failed: ${data.description ?? res.status}`);
    }
    return data.result;
  }
}
