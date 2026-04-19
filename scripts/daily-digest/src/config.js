const REQUIRED = [
  'GMAIL_CLIENT_ID',
  'GMAIL_CLIENT_SECRET',
  'GMAIL_REFRESH_TOKEN',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_CHAT_ID',
];

/**
 * @typedef {object} Config
 * @property {{clientId: string, clientSecret: string, refreshToken: string}} gmail
 * @property {{botToken: string, chatId: string}} telegram
 * @property {number} lookbackHours  positive finite integer
 * @property {string} localeTz       IANA timezone
 */

/**
 * Validate env and return a shaped config. Throws on any missing/invalid value.
 * @param {Record<string, string | undefined>} [env=process.env]
 * @returns {Config}
 */
export function loadConfig(env = process.env) {
  const missing = REQUIRED.filter((k) => !env[k]);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
  const lookbackHours = Number(env.DIGEST_LOOKBACK_HOURS ?? 12);
  if (!Number.isFinite(lookbackHours) || lookbackHours <= 0) {
    throw new Error(
      `DIGEST_LOOKBACK_HOURS must be a positive finite number (got "${env.DIGEST_LOOKBACK_HOURS}")`,
    );
  }
  const localeTz = env.DIGEST_LOCALE_TZ ?? 'Asia/Taipei';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: localeTz }).format(new Date());
  } catch {
    throw new Error(`DIGEST_LOCALE_TZ "${localeTz}" is not a valid IANA timezone`);
  }
  return {
    gmail: {
      clientId: env.GMAIL_CLIENT_ID,
      clientSecret: env.GMAIL_CLIENT_SECRET,
      refreshToken: env.GMAIL_REFRESH_TOKEN,
    },
    telegram: {
      botToken: env.TELEGRAM_BOT_TOKEN,
      chatId: env.TELEGRAM_CHAT_ID,
    },
    lookbackHours,
    localeTz,
    petpoojaWebhook:
      env.PETPOOJA_WEBHOOK_URL && env.PETPOOJA_WEBHOOK_TOKEN
        ? { url: env.PETPOOJA_WEBHOOK_URL, token: env.PETPOOJA_WEBHOOK_TOKEN }
        : null,
    seenStore:
      env.DIGEST_STATE_URL && env.DIGEST_STATE_TOKEN
        ? { url: env.DIGEST_STATE_URL, token: env.DIGEST_STATE_TOKEN }
        : null,
  };
}
