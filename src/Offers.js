import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './App.css';
import SpinWheel, { PRIZES } from './SpinWheel';

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
    if (meta) meta.setAttribute('content', 'Exclusive BlendNBubbles offers, anniversary surprises and weekly perks. Tap your fridge magnet to unlock fresh announcements.');
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
                <a className="nav-link" href="/#contact" onClick={handleVisitUsClick}>Visit Us</a>
              </li>
              <li className="nav-item ms-lg-2">
                <a className="nav-link btn-order" href="https://www.zomato.com/kolkata/blend-n-bubbles-barrackpore/order" target="_blank" rel="noopener noreferrer">Order Now</a>
              </li>
            </ul>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className="hero" id="offers-hero">
        <div className="hero-content">
          <div className="container">
            <div className="row align-items-center">
              <div className="col-lg-7 hero-text-container">
                <p className="hero-subtitle">Tap. Sip. Win.</p>
                <h1 className="hero-title">Spin &amp; Win</h1>
                <p className="hero-text">
                  Take one spin on the anniversary wheel for a prize you can claim in-store. One play per customer.
                </p>
                <div className="hero-buttons">
                  <a href="#spin-prizes" className="btn btn-primary">Spin the Wheel</a>
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

      {/* Spin & Win wheel */}
      <section className="py-5" id="spin-prizes">
        <div className="container">
          <div className="text-center mb-5 reveal">
            <div className="mb-3">
              <span className="offer-tag offer-tag-spin">SPIN &amp; WIN</span>
            </div>
            <h2 className="mb-2">Spin the anniversary wheel</h2>
            <p className="text-muted mb-0">One spin per customer. Land anywhere and the prize is yours.</p>
          </div>

          <div className="row justify-content-center reveal">
            <div className="col-12 col-md-10 col-lg-8">
              <SpinWheel />
            </div>
          </div>

          <div className="text-center mt-5 reveal">
            <details className="prize-disclosure">
              <summary className="prize-disclosure-summary">See all {PRIZES.length} prizes</summary>
              <ul className="prize-disclosure-list mt-3">
                {PRIZES.map((prize, index) => (
                  <li key={prize.option}>
                    <strong>{index + 1}.</strong> {prize.title}
                  </li>
                ))}
              </ul>
            </details>
            <p className="text-muted small mt-4 mb-4">All offers available in-store during our anniversary celebrations. One spin per customer, prizes while stocks last.</p>
            <Link to="/" className="btn btn-primary">Back to Home</Link>
          </div>
        </div>
      </section>

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
