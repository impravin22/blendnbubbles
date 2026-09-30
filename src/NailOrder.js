import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from './Navbar';
import {
  NAIL_OFFER,
  NAIL_DRINKS,
  TEMPERATURES,
  TEMPERATURE_LABELS,
  MAX_QUANTITY_PER_LINE,
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
} from './nailOrderData';
import './App.css';
import './NailOrder.css';

const NAME_MAX_LENGTH = 40;
const NOTE_MAX_LENGTH = 140;

/** Minus / count / plus control for one drink at one temperature. */
function QuantityStepper({ label, quantity, onChange }) {
  return (
    <div className="nail-stepper" role="group" aria-label={label}>
      <button
        type="button"
        className="nail-stepper-button"
        onClick={() => onChange(quantity - 1)}
        disabled={quantity === 0}
        aria-label={`Remove one ${label}`}
      >
        −
      </button>
      <span className="nail-stepper-count" aria-live="polite">{quantity}</span>
      <button
        type="button"
        className="nail-stepper-button"
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
    <li className="nail-drink">
      <img className="nail-drink-photo" src={drink.photo} alt="" loading="lazy" width="88" height="110" />
      <div className="nail-drink-body">
        <h3 className="nail-drink-name">{drink.name}</h3>
        <p className="nail-drink-desc">{drink.desc}</p>
        {TEMPERATURES.filter((temperature) => drink[temperature] != null).map((temperature) => {
          const label = `${drink.name} ${TEMPERATURE_LABELS[temperature].toLowerCase()}`;
          return (
            <div className="nail-drink-option" key={temperature}>
              <span className="nail-drink-price">
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
function Bill({ subtotal, saving, total }) {
  const shortfall = NAIL_OFFER.minimumBill - subtotal;
  return (
    <section className="nail-bill" aria-labelledby="nail-bill-heading">
      <h2 id="nail-bill-heading" className="nail-section-title">Your bill</h2>
      <dl className="nail-bill-rows">
        <div className="nail-bill-row">
          <dt>Menu total</dt>
          <dd>₹{subtotal}</dd>
        </div>
        {saving > 0 ? (
          <div className="nail-bill-row nail-bill-saving">
            <dt>Coupon {NAIL_OFFER.code} ({NAIL_OFFER.percentOff}% off)</dt>
            <dd>-₹{saving}</dd>
          </div>
        ) : null}
        <div className="nail-bill-row nail-bill-total">
          <dt>You pay</dt>
          <dd data-testid="nail-amount-to-pay">₹{total}</dd>
        </div>
      </dl>
      {subtotal > 0 && shortfall > 0 ? (
        <p className="nail-bill-hint">
          Add ₹{shortfall} more to get {NAIL_OFFER.percentOff}% off.
        </p>
      ) : null}
      <p className="nail-bill-footnote">Prices include GST. We confirm your order on WhatsApp before we make it.</p>
    </section>
  );
}

function NailOrder() {
  const [scrolled, setScrolled] = useState(false);
  const [quantities, setQuantities] = useState({});
  const [customerName, setCustomerName] = useState('');
  const [studioName, setStudioName] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Per-route SEO
  useEffect(() => {
    document.title = 'Nail Studio Offer - BlendNBubbles | 15% Off, Order on WhatsApp';
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', `Nail studio clients get ${NAIL_OFFER.percentOff}% off BlendNBubbles bubble tea on bills of ₹${NAIL_OFFER.minimumBill} and above. Pick your drinks and send the order on WhatsApp.`);
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute('href', 'https://blendnbubbles.com/nail');
  }, []);

  // Bootstrap JS for mobile navbar
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js';
    script.integrity = 'sha384-ka7Sk0Gln4gmtz2MlQnikT1wXgYsOg+OMhuP+IlRH9sENBO0LRn5q+8nbTov4+1p';
    script.crossOrigin = 'anonymous';
    document.body.appendChild(script);
    return () => { if (document.body.contains(script)) document.body.removeChild(script); };
  }, []);

  const handleQuantityChange = useCallback((name, temperature, quantity) => {
    setQuantities((current) => ({ ...current, [lineKey(name, temperature)]: clampQuantity(quantity) }));
  }, []);

  const lines = useMemo(() => orderLines(quantities, NAIL_DRINKS), [quantities]);
  const subtotal = orderSubtotal(lines);
  const saving = couponSaving(subtotal);
  const total = amountToPay(subtotal);
  const count = drinkCount(lines);
  const missing = missingForOrder({ lines, customerName, studioName });
  const orderUrl = missing
    ? null
    : whatsappOrderUrl(buildOrderMessage({ lines, customerName, studioName, note }));

  return (
    <div className="NailOrder">
      <Navbar scrolled={scrolled} />
      <main className="nail-order-page">
        <div className="container nail-order-container">
          <header className="nail-hero">
            <p className="nail-eyebrow">For nail studio clients</p>
            <h1 className="nail-title">Fresh set? <span>Fresh sip.</span></h1>
            <div className="nail-coupon">
              <strong>{NAIL_OFFER.percentOff}% off</strong> on bills of ₹{NAIL_OFFER.minimumBill} and above
              <span className="nail-coupon-code">Code {NAIL_OFFER.code}</span>
              <span className="nail-coupon-validity">Till {NAIL_OFFER.validUntil}</span>
            </div>
          </header>

          <section aria-labelledby="nail-drinks-heading">
            <h2 id="nail-drinks-heading" className="nail-section-title">1. Pick your drinks</h2>
            <p className="nail-section-lede">
              Our 10 best sellers. Want something else? See the <Link to="/menu">full menu</Link> and add it in the note.
            </p>
            <ul className="nail-drinks">
              {NAIL_DRINKS.map((drink) => (
                <DrinkCard
                  key={drink.name}
                  drink={drink}
                  quantities={quantities}
                  onQuantityChange={handleQuantityChange}
                />
              ))}
            </ul>
          </section>

          <section aria-labelledby="nail-details-heading">
            <h2 id="nail-details-heading" className="nail-section-title">2. Your details</h2>
            <div className="nail-fields">
              <label className="nail-field">
                <span>Your name</span>
                <input
                  type="text"
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  maxLength={NAME_MAX_LENGTH}
                  autoComplete="name"
                />
              </label>
              <label className="nail-field">
                <span>Nail studio</span>
                <input
                  type="text"
                  value={studioName}
                  onChange={(event) => setStudioName(event.target.value)}
                  maxLength={NAME_MAX_LENGTH}
                  autoComplete="off"
                />
              </label>
              <label className="nail-field nail-field-wide">
                <span>Note (optional)</span>
                <input
                  type="text"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  maxLength={NOTE_MAX_LENGTH}
                  placeholder="Less ice, less sugar, an extra drink from the menu"
                />
              </label>
            </div>
          </section>

          <Bill subtotal={subtotal} saving={saving} total={total} />
        </div>

        <div className="nail-order-bar">
          <div className="container nail-order-bar-inner">
            <div className="nail-order-summary" aria-live="polite">
              {count === 0 ? 'No drinks yet' : `${count} ${count === 1 ? 'drink' : 'drinks'} · You pay ₹${total}`}
            </div>
            {orderUrl ? (
              <a className="nail-send nail-send-ready" href={orderUrl} target="_blank" rel="noopener noreferrer">
                Send order on WhatsApp
              </a>
            ) : (
              <button type="button" className="nail-send" disabled>
                {missing}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default NailOrder;
