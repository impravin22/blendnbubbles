import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PLATFORM_OFFERS, COMBOS, IN_STORE_OFFER, countOffers } from './offersData';
import './App.css';
// SpinWheel is no longer mounted: the anniversary campaign closed in
// August 2026 and the wheel came down with it. The component is left on
// disk so a future campaign is a one-line revert; nothing imports it, so
// it is not bundled. Spin history stays in the campaign spreadsheet fed
// by scripts/apps-script-spins.

function Offers() {
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleVisitUsClick = (e) => {
    e.preventDefault();
    navigate('/#contact');
  };

  // Scroll reveal
  useEffect(() => {
    const els = document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale');
    if (els.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); } }),
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  });

  // Per-route SEO
  useEffect(() => {
    document.title = 'Exclusive Offers - BlendNBubbles | Tap. Sip. Win.';
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', 'Live Zomato and Swiggy offers from BlendNBubbles Barrackpore: Buy 1 Get 1 on Fruit Teas, first-order discounts, free nachos and combo deals. Same boba, smaller bill.');
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.setAttribute('href', 'https://blendnbubbles.com/offers');
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

  return (
    <div className="Offers">
      {/* Navigation */}
      <nav className={`navbar navbar-expand-lg fixed-top ${scrolled ? 'scrolled' : ''}`}>
        <div className="container">
          <Link className="navbar-brand" to="/">
            <img src="/logo.svg" alt="BlendNBubbles Logo" height="50" />
            <span className="ms-2">BlendNBubbles</span>
          </Link>
          <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
            <span className="navbar-toggler-icon"></span>
          </button>
          <div className="collapse navbar-collapse" id="navbarNav">
            <ul className="navbar-nav ms-auto">
              <li className="nav-item">
                <Link className="nav-link" to="/">Home</Link>
              </li>
              <li className="nav-item">
                <Link className="nav-link" to="/menu">Menu</Link>
              </li>
              <li className="nav-item">
                <Link className="nav-link" to="/story">Our Story</Link>
              </li>
              <li className="nav-item">
                <Link className="nav-link active" to="/offers">Offers</Link>
              </li>
              <li className="nav-item">
                <Link className="nav-link" to="/events">Events</Link>
              </li>
              <li className="nav-item">
                <a className="nav-link" href="/#contact" onClick={handleVisitUsClick}>Visit Us</a>
              </li>
              <li className="nav-item ms-lg-2">
                <a className="nav-link btn-order" href="https://www.zomato.com/kolkata/blend-n-bubbles-barrackpore/order" target="_blank" rel="noopener noreferrer">Order Now</a>
              </li>
            </ul>
          </div>
        </div>
      </nav>

      <main>

      {/* Hero */}
      <header className="hero" id="offers-hero">
        <div className="hero-content">
          <div className="container">
            <div className="row align-items-center">
              <div className="col-lg-7 hero-text-container">
                <p className="hero-subtitle">Tap. Sip. Win.</p>
                <h1 className="hero-title">Offers &amp; happenings</h1>
                <p className="hero-text">
                  {countOffers()} live deals running right now on Zomato and Swiggy. Same boba,
                  smaller bill.
                </p>
                <div className="hero-buttons">
                  <a href="#current-offers" className="btn btn-primary">See what&apos;s on</a>
                  <a href="/#contact" onClick={handleVisitUsClick} className="btn btn-outline">Visit Us</a>
                </div>
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

      {/* Live delivery-platform offers */}
      <section className="py-5" id="current-offers">
        <div className="container">
          <div className="section-header reveal">
            <h2 className="section-title">Live on both apps</h2>
            <p className="section-subtitle">
              Tap a card to open our store and order. Offers are set by us and can change,
              so the app always shows what is live right now.
            </p>
          </div>

          <div className="platform-offers">
            {PLATFORM_OFFERS.map((platform) => (
              <article key={platform.id} className={`platform-card platform-${platform.id} reveal`}>
                <header className="platform-card-head">
                  <h3>{platform.name}</h3>
                  <p>{platform.note}</p>
                </header>

                <ul className="platform-offer-list">
                  {platform.offers.map((offer) => (
                    <li key={offer.id} className="platform-offer">
                      <p className="platform-offer-top">
                        <span className="platform-offer-headline">{offer.headline}</span>
                        {offer.cap ? <span className="platform-offer-cap">{offer.cap}</span> : null}
                        {offer.isNew ? <span className="platform-offer-new">New</span> : null}
                      </p>
                      <p className="platform-offer-who">{offer.who}</p>
                      <p className="platform-offer-condition">{offer.condition}</p>
                      {offer.items ? (
                        <p className="platform-offer-items">{offer.items.join(' · ')}</p>
                      ) : null}
                      {offer.code ? (
                        <p className="platform-offer-code">
                          <span className="sr-only">Coupon code: </span>
                          {offer.code}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>

                <p className="platform-card-footnote">{platform.footnote}</p>

                {platform.bankOffers ? (
                  <ul className="bank-offer-list">
                    {platform.bankOffers.map((bank) => (
                      <li key={bank.id} className="bank-offer">
                        <span className="bank-offer-label">{bank.label}</span>
                        <span className="bank-offer-detail">{bank.detail}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}

                <a
                  className="btn btn-primary platform-card-cta"
                  href={platform.link}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Order on {platform.name}
                </a>
              </article>
            ))}
          </div>

          <aside className="in-store-offer reveal">
            <p className="in-store-offer-tag">At the counter</p>
            <p className="in-store-offer-top">
              <span className="in-store-offer-headline">{IN_STORE_OFFER.headline}</span>
            </p>
            <p className="in-store-offer-who">{IN_STORE_OFFER.who}</p>
            <p className="in-store-offer-condition">{IN_STORE_OFFER.condition}</p>
          </aside>

          <div className="combo-strip reveal">
            <h3>Combo deals</h3>
            <ul>
              {COMBOS.map((combo) => (
                <li key={combo.id}>
                  <span className="combo-name">{combo.name}</span>
                  <span className="combo-price">₹{combo.price}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="row mt-5">
            <div className="col-md-6 mb-4 reveal">
              <div className="card h-100">
                <div className="card-body">
                  <div className="mb-3">
                    <span className="offer-tag">This month</span>
                  </div>
                  <h3 className="card-title">Fresh offers on Instagram</h3>
                  <p className="card-text">New deals and seasonal specials drop first on our Instagram. Follow along so you never miss one.</p>
                  <a href="https://www.instagram.com/blendnbubbles" target="_blank" rel="noopener noreferrer" className="btn btn-primary">Follow @blendnbubbles</a>
                </div>
              </div>
            </div>
            <div className="col-md-6 mb-4 reveal">
              <div className="card h-100">
                <div className="card-body">
                  <div className="mb-3">
                    <span className="offer-tag">New</span>
                  </div>
                  <h3 className="card-title">Host your event with us</h3>
                  <p className="card-text">Birthdays, fests, office parties — bubble tea counters and bulk orders for any headcount.</p>
                  <Link to="/events" className="btn btn-primary">Request an event</Link>
                </div>
              </div>
            </div>
          </div>
          <div className="text-center mt-3 reveal">
            <Link to="/" className="btn btn-outline-primary">Back to Home</Link>
          </div>
        </div>
      </section>

      </main>

      {/* Footer */}
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

export default Offers;
