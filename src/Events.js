import React, { useEffect, useMemo, useState } from 'react';
import './App.css';
import './Events.css';
import Navbar from './Navbar';
import { isEventsEnabled, submitEventRequest } from './eventsClient';

import {
  BOOKING_OPTIONS,
  OCCASIONS,
  PACKAGES,
  TRUST_MARKERS,
} from './corporateData';
import { CATERING_OCCASIONS, CATERING_PACKAGES, CATERING_STEPS } from './cateringData';

export const EVENT_TYPES = [
  'Birthday party',
  'Corporate / office event',
  'College fest',
  'Wedding / reception',
  'Brand collab / pop-up',
  'Other',
];

export const GUEST_BANDS = ['Under 25', '25 – 50', '50 – 100', '100 – 250', '250+'];

export const EVENT_TABS = [
  { id: 'celebrations', label: 'Celebrations', sub: 'Birthdays, weddings, fests' },
  { id: 'corporate', label: 'Corporate & campus', sub: 'Offices, tech parks, colleges' },
];

const EMPTY_FORM = {
  name: '',
  org: '',
  email: '',
  phone: '',
  social: '',
  eventType: '',
  eventDate: '',
  guests: '',
  message: '',
  brochure: '',
  hp: '',
};

const REQUIRED_LABELS = {
  name: 'Please tell us your name.',
  email: 'Please add an email so we can reply.',
  phone: 'Please add a phone number.',
  eventType: 'Please pick an event type.',
  eventDate: 'Please pick a date.',
  guests: 'Please pick a guest count.',
};

/** Today's date as a local-timezone YYYY-MM-DD string. */
function localTodayIso() {
  const now = new Date();
  const tzAdjusted = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return tzAdjusted.toISOString().slice(0, 10);
}

/** Light format checks on top of the required checks. */
function validate(form) {
  const errors = {};
  Object.keys(REQUIRED_LABELS).forEach((key) => {
    if (!form[key].trim()) errors[key] = REQUIRED_LABELS[key];
  });
  if (!errors.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    errors.email = 'That email does not look right.';
  }
  if (!errors.phone && form.phone.replace(/\D/g, '').length < 8) {
    errors.phone = 'That phone number looks too short.';
  }
  // YYYY-MM-DD strings compare correctly as plain strings.
  if (!errors.eventDate && form.eventDate < localTodayIso()) {
    errors.eventDate = 'Please pick an upcoming date.';
  }
  if (!errors.brochure && form.brochure.trim() && !/^https?:\/\//i.test(form.brochure.trim())) {
    errors.brochure = 'Links should start with http:// or https://';
  }
  return errors;
}

function Events() {
  const [scrolled, setScrolled] = useState(false);
  const [activeTab, setActiveTab] = useState('celebrations');
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  // idle | submitting | success | error | disabled
  const [status, setStatus] = useState('idle');

  const todayIso = useMemo(() => localTodayIso(), []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Per-route SEO
  useEffect(() => {
    document.title = 'Event Requests - BlendNBubbles | Bubble Tea for Your Big Day';
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', 'Book BlendNBubbles for birthdays, college fests, weddings and corporate events in Kolkata. Live bubble tea counters and bulk orders — tell us about your event.');
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute('href', 'https://blendnbubbles.com/events');
  }, []);

  // Bootstrap JS for the mobile navbar toggle
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/js/bootstrap.bundle.min.js';
    script.integrity = 'sha384-ka7Sk0Gln4gmtz2MlQnikT1wXgYsOg+OMhuP+IlRH9sENBO0LRn5q+8nbTov4+1p';
    script.crossOrigin = 'anonymous';
    document.body.appendChild(script);
    return () => { if (document.body.contains(script)) document.body.removeChild(script); };
  }, []);

  // Roving tabindex: left/right move between tabs, home/end jump to the ends.
  // Matches the WAI-ARIA tabs pattern so keyboard users are not trapped.
  const handleTabKeyDown = (event) => {
    const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    event.preventDefault();

    const index = EVENT_TABS.findIndex((tab) => tab.id === activeTab);
    let nextIndex = index;
    if (event.key === 'ArrowLeft') nextIndex = (index - 1 + EVENT_TABS.length) % EVENT_TABS.length;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % EVENT_TABS.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = EVENT_TABS.length - 1;

    const nextTab = EVENT_TABS[nextIndex];
    setActiveTab(nextTab.id);
    const nextEl = document.getElementById(`tab-${nextTab.id}`);
    if (nextEl) nextEl.focus();
  };

  const setField = (key) => (event) => {
    const value = event.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const errors = validate(form);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      // A banner from an earlier failed attempt would sit above fresh field
      // errors and say two conflicting things — clear it.
      setStatus((prev) => (prev === 'error' || prev === 'disabled' ? 'idle' : prev));
      const firstKey = Object.keys(errors)[0];
      const el = document.getElementById(`ev-${firstKey}`);
      if (el) el.focus();
      return;
    }

    if (!isEventsEnabled()) {
      setStatus('disabled');
      return;
    }

    setStatus('submitting');
    const result = await submitEventRequest(form);
    if (result.status === 'sent') {
      setStatus('success');
      window.scrollTo(0, 0);
    } else if (result.status === 'disabled') {
      setStatus('disabled');
    } else {
      setStatus('error');
    }
  };

  const submitting = status === 'submitting';

  const fieldProps = (key) => ({
    id: `ev-${key}`,
    value: form[key],
    onChange: setField(key),
    'aria-invalid': fieldErrors[key] ? 'true' : undefined,
    'aria-describedby': fieldErrors[key] ? `ev-${key}-error` : undefined,
    disabled: submitting,
  });

  const fieldError = (key) => (
    fieldErrors[key]
      ? <p className="events-field-error" id={`ev-${key}-error`} role="alert">{fieldErrors[key]}</p>
      : null
  );

  return (
    <div className="events-page">
      <Navbar scrolled={scrolled} />

      <main>
        <header className="hero" id="events-hero">
          <div className="hero-content">
            <div className="container">
              <div className="row align-items-center">
                <div className="col-lg-7 hero-text-container">
                  <p className="hero-subtitle">Planning something special?</p>
                  <h1 className="hero-title">Bubble tea for your big day</h1>
                  <p className="hero-text">
                    Birthdays, office parties, college fests, weddings — we bring authentic
                    Taiwanese bubble tea to your event, or host you at our Barrackpore store.
                  </p>
                </div>
                <div className="col-lg-5">
                  <div className="hero-image">
                    <img src="/logo.svg" alt="BlendNBubbles Logo" className="floating logo-hero" />
                    <div className="hero-bubbles">
                      <span className="bubble"></span>
                      <span className="bubble"></span>
                      <span className="bubble"></span>
                      <span className="bubble"></span>
                      <span className="bubble"></span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        <div className="container">
          <div className="events-tabs">
            <div className="events-tablist" role="tablist" aria-label="Types of event">
              {EVENT_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  id={`tab-${tab.id}`}
                  aria-selected={activeTab === tab.id}
                  aria-controls={`panel-${tab.id}`}
                  tabIndex={activeTab === tab.id ? 0 : -1}
                  className={`events-tab${activeTab === tab.id ? ' is-active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                  onKeyDown={handleTabKeyDown}
                >
                  <span className="events-tab-label">{tab.label}</span>
                  <span className="events-tab-sub">{tab.sub}</span>
                </button>
              ))}
            </div>
          </div>

          <div
            role="tabpanel"
            id="panel-celebrations"
            aria-labelledby="tab-celebrations"
            hidden={activeTab !== 'celebrations'}
            tabIndex={0}
            className="events-panel"
          >
            <h2 className="events-panel-title">Parties, weddings and fests</h2>
            <p className="events-panel-lede">
              A live boba counter at your venue, shaken to order in front of your guests.
              Ingredients imported from Taiwan.
            </p>
            <ul className="corporate-occasions">
              {CATERING_OCCASIONS.map((occasion) => (
                <li key={occasion}>{occasion}</li>
              ))}
            </ul>

            <div className="catering-packages">
              {CATERING_PACKAGES.map((pack) => (
                <article
                  key={pack.id}
                  className={`catering-package${pack.popular ? ' is-popular' : ''}`}
                >
                  {pack.popular ? <p className="catering-package-flag">Most booked</p> : null}
                  <p className="catering-package-guests">{pack.guests}</p>
                  <h3>{pack.name}</h3>
                  <p className="catering-package-cups">
                    <span>{pack.cups}</span> {pack.unit}
                  </p>
                  <ul>
                    {pack.includes.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                  <p className="catering-package-fits">{pack.fits}</p>
                </article>
              ))}
            </div>
            <p className="corporate-packages-note">Set-up and clean-up included.</p>
          </div>

          <div
            role="tabpanel"
            id="panel-corporate"
            aria-labelledby="tab-corporate"
            hidden={activeTab !== 'corporate'}
            tabIndex={0}
            className="events-panel"
          >
            <h2 className="events-panel-title">Your event, our bubble tea bar</h2>
            <p className="events-panel-lede">
              We bring a live Taiwanese bubble tea counter to your office, campus or tech park.
              Brewed fresh on site, cup by cup, while your people watch. Serving events across
              Kolkata.
            </p>
            <ul className="corporate-occasions">
              {OCCASIONS.map((occasion) => (
                <li key={occasion}>{occasion}</li>
              ))}
            </ul>

            <div className="corporate-options">
              {BOOKING_OPTIONS.map((option) => (
                <article
                  key={option.id}
                  className={`corporate-option${option.highlight ? ' is-highlighted' : ''}`}
                >
                  <p className="corporate-option-tag">{option.tag}</p>
                  <h3>{option.name}</h3>
                  <p className="corporate-option-cost">{option.cost}</p>
                  <p className="corporate-option-body">{option.body}</p>
                  <p className="corporate-option-note">{option.note}</p>
                </article>
              ))}
            </div>

            <div className="corporate-packages">
              <h3>Pick your headcount</h3>
              <ul>
                {PACKAGES.map((pack) => (
                  <li key={pack.id}>
                    <span className="corporate-pack-cups">{pack.cups}</span>
                    <span className="corporate-pack-unit">{pack.unit}</span>
                    <span className="corporate-pack-fits">{pack.fits}</span>
                    <span className="corporate-pack-detail">{pack.detail}</span>
                  </li>
                ))}
              </ul>
              <p className="corporate-packages-note">Set-up and clean-up included.</p>
            </div>

            <ul className="corporate-trust">
              {TRUST_MARKERS.map((marker) => (
                <li key={marker.id}>
                  <strong>{marker.label}</strong> <span>{marker.detail}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="events-grid">

            <aside className="events-pitch">
              <span className="offer-tag">Event Requests</span>
              <h2>How it works</h2>
              <p className="events-pitch-lede">
                Tell us the occasion — we&apos;ll take care of the bubbles. Live boba counters,
                bulk orders and in-store parties, with ingredients imported from Taiwan.
              </p>

              {CATERING_STEPS.map((step, index) => (
                <div className="events-step" key={step.id}>
                  <div className="events-step-num" aria-hidden="true">{index + 1}</div>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.body}</p>
                  </div>
                </div>
              ))}

              <div className="events-direct-card">
                <strong>Prefer to talk?</strong>
                Call <a href="tel:+919330697501">+91 93306 97501</a> or write to{' '}
                <a href="mailto:blendnbubbles@gmail.com">blendnbubbles@gmail.com</a>
              </div>
            </aside>

            <div className="events-form-card">
              {status === 'success' ? (
                <div className="events-success">
                  <div className="events-success-icon" aria-hidden="true">✓</div>
                  <h2>Request received!</h2>
                  <p>
                    Thanks{form.name ? `, ${form.name.split(' ')[0]}` : ''} — we&apos;ve got your
                    request{form.eventDate ? ` for ${form.eventDate}` : ''}.
                  </p>
                  <p>We&apos;ll reply on phone or email within 24 hours with a menu and quote.</p>
                </div>
              ) : (
                <>
                  <h2>Request an event</h2>
                  <p className="events-form-lede">Fields marked * are required. We reply to every request.</p>

                  {status === 'error' && (
                    <div className="events-error-banner" role="alert">
                      <strong>We couldn&apos;t send your request.</strong>
                      Please try again in a minute — or reach us directly at{' '}
                      <a href="tel:+919330697501">+91 93306 97501</a> /{' '}
                      <a href="mailto:blendnbubbles@gmail.com">blendnbubbles@gmail.com</a>.
                      Your details are still filled in below.
                    </div>
                  )}
                  {status === 'disabled' && (
                    <div className="events-error-banner" role="alert">
                      <strong>The online form isn&apos;t live just yet.</strong>
                      Please email{' '}
                      <a href="mailto:blendnbubbles@gmail.com">blendnbubbles@gmail.com</a> or call{' '}
                      <a href="tel:+919330697501">+91 93306 97501</a> and we&apos;ll sort your event out.
                    </div>
                  )}

                  <form onSubmit={handleSubmit} noValidate>
                    <div className="events-frow">
                      <div className="events-fgroup">
                        <label htmlFor="ev-name">Name *</label>
                        <input type="text" placeholder="Ananya Sen" autoComplete="name" maxLength={120} {...fieldProps('name')} />
                        {fieldError('name')}
                      </div>
                      <div className="events-fgroup">
                        <label htmlFor="ev-org">Brand / Organisation <span className="events-opt">(optional)</span></label>
                        <input type="text" placeholder="St. Xavier's College" autoComplete="organization" maxLength={160} {...fieldProps('org')} />
                      </div>
                    </div>

                    <div className="events-frow">
                      <div className="events-fgroup">
                        <label htmlFor="ev-email">Email *</label>
                        <input type="email" placeholder="you@example.com" autoComplete="email" maxLength={200} {...fieldProps('email')} />
                        {fieldError('email')}
                      </div>
                      <div className="events-fgroup">
                        <label htmlFor="ev-phone">Phone number *</label>
                        <input type="tel" placeholder="+91 98xxx xxxxx" autoComplete="tel" maxLength={40} {...fieldProps('phone')} />
                        {fieldError('phone')}
                      </div>
                    </div>

                    <div className="events-frow">
                      <div className="events-fgroup">
                        <label htmlFor="ev-social">Social media handle <span className="events-opt">(optional)</span></label>
                        <input type="text" placeholder="@yourhandle" maxLength={80} {...fieldProps('social')} />
                      </div>
                      <div className="events-fgroup">
                        <label htmlFor="ev-eventType">Event type *</label>
                        <select {...fieldProps('eventType')}>
                          <option value="">Select…</option>
                          {EVENT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                        </select>
                        {fieldError('eventType')}
                      </div>
                    </div>

                    <div className="events-frow">
                      <div className="events-fgroup">
                        <label htmlFor="ev-eventDate">Event date *</label>
                        <input type="date" min={todayIso} {...fieldProps('eventDate')} />
                        {fieldError('eventDate')}
                      </div>
                      <div className="events-fgroup">
                        <label htmlFor="ev-guests">Approx. guests *</label>
                        <select {...fieldProps('guests')}>
                          <option value="">Select…</option>
                          {GUEST_BANDS.map((band) => <option key={band} value={band}>{band}</option>)}
                        </select>
                        {fieldError('guests')}
                      </div>
                    </div>

                    <div className="events-fgroup">
                      <label htmlFor="ev-message">Tell us more <span className="events-opt">(optional)</span></label>
                      <textarea rows="3" maxLength={2000} placeholder="Venue, timings, theme, favourite flavours — anything that helps us plan." {...fieldProps('message')} />
                    </div>

                    <div className="events-fgroup">
                      <label htmlFor="ev-brochure">Link to brochure / deck <span className="events-opt">(optional — Google Drive, Canva, etc.)</span></label>
                      <input type="url" placeholder="https://" maxLength={300} {...fieldProps('brochure')} />
                      {fieldError('brochure')}
                    </div>

                    {/* Honeypot — humans never see it, bots fill it. */}
                    <div className="events-hp" aria-hidden="true">
                      <label htmlFor="ev-hp">Leave this field empty</label>
                      <input
                        type="text"
                        id="ev-hp"
                        name="website"
                        tabIndex={-1}
                        autoComplete="off"
                        value={form.hp}
                        onChange={setField('hp')}
                      />
                    </div>

                    <button type="submit" className="events-submit" disabled={submitting}>
                      {submitting ? (
                        <><span className="events-spinner" aria-hidden="true"></span>Sending your request…</>
                      ) : 'Send event request'}
                    </button>
                    <p className="events-privacy-note">
                      We only use these details to reply about your event. No spam, promise.
                    </p>
                  </form>
                </>
              )}
              <span className="sr-only" role="status" aria-live="polite">
                {status === 'submitting' ? 'Sending your request' : ''}
                {status === 'success' ? 'Request sent successfully' : ''}
                {status === 'error' ? 'Request failed to send' : ''}
              </span>
            </div>

          </div>
        </div>

      </main>

      <footer className="bg-dark text-white py-4">
        <div className="container text-center">
          <p>© 2025-2026 BlendNBubbles. All rights reserved.</p>
          <p>Premium Bubble Tea in Kolkata, India</p>
          <div className="social-links mt-3">
            <a href="https://www.facebook.com/share/168pyB8Bbb/?mibextid=wwXIfr" className="text-white me-3" target="_blank" rel="noopener noreferrer">
              <i className="bi bi-facebook"></i> Facebook
            </a>
            <a href="https://www.instagram.com/blendnbubbles?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw==" className="text-white me-3" target="_blank" rel="noopener noreferrer">
              <i className="bi bi-instagram"></i> Instagram
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Events;
