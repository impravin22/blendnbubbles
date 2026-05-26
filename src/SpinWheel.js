import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Wheel } from 'react-custom-roulette';

/**
 * Anniversary spin wheel.
 *
 * - Renders a real animated wheel via react-custom-roulette.
 * - One spin per browser via localStorage soft-lock; staff is the real
 *   enforcement at the counter.
 * - Returning visitors see their previously won prize.
 *
 * Reset for testing in DevTools console:
 *   localStorage.removeItem('bnb_anniversary_spin_v1'); location.reload();
 */

const STORAGE_KEY = 'bnb_anniversary_spin_v1';
const BRAND_TEAL = '#0F3C3C';
const BRAND_AMBER = '#C89B4A';

// Apps Script web-app URL that appends each spin result to a Google Sheet.
// Configure via REACT_APP_SPIN_WEBHOOK_URL in `.env.production` (or `.env`).
// If unset, the wheel still works locally — staff just cannot cross-check
// against a sheet. See setup steps at the bottom of this file.
const WEBHOOK_URL = process.env.REACT_APP_SPIN_WEBHOOK_URL || '';

/**
 * Generate a short claim ticket. Uses crypto.randomUUID() when available
 * (all modern browsers since 2022) and falls back to a v4-style string
 * built from Math.random() for very old browsers.
 */
function generateTicket() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback v4-ish — not cryptographically strong, but fine for a claim ID.
  const hex = '0123456789abcdef';
  let out = '';
  for (let i = 0; i < 36; i += 1) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      out += '-';
    } else if (i === 14) {
      out += '4';
    } else if (i === 19) {
      out += hex[(Math.random() * 4) | 8];
    } else {
      out += hex[(Math.random() * 16) | 0];
    }
  }
  return out;
}

/**
 * Short, customer-friendly version of the ticket — first 8 hex chars,
 * upper-cased, dash-separated for readability (e.g. "A1B2-C3D4").
 * Staff can still look up the full UUID in the Sheet if they need to.
 */
function formatTicketShort(ticket) {
  const stripped = ticket.replace(/-/g, '').toUpperCase();
  return `${stripped.slice(0, 4)}-${stripped.slice(4, 8)}`;
}

/**
 * Build the webhook URL with query params. Returns null if the webhook
 * URL is not configured.
 */
function buildWebhookUrl(payload) {
  if (!WEBHOOK_URL) return null;
  const params = new URLSearchParams();
  Object.keys(payload).forEach(function (key) {
    const value = payload[key];
    if (value === undefined || value === null) return;
    params.append(key, String(value));
  });
  return `${WEBHOOK_URL}?${params.toString()}`;
}

/**
 * Pre-spin: ask the Sheet whether this fingerprint already won. Returns
 * the prior prize payload or null. Reads the JSON response so we cannot
 * use `mode: 'no-cors'` here; Apps Script web apps return permissive
 * CORS headers on GET so cross-origin reads work.
 */
async function checkPriorPrize(fpHash) {
  if (!WEBHOOK_URL || !fpHash) return null;
  if (typeof fetch !== 'function') return null;
  try {
    const url = buildWebhookUrl({ check: 1, fpHash });
    const res = await fetch(url, { method: 'GET', credentials: 'omit' });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.alreadySpun) return null;
    return {
      ticket: data.ticket || '',
      prizeIndex: Number(data.prizeIndex),
      prizeLabel: data.prizeLabel || '',
      prizeTitle: data.prizeTitle || '',
      spunAt: data.spunAt || '',
    };
  } catch (err) {
    return null;
  }
}

/**
 * Fire-and-forget log of a spin attempt. We do not need to read the
 * response (the result is already on screen), so `no-cors` is fine and
 * `keepalive` lets the request survive page navigation.
 */
function reportSpin(payload) {
  const url = buildWebhookUrl(payload);
  if (!url) return;
  if (typeof fetch !== 'function') return;
  try {
    fetch(url, {
      method: 'GET',
      mode: 'no-cors',
      keepalive: true,
      credentials: 'omit',
    }).catch(() => undefined);
  } catch (err) {
    // Ignore — wheel result is already on screen.
  }
}

/**
 * Compute a device fingerprint hash. Combines user-agent, screen size,
 * timezone, language and a small canvas signature. Stable across
 * incognito + cache-clear on the same browser; differs across browsers
 * on the same device (e.g. Insta in-app WebView vs Safari).
 */
async function computeFingerprint() {
  if (typeof window === 'undefined') return '';
  if (typeof crypto === 'undefined' || !crypto.subtle) return '';
  try {
    const screenSize = `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`;
    const tz = (Intl.DateTimeFormat().resolvedOptions().timeZone) || '';
    const lang = navigator.language || '';
    let canvasSignature = '';
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 220;
      canvas.height = 60;
      const ctx = canvas.getContext('2d');
      ctx.textBaseline = 'top';
      ctx.font = '14px "Arial"';
      ctx.fillStyle = '#0F3C3C';
      ctx.fillText('bnb-fp-2026', 2, 2);
      ctx.fillStyle = 'rgba(200,155,74,0.6)';
      ctx.fillRect(0, 20, 220, 20);
      canvasSignature = canvas.toDataURL();
    } catch (err) {
      canvasSignature = '';
    }
    const parts = [navigator.userAgent || '', screenSize, tz, lang, canvasSignature].join('|');
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(parts));
    return Array.from(new Uint8Array(digest))
      .map(function (b) { return b.toString(16).padStart(2, '0'); })
      .join('');
  } catch (err) {
    return '';
  }
}

/**
 * Detect in-app browsers that have their own storage context
 * (Instagram, Facebook, Line, WeChat, Twitter). These can re-spin in
 * Safari because storage and fingerprint differ — the page surfaces a
 * banner asking customers to open the link in their real browser.
 */
function detectInAppBrowser() {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent || '';
  if (/Instagram/i.test(ua)) return 'Instagram';
  if (/FBAN|FBAV|FB_IAB/.test(ua)) return 'Facebook';
  if (/Line\//.test(ua)) return 'LINE';
  if (/MicroMessenger/i.test(ua)) return 'WeChat';
  if (/Twitter/i.test(ua)) return 'Twitter';
  return null;
}

/**
 * Coarse platform detection so the in-app banner can pick a deep-link
 * scheme that the host OS will actually handle.
 */
function detectPlatform() {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'other';
}

// Prize catalogue. `option` is the short label rendered on the wheel slice.
// `title` and `body` populate the result card and the collapsible list.
// Exported so the Offers page can render the same list under the wheel
// without duplicating copy.
export const PRIZES = [
  {
    option: '1 STAMP',
    title: '1 Free stamp on your loyalty card',
    body: 'Show this screen to the counter to redeem the stamp.',
  },
  {
    option: '2 STAMPS',
    title: '2 Free stamps on your loyalty card',
    body: 'Show this screen to the counter to redeem the stamps.',
  },
  {
    option: '3 STAMPS',
    title: '3 Free stamps on your loyalty card',
    body: 'Show this screen to the counter to redeem the stamps.',
  },
  {
    option: 'FREE GOODIE',
    title: 'Free Anniversary Goodie',
    body: 'A free anniversary goodie from the team. Pick yours up at the counter.',
  },
  {
    option: '50% OFF',
    title: '50% off your next visit',
    body: 'Plus 10% extra off when you share our story on socials.',
  },
  {
    option: '10% OFF',
    title: '10% off coupon',
    body: 'Show this screen on your next order to claim the discount.',
  },
  {
    option: 'SODA ₹99',
    title: 'Any Soda at ₹99',
    body: 'Pick any soda on the menu for ₹99. Show this screen at the counter to redeem.',
  },
  {
    option: 'GOODIES',
    title: 'BnB Anniversary Goodies',
    body: 'Limited-edition goodies hand-picked by the team. Collect at the counter.',
  },
];

const WHEEL_DATA = PRIZES.map((prize, index) => ({
  option: prize.option,
  style: {
    backgroundColor: index % 2 === 0 ? BRAND_TEAL : BRAND_AMBER,
    textColor: '#FFFFFF',
  },
}));

function loadSavedPrize() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.prizeIndex !== 'number' ||
      parsed.prizeIndex < 0 ||
      parsed.prizeIndex >= PRIZES.length
    ) {
      return null;
    }
    return parsed;
  } catch (err) {
    return null;
  }
}

function savePrize(prizeIndex, ticket) {
  if (typeof window === 'undefined') return null;
  const payload = {
    ticket,
    prizeIndex,
    prizeLabel: PRIZES[prizeIndex].option,
    prizeTitle: PRIZES[prizeIndex].title,
    spunAt: new Date().toISOString(),
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    // Storage full / disabled — staff can still verify in-store.
  }
  return payload;
}

function pickRandomPrizeIndex() {
  return Math.floor(Math.random() * PRIZES.length);
}

function SpinWheel() {
  // CRA does not server-render, so a lazy initialiser is enough to read
  // localStorage on first mount without flashing the spin button.
  const [savedPrize, setSavedPrize] = useState(() => loadSavedPrize());
  const [mustSpin, setMustSpin] = useState(false);
  const [prizeIndex, setPrizeIndex] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [fpHash, setFpHash] = useState('');
  const [inAppBrowser] = useState(() => detectInAppBrowser());
  const [platform] = useState(() => detectPlatform());
  const [copied, setCopied] = useState(false);
  const modalCloseButtonRef = useRef(null);
  const modalTriggerRef = useRef(null);

  // Compute the device fingerprint once + ask the Sheet whether this
  // device already won. If so, hydrate the saved-prize card so the
  // customer cannot replay by clearing localStorage or opening
  // incognito.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const hash = await computeFingerprint();
      if (cancelled) return;
      setFpHash(hash);
      if (savedPrize || !hash) return;
      const prior = await checkPriorPrize(hash);
      if (cancelled || !prior) return;
      if (prior.prizeIndex >= 0 && prior.prizeIndex < PRIZES.length) {
        savePrize(prior.prizeIndex, prior.ticket);
        setSavedPrize({
          ticket: prior.ticket,
          prizeIndex: prior.prizeIndex,
          prizeLabel: PRIZES[prior.prizeIndex].option,
          prizeTitle: PRIZES[prior.prizeIndex].title,
          spunAt: prior.spunAt || new Date().toISOString(),
        });
      }
    })();
    return () => { cancelled = true; };
  }, [savedPrize]);

  // Dev helper to clear the soft lock during local testing. Only attached
  // in development so production bundles stay clean.
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return undefined;
    if (typeof window === 'undefined') return undefined;
    window.__bnbResetSpin = () => {
      window.localStorage.removeItem(STORAGE_KEY);
      window.location.reload();
    };
    return () => {
      delete window.__bnbResetSpin;
    };
  }, []);

  const handleSpinClick = useCallback(() => {
    if (mustSpin || savedPrize) return;
    setPrizeIndex(pickRandomPrizeIndex());
    setMustSpin(true);
    setShowResult(false);
  }, [mustSpin, savedPrize]);

  const handleStopSpinning = useCallback(() => {
    setMustSpin(false);
    const ticket = generateTicket();
    const payload = savePrize(prizeIndex, ticket) || {
      ticket,
      prizeIndex,
      prizeLabel: PRIZES[prizeIndex].option,
      prizeTitle: PRIZES[prizeIndex].title,
      spunAt: new Date().toISOString(),
    };
    setSavedPrize(payload);
    // Best-effort log to the Google Sheet so staff can cross-check tickets.
    // Includes fpHash so the server can dedupe future spins from this device.
    reportSpin({
      ...payload,
      fpHash,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
      pageHref: typeof window !== 'undefined' ? window.location.href : '',
    });
    setShowResult(true);
  }, [prizeIndex, fpHash]);

  const handleCloseResult = useCallback(() => {
    setShowResult(false);
    // Return focus to the element that triggered the modal so keyboard
    // users do not get parked on the page body.
    if (modalTriggerRef.current) {
      modalTriggerRef.current.focus();
    }
  }, []);

  // Trap focus inside the modal and close it on Escape.
  useEffect(() => {
    if (!showResult) return undefined;
    if (typeof window === 'undefined') return undefined;

    // Move focus to the primary action so screen readers + keyboard users
    // land inside the dialog as soon as it opens.
    const focusTimer = window.setTimeout(() => {
      if (modalCloseButtonRef.current) {
        modalCloseButtonRef.current.focus();
      }
    }, 0);

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleCloseResult();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showResult, handleCloseResult]);

  const activePrize = useMemo(() => {
    if (savedPrize) return PRIZES[savedPrize.prizeIndex];
    return null;
  }, [savedPrize]);

  const pageUrl = typeof window !== 'undefined'
    ? window.location.href
    : '';
  const pageHost = typeof window !== 'undefined' ? window.location.host : '';
  const pagePath = typeof window !== 'undefined' ? window.location.pathname : '';
  const iosDeepLink = pageHost ? `x-safari-https://${pageHost}${pagePath}` : '#';
  const androidDeepLink = pageHost
    ? `intent://${pageHost}${pagePath}#Intent;scheme=https;package=com.android.chrome;end`
    : '#';
  const ctaHref = platform === 'android' ? androidDeepLink : iosDeepLink;
  const ctaLabel = platform === 'android' ? 'Open in Chrome' : 'Open in Safari';
  const androidInstruction = platform === 'android';

  const handleCopyLink = useCallback(async () => {
    if (!pageUrl) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(pageUrl);
      } else {
        const ta = document.createElement('textarea');
        ta.value = pageUrl;
        ta.setAttribute('readonly', '');
        ta.style.position = 'absolute';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch (err) {
      setCopied(false);
    }
  }, [pageUrl]);

  return (
    <div className="spin-wheel-shell">
      {inAppBrowser && !savedPrize && (
        <div className="inapp-banner" role="alert">
          <p className="inapp-banner-title mb-1">
            Open in your browser to play
          </p>
          <p className="inapp-banner-body mb-2">
            You are viewing this inside the {inAppBrowser} app. To keep the one-spin-per-customer rule fair, open the page in your real browser before spinning.
          </p>
          {androidInstruction && (
            <p className="inapp-banner-body inapp-banner-instruction mb-2">
              Tap the <strong>⋮</strong> menu (top-right) → <strong>Open in Chrome</strong>. The button below will try the same thing if your browser allows it.
            </p>
          )}
          <div className="inapp-banner-actions">
            <a className="btn btn-primary btn-sm inapp-banner-cta" href={ctaHref}>
              {ctaLabel}
            </a>
            <button
              type="button"
              className="btn btn-outline-primary btn-sm inapp-banner-copy"
              onClick={handleCopyLink}
            >
              {copied ? 'Copied!' : 'Copy link'}
            </button>
          </div>
        </div>
      )}

      <div className="spin-wheel-stage">
        <Wheel
          mustStartSpinning={mustSpin}
          prizeNumber={prizeIndex}
          data={WHEEL_DATA}
          onStopSpinning={handleStopSpinning}
          backgroundColors={[BRAND_TEAL, BRAND_AMBER]}
          textColors={['#FFFFFF']}
          outerBorderColor={BRAND_TEAL}
          outerBorderWidth={6}
          innerBorderColor="#FFFFFF"
          innerBorderWidth={2}
          radiusLineColor="#FFFFFF"
          radiusLineWidth={2}
          fontFamily="Poppins, sans-serif"
          fontSize={14}
          fontWeight={700}
          textDistance={62}
          spinDuration={0.6}
          pointerProps={{
            style: {
              filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.25))',
            },
          }}
        />
      </div>

      {!savedPrize && (
        <div className="text-center mt-4">
          <button
            ref={modalTriggerRef}
            type="button"
            className="btn btn-primary btn-lg spin-cta"
            onClick={handleSpinClick}
            disabled={mustSpin}
            aria-label="Spin the anniversary wheel"
          >
            {mustSpin ? 'Spinning…' : 'Spin the Wheel'}
          </button>
          <p className="text-muted small mt-3 mb-0">
            One play per customer. Prize is verified by staff at the counter.
          </p>
        </div>
      )}

      {savedPrize && (
        <div className="spin-result-card mt-4 text-center" role="status" aria-live="polite">
          <p className="spin-result-eyebrow mb-2">YOUR PRIZE</p>
          <h3 className="spin-result-title mb-2">{activePrize.title}</h3>
          <p className="text-muted mb-3">{activePrize.body}</p>
          {savedPrize.ticket && (
            <div className="spin-ticket mb-3" aria-label="Claim ticket">
              <span className="spin-ticket-label">CLAIM TICKET</span>
              <span className="spin-ticket-code">{formatTicketShort(savedPrize.ticket)}</span>
            </div>
          )}
          <p className="small mb-0">
            <strong>Show this screen to staff at the counter.</strong>
          </p>
        </div>
      )}

      {showResult && activePrize && (
        <div
          className="spin-result-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="spin-result-headline"
          onClick={handleCloseResult}
        >
          <div className="spin-result-modal" onClick={(e) => e.stopPropagation()}>
            <p className="spin-result-eyebrow mb-2">CONGRATULATIONS</p>
            <h3 id="spin-result-headline" className="spin-result-title mb-2">
              {activePrize.title}
            </h3>
            <p className="text-muted mb-3">{activePrize.body}</p>
            {savedPrize?.ticket && (
              <div className="spin-ticket mb-4" aria-label="Claim ticket">
                <span className="spin-ticket-label">CLAIM TICKET</span>
                <span className="spin-ticket-code">{formatTicketShort(savedPrize.ticket)}</span>
              </div>
            )}
            <p className="small fw-bold mb-4">
              Show this screen to staff at the counter to claim your prize.
            </p>
            <button
              ref={modalCloseButtonRef}
              type="button"
              className="btn btn-primary"
              onClick={handleCloseResult}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/*
 * ---------------------------------------------------------------------------
 * Apps Script setup (one-time, to enable the Google Sheet audit log)
 * ---------------------------------------------------------------------------
 *
 * 1. Create a new Google Sheet (e.g. "BnB Anniversary Spins"). The first
 *    row will be filled with headers automatically on the first spin.
 *
 * 2. Sheet → Extensions → Apps Script. Replace the default file with:
 *
 *      const SHEET_ID = 'PASTE_SHEET_ID_HERE';
 *      const HEADERS = ['ReceivedAt', 'Ticket', 'PrizeIndex', 'PrizeLabel',
 *                       'PrizeTitle', 'SpunAt', 'UserAgent', 'PageHref'];
 *
 *      function doPost(e) {
 *        const sheet = SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
 *        if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);
 *        let body = {};
 *        try { body = JSON.parse(e.postData.contents || '{}'); } catch (_) {}
 *        sheet.appendRow([
 *          new Date(),
 *          body.ticket || '',
 *          body.prizeIndex,
 *          body.prizeLabel || '',
 *          body.prizeTitle || '',
 *          body.spunAt || '',
 *          body.userAgent || '',
 *          body.pageHref || '',
 *        ]);
 *        return ContentService
 *          .createTextOutput(JSON.stringify({ ok: true }))
 *          .setMimeType(ContentService.MimeType.JSON);
 *      }
 *
 * 3. Deploy → New deployment → Type: Web app → Execute as: Me →
 *    Who has access: Anyone. Copy the resulting /exec URL.
 *
 * 4. In the blendnbubbles repo, add to `.env.production` (or `.env`):
 *
 *      REACT_APP_SPIN_WEBHOOK_URL=https://script.google.com/macros/s/.../exec
 *
 *    Then `npm run build && npm run deploy`. The wheel will start
 *    appending one row per spin. Until the env var is set the wheel
 *    works locally but no row is written.
 *
 * Staff verifies a customer by asking for the short ticket on screen
 * (e.g. "A1B2-C3D4") and finding the row in the Sheet — the short code
 * is the first 8 hex chars of the UUID.
 */

export default SpinWheel;
