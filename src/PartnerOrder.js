import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Navbar from './Navbar';
import {
  PARTNER_KINDS,
  ORDER_DRINKS,
  TEMPERATURES,
  TEMPERATURE_LABELS,
  MAX_QUANTITY_PER_LINE,
  findPartner,
  offerFor,
  lineKey,
  clampQuantity,
  orderLines,
  orderSubtotal,
  drinkCount,
  couponSaving,
  amountToPay,
  missingForOrder,
  buildOrderMessage,
  whatsappOrderUrl,
} from './partnerOrderData';
import './App.css';
import './PartnerOrder.css';

const NAME_MAX_LENGTH = 40;
const NOTE_MAX_LENGTH = 140;

// Tracks scroll for the shared Navbar's shadow.
function useScrolled() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  return scrolled;
}

// Loads Bootstrap JS for the mobile navbar, as the other pages do.
function useBootstrapScript() {
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js';
    script.integrity = 'sha384-ka7Sk0Gln4gmtz2MlQnikT1wXgYsOg+OMhuP+IlRH9sENBO0LRn5q+8nbTov4+1p';
    script.crossOrigin = 'anonymous';
    document.body.appendChild(script);
    return () => { if (document.body.contains(script)) document.body.removeChild(script); };
  }, []);
}

/** Minus / count / plus control for one drink at one temperature. */
function QuantityStepper({ label, quantity, onChange }) {
  return (
    <div className="partner-stepper" role="group" aria-label={label}>
      <button
        type="button"
        className="partner-stepper-button"
        onClick={() => onChange(quantity - 1)}
        disabled={quantity === 0}
        aria-label={`Remove one ${label}`}
      >
        −
      </button>
      <span className="partner-stepper-count" aria-live="polite">{quantity}</span>
      <button
        type="button"
        className="partner-stepper-button"
        onClick={() => onChange(quantity + 1)}
        disabled={quantity >= MAX_QUANTITY_PER_LINE}
        aria-label={`Add one ${label}`}
      >
        +
      </button>
    </div>
  );
}

/** One drink card: photo, blurb, and a stepper per temperature it is sold at. */
function DrinkCard({ drink, quantities, onQuantityChange }) {
  return (
    <li className="partner-drink">
      <img className="partner-drink-photo" src={drink.photo} alt="" loading="lazy" width="88" height="110" />
      <div className="partner-drink-body">
        <h3 className="partner-drink-name">{drink.name}</h3>
        <p className="partner-drink-desc">{drink.desc}</p>
        {TEMPERATURES.filter((temperature) => drink[temperature] != null).map((temperature) => {
          const label = `${drink.name} ${TEMPERATURE_LABELS[temperature].toLowerCase()}`;
          return (
            <div className="partner-drink-option" key={temperature}>
              <span className="partner-drink-price">
                {TEMPERATURE_LABELS[temperature]} <strong>₹{drink[temperature]}</strong>
              </span>
              <QuantityStepper
                label={label}
                quantity={quantities[lineKey(drink.name, temperature)] ?? 0}
                onChange={(quantity) => onQuantityChange(drink.name, temperature, quantity)}
              />
            </div>
          );
        })}
      </div>
    </li>
  );
}

/** The bill: menu total, the coupon line, and the amount to pay. */
function Bill({ offer, subtotal, saving, total }) {
  const shortfall = offer.minimumBill - subtotal;
  return (
    <section className="partner-bill" aria-labelledby="partner-bill-heading">
      <h2 id="partner-bill-heading" className="partner-section-title">Your bill</h2>
      <dl className="partner-bill-rows">
        <div className="partner-bill-row">
          <dt>Menu total</dt>
          <dd>₹{subtotal}</dd>
        </div>
        {saving > 0 ? (
          <div className="partner-bill-row partner-bill-saving">
            <dt>Coupon {offer.code} ({offer.percentOff}% off)</dt>
            <dd>-₹{saving}</dd>
          </div>
        ) : null}
        <div className="partner-bill-row partner-bill-total">
          <dt>You pay</dt>
          <dd data-testid="partner-amount-to-pay">₹{total}</dd>
        </div>
      </dl>
      {subtotal > 0 && shortfall > 0 ? (
        <p className="partner-bill-hint">
          Add ₹{shortfall} more to get {offer.percentOff}% off.
        </p>
      ) : null}
      <p className="partner-bill-footnote">Prices include GST. We confirm your order on WhatsApp before we make it.</p>
    </section>
  );
}

/** The order page for one partner venue. */
function PartnerOrderPage({ partner }) {
  const scrolled = useScrolled();
  useBootstrapScript();
  const offer = useMemo(() => offerFor(partner), [partner]);
  const copy = PARTNER_KINDS[partner.kind];
  const [quantities, setQuantities] = useState({});
  const [customerName, setCustomerName] = useState('');
  const [note, setNote] = useState('');

  // Per-route SEO
  useEffect(() => {
    document.title = `${partner.name} x BlendNBubbles | ${offer.percentOff}% Off Bubble Tea`;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', `${partner.name} clients get ${offer.percentOff}% off BlendNBubbles bubble tea on bills of ₹${offer.minimumBill} and above with code ${offer.code}. Pick your drinks and send the order on WhatsApp.`);
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute('href', `https://blendnbubbles.com/p/${partner.slug}`);
  }, [partner, offer]);

  const handleQuantityChange = useCallback((name, temperature, quantity) => {
    setQuantities((current) => ({ ...current, [lineKey(name, temperature)]: clampQuantity(quantity) }));
  }, []);

  const lines = useMemo(() => orderLines(quantities, ORDER_DRINKS), [quantities]);
  const subtotal = orderSubtotal(lines);
  const saving = couponSaving(subtotal, offer);
  const total = amountToPay(subtotal, offer);
  const count = drinkCount(lines);
  const missing = missingForOrder({ lines, customerName });
  const orderUrl = missing
    ? null
    : whatsappOrderUrl(buildOrderMessage({ lines, customerName, note }, offer), offer);

  return (
    <div className="PartnerOrder">
      <Navbar scrolled={scrolled} />
      <main className="partner-order-page">
        <div className="container partner-order-container">
          <header className="partner-hero">
            <p className="partner-eyebrow">For {partner.name} clients</p>
            <h1 className="partner-title">{copy.title} <span>{copy.titleAccent}</span></h1>
            <p className="partner-lede">{copy.lede}</p>
            <div className="partner-coupon">
              <strong>{offer.percentOff}% off</strong> on bills of ₹{offer.minimumBill} and above
              <span className="partner-coupon-code">Code {offer.code}</span>
              <span className="partner-coupon-validity">Till {offer.validUntil}</span>
            </div>
          </header>

          <section aria-labelledby="partner-drinks-heading">
            <h2 id="partner-drinks-heading" className="partner-section-title">1. Pick your drinks</h2>
            <p className="partner-section-lede">
              Our 10 best sellers. Want something else? See the <Link to="/menu">full menu</Link> and add it in the note.
            </p>
            <ul className="partner-drinks">
              {ORDER_DRINKS.map((drink) => (
                <DrinkCard
                  key={drink.name}
                  drink={drink}
                  quantities={quantities}
                  onQuantityChange={handleQuantityChange}
                />
              ))}
            </ul>
          </section>

          <section aria-labelledby="partner-details-heading">
            <h2 id="partner-details-heading" className="partner-section-title">2. Your details</h2>
            <div className="partner-fields">
              <label className="partner-field">
                <span>Your name</span>
                <input
                  type="text"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  maxLength={NAME_MAX_LENGTH}
                  autoComplete="name"
                />
              </label>
              <label className="partner-field">
                <span>Note (optional)</span>
                <input
                  type="text"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  maxLength={NOTE_MAX_LENGTH}
                  placeholder="Less ice, less sugar, another drink"
                />
              </label>
            </div>
          </section>

          <Bill offer={offer} subtotal={subtotal} saving={saving} total={total} />
        </div>

        <div className="partner-order-bar">
          <div className="container partner-order-bar-inner">
            <div className="partner-order-summary" aria-live="polite">
              {count === 0 ? 'No drinks yet' : `${count} ${count === 1 ? 'drink' : 'drinks'} · You pay ₹${total}`}
            </div>
            {orderUrl ? (
              <a className="partner-send partner-send-ready" href={orderUrl} target="_blank" rel="noopener noreferrer">
                Send order on WhatsApp
              </a>
            ) : (
              <button type="button" className="partner-send" disabled>
                {missing}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

/** Shown for a mistyped or retired partner link, so the visitor still reaches the menu. */
function PartnerNotFound() {
  const scrolled = useScrolled();
  useBootstrapScript();

  // Without this the dead link is served under the homepage title and the
  // homepage canonical, so a retired partner URL looks like the front page to
  // a search engine and to anyone reading the tab.
  useEffect(() => {
    document.title = 'Offer link not active - BlendNBubbles';
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute('href', 'https://blendnbubbles.com/menu');
  }, []);

  return (
    <div className="PartnerOrder">
      <Navbar scrolled={scrolled} />
      <main className="partner-order-page">
        <div className="container partner-order-container">
          <h1 className="partner-title">This offer link isn't active</h1>
          <p className="partner-lede">
            You can still see everything we make on the <Link to="/menu">full menu</Link>.
          </p>
        </div>
      </main>
    </div>
  );
}

/** Route component for /p/:slug. */
function PartnerOrder() {
  const { slug } = useParams();
  const partner = findPartner(slug);
  return partner ? <PartnerOrderPage key={partner.slug} partner={partner} /> : <PartnerNotFound />;
}

export default PartnerOrder;
